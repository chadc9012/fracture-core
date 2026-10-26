/** The Phantom Stealth Jet: the player's own private jet (ported from the owner's stages 120-128 prototype patches onto the
 * live game). Pure rules only; the departures board (TransitPanel), the private hangar (PhantomHangar) and the flight cabin
 * (FlightCabin) draw and drive it.
 *
 * - Spec: an executive cabin in six zones (sofa lounge, office, bar, cinema, gaming lounge, bedroom) along one aisle.
 * - Hangars: private aviation at Aetheria Airport · Nexus and Neon International (the travel.ts terminals). The jet can fly
 *   to any airport and waits on that airport's apron; customising and servicing happen in a hangar.
 * - Ownership: bought once with Nex like every other aircraft (market-prices.ts scale: the $10M luxury-jet reference, with the
 *   dealer markup), spent through spendNex under `aircraft:phantom`, and flagged account-wide as the same key in earnedRewards
 *   (union-merged, so every operator and every merged save keeps it).
 * - Look and parking: `progression.privateJet` (optional; normalizePrivateJet + mergePrivateJet, newer copy wins like the fleet's
 *   paint). Condition: the shared vehicle-condition.ts record under `vehicleConditions.phantom` (damage 0..100: body = hull,
 *   engine = engines, tires + suspension = landing gear), serviced with the same 3 Nex/point rate as vehicle repair, grounded by
 *   the same `conditionEffects().disabled` test. No fuel, no second health system.
 * - Flight: a small state machine (hangared -> boarding -> in-transit -> arrived -> hangared) that the cabin overlay walks
 *   through; the teleport itself is GameCanvas.startTransit, the same as a scheduled flight. */
import { marked } from "./market-prices";
import { nexBalance, spendNex, type NexLedger } from "./nex";
import { conditionEffects, normalizeCondition, REPAIR_NEX_PER_POINT, type VehicleCondition } from "./vehicle-condition";

/* ---------------- the jet and its cabin ---------------- */

export type JetRoom = "lounge" | "office" | "bar" | "cinema" | "gaming" | "bedroom";
export type JetLighting = "blue" | "violet" | "gold" | "white";
export type JetZone = { id: JetRoom; label: string; centerZ: number; length: number };
export type PrivateJetSpec = { id: "phantom"; name: string; seating: "sofa"; length: number; width: number; height: number; zones: readonly JetZone[] };

/** cabin metres: 34 m long (a widebody VIP conversion), 5.8 m wide, aisle along x = 0, nose at -z */
export const PHANTOM_JET: PrivateJetSpec = {
  id: "phantom", name: "Phantom Stealth Jet", seating: "sofa", length: 34, width: 5.8, height: 2.6,
  zones: [
    { id: "lounge", label: "Executive sofa lounge", centerZ: -13.5, length: 5 },
    { id: "office", label: "Private office", centerZ: -8, length: 5 },
    { id: "bar", label: "Refreshment bar", centerZ: -2.5, length: 5 },
    { id: "cinema", label: "Private cinema", centerZ: 3, length: 5 },
    { id: "gaming", label: "Gaming lounge", centerZ: 8.5, length: 5 },
    { id: "bedroom", label: "Private bedroom", centerZ: 14, length: 5 },
  ],
};
/** cabin mood lighting; ice blue is the default (stages 123-125 changed it from violet) */
export const JET_LIGHTS: Readonly<Record<JetLighting, { label: string; color: string; intensity: number }>> = {
  blue: { label: "Ice blue", color: "#8fd3ff", intensity: 1.3 },
  violet: { label: "Violet", color: "#a184ff", intensity: 1.2 },
  gold: { label: "Warm gold", color: "#ffcf96", intensity: 1.4 },
  white: { label: "Daylight white", color: "#f4f6ff", intensity: 1.6 },
};
export const DEFAULT_CABIN_LIGHT: JetLighting = "blue";
export const jetAmenities = (spec: PrivateJetSpec = PHANTOM_JET): JetRoom[] => spec.zones.map((z) => z.id).filter((id) => id !== "lounge");
export function jetZoneAt(z: number, spec: PrivateJetSpec = PHANTOM_JET): JetZone | null {
  if (!Number.isFinite(z)) return null;
  return spec.zones.find((zone) => Math.abs(z - zone.centerZ) <= zone.length / 2) ?? null;
}
/** half-width of the walkable aisle (furniture starts beside it) */
export const JET_AISLE_HALF = 0.65;
/** walking stays on the aisle and inside the end bulkheads; a bad number puts you at the cabin's centre */
export function clampJetPosition(x: number, z: number, spec: PrivateJetSpec = PHANTOM_JET): { x: number; z: number } {
  const sx = Number.isFinite(x) ? x : 0, sz = Number.isFinite(z) ? z : 0;
  return { x: Math.max(-JET_AISLE_HALF, Math.min(JET_AISLE_HALF, sx)), z: Math.max(-spec.length / 2 + 1, Math.min(spec.length / 2 - 1, sz)) };
}

/* ---------------- exterior ---------------- */

export type PhantomPaint = "obsidian" | "arctic" | "titanium" | "midnight";
export type PhantomWing = "swept" | "delta" | "split";
export type PhantomExteriorLight = "ice-blue" | "white" | "amber";
export type PhantomExterior = { paint: PhantomPaint; wing: PhantomWing; light: PhantomExteriorLight };
export const DEFAULT_EXTERIOR: PhantomExterior = { paint: "obsidian", wing: "delta", light: "ice-blue" };
/** paint as a car-paint base colour (metalness/roughness live in the material) */
export const PHANTOM_PAINTS: Readonly<Record<PhantomPaint, { label: string; color: string; metalness: number; roughness: number }>> = {
  obsidian: { label: "Obsidian", color: "#16191f", metalness: 0.7, roughness: 0.32 },
  arctic: { label: "Arctic white", color: "#d9dfe4", metalness: 0.35, roughness: 0.3 },
  titanium: { label: "Brushed titanium", color: "#7c858d", metalness: 0.9, roughness: 0.38 },
  midnight: { label: "Midnight blue", color: "#1d2840", metalness: 0.65, roughness: 0.3 },
};
export const PHANTOM_WINGS: Readonly<Record<PhantomWing, { label: string; span: number }>> = {
  swept: { label: "Swept", span: 21 },
  delta: { label: "Delta", span: 18 },
  split: { label: "Split canard", span: 19 },
};
export const PHANTOM_EXTERIOR_LIGHTS: Readonly<Record<PhantomExteriorLight, { label: string; color: string }>> = {
  "ice-blue": { label: "Ice blue", color: "#7fd0ff" },
  white: { label: "White", color: "#f2f6ff" },
  amber: { label: "Amber", color: "#ffb866" },
};
/** apply a change; an unknown value leaves the look as it was */
export function updateExterior(current: PhantomExterior, changes: Partial<PhantomExterior>): PhantomExterior {
  const next = { ...current, ...changes };
  return next.paint in PHANTOM_PAINTS && next.wing in PHANTOM_WINGS && next.light in PHANTOM_EXTERIOR_LIGHTS ? next : current;
}

/* ---------------- hangars and the save ---------------- */

export const PHANTOM_HANGARS: readonly { terminalId: string; label: string }[] = [
  { terminalId: "terminal:nexus", label: "Nexus Private Aviation" },
  { terminalId: "terminal:neon", label: "Neon International Private Aviation" },
];
export const isHangar = (terminalId: string) => PHANTOM_HANGARS.some((h) => h.terminalId === terminalId);
export const hangarLabel = (terminalId: string) => PHANTOM_HANGARS.find((h) => h.terminalId === terminalId)?.label ?? null;

/** what the save keeps besides ownership: where the jet is parked (an airport terminal id), its look, cabin tidiness (0..100,
 * cosmetic only) and how many trips it has flown */
export type PrivateJetSave = { parkedAt: string; exterior: PhantomExterior; cabin: JetLighting; cleanliness: number; flights: number };
export const defaultPrivateJet = (parkedAt: string): PrivateJetSave => ({ parkedAt, exterior: DEFAULT_EXTERIOR, cabin: DEFAULT_CABIN_LIGHT, cleanliness: 100, flights: 0 });
export function normalizePrivateJet(raw: unknown): PrivateJetSave | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<PrivateJetSave>;
  if (typeof r.parkedAt !== "string" || !r.parkedAt.startsWith("terminal:")) return undefined;
  const e = (r.exterior ?? {}) as Partial<PhantomExterior>;
  const n = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  return {
    parkedAt: r.parkedAt,
    exterior: updateExterior(DEFAULT_EXTERIOR, { ...(e.paint ? { paint: e.paint } : {}), ...(e.wing ? { wing: e.wing } : {}), ...(e.light ? { light: e.light } : {}) }),
    cabin: typeof r.cabin === "string" && r.cabin in JET_LIGHTS ? r.cabin : DEFAULT_CABIN_LIGHT,
    cleanliness: n(r.cleanliness, 0, 100, 100),
    flights: Math.floor(n(r.flights, 0, 1e9, 0)),
  };
}
/** cloud merge: the look and the parking spot are choices (newer copy wins); the trip count is only ever gained */
export function mergePrivateJet(a: PrivateJetSave | undefined, b: PrivateJetSave | undefined, aIsNewer: boolean): PrivateJetSave | undefined {
  const newer = aIsNewer ? a ?? b : b ?? a;
  if (!newer) return undefined;
  return { ...newer, flights: Math.max(a?.flights ?? 0, b?.flights ?? 0) };
}

/* ---------------- ownership ---------------- */

export const PHANTOM_KEY = "aircraft:phantom";
/** reference price: the $10M luxury jet on the market-prices scale (100,000 Nex), with the same dealer markup as every aircraft */
export const PHANTOM_BASE_PRICE = 100_000;
export const PHANTOM_NEX_PRICE = marked(PHANTOM_BASE_PRICE);
export const PHANTOM_CONDITION_KEY = "phantom";

type JetStore = { nexLedger: NexLedger; earnedRewards: string[]; vehicleConditions: Record<string, VehicleCondition>; privateJet?: PrivateJetSave | undefined };
export type JetResult<P> = { progression: P; message: string } | { error: string };

export const ownsPhantom = (p: Pick<JetStore, "earnedRewards">) => p.earnedRewards.includes(PHANTOM_KEY);
/** where the jet is, defaulting to the first hangar for a save that owns it but has no record yet */
export const phantomOf = (p: Pick<JetStore, "privateJet">): PrivateJetSave => p.privateJet ?? defaultPrivateJet(PHANTOM_HANGARS[0]!.terminalId);

/** buy the Phantom at a private hangar: one Nex spend, then it is parked in that hangar in its factory look */
export function buyPhantom<P extends JetStore>(p: P, hangarTerminalId: string): JetResult<P> {
  if (ownsPhantom(p)) return { error: "The Phantom is already yours" };
  if (!isHangar(hangarTerminalId)) return { error: "Buy it at a private aviation hangar (Nexus or Neon)" };
  const ledger = spendNex(p.nexLedger, PHANTOM_KEY, PHANTOM_NEX_PRICE);
  if (!ledger) return { error: `Needs ${PHANTOM_NEX_PRICE.toLocaleString("en-US")} Nex (you have ${nexBalance(p.nexLedger).toLocaleString("en-US")})` };
  return {
    progression: { ...p, nexLedger: ledger, earnedRewards: [...p.earnedRewards, PHANTOM_KEY], privateJet: p.privateJet ?? defaultPrivateJet(hangarTerminalId) },
    message: `Phantom Stealth Jet delivered to ${hangarLabel(hangarTerminalId)}`,
  };
}
/** change the look (only in a hangar) */
export function customizePhantom<P extends JetStore>(p: P, at: string, change: { exterior?: Partial<PhantomExterior>; cabin?: JetLighting }): JetResult<P> {
  if (!ownsPhantom(p)) return { error: "You don't own the Phantom" };
  const jet = phantomOf(p);
  if (!isHangar(at) || jet.parkedAt !== at) return { error: "The Phantom isn't in this hangar" };
  const exterior = change.exterior ? updateExterior(jet.exterior, change.exterior) : jet.exterior;
  const cabin = change.cabin && change.cabin in JET_LIGHTS ? change.cabin : jet.cabin;
  return { progression: { ...p, privateJet: { ...jet, exterior, cabin } }, message: "Look saved" };
}
/** bring the jet to this hangar from wherever it is parked (the ground crew ferries it; it flies the trip, so it wears) */
export function recallPhantom<P extends JetStore>(p: P, hangarTerminalId: string): JetResult<P> {
  if (!ownsPhantom(p)) return { error: "You don't own the Phantom" };
  if (!isHangar(hangarTerminalId)) return { error: "Recall it to a private hangar" };
  const jet = phantomOf(p);
  if (jet.parkedAt === hangarTerminalId) return { error: "The Phantom is already here" };
  return { progression: wearFlight({ ...p, privateJet: { ...jet, parkedAt: hangarTerminalId } }, false), message: `Phantom ferried to ${hangarLabel(hangarTerminalId)}` };
}

/* ---------------- condition and the maintenance bay ---------------- */

export type PhantomSystem = "hull" | "engines" | "gear";
export const PHANTOM_SYSTEMS: readonly { id: PhantomSystem; label: string }[] = [
  { id: "hull", label: "Hull and skin" }, { id: "engines", label: "Engines" }, { id: "gear", label: "Landing gear" },
];
export const phantomCondition = (p: Pick<JetStore, "vehicleConditions">) => normalizeCondition(p.vehicleConditions[PHANTOM_CONDITION_KEY]);
/** system health 0..100 (100 = perfect) read from the shared damage record */
export function systemHealth(c: VehicleCondition, s: PhantomSystem): number {
  const dmg = s === "hull" ? c.body : s === "engines" ? c.engine : (c.tires + c.suspension) / 2;
  return Math.round(100 - dmg);
}
/** systems that want a service (below 75%) */
export const inspectPhantom = (c: VehicleCondition): PhantomSystem[] => PHANTOM_SYSTEMS.map((s) => s.id).filter((s) => systemHealth(c, s) < 75);
/** grounded by the same rule that disables a car (engine ≥ 90 or body ≥ 100 damage) */
export const airworthy = (c: VehicleCondition) => !conditionEffects(c).disabled;
/** wear from one trip: engines and gear take the most; the cabin gets lived in */
export const FLIGHT_WEAR = { body: 2, engine: 5, tires: 4, suspension: 3, cleanliness: 14 } as const;
function wearFlight<P extends JetStore>(p: P, withPassenger: boolean): P {
  const c = phantomCondition(p), jet = phantomOf(p);
  const worn = normalizeCondition({ body: c.body + FLIGHT_WEAR.body, engine: c.engine + FLIGHT_WEAR.engine, tires: c.tires + FLIGHT_WEAR.tires, suspension: c.suspension + FLIGHT_WEAR.suspension });
  return {
    ...p, vehicleConditions: { ...p.vehicleConditions, [PHANTOM_CONDITION_KEY]: worn },
    privateJet: { ...jet, flights: jet.flights + 1, cleanliness: withPassenger ? Math.max(0, jet.cleanliness - FLIGHT_WEAR.cleanliness) : jet.cleanliness },
  };
}
/** Nex to service one system: the vehicle repair rate (vehicle-condition.ts: 3 Nex per point of the averaged damage, so the
 * three systems together cost what a full car repair would) */
export function serviceCost(c: VehicleCondition, s: PhantomSystem): number {
  const pts = s === "hull" ? c.body : s === "engines" ? c.engine : c.tires + c.suspension;
  return Math.ceil(pts / 4) * REPAIR_NEX_PER_POINT;
}
export function servicePhantom<P extends JetStore>(p: P, at: string, s: PhantomSystem, now: number): JetResult<P> {
  if (!ownsPhantom(p)) return { error: "You don't own the Phantom" };
  if (!isHangar(at) || phantomOf(p).parkedAt !== at) return { error: "Service needs the jet in this hangar" };
  const c = phantomCondition(p), price = serviceCost(c, s);
  if (price <= 0) return { error: "Nothing to service" };
  const ledger = spendNex(p.nexLedger, `repair:phantom:${s}:${now}`, price);
  if (!ledger) return { error: `Needs ${price} Nex (you have ${nexBalance(p.nexLedger)})` };
  const fixed: VehicleCondition = s === "hull" ? { ...c, body: 0 } : s === "engines" ? { ...c, engine: 0 } : { ...c, tires: 0, suspension: 0 };
  return { progression: { ...p, nexLedger: ledger, vehicleConditions: { ...p.vehicleConditions, [PHANTOM_CONDITION_KEY]: fixed } }, message: `${PHANTOM_SYSTEMS.find((x) => x.id === s)!.label} serviced · -${price} Nex` };
}
/** cabin valet: 1 Nex per point of tidiness, cosmetic only */
export const valetCost = (jet: PrivateJetSave) => Math.ceil(100 - jet.cleanliness);
export function valetPhantom<P extends JetStore>(p: P, at: string, now: number): JetResult<P> {
  if (!ownsPhantom(p)) return { error: "You don't own the Phantom" };
  const jet = phantomOf(p);
  if (!isHangar(at) || jet.parkedAt !== at) return { error: "The valet works in the hangar" };
  const price = valetCost(jet);
  if (price <= 0) return { error: "The cabin is spotless" };
  const ledger = spendNex(p.nexLedger, `valet:phantom:${now}`, price);
  if (!ledger) return { error: `Needs ${price} Nex (you have ${nexBalance(p.nexLedger)})` };
  return { progression: { ...p, nexLedger: ledger, privateJet: { ...jet, cleanliness: 100 } }, message: `Cabin valeted · -${price} Nex` };
}

/* ---------------- flying it ---------------- */

/** why the Phantom can't fly from here to there right now, or null when it can */
export function phantomFlightBlock(p: JetStore, from: string, to: string): string | null {
  if (!ownsPhantom(p)) return "You don't own the Phantom";
  if (phantomOf(p).parkedAt !== from) return "The Phantom isn't parked here";
  if (from === to) return "You're already here";
  if (!to.startsWith("terminal:")) return "The Phantom lands at airports";
  if (!airworthy(phantomCondition(p))) return "Grounded: service the engines";
  return null;
}
/** a finished trip: the jet is parked at the destination's apron (or hangar) and has worn a little */
export function completePhantomFlight<P extends JetStore>(p: P, from: string, to: string): P {
  if (phantomFlightBlock(p, from, to)) return p;
  return wearFlight({ ...p, privateJet: { ...phantomOf(p), parkedAt: to } }, true);
}

export type PhantomFlightStatus = "hangared" | "boarding" | "in-transit" | "arrived";
export type PhantomFlight = { status: PhantomFlightStatus; from: string; to: string | null };
export const parkedFlight = (at: string): PhantomFlight => ({ status: "hangared", from: at, to: null });
export const startBoarding = (f: PhantomFlight, to: string): PhantomFlight => (f.status === "hangared" && to !== f.from ? { ...f, status: "boarding", to } : f);
export const departFlight = (f: PhantomFlight): PhantomFlight => (f.status === "boarding" && f.to ? { ...f, status: "in-transit" } : f);
export const arriveFlight = (f: PhantomFlight): PhantomFlight => (f.status === "in-transit" && f.to ? { ...f, status: "arrived" } : f);
export const parkFlight = (f: PhantomFlight): PhantomFlight => (f.status === "arrived" && f.to ? { status: "hangared", from: f.to, to: null } : f);

/* ---------------- the cockpit readout ---------------- */

/** what the flight deck shows. Read-only: there are no pilot controls (the trip is the transit). No fuel gauge: the game has
 * no fuel system. */
export type CockpitReadout = { speedKph: number; altitudeM: number; headingDeg: number; mach: number; etaS: number; autopilot: boolean; phase: string };
export const PARKED_READOUT: CockpitReadout = { speedKph: 0, altitudeM: 0, headingDeg: 0, mach: 0, etaS: 0, autopilot: false, phase: "Parked" };
const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
export const PHANTOM_CRUISE = { speedKph: 980, altitudeM: 13_700, rotateKph: 250 } as const;
/** compass heading (0 = north = -z, clockwise) from one map point to another */
export const headingBetween = (a: { x: number; z: number }, b: { x: number; z: number }) => ((Math.atan2(b.x - a.x, -(b.z - a.z)) * 180) / Math.PI + 360) % 360;
/** the deck during a trip at `progress` 0..1 of `durationS`: taxi and roll, climb, cruise on autopilot, descent, rollout */
export function flightReadout(progress: number, headingDeg: number, durationS: number): CockpitReadout {
  const t = clamp(progress, 0, 1);
  const s = (a: number, b: number) => { const k = clamp((t - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const altitudeM = PHANTOM_CRUISE.altitudeM * (s(0.12, 0.32) - s(0.78, 0.96));
  const speedKph = t < 0.1 ? 40 * s(0, 0.04) : PHANTOM_CRUISE.rotateKph * s(0.06, 0.12) + (PHANTOM_CRUISE.speedKph - PHANTOM_CRUISE.rotateKph) * (s(0.12, 0.32) - s(0.78, 0.96)) - (PHANTOM_CRUISE.rotateKph - 30) * s(0.95, 1);
  const phase = t < 0.1 ? "Taxi" : t < 0.32 ? "Climb" : t < 0.78 ? "Cruise" : t < 0.96 ? "Descent" : t < 1 ? "Rollout" : "Arrived";
  return cockpitReadout({ speedKph, altitudeM, headingDeg, mach: speedKph / 1062, etaS: (1 - t) * durationS, autopilot: t >= 0.32 && t < 0.78, phase });
}
export function cockpitReadout(r: CockpitReadout): CockpitReadout {
  return { ...r, speedKph: Math.round(clamp(r.speedKph, 0, 3000)), altitudeM: Math.round(clamp(r.altitudeM, 0, 30_000)), headingDeg: Number.isFinite(r.headingDeg) ? Math.round(((r.headingDeg % 360) + 360) % 360) % 360 : 0, mach: Math.round(clamp(r.mach, 0, 3) * 100) / 100, etaS: Math.round(clamp(r.etaS, 0, 3600)) };
}
