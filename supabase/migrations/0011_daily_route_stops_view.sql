-- 0011_daily_route_stops_view.sql
-- Same rationale as route_stops_with_coords (migration 0010): PostGIS
-- functions aren't queryable directly over PostgREST, so this read-only view
-- extracts lat/lng for the driver app's Route screen map. Writes still go
-- through the base `daily_route_stops` table.

create or replace view daily_route_stops_with_coords
with (security_invoker = true)
as
select
  id,
  daily_route_id,
  route_stop_id,
  sequence,
  name_en,
  name_ar,
  ST_Y(location::geometry) as latitude,
  ST_X(location::geometry) as longitude,
  estimated_arrival_time,
  geofence_radius_meters,
  stop_type,
  is_skipped,
  skipped_reason,
  arrived_at,
  created_at,
  updated_at
from daily_route_stops;
