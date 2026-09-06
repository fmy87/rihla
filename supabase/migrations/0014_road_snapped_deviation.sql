-- 0014_road_snapped_deviation.sql
-- Upgrades route deviation detection from a straight-line path through stops
-- to the actual road-snapped polyline the admin Route Editor already draws
-- via the Google Directions API (Phase 5) — that result was only ever
-- rendered on screen and discarded; this migration gives it somewhere to
-- live and teaches the deviation check to prefer it.

-- ---------- Storage ----------

alter table routes add column if not exists road_polyline text;
comment on column routes.road_polyline is
  'Encoded polyline (Google Directions API overview_polyline.points) for the '
  'road-snapped path through this route''s stops, captured by the admin Route '
  'Editor whenever it recomputes directions. Null until a route with 2+ stops '
  'has been opened in the editor at least once since this column was added; '
  'route_planned_line() falls back to a straight line through stops when null.';

-- ---------- Decode + cache helper ----------

-- ST_LineFromEncodedPolyline decodes a Google polyline string into a
-- geometry LineString (precision 5, Google's default). Wrapped in its own
-- function so route_planned_line() stays simple and this is easy to swap
-- out later (e.g. for a version that also snaps individual stop points).
create or replace function decode_road_polyline(p_polyline text)
returns geography
language plpgsql
immutable
as $$
begin
  if p_polyline is null or length(p_polyline) = 0 then
    return null;
  end if;
  return ST_SetSRID(ST_LineFromEncodedPolyline(p_polyline), 4326)::geography;
exception
  when others then
    -- A malformed/truncated polyline should never take deviation detection
    -- down with it — fall back to the straight-line approximation instead.
    return null;
end;
$$;

-- ---------- route_planned_line: prefer the road-snapped polyline ----------

create or replace function route_planned_line(p_daily_route_id uuid)
returns geography
language sql
stable
as $$
  select coalesce(
    -- Preferred: the actual road-snapped path for this master route, if the
    -- admin has opened it in the Route Editor since this feature shipped.
    (
      select decode_road_polyline(r.road_polyline)
      from daily_routes dr
      join routes r on r.id = dr.route_id
      where dr.id = p_daily_route_id
    ),
    -- Fallback: straight-line path through the day's non-skipped stops in
    -- sequence (the original v1 approximation) — still used for routes that
    -- haven't captured a polyline yet, or if decoding ever fails.
    (
      select ST_MakeLine(array_agg(location::geometry order by sequence))::geography
      from daily_route_stops
      where daily_route_id = p_daily_route_id and is_skipped = false
    )
  );
$$;
