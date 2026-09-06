-- 0008_driver_login_lookup.sql
-- Drivers authenticate with (School + Employee ID + PIN) rather than an email.
-- Supabase Auth still requires an email/password under the hood, so each driver
-- gets a synthetic, non-deliverable login email; this function lets the
-- (unauthenticated) driver app resolve that email from Employee ID + School
-- before calling supabase.auth.signInWithPassword. It intentionally reveals
-- nothing except the email string for an active driver — no names, no PIN,
-- no other driver data — so it's safe to expose to anon.

alter table drivers add column if not exists login_email text unique;

create or replace function resolve_driver_login_email(
  p_school_id uuid,
  p_employee_id text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select login_email
  from drivers
  where school_id = p_school_id
    and employee_id = p_employee_id
    and is_active = true;
$$;

-- Only anon/authenticated (not the raw table) can call this narrow function.
revoke all on function resolve_driver_login_email(uuid, text) from public;
grant execute on function resolve_driver_login_email(uuid, text) to anon, authenticated;

-- Helper to generate the synthetic login email consistently when a driver is created.
create or replace function generate_driver_login_email()
returns trigger
language plpgsql
as $$
begin
  if new.login_email is null then
    new.login_email := 'drv.' || new.employee_id || '.' || new.school_id::text || '@driver.internal';
  end if;
  return new;
end;
$$;

create trigger trg_drivers_login_email
  before insert on drivers
  for each row execute function generate_driver_login_email();
