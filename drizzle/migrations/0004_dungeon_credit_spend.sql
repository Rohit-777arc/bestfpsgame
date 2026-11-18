CREATE OR REPLACE FUNCTION public.spend_player_credits(credit_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  remaining_credits INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF credit_amount < 0 OR credit_amount > 10000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  UPDATE public.profiles
  SET credits = credits - credit_amount
  WHERE id = auth.uid() AND credits >= credit_amount
  RETURNING credits INTO remaining_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough credits';
  END IF;
  RETURN remaining_credits;
END;
$$;
GRANT EXECUTE ON FUNCTION public.spend_player_credits(INTEGER) TO authenticated;
