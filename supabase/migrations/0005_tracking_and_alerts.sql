-- 0005_tracking_and_alerts.sql
-- High-volume GPS time series + alert feed.

create table gps_locations (
  id uuid primary key default uuid_generate_v4(),
  daily_route_id uuid not null references daily_routes(id) on delete cascade,
  bus_id uuid not null references buses(id) on delete cascade,
  driver_id uuid not null references drivers(id) on delete cascade,
  location geography(Point, 4326) not null,
  speed_kmh numeric(5,2),
  accuracy_meters numeric(6,2),
  recorded_at timestamptz not null, -- device timestamp (may differ slightly from insert time)
  synced_at timestamptz not null default now(), -- when it actually reached the server
  is_offline_backfill boolean not null default false, -- true if synced after an offline gap
  created_at timestamptz not null default now()
);
-- "Latest position per bus" and "history for a given route/day" are the two hot queries.
create index idx_gps_bus_recorded on gps_locations(bus_id, recorded_at desc);
create index idx_gps_daily_route on gps_locations(daily_route_id, recorded_at);
create index idx_gps_location on gps_locations using gist (location);

create table alerts (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  type alert_type not null,
  severity alert_severity not null default 'warning',
  daily_route_id uuid references daily_routes(id) on delete cascade,
  bus_id uuid references buses(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  daily_student_assignment_id uuid references daily_student_assignments(id) on delete cascade,
  message_en text not null,
  message_ar text,
  deviation_distance_meters numeric(8,2),
  is_resolved boolean not null default false,
  resolved_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now()
);
create index idx_alerts_school_unresolved on alerts(school_id) where is_resolved = false;
create index idx_alerts_daily_route on alerts(daily_route_id);
