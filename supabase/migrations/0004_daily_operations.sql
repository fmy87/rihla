-- 0004_daily_operations.sql
-- TODAY's operational instance, generated from master each day. Overrides here
-- never mutate routes/route_stops/student_route_assignments.

create table daily_routes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  route_id uuid not null references routes(id) on delete restrict,
  service_date date not null,
  bus_id uuid not null references buses(id) on delete restrict,
  driver_id uuid not null references drivers(id) on delete restrict,
  status daily_route_status not null default 'not_started',
  started_at timestamptz,
  started_location geography(Point, 4326),
  completed_at timestamptz,
  is_override boolean not null default false, -- true if bus/driver differs from route default
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, service_date) -- one daily instance per master route per day
);
create trigger trg_daily_routes_updated_at before update on daily_routes
  for each row execute function set_updated_at();
create index idx_daily_routes_school_date on daily_routes(school_id, service_date);
create index idx_daily_routes_bus_date on daily_routes(bus_id, service_date);
create index idx_daily_routes_driver_date on daily_routes(driver_id, service_date);

create table daily_route_stops (
  id uuid primary key default uuid_generate_v4(),
  daily_route_id uuid not null references daily_routes(id) on delete cascade,
  route_stop_id uuid references route_stops(id) on delete set null, -- null = temporary stop
  sequence int not null,
  name_en text not null,
  name_ar text,
  location geography(Point, 4326) not null,
  estimated_arrival_time time,
  geofence_radius_meters int,
  stop_type stop_event_type not null,
  is_skipped boolean not null default false,
  skipped_reason text,
  arrived_at timestamptz, -- set when geofence entry detected
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_route_id, sequence)
);
create trigger trg_drs_updated_at before update on daily_route_stops
  for each row execute function set_updated_at();
create index idx_drs_daily_route on daily_route_stops(daily_route_id);
create index idx_drs_location on daily_route_stops using gist (location);

create table daily_student_assignments (
  id uuid primary key default uuid_generate_v4(),
  daily_route_stop_id uuid not null references daily_route_stops(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status confirmation_status not null default 'pending',
  not_confirmed_reason not_picked_up_reason,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_route_stop_id, student_id)
);
create trigger trg_dsa_updated_at before update on daily_student_assignments
  for each row execute function set_updated_at();
create index idx_dsa_stop on daily_student_assignments(daily_route_stop_id);
create index idx_dsa_student on daily_student_assignments(student_id);

-- Append-only, immutable events. Uniqueness prevents duplicate confirmations.
create table pickup_events (
  id uuid primary key default uuid_generate_v4(),
  daily_student_assignment_id uuid not null references daily_student_assignments(id) on delete cascade,
  driver_id uuid not null references drivers(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  location geography(Point, 4326),
  created_at timestamptz not null default now(),
  unique (daily_student_assignment_id)
);
create index idx_pickup_events_assignment on pickup_events(daily_student_assignment_id);

create table dropoff_events (
  id uuid primary key default uuid_generate_v4(),
  daily_student_assignment_id uuid not null references daily_student_assignments(id) on delete cascade,
  driver_id uuid not null references drivers(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  location geography(Point, 4326),
  created_at timestamptz not null default now(),
  unique (daily_student_assignment_id)
);
create index idx_dropoff_events_assignment on dropoff_events(daily_student_assignment_id);

-- Daily rollup, one row per student per service_date, kept in sync via triggers/edge function.
create table attendance (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  service_date date not null,
  pickup_status confirmation_status not null default 'pending',
  dropoff_status confirmation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, service_date)
);
create trigger trg_attendance_updated_at before update on attendance
  for each row execute function set_updated_at();
create index idx_attendance_school_date on attendance(school_id, service_date);
