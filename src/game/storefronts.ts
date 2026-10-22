/** Street-level buildings for the regional shops (pure data, no three.js). A shop's access kind
 * (shop-access.ts) decides its street presence: walk-in shops get a small solid building whose front
 * wall has a real door gap lined up with the interior door marker (interiors.ts puts that marker at
 * s.x, s.z + 3); window shops get a facade with a service window and counter; table shops keep the
 * open-air stall (ShopStalls.tsx). The renderer (Storefronts.tsx) draws exactly these rectangles and
 * registers the same segments with the wall collider, so what you see is what blocks you. */
import type { RegionalShop } from "./regional-shops";
import { shopAccessKind } from "./shop-access";
import type { Wall } from "./walls";

export const STOREFRONT = { w: 9, d: 7, h: 4.2, doorW: 2, frontZ: 2, backZ: -5 } as const;
export const WINDOW_FRONT = { w: 7, h: 3.8 } as const;

/** a wall segment from (ax,az) to (bx,bz) at street level */
const seg = (ax: number, az: number, bx: number, bz: number, base: number, top: number, half = 0.18): Wall => ({ ax, az, bx, bz, half, base, top });

/** Solid wall segments of a walk-in shop's building. Front is +z; the door gap is centred on (s.x, s.z + frontZ). */
export function storefrontWalls(s: RegionalShop, base: number): Wall[] {
  const { w, d, h, doorW, frontZ, backZ } = STOREFRONT;
  const top = base + h, x = s.x, z = s.z;
  const side = (w - doorW) / 2; // front wall piece length either side of the door
  return [
    seg(x - w / 2, z + backZ, x + w / 2, z + backZ, base, top), // back
    seg(x - w / 2, z + backZ, x - w / 2, z + frontZ, base, top), // left
    seg(x + w / 2, z + backZ, x + w / 2, z + frontZ, base, top), // right
    seg(x - w / 2, z + frontZ, x - doorW / 2, z + frontZ, base, top), // front, left of the door
    seg(x + doorW / 2, z + frontZ, x + w / 2, z + frontZ, base, top), // front, right of the door
  ];
}

/** The single facade segment of a window shop: solid across, trading happens at the counter in front of it. */
export function windowWall(s: RegionalShop, base: number): Wall {
  return seg(s.x - WINDOW_FRONT.w / 2, s.z, s.x + WINDOW_FRONT.w / 2, s.z, base, base + WINDOW_FRONT.h, 0.2);
}

/** Every wall a shop's street presence needs, by access kind (table shops have none — the stall is walk-around). */
export function shopWalls(s: RegionalShop, base: number): Wall[] {
  const kind = shopAccessKind(s.id);
  if (kind === "interior") return storefrontWalls(s, base);
  if (kind === "window") return [windowWall(s, base)];
  return [];
}
