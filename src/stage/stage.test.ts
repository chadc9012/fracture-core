import { describe, expect, mock, test } from "bun:test";
// three is not installable in this sandbox; the pure modules only touch Vector3 in code paths these tests do not call
mock.module("three", () => ({ Vector3: class { x = 0; y = 0; z = 0; constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } } }));
const { WORLD_VISUAL_PROFILES, buildVisualFrame, getVisualRegion, validateMaterialProfile, PRODUCTION_MATERIALS } = await import("./world/worldVisualRuntime.ts");
const { buildSceneVisualSettings, createVisualTransitionState, makeVisualInput, transitionVisualSettings } = await import("./world/worldVisualPresentation.ts");
const { getWaterProfile, shorelineFoamWeight, underwaterVisibility, sampleWaterHeight } = await import("./world/waterEnvironment.ts");
const { sampleTerrainSlopeDegrees, canPlaceEcology, ecologyDensityMultiplier } = await import("./world/terrainEcology.ts");
const { createWeaponCameraState, stepWeaponCamera, weaponCameraFov, weaponCameraSensitivity } = await import("./camera/combatCameraWeapon.ts");
const { acquireCameraTarget, createCameraAssistState, cycleCameraTarget, swapCameraShoulder } = await import("./camera/combatCameraAssist.ts");
const { WORLD_CAMERA_PRESETS, buildWorldCameraPose, createCameraRigState } = await import("./camera/worldCameraSystem.ts");
const { hashNoise, sampleTerrainHeight } = await import("./world/productionWorldAssets.ts");

describe("stage 10-11 visual runtime", () => {
  test("ten regions with valid, distinct profiles", () => {
    expect(WORLD_VISUAL_PROFILES.length).toBe(10);
    expect(new Set(WORLD_VISUAL_PROFILES.map((p) => p.id)).size).toBe(10);
    for (const m of PRODUCTION_MATERIALS) expect(validateMaterialProfile(m)).toEqual([]);
    expect(getVisualRegion("neon-city").id).toBe("neon-city");
  });
  test("a frame maps to finite scene settings and transitions smoothly", () => {
    const a = buildSceneVisualSettings(makeVisualInput("neon-city", "rain", 22, 0.65, "high", 0.016));
    const b = buildSceneVisualSettings(makeVisualInput("frost-spire", "snow", 12, 0.1, "high", 0.016));
    const st = createVisualTransitionState();
    transitionVisualSettings(st, a, 0.016);
    const mid = transitionVisualSettings(st, b, 0.2);
    expect(mid.fog.density).toBeGreaterThan(Math.min(a.fog.density, b.fog.density) - 1e-9);
    expect(mid.fog.density).toBeLessThan(Math.max(a.fog.density, b.fog.density) + 1e-9);
    expect(Number.isFinite(buildVisualFrame(makeVisualInput("thalassia", "underwater", 3, 0, "low", 0.016)).exposure)).toBe(true);
  });
});
describe("stage 15-16 ecology and water", () => {
  test("water profiles are distinct and helpers stay finite", () => {
    const kinds = ["ocean", "river", "lake", "waterfall", "underwater"] as const;
    expect(new Set(kinds.map((k) => getWaterProfile(k).waveAmplitude)).size).toBeGreaterThan(2);
    expect(Number.isFinite(sampleWaterHeight(3, 4, 1.2, getWaterProfile("ocean")))).toBe(true);
    expect(shorelineFoamWeight(0, 1)).toBeGreaterThan(shorelineFoamWeight(5, 1));
    expect(underwaterVisibility(50, 0.05)).toBeLessThan(underwaterVisibility(1, 0.05));
    expect(Number.isFinite(shorelineFoamWeight(NaN, 1))).toBe(true);
  });
  test("exclusion zones block placement and density differs by biome", () => {
    const rules = { biome: "verdant", seed: 3, exclusionZones: [{ kind: "circle", x: 0, z: 0, radius: 5, reason: "building" }] };
    expect(canPlaceEcology(0, 0, rules as never)).toBe(false);
    expect(ecologyDensityMultiplier("desert", "tree")).toBeLessThan(ecologyDensityMultiplier("verdant", "tree"));
    expect(Number.isFinite(sampleTerrainSlopeDegrees(2, 2))).toBe(true);
    expect(sampleTerrainHeight(1, 2, 5)).toBe(sampleTerrainHeight(1, 2, 5));
    const h = hashNoise(3, 4, 1); expect(h).toBeGreaterThanOrEqual(-1); expect(h).toBeLessThanOrEqual(1);
  });
});
describe("stage 7-9 camera", () => {
  test("aiming narrows FOV and slows sensitivity, then recovers", () => {
    const aim = weaponCameraFov(70, true, 1), free = weaponCameraFov(aim, false, 1);
    expect(aim).toBeLessThan(70); expect(free).toBeGreaterThan(aim);
    expect(weaponCameraSensitivity(1, true)).toBeLessThan(1);
  });
  test("a shot kicks the camera and recoil decays; shoulder swap flips side", () => {
    let s = createWeaponCameraState();
    s = stepWeaponCamera(s, { aimHeld: false, firePressed: true, deltaSeconds: 0.016, shotId: 1, shotRecoil: 0.05, shotYaw: 0.01 }, {});
    const kicked = Math.abs(s.recoilPitch);
    expect(kicked).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) s = stepWeaponCamera(s, { aimHeld: false, deltaSeconds: 0.016 }, {});
    expect(Math.abs(s.recoilPitch)).toBeLessThan(kicked);
    expect(swapCameraShoulder(createCameraAssistState()).shoulderSide).toBe(-1);
  });
  test("target acquisition prefers the target in front and cycling wraps", () => {
    const origin = { x: 0, y: 1, z: 0 }, fwd = { x: 0, y: 0, z: 1 };
    const cands = [{ id: "a", position: { x: 0, y: 1, z: 10 } }, { id: "b", position: { x: 0, y: 1, z: -10 } }];
    expect(acquireCameraTarget(origin, fwd, cands as never)).toBe("a");
    expect(cycleCameraTarget("a", cands as never)).toBe("b");
  });
  test("camera presets produce a finite pose", () => {
    const rig = createCameraRigState("combat", 0), pose = buildWorldCameraPose({ target: { x: 1, y: 0, z: 2 }, rig, mode: "combat" });
    expect(Number.isFinite(pose.position.x + pose.position.y + pose.position.z)).toBe(true);
    expect(Object.keys(WORLD_CAMERA_PRESETS).length).toBeGreaterThanOrEqual(6);
  });
});
