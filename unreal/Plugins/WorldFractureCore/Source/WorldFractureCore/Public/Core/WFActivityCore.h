// World Fracture — the activity board's objective engine: side missions, bounties, contracts, regional events, the weekly
// elite operations and Killbox matches, run objective by objective from what the game can really measure.
//
// Objectives: kills (any, elite or boss) in the run; ordered course checkpoints against a clock; collecting points against a
// clock; holding a zone (time inside builds the hold, time outside drains it twice as fast); delivering from A to B against a
// clock; a Killbox match (your rival eliminations against your deaths, first to the target); a Killbox mode (pvp.ts, its own
// score). Points are fractions of the activity area's radius from its centre. A run is spent the moment it starts
// (wf::activity::StartActivity) and pays through wf::activity::CompleteActivity.
//
// Port of the web build's authoritative rules in activities.ts: AREAS, pointWorld, needOf, newRun, currentTarget, stepRun,
// advance, abandonRun, areaOfPoint, categoryOf, featuredFor (the daily featured four), weeklyElitesFor, weekKeyUtc;
// crucible.ts ARENA_POINT. Golden-tested (Tests/ActivityCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFRaceCore.h"

#include <optional>
#include <string>
#include <vector>

namespace wf::activity
{
	struct FFrac { double X = 0, Z = 0; };
	/** one stage (activities.ts Objective) */
	struct FObjective
	{
		std::string Kind;           // kills course collect hold deliver race crucible pvp
		std::string Label;
		double Count = 0;           // kills
		std::string Tier = "any";   // kills: any | elite | boss
		std::vector<FFrac> Points;  // course, collect
		double TimeLimit = 0;       // course, collect, deliver, race
		FFrac At;                   // hold
		double Radius = 0, Seconds = 0;
		FFrac From, To;             // deliver
		std::string RaceId, Mode;   // race; crucible / pvp
		double Target = 0;          // crucible, pvp
	};
	struct FArea { std::string Id, Name; double X = 0, Z = 0, Radius = 0; };
	/** a fraction of the area radius out from its centre, in world metres */
	WORLDFRACTURECORE_API FFrac PointWorld(const FArea& Area, const FFrac& F);
	inline constexpr double CheckpointRadius = 7;
	/** the Killbox arena: the Grid-Iron Highway stretch of the Wastelands (crucible.ts) */
	inline constexpr FFrac ArenaPoint{0.05, -0.1};
	WORLDFRACTURECORE_API double NeedOf(const FObjective& O);
	/** activities.ts newRun's objective state (StartActivity has spent the attempt) */
	WORLDFRACTURECORE_API void BeginObjectives(FActivityRun& Run, const std::vector<FObjective>& Stages, double NowMs);

	struct FTarget { double X = 0, Z = 0; std::string Label; };
	/** where to head now (the marker); none when open-ended. A race stage's target belongs to the race (none here). */
	WORLDFRACTURECORE_API std::optional<FTarget> CurrentTarget(const std::vector<FObjective>& Stages, const FArea& Area, const FActivityRun& Run);

	/** a Killbox mode's live match (pvp.ts PvpState as stepRun reads it) */
	struct FPvpTick { double Us = 0, Them = 0; std::string Result; /* win | loss | "" */ std::string Reason, Line; };
	/** one tick of measurable facts (activities.ts Tick) */
	struct FTick
	{
		double X = 0, Z = 0, Dt = 0, NowMs = 0;
		double Kills = 0, Elites = 0, Bosses = 0, Hp = 100, Deaths = 0;
		std::optional<double> RivalKills;
		std::optional<FPvpTick> Pvp;
	};
	/** advance a run by one tick (a race stage is left to the race) */
	WORLDFRACTURECORE_API void StepRun(const std::vector<FObjective>& Stages, const FArea& Area, FActivityRun& Run, const FTick& T);
	WORLDFRACTURECORE_API void AbandonRun(FActivityRun& Run);

	/** the area a world point is in (within 1.2 x its radius, the nearest centre), or "" */
	WORLDFRACTURECORE_API std::string AreaOfPoint(double X, double Z, const std::vector<FArea>& Areas);
	/** side | bounty | movement | underground | events */
	WORLDFRACTURECORE_API std::string CategoryOf(const std::string& Kind, const std::string& Id, const std::string& Area);

	/** a board entry as the rotation reads it */
	struct FBoardEntry { std::string Id, Area; double MinRep = 0; bool bGated = false; };
	inline constexpr double FeaturedBonus = 1.5;
	inline constexpr int FeaturedCount = 4, WeeklyCount = 3;
	/** today's featured contracts (UTC day): one per area, the standard board's (no reputation or gate), in their rotation */
	WORLDFRACTURECORE_API std::vector<std::string> FeaturedFor(double NowMs, const std::vector<FBoardEntry>& Activities);
	/** this week's three elite operations (the week starts Monday 00:00 UTC) */
	WORLDFRACTURECORE_API std::vector<std::string> WeeklyElitesFor(double NowMs, const std::vector<std::string>& Elites);
	/** the Monday of the week holding NowMs, YYYY-MM-DD */
	WORLDFRACTURECORE_API std::string WeekKeyUtc(double NowMs);
}
