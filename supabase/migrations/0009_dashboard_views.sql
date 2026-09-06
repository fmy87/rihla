-- 0009_dashboard_views.sql
-- Read-only helper view for the admin Live Bus Map: the single latest GPS
-- ping per bus. Built on top of gps_locations, which stays empty until
-- Phase 8 (Live GPS Tracking) ships — the dashboard is wired to this view now
-- so it starts showing real markers the moment GPS data exists, no dashboard
-- changes required later.

create or replace view latest_gps_locations
with (security_invoker = true) -- inherit the querying user's own RLS, not the view owner's
as
select distinct on (bus_id)
  bus_id,
  daily_route_id,
  driver_id,
  location,
  ST_Y(location::geometry) as latitude,
  ST_X(location::geometry) as longitude,
  speed_kmh,
  recorded_at
from gps_locations
order by bus_id, recorded_at desc;
