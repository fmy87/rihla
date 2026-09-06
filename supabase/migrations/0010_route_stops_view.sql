-- 0010_route_stops_view.sql
-- route_stops.location is a PostGIS geography(Point); PostgREST can't expose
-- ST_X/ST_Y directly on the base table, so this read-only view extracts
-- latitude/longitude for the Route Editor map. Writes still go through the
-- base `route_stops` table (see routes.ts — inserts send a WKT 'POINT(lng lat)'
-- string, which the geography column's input function parses directly).

create or replace view route_stops_with_coords
with (security_invoker = true)
as
select
  id,
  route_id,
  sequence,
  name_en,
  name_ar,
  address,
  ST_Y(location::geometry) as latitude,
  ST_X(location::geometry) as longitude,
  map_place_id,
  estimated_arrival_time,
  stop_type,
  geofence_radius_meters,
  notes,
  created_at,
  updated_at
from route_stops;
