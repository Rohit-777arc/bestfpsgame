ALTER TABLE public.profiles
  ADD COLUMN level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  ADD COLUMN experience INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN dungeons_completed INTEGER NOT NULL DEFAULT 0 CHECK (dungeons_completed >= 0),
  ADD COLUMN equipped_shirt TEXT,
  ADD COLUMN equipped_hat TEXT,
  ADD CONSTRAINT profiles_experience_progression_check
    CHECK (experience >= 0 AND experience < 100 + ((level - 1) * 25));

ALTER TABLE public.runs
  ADD COLUMN completed_at TIMESTAMPTZ;

CREATE TABLE public.profile_cosmetics (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_id)
);
GRANT SELECT, INSERT ON public.profile_cosmetics TO authenticated;
GRANT ALL ON public.profile_cosmetics TO service_role;
ALTER TABLE public.profile_cosmetics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_cosmetics_select_own" ON public.profile_cosmetics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profile_cosmetics_insert_own" ON public.profile_cosmetics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
