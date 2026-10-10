/** Compass maths shared by the HUD strip, the minimap and the atlas. One convention everywhere:
 * the map's top is NORTH and north is world -z; east is world +x (so the painted map and the compass always agree).
 * The player's forward vector is (sin yaw, cos yaw) (Scene.tsx), so yaw 0 faces +z = SOUTH. */
export const CARDINALS8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Cardinal8 = (typeof CARDINALS8)[number];

const mod360 = (d: number) => ((d % 360) + 360) % 360;
/** compass heading in degrees [0,360): 0 = north, 90 = east, 180 = south, 270 = west */
export const headingFromYaw = (yaw: number) => mod360(180 - (yaw * 180) / Math.PI);
export const cardinalOf = (heading: number): Cardinal8 => CARDINALS8[Math.round(mod360(heading) / 45) % 8]!;
/** compass heading of the direction from (px,pz) to (tx,tz) */
export const headingTo = (px: number, pz: number, tx: number, tz: number) => mod360((Math.atan2(tx - px, -(tz - pz)) * 180) / Math.PI);
/** signed degrees from the player's heading to a target heading, in (-180, 180]; positive = to the right */
export const relativeDeg = (targetHeading: number, heading: number) => { const r = mod360(targetHeading - heading); return r > 180 ? r - 360 : r; };
/** "NE 045°" */
export const headingLabel = (heading: number) => `${cardinalOf(heading)} ${String(Math.round(mod360(heading)) % 360).padStart(3, "0")}°`;
