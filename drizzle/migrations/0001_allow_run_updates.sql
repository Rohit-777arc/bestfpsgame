GRANT UPDATE ON public.runs TO authenticated;
CREATE POLICY "runs_update_own" ON public.runs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);