-- 0013_alerts_and_deviation.sql
-- Server-side alert generation. These functions are SECURITY DEFINER because
-- they're triggered by driver-initiated writes (a GPS ping, a skipped stop)
-- or run with no user context at all (the periodic check) — none of the
-- callers has (or should have) direct INSERT rights on `alerts` themselves;
-- see migration 0007's comment that alert inserts happen outside normal RLS.
-- The logic inside is fixed and not attacker-influenced beyond the specific
-- rows it's designed to read, which keeps this safe to run with elevated
-- rights.

-- ---------- Route deviation ----------

-- Approximates the "planned route" as a straight-line path through the
-- day's non-skipped stops, in sequence. This is a v1 approximation — a
-- road-snapped polyline (captured from the Directions API result already
-- shown in the admin Route Editor, Phase 5) would be materially more
-- accurate and is a good candidate for a follow-up migration.
create or replace function route_planned_line(p_daily_route_id uuid)
returns geography
language sql
stable
as $$
  select ST_MakeLine(array_agg(location::geometry order by sequence))::geography
  from daily_route_stops
  where daily_route_id = p_daily_route_id and is_skipped = false;
$$;

create or replace function check_route_deviation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_route daily_routes%rowtype;
  v_threshold int;
  v_line geography;
  v_distance numeric;
  v_existing_alert_id uuid;
begin
  select * into v_daily_route from daily_routes where id = new.daily_route_id;
  if not found or v_daily_route.status <> 'on_route' then
    return new;
  end if;

  select coalesce(route_deviation_threshold_meters, 150) into v_threshold
  from system_settings where school_id = v_daily_route.school_id;
  v_threshold := coalesce(v_threshold, 150);

  v_line := route_planned_line(new.daily_route_id);
  if v_line is null then
    return new; -- no stops configured yet, nothing to compare against
  end if;

  v_distance := ST_Distance(v_line, new.location);
  if v_distance <= v_threshold then
    return new;
  end if;

  -- Debounce: don't spam a new alert if an unresolved one already fired recently for this route.
  select id into v_existing_alert_id
  from alerts
  where daily_route_id = new.daily_route_id
    and type = 'route_deviation'
    and is_resolved = false
    and created_at > now() - interval '5 minutes'
  limit 1;
  if v_existing_alert_id is not null then
    return new;
  end if;

  insert into alerts (school_id, type, severity, daily_route_id, bus_id, message_en, message_ar, deviation_distance_meters)
  values (
    v_daily_route.school_id,
    'route_deviation',
    'warning',
    new.daily_route_id,
    new.bus_id,
    format('Bus has moved approximately %sm away from the planned route.', round(v_distance)),
    format('انحرفت الحافلة بمسافة تقارب %s م عن المسار المخطط.', round(v_distance)),
    v_distance
  );

  return new;
end;
$$;

drop trigger if exists trg_check_route_deviation on gps_locations;
create trigger trg_check_route_deviation
  after insert on gps_locations
  for each row execute function check_route_deviation();

-- ---------- Stop skipped ----------

create or replace function create_stop_skipped_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_route daily_routes%rowtype;
begin
  if new.is_skipped = true and coalesce(old.is_skipped, false) = false then
    select * into v_daily_route from daily_routes where id = new.daily_route_id;
    if found then
      insert into alerts (school_id, type, severity, daily_route_id, message_en, message_ar)
      values (
        v_daily_route.school_id,
        'stop_skipped',
        'warning',
        new.daily_route_id,
        format('Stop "%s" was skipped by the driver.', new.name_en),
        format('تم تخطي المحطة "%s" من قبل السائق.', new.name_en)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stop_skipped_alert on daily_route_stops;
create trigger trg_stop_skipped_alert
  after update on daily_route_stops
  for each row execute function create_stop_skipped_alert();

-- ---------- Periodic checks: bus offline, pickup/dropoff not confirmed ----------
-- Call this on a schedule (pg_cron below if available, or an external
-- scheduler hitting a small Edge Function that runs `select
-- run_periodic_alert_checks();`). Every check is idempotent — safe to run
-- as often as once a minute without creating duplicate alerts.

create or replace function run_periodic_alert_checks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- Bus offline: an on_route daily_route with no recent GPS ping.
  -- Joins schools so "today" and grace-period math below use each school's
  -- own configured timezone (schools.timezone), not the DB session's
  -- default (typically UTC) — otherwise this misfires near local midnight
  -- for any school not on UTC, which is every real deployment of this system.
  for r in
    select dr.id as daily_route_id, dr.school_id, dr.bus_id,
           coalesce(ss.bus_offline_threshold_minutes, 2) as threshold_minutes
    from daily_routes dr
    join schools s on s.id = dr.school_id
    left join system_settings ss on ss.school_id = dr.school_id
    where dr.status = 'on_route' and dr.service_date = (now() at time zone s.timezone)::date
  loop
    if not exists (
      select 1 from gps_locations
      where daily_route_id = r.daily_route_id
        and recorded_at > now() - (r.threshold_minutes || ' minutes')::interval
    ) then
      if not exists (
        select 1 from alerts
        where daily_route_id = r.daily_route_id and type = 'bus_offline' and is_resolved = false
      ) then
        insert into alerts (school_id, type, severity, daily_route_id, bus_id, message_en, message_ar)
        values (
          r.school_id, 'bus_offline', 'critical', r.daily_route_id, r.bus_id,
          'No GPS signal received recently — the bus may be offline.',
          'لم يتم استلام إشارة GPS مؤخرًا — قد تكون الحافلة غير متصلة.'
        );
      end if;
    end if;
  end loop;

  -- Pending pickup/dropoff past its scheduled time + grace period.
  -- Same timezone fix as above: estimated_arrival_time is a wall-clock time
  -- with no zone attached, so it must be interpreted in the school's own
  -- timezone before comparing against now() (timestamptz).
  for r in
    select dsa.id as assignment_id, drs.stop_type, drs.daily_route_id, dr.school_id
    from daily_student_assignments dsa
    join daily_route_stops drs on drs.id = dsa.daily_route_stop_id
    join daily_routes dr on dr.id = drs.daily_route_id
    join schools s on s.id = dr.school_id
    left join system_settings ss on ss.school_id = dr.school_id
    where dsa.status = 'pending'
      and dr.service_date = (now() at time zone s.timezone)::date
      and drs.estimated_arrival_time is not null
      and (timezone(s.timezone, dr.service_date + drs.estimated_arrival_time)
           + (coalesce(ss.pickup_grace_period_minutes, 5) || ' minutes')::interval) < now()
  loop
    if not exists (
      select 1 from alerts
      where daily_student_assignment_id = r.assignment_id
        and type in ('student_not_picked_up', 'dropoff_not_confirmed')
        and is_resolved = false
    ) then
      insert into alerts (school_id, type, severity, daily_route_id, daily_student_assignment_id, message_en, message_ar)
      values (
        r.school_id,
        case when r.stop_type = 'pickup' then 'student_not_picked_up' else 'dropoff_not_confirmed' end,
        'critical',
        r.daily_route_id,
        r.assignment_id,
        'Scheduled time has passed without confirmation.',
        'مضى الوقت المحدد دون تأكيد.'
      );
      update daily_student_assignments set status = 'not_confirmed' where id = r.assignment_id;
    end if;
  end loop;
end;
$$;

-- Best-effort scheduling: only runs if pg_cron is available on this Supabase
-- project (it's an opt-in extension). If it isn't, this block logs a notice
-- instead of failing the migration — schedule `run_periodic_alert_checks()`
-- externally (e.g. a small Edge Function hit by a cron-based trigger) in
-- that case.
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('school-bus-alert-checks', '* * * * *', 'select run_periodic_alert_checks();');
  else
    raise notice 'pg_cron extension not available on this project — schedule run_periodic_alert_checks() externally.';
  end if;
exception when others then
  raise notice 'Could not schedule pg_cron job (%). Schedule run_periodic_alert_checks() externally instead.', SQLERRM;
end;
$do$;

-- Realtime: the admin Alerts Center (Phase 9) subscribes to live changes on
-- this table via Supabase Realtime, which requires the table to be added to
-- the replication publication.
do $do$
begin
  alter publication supabase_realtime add table alerts;
exception when duplicate_object then
  null; -- already added, fine
when others then
  raise notice 'Could not add alerts to supabase_realtime publication (%). If Realtime is enabled on this project, add it manually: Database → Replication → supabase_realtime → alerts.', SQLERRM;
end;
$do$;
