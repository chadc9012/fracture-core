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
		std::optional<std::string> Perk;   // unique weapon perk, e.g. NULL_DISRUPTION

		bool operator==(const FGearItem& O) const
		{
			return Id == O.Id && Name == O.Name && Slot == O.Slot && Power == O.Power && Level == O.Level && Element == O.Element
				&& Source == O.Source && SetId == O.SetId && Rarity == O.Rarity && Perk == O.Perk;
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

		/** The claim ledger (earnedRewards): one-time keys such as scenario-run:<id>, enc-done:<CLASS>:<id>,
		 *  covenant:vyrak:<CLASS>, dragonite-up:<CLASS>:<ability>:<n>. Order is kept. */
		std::vector<std::string> EarnedRewards;
		std::vector<std::string> UnlockedAbilities;
		/** Per-activity / per-mission run records (missionRuns): day key, runs that day, last completion (ms since epoch). */
		struct FRunRecord
		{
			std::string Day;
			double Count = 0;
			std::optional<double> Last;
			bool operator==(const FRunRecord& O) const { return Day == O.Day && Count == O.Count && Last == O.Last; }
		};
		std::map<std::string, FRunRecord> MissionRuns;

		/** NEX currency as a ledger of signed entries (nex.ts): balance = max(0, sum). Keys like mission:<id>:<day>:<run>. */
		std::map<std::string, double> NexLedger;
		/** The last mission payout, for the reward screen (progression.ts MissionReward). */
		struct FMissionReward
		{
			std::string MissionId;
			double Factor = 1;
			bool bFirstClear = false;
			double Xp = 0;
			std::map<std::string, double> Materials;
			std::string BoxRarity; // COMMON | RARE | EPIC
			std::map<std::string, double> BoxMaterials;
		};
		std::optional<FMissionReward> LastMissionReward;

		std::optional<std::string> IdentityClass; // TITAN | HUNTER | WARLOCK
		/** Difficulty picked before launch (map-activities.ts CHALLENGES): STANDARD | HARD | VERY_HARD. */
		std::string Challenge = "STANDARD";
	};
}
