/**
 * Records golden talk-panel conversations from the web build's real living-npcs.ts, npc-routine.ts and living-world.ts for the
 * C++ port's test (Plugins/WorldFractureCore/Tests/LivingNpcCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs livingnpc
 *
 *   CY / NPC / CO / IN       the data, field for field
 *   P save                   NA npc -> actions         PA npc action now -> ok|message|save
 *   NL npc event now -> line   RK city kills -> save   RE city -> save   RR x z -> messages|save   MK -> markers   RS city -> standings
 *   PO npc hour -> x|z|onDuty      NN x z hour -> npc      CA x z -> city
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTRACTS, INTEL, LIVING_NPCS, PLEDGE_KEY, contractPoint, intelPoint, livingMarkers, npcActions, npcLine, npcNear, performNpcAction, recordCityKills, recordEventWin, recordReach, repSummary } from "../../src/game/living-npcs";
import { npcPosition, onDuty } from "../../src/game/npc-routine";
import { CITIES, cityAt, type LivingState } from "../../src/game/living-world";
import * as clock from "../../src/game/shop-hours";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "livingnpc_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x11fe;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const kv = (m: Record<string, number | undefined> | undefined) => Object.keys(m ?? {}).filter((k) => m![k] !== undefined).sort().map((k) => `${k}=${n(m![k]!)}`).join(",") || "~";
const liv = (l: LivingState) => [kv(l.gain), kv(l.loss), Object.keys(l.districts).sort().map((k) => `${k}=${n(l.districts[k]!.securedAt)}:${n(l.districts[k]!.fallenAt)}`).join(",") || "~",
  Object.keys(l.contracts).sort().map((k) => `${k}=${n(l.contracts[k]!.progress)}:${n(l.contracts[k]!.acceptedAt)}`).join(",") || "~", l.intel.join(",") || "~"].join(";");
const ps = (p: PlayerProgression) => [liv(p.living ?? { gain: {}, loss: {}, districts: {}, contracts: {}, intel: [] }), kv(p.materials as Record<string, number>), p.earnedRewards.join(",") || "~", n(p.fractureShards),
  Object.keys(p.story.choices).sort().map((k) => `${k}=${p.story.choices[k]}`).join(",") || "~", p.story.flags.join(",") || "~", n(p.xp), n(p.level), n(p.calibrationTokens), n(p.novaLevel), p.novaUnlocks.join(",") || "~"].join("|");

for (const c of Object.values(CITIES)) out("CY", [c.id, c.name, n(c.x), n(c.z), n(c.radius)].join("^"));
for (const x of LIVING_NPCS) out("NPC", [x.id, x.name, x.title, x.city, x.faction, x.role, n(x.lx), n(x.lz), x.body, ...(["HOSTILE", "WARY", "NEUTRAL", "TRUSTED", "HONORED"] as const).map((t) => x.greeting[t])].join("^"));
for (const c of CONTRACTS) out("CO", [c.id, c.giver, c.faction, c.city, c.kind, c.title, c.brief, n(c.amount), c.material ?? "", c.lx === undefined ? "~" : n(c.lx), c.lz === undefined ? "~" : n(c.lz), c.minTier, n(c.reward.rep), kv(c.reward.materials as Record<string, number>), n(c.reward.xp)].join("^"));
for (const i of INTEL) out("IN", [i.id, i.seller, i.city, i.title, i.rumor, i.cost.material, n(i.cost.amount), n(i.lx), n(i.lz), kv(i.reward as Record<string, number>), n(i.shards)].join("^"));

const FACT = ["wardens", "guild", "syndicate", "aegis"];
const MATS = ["scrapMetal", "microCircuits", "dataShards", "reinforcedAlloy", "aegisCore"];
const DIST = ["nexus:spire", "nexus:market", "neon:spire", "neon:undercity", "neon:grid"];
let now = 1_768_000_000_000;
for (let t = 0; t < 500; t++) {
  const living: LivingState = { gain: {}, loss: {}, districts: {}, contracts: {}, intel: [] };
  for (const f of FACT) { if (rand() < 0.7) living.gain[f as "wardens"] = pick([5, 25, 40, 60, 100]); if (rand() < 0.4) living.loss[f as "wardens"] = pick([5, 20, 60, 140]); }
  if (rand() < 0.3) living.districts[pick(DIST)] = { securedAt: 0, fallenAt: now - pick([1000, 3e8]) };
  let p: PlayerProgression = { ...structuredClone(DEFAULT_PROGRESSION), living, earnedRewards: rand() < 0.2 ? ["living:contract:salvage-drive", "living:commend:guild"] : [], fractureShards: pick([0, 100]),
    materials: Object.fromEntries(MATS.filter(() => rand() < 0.7).map((m) => [m, pick([0, 4, 8, 12, 20, 40])])) as PlayerProgression["materials"],
    story: { ...structuredClone(DEFAULT_PROGRESSION.story), choices: rand() < 0.15 ? { [PLEDGE_KEY]: pick(["syndicate", "aegis"]) } : {} } };
  out("P", ps(p));
  for (let k = 0; k < 40; k++) {
    now += pick([1000, 60_000, 3_600_000, 2e8]);
    const npc = pick(LIVING_NPCS), r = rand();
    if (r < 0.15) out("NA", npc.id, npcActions(p, npc).map((a) => [a.id, a.label, a.detail, b(a.enabled), a.reason ?? "~"].join("^")).join(";") || "~");
    else if (r < 0.5) {
      const acts = npcActions(p, npc);
      const id = acts.length && rand() < 0.85 ? pick(acts).id : pick(["accept:perimeter-sweep", "pledge:aegis", "turnin:dead-drop", "nonsense", "intel:neon-grid-stash"]);
      const res = performNpcAction(p, rand() < 0.97 ? npc.id : "nobody", id, now);
      if ("error" in res) out("PA", npc.id, id, now, `0|${res.error}|${ps(p)}`);
      else { p = res.progression; out("PA", npc.id, id, now, `1|${res.message}|${ps(p)}`); }
    }
    else if (r < 0.6) out("NL", npc.id, rand() < 0.1 ? "Raid on the Spire" : "~", now, npcLine(p, npc, { eventTitle: undefined }, now));
    else if (r < 0.7) { const city = pick(["nexus", "neon"]) as "nexus"; const kills = pick([1, 3, 10]); p = recordCityKills(p, city, kills); out("RK", city, kills, ps(p)); }
    else if (r < 0.75) { const city = pick(["nexus", "neon"]) as "nexus"; p = recordEventWin(p, city); out("RE", city, ps(p)); }
    else if (r < 0.9) {
      const spots = [...CONTRACTS.map(contractPoint).filter(Boolean), ...INTEL.map(intelPoint)] as { x: number; z: number }[];
      const s = pick(spots), off = pick([0, 3.9, 4, 4.01, 7.99, 8, 8.01, 20]), a = rand() * Math.PI * 2;
      const x = s.x + Math.cos(a) * off, z = s.z + Math.sin(a) * off;
      const res = recordReach(p, x, z); p = res.progression;
      out("RR", x, z, `${res.messages.slice().sort().join(";") || "~"}|${ps(p)}`);
    }
    else if (r < 0.95) out("MK", livingMarkers(p).map((m) => `${m.id}^${m.label}^${n(m.x)}^${n(m.z)}^${m.kind}`).sort().join(";") || "~");
    else { const city = pick(["nexus", "neon"]) as "nexus"; out("RS", city, repSummary(p, city).map((s) => `${s.faction.id}^${s.faction.name}^${n(s.rep)}^${s.tier}`).join(";")); }
  }
}
// surveys at their reach edge: the survey contracts held, stood at offsets round 8 m along x
for (const c of CONTRACTS.filter((x) => x.kind === "SURVEY")) for (const off of [7.999999999, 8, 8.000000001, 8.00001]) {
  let p: PlayerProgression = { ...structuredClone(DEFAULT_PROGRESSION), living: { gain: {}, loss: {}, districts: {}, contracts: { [c.id]: { progress: 0, acceptedAt: 1 } }, intel: [] } };
  out("P", ps(p));
  const pt = contractPoint(c)!, x = pt.x + off, z = pt.z;
  const res = recordReach(p, x, z); p = res.progression;
  out("RR", x, z, `${res.messages.slice().sort().join(";") || "~"}|${ps(p)}`);
}
// npcLine with an event title (the ctx argument)
for (const npc of LIVING_NPCS) out("NE", npc.id, "Raid on the Spire", npcLine(DEFAULT_PROGRESSION, npc, { eventTitle: "Raid on the Spire" }, now));
// routines and reach
for (const npc of LIVING_NPCS) for (const h of [null, 0, 4.99, 5, 12, 21.99, 22, 23.5, -1, 25, NaN]) { const p = npcPosition(npc, h); out("PO", npc.id, h === null ? "~" : n(h), `${n(p.x)}|${n(p.z)}|${b(p.onDuty)}`); }
for (const h of [0, 3, 12, 23]) out("OD", h, b(onDuty(h)));
for (let k = 0; k < 3000; k++) {
  const npc = pick(LIVING_NPCS), h = pick([12, 23]), p = npcPosition(npc, h), off = pick([0, 1, 3.59, 3.6, 3.61, 10]), a = rand() * Math.PI * 2;
  const x = p.x + Math.cos(a) * off, z = p.z + Math.sin(a) * off;
  clock.setShopClockHour(h);
  out("NN", x, z, h, npcNear(x, z)?.id ?? "~");
}
for (let k = 0; k < 2000; k++) { const c = pick(Object.values(CITIES)); const x = c.x + (rand() - 0.5) * c.radius * 2.6, z = c.z + (rand() - 0.5) * c.radius * 2.6; out("CA", x, z, cityAt(x, z) ?? "~"); }
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`livingnpc golden: ${lines.length} lines -> ${OUT}`);
