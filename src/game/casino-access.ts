/** Casino access geometry shared by the tower and the existing Scene movement system.
 * Player height uses a 1.6-unit eye/body offset in Scene. */
import { NEON_FLAT } from "@/game/world";
import { walkHeight } from "@/game/terrain";
export const casinoLevels = [
 { id: "lobby", label: "Lobby", elevation: 0 },
 { id: "gallery", label: "Event Gallery", elevation: 11.5 },
 { id: "skydeck", label: "Sky Deck", elevation: 160.5 },
] as const;
export function casinoLocation(center: { x:number; z:number }) {
 const x = center.x - NEON_FLAT * 0.49, z = center.z + NEON_FLAT * 0.36;
 return { x, z, baseY: walkHeight(x,z) };
}
export function casinoFloorAt(x:number,z:number,y:number,center:{x:number;z:number}) {
 const p=casinoLocation(center), dx=x-p.x, dz=z-p.z;
 if (Math.abs(dx)>20 || Math.abs(dz)>28) return -Infinity;
 const inLift=Math.abs(dx)<7 && Math.abs(dz+21.7)<6;
 if (inLift && y>p.baseY+155 && y<p.baseY+170) return p.baseY+160.5;
 if (inLift && y>p.baseY+9 && y<p.baseY+19) return p.baseY+11.5;
 // Only catch a player already at the destination level, not someone underneath it.
 if (y>p.baseY+155 && y<p.baseY+170 && Math.hypot(dx,dz+7)<19) return p.baseY+160.5;
 if (y>p.baseY+9 && y<p.baseY+19 && Math.abs(dx)<15 && dz>5 && dz<28) return p.baseY+11.5;
 return -Infinity;
}
export function casinoElevatorNear(x:number,z:number,center:{x:number;z:number}) {
 const p=casinoLocation(center);
 return Math.abs(x-p.x)<7 && Math.abs(z-(p.z-21.7))<6;
}
