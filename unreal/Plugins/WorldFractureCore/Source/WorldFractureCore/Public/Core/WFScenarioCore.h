// World Fracture — Unique Scenario rewards, the encounter journal and Vyrak's Covenant.
//
// Ports of:
//   scenario-loot.ts      grantScenarioReward (signature loot, duplicates level then convert to shards, once per run)
//   encounter-journal.ts  recordEncounterClear (discovery account-wide, completion per Operator class)
//   dragon-covenant.ts    claimCovenant, dragoniteGear, isBonded
//   dragonite.ts          recordVyrakClear, challengesMet, clearCount
//   activities.ts         markCompleted (the Vyrak rematch cooldown stamp)
// Every claim lives in the progression's EarnedRewards ledger, keyed exactly as the web build keys it, so saves agree.
#pragma once

#include "Core/WFCoreApi.h"

#include "Core/WFProgression.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::scenario
{
	inline constexpr double ParticipationHits = 5;   // player hits before a scenario kill can pay
	inline constexpr double DuplicateCapShards = 250;
	inline constexpr double ArmorLevelMax = 10;
	inline constexpr double WingsSeconds = 300;     // "Wings of the Ancient": rematch won within 5 minutes

	struct FLootChance
	{
		FGearItem Item;
		double Chance = 0;
	};

	struct FLootEntry
	{
		std::vector<FGearItem> Guaranteed;
		std::vector<FLootChance> Chance;
	};

	struct FCatalog
	{
		std::map<std::string, FLootEntry> Loot;          // SCENARIO_LOOT
		std::map<std::string, double> RewardCredits;     // UNIQUE_SCENARIOS rewardCredits (every unique scenario has an entry)
		std::map<std::string, std::string> CovenantAbility; // class -> ability id (COVENANT_ABILITY)
		bool IsUniqueScenario(const std::string& Id) const { return RewardCredits.count(Id) > 0; }
	};

	/** What a scenario kill hands to claimDrops (scenario-loot.ts ScenarioClaim). */
	struct FClaim
	{
		std::string ScenarioId;
		std::string RunId;
		bool bParticipated = false;
		std::vector<double> Rolls;       // one pre-drawn uniform per chance entry
		std::optional<double> Elapsed;   // seconds from summon to kill
		std::optional<double> Deaths;    // player deaths during the fight
	};

	enum class EGrantStatus { Granted, AlreadyClaimed, Invalid, Ineligible };
	struct FGrantResult
	{
		FProgression Progression;
		EGrantStatus Status = EGrantStatus::Invalid;
		std::vector<std::string> ItemIds; // what was granted (new, levelled or converted)
	};
	WORLDFRACTURECORE_API FGrantResult GrantScenarioReward(const FCatalog& C, FProgression P, const FClaim& Claim);

	WORLDFRACTURECORE_API FProgression RecordEncounterClear(const FCatalog& C, FProgression P, const std::optional<std::string>& Class, const std::string& EncounterId);

	WORLDFRACTURECORE_API std::vector<FGearItem> DragoniteGear(const std::string& Class);
	WORLDFRACTURECORE_API bool IsBonded(const FProgression& P, const std::optional<std::string>& Class);
	/** The Vyrak bond for the winning class: Dragonite set, 5 Dragonite, the class's covenant ability. Once per class. */
	WORLDFRACTURECORE_API FProgression ClaimCovenant(const FCatalog& C, FProgression P, const std::optional<std::string>& Class, bool& bOutBonded);

	WORLDFRACTURECORE_API std::vector<std::string> ChallengesMet(const FClaim& Claim);
	WORLDFRACTURECORE_API double ClearCount(const FProgression& P, const std::string& Class);
	/** A Vyrak clear for this class: first is the bond; later ones pay 3 Dragonite and every 2nd a rolled Covenant piece; challenges once. */
	WORLDFRACTURECORE_API FProgression RecordVyrakClear(const FCatalog& C, FProgression P, const std::optional<std::string>& Class, const std::string& RunId, const std::vector<std::string>& Challenges);

	/** activities.ts dayKeyUtc: "YYYY-MM-DD" of a UTC millisecond timestamp. */
	WORLDFRACTURECORE_API std::string DayKeyUtc(double NowMs);
	/** activities.ts markCompleted: stamps an activity's last completion (starts its cooldown). */
	WORLDFRACTURECORE_API FProgression MarkCompleted(FProgression P, const std::string& ActivityId, double NowMs);

	/** claimDrops' scenario half, in the web build's order: loot, journal clear, then Vyrak's covenant and rematch stamp. */
	WORLDFRACTURECORE_API FProgression ClaimScenario(const FCatalog& C, FProgression P, const FClaim& Claim, double NowMs);
}
