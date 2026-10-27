/** Which difficulty tier the next raid launch will fight on (pure state + helpers). The Director's Raid tab sets it just before
 * deploying; the arena reads it when the boss wakes (Astravore's health scales by the tier's `bossHealthScale`) and the kill reads it
 * to pay that tier's clear (hollow-star-raid.ts `applyAstravoreKill`). A tier that is not unlocked falls back to Normal, so a stale or
 * hand-set value can never pay a tier the player has not opened. */
import { RAID_TIERS, tierById } from "./difficulty-ladder";

let selected = RAID_TIERS[0]!.id;
export const setRaidLaunchTier = (tierId: string) => { selected = tierById("raid", tierId).id; };
export const getRaidLaunchTier = () => selected;
/** the multiplier on the boss's health for a tier */
export const raidBossHealthScale = (tierId: string) => tierById("raid", tierId).bossHealthScale;
/** the multiplier on the damage the player takes while fighting the boss on a tier: a quarter of the health bump (Heroic ×1.15, Mastery ×1.35, Contest ×1.6) */
export const raidBossDamageScale = (tierId: string) => 1 + (raidBossHealthScale(tierId) - 1) * 0.25;
