-- Native My Trail: the timeline uses an owner-scoped keyset and the map returns
-- a bounded grid. Existing check-in readers and visibility policies stay intact.

CREATE INDEX IF NOT EXISTS checkins_my_trail_time_idx
  ON public.checkins (user_id, created_at, id)
  WHERE type = 'want' AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180;

CREATE INDEX IF NOT EXISTS checkins_archive_my_trail_time_idx
  ON public.checkins_archive (user_id, created_at, id)
  WHERE type = 'want' AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180;

CREATE INDEX IF NOT EXISTS checkins_my_trail_location_idx
  ON public.checkins (user_id, lat, lng)
  WHERE type = 'want' AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180;

CREATE INDEX IF NOT EXISTS checkins_archive_my_trail_location_idx
  ON public.checkins_archive (user_id, lat, lng)
  WHERE type = 'want' AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180;

CREATE OR REPLACE FUNCTION public.my_checkin_trail_page(
  p_limit integer,
  p_after_at timestamptz,
  p_after_id uuid,
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision
)
RETURNS TABLE (checkin jsonb, page_cursor text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH live AS (
    SELECT c.id, c.beer_id, c.lat, c.lng, c.place_name, c.kind, c.visibility,
           c.expires_at, c.created_at, c.note, c.photo_thumb, c.tags, c.hashtags
      FROM public.checkins c
      WHERE c.user_id = (SELECT auth.uid()) AND c.type = 'want'
        AND c.lat BETWEEN -90 AND 90 AND c.lng BETWEEN -180 AND 180
        AND isfinite(c.created_at)
        AND (p_after_at IS NULL OR (c.created_at, c.id) > (p_after_at, p_after_id))
        AND (
          p_west IS NULL OR (
            c.lat BETWEEN p_south AND p_north AND (
              (p_west <= p_east AND c.lng BETWEEN p_west AND p_east)
              OR (p_west > p_east AND (c.lng >= p_west OR c.lng <= p_east))
            )
          )
        )
      ORDER BY c.created_at, c.id
      LIMIT greatest(1, least(p_limit, 50)) + 1
  ), archived AS (
    SELECT c.id, c.beer_id, c.lat, c.lng, c.place_name, c.kind, c.visibility,
           c.expires_at, c.created_at, c.note, c.photo_thumb, c.tags, c.hashtags
      FROM public.checkins_archive c
      WHERE c.user_id = (SELECT auth.uid()) AND c.type = 'want'
        AND c.lat BETWEEN -90 AND 90 AND c.lng BETWEEN -180 AND 180
        AND isfinite(c.created_at)
        AND (p_after_at IS NULL OR (c.created_at, c.id) > (p_after_at, p_after_id))
        AND (
          p_west IS NULL OR (
            c.lat BETWEEN p_south AND p_north AND (
              (p_west <= p_east AND c.lng BETWEEN p_west AND p_east)
              OR (p_west > p_east AND (c.lng >= p_west OR c.lng <= p_east))
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.checkins active
          WHERE active.id = c.id AND active.user_id = c.user_id
        )
      ORDER BY c.created_at, c.id
      LIMIT greatest(1, least(p_limit, 50)) + 1
  ), page AS (
    SELECT * FROM live
    UNION ALL
    SELECT * FROM archived
    ORDER BY created_at, id
    LIMIT greatest(1, least(p_limit, 50)) + 1
  )
  SELECT to_jsonb(p) || jsonb_build_object(
           'beers', CASE WHEN b.id IS NOT NULL THEN jsonb_build_object(
             'id', b.id, 'name', b.name, 'emoji', b.emoji, 'category', b.category,
             'tagline', b.tagline, 'icon_url', b.icon_url
           ) END
         ),
         to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || p.id::text
  FROM page p LEFT JOIN public.beers b ON b.id = p.beer_id
  ORDER BY p.created_at, p.id;
$$;

CREATE OR REPLACE FUNCTION public.my_checkin_trail_map(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_zoom double precision
)
RETURNS TABLE (
  id text, lat double precision, lng double precision,
  count bigint, checkin jsonb, bbox text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH viewport AS (
    SELECT p_west > p_east AS crosses_dateline,
           floor(p_zoom) AS zoom,
           greatest(
             90 / power(2, floor(p_zoom)),
             (p_east + CASE WHEN p_west > p_east THEN 360 ELSE 0 END - p_west) / 12
           ) AS x_step,
           greatest(
             45 / power(2, floor(p_zoom)),
             (p_north - p_south) / 12
           ) AS y_step
    WHERE p_west BETWEEN -180 AND 180 AND p_east BETWEEN -180 AND 180
      AND p_south >= -90 AND p_north <= 90 AND p_south < p_north
      AND p_zoom BETWEEN 0 AND 24 AND p_west <> p_east
      AND (p_west <> 180 OR p_east <> -180)
  ), visible AS MATERIALIZED (
    SELECT c.id, c.lat, c.lng, false AS archived
      FROM public.checkins c
      WHERE c.user_id = (SELECT auth.uid()) AND c.type = 'want'
        AND c.lat BETWEEN -90 AND 90 AND c.lng BETWEEN -180 AND 180
        AND isfinite(c.created_at) AND c.lat BETWEEN p_south AND p_north
        AND (
          (p_west <= p_east AND c.lng BETWEEN p_west AND p_east)
          OR (p_west > p_east AND (c.lng >= p_west OR c.lng <= p_east))
        )
    UNION ALL
    SELECT c.id, c.lat, c.lng, true AS archived
      FROM public.checkins_archive c
      WHERE c.user_id = (SELECT auth.uid()) AND c.type = 'want'
        AND c.lat BETWEEN -90 AND 90 AND c.lng BETWEEN -180 AND 180
        AND isfinite(c.created_at) AND c.lat BETWEEN p_south AND p_north
        AND (
          (p_west <= p_east AND c.lng BETWEEN p_west AND p_east)
          OR (p_west > p_east AND (c.lng >= p_west OR c.lng <= p_east))
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.checkins active
          WHERE active.id = c.id AND active.user_id = c.user_id
        )
  ), projected AS (
    SELECT v.id, v.lat, v.lng, v.archived, g.zoom, g.x_step, g.y_step,
           g.crosses_dateline AND v.lng < p_west AS wrapped,
           CASE WHEN g.crosses_dateline AND v.lng < p_west THEN v.lng + 360 ELSE v.lng END AS x
      FROM visible v CROSS JOIN viewport g
  ), buckets AS (
    -- A cell is at least 1/12 of the viewport on each axis, so at most
    -- 14 by 14 cells can meet a viewport. Never drop records to cap symbols.
    SELECT floor(p.x / p.x_step)::integer AS cell_x,
           floor(p.lat / p.y_step)::integer AS cell_y,
           p.zoom, p.x_step, p.y_step, count(*) AS total,
           min(p.id::text)::uuid AS single_id, bool_or(p.archived) AS is_archived,
           avg(p.x) AS center_x, avg(p.lat) AS center_y,
           coalesce(min(p.lng) FILTER (WHERE NOT p.wrapped), min(p.lng)) AS west,
           coalesce(max(p.lng) FILTER (WHERE p.wrapped), max(p.lng)) AS east,
           min(p.lat) AS min_y, max(p.lat) AS max_y
      FROM projected p
      GROUP BY 1, 2, p.zoom, p.x_step, p.y_step
  ), points AS (
    SELECT b.*,
           CASE
             WHEN b.total = 1 THEN b.west
             WHEN b.center_x > 180 THEN b.center_x - 360
             ELSE b.center_x
           END AS center_lng
      FROM buckets b
  )
  SELECT
    CASE WHEN p.total = 1 THEN p.single_id::text ELSE
      concat_ws(':', 'trail', p.zoom, p.x_step, p.y_step, p.cell_x, p.cell_y)
    END,
    p.center_y, p.center_lng, p.total,
    CASE WHEN p.total = 1 THEN jsonb_build_object(
      'id', p.single_id, 'lat', p.center_y, 'lng', p.center_lng,
      'beer_id', coalesce(c.beer_id, a.beer_id),
      'place_name', coalesce(c.place_name, a.place_name),
      'kind', coalesce(c.kind, a.kind, 'flash'),
      'visibility', coalesce(c.visibility, a.visibility, 'private'),
      'expires_at', coalesce(c.expires_at, a.expires_at),
      'created_at', coalesce(c.created_at, a.created_at),
      'beers', CASE WHEN beer.id IS NOT NULL THEN jsonb_build_object(
        'id', beer.id, 'name', beer.name, 'emoji', beer.emoji, 'category', beer.category,
        'tagline', beer.tagline, 'icon_url', beer.icon_url
      ) END
    ) END,
    CASE WHEN p.total > 1 THEN concat_ws(',', p.west, p.min_y, p.east, p.max_y) END
  FROM points p
    LEFT JOIN public.checkins c ON p.total = 1 AND NOT p.is_archived AND c.id = p.single_id
      AND c.user_id = (SELECT auth.uid())
    LEFT JOIN public.checkins_archive a ON p.total = 1 AND p.is_archived AND a.id = p.single_id
      AND a.user_id = (SELECT auth.uid())
    LEFT JOIN public.beers beer ON beer.id = coalesce(c.beer_id, a.beer_id)
  ORDER BY p.cell_y, p.cell_x;
$$;

REVOKE ALL ON FUNCTION public.my_checkin_trail_page(
  integer, timestamptz, uuid, double precision, double precision, double precision, double precision
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_checkin_trail_map(
  double precision, double precision, double precision, double precision, double precision
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_checkin_trail_page(
  integer, timestamptz, uuid, double precision, double precision, double precision, double precision
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_checkin_trail_map(
  double precision, double precision, double precision, double precision, double precision
) TO authenticated;
