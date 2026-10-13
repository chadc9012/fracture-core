import type { BootId } from "./skate-boots";
import { CLASS_BULK } from "./armor-pieces";
import type { ClassId } from "./loadout";

/** Four custom sci-fi attachments; dimensions in metres, reference rig 1.85 m. */
export function skateDesign(id: BootId, cls: ClassId) {
  const k = CLASS_BULK[cls];
  return { width: 0.14 * k, length: 0.27, wheelRadius: id === "street" ? 0.035 : id === "grind" ? 0.046 : 0, rail: id === "grind", wings: id === "sky", turbines: id === "rocket" };
}