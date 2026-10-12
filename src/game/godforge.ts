/** The Godforge (pure): Vael, the Last Forgewright, and her hidden forge under the Hollow Crown.
 *
 * Questline (no menu shortcuts; every stage is earned in the world):
 *   I   The Sealed Door   — find the three Forgewright's Marks (secrets.ts forge-mark-1..3).
 *   II  Furnace Guardian  — the Hollow Crown ruin wakes; walking in summons the Furnace Guardian; killing it drops the
 *                           Heart of the Hollow Crown (`crownHeart`, ledger `godforge:heart`).
 *   III The Godforge      — Vael stands at the forge from then on (talk with Y): forge relics, socket runes, awaken them.
 *
 * Godforged relics are weapons (GearItem.godforge). Tiers add rune sockets (Relic 1 → Sovereign 4). Runes change real
 * combat through rules sim.ts applies (bursts reuse weapon-evolution's ability rules; Devour/Rift/Ward/Reap are simple
 * multipliers). Some runes conflict, so a build is a choice, not a stack. Higher tiers widen the build; they never just
 * multiply damage without limit.
 *
 * Premium store: the architecture exists so it can be switched on later, but PREMIUM_STORE_ENABLED is false. Nothing here
 * can charge money, roll randomised paid items or sell gameplay power; the Premium tab only lists planned cosmetic offers. */
import type { EvolutionAbility } from "./weapon-evolution";
import type { GearItem, MaterialId } from "./inventory";
import { REGIONS } from "./world";
import { FORGE_MARKS, secretKey } from "./secrets";

export const PREMIUM_STORE_ENABLED = false as const;

/* ------------------------------------------------------------ the place ------------------------------------------------------------ */
const WASTES = REGIONS.find((r) => r.id === "wastelands")!;
/** the Hollow Crown: a sunken ruin in the Wastelands canyon (the third mark is scratched on its door) */
export const HOLLOW_CROWN = { x: WASTES.x + WASTES.radius * 0.12, z: WASTES.z + WASTES.radius * 0.55, radius: 14 };
export const VAEL = { x: HOLLOW_CROWN.x - 3, z: HOLLOW_CROWN.z - 4 };
export const VAEL_REACH = 3.6;
export const GUARDIAN_TAG = "godforge-guardian";
export const HEART_KEY = "godforge:heart";

export type ForgeStage = "SEALED" | "DOOR" | "GUARDIAN_SLAIN";
/** I: marks found → the door; II: the guardian slain → Vael's forge open */
export function forgeStage(p: { earnedRewards: readonly string[] }): ForgeStage {
  if (p.earnedRewards.includes(HEART_KEY)) return "GUARDIAN_SLAIN";
  return FORGE_MARKS.every((m) => p.earnedRewards.includes(secretKey(m))) ? "DOOR" : "SEALED";
}
export const marksFound = (p: { earnedRewards: readonly string[] }) => FORGE_MARKS.filter((m) => p.earnedRewards.includes(secretKey(m))).length;

/** walking into the open Hollow Crown summons the guardian (Scene asks; living-runtime spawns once per visit) */
export const guardianDue = (p: { earnedRewards: readonly string[] }, x: number, z: number) =>
  forgeStage(p) === "DOOR" && Math.hypot(x - HOLLOW_CROWN.x, z - HOLLOW_CROWN.z) < HOLLOW_CROWN.radius;
export const vaelNear = (p: { earnedRewards: readonly string[] }, x: number, z: number) =>
  forgeStage(p) === "GUARDIAN_SLAIN" && Math.hypot(x - VAEL.x, z - VAEL.z) < VAEL_REACH;

/* ------------------------------------------------------------ runes ------------------------------------------------------------ */
export type RuneId = "STORM" | "EMBER" | "FROST" | "BLOOM" | "SUN" | "DEVOUR" | "RIFT" | "WARD" | "REAP";
export type Rune = { id: RuneId; name: string; text: string; burst?: EvolutionAbility; element?: GearItem["element"]; unlock: { kind: "secret" | "nemesis" | "heart"; id?: string; count?: number; label: string } };
export const RUNES: Record<RuneId, Rune> = {
  STORM: { id: "STORM", name: "Storm Rune", text: "Every 4th hit chains lightning to 2 nearby enemies.", burst: "STORM_ARC", element: "ARC", unlock: { kind: "heart", label: "The Heart of the Hollow Crown" } },
  EMBER: { id: "EMBER", name: "Ember Rune", text: "Every 5th hit detonates a thermal burst.", burst: "EMBER_BRAND", element: "THERMAL", unlock: { kind: "secret", id: "forge-mark-2", label: "Forgewright's Mark: Ash" } },
  FROST: { id: "FROST", name: "Frost Rune", text: "+30% damage to chilled enemies; every 6th hit shatters frost.", burst: "RIME_SHATTER", element: "CRYO", unlock: { kind: "secret", id: "forge-mark-1", label: "Forgewright's Mark: Ice" } },
  BLOOM: { id: "BLOOM", name: "Bloom Rune", text: "Every 4th hit blooms corrosive spores.", burst: "ROT_BLOOM", element: "BIO", unlock: { kind: "secret", id: "drowned-bell", label: "The Drowned Bell (swamps, at night)" } },
  SUN: { id: "SUN", name: "Sun Rune", text: "Every 6th hit flares and briefly stuns nearby enemies.", burst: "SUN_FLARE", element: "THERMAL", unlock: { kind: "secret", id: "moon-shrine", label: "The Moonlit Shrine (Veridan, at night)" } },
  DEVOUR: { id: "DEVOUR", name: "Devour Rune", text: "Each hit stores energy; every 8th hit releases it for +150% damage.", unlock: { kind: "nemesis", count: 1, label: "Kill a nemesis" } },
  RIFT: { id: "RIFT", name: "Rift Rune", text: "+25% damage to elites and bosses.", unlock: { kind: "secret", id: "storm-relay", label: "The Storm Relay (Solara, in a storm)" } },
  WARD: { id: "WARD", name: "Ward Rune", text: "Take 15% less damage while it is in your hands.", unlock: { kind: "secret", id: "trophy-cairn", label: "The Trophy Cairn (Wastelands, after a nemesis kill)" } },
  REAP: { id: "REAP", name: "Reap Rune", text: "Every kill restores 6 health.", unlock: { kind: "nemesis", count: 3, label: "Kill three nemeses" } },
};
export const RUNE_ORDER: readonly RuneId[] = ["STORM", "EMBER", "FROST", "BLOOM", "SUN", "DEVOUR", "RIFT", "WARD", "REAP"];
/** pairs that cannot share a weapon */
export const CONFLICTS: readonly [RuneId, RuneId][] = [["EMBER", "FROST"], ["SUN", "BLOOM"], ["DEVOUR", "WARD"]];
export const conflictOf = (a: RuneId, runes: readonly RuneId[]) => runes.find((b) => CONFLICTS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) ?? null;

type ForgeSave = { earnedRewards: string[]; nemeses?: { status: string }[]; materials: Partial<Record<MaterialId, number>>; fractureShards: number; inventory: GearItem[]; equippedGear: Partial<Record<string, string>> };
export function runeUnlocked(p: Pick<ForgeSave, "earnedRewards" | "nemeses">, id: RuneId): boolean {
  const u = RUNES[id].unlock;
  if (u.kind === "heart") return p.earnedRewards.includes(HEART_KEY);
  if (u.kind === "secret") return p.earnedRewards.includes(secretKey(u.id!));
  return (p.nemeses ?? []).filter((n) => n.status === "SLAIN").length >= (u.count ?? 1);
}

/* ------------------------------------------------------------ relics ------------------------------------------------------------ */
export type GodTier = "RELIC" | "ASCENDANT" | "GODFORGED" | "SOVEREIGN";
export const TIERS: Record<GodTier, { label: string; sockets: number; power: number; next: GodTier | null; cost: Partial<Record<MaterialId, number>>; shards: number; requires: string; nemesesSlain: number }> = {
  RELIC: { label: "Relic", sockets: 1, power: 0, next: "ASCENDANT", cost: { forgeCatalyst: 2, crownHeart: 1 }, shards: 200, requires: "The Heart of the Hollow Crown", nemesesSlain: 0 },
  ASCENDANT: { label: "Ascendant Relic", sockets: 2, power: 40, next: "GODFORGED", cost: { forgeCatalyst: 2, runeDust: 4 }, shards: 400, requires: "One slain nemesis", nemesesSlain: 1 },
  GODFORGED: { label: "Godforged", sockets: 3, power: 80, next: "SOVEREIGN", cost: { forgeCatalyst: 3, runeDust: 8, aegisCore: 2 }, shards: 800, requires: "Three slain nemeses", nemesesSlain: 3 },
  SOVEREIGN: { label: "Sovereign Godforged", sockets: 4, power: 120, next: null, cost: { forgeCatalyst: 4, runeDust: 14, fractureCore: 1 }, shards: 1500, requires: "Five slain nemeses and a Fracture Core", nemesesSlain: 5 },
};
export const AWAKEN_KILLS = 100, AWAKEN_POWER = 30;
export type Godforged = { tier: GodTier; runes: RuneId[]; kills: number; awakened: boolean };

export type RelicDesign = { id: string; name: string; slot: "primary" | "heavy"; blurb: string };
export const RELIC_DESIGNS: readonly RelicDesign[] = [
  { id: "eclipse-devourer", name: "Eclipse Devourer", slot: "primary", blurb: "A blade-rifle that cuts through corrupted shields and keeps what it takes." },
  { id: "crownfire", name: "Crownfire", slot: "heavy", blurb: "Forged in the Hollow Crown's last fire. It remembers every war it ended." },
  { id: "stillwater", name: "Stillwater Lance", slot: "primary", blurb: "Quiet until it isn't. Vael's own weapon, before the Fracture." },
];

export type ForgeResult<P> = { progression: P; message: string } | { error: string };
const slainCount = (p: Pick<ForgeSave, "nemeses">) => (p.nemeses ?? []).filter((n) => n.status === "SLAIN").length;
function pay<P extends ForgeSave>(p: P, cost: Partial<Record<MaterialId, number>>, shards: number): P | string {
  for (const [k, v] of Object.entries(cost) as [MaterialId, number][]) if ((p.materials[k] ?? 0) < v) return `Needs ${v} ${k} (you have ${p.materials[k] ?? 0})`;
  if (p.fractureShards < shards) return `Needs ${shards} fracture shards (you have ${p.fractureShards})`;
  const materials = { ...p.materials };
  for (const [k, v] of Object.entries(cost) as [MaterialId, number][]) materials[k] = (materials[k] ?? 0) - v;
  return { ...p, materials, fractureShards: p.fractureShards - shards };
}

/** Forge a new Relic (1 socket). The first costs the Heart; the Heart is consumed. */
export function forgeRelic<P extends ForgeSave>(p: P, designId: string, now = Date.now()): ForgeResult<P> {
  if (forgeStage(p) !== "GUARDIAN_SLAIN") return { error: "The forge is cold. Bring Vael the Heart of the Hollow Crown." };
  const d = RELIC_DESIGNS.find((x) => x.id === designId);
  if (!d) return { error: "Unknown design" };
  if (p.inventory.some((i) => i.godforge && i.name === d.name)) return { error: `You already carry ${d.name}` };
  const paid = pay(p, TIERS.RELIC.cost, TIERS.RELIC.shards);
  if (typeof paid === "string") return { error: paid };
  const item: GearItem = { id: `god-${d.id}-${now.toString(36)}`, name: d.name, slot: d.slot, power: 300, level: 1, element: "KINETIC", source: "Forged by Vael · Hollow Crown", rarity: "EXOTIC", godforge: { tier: "RELIC", runes: [], kills: 0, awakened: false } };
  return { progression: { ...paid, inventory: [...paid.inventory, item] }, message: `${d.name} forged. Vael: "It is yours. Give it a rune and it will answer."` };
}

const withGod = <P extends ForgeSave>(p: P, id: string, f: (i: GearItem) => GearItem): P => ({ ...p, inventory: p.inventory.map((i) => (i.id === id ? f(i) : i)) });
const relicOf = (p: ForgeSave, id: string) => p.inventory.find((i) => i.id === id && i.godforge);

/** element follows the first burst rune (so the weapon looks and hits like its runes); otherwise kinetic */
export const relicElement = (runes: readonly RuneId[]): GearItem["element"] => runes.map((r) => RUNES[r].element).find(Boolean) ?? "KINETIC";

export function socketRune<P extends ForgeSave>(p: P, itemId: string, rune: RuneId): ForgeResult<P> {
  const item = relicOf(p, itemId);
  if (!item?.godforge) return { error: "Not a Godforged relic" };
  const g = item.godforge;
  if (!runeUnlocked(p, rune)) return { error: `${RUNES[rune].name} is not yours yet: ${RUNES[rune].unlock.label}` };
  if (g.runes.includes(rune)) return { error: "Already socketed" };
  if (g.runes.length >= TIERS[g.tier].sockets) return { error: `${TIERS[g.tier].label} has ${TIERS[g.tier].sockets} socket${TIERS[g.tier].sockets > 1 ? "s" : ""}. Ascend it for more.` };
  const clash = conflictOf(rune, g.runes);
  if (clash) return { error: `${RUNES[rune].name} rejects ${RUNES[clash].name}` };
  const runes = [...g.runes, rune];
  return { progression: withGod(p, itemId, (i) => ({ ...i, element: relicElement(runes), godforge: { ...g, runes } })), message: `${RUNES[rune].name} bound to ${item.name}` };
}

export function removeRune<P extends ForgeSave>(p: P, itemId: string, rune: RuneId): ForgeResult<P> {
  const item = relicOf(p, itemId);
  if (!item?.godforge || !item.godforge.runes.includes(rune)) return { error: "Not socketed" };
  const runes = item.godforge.runes.filter((r) => r !== rune);
  return { progression: withGod(p, itemId, (i) => ({ ...i, element: relicElement(runes), godforge: { ...item.godforge!, runes } })), message: `${RUNES[rune].name} released` };
}

/** Ascend to the next tier: one more socket, more power, +1 level (so cloud merges keep the higher tier). */
export function ascendRelic<P extends ForgeSave>(p: P, itemId: string): ForgeResult<P> {
  const item = relicOf(p, itemId);
  if (!item?.godforge) return { error: "Not a Godforged relic" };
  const next = TIERS[item.godforge.tier].next;
  if (!next) return { error: "Already Sovereign" };
  const t = TIERS[next];
  if (slainCount(p) < t.nemesesSlain) return { error: `${t.label} needs ${t.requires.toLowerCase()} (${slainCount(p)}/${t.nemesesSlain})` };
  const paid = pay(p, t.cost, t.shards);
  if (typeof paid === "string") return { error: paid };
  return { progression: withGod(paid, itemId, (i) => ({ ...i, level: i.level + 1, power: i.power + (t.power - TIERS[item.godforge!.tier].power), godforge: { ...i.godforge!, tier: next } })), message: `${item.name} is now ${t.label}` };
}

/** Mastery: kills with the relic in hand; at AWAKEN_KILLS it awakens (+power) once. */
export function recordRelicKills<P extends ForgeSave>(p: P, itemId: string, kills: number): { progression: P; message?: string } {
  const item = relicOf(p, itemId);
  if (!item?.godforge || kills <= 0) return { progression: p };
  const g = item.godforge, total = g.kills + kills;
  const awaken = !g.awakened && total >= AWAKEN_KILLS;
  const next = withGod(p, itemId, (i) => ({ ...i, power: i.power + (awaken ? AWAKEN_POWER : 0), godforge: { ...g, kills: total, awakened: g.awakened || awaken } }));
  return awaken ? { progression: next, message: `${item.name} awakens. Vael would be proud.` } : { progression: next };
}

/** Rune dust: every slain nemesis and every secret leaves some behind (derived, so it can never be farmed twice). */
export function runeDustEarned(p: Pick<ForgeSave, "earnedRewards" | "nemeses">): number {
  return 2 * slainCount(p) + p.earnedRewards.filter((k) => k.startsWith("secret:")).length;
}
/** Collect the dust you have earned but not yet taken (ledger counts what was collected). */
export function collectRuneDust<P extends ForgeSave>(p: P): ForgeResult<P> {
  const taken = p.earnedRewards.filter((k) => k.startsWith("godforge:dust:")).length;
  const owed = runeDustEarned(p) - taken;
  if (owed <= 0) return { error: "Vael has no dust for you. Kill a nemesis or find a secret." };
  const keys = Array.from({ length: owed }, (_, i) => `godforge:dust:${taken + i + 1}`);
  return { progression: { ...p, materials: { ...p.materials, runeDust: (p.materials.runeDust ?? 0) + owed }, earnedRewards: [...p.earnedRewards, ...keys] }, message: `+${owed} rune dust` };
}

/** Combat rules for the relic in hand (sim.ts reads these once per frame through Scene). */
export type RuneCombat = { bursts: EvolutionAbility[]; devour: boolean; rift: boolean; ward: boolean; reap: boolean; awakened: boolean };
export const NO_RUNES: RuneCombat = { bursts: [], devour: false, rift: false, ward: false, reap: false, awakened: false };
export function runeCombat(g: Godforged | undefined): RuneCombat {
  if (!g) return NO_RUNES;
  return { bursts: g.runes.map((r) => RUNES[r].burst).filter((b): b is EvolutionAbility => !!b), devour: g.runes.includes("DEVOUR"), rift: g.runes.includes("RIFT"), ward: g.runes.includes("WARD"), reap: g.runes.includes("REAP"), awakened: g.awakened };
}
export const DEVOUR_EVERY = 8, DEVOUR_MULT = 2.5, RIFT_MULT = 1.25, WARD_MULT = 0.85, REAP_HEAL = 6, AWAKENED_MULT = 1.1;

/* ------------------------------------------------------------ premium (disabled) ------------------------------------------------------------ */
/** Planned optional offers, shown greyed-out. Cosmetic only, contents fully listed, no random rolls, no gameplay power. */
export const PREMIUM_PLANNED: readonly { name: string; contents: string }[] = [
  { name: "Rune Glow Pack", contents: "Alternate glow colours for socketed runes (cosmetic)" },
  { name: "Godforge Appearance Bundle", contents: "Obsidian-and-gold finish for all three relic designs, matching forge sparks (cosmetic)" },
  { name: "Sovereign Bundle", contents: "Sovereign-tier visual effects and a title (cosmetic; the tier itself is earned in play)" },
];
export function premiumPurchase(): { error: string } {
  return { error: "The premium store is not available yet. Nothing can be bought." };
}

/** The Furnace Guardian fell: the Heart of the Hollow Crown, once. */
export function claimHeart<P extends ForgeSave>(p: P): ForgeResult<P> {
  if (p.earnedRewards.includes(HEART_KEY)) return { error: "Already claimed" };
  return { progression: { ...p, materials: { ...p.materials, crownHeart: (p.materials.crownHeart ?? 0) + 1 }, earnedRewards: [...p.earnedRewards, HEART_KEY] }, message: "The Heart of the Hollow Crown is yours. Vael waits at the forge." };
}
