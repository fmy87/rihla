-- 0003_master_routes.sql
-- MASTER configuration: permanent routes/stops, never touched by daily overrides.

create table routes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  name_en text not null,
  name_ar text,
  direction route_direction not null,
  default_bus_id uuid references buses(id) on delete set null,
  default_driver_id uuid references drivers(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_routes_updated_at before update on routes
  for each row execute function set_updated_at();
create index idx_routes_school on routes(school_id);

create table route_stops (
  id uuid primary key default uuid_generate_v4(),
  route_id uuid not null references routes(id) on delete cascade,
  sequence int not null, -- display/travel order, 1-based
  name_en text not null,
  name_ar text,
  address text,
  location geography(Point, 4326) not null,
  map_place_id text, -- provider place id, if selected via search
  estimated_arrival_time time, -- time-of-day, not a full timestamp
  stop_type stop_event_type not null, -- pickup (morning) or dropoff (afternoon)
  geofence_radius_meters int, -- null = use system_settings default
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, sequence)
);
create trigger trg_route_stops_updated_at before update on route_stops
  for each row execute function set_updated_at();
create index idx_route_stops_route on route_stops(route_id);
create index idx_route_stops_location on route_stops using gist (location);

-- Master assignment: which student boards/alights at which stop, on which route.
create table student_route_assignments (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  route_id uuid not null references routes(id) on delete cascade,
  stop_id uuid not null references route_stops(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a student can only have one ACTIVE assignment per route-direction pairing;
  -- app layer additionally warns if the student is already active on a different route
  unique (student_id, route_id)
);
create trigger trg_sra_updated_at before update on student_route_assignments
  for each row execute function set_updated_at();
create index idx_sra_student on student_route_assignments(student_id);
create index idx_sra_stop on student_route_assignments(stop_id);
