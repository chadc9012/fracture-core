/** Vehicle surface finish: which part of a car a GLB material is (by its name, with a colour fallback), and how each
 * part should look per render tier. Pure data so it is testable; VehicleFinish.ts applies it to three.js materials.
 * Works for any car kit: authored bodies name their materials (InterceptorPaint, Glass, Chrome...), CC0 kits use
 * names like paintRed / window / carTire / lightFront. Anything unrecognised is left exactly as it was. */
import type { RenderTier } from "./performance";

export type CarPart = "paint" | "glass" | "chrome" | "metal" | "rubber" | "lamp" | "other";

export function classifyCarMaterial(name: string): CarPart {
  const n = name.toLowerCase();
  if (/light|lamp|indicator|beacon|siren/.test(n)) return "lamp";
  if (/glass|window|windshield|windscreen|visor/.test(n)) return "glass";
  if (/tyre|tire|rubber/.test(n)) return "rubber";
  if (/chrome|mirror|exhaust|hub/.test(n)) return "chrome";
  if (/steel|metal|rim|grille|grill/.test(n)) return "metal";
  if (/paint|body|car|shell|panel/.test(n)) return "paint";
  return "other";
}

/** what each part becomes; `clearcoat` only where the tier pays for the extra lobe */
export type Finish = { metalness?: number; roughness?: number; clearcoat?: number; clearcoatRoughness?: number; envMapIntensity?: number; tint?: string };

export function finishFor(part: CarPart, tier: RenderTier): Finish | null {
  const rich = tier === "HIGH" || tier === "ULTRA";
  switch (part) {
    // car paint: a glossy lacquer over a slightly metallic base; on LOW keep the kit's own look
    case "paint": return tier === "LOW" ? null : rich
      ? { metalness: 0.45, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 }
      : { metalness: 0.4, roughness: 0.32, envMapIntensity: 1.1 };
    // tinted glass: opaque (no interiors to show), near-black and mirror-smooth so it reflects the sky
    case "glass": return { metalness: 0.9, roughness: 0.04, envMapIntensity: 1.6, tint: "#0d161c", ...(rich ? { clearcoat: 1, clearcoatRoughness: 0 } : {}) };
    case "chrome": return { metalness: 1, roughness: 0.12, envMapIntensity: 1.4 };
    case "metal": return { metalness: 0.75, roughness: 0.38 };
    case "rubber": return { metalness: 0, roughness: 0.92, envMapIntensity: 0.3 };
    default: return null;
  }
}
