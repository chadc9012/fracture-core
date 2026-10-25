// World Fracture — the player's saved progression, shared by every core system (quests, rewards, missions).
//
// Mirrors the fields of the web build's PlayerProgression (src/game/progression.ts) that the ported rules read
// or write. One struct, so the quest engine and the reward pipeline can never disagree about materials,
// completed missions or dungeon clears. Plain standard C++; Unreal wraps it in UWFProgressionSubsystem.
//
// Per-class state in the web build is the arsenal (per-class loadouts), encounter clears and the Vyrak covenant.
// Level and XP are account-wide there, and stay account-wide here.
#pragma once

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf
{
	/** One owned item (GearItem in inventory.ts). */
	struct FGearItem
	{
		std::string Id;
		std::string Name;
		std::string Slot;    // primary | secondary | heavy | helmet | chest | gauntlets | classItem | legs | vehicle
		double Power = 0;
		double Level = 1;
		std::string Element; // KINETIC | THERMAL | CRYO | ARC | BIO
		std::string Source;
		std::optional<std::string> SetId;
		std::optional<std::string> Rarity; // LEGENDARY | EXOTIC; absent = ordinary gear

		bool operator==(const FGearItem& O) const
		{
			return Id == O.Id && Name == O.Name && Slot == O.Slot && Power == O.Power && Level == O.Level && Element == O.Element
				&& Source == O.Source && SetId == O.SetId && Rarity == O.Rarity;
		}
	};

	struct FProgression
	{
		// Story spine (quests.ts)
		std::optional<std::string> ActiveQuestId;
		std::vector<std::string> CompletedMissions;
		std::map<std::string, std::vector<double>> QuestObjectiveProgress;
		std::vector<std::string> UnlockedWorlds;
		std::map<std::string, bool> WorldFlags;
		std::string CurrentWorld;
		double CorruptionLevel = 0;

		// Currencies and loot
		double FractureShards = 0;
		std::map<std::string, double> Materials;
		std::map<std::string, double> DungeonClears;
		std::vector<FGearItem> Inventory;
		std::map<std::string, std::string> EquippedGear; // slot -> item id

		// Account level (xp.ts)
		double Level = 1;
		double Xp = 0;
		double CalibrationTokens = 0;
		double NovaLevel = 0;
		std::vector<std::string> NovaUnlocks;

		std::optional<std::string> IdentityClass; // TITAN | HUNTER | WARLOCK
		/** Difficulty picked before launch (map-activities.ts CHALLENGES): STANDARD | HARD | VERY_HARD. */
		std::string Challenge = "STANDARD";
	};
}
