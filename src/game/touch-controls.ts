import { normalizeBindings, type Bindings } from "./bindings";

/** Touch actions share the keyboard path, including saved remaps. */
export function touchCodes(bindings?: Bindings) {
  const b = normalizeBindings(bindings).keyboard;
  return { jump: "KeyC", dash: "ShiftRight", use: "KeyY", vehicle: "KeyV", primary: "KeyQ", tactical: "KeyE", ultimate: "KeyR", reload: b.reload, next: b.nextWeapon, crouch: b.crouch, prone: b.prone, map: b.map };
}
export function stickCodes(dx: number, dy: number): string[] {
  const out: string[] = [];
  if (dy < -14) out.push("KeyW"); if (dy > 14) out.push("KeyS");
  if (dx < -14) out.push("KeyA"); if (dx > 14) out.push("KeyD");
  if (Math.hypot(dx, dy) > 52) out.push("ShiftLeft");
  return out;
}