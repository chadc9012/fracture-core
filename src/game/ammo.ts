/** Ammo resupply (pure). Before this, the only way to get ammo back was the RESUPPLY stratagem, so a player who never learned
 * the call-in codes ran permanently dry (live play-check: the auto rifle sat at 0/0 in the middle of a vault defense).
 *
 *   - Respawn restocks every weapon.
 *   - Each player kill refunds part of a magazine into the equipped weapon's reserve (at least one round, so launchers too).
 *   - Safe zones, sanctuaries and supply points (the Legion crate at the vault gate) top reserves up over a few seconds.
 * Reserves never exceed the weapon's starting reserve, and magazines are never filled directly (you still reload). */
import { WEAPONS, type AmmoState, type WeaponId } from "./weapons";
import { VAULT_GATE } from "./wasteland-activities";

export const KILL_REFUND = 0.35; // fraction of a magazine per player kill
export const RESTOCK_SECONDS = 2; // a safe zone fills an empty reserve in this long
/** places that hand out ammo (outside safe zones) */
export const SUPPLY_POINTS: readonly { id: string; x: number; z: number; radius: number }[] = [{ id: "vault-gate", x: VAULT_GATE.x, z: VAULT_GATE.z, radius: VAULT_GATE.radius }];

const usesAmmo = (id: WeaponId) => WEAPONS[id].mag > 0;

export function restockAll(ammo: AmmoState): AmmoState {
  const next = { ...ammo };
  for (const id of Object.keys(ammo) as WeaponId[]) if (usesAmmo(id)) next[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  return next;
}

/** reserve refund for `kills` player kills with `id` equipped */
export function killRefund(ammo: AmmoState, id: WeaponId, kills: number): AmmoState {
  if (kills <= 0 || !usesAmmo(id) || !ammo[id]) return ammo;
  const def = WEAPONS[id], clip = ammo[id];
  const reserve = Math.min(def.reserve, clip.reserve + kills * Math.max(1, Math.ceil(def.mag * KILL_REFUND)));
  return reserve === clip.reserve ? ammo : { ...ammo, [id]: { ...clip, reserve } };
}

/** top up every reserve while standing somewhere safe; fractional rounds carry in `carry` so slow refills still land */
export function trickleRestock(ammo: AmmoState, dt: number, carry: Partial<Record<WeaponId, number>>): AmmoState {
  let next = ammo;
  for (const id of Object.keys(ammo) as WeaponId[]) {
    if (!usesAmmo(id)) continue;
    const def = WEAPONS[id], clip = next[id];
    if (clip.reserve >= def.reserve) { carry[id] = 0; continue; }
    const acc = (carry[id] ?? 0) + (def.reserve / RESTOCK_SECONDS) * dt;
    const whole = Math.floor(acc);
    carry[id] = acc - whole;
    if (whole > 0) next = { ...next, [id]: { ...clip, reserve: Math.min(def.reserve, clip.reserve + whole) } };
  }
  return next;
}

export const atSupplyPoint = (x: number, z: number) => SUPPLY_POINTS.some((p) => Math.hypot(x - p.x, z - p.z) <= p.radius);
