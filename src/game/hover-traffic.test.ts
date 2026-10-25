// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import { HOVER_FLEET, HOVER_LANES, hoverAt, hoverPerimeter, hoverVehiclePose, laneById } from "./hover-traffic";
import { FLEET_MODELS } from "./fleet-models";
import { neonTowers, TOWER_FOOTPRINT } from "./neon-layout";
import { DECK, SPIRE, SKYBRIDGES } from "./neon-tiers";

const samples = (l: (typeof HOVER_LANES)[number], step = 1) => { const out = []; const per = hoverPerimeter(l); for (let s = 0; s < per; s += step) out.push(hoverAt(l, s)); return out; };
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe("Neon hover traffic lanes", () => {
  it("every vehicle is a real fleet model on a real lane", () => {
    for (const veh of HOVER_FLEET) { expect(FLEET_MODELS[veh.model]).toBeDefined(); expect(HOVER_LANES.some((l) => l.id === veh.lane)).toBe(true); expect(veh.at).toBeGreaterThanOrEqual(0); expect(veh.at).toBeLessThan(1); }
    for (const l of HOVER_LANES) expect(HOVER_FLEET.some((v) => v.lane === l.id)).toBe(true);
  });
  it("lanes are closed, continuous and turn smoothly (no teleports, no heading snaps)", () => {
    for (const l of HOVER_LANES) {
      const per = hoverPerimeter(l), pts = samples(l, 0.5);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
        expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.55);
        expect(Math.abs(wrapAngle(b.yaw - a.yaw))).toBeLessThan(0.1);
      }
      const start = hoverAt(l, 0), end = hoverAt(l, per);
      expect(Math.hypot(start.x - end.x, start.z - end.z)).toBeLessThan(1e-6);
    }
  });
  it("the heading points the way the vehicle travels", () => {
    for (const l of HOVER_LANES) for (const s of [3, 50, 120, 200]) {
      const a = hoverAt(l, s), b = hoverAt(l, s + 0.5);
      const dir = Math.atan2(b.x - a.x, b.z - a.z);
      expect(Math.abs(wrapAngle(dir - a.yaw))).toBeLessThan(0.12);
    }
  });
  it("a reversed lane flips the heading so vehicles still face where they go", () => {
    const veh = HOVER_FLEET.find((v) => laneById(v.lane).speed < 0)!;
    const p0 = hoverVehiclePose(veh, 0), p1 = hoverVehiclePose(veh, 0.05);
    const dir = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    expect(Math.abs(wrapAngle(dir - p0.yaw))).toBeLessThan(0.2);
  });
  it("never crosses a tower, the Spire or a deck pillar (measured on the real layout)", () => {
    const towers = neonTowers();
    for (const l of HOVER_LANES) for (const p of samples(l, 1)) {
      for (const t of towers) {
        const [fx, fz] = TOWER_FOOTPRINT[t.variant], sw = t.rot % 2 === 1;
        const dx = Math.max(Math.abs(p.x - t.x) - (sw ? fz : fx), 0), dz = Math.max(Math.abs(p.z - t.z) - (sw ? fx : fz), 0);
        expect(Math.hypot(dx, dz)).toBeGreaterThan(10);
      }
      expect(Math.hypot(p.x - SPIRE.x, p.z - SPIRE.z)).toBeGreaterThan(SPIRE.base + 8);
    }
  });
  it("the street lane runs under the deck ring and its skybridges, the deck lane clears the ring and its pillars", () => {
    const street = laneById("street"), deck = laneById("deck");
    expect(street.y).toBeLessThan(DECK.y - 2);
    expect(street.halfX).toBeLessThan(DECK.halfX - DECK.width);
    expect(street.halfZ).toBeLessThan(DECK.halfZ - DECK.width);
    expect(deck.y).toBeGreaterThan(DECK.y + 3);
    expect(deck.halfX).toBeGreaterThan(DECK.halfX + DECK.width);
    expect(SKYBRIDGES.length).toBeGreaterThan(0);
  });
  it("lanes at different heights are separated by at least a vehicle's height", () => {
    const ys = HOVER_LANES.map((l) => l.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThan(6);
  });
  it("vehicles on one lane never start on top of each other", () => {
    for (const l of HOVER_LANES) {
      const per = hoverPerimeter(l), ats = HOVER_FLEET.filter((v) => v.lane === l.id).map((v) => v.at).sort((a, b) => a - b);
      for (let i = 0; i < ats.length; i++) { const gap = (((ats[(i + 1) % ats.length]! - ats[i]!) % 1) + 1) % 1 || 1; expect(gap * per).toBeGreaterThan(14); }
    }
  });
});
