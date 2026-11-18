ALTER TABLE public.profiles
  ADD COLUMN play_seconds INTEGER NOT NULL DEFAULT 0 CHECK (play_seconds >= 0),
  ADD COLUMN enemies_killed INTEGER NOT NULL DEFAULT 0 CHECK (enemies_killed >= 0),
  ADD COLUMN deaths INTEGER NOT NULL DEFAULT 0 CHECK (deaths >= 0);

CREATE OR REPLACE FUNCTION public.search_player_directory(search_term TEXT)
RETURNS TABLE (
  display_name TEXT,
  level INTEGER,
  experience INTEGER,
  dungeons_completed INTEGER,
  enemies_killed INTEGER,
  deaths INTEGER,
  hours_played NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.display_name,
    p.level,
    p.experience,
    p.dungeons_completed,
    p.enemies_killed,
    p.deaths,
    ROUND(p.play_seconds / 3600.0, 1)
  FROM public.profiles AS p
  WHERE auth.uid() IS NOT NULL
    AND length(trim(search_term)) >= 2
    AND p.id <> auth.uid()
    AND p.display_name ILIKE '%' ||
      replace(replace(replace(trim(search_term), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_')
      || '%' ESCAPE E'\\'
  ORDER BY p.level DESC, p.dungeons_completed DESC, p.enemies_killed DESC
  LIMIT 25;
$$;
GRANT EXECUTE ON FUNCTION public.search_player_directory(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_player_session(
  played_seconds INTEGER,
  kill_count INTEGER,
  death_count INTEGER
)
RETURNS TABLE (play_seconds INTEGER, enemies_killed INTEGER, deaths INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF played_seconds < 0 OR played_seconds > 86400
    OR kill_count < 0 OR kill_count > 10000
    OR death_count < 0 OR death_count > 10000 THEN
    RAISE EXCEPTION 'Invalid session stats';
  END IF;

  RETURN QUERY
  UPDATE public.profiles AS p
  SET
    play_seconds = p.play_seconds + played_seconds,
    enemies_killed = p.enemies_killed + kill_count,
    deaths = p.deaths + death_count
  WHERE p.id = auth.uid()
  RETURNING p.play_seconds, p.enemies_killed, p.deaths;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_player_session(INTEGER, INTEGER, INTEGER) TO authenticated;
