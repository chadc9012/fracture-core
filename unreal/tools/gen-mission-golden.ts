/**
 * Mission state machines (src/game/missions/*) → data + golden states for the C++ port.
 *
 *   npx esbuild unreal/tools/gen-mission-golden.ts --bundle --platform=node --format=esm \
 *     --alias:@=./src --outfile=/tmp/wf-mission-golden.mjs && node /tmp/wf-mission-golden.mjs
 *
 * Writes:
 *   DataTables/MissionLines.json        every NOVA / mission line, keyed by mission and transition "FROM>TO"
 *                                       (core-node's allegiance line adds ":<faction>"; Awakening's alert banner uses "alert:FROM>TO")
 *   DataTables/MissionObjectives.json   the in-world objective text for every mission state
 *   Plugins/WorldFractureCore/Tests/mission_golden.txt
 *     CTX airlockX airlockZ ringX ringZ reactorX reactorZ   world sites the Descent Protocol targets
 *     L mission field key text                              the MissionLines rows
 *     C mission faction                                     a case (faction "~" = none chosen)
 *     E type a b                                            an event: ANCHOR x z / ARRIVED from / CLEAR from / HACK p / HOLD p / START / ACK / DECIDED
 *     X state                                               the run after the event (same canonical text as wf::mission::Describe)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { AWAKENING, AWAKENING_OBJECTIVE, advanceAwakening } from "../../src/game/missions/awakening";
import * as Broken from "../../src/game/missions/broken-signal";
import * as Blackout from "../../src/game/missions/blackout-protocol";
import * as Stitched from "../../src/game/missions/stitched-neon-core";
import * as Drowned from "../../src/game/missions/drowned-relay";
import * as Solar from "../../src/game/missions/solar-array";
import * as CoreNode from "../../src/game/missions/core-node";
import * as Descent from "../../src/game/missions/descent-protocol";
import * as SystemCore from "../../src/game/missions/system-core";
import * as Zone from "../../src/game/missions/zone-missions";
import { airlockSite, reactorSite, ringWaypoint } from "../../src/game/thalassia-sectors";

type AnyRun = { id: string; state: string; target: { x: number; z: number } | null; hack?: number; hold?: number; wave2Done?: boolean; nova?: string; line?: string; alert?: string };
type Ev = { type: string; x?: number; z?: number; from?: string; progress?: number };
type Faction = "controllers" | "breakers" | "resonants" | null;
type Machine = { id: string; init: AnyRun; advance: (r: AnyRun, e: Ev, faction: Faction) => AnyRun; objective: Record<string, string> };

const zone = (id: Zone.ZoneMissionId): Machine => ({ id, init: Zone.initialRun(id), advance: (r, e) => Zone.advanceMission(r as never, e as never), objective: Zone.ZONE_MISSIONS[id].objective });
const MACHINES: Machine[] = [
  { id: "awakening", init: AWAKENING, advance: (r, e) => advanceAwakening(r as never, e as never), objective: AWAKENING_OBJECTIVE },
  { id: "broken-signal", init: Broken.BROKEN_SIGNAL, advance: (r, e) => Broken.advanceMission(r as never, e as never), objective: Broken.OBJECTIVE },
  { id: "drowned-relay", init: Drowned.DROWNED_RELAY, advance: (r, e) => Drowned.advanceMission(r as never, e as never), objective: Drowned.OBJECTIVE },
  { id: "blackout-protocol", init: Blackout.BLACKOUT_PROTOCOL, advance: (r, e) => Blackout.advanceMission(r as never, e as never), objective: Blackout.OBJECTIVE },
  { id: "stitched-neon-core", init: Stitched.STITCHED_NEON_CORE, advance: (r, e) => Stitched.advanceMission(r as never, e as never), objective: Stitched.OBJECTIVE },
  { id: "solar-array", init: Solar.SOLAR_ARRAY, advance: (r, e) => Solar.advanceMission(r as never, e as never), objective: Solar.OBJECTIVE },
  { id: "core-node", init: CoreNode.CORE_NODE, advance: (r, e, f) => CoreNode.advanceMission(r as never, e as never, f), objective: CoreNode.OBJECTIVE },
  zone("frozen-beacon"), zone("failure-core"), zone("convoy-breaker"),
  { id: "descent-protocol", init: Descent.DESCENT_PROTOCOL, advance: (r, e) => Descent.advanceMission(r as never, e as never), objective: Descent.OBJECTIVE },
  { id: "system-core", init: SystemCore.SYSTEM_CORE, advance: (r, e) => SystemCore.advanceMission(r as never, e as never), objective: SystemCore.OBJECTIVE },
];
const FACTIONS: Faction[] = ["controllers", "breakers", "resonants"];
const n = (v: number) => String(v);
const text = (r: AnyRun) => r.nova ?? r.line ?? "";

/** Canonical run text; fields a machine doesn't carry print as their persistence.ts defaults. */
const describe = (r: AnyRun) => [`id=${r.id}`, `state=${r.state}`, `target=${r.target ? `${n(r.target.x)},${n(r.target.z)}` : "null"}`, `hack=${n(r.hack ?? 0)}`, `hold=${n(r.hold ?? 0)}`,
  `wave2=${r.wave2Done ? 1 : 0}`, `nova=${r.nova ?? ""}`, `line=${r.line ?? ""}`, `alert=${r.alert ?? ""}`].join("\u001f");

// --- every reachable transition's text ---
const lines: { id: string; mission: string; key: string; field: string; text: string }[] = [];
const probe = (state: string): Ev[] => [{ type: "START" }, { type: "ANCHOR", x: 100, z: 200 }, { type: "ARRIVED" }, { type: "ARRIVED", from: state }, { type: "CLEAR" }, { type: "CLEAR", from: state },
  { type: "HACK", progress: 50 }, { type: "HACK", progress: 100 }, { type: "HOLD", progress: 100 }, { type: "ACK" }, { type: "DECIDED" }];
for (const m of MACHINES) {
  const seen = new Map<string, string>();
  const put = (key: string, field: string, value: string) => {
    const prior = seen.get(`${field}|${key}`);
    if (prior !== undefined && prior !== value) throw new Error(`${m.id} ${field} ${key}: two different texts`);
    if (prior === undefined) { seen.set(`${field}|${key}`, value); lines.push({ id: `${m.id}/${field}/${key}`, mission: m.id, key, field, text: value }); }
  };
  const queue: AnyRun[] = [m.init];
  const visited = new Set<string>();
  while (queue.length) {
    const run = queue.shift()!;
    const sig = describe(run);
    if (visited.has(sig)) continue;
    visited.add(sig);
    for (const e of probe(run.state)) for (const f of m.id === "core-node" && e.type === "DECIDED" ? FACTIONS : [null]) {
      const next = m.advance(run, e, f);
      if (next === run) continue;
      if (next.state !== run.state || text(next) !== text(run)) {
        const key = `${run.state}>${next.state}${f ? `:${f}` : ""}`;
        if (next.nova !== undefined && next.nova !== run.nova) put(key, "nova", next.nova);
        if (next.line !== undefined && next.line !== run.line) put(key, "line", next.line);
      }
      if (next.alert !== undefined && next.alert !== run.alert) put(`alert:${run.state}>${next.state}`, "alert", next.alert);
      queue.push(next);
    }
  }
}
writeFileSync(join(process.cwd(), "unreal", "DataTables", "MissionLines.json"), JSON.stringify(lines.map((l) => ({ Name: l.id.replace(/[^A-Za-z0-9_\-]/g, "_"), Mission: l.mission, Key: l.key, Field: l.field, Text: l.text })), null, 2) + "\n");
writeFileSync(join(process.cwd(), "unreal", "DataTables", "MissionObjectives.json"), JSON.stringify(MACHINES.flatMap((m) => Object.entries(m.objective).map(([state, objective]) => ({ Name: `${m.id}_${state}`, Mission: m.id, State: state, Objective: objective }))), null, 2) + "\n");

// --- golden runs ---
let seed = 0x5151;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const states = (m: Machine) => Object.keys(m.objective);
function randomEvent(m: Machine, run: AnyRun): Ev {
  const r = rand();
  if (r < 0.12) return { type: "START" };
  if (r < 0.24) return { type: "ANCHOR", x: Math.round((rand() - 0.5) * 4000) / 4, z: Math.round((rand() - 0.5) * 4000) / 4 };
  if (r < 0.40) return rand() < 0.5 ? { type: "ARRIVED" } : { type: "ARRIVED", from: rand() < 0.7 ? run.state : pick(states(m)) };
  if (r < 0.56) return rand() < 0.4 ? { type: "CLEAR" } : { type: "CLEAR", from: rand() < 0.7 ? run.state : pick(states(m)) };
  if (r < 0.74) return { type: "HACK", progress: pick([0, 10, 33, 49.5, 50, 66, 99.9, 100, 120]) };
  if (r < 0.80) return { type: "HOLD", progress: pick([0, 25, 50, 99, 100]) };
  if (r < 0.92) return { type: "ACK" };
  return { type: "DECIDED" };
}
const eventLine = (e: Ev) => `E\t${e.type}\t${e.type === "ANCHOR" ? n(e.x!) : e.type === "HACK" || e.type === "HOLD" ? n(e.progress!) : e.from ?? "~"}\t${e.type === "ANCHOR" ? n(e.z!) : "~"}`;

const out: string[] = [];
const [a, ring, core] = [airlockSite(), ringWaypoint(), reactorSite()];
out.push(["CTX", n(a.x), n(a.z), n(ring.x), n(ring.z), n(core.x), n(core.z)].join("\t"));
for (const l of lines) out.push(["L", l.mission, l.field, l.key, l.text].join("\t")); // the same rows as MissionLines.json
let steps = 0;
for (const m of MACHINES) for (let c = 0; c < 40; c++) {
  const faction: Faction = m.id === "core-node" ? pick([null, ...FACTIONS]) : null;
  out.push(`C\t${m.id}\t${faction ?? "~"}`);
  let run = m.init;
  for (let s = 0; s < 60; s++) { const e = randomEvent(m, run); run = m.advance(run, e, faction); out.push(eventLine(e), `X\t${describe(run)}`); steps++; }
}
writeFileSync(join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "mission_golden.txt"), out.join("\n") + "\n");
console.log(`${MACHINES.length} missions, ${lines.length} lines, ${steps} recorded steps`);
console.log(MACHINES.map((m) => `${m.id}: ${new Set(out.filter((l) => l.startsWith("X\t") && l.includes(`id=${m.id}\u001f`)).map((l) => l.split("\u001f")[1])).size} states reached`).join("\n"));
