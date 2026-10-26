/**
 * Records golden movement from the web build's real movement.ts and parkour.ts for the C++ port's test
 * (Plugins/WorldFractureCore/Tests/MoveCoreTest.cpp).
 *
 *   node unreal/tools/gen-goldens.mjs move
 *
 * A move state is driven through random frames; after each, its whole state is recorded.
 *   C class        a fresh state; then frames:
 *   LD | AJ | GV vy holding | SS vx vz | CS | ST dt | RS crouch sprint jump grounded sliding swimming | SN dt | PT
 *   each followed by R result  state(stance|prone|stanceDrop|airJumpsLeft|slideLeft|slideCool|slideDirX|slideDirZ|slideSpeed|drop)
 *   FV aiming sprinting sliding stance -> fov     VL speed base -> vertical|forward     CB chain since -> bonus
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createMoveState, land, airJump, glideVy, startSlide, cancelSlide, stepSlide, resolveStance, stepStance, movementFov, cameraDrop, SLIDE_MIN_SPEED, type MoveState, type Stance } from "../../src/game/movement";
import { vaultLunge, parkourChainBonus } from "../../src/game/parkour";
import type { ClassId } from "../../src/game/loadout";

const OUT = join(process.cwd(), "unreal", "Plugins", "WorldFractureCore", "Tests", "move_golden.txt");
const n = (v: number) => String(v);
const b = (v: boolean) => (v ? "1" : "0");
let seed = 0x30fe;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const lines: string[] = [];
const out = (...f: (string | number)[]) => lines.push(f.map((v) => (typeof v === "number" ? n(v) : v)).join("\t"));
const st = (s: MoveState) => [s.stance, b(s.prone), n(s.stanceDrop), n(s.airJumpsLeft), n(s.slideLeft), n(s.slideCool), n(s.slideDirX), n(s.slideDirZ), n(s.slideSpeed), n(s.drop)].join("|");

out("MIN", SLIDE_MIN_SPEED);
for (let c = 0; c < 300; c++) {
  const cls = pick(["TITAN", "HUNTER", "WARLOCK"] as ClassId[]);
  const s = createMoveState();
  out("C", cls);
  for (let k = 0; k < 60; k++) {
    const r = rand();
    let res = "";
    if (r < 0.08) { out("LD"); land(s, cls); res = "~"; }
    else if (r < 0.18) { out("AJ"); const m = airJump(s, cls); res = m === null ? "~" : n(m); }
    else if (r < 0.26) { const vy = pick([-10, -2.2, -2.3, 0, 3]), h = rand() < 0.6; out("GV", vy, b(h)); res = n(glideVy(vy, cls, h)); }
    else if (r < 0.4) { const sp = pick([0, 10, 16.79, 16.8, 20, 30]), a = rand() * 6.28; const vx = Math.sin(a) * sp, vz = Math.cos(a) * sp; out("SS", vx, vz); res = b(startSlide(s, vx, vz)); }
    else if (r < 0.45) { out("CS"); cancelSlide(s); res = "~"; }
    else if (r < 0.68) { const dt = pick([1 / 60, 0.1, 0.3, 0.9]); out("ST", dt); res = n(stepSlide(s, dt)); }
    else if (r < 0.86) {
      const i = { crouchHeld: rand() < 0.5, sprinting: rand() < 0.3, jumping: rand() < 0.15, grounded: rand() < 0.8, sliding: s.slideLeft > 0, swimming: rand() < 0.08 };
      if (rand() < 0.15) s.prone = !s.prone; // the X toggle (Scene.tsx flips state.prone itself)
      out("RS", b(i.crouchHeld), b(i.sprinting), b(i.jumping), b(i.grounded), b(i.sliding), b(i.swimming), b(s.prone)); res = resolveStance(s, i);
    }
    else if (r < 0.95) { const dt = pick([1 / 60, 0.1, 0.5]); out("SN", dt); stepStance(s, dt); res = n(cameraDrop(s)); }
    else { out("PT"); res = "~"; }
    out("R", res, st(s));
  }
}
for (const a of [false, true]) for (const sp of [false, true]) for (const sl of [false, true]) for (const stc of ["STAND", "CROUCH", "PRONE"] as Stance[]) out("FV", b(a), b(sp), b(sl), stc, movementFov(a, sp, sl, stc));
for (const sp of [0, 6, 12, 23.9, 24, 40]) for (const base of [11.4, 7]) { const l = vaultLunge(sp, base); out("VL", sp, base, `${n(l.verticalBoost)}|${n(l.forwardBoost)}`); }
for (const ch of [0, 1, 3, 4, 5, 9]) for (const t of [0, 1.39, 1.4, 1.41, 5]) out("CB", ch, t, parkourChainBonus(ch, t));
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`move golden: ${lines.length} lines -> ${OUT}`);
