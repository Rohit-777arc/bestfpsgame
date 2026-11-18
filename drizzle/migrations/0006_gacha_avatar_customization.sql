ALTER TABLE public.profiles
  ADD COLUMN equipped_weapon_skin TEXT,
  ADD COLUMN avatar_customization_unlocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN avatar_skin_tone TEXT NOT NULL DEFAULT '#c8a77a',
  ADD COLUMN avatar_hair_color TEXT NOT NULL DEFAULT '#382c2a',
  ADD COLUMN avatar_body_color TEXT NOT NULL DEFAULT '#53677a',
  ADD COLUMN avatar_feet_color TEXT NOT NULL DEFAULT '#34383b',
  ADD COLUMN avatar_boots_color TEXT NOT NULL DEFAULT '#22272a',
  ADD COLUMN avatar_accessories_color TEXT NOT NULL DEFAULT '#d5b36c',
  ADD COLUMN avatar_mask_color TEXT NOT NULL DEFAULT '#26333c',
  ADD COLUMN avatar_hat_color TEXT NOT NULL DEFAULT '#394554',
  ADD COLUMN avatar_dress_color TEXT NOT NULL DEFAULT '#53677a';

CREATE TABLE public.weapon_skin_catalog (
  skin_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'secret')),
  color TEXT NOT NULL
);
GRANT SELECT ON public.weapon_skin_catalog TO authenticated;
ALTER TABLE public.weapon_skin_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weapon_skin_catalog_select_all" ON public.weapon_skin_catalog FOR SELECT TO authenticated USING (true);

INSERT INTO public.weapon_skin_catalog (skin_id, display_name, rarity, color) VALUES
  ('field-worn', 'Field Worn', 'common', '#87907d'),
  ('dust-runner', 'Dust Runner', 'common', '#b78b58'),
  ('night-watch', 'Night Watch', 'common', '#4b5c69'),
  ('mint-condition', 'Mint Condition', 'uncommon', '#73bf9b'),
  ('blueprint', 'Blueprint', 'uncommon', '#4e9fdb'),
  ('sunset-camo', 'Sunset Camo', 'uncommon', '#db7652'),
  ('arctic-ops', 'Arctic Ops', 'rare', '#a9d8e8'),
  ('toxic-grid', 'Toxic Grid', 'rare', '#81d62d'),
  ('royal-steel', 'Royal Steel', 'rare', '#8873d8'),
  ('solar-flare', 'Solar Flare', 'epic', '#f3a83b'),
  ('neon-pulse', 'Neon Pulse', 'epic', '#f34bcb'),
  ('deep-sea', 'Deep Sea', 'epic', '#316cc5'),
  ('gold-standard', 'Gold Standard', 'legendary', '#f2cb48'),
  ('dragon-glass', 'Dragon Glass', 'legendary', '#cf4c59'),
  ('starlight', 'Starlight', 'legendary', '#c4a4ff'),
  ('void-born', 'Void Born', 'mythic', '#aa54ff'),
  ('prism-break', 'Prism Break', 'mythic', '#54e2df'),
  ('ultraviolet', 'Ultraviolet', 'mythic', '#7739ca'),
  ('glitch-prototype', 'Glitch Prototype', 'secret', '#ff3b76'),
  ('ghost-code', 'Ghost Code', 'secret', '#d8fffb'),
  ('zero-day', 'Zero Day', 'secret', '#24242a');

CREATE TABLE public.profile_weapon_skins (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skin_id TEXT NOT NULL REFERENCES public.weapon_skin_catalog(skin_id),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skin_id)
);
GRANT SELECT ON public.profile_weapon_skins TO authenticated;
GRANT ALL ON public.profile_weapon_skins TO service_role;
ALTER TABLE public.profile_weapon_skins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_weapon_skins_select_own" ON public.profile_weapon_skins FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.open_weapon_crate(crate_rarity TEXT)
RETURNS TABLE(skin_id TEXT, credits INTEGER, refunded BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  crate_price INTEGER;
  awarded_skin TEXT;
  remaining_credits INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  crate_price := CASE crate_rarity
    WHEN 'common' THEN 100
    WHEN 'uncommon' THEN 250
    WHEN 'rare' THEN 500
    WHEN 'epic' THEN 900
    WHEN 'legendary' THEN 1500
    WHEN 'mythic' THEN 2500
    WHEN 'secret' THEN 4000
    ELSE NULL
  END;
  IF crate_price IS NULL THEN
    RAISE EXCEPTION 'Unknown crate rarity';
  END IF;

  UPDATE public.profiles
  SET credits = public.profiles.credits - crate_price
  WHERE id = auth.uid() AND public.profiles.credits >= crate_price
  RETURNING public.profiles.credits INTO remaining_credits;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough credits';
  END IF;

  SELECT catalog.skin_id INTO awarded_skin
  FROM public.weapon_skin_catalog AS catalog
  WHERE catalog.rarity = crate_rarity
    AND NOT EXISTS (
      SELECT 1 FROM public.profile_weapon_skins AS owned
      WHERE owned.user_id = auth.uid() AND owned.skin_id = catalog.skin_id
    )
  ORDER BY random()
  LIMIT 1;

  IF awarded_skin IS NULL THEN
    UPDATE public.profiles
    SET credits = public.profiles.credits + crate_price
    WHERE id = auth.uid()
    RETURNING public.profiles.credits INTO remaining_credits;
    RETURN QUERY SELECT NULL::TEXT, remaining_credits, true;
    RETURN;
  END IF;

  INSERT INTO public.profile_weapon_skins (user_id, skin_id)
  VALUES (auth.uid(), awarded_skin);
  RETURN QUERY SELECT awarded_skin, remaining_credits, false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.open_weapon_crate(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.spin_credit_lottery()
RETURNS TABLE(prize INTEGER, credits INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  roll REAL;
  winnings INTEGER;
  remaining_credits INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles
  SET credits = public.profiles.credits - 100
  WHERE id = auth.uid() AND public.profiles.credits >= 100
  RETURNING public.profiles.credits INTO remaining_credits;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough credits';
  END IF;

  roll := random();
  winnings := CASE
    WHEN roll < 0.35 THEN 0
    WHEN roll < 0.70 THEN 50
    WHEN roll < 0.88 THEN 100
    WHEN roll < 0.97 THEN 250
    ELSE 1000
  END;
  UPDATE public.profiles
  SET credits = public.profiles.credits + winnings
  WHERE id = auth.uid()
  RETURNING public.profiles.credits INTO remaining_credits;
  RETURN QUERY SELECT winnings, remaining_credits;
END;
$$;
GRANT EXECUTE ON FUNCTION public.spin_credit_lottery() TO authenticated;

CREATE OR REPLACE FUNCTION public.unlock_avatar_customization()
RETURNS TABLE(credits INTEGER, unlocked BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  remaining_credits INTEGER;
  is_unlocked BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT profile.avatar_customization_unlocked INTO is_unlocked
  FROM public.profiles AS profile WHERE profile.id = auth.uid();
  IF is_unlocked IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF is_unlocked THEN
    SELECT profile.credits INTO remaining_credits
    FROM public.profiles AS profile WHERE profile.id = auth.uid();
    RETURN QUERY SELECT remaining_credits, true;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET credits = public.profiles.credits - 1000,
      avatar_customization_unlocked = true
  WHERE id = auth.uid() AND public.profiles.credits >= 1000
  RETURNING public.profiles.credits INTO remaining_credits;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough credits';
  END IF;
  RETURN QUERY SELECT remaining_credits, true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.unlock_avatar_customization() TO authenticated;

CREATE OR REPLACE FUNCTION public.import_guest_weapon_skins(skin_ids TEXT[], equipped_skin TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  owned_skins TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.profile_weapon_skins (user_id, skin_id)
  SELECT auth.uid(), catalog.skin_id
  FROM public.weapon_skin_catalog AS catalog
  WHERE catalog.skin_id = ANY(skin_ids)
  ON CONFLICT (user_id, skin_id) DO NOTHING;

  IF equipped_skin IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profile_weapon_skins AS owned
    WHERE owned.user_id = auth.uid() AND owned.skin_id = equipped_skin
  ) THEN
    UPDATE public.profiles
    SET equipped_weapon_skin = equipped_skin
    WHERE id = auth.uid();
  END IF;

  SELECT COALESCE(array_agg(owned.skin_id), ARRAY[]::TEXT[]) INTO owned_skins
  FROM public.profile_weapon_skins AS owned
  WHERE owned.user_id = auth.uid();
  RETURN owned_skins;
END;
$$;
GRANT EXECUTE ON FUNCTION public.import_guest_weapon_skins(TEXT[], TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_avatar_customization(colors JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  allowed_colors TEXT[] := ARRAY[
    '#f2c9a5', '#d9a276', '#c8a77a', '#a86f4f', '#75442f',
    '#382c2a', '#17191b', '#a76b38', '#d3b04c', '#a83245', '#51466f',
    '#f06428', '#d83a23', '#ff8b24', '#f2c94c', '#e9e5d6', '#526b78',
    '#277c77', '#287a49', '#4d62a5', '#9a49bd', '#53677a', '#34383b',
    '#22272a', '#d5b36c', '#26333c', '#394554'
  ];
  required_keys TEXT[] := ARRAY[
    'headColor', 'hairColor', 'bodyColor', 'feetColor', 'bootsColor',
    'accessoriesColor', 'maskColor', 'hatColor', 'dressColor'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF jsonb_typeof(colors) <> 'object' OR NOT (colors ?& required_keys) THEN
    RAISE EXCEPTION 'Invalid avatar colors';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(required_keys) AS key_name(color_key)
    WHERE colors ->> key_name.color_key IS NULL
      OR NOT (colors ->> key_name.color_key = ANY(allowed_colors))
  ) THEN
    RAISE EXCEPTION 'Invalid avatar color';
  END IF;

  UPDATE public.profiles
  SET avatar_skin_tone = colors ->> 'headColor',
      avatar_hair_color = colors ->> 'hairColor',
      avatar_body_color = colors ->> 'bodyColor',
      avatar_feet_color = colors ->> 'feetColor',
      avatar_boots_color = colors ->> 'bootsColor',
      avatar_accessories_color = colors ->> 'accessoriesColor',
      avatar_mask_color = colors ->> 'maskColor',
      avatar_hat_color = colors ->> 'hatColor',
      avatar_dress_color = colors ->> 'dressColor'
  WHERE id = auth.uid() AND avatar_customization_unlocked;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unlock avatar customization before changing your colors';
  END IF;
  RETURN colors;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_avatar_customization(JSONB) TO authenticated;
