// @ts-ignore bun:test has no types in this project's tsconfig
import { describe, expect, it } from "bun:test";
import {
  DEFAULT_EXTERIOR, JET_LIGHTS, PHANTOM_JET, PHANTOM_KEY, PHANTOM_NEX_PRICE, PARKED_READOUT, airworthy, arriveFlight, buyPhantom, clampJetPosition, cockpitReadout,
  completePhantomFlight, customizePhantom, departFlight, flightReadout, headingBetween, inspectPhantom, jetAmenities, jetZoneAt, mergePrivateJet, normalizePrivateJet,
  ownsPhantom, parkFlight, parkedFlight, phantomCondition, phantomFlightBlock, phantomOf, recallPhantom, serviceCost, servicePhantom, startBoarding, systemHealth,
  updateExterior, valetPhantom,
} from "./phantom-jet";
import { DEFAULT_PROGRESSION, normalizeProgression, type PlayerProgression } from "./progression";
import { mergeProgression } from "./cloud-save";
import { FLEET_NEX_PRICE, marked } from "./market-prices";
import { nexBalance } from "./nex";
import { TERMINALS } from "./travel";

const NEXUS = "terminal:nexus", NEON = "terminal:neon", SOLARA = "terminal:solara";
const rich = (nex = 500_000): PlayerProgression => ({ ...DEFAULT_PROGRESSION, nexLedger: { grant: nex } });
const owned = () => { const r = buyPhantom(rich(), NEXUS); if ("error" in r) throw new Error(r.error); return r.progression; };

describe("Phantom cabin spec (stages 120-122)", () => {
  it("keeps sofa seating, the ice-blue default and all five amenities beside the lounge", () => {
    expect(PHANTOM_JET.seating).toBe("sofa");
    expect(phantomOf(DEFAULT_PROGRESSION).cabin).toBe("blue");
    expect(JET_LIGHTS.blue.label).toBe("Ice blue");
    expect(jetAmenities()).toEqual(["office", "bar", "cinema", "gaming", "bedroom"]);
  });
  it("every zone sits inside the cabin and is found at its centre", () => {
    for (const z of PHANTOM_JET.zones) {
      expect(Math.abs(z.centerZ) + z.length / 2).toBeLessThanOrEqual(PHANTOM_JET.length / 2);
      expect(jetZoneAt(z.centerZ)?.id).toBe(z.id);
    }
    expect(jetZoneAt(NaN)).toBeNull();
  });
  it("aisle walking is clamped and rejects bad numbers", () => {
    expect(clampJetPosition(999, 999)).toEqual({ x: 0.65, z: 16 });
    expect(clampJetPosition(NaN, Infinity)).toEqual({ x: 0, z: 0 });
  });
});

describe("Phantom ownership and hangars (stages 123-125)", () => {
  it("both private hangars are real airport terminals", () => {
    for (const id of [NEXUS, NEON]) expect(TERMINALS.find((t) => t.id === id)?.kind).toBe("AIRPORT");
  });
  it("is bought once with Nex on the aircraft price scale, at a hangar only", () => {
    expect(PHANTOM_NEX_PRICE).toBe(marked(100_000));
    expect(PHANTOM_NEX_PRICE).toBeGreaterThan(FLEET_NEX_PRICE["f39-jupiter"]!);
    expect("error" in buyPhantom(rich(), SOLARA)).toBe(true);
    expect("error" in buyPhantom(rich(1000), NEXUS)).toBe(true);
    const p = owned();
    expect(ownsPhantom(p)).toBe(true);
    expect(nexBalance(p.nexLedger)).toBe(500_000 - PHANTOM_NEX_PRICE);
    expect(p.privateJet?.parkedAt).toBe(NEXUS);
    expect("error" in buyPhantom(p, NEXUS)).toBe(true); // never charged twice
  });
  it("ownership and the look survive a save round trip and a cloud merge with a copy that never bought it", () => {
    const p = owned();
    const r = customizePhantom(p, NEXUS, { exterior: { paint: "arctic", wing: "split" }, cabin: "gold" });
    if ("error" in r) throw new Error(r.error);
    const saved = normalizeProgression(JSON.parse(JSON.stringify(r.progression)));
    expect(saved.privateJet?.exterior).toEqual({ paint: "arctic", wing: "split", light: "ice-blue" });
    expect(saved.privateJet?.cabin).toBe("gold");
    for (const localIsNewer of [true, false]) {
      const merged = mergeProgression(saved, DEFAULT_PROGRESSION, localIsNewer);
      expect(ownsPhantom(merged)).toBe(true);
      expect(PHANTOM_KEY in merged.nexLedger).toBe(true);
      expect(merged.privateJet?.exterior.paint).toBe("arctic");
    }
  });
  it("normalize drops junk and fills defaults", () => {
    expect(normalizePrivateJet({ parkedAt: "seaport:nexus" })).toBeUndefined();
    expect(normalizePrivateJet({ parkedAt: NEON, exterior: { paint: "pink" }, cabin: "disco", cleanliness: 400 })).toEqual({ parkedAt: NEON, exterior: DEFAULT_EXTERIOR, cabin: "blue", cleanliness: 100, flights: 0 });
    expect(mergePrivateJet({ ...normalizePrivateJet({ parkedAt: NEON })!, flights: 9 }, { ...normalizePrivateJet({ parkedAt: NEXUS })!, flights: 2 }, false)).toMatchObject({ parkedAt: NEXUS, flights: 9 });
  });
  it("the flight state machine only moves forward along a valid trip", () => {
    const f = parkedFlight(NEXUS);
    expect(startBoarding(f, NEXUS)).toBe(f);
    expect(departFlight(f)).toBe(f);
    const done = parkFlight(arriveFlight(departFlight(startBoarding(f, NEON))));
    expect(done).toEqual({ status: "hangared", from: NEON, to: null });
  });
  it("flies from where it is parked to any other airport and waits there", () => {
    const p = owned();
    expect(phantomFlightBlock(DEFAULT_PROGRESSION, NEXUS, NEON)).toMatch(/own/);
    expect(phantomFlightBlock(p, NEON, NEXUS)).toMatch(/isn't parked/);
    expect(phantomFlightBlock(p, NEXUS, "seaport:neon")).toMatch(/airports/);
    expect(phantomFlightBlock(p, NEXUS, SOLARA)).toBeNull();
    const there = completePhantomFlight(p, NEXUS, SOLARA);
    expect(there.privateJet?.parkedAt).toBe(SOLARA);
    expect(there.privateJet?.flights).toBe(1);
    expect(systemHealth(phantomCondition(there), "engines")).toBeLessThan(100);
    expect(completePhantomFlight(there, NEXUS, NEON)).toBe(there); // not parked at Nexus any more
    // customise and service only in a hangar
    expect("error" in customizePhantom(there, SOLARA, { cabin: "white" })).toBe(true);
    const back = recallPhantom(there, NEON);
    if ("error" in back) throw new Error(back.error);
    expect(back.progression.privateJet?.parkedAt).toBe(NEON);
  });
});

describe("Phantom workshop (stages 126-128)", () => {
  it("changes one part of the look at a time and ignores unknown values", () => {
    expect(updateExterior(DEFAULT_EXTERIOR, { wing: "split" })).toEqual({ ...DEFAULT_EXTERIOR, wing: "split" });
    expect(updateExterior(DEFAULT_EXTERIOR, { paint: "pink" as never })).toBe(DEFAULT_EXTERIOR);
    expect(DEFAULT_EXTERIOR.light).toBe("ice-blue");
  });
  it("wear shows in the maintenance bay; servicing one system costs Nex and fixes only that system", () => {
    let p = owned();
    for (let i = 0; i < 6; i++) { p = completePhantomFlight(p, p.privateJet!.parkedAt, p.privateJet!.parkedAt === NEXUS ? NEON : NEXUS); }
    expect(p.privateJet?.parkedAt).toBe(NEXUS);
    const c = phantomCondition(p);
    expect(inspectPhantom(c)).toContain("engines");
    const cost = serviceCost(c, "engines");
    expect(cost).toBeGreaterThan(0);
    const r = servicePhantom(p, NEXUS, "engines", 1234);
    if ("error" in r) throw new Error(r.error);
    expect(systemHealth(phantomCondition(r.progression), "engines")).toBe(100);
    expect(systemHealth(phantomCondition(r.progression), "hull")).toBe(systemHealth(c, "hull"));
    expect(nexBalance(r.progression.nexLedger)).toBe(nexBalance(p.nexLedger) - cost);
    expect("error" in servicePhantom(r.progression, NEXUS, "engines", 1235)).toBe(true);
    expect(p.privateJet!.cleanliness).toBeLessThan(100);
    const v = valetPhantom(p, NEXUS, 99);
    if ("error" in v) throw new Error(v.error);
    expect(v.progression.privateJet?.cleanliness).toBe(100);
  });
  it("a worn-out jet is grounded until the engines are serviced", () => {
    const p = { ...owned(), vehicleConditions: { phantom: { body: 10, engine: 95, tires: 0, suspension: 0 } } };
    expect(airworthy(phantomCondition(p))).toBe(false);
    expect(phantomFlightBlock(p, NEXUS, NEON)).toMatch(/Grounded/);
  });
  it("the cockpit reads parked on the ground, cruises on autopilot mid-trip and clamps bad numbers", () => {
    expect(PARKED_READOUT.speedKph).toBe(0);
    const mid = flightReadout(0.5, 90, 24);
    expect(mid.phase).toBe("Cruise");
    expect(mid.autopilot).toBe(true);
    expect(mid.altitudeM).toBeGreaterThan(10_000);
    expect(mid.headingDeg).toBe(90);
    const end = flightReadout(1, 90, 24);
    expect(end.altitudeM).toBe(0);
    expect(end.speedKph).toBeLessThan(60);
    expect(cockpitReadout({ ...PARKED_READOUT, speedKph: 9e9, headingDeg: -90 })).toMatchObject({ speedKph: 3000, headingDeg: 270 });
    expect(cockpitReadout({ ...PARKED_READOUT, headingDeg: NaN }).headingDeg).toBe(0);
    expect(headingBetween({ x: 0, z: 0 }, { x: 0, z: -10 })).toBe(0);
    expect(headingBetween({ x: 0, z: 0 }, { x: 10, z: 0 })).toBe(90);
  });
});
