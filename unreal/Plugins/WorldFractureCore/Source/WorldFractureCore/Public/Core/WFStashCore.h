// World Fracture — the account stash: consumables (field stims and Ruin Stones), their timed buffs, and gear upkeep.
//
// Collectibles (data chips, energy tokens, relic fragments) craft Ruin Stones and field stims. Stims carry in stacks of at most
// 3; using one adds a stack (max 3) and refreshes its timer: Armor Stim +10% resistance a stack for 60 s, Heal Stim +5 health a
// second a stack for 30 s, the Ruin Stone's Ruin Surge +15% combat damage a stack for 45 s. Duplicate gear sells for fracture
// shards; spare gear dismantles into gear parts, which upgrade weapons and armor; the vault keeps gear out of the carried
// inventory. Removed gear leaves a gone:<id> tombstone in earnedRewards.
//
// Port of the web build's authoritative rules in stash.ts: STACK_CAP, VAULT_CAP, STIMS, RUIN_STONE_RECIPE, RUIN_SURGE, grant,
// craftRuinStone, craftStim, useStim, visibleConsumables, buffEffect, isDuplicate, canSellDuplicate, sellValue,
// dismantleParts, sellDuplicate, dismantle, partsCost, upgradeWithParts, inVault, toVault, fromVault.
// Golden-tested (Tests/StashCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <map>
#include <string>
#include <utility>
#include <vector>

namespace wf::stash
{
	inline constexpr double StackCap = 3, VaultCap = 150;
	struct FConsumable { std::string Id, Name; double Seconds = 0; std::string Blurb; std::vector<std::pair<std::string, double>> Recipe; };
	/** armorStim, healStim, then ruinStone (its recipe is the Ruin Stone's) */
	WORLDFRACTURECORE_API const std::vector<FConsumable>& Consumables();
	WORLDFRACTURECORE_API const FConsumable* ConsumableById(const std::string& Id);
	inline bool IsStim(const std::string& Id) { return Id == "armorStim" || Id == "healStim"; }
	inline constexpr double RuinSurgePerStack = 0.15;

	/** add to the account; stims never exceed 3 */
	WORLDFRACTURECORE_API void Grant(FProgression& P, const std::string& Id, double N);
	/** false (nothing changed) without the materials */
	WORLDFRACTURECORE_API bool CraftRuinStone(FProgression& P);
	/** false when already carrying 3 or without the materials */
	WORLDFRACTURECORE_API bool CraftStim(FProgression& P, const std::string& StimId);

	struct FBuff { double Stacks = 0, Until = 0; };
	using FBuffs = std::map<std::string, FBuff>;
	/** use one: spends it, adds a stack (max 3) and refreshes the timer; false when none is carried or the buff is at 3 stacks */
	WORLDFRACTURECORE_API bool UseStim(FProgression& P, FBuffs& Buffs, const std::string& Id, double NowMs);
	/** the HUD's slots: the stims always, the Ruin Stone once one is carried or its surge is running */
	WORLDFRACTURECORE_API std::vector<std::string> VisibleConsumables(const std::map<std::string, double>& Materials, const FBuffs& Buffs, double NowMs);
	struct FBuffEffect { double Resist = 0, Regen = 0, DamageMult = 1; };
	WORLDFRACTURECORE_API FBuffEffect BuffEffect(const FBuffs& Buffs, double NowMs);

	// ---- gear upkeep ----
	WORLDFRACTURECORE_API bool IsDuplicate(const FProgression& P, const FGearItem& Item);
	WORLDFRACTURECORE_API bool InVault(const FProgression& P, const std::string& Id);
	WORLDFRACTURECORE_API bool CanSellDuplicate(const FProgression& P, const FGearItem& Item);
	WORLDFRACTURECORE_API double SellValue(const FGearItem& Item);
	WORLDFRACTURECORE_API double DismantleParts(const FGearItem& Item);
	inline double PartsCost(const FGearItem& Item) { return 3 * Item.Level; }
	/** only duplicates trade; equipped, favorited and starter gear are refused. False when nothing changed. */
	WORLDFRACTURECORE_API bool SellDuplicate(FProgression& P, const std::string& Id);
	WORLDFRACTURECORE_API bool Dismantle(FProgression& P, const std::string& Id);
	/** +1 level and +15 power for 3 gear parts a level (armor stops at its level cap) */
	WORLDFRACTURECORE_API bool UpgradeWithParts(FProgression& P, const std::string& Id);
	WORLDFRACTURECORE_API bool ToVault(FProgression& P, const std::string& Id);
	WORLDFRACTURECORE_API void FromVault(FProgression& P, const std::string& Id);
}
