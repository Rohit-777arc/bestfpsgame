CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Player',
  credits INTEGER NOT NULL DEFAULT 0,
  equipped_weapon TEXT NOT NULL DEFAULT 'scout-pistol',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.profile_weapons (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weapon_id TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, weapon_id)
);
GRANT SELECT, INSERT, DELETE ON public.profile_weapons TO authenticated;
GRANT ALL ON public.profile_weapons TO service_role;
ALTER TABLE public.profile_weapons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_weapons_select_own" ON public.profile_weapons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profile_weapons_insert_own" ON public.profile_weapons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'dungeon',
  map TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  waves_cleared INTEGER NOT NULL DEFAULT 0,
  credits_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.runs TO authenticated;
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs_select_own" ON public.runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "runs_insert_own" ON public.runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, 'Player');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();