/**
 * Stage 165 live check: two "devices" (separate Supabase clients) share one Hunter save through the real
 * player_saves table, using the game's own mergeProgression + normalizeProgression.
 *
 *   TEST_EMAIL=... TEST_PASSWORD=... bun scripts/sync-two-clients.ts
 *
 * Use a DEDICATED test account (it must already exist and be confirmed). The script overwrites that account's
 * cloud save and deletes the row when it finishes, so never point it at a real player's account.
 */
import { createClient } from "@supabase/supabase-js";
import { mock } from "bun:test";
mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const { mergeProgression } = await import("../src/game/cloud-save");
const { DEFAULT_PROGRESSION, normalizeProgression } = await import("../src/game/progression");

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_EMAIL, password = process.env.TEST_PASSWORD;
if (!url || !key || !email || !password) { console.error("Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TEST_EMAIL, TEST_PASSWORD"); process.exit(2); }

type Device = { name: string; db: ReturnType<typeof createClient>; uid: string; revision: number };
async function device(name: string): Promise<Device> {
  const db = createClient(url!, key!, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: email!, password: password! });
  if (error || !data.user) throw new Error(`${name} sign-in failed: ${error?.message}`);
  return { name, db, uid: data.user.id, revision: 0 };
}
/** pull, merge with local, push with optimistic revision (what pullAndMerge + pushSave do) */
async function sync(d: Device, local: typeof DEFAULT_PROGRESSION) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row, error } = await d.db.from("player_saves").select("data, revision, updated_at").eq("user_id", d.uid).maybeSingle();
    if (error) throw error;
    const merged = row ? mergeProgression(local, normalizeProgression(row.data), true) : local;
    const payload = { data: merged as never, save_version: merged.version, device_id: d.name, updated_at: new Date().toISOString() };
    if (!row) { const r = await d.db.from("player_saves").insert({ user_id: d.uid, revision: 1, ...payload }); if (!r.error) { d.revision = 1; return merged; } continue; }
    const r = await d.db.from("player_saves").update({ ...payload, revision: row.revision + 1 }).eq("user_id", d.uid).eq("revision", row.revision).select("revision").maybeSingle();
    if (r.data) { d.revision = r.data.revision; return merged; }
  }
  throw new Error(`${d.name}: could not sync`);
}

const check = (label: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); if (!ok) process.exitCode = 1; };
const win = await device("windows"), phone = await device("samsung");
try {
  await win.db.from("player_saves").delete().eq("user_id", win.uid);
  const hunter = { ...DEFAULT_PROGRESSION, identityClass: "HUNTER" as const, pocketClass: "HUNTER" as const };
  // 1-2: Windows creates a Hunter and earns XP
  let w = await sync(win, { ...hunter, xp: 500, completedMissions: ["test-mission"] });
  // 3: Samsung loads it
  let s = await sync(phone, hunter);
  check("Samsung sees the Hunter's XP from Windows", s.xp === 500 && s.completedMissions.includes("test-mission"));
  // 4: Samsung earns a weapon
  const weapon = { id: "sync-test-rifle", name: "Sync Test Rifle", slot: "WEAPON", rarity: "RARE", power: 120, mods: [], life: 1, level: 1 } as never;
  s = await sync(phone, { ...s, inventory: [...s.inventory, weapon] });
  // 5: Windows pulls, then syncs again twice (replays must not duplicate)
  w = await sync(win, w); w = await sync(win, w); w = await sync(win, w);
  check("Windows received the weapon exactly once", w.inventory.filter((i) => i.id === "sync-test-rifle").length === 1);
  check("XP unchanged after round trip", w.xp === 500);
} finally {
  await win.db.from("player_saves").delete().eq("user_id", win.uid);
}
