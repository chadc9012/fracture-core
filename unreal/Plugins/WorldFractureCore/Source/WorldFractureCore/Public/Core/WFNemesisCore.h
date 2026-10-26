// World Fracture — nemeses: an enemy that kills you is promoted. It gets a name, a rank, a strength and a weakness, remembers
// where it beat you, and later ambushes you in its region. Killing it ends it unless it is a Survivor, which comes back once,
// scarred and stronger. Each kill of a nemesis pays once per (id, life); dying to it ranks it up.
//
// Port of the web build's authoritative rules (nemesis.ts): TRAITS, canPromote, onPlayerKilled, onNemesisKilled, nemesisStats,
// weaknessMult, nemesisReward, rewardKey, ambushDue (AMBUSH_AFTER 60 s, AMBUSH_COOLDOWN 240 s), mergeNemeses, applyPlayerDeath,
// applyNemesisKill. Golden-tested (Tests/NemesisCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <optional>
#include <string>
#include <vector>

namespace wf::nemesis
{
	using FNemesis = FProgression::FNemesis;
	struct FTrait { std::string Id, Label, Text, Kind; /* strength | weakness */ };
	WORLDFRACTURECORE_API const std::vector<FTrait>& Traits();
	WORLDFRACTURECORE_API const FTrait* TraitById(const std::string& Id);
	/** the element a scarred nemesis takes double damage from, or "" */
	WORLDFRACTURECORE_API std::string WeakElement(const FNemesis& N);
	inline constexpr double MaxRank = 5;
	inline constexpr int MaxAlive = 6;

	/** what the sim knows about the machine that landed the killing blow */
	struct FKiller { std::string Profile, Zone; bool bElite = false, bBoss = false; std::string Nemesis; /* "" = not a nemesis */ };
	/** ordinary troops and elites; never bosses or nameless hostiles */
	WORLDFRACTURECORE_API bool CanPromote(const FKiller& K);

	struct FListResult { std::vector<FNemesis> List; std::string Line; /* "" = nothing to announce */ };
	WORLDFRACTURECORE_API FListResult OnPlayerKilled(const std::vector<FNemesis>& List, const std::optional<FKiller>& Killer, const std::string& RegionName, double NowMs);
	struct FKillResult { std::vector<FNemesis> List; std::string Line; std::optional<FNemesis> Slain; bool bReturned = false; };
	WORLDFRACTURECORE_API FKillResult OnNemesisKilled(const std::vector<FNemesis>& List, const std::string& Id, double NowMs);

	struct FStats { double Hp = 0, Damage = 1, Scale = 1; };
	WORLDFRACTURECORE_API FStats NemesisStats(const FNemesis& N);
	WORLDFRACTURECORE_API double WeaknessMult(const FNemesis* N, const std::string& Element);
	struct FReward { std::vector<std::pair<std::string, double>> Materials; double Shards = 0; };
	WORLDFRACTURECORE_API FReward NemesisReward(const FNemesis& N);
	WORLDFRACTURECORE_API std::string RewardKey(const FNemesis& N, double Life);

	inline constexpr double AmbushAfter = 60, AmbushCooldown = 240;
	/** the nemesis that should ambush now (highest rank first; a chosen one skips the wait after 4 s), or null */
	WORLDFRACTURECORE_API const FNemesis* AmbushDue(const std::vector<FNemesis>& List, const std::string& RegionId, double SecondsInRegion, double SinceLastAmbush, const std::string& Summoned);
	/** merge by id: SLAIN wins, higher rank / kills / returns win, the copy seen last keeps its words and traits */
	WORLDFRACTURECORE_API std::vector<FNemesis> MergeNemeses(const std::vector<FNemesis>& A, const std::vector<FNemesis>& B);

	struct FApplied { FProgression Progression; std::string Line; };
	WORLDFRACTURECORE_API FApplied ApplyPlayerDeath(const FProgression& P, const FKiller& Killer, const std::string& RegionName, double NowMs);
	WORLDFRACTURECORE_API FApplied ApplyNemesisKill(const FProgression& P, const std::string& Id, double NowMs);
}
