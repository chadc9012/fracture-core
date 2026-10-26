// World Fracture — the player's saved progression, shared by every core system (quests, rewards, missions).
//
// Mirrors the fields of the web build's PlayerProgression (src/game/progression.ts) that the ported rules read
// or write. One struct, so the quest engine and the reward pipeline can never disagree about materials,
// completed missions or dungeon clears. Plain standard C++; Unreal wraps it in UWFProgressionSubsystem.
//
// Per-class state in the web build is the arsenal (per-class loadouts), encounter clears, the Vyrak covenant, and each
// operator's pocket (operator-pockets.ts): level, XP, Nex, fracture shards and materials. The live fields (Level, Xp,
// Materials, FractureShards and the Nex balance) belong to PocketClass; the other operators wait in Operators.
#pragma once

#include "Core/WFCoreApi.h"

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
		/** The equipped class abilities (activeBuild: mode + slots PRIMARY / TACTICAL / ULTIMATE -> ability id; account-wide
		 *  as in the web build) and the evolution branch picked per ability (abilityBranches). */
		std::string ActiveBuildMode = "HYBRID";
		std::map<std::string, std::string> ActiveBuildSlots{{"PRIMARY", "siege-mode"}, {"TACTICAL", "rift-dash"}, {"ULTIMATE", "rift-turret"}};
		std::map<std::string, std::string> AbilityBranches;
		/** Living World (living-world.ts): city faction standing (gain / loss counters per faction), district outcomes,
		 *  contracts and intel. Standing gates and prices the city shops. */
		struct FLiving
		{
			std::map<std::string, double> Gain, Loss;
			struct FDistrict { double SecuredAt = 0, FallenAt = 0; };
			std::map<std::string, FDistrict> Districts;
			struct FContract { double Progress = 0, AcceptedAt = 0; };
			std::map<std::string, FContract> Contracts;
			std::vector<std::string> Intel;
		};
		FLiving Living;
		/** fleet.ts FleetState: owned fleet builds, owned garage bases, tuning levels, paint, the active build, cosmetics. */
		struct FFleet
		{
			std::vector<std::string> Owned, Garages;
			std::map<std::string, std::map<std::string, double>> Tuning; // build -> node -> level
			std::map<std::string, std::string> Paint;
			std::optional<std::string> Active;
			struct FCosmetics { std::string Wheels = "standard", Body = "stock", Spoiler = "none", Armor = "stock", Glow = "off"; };
			std::map<std::string, FCosmetics> Cosmetics;
		};
		FFleet Fleet;
		/** housing.ts HousingState: placed decor per home ("roomIndex:slot" -> decor id), the home you live in, and which
		 *  fleet build is parked at which residence ("" = taken out again). Ownership lives in the Nex ledger. */
		struct FHousing
		{
			std::map<std::string, std::map<std::string, std::string>> Placed;
			std::optional<std::string> Home;
			std::map<std::string, std::string> Parked;
		};
		FHousing Housing;
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
		/** the equipped monoblade (foundries.ts activeBlade: used only while blade:<id> is owned) */
		std::optional<std::string> Blade;

		/** One operator's own progress and money (operator-pockets.ts OperatorPocket). */
		struct FOperatorPocket
		{
			double Level = 1;
			double Xp = 0;
			double Nex = 0;
			double FractureShards = 120;
			std::map<std::string, double> Materials;
			bool operator==(const FOperatorPocket& O) const { return Level == O.Level && Xp == O.Xp && Nex == O.Nex && FractureShards == O.FractureShards && Materials == O.Materials; }
		};
		/** whose values the live fields hold */
		std::string PocketClass = "TITAN";
		/** TITAN / HUNTER / WARLOCK: the stored pockets (the played operator's entry is refreshed when it is switched away) */
		std::map<std::string, FOperatorPocket> Operators = { { "TITAN", {} }, { "HUNTER", {} }, { "WARLOCK", {} } };
		/** Difficulty picked before launch (map-activities.ts CHALLENGES): STANDARD | HARD | VERY_HARD. */
		std::string Challenge = "STANDARD";
	};
}
