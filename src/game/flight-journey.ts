/** The ride itself (ported from the stages 105-107 journey timeline): a scheduled flight, a ferry or the Phantom is a short
 * cabin journey (boarding, departing, en route, arriving) shown before the usual transit cover teleports you. Pure timing;
 * GameCanvas runs it and FlightCabin draws it. The player can skip to arrival at any time; the trip always ends in
 * GameCanvas.startTransit, so travel rules stay exactly those of the departures board. */

export type JourneyKind = "scheduled" | "ferry" | "phantom";
export type JourneyPhase = "boarding" | "departing" | "enroute" | "arriving" | "complete";
/** seconds per trip kind: long enough to walk the aisle and sit down, short enough not to be a chore (skip is always there) */
export const JOURNEY_SECONDS: Readonly<Record<JourneyKind, number>> = { scheduled: 30, ferry: 34, phantom: 24 };
/** phase boundaries as fractions of the trip (the patch's 0.8 / 2.5 / 6.5 of 8 s) */
export const PHASE_AT = { departing: 0.1, enroute: 0.31, arriving: 0.81 } as const;

export function journeyPhase(elapsedS: number, durationS: number): JourneyPhase {
  const t = Number.isFinite(elapsedS) && durationS > 0 ? Math.max(0, elapsedS) / durationS : 0;
  return t >= 1 ? "complete" : t >= PHASE_AT.arriving ? "arriving" : t >= PHASE_AT.enroute ? "enroute" : t >= PHASE_AT.departing ? "departing" : "boarding";
}
export const journeyProgress = (elapsedS: number, durationS: number) => (Number.isFinite(elapsedS) && durationS > 0 ? Math.max(0, Math.min(1, elapsedS / durationS)) : 0);
/** boarding progress 0..1 within the boarding phase (fellow passengers find their seats) */
export const boardingProgress = (elapsedS: number, durationS: number) => Math.min(1, journeyProgress(elapsedS, durationS) / PHASE_AT.departing);

const LABEL: Record<JourneyKind, Record<JourneyPhase, string>> = {
  scheduled: { boarding: "Boarding", departing: "Taxi and take-off", enroute: "Cruising", arriving: "Final approach", complete: "Arrived" },
  ferry: { boarding: "Boarding", departing: "Casting off", enroute: "At sea", arriving: "Coming alongside", complete: "Docked" },
  phantom: { boarding: "Doors closing", departing: "Wheels up", enroute: "Private cruise", arriving: "Descent", complete: "Arrived" },
};
export const phaseLabel = (kind: JourneyKind, phase: JourneyPhase) => LABEL[kind][phase];

/** a stable flight / sailing number for a route ("AE 214", "FY 37") */
export function serviceNumber(kind: JourneyKind, fromId: string, toId: string): string {
  let h = 7;
  for (const ch of `${fromId}>${toId}`) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return kind === "ferry" ? `FY ${10 + (h % 90)}` : kind === "phantom" ? "PHANTOM 1" : `AE ${100 + (h % 900)}`;
}
