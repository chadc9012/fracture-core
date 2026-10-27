// World Fracture — the people you can talk to in Nexus City and Neon City: faction leaders, quest givers and informants,
// the contracts they hand out, the intel informants sell, the Neon City pledge and the commendations.
//
// Every action is a progression step: standing (the Living World reputation the city shops already read), materials,
// contracts and revealed stashes; every payout is once-keyed in earnedRewards. Contract progress comes from gameplay only:
// kills inside the city (CULL), world events won there (DEFEND), materials handed in (DELIVER) and survey points reached
// (SURVEY). Pledging to a Neon City faction (+20 with it, -25 with its rival) is permanent. NPCs work their posts by day and
// rest near the city centre from 22:00 to 05:00; nothing they offer depends on the hour.
//
// Port of the web build's authoritative rules:
//   living-npcs.ts   LIVING_NPCS, npcWorld, npcNear, CONTRACTS, contractPoint, INTEL, intelPoint, npcActions, performNpcAction,
//                    npcLine, recordCityKills, recordEventWin, recordReach, livingMarkers, repSummary, PLEDGE_KEY
//   npc-routine.ts   onDuty, restSpot, npcPosition
//   living-world.ts  CITIES, cityAt, the districts' names and the factions' cities (reputation itself is wf::shop)
// Golden-tested (Tests/LivingNpcCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace wf::living
{
	struct FCity { std::string Id, Name; double X = 0, Z = 0, Radius = 0; };
	WORLDFRACTURECORE_API const std::vector<FCity>& Cities();
	WORLDFRACTURECORE_API const FCity* CityById(const std::string& Id);
	/** the city a world point is in (Neon checked first), or "" */
	WORLDFRACTURECORE_API std::string CityAt(double X, double Z);

	struct FNpc
	{
		std::string Id, Name, Title, City, Faction, Role; // Role: LEADER | QUEST | INFORMANT
		double Lx = 0, Lz = 0;                            // metres from the city centre (north = -z)
		std::string Body;
		std::string Greeting[5];                          // HOSTILE WARY NEUTRAL TRUSTED HONORED
	};
	WORLDFRACTURECORE_API const std::vector<FNpc>& Npcs();
	WORLDFRACTURECORE_API const FNpc* NpcById(const std::string& Id);
	inline constexpr double TalkReach = 3.6, OffDutyFrom = 22, OffDutyTo = 5, RestDistance = 8;
	struct FPoint { double X = 0, Z = 0; };
	/** npc-routine.ts: on duty unless the hour (none = unset: on duty) is 22:00-05:00 */
	WORLDFRACTURECORE_API bool OnDuty(std::optional<double> Hour);
	WORLDFRACTURECORE_API FPoint RestSpot(const FNpc& Npc);
	WORLDFRACTURECORE_API FPoint NpcPosition(const FNpc& Npc, std::optional<double> Hour);
	/** the nearest NPC within talking reach at this hour, or none */
	WORLDFRACTURECORE_API const FNpc* NpcNear(double X, double Z, std::optional<double> Hour);

	struct FContract
	{
		std::string Id, Giver, Faction, City, Kind, Title, Brief; // Kind: CULL | DEFEND | DELIVER | SURVEY
		double Amount = 0;
		std::string Material;
		std::optional<double> Lx, Lz;
		std::string MinTier;
		double RewardRep = 0;
		std::vector<std::pair<std::string, double>> RewardMaterials;
		double RewardXp = 0;
	};
	WORLDFRACTURECORE_API const std::vector<FContract>& Contracts();
	WORLDFRACTURECORE_API const FContract* ContractById(const std::string& Id);
	WORLDFRACTURECORE_API std::optional<FPoint> ContractPoint(const FContract& C);
	inline constexpr double SurveyReach = 8, StashReach = 4;
	inline constexpr int MaxActiveContracts = 3;
	WORLDFRACTURECORE_API bool ContractDone(const FProgression& P, const std::string& Id);

	struct FIntel
	{
		std::string Id, Seller, City, Title, Rumor, CostMaterial;
		double CostAmount = 0, Lx = 0, Lz = 0;
		std::vector<std::pair<std::string, double>> Reward;
		double Shards = 0;
	};
	WORLDFRACTURECORE_API const std::vector<FIntel>& Intel();
	WORLDFRACTURECORE_API FPoint IntelPoint(const FIntel& I);

	inline const std::string PledgeKey = "living.neon.pledge";
	struct FAction { std::string Id, Label, Detail; bool bEnabled = false; std::string Reason; };
	/** everything the talk panel offers this NPC now, with why a locked one is locked */
	WORLDFRACTURECORE_API std::vector<FAction> NpcActions(const FProgression& P, const FNpc& Npc);
	struct FResult { bool bOk = false; std::string Message; /* or the refusal */ };
	/** perform a talk-panel action; refusals change nothing */
	WORLDFRACTURECORE_API FResult PerformNpcAction(FProgression& P, const std::string& NpcId, const std::string& ActionId, double NowMs);
	/** the NPC's opening line: an event in progress, a fallen district, the pledge, else the standing greeting */
	WORLDFRACTURECORE_API std::string NpcLine(const FProgression& P, const FNpc& Npc, const std::string& EventTitle, double NowMs);

	/** kills inside a city advance its CULL contracts; a won world event its DEFEND contracts */
	WORLDFRACTURECORE_API void RecordCityKills(FProgression& P, const std::string& City, double Kills);
	WORLDFRACTURECORE_API void RecordEventWin(FProgression& P, const std::string& City);
	/** reaching a survey point completes the survey; reaching a revealed stash opens it (once). Returns the lines to show. */
	WORLDFRACTURECORE_API std::vector<std::string> RecordReach(FProgression& P, double X, double Z);
	struct FMarker { std::string Id, Label; double X = 0, Z = 0; std::string Kind; /* survey | stash */ };
	WORLDFRACTURECORE_API std::vector<FMarker> LivingMarkers(const FProgression& P);
	struct FStanding { std::string Faction, Name; double Rep = 0; std::string Tier; };
	WORLDFRACTURECORE_API std::vector<FStanding> RepSummary(const FProgression& P, const std::string& City);
}
