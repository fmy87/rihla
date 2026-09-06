-- 0015_gps_locations_with_coords.sql
-- Same rationale as `latest_gps_locations` (0009) and `route_stops_with_coords`
-- (0010): PostGIS functions aren't queryable directly over PostgREST, so
-- this extracts lat/lng for every row, not just the latest one per bus.
-- Used by the admin Route Replay screen to play back a completed (or
-- in-progress) daily route's full GPS trail.

create or replace view gps_locations_with_coords
with (security_invoker = true) -- inherit the querying user's own RLS, not the view owner's
as
select
  id,
  daily_route_id,
  bus_id,
  driver_id,
  ST_Y(location::geometry) as latitude,
  ST_X(location::geometry) as longitude,
  speed_kmh,
  accuracy_meters,
  recorded_at,
  is_offline_backfill
from gps_locations;
