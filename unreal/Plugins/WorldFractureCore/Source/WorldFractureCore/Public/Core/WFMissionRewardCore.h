// World Fracture — mission payouts.
//
// Port of the web build's authoritative mission reward path:
//   progression.ts rewardMission / missionBox      -> RewardMission
//   retention.ts repeatRewardFactor / sideRewardFactor
//   upgrade-gates.ts FIRST_CLEAR_SPECIAL, armor-collections.ts collectionReward (bad-luck protection)
//   weapon-loot.ts completionWeapon / campaignExotic / backfillCampaignExotics
//   missions/persistence.ts applyMissionCompletion (the once-only gate and per-mission materials + quest event)
// Golden-tested against those functions (Tests/MissionRewardCoreTest.cpp).
//
// Not ported: the saved mid-mission run (activeMissions) that applyMissionCompletion also clears.
#pragma once

#include "Core/WFCoreApi.h"

#include "Core/WFProgression.h"
#include "Core/WFRewardCore.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::missionreward
{
	/** A weapon of the catalogue that a story mission's first clear grants as its signature exotic. */
	struct FExotic
	{
		std::string WeaponId;  // catalogue id: the item id is exotic:<WeaponId>
		std::string Name;
		std::string Slot;
		std::string Element;
		std::string Source;    // catalogue source text: the item source is "Exotic · <Source>"
	};

	struct FCollection
	{
		std::string SetId;
		std::vector<std::string> Sources; // LootActivity values: patrol, story, elite, ...
	};

	/** What a scenario-machine mission pays on completion and the quest event it fires (persistence.ts COMPLETION). */
	struct FCompletion
	{
		std::map<std::string, double> Materials;
		std::string EventType; // MISSION_COMPLETE | BOSS_DEFEATED
		std::string EventId;   // missionId or encounterId
	};

	struct FCatalog
	{
		std::vector<reward::FWeaponTemplate> CompletionPool; // weapon-loot.ts DROPPABLE, in order
		std::vector<std::string> Campaign;                   // story missions in campaign order (weapon power ladder)
		std::map<std::string, FExotic> CampaignExotics;      // mission id -> exotic
		std::vector<FCollection> Collections;                // armor-collections.ts COLLECTIONS, in order
		std::vector<std::string> StoryMissions;              // pay NEX 1000 instead of 100
		std::map<std::string, FCompletion> Completions;      // the twelve mission machines
	};

	inline constexpr double StoryNex = 1000;
	inline constexpr double OtherNex = 100;
	inline constexpr double PityRuns = 3;

	WORLDFRACTURECORE_API bool IsSideContract(const std::string& MissionId);
	WORLDFRACTURECORE_API double RepeatRewardFactor(double RunsToday, bool bFirstEver);
	WORLDFRACTURECORE_API double SideRewardFactor(double RunsToday, bool bFirstEver);
	WORLDFRACTURECORE_API double MissionWeaponPower(const FCatalog& C, const std::string& MissionId);
	WORLDFRACTURECORE_API FGearItem CompletionWeapon(const FCatalog& C, const std::string& Source, const std::string& Key);
	WORLDFRACTURECORE_API std::optional<FGearItem> CampaignExotic(const FCatalog& C, const std::string& MissionId);
	WORLDFRACTURECORE_API std::optional<reward::FSetDrop> CollectionReward(const FCatalog& C, const std::string& Activity, const std::string& Key, double Run, bool bFirstClear);

	/** progression.ts rewardMission. NowMs picks the UTC day for the repeat counter and the NEX ledger key. */
	WORLDFRACTURECORE_API FProgression RewardMission(const reward::FCatalog& Rewards, const FCatalog& C, FProgression P, const std::string& MissionId, const std::map<std::string, double>& Materials, double NowMs);

	struct FCompletionResult
	{
		FProgression Progression;
		bool bPaid = false;                 // false: already completed, nothing paid
		std::optional<FCompletion> QuestEvent; // the caller feeds it to the quest chain (quests.ts gameTick) after the payout
	};
	/** persistence.ts applyMissionCompletion minus the quest tick, which the caller applies with the returned event. */
	WORLDFRACTURECORE_API FCompletionResult ApplyMissionCompletion(const reward::FCatalog& Rewards, const FCatalog& C, FProgression P, const std::string& MissionId, double NowMs);

	/** Stable text for tests: reward::DescribeLoot plus completed missions, NEX ledger and the last mission reward. */
	WORLDFRACTURECORE_API std::string Describe(const FProgression& P);
}
