import { applyCharacter } from "./applyCharacter";
import { pushSave } from "../cloud-save";
import { loadProgression, saveProgression, type PlayerProgression } from "../progression";
import { supabase } from "@/integrations/supabase/client";
import type { PlayerCharacter } from "./deployCharacter";

export { applyCharacter };

export type SaveResult = { progression: PlayerProgression; durable: boolean };

/** Saves the character to local storage (verified by reading it back) and, when signed in, to the
 * player_saves row through the optimistic-revision pipeline. Throws if a signed-in cloud save fails;
 * `durable` is false only for signed-out players whose browser blocks storage (session-only play). */
export async function persistCharacter(current: PlayerProgression, character: PlayerCharacter): Promise<SaveResult> {
  const next = applyCharacter(current, character);
  saveProgression(next);
  const local = loadProgression().character?.deploymentId === character.deploymentId;
  let userId: string | null = null;
  try { userId = (await supabase.auth.getSession()).data.session?.user.id ?? null; } catch { userId = null; }
  if (userId) {
    try { await pushSave(userId, next); } catch { throw new Error("Could not save your character to the cloud. Check your connection and try again."); }
    return { progression: next, durable: true };
  }
  return { progression: next, durable: local };
}
