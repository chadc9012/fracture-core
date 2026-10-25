// World Fracture — racing, on the activity engine it runs inside.
//
// Port of the web build's authoritative rules:
//   racing.ts      tickRace (staging, countdown, ordered checkpoints, depth gates, timed reality gates, shortcuts, off-course
//                  recovery, collision / recovery / wreck penalties, track obstacles, time limits), evaluate (medals,
//                  place), rivalTimes / rivalPositions (deterministic rival pace and persona curves), courseProgress /
//                  livePlace, records (personal bests, medals, rank, championships), difficultyLocked, applyRaceResult,
//                  hiddenUnlocked, raceSpeedFactor
//   activities.ts  activityState / startActivity / completeActivity (attempts per day, cooldowns, gates, reputation,
//                  payout with challenge and featured bonuses, the one-time forge catalyst), challengeMet
// The 68 courses come from DataTables/RaceCourses.json in world coordinates (the web build lays them out round each area
// and routes vehicle courses over its terrain). Golden-tested (Tests/RaceCoreTest.cpp).
//
// Not ported: armor shader drops from activities (the shader catalogue), the featured-activity rotation (passed in).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::race
{
	struct FPoint
	{
		double X = 0, Z = 0;
		std::optional<double> Depth;
		std::optional<double> WindowPeriod, WindowOpen; // a reality gate passable only while time % period < open
	};
	struct FShortcut
	{
		int At = 0;            // the checkpoint index this replaces
		double ViaX = 0, ViaZ = 0;
		int SkipTo = 0;
	};
	struct FObstacle
	{
		std::string Id;
		double X = 0, Z = 0, Radius = 2.8;
		int Segment = 0;
	};
	struct FRaceDef
	{
		std::string Id, Area, Name, Type, Mode; // Mode: foot | vehicle | dive
		std::vector<FPoint> Points;
		std::vector<FShortcut> Shortcuts;
		std::vector<FObstacle> Obstacles; // hazard vehicle courses (racing.ts raceObstacles, precomputed on the web terrain)
		double Par = 60;
		int Rivals = 5, Rank = 0, Laps = 1;
		std::vector<std::string> HiddenMarkers;
		int HiddenNeed = 0;
		bool bHidden = false;
	};
	struct FChampionship
	{
		std::string Id, Area, Name;
		std::vector<std::string> Rounds;
		int Rank = 0;
	};
	struct FCatalog
	{
		std::vector<FRaceDef> Races; // RACES order (racingScore iterates it)
		std::vector<FChampionship> Championships;
		const FRaceDef* Find(const std::string& Id) const;
	};

	inline constexpr double CountdownS = 3, StartRadius = 30;
	extern WORLDFRACTURECORE_API const char* const Difficulties[3]; // standard advanced legendary
	extern WORLDFRACTURECORE_API const char* const Ranks[5];        // Rookie Contender Veteran Elite Legend
	WORLDFRACTURECORE_API double CheckpointRadius(const std::string& Mode);
	WORLDFRACTURECORE_API double Corridor(const std::string& Mode);
	WORLDFRACTURECORE_API double TimeLimit(const FRaceDef& Def, const std::string& Difficulty);
	WORLDFRACTURECORE_API bool WindowOpen(const FPoint& P, double Time);

	struct FResult
	{
		bool bValid = false;
		double Time = 0, Penalties = 0, Par = 0;
		std::optional<std::string> Medal; // gold silver bronze
		int Place = 1, Field = 1;
		double Style = 0;
		std::string Difficulty;
	};
	struct FRun
	{
		std::string RaceId, Difficulty;
		std::string Phase = "staging"; // staging countdown running finished failed
		double Wall0 = 0, Countdown = CountdownS, Time = 0;
		int Next = 1;
		std::vector<int> Passed;
		double Penalties = 0, Collisions = 0;
		std::vector<std::string> HitObstacles;
		double Impact = 0;
		int Recoveries = 0;
		double Outside = 0, Style = 0;
		std::optional<std::string> Notice, FailReason;
		bool bViaShortcut = false;
		struct FRecover { double X = 0, Z = 0; std::optional<double> Depth; };
		std::optional<FRecover> Recover; // the host teleports the racer back and clears it
		std::optional<FResult> Result;
	};
	struct FTick
	{
		double X = 0, Z = 0, Dt = 0, Now = 0; // Now in ms
		std::optional<std::string> Mode;
		std::optional<double> Y;
		bool bVehicleDisabled = false, bFell = false;
		double Collisions = 0, Style = 0;
	};
	WORLDFRACTURECORE_API FRun NewRaceRun(const FRaceDef& Def, const std::string& Difficulty, double NowMs);
	WORLDFRACTURECORE_API void TickRace(const FRaceDef& Def, FRun& Run, const FTick& T);
	WORLDFRACTURECORE_API FResult Evaluate(const FRaceDef& Def, const FRun& Run, double CollisionPenalty);

	WORLDFRACTURECORE_API uint32_t Hash(const std::string& S);
	WORLDFRACTURECORE_API std::vector<double> RivalTimes(const FRaceDef& Def, const std::string& Difficulty);
	struct FRivalPos
	{
		double X = 0, Z = 0;
		std::optional<double> Depth;
		double Progress = 0;
	};
	WORLDFRACTURECORE_API std::vector<FRivalPos> RivalPositions(const FRaceDef& Def, const std::string& Difficulty, double Time);
	WORLDFRACTURECORE_API std::string PersonaName(const std::string& RaceId, const std::string& Difficulty, int Slot);
	WORLDFRACTURECORE_API double CourseProgress(const FRaceDef& Def, int Next, double X, double Z);
	WORLDFRACTURECORE_API void LivePlace(const FRaceDef& Def, const FRun& Run, double X, double Z, int& OutPlace, int& OutField);
	WORLDFRACTURECORE_API double RaceSpeedFactor(double Impact);

	// ---- records (earnedRewards keys) ----
	WORLDFRACTURECORE_API std::optional<double> PersonalBest(const FProgression& P, const std::string& Id, const std::string& Difficulty);
	WORLDFRACTURECORE_API std::optional<std::string> BestMedal(const FProgression& P, const std::string& Id, const std::string& Difficulty);
	WORLDFRACTURECORE_API double RacingScore(const FCatalog& C, const FProgression& P);
	WORLDFRACTURECORE_API int RankIndex(const FCatalog& C, const FProgression& P);
	WORLDFRACTURECORE_API int ChampionshipsWon(const FCatalog& C, const FProgression& P);
	struct FChampionshipStatus
	{
		std::map<std::string, double> PerRound;
		double Total = 0;
		bool bComplete = false;
	};
	WORLDFRACTURECORE_API FChampionshipStatus ChampionshipPoints(const FProgression& P, const FChampionship& Ch);
	WORLDFRACTURECORE_API std::optional<std::string> DifficultyLocked(const FProgression& P, const std::string& Id, const std::string& Difficulty);
	WORLDFRACTURECORE_API bool HiddenUnlocked(const FProgression& P, const FRaceDef& Race);

	struct FRaceReward
	{
		double NexBonus = 0;
		bool bPersonalBest = false;
		std::optional<std::string> Medal;
		bool bNewMedal = false;
		std::optional<double> ChampionshipPoints;
		bool bChampionshipDone = false;
		std::optional<std::string> RankUp;
		std::vector<std::string> RivalsFirstBeaten;
	};
	/** racing.ts applyRaceResult: placement / medal Nex and the records, once per run (key race-run:<activity>:<startedAt>). */
	WORLDFRACTURECORE_API bool ApplyRaceResult(const FCatalog& C, FProgression& P, const std::string& ActivityId, double ActivityNex, double StartedAt, const FRun& Run, FRaceReward& OutReward, std::string& OutError);
}

namespace wf::activity
{
	/** The parts of an ActivityDef the rules read. */
	struct FRewards
	{
		double Nex = 0, Xp = 0, Rep = 0;
		std::map<std::string, double> Materials;
		double ShaderChance = 0.06;
	};
	struct FActivityDef
	{
		std::string Id, Kind, Faction, Period; // Period: "" (day) | week
		double Attempts = 3; // Infinity for the Killbox
		double CooldownMin = 20, MinRep = 0;
		std::optional<std::string> ChallengeId; // gold | no-damage | no-death | fast
		double TimeLimitSum = 0;                // sum of the stages' time limits (the "fast" challenge)
		FRewards Rewards;
		std::optional<int> RaceRankGate;        // race activities: requires racing rank >= this
	};
	struct FState
	{
		double AttemptsLeft = 0, CooldownLeftMs = 0;
		bool bAvailable = false;
		std::optional<std::string> Reason;
	};
	WORLDFRACTURECORE_API std::string PeriodKey(const FActivityDef& Def, double NowMs);
	WORLDFRACTURECORE_API double ReputationOf(const FProgression& P, const std::string& Faction);
	WORLDFRACTURECORE_API void AddReputation(FProgression& P, const std::string& Faction, double Amount);
	WORLDFRACTURECORE_API FState ActivityState(const race::FCatalog& Races, const FProgression& P, const FActivityDef& Def, double NowMs);
	struct FActivityRun
	{
		std::string Id;
		double StartedAt = 0;
		std::string Status = "active"; // active complete failed
		std::optional<std::string> Difficulty;
		bool bWasHurt = false, bDiedDuring = false;
		std::optional<race::FRun> Race;
	};
	/** Spends an attempt (never refunded) and starts a run, or says why not. */
	WORLDFRACTURECORE_API bool StartActivity(const race::FCatalog& Races, FProgression& P, const FActivityDef& Def, double NowMs, const std::optional<std::string>& Difficulty, FActivityRun& OutRun, std::string& OutError);
	WORLDFRACTURECORE_API bool ChallengeMet(const FActivityDef& Def, const FActivityRun& Run, double NowMs);
	struct FPayout
	{
		double Nex = 0, Xp = 0, Rep = 0;
		std::map<std::string, double> Materials;
		bool bBonus = false, bFeatured = false;
	};
	/** activities.ts completeActivity (without the armor shader roll). Pays once per attempt and starts the cooldown. */
	WORLDFRACTURECORE_API bool CompleteActivity(FProgression& P, const FActivityDef& Def, const FActivityRun& Run, double NowMs, bool bFeatured, FPayout& OutPayout, std::string& OutError);
}
