-- 0002_core_tables.sql
-- Tenant root (schools) + people + fleet + settings.

create table schools (
  id uuid primary key default uuid_generate_v4(),
  name_en text not null,
  name_ar text,
  logo_url text,
  timezone text not null default 'Asia/Muscat',
  default_language text not null default 'en' check (default_language in ('en', 'ar')),
  primary_accent_color text default '#0F172A',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_schools_updated_at before update on schools
  for each row execute function set_updated_at();

-- One row per authenticated person; extends auth.users (Supabase managed table).
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  email text,
  phone text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ar')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();
create index idx_users_school on users(school_id);

create table drivers (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid unique references users(id) on delete set null, -- login identity
  employee_id text not null,
  full_name text not null,
  phone text,
  email text,
  photo_url text,
  license_number text,
  license_expiry date,
  pin_hash text, -- for Employee ID + PIN login flow, hashed
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, employee_id)
);
create trigger trg_drivers_updated_at before update on drivers
  for each row execute function set_updated_at();
create index idx_drivers_school on drivers(school_id);

create table buses (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  bus_number text not null,
  registration_number text not null,
  nickname_en text,
  nickname_ar text,
  capacity int not null check (capacity > 0),
  default_driver_id uuid references drivers(id) on delete set null,
  assistant_name text,
  status bus_status not null default 'not_started',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, bus_number)
);
create trigger trg_buses_updated_at before update on buses
  for each row execute function set_updated_at();
create index idx_buses_school on buses(school_id);

create table students (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_code text not null, -- school-issued student ID
  name_en text not null,
  name_ar text,
  grade text,
  class_name text,
  gender text check (gender in ('male', 'female')),
  guardian_name text,
  guardian_phone text,
  special_notes text, -- kept out of driver-facing views by RLS/column selection
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_code)
);
create trigger trg_students_updated_at before update on students
  for each row execute function set_updated_at();
create index idx_students_school on students(school_id);

create table system_settings (
  school_id uuid primary key references schools(id) on delete cascade,
  gps_update_interval_seconds int not null default 15,
  stop_geofence_radius_meters int not null default 100,
  route_deviation_threshold_meters int not null default 150,
  pickup_grace_period_minutes int not null default 5,
  bus_offline_threshold_minutes int not null default 2,
  updated_at timestamptz not null default now()
);
create trigger trg_settings_updated_at before update on system_settings
  for each row execute function set_updated_at();
