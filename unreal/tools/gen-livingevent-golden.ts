/**
 * Records golden city world events from the web build's real living-events.ts for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/LivingEventCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs livingevent
 *
 *   RU kind -> rule     DI -> district     PK city fallen now serial draws -> event
 *   D -> fresh director   ST dt now px pz alive city blocked tagAlive playerKills fallen draws -> director|started|activated|resolved
 *   SP spawned flag set on the current event (Scene does it after spawning)
 *   P save   RV event outcome now -> message|save       FD now -> fallen districts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_RULES, createLivingDirector, fallenDistricts, pickEvent, resolveLivingEvent, stepLivingDirector, type LivingDirector, type LivingEvent } from "../../src/game/living-events";
import { CITIES, DISTRICTS } from "../../src/game/living-world";
import { DEFAULT_PROGRESSION, type PlayerProgression } from "../../src/game/progression";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "livingevent_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x1e7e;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const ev = (e: LivingEvent | null | undefined) => (e ? [e.id, e.kind, e.city, e.district, n(e.x), n(e.z), e.phase, n(e.timer), n(e.hold), b(e.spawned), n(e.wave), b(!!e.cleared)].join("^") : "~");
const dir = (d: LivingDirector) => `${n(d.next)};${ev(d.current)};${n(d.serial)}`;
const kv = (m: Record<string, number | undefined> | undefined) => Object.keys(m ?? {}).filter((k) => m![k] !== undefined).sort().map((k) => `${k}=${n(m![k]!)}`).join(",") || "~";
const ps = (p: PlayerProgression) => {
  const l = p.living!;
  return [kv(l.gain), kv(l.loss), Object.keys(l.districts).sort().map((k) => `${k}=${n(l.districts[k]!.securedAt)}:${n(l.districts[k]!.fallenAt)}`).join(",") || "~",
    Object.keys(l.contracts).sort().map((k) => `${k}=${n(l.contracts[k]!.progress)}:${n(l.contracts[k]!.acceptedAt)}`).join(",") || "~", kv(p.materials as Record<string, number>), p.earnedRewards.join(",") || "~", n(p.fractureShards)].join("|");
};
const drawsFn = () => { const d: number[] = []; return { d, rnd: () => { const v = rand(); d.push(v); return v; } }; };

for (const [k, r] of Object.entries(EVENT_RULES)) out("RU", k, [r.title, r.brief, n(r.warn), n(r.limit), n(r.win.rep), Object.entries(r.win.materials).map(([m, v]) => `${m}=${v}`).join(","), n(r.win.shards), n(r.failRep), b(r.districtStakes)].join("^"));
for (const d of DISTRICTS) out("DI", [d.id, d.city, d.name, n(d.x), n(d.z), d.faction].join("^"));
for (let t = 0; t < 1500; t++) {
  const city = pick(["nexus", "neon"] as const), fallen = DISTRICTS.filter(() => rand() < 0.1).map((d) => d.id), now = 1_768_000_000_000 + Math.floor(rand() * 1e9), serial = Math.floor(rand() * 20);
  const { d, rnd } = drawsFn();
  const e = pickEvent(city, rnd, fallen, now, serial);
  out("PK", city, fallen.join(",") || "~", now, serial, d.map(n).join(",") || "~", ev(e));
}
// directors: walk in and out of the cities while events run
for (let t = 0; t < 200; t++) {
  let d = createLivingDirector();
  out("D", dir(d));
  let now = 1_768_000_000_000 + t * 1000;
  let tagAlive = 0, kills = 0;
  for (let k = 0; k < 600; k++) {
    const dt = pick([0.1, 0.5, 1, 2, 5]); now += Math.round(dt * 1000);
    const cityId = rand() < 0.85 ? pick(["nexus", "neon"] as const) : null;
    const c = cityId ? CITIES[cityId] : CITIES.nexus;
    const cur = d.current;
    const far = rand() < 0.03;
    let px = c.x + (rand() - 0.5) * 60, pz = c.z + (rand() - 0.5) * 60;
    if (far) { px = c.x + c.radius + 80 + pick([-0.001, 0, 1, 50]); pz = c.z; }
    if (cur && cur.kind === "FRACTURE" && rand() < 0.7) { px = cur.x + (rand() - 0.5) * 16; pz = cur.z + (rand() - 0.5) * 16; }
    if (cur?.phase === "ACTIVE" && !cur.spawned && rand() < 0.8) { d = { ...d, current: { ...cur, spawned: true, wave: 10 } }; tagAlive = pick([1, 3, 6]); kills = 0; out("SP", "1"); }
    if (rand() < 0.15 && tagAlive > 0) { tagAlive--; if (rand() < 0.8) kills++; }
    const alive = rand() < 0.97, blocked = rand() < 0.05;
    const fallen = DISTRICTS.filter(() => rand() < 0.05).map((x) => x.id);
    const { d: draws, rnd } = drawsFn();
    const st = stepLivingDirector(d, { dt, now, rnd, px, pz, alive, city: cityId, blocked, tagAlive, playerKills: kills, fallen });
    out("ST", dt, now, px, pz, b(alive), cityId ?? "~", b(blocked), tagAlive, kills, fallen.join(",") || "~", draws.map(n).join(",") || "~", [dir(st.director), ev(st.started), ev(st.activated), st.resolved ? `${ev(st.resolved.event)}@${st.resolved.outcome}` : "~"].join("|"));
    d = st.director;
  }
}
// scripted edges: a live rift held in whole seconds (25 s exactly), stood on at exactly 9 m and just outside; a live
// invasion whose clock runs out to exactly 0
for (const [off, dt] of [[0, 1], [9, 1], [9.000001, 1], [0, 0.5]] as [number, number][]) {
  const base = pickEvent("nexus", () => 0.75, [], 1_768_100_000_000, 1); // kinds[5] = FRACTURE
  const live: LivingEvent = { ...base, phase: "ACTIVE", timer: 120, spawned: true };
  let d: LivingDirector = { next: 0, current: live, serial: 1 };
  out("D", dir(createLivingDirector()));
  out("SE", ev(live), n(0), n(1));
  for (let k = 0; k < 60 && d.current?.phase === "ACTIVE"; k++) {
    const st = stepLivingDirector(d, { dt, now: 1_768_100_000_000 + k * 1000, rnd: () => 0.5, px: live.x + off, pz: live.z, alive: true, city: "nexus", blocked: false, tagAlive: 2, playerKills: 0, fallen: [] });
    out("ST", dt, 1_768_100_000_000 + k * 1000, live.x + off, live.z, "1", "nexus", "0", 2, 0, "~", "~", [dir(st.director), ev(st.started), ev(st.activated), st.resolved ? `${ev(st.resolved.event)}@${st.resolved.outcome}` : "~"].join("|"));
    d = st.director;
  }
}
{
  const base = pickEvent("nexus", () => 0.1, [], 1_768_100_000_000, 2); // INVASION
  const live: LivingEvent = { ...base, phase: "ACTIVE", timer: 3, spawned: true };
  let d: LivingDirector = { next: 0, current: live, serial: 2 };
  out("D", dir(createLivingDirector()));
  out("SE", ev(live), n(0), n(2));
  for (let k = 0; k < 4 && d.current?.phase === "ACTIVE"; k++) {
    const st = stepLivingDirector(d, { dt: 1, now: 1_768_100_000_000 + k * 1000, rnd: () => 0.5, px: live.x, pz: live.z, alive: true, city: "nexus", blocked: false, tagAlive: 2, playerKills: 0, fallen: [] });
    out("ST", 1, 1_768_100_000_000 + k * 1000, live.x, live.z, "1", "nexus", "0", 2, 0, "~", "~", [dir(st.director), ev(st.started), ev(st.activated), st.resolved ? `${ev(st.resolved.event)}@${st.resolved.outcome}` : "~"].join("|"));
    d = st.director;
  }
}
// resolutions on saves
for (let t = 0; t < 400; t++) {
  let p: PlayerProgression = { ...structuredClone(DEFAULT_PROGRESSION), living: { gain: { aegis: pick([0, 30]) }, loss: {}, districts: rand() < 0.3 ? { "neon:grid": { securedAt: 0, fallenAt: 1_767_000_000_000 } } : {}, contracts: rand() < 0.5 ? { "spire-defense": { progress: pick([0, 1]), acceptedAt: 5 }, "hold-the-line": { progress: 0, acceptedAt: 5 } } : {}, intel: [] }, materials: { fuel: pick([0, 2]) } as PlayerProgression["materials"], fractureShards: 10 };
  out("P", ps(p));
  for (let k = 0; k < 6; k++) {
    const city = pick(["nexus", "neon"] as const), now = 1_768_000_000_000 + Math.floor(rand() * 4e8);
    const e = pickEvent(city, rand, [], now, k);
    if (rand() < 0.2) e.cleared = true;
    if (rand() < 0.15 && k > 0) e.id = "repeat";
    const outcome = pick(["WON", "FAILED"] as const);
    const r = resolveLivingEvent(p, e, outcome, now); p = r.progression;
    out("RV", ev(e), outcome, now, `${r.message || "~"}|${ps(p)}`);
    out("FD", now, fallenDistricts(p, now).join(",") || "~");
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`livingevent golden: ${lines.length} lines -> ${OUT}`);
