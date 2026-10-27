// World Fracture — strikes and World Boss raids.
//
// Strikes: short three-stage fireteam missions (an approach, a push and a boss) on the strike difficulty ladder (Standard → Hero →
// Legend → Master). A run is the shared encounter engine: every objective step adds hazard, a checkpoint eases it, shared lives run
// out, 100 hazard wipes the fireteam. Each tier lengthens the stages and is tuned so flawless play peaks at the tier's hazard.
// One strike each week is the Ordeal (x1.5 from Hero up). One payout per strike, per tier, per day, per operator.
//
// World Boss raids: every 40 minutes a region's titan rises for 15 minutes at an open site in that region; four times the region
// boss's health; felling it pays once per raid (ledger key worldboss:<raid id>).
//
// Port of the web build's authoritative rules:
//   raid-stages.ts        createEncounterRun, advanceEncounter, chooseEncounterRoute, loseEncounterLife, DEFAULT_HAZARD_GAIN
//   difficulty-ladder.ts  STRIKE_TIERS / RAID_TIERS, tierById, tierClearKey, recordTierClear, tierCleared, tierUnlocked,
//                         highestUnlocked, tierTarget, flawlessPeak, tuneHazard, scaleEncounter, applyChallenge, challengeBump,
//                         weeklyRaidChallenge, weeklyMult
//   strikes.ts            STRIKES, isStrike, weeklyStrike, strikeClaimKey, canClaimStrike, strikeTierUnlocked, strikePayout,
//                         claimStrikeClear
//   world-boss.ts         WORLD_BOSS, RAID_SITES, worldBossAt, WORLD_BOSS_REWARD, worldBossKey, payWorldBoss, worldBossBanner,
//                         raidSiteWorld
// Golden-tested (Tests/StrikeCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace wf::strike
{
	// ---- the encounter engine (raid-stages.ts) ----
	/** SYNC_TRAVERSAL | COMBAT | PUZZLE_COMBAT | TRAVERSAL_COMBAT | BOSS_FIGHT */
	WORLDFRACTURECORE_API double DefaultHazardGain(const std::string& StageType);
	struct FBossPhase { std::string Name; double Threshold = 0; std::string Mechanic, Counter; };
	struct FRoute { std::string Id, Name, Tradeoff; };
	struct FStage
	{
		std::string Id, Name, Type, Objective;
		double Target = 1;
		bool bCheckpoint = false;
		std::string HazardLabel;
		std::optional<double> HazardPerStep;
		std::vector<std::string> Enemies;
		std::vector<FRoute> Routes;
		std::vector<FBossPhase> BossPhases;
		std::string Reward;
	};
	struct FSignature { std::string Name, Type /* WEAPON | ARMOR */, Perk; std::vector<std::string> RepeatTraits; };
	struct FDefinition
	{
		std::string Id, Name, Activity; // DUNGEON | RAID | STRIKE
		double MaxLives = 3;
		std::vector<FStage> Stages;
		bool bNoCheckpointRelief = false, bBlackout = false;
		std::optional<double> DamageMult;
		// dungeon / strike flavour
		std::string Region, Identity, Hazard, Boss, Duration;
		FSignature Signature;
	};
	struct FStagePerformance { std::string Name; double Objectives = 0, Hazard = 0; };
	struct FRun
	{
		std::string Status = "READY"; // READY | ACTIVE | COMPLETE | WIPED
		int StageIndex = 0;
		double Progress = 0, Lives = 0, Hazard = 0;
		std::string Message;
		std::optional<std::string> SelectedRoute;
		int BossPhase = 0;
		double LivesUsed = 0;
		std::vector<FStagePerformance> StagePerformance;
		double Damage = 0, Support = 0;
	};
	WORLDFRACTURECORE_API FRun CreateRun(const FDefinition& Def);
	/** one objective step (the hub's "Advance objective") */
	WORLDFRACTURECORE_API FRun Advance(const FDefinition& Def, const FRun& Run);
	WORLDFRACTURECORE_API FRun ChooseRoute(const FRun& Run, const std::string& RouteId);
	WORLDFRACTURECORE_API FRun LoseLife(const FDefinition& Def, const FRun& Run);

	// ---- the difficulty ladder (difficulty-ladder.ts) ----
	struct FTier { std::string Id, Name; int Rank = 0; double Peak = 0, EnemyScale = 1, BossHealthScale = 1, LivesDelta = 0, PayMult = 1, Power = 0; std::string Blurb; };
	/** strike | raid */
	WORLDFRACTURECORE_API const std::vector<FTier>& TiersOf(const std::string& Kind);
	/** unknown ids fall back to the first tier */
	WORLDFRACTURECORE_API const FTier& TierById(const std::string& Kind, const std::string& Id);
	inline std::string TierClearKey(const std::string& ActivityId, const std::string& TierId) { return "tier-clear:" + ActivityId + ":" + TierId; }
	WORLDFRACTURECORE_API void RecordTierClear(FProgression& P, const std::string& ActivityId, const std::string& TierId);
	WORLDFRACTURECORE_API bool TierCleared(const FProgression& P, const std::string& Kind, const std::vector<std::string>& ActivityIds, const std::string& TierId);
	WORLDFRACTURECORE_API bool TierUnlocked(const FProgression& P, const std::string& Kind, const std::vector<std::string>& ActivityIds, const std::string& TierId);
	WORLDFRACTURECORE_API const FTier& HighestUnlocked(const FProgression& P, const std::string& Kind, const std::vector<std::string>& ActivityIds);
	/** the base tier pays under the activity's own id; higher tiers under <id>@<tier> */
	WORLDFRACTURECORE_API std::string TierTarget(const std::string& Kind, const std::string& ActivityId, const std::string& TierId);
	inline constexpr double SearchHazard = 8, TuneSlack = 3, ChallengePeakCap = 98;
	inline constexpr int SearchRoomRank = 0;
	/** the stages whose secret searches a tier leaves room for (only the Hollow Star raid has any) */
	WORLDFRACTURECORE_API std::vector<std::string> SearchStages(const std::string& DefId);
	/** how high hazard goes when every objective is hit with no mistakes (100: even flawless play wipes) */
	WORLDFRACTURECORE_API double FlawlessPeak(const FDefinition& Def, const std::vector<std::string>& Searches = {});
	WORLDFRACTURECORE_API FDefinition TuneHazard(const FDefinition& Def, double Target, bool bSearchRoom = true);
	/** the tier (and an optional weekly raid challenge) applied to an encounter */
	WORLDFRACTURECORE_API FDefinition ScaleEncounter(const FDefinition& Def, const FTier& Tier, const std::string& Mod = "");
	WORLDFRACTURECORE_API FDefinition ApplyChallenge(const FDefinition& Def, const std::string& ModId);
	WORLDFRACTURECORE_API double ChallengeBump(const std::string& ModId);
	struct FModifier { std::string Id, Name, Effect; };
	WORLDFRACTURECORE_API const std::vector<FModifier>& RaidChallenges();
	WORLDFRACTURECORE_API const FModifier& WeeklyRaidChallenge(double NowMs);
	inline constexpr double WeeklyStrikeBonus = 1.5;
	WORLDFRACTURECORE_API double WeeklyMult(const std::string& Kind, const FTier& Tier, bool bFeatured, bool bChallengeTaken);

	// ---- strikes (strikes.ts) ----
	WORLDFRACTURECORE_API const std::vector<FDefinition>& Strikes();
	WORLDFRACTURECORE_API const std::vector<std::string>& StrikeIds();
	WORLDFRACTURECORE_API const FDefinition* FindStrike(const std::string& Id);
	inline bool IsStrike(const std::string& Id) { return FindStrike(Id) != nullptr; }
	/** this week's Ordeal */
	WORLDFRACTURECORE_API const FDefinition& WeeklyStrike(double NowMs);
	WORLDFRACTURECORE_API std::string StrikeClaimKey(const std::string& StrikeId, const std::string& TierId, double NowMs, const std::string& Operator);
	WORLDFRACTURECORE_API bool CanClaimStrike(const FProgression& P, const std::string& StrikeId, const std::string& TierId, double NowMs);
	WORLDFRACTURECORE_API bool StrikeTierUnlocked(const FProgression& P, const std::string& TierId);
	struct FStrikePayout { std::string Key; double Nex = 0; bool bFirst = false; };
	/** what a clear would pay right now; nullopt when today's is taken */
	WORLDFRACTURECORE_API std::optional<FStrikePayout> StrikePayout(const FProgression& P, const std::string& StrikeId, const std::string& TierId, double NowMs);
	struct FClaim { FProgression Progression; double Paid = 0; bool bFirst = false; };
	/** a strike clear: tier Nex (once per strike per tier per day), shards by tier, discovery XP, the signature gear's name, and
	 *  the tier clear recorded (unlocking the next tier) */
	WORLDFRACTURECORE_API FClaim ClaimStrikeClear(const FProgression& P, const std::string& StrikeId, const std::string& TierId, double NowMs);
}

namespace wf::worldboss
{
	inline constexpr double PeriodMin = 40, WindowMin = 15, HpScale = 4, WakeRange = 140;
	struct FRaidSite { std::string Region, Name, Boss; double Out = 0, Bearing = 0; };
	WORLDFRACTURECORE_API const std::vector<FRaidSite>& RaidSites();
	struct FRaid { std::string Id; FRaidSite Site; double StartsAt = 0, EndsAt = 0; bool bLive = false; };
	struct FRaids { FRaid Current, Next; };
	WORLDFRACTURECORE_API FRaids WorldBossAt(double NowMs);
	inline constexpr double RewardNex = 2500, RewardXp = 1500;
	WORLDFRACTURECORE_API const std::vector<std::pair<std::string, double>>& RewardMaterials();
	inline std::string WorldBossKey(const std::string& RaidId) { return "worldboss:" + RaidId; }
	/** once per raid: the ledger key and the materials; false (unchanged) when this raid already paid */
	WORLDFRACTURECORE_API bool PayWorldBoss(FProgression& P, const std::string& RaidId);
	WORLDFRACTURECORE_API std::string WorldBossBanner(double NowMs);
	struct FPoint { double X = 0, Z = 0; };
	/** out from the region's centre, pulled back toward it until it stands on dry land */
	WORLDFRACTURECORE_API FPoint RaidSiteWorld(const FRaidSite& Site, double RegionX, double RegionZ, double RegionRadius, const std::function<double(double, double)>& Ground, double Water);
}
