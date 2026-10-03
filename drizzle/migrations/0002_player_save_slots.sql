CREATE TABLE public.player_save_slots (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  label text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_save_slots TO authenticated;
GRANT ALL ON public.player_save_slots TO service_role;
ALTER TABLE public.player_save_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own slots select" ON public.player_save_slots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own slots insert" ON public.player_save_slots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own slots update" ON public.player_save_slots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own slots delete" ON public.player_save_slots FOR DELETE TO authenticated USING (auth.uid() = user_id);