-- 0001_extensions_and_enums.sql
-- Extensions + shared enum types used across the schema.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "postgis"; -- geography(Point), distance calc for geofencing/deviation

-- Roles (kept minimal; fine-grained permission checks happen via RLS policies)
create type user_role as enum ('super_admin', 'transport_admin', 'driver');

create type bus_status as enum (
  'not_started', 'preparing', 'on_route', 'delayed', 'completed', 'offline', 'emergency'
);

create type route_direction as enum ('home_to_school', 'school_to_home');

create type stop_event_type as enum ('pickup', 'dropoff');

create type confirmation_status as enum (
  'pending', 'picked_up', 'dropped_off', 'absent', 'cancelled', 'not_confirmed', 'exception'
);

create type not_picked_up_reason as enum (
  'student_absent', 'parent_cancelled', 'student_not_ready', 'wrong_location', 'other'
);

create type alert_type as enum (
  'student_not_picked_up', 'route_deviation', 'bus_delayed', 'bus_offline',
  'dropoff_not_confirmed', 'route_not_started', 'stop_skipped'
);

create type alert_severity as enum ('info', 'warning', 'critical');

create type daily_route_status as enum (
  'not_started', 'on_route', 'delayed', 'completed', 'cancelled'
);

-- updated_at trigger helper, reused by every table below
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
