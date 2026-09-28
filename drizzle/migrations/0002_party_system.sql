-- Party system: create/join a party, a shared mission board, and a pooled co-op raid tally.
--
-- Architecture note: this game has no shared server-authoritative world — every client runs its own
-- local sim.ts instance. So "co-op" here means real, durable, RLS-correct shared STATE (who's in the
-- party, which missions the party has agreed to chase, a pooled raid-damage counter every member
-- contributes to), not a single ground-truth boss/mission two players are hitting in the same tick.
-- That's the honest ceiling for this codebase's architecture; see src/game/party.ts for the client side.

CREATE TABLE public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  leader_id uuid NOT NULL,
  region_id text NOT NULL DEFAULT 'nexus',
  mission_state jsonb NOT NULL DEFAULT '{"missionIds": [], "names": {}, "completedBy": {}}'::jsonb,
  raid_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.party_members (
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL DEFAULT 'Operator',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parties TO authenticated;
GRANT ALL ON public.parties TO service_role;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.party_members TO authenticated;
GRANT ALL ON public.party_members TO service_role;
ALTER TABLE public.party_members ENABLE ROW LEVEL SECURITY;

-- parties: any current member can see and update the party's shared state; only the leader creates
-- (their own party) or disbands it. Updates (mission board, raid tally, region) are member-writable
-- because any party member can post a mission or contribute raid damage, not just the leader.
CREATE POLICY "Members can view their party" ON public.parties FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.party_members pm WHERE pm.party_id = id AND pm.user_id = auth.uid()));
CREATE POLICY "Create own party" ON public.parties FOR INSERT TO authenticated
  WITH CHECK (leader_id = auth.uid());
CREATE POLICY "Members can update shared state" ON public.parties FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.party_members pm WHERE pm.party_id = id AND pm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.party_members pm WHERE pm.party_id = id AND pm.user_id = auth.uid()));
CREATE POLICY "Leader disbands party" ON public.parties FOR DELETE TO authenticated
  USING (leader_id = auth.uid());

-- party_members: any member of a party can see its roster; joining inserts your own row; leaving
-- deletes your own row; the leader can also remove (kick) anyone.
CREATE POLICY "Members can view roster" ON public.party_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.party_members me WHERE me.party_id = party_members.party_id AND me.user_id = auth.uid()));
CREATE POLICY "Join a party" ON public.party_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave or be kicked" ON public.party_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.parties p WHERE p.id = party_members.party_id AND p.leader_id = auth.uid()));

-- Cap party size at 4 — enforced server-side, not just in the UI.
CREATE OR REPLACE FUNCTION public.enforce_party_size()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.party_members WHERE party_id = NEW.party_id) >= 4 THEN
    RAISE EXCEPTION 'Party is full (max 4)';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER party_size_cap BEFORE INSERT ON public.party_members FOR EACH ROW EXECUTE FUNCTION public.enforce_party_size();

-- If the leader leaves, hand leadership to whoever joined next, or disband if the party is now empty.
CREATE OR REPLACE FUNCTION public.handle_party_member_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  remaining uuid;
BEGIN
  IF OLD.user_id = (SELECT leader_id FROM public.parties WHERE id = OLD.party_id) THEN
    SELECT user_id INTO remaining FROM public.party_members WHERE party_id = OLD.party_id ORDER BY joined_at ASC LIMIT 1;
    IF remaining IS NULL THEN
      DELETE FROM public.parties WHERE id = OLD.party_id;
    ELSE
      UPDATE public.parties SET leader_id = remaining WHERE id = OLD.party_id;
    END IF;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER party_member_leave AFTER DELETE ON public.party_members FOR EACH ROW EXECUTE FUNCTION public.handle_party_member_leave();

-- Pooled raid damage: each client reports the damage IT dealt (see party.ts's throttled flush), and
-- this applies atomically so concurrent reports from several party members never race/lose updates —
-- the read-modify-write happens inside the database, not across round trips from multiple clients.
CREATE OR REPLACE FUNCTION public.apply_raid_damage(p_party_id uuid, p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE public.parties
  SET raid_state = jsonb_set(
        jsonb_set(
          raid_state,
          '{hp}',
          to_jsonb(GREATEST(0, COALESCE((raid_state->>'hp')::numeric, 0) - p_amount))
        ),
        ARRAY['contributions', auth.uid()::text],
        to_jsonb(COALESCE((raid_state #>> ARRAY['contributions', auth.uid()::text])::numeric, 0) + p_amount)
      ),
      updated_at = now()
  WHERE id = p_party_id
    AND raid_state IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.party_members pm WHERE pm.party_id = id AND pm.user_id = auth.uid())
  RETURNING raid_state INTO result;
  RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_raid_damage(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_raid_damage(uuid, numeric) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.parties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_members;
