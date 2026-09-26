CREATE TABLE public.player_save_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data jsonb NOT NULL,
  revision integer NOT NULL,
  device_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.player_save_snapshots TO authenticated;
GRANT ALL ON public.player_save_snapshots TO service_role;
ALTER TABLE public.player_save_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own snapshots select" ON public.player_save_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own snapshots delete" ON public.player_save_snapshots FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX player_save_snapshots_user_idx ON public.player_save_snapshots (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.snapshot_player_save()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- keep at most one restore point per 10 minutes, and the latest 30
  IF NOT EXISTS (SELECT 1 FROM public.player_save_snapshots WHERE user_id = OLD.user_id AND created_at > now() - interval '10 minutes') THEN
    INSERT INTO public.player_save_snapshots (user_id, data, revision, device_id) VALUES (OLD.user_id, OLD.data, OLD.revision, OLD.device_id);
    DELETE FROM public.player_save_snapshots WHERE user_id = OLD.user_id AND id NOT IN (
      SELECT id FROM public.player_save_snapshots WHERE user_id = OLD.user_id ORDER BY created_at DESC LIMIT 30);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.snapshot_player_save() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER player_saves_snapshot BEFORE UPDATE ON public.player_saves FOR EACH ROW WHEN (OLD.data IS DISTINCT FROM NEW.data) EXECUTE FUNCTION public.snapshot_player_save();