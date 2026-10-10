/** Elemental projectile and spell presentation for enemies and bosses. PURE and VISUAL ONLY: hit tests, damage, rewards and phases stay in
 * sim.ts / encounter-sim.ts. A projectile here is a flourish that travels from the shooter to where the shot was aimed; it never decides a hit. */
export type Element = "FIRE" | "ICE" | "ACID" | "VOID" | "ARC" | "HOLY" | "BALLISTIC";
export type ElementStyle = { color: string; core: string; /** metres/second of the visual flight */ speed: number; size: number; /** extra lob height, metres */ lob: number; trail: number };

export const ELEMENT_STYLE: Record<Element, ElementStyle> = {
  FIRE: { color: "#ff6a1a", core: "#ffe08a", speed: 38, size: 0.42, lob: 1.2, trail: 2.6 },
  ICE: { color: "#8fdcff", core: "#f2fcff", speed: 44, size: 0.34, lob: 0, trail: 2.2 },
  ACID: { color: "#8bff3a", core: "#e8ffbf", speed: 30, size: 0.4, lob: 3.2, trail: 1.6 },
  VOID: { color: "#a05cff", core: "#f0e0ff", speed: 40, size: 0.4, lob: 0.4, trail: 2.8 },
  ARC: { color: "#4de6ff", core: "#e6fcff", speed: 62, size: 0.26, lob: 0, trail: 3.2 },
  HOLY: { color: "#ffe9a0", core: "#ffffff", speed: 46, size: 0.36, lob: 0, trail: 2.6 },
  BALLISTIC: { color: "#ffd27a", core: "#fff4d6", speed: 90, size: 0.12, lob: 0, trail: 3.4 },
};

/** regional air: troops fight with the element of the ground they stand on (all other regions keep plain tracer fire) */
export function zoneElement(zone: string | undefined, kind?: string): Element {
  switch (zone) {
    case "ember": return "FIRE";
    case "frostspire": return "ICE";
    case "swamps": return "ACID";
    case "nexus": return kind === "OVERCLOCKED" ? "ARC" : "BALLISTIC";
    default: return kind === "ABERRATION" ? "ACID" : kind === "VANGUARD" ? "ICE" : kind === "OVERCLOCKED" ? "ARC" : "BALLISTIC";
  }
}

/** how a Unique Scenario boss fights visually: the Dark Knight casts void magic with his staff, Rime Alpha breathes frost, the Drowned
 * Monarch spits corrosive tide, the Hollow Saint throws light */
export const BOSS_ELEMENT: Record<string, Element> = { "dark-knight": "VOID", "rime-alpha": "ICE", "drowned-monarch": "ACID", "hollow-saint": "HOLY" };

export type AttackFxMode = "volley" | "spell" | "none";
export type AttackFx = { element: Element; mode: AttackFxMode; /** bolts in a volley */ count: number; /** spread across the cone, radians, when no cone is given */ spread: number };
const NONE: AttackFx = { element: "BALLISTIC", mode: "none", count: 0, spread: 0 };

/** what to draw for an encounter attack. FAN attacks (the ranged ones) fire a volley; the Dark Knight's staff attacks cast a spell circle. */
export function attackFx(scenarioId: string, attackId: string, kind: string): AttackFx {
  const element = BOSS_ELEMENT[scenarioId];
  if (!element) return NONE;
  if (kind === "FAN") return { element, mode: "volley", count: attackId === "breath" ? 9 : 5, spread: attackId === "breath" ? 0.42 : 0.26 };
  // the Drowned Monarch has no ranged attack: its field attacks are shown as corrosive globs lobbed onto the player's area (the zones themselves are unchanged)
  if (scenarioId === "drowned-monarch" && kind === "FIELD") return { element, mode: "volley", count: 4, spread: 0.2 };
  if (scenarioId === "dark-knight" && (kind === "SLAM" || kind === "FIELD")) return { element, mode: "spell", count: 0, spread: 0 };
  return NONE;
}

/* ---------------- pooled flight (no allocation per shot) ---------------- */
export type Flight = { alive: boolean; element: Element; fx: number; fy: number; fz: number; tx: number; ty: number; tz: number; age: number; life: number; size: number };
export const createFlights = (n: number): Flight[] => Array.from({ length: n }, () => ({ alive: false, element: "BALLISTIC" as Element, fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, age: 0, life: 1, size: 1 }));

/** start one flight; reuses a dead slot, or returns null when the pool is full (a missing flourish is better than a stall) */
export function launch(pool: Flight[], element: Element, from: [number, number, number], to: [number, number, number], scale = 1): Flight | null {
  const f = pool.find((p) => !p.alive);
  if (!f) return null;
  const st = ELEMENT_STYLE[element];
  const dist = Math.max(1, Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]));
  Object.assign(f, { alive: true, element, fx: from[0], fy: from[1], fz: from[2], tx: to[0], ty: to[1], tz: to[2], age: 0, life: Math.min(2, Math.max(0.12, dist / st.speed)), size: st.size * scale });
  return f;
}
/** position of a flight at its current age (a gentle lob for acid and fire) */
export function flightAt(f: Flight, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const t = Math.min(1, f.age / f.life), lob = ELEMENT_STYLE[f.element].lob;
  out[0] = f.fx + (f.tx - f.fx) * t; out[2] = f.fz + (f.tz - f.fz) * t;
  out[1] = f.fy + (f.ty - f.fy) * t + 4 * lob * t * (1 - t);
  return out;
}
/** advance every live flight; returns how many arrived this step */
export function stepFlights(pool: Flight[], dt: number): number {
  let arrived = 0;
  for (const f of pool) { if (!f.alive) continue; f.age += dt; if (f.age >= f.life) { f.alive = false; arrived++; } }
  return arrived;
}

/** bolt aim points for a volley: evenly fanned around the aim direction, `reach` metres out from the shooter */
export function volleyTargets(from: { x: number; z: number }, aim: { x: number; z: number }, count: number, spread: number, reach: number): { x: number; z: number }[] {
  const base = Math.atan2(aim.x - from.x, aim.z - from.z);
  const len = Math.min(reach, Math.max(8, Math.hypot(aim.x - from.x, aim.z - from.z)));
  return Array.from({ length: count }, (_, i) => {
    const a = base + (count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 * spread);
    return { x: from.x + Math.sin(a) * len, z: from.z + Math.cos(a) * len };
  });
}
