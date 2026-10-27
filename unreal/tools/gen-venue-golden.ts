/**
 * Records golden nightlife from the web build's real nightlife.ts, venue-life.ts and dance.ts for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/VenueCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs venue
 *
 *   VN / HR / EV / CM / SP / CH        the data, field for field
 *   IH open close hour -> in    VO venue hour -> open    VE venue hour -> event    VD venue standing hour -> lines
 *   P save    ST venue -> standing,vip    HF venue fact -> has    NT npc -> nights    OT npc now -> topics
 *   GR npc now -> lines    RT npc now -> save    RV venue now -> save    RF venue fact now -> save    HS venue now -> had
 *   OS venue hour now buffs -> error|save|buffs    CP -> progress    CC -> payouts|save    CD npc topic -> payout|save
 *   FB venue -> state    FT state t -> state|grade    FK state t -> state    FP state t -> phase
 *   DS venue day -> beats    PR beats arrow now -> judgement|beats    EX beats now -> n|beats    RS beats -> result|finished
 *   DB venue -> best    RD venue score -> save
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { VENUES, VENUE_HOURS, VENUE_EVENTS, inHours, venueOpen, venueEvent, venueDialogue, venueStanding, isVip, recordVenueVisit } from "../../src/game/nightlife";
import { CAST, SPECIALS, CHALLENGES, hasFact, nightsTalked, openTopics, greeting, recordTalk, recordFact, hadSpecialTonight, orderSpecial, claimChallenges, claimDiscovery, rewardText, startFourBeat, fourBeatTap, fourBeatTick, fourBeatPhase, type FourBeat, type Reward } from "../../src/game/venue-life";
import { danceSet, press, expire, finished, result, danceBest, recordDance, ARROWS, type Beat } from "../../src/game/dance";
import type { Buffs } from "../../src/game/stash";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "venue_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x7e17;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const kv = (m: Record<string, number | undefined> | undefined) => Object.keys(m ?? {}).filter((k) => m![k] !== undefined).sort().map((k) => `${k}=${n(m![k]!)}`).join(",") || "~";
const pairs = (m: Record<string, number | undefined>) => Object.entries(m).map(([k, v]) => `${k}=${n(v!)}`).join(",") || "~";
const ps = (p: PlayerProgression) => [p.earnedRewards.join(",") || "~", kv(p.nexLedger), kv(p.materials as Record<string, number>), n(p.xp), n(p.level), n(p.calibrationTokens), n(p.novaLevel), p.novaUnlocks.join(",") || "~"].join("|");
const ls = (xs: { speaker: string; text: string }[]) => xs.map((l) => `${l.speaker}^${l.text}`).join("~~") || "~";
const reward = (r: Reward) => `${n(r.nex)}^${n(r.xp)}^${pairs(r.materials as Record<string, number>)}^${rewardText(r)}`;
const bf = (x: Buffs) => Object.keys(x).sort().map((k) => `${k}=${n(x[k as keyof Buffs]!.stacks)}:${n(x[k as keyof Buffs]!.until)}`).join(",") || "~";
const fb = (s: FourBeat) => [s.venue, n(s.beatMs), n(s.hits), n(s.misses), n(s.lastBeat), b(s.done), b(s.won)].join(",");
const bt = (xs: Beat[]) => xs.map((x) => `${n(x.t)}:${x.arrow}:${x.hit ?? "~"}`).join(",") || "~";

// ---- the data ----
for (const v of VENUES) out("VN", [v.id, v.name, v.sub, v.kind, v.color, v.accent, n(v.dx), n(v.dz)].join("^"));
for (const [id, h] of Object.entries(VENUE_HOURS)) out("HR", id, h.open, h.close);
for (const e of VENUE_EVENTS) out("EV", [e.id, e.venue, e.title, n(e.start), n(e.end)].join("^"));
for (const c of CAST) out("CM", [c.id, c.venue, c.name, c.role, n(c.spot.x), n(c.spot.z), c.first, c.known.join("~~"), Object.entries(c.remembers).map(([k, t]) => `${k}=${t}`).join("~~") || "~",
  c.topics.map((t) => [t.id, t.title, t.text, t.needs ?? "~", t.discovery ? reward(t.discovery) + "^" + t.discovery.title : "~"].join("``")).join("~~")].join("^"));
for (const s of SPECIALS) out("SP", [s.venue, s.name, s.blurb, n(s.price), s.buff, n(s.seconds)].join("^"));
for (const c of CHALLENGES) out("CH", [c.id, c.venue, c.title, c.blurb, n(c.target), reward(c.reward)].join("^"));

// ---- hours and greetings ----
const IDS = [...VENUES.map((v) => v.id), "grid-line-diner", "nowhere"];
const HOURS = [0, 1, 1.99, 2, 3, 4, 4.5, 5, 7, 12, 17, 18, 20, 20.5, 21, 22, 23, 23.99, 24];
for (let k = 0; k < 300; k++) {
  const o = pick([0, 2, 5, 17, 20, 22]), c = pick([0, 2, 5, 7, 20, 24]), h = pick(HOURS);
  out("IH", o, c, h, b(inHours(o, c, h)));
}
for (const id of IDS) for (const h of HOURS) {
  out("VO", id, h, b(venueOpen(id, h)));
  out("VE", id, h, venueEvent(id, h)?.id ?? "~");
  for (const st of [0, 1, 2, 4, 5, 9]) out("VD", id, st, h, ls(venueDialogue(id, st, h)));
}

// ---- nights out ----
const FACTS = ["danced", "fourbeat", "jackpot", "special", "vip", "regular"] as const;
const VENUE_IDS = [...VENUES.map((v) => v.id), "grid-line-diner"];
let now = 1_768_000_000_000;
let payouts = 0, specials = 0, taps = 0, presses = 0;
for (let run = 0; run < 160; run++) {
  let p: PlayerProgression = { ...structuredClone(DEFAULT_PROGRESSION), earnedRewards: [], nexLedger: { "seed:start": pick([0, 30, 45, 200, 5000]) },
    materials: rand() < 0.5 ? { scrapMetal: pick([0, 3]) } as PlayerProgression["materials"] : {} as PlayerProgression["materials"], xp: pick([0, 500, 9000]) };
  if (rand() < 0.2) p.earnedRewards.push("venue-best:afterglow:junk", "venue-best:pulse-array:", "venue-visit:crown-casinoX@2026-01-01");
  let buffs: Buffs = {};
  if (rand() < 0.3) buffs = { [pick(["healStim", "armorStim", "ruinStone"])]: { stacks: pick([1, 2, 3]), until: now + pick([-1000, 0, 30_000, 200_000]) } } as Buffs;
  out("P", ps(p));
  for (let k = 0; k < 90; k++) {
    now += pick([1000, 60_000, 3_600_000, 3_600_000 * 8, 86_400_000, 86_400_000 * 3]);
    const venue = pick(VENUE_IDS), npc = pick(CAST).id, r = rand(), hour = pick(HOURS);
    if (r < 0.12) { p = recordVenueVisit(p, venue, now); out("RV", venue, now, ps(p)); }
    else if (r < 0.22) { p = recordTalk(p, npc, now); out("RT", npc, now, ps(p)); }
    else if (r < 0.3) { const f = pick(["danced", "fourbeat", "jackpot", "special"] as const); p = recordFact(p, venue, f, now); out("RF", venue, f, now, ps(p)); }
    else if (r < 0.36) { const sc = pick([0, 100, 999.5, 1200, 4000, 4500, 3999.4]), dv = pick(["afterglow", "pulse-array"]); p = recordDance(p, dv, sc); out("RD", dv, sc, ps(p)); }
    else if (r < 0.46) {
      const ov = rand() < 0.95 ? venue : "nowhere";
      const res = orderSpecial(p, buffs, ov, hour, now);
      if ("error" in res) out("OS", ov, hour, now, bf(buffs), `${res.error}|${ps(p)}|${bf(buffs)}`);
      else { out("OS", ov, hour, now, bf(buffs), `|${ps(res.progression)}|${bf(res.buffs)}`); p = res.progression; buffs = res.buffs; specials++; }
    }
    else if (r < 0.5) { const res = claimChallenges(p); payouts += res.paid.length; out("CC", res.paid.map((x) => `${x.title}^${reward(x.reward)}`).join("~~") || "~", ps(res.progression)); p = res.progression; }
    else if (r < 0.56) {
      const c = pick(CAST), t = pick(c.topics);
      const res = claimDiscovery(p, t);
      out("CD", c.id, t.id, (res.paid ? `${res.paid.title}^${reward(res.paid.reward)}` : "~") + "|" + ps(res.progression)); p = res.progression;
    }
    else if (r < 0.66) out("OT", npc, now, openTopics(p, npc, now).map((t) => t.id).join(",") || "~");
    else if (r < 0.76) out("GR", npc, now, ls(greeting(p, npc, now)));
    else if (r < 0.82) { const f = pick(FACTS); out("HF", venue, f, b(hasFact(p, venue, f))); }
    else if (r < 0.86) out("NT", npc, nightsTalked(p, npc));
    else if (r < 0.9) out("ST", venue, `${n(venueStanding(p, venue))},${b(isVip(p, venue))}`);
    else if (r < 0.93) out("HS", venue, now, b(hadSpecialTonight(p, venue, now)));
    else if (r < 0.96) out("CP", CHALLENGES.map((c) => n(c.progress(p))).join(","));
    else out("DB", venue, n(danceBest(p, venue)));
  }
}

// ---- the Four-Beat Dance ----
for (let k = 0; k < 400; k++) {
  let s = startFourBeat(pick(["pulse-array", "afterglow", "velvet-circuit", "crown-casino"]));
  out("FB", s.venue, fb(s));
  let t = pick([-100, 0, 500, 1200]);
  for (let j = 0; j < 14; j++) {
    t += pick([s.beatMs, s.beatMs, s.beatMs * 0.3, s.beatMs * 0.31, s.beatMs * 0.7, s.beatMs * 1.5, 0, 50, 3000]) + (rand() - 0.5) * pick([0, 0, 40, 200]);
    const q = rand();
    if (q < 0.04) { out("FP", fb(s), t, fourBeatPhase(s, t)); continue; }
    if (q < 0.08) { const nx = fourBeatTick(s, t); out("FK", fb(s), t, fb(nx)); s = nx; continue; }
    const tt = rand() < 0.02 ? pick([NaN, Infinity, -5]) : t;
    const res = fourBeatTap(s, tt); taps++;
    out("FT", fb(s), tt, `${fb(res.state)}|${res.grade ?? "~"}`);
    s = res.state;
  }
  out("FP", fb(s), t, fourBeatPhase(s, t));
}
// a tap exactly on the window edge and on a half beat
{ const s = startFourBeat("pulse-array"); for (const t of [1200 - s.beatMs * 0.3, 1200 - s.beatMs * 0.3 - 1e-6, 1200 + s.beatMs * 0.3, 1200 + s.beatMs * 0.5, 15000, 15000.0001]) out("FT", fb(s), t, `${fb(fourBeatTap(s, t).state)}|${fourBeatTap(s, t).grade ?? "~"}`); }

// ---- the dance floor ----
for (let k = 0; k < 300; k++) {
  const venue = pick(["pulse-array", "afterglow", "velvet-circuit", "nowhere"]);
  const day = new Date(1_768_000_000_000 + Math.floor(rand() * 400) * 86_400_000).toISOString().slice(0, 10);
  const beats = danceSet(venue, day);
  out("DS", venue, day, bt(beats));
  let clock = 0;
  for (let j = 0; j < 60 && !finished(beats); j++) {
    clock += pick([0.05, 0.1, 0.2, 0.3, 0.45]);
    if (rand() < 0.75) {
      const target = beats.find((x) => x.hit === null);
      const arrow = target && rand() < 0.8 ? target.arrow : pick(ARROWS);
      const at = target && rand() < 0.7 ? target.t + pick([0, 0.05, -0.08, 0.08, 0.12, -0.16, 0.16, 0.2, 0.25, -0.25, 0.3]) : clock;
      const before = bt(beats);
      const g = press(beats, arrow, at); presses++;
      out("PR", before, arrow, at, `${g ?? "~"}|${bt(beats)}`);
      clock = Math.max(clock, at);
    } else { const before = bt(beats); const nx = expire(beats, clock); out("EX", before, clock, `${nx}|${bt(beats)}`); }
  }
  const r = result(beats);
  out("RS", bt(beats), [n(r.score), n(r.perfect), n(r.good), n(r.miss), n(r.bestCombo), r.grade, b(finished(beats))].join(","));
}
// ---- edge probes ----
{
  const base = { ...structuredClone(DEFAULT_PROGRESSION), earnedRewards: ["venue-best:afterglow:12abc"], nexLedger: { "seed:start": 500 } } as PlayerProgression;
  out("P", ps(base));
  out("DB", "afterglow", "0");
  let q = recordDance(base, "pulse-array", 0.6); out("RD", "pulse-array", 0.6, ps(q)); out("HF", "pulse-array", "danced", b(hasFact(q, "pulse-array", "danced")));
  const t0 = 1_768_000_000_000;
  for (const bb of [{ ruinStone: { stacks: 2, until: t0 } }, { ruinStone: { stacks: 0, until: t0 + 5000 } }, { ruinStone: { stacks: 3, until: t0 + 500_000 } }] as Buffs[]) {
    out("P", ps(base));
    const res = orderSpecial(base, bb, "pulse-array", 22, t0);
    if ("error" in res) out("OS", "pulse-array", 22, t0, bf(bb), `${res.error}|${ps(base)}|${bf(bb)}`);
    else out("OS", "pulse-array", 22, t0, bf(bb), `|${ps(res.progression)}|${bf(res.buffs)}`);
  }
  const s0: FourBeat = { venue: "pulse-array", beatMs: 1000, hits: 0, misses: 0, lastBeat: -1, done: false, won: false };
  for (const t of [-0.5, 900, 899.999, 1500, 1500.5]) { const r = fourBeatTap(s0, t); out("FT", fb(s0), t, `${fb(r.state)}|${r.grade ?? "~"}`); }
  for (const bt0 of [0.08, 0.16, 0.25, 0.0800001, 0.1600001]) {
    const beats: Beat[] = [{ t: bt0, arrow: "up", hit: null }];
    const before = bt(beats); const g = press(beats, "up", 0); out("PR", before, "up", 0, `${g ?? "~"}|${bt(beats)}`);
  }
  for (const [pf, gd] of [[19, 0], [18, 2], [16, 0], [15, 2], [12, 0], [11, 2], [8, 0], [7, 2]] as const) {
    const beats: Beat[] = Array.from({ length: 20 }, (_, i) => ({ t: i, arrow: "left", hit: i < pf ? "perfect" : i < pf + gd ? "good" : "miss" }));
    const r = result(beats);
    out("RS", bt(beats), [n(r.score), n(r.perfect), n(r.good), n(r.miss), n(r.bestCombo), r.grade, b(finished(beats))].join(","));
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`venue golden: ${lines.length} lines (${specials} specials, ${payouts} challenge payouts, ${taps} four-beat taps, ${presses} presses) -> ${OUT}`);
