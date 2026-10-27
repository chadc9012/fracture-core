// World Fracture — the cities' world events: what happens in Nexus City and Neon City while you are there.
//
// A small director picks the next event, always in the city you stand in, and retakes a fallen district first: a District
// Invasion (drive them out before the district falls), a Distress Call, a Roaming Warlord at the city edge, a Smuggler
// Convoy (in Neon City the Syndicate's, so stopping it pleases Aegis and angers the Syndicate) or a Reality Fracture (hold
// position in the rift for 25 s while it spits out aberrations). Each warns, goes live, and resolves from the real fight:
// the tagged hostiles cleared by you (won), cleared only by the city's patrols (no reward), the clock running out or you
// leaving the city (lost). The outcome changes standing, district status (fallen districts close their trade), Defend
// contracts and materials, once per event.
//
// Port of the web build's authoritative rules in living-events.ts: EVENT_RULES, FRACTURE_HOLD / RADIUS, ABANDON_MARGIN, the
// director timings, convoyFactions, eventBeneficiary, pickEvent, stepLivingDirector, fallenDistricts, resolveLivingEvent; and
// living-runtime.ts's spawn plan (spawnFor) and fracture waves; living-world.ts DISTRICTS (their anchors and factions).
// Golden-tested (Tests/LivingEventCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace wf::livingevent
{
	struct FRule
	{
		std::string Title, Brief;
		double Warn = 0, Limit = 0, WinRep = 0;
		std::vector<std::pair<std::string, double>> WinMaterials;
		double WinShards = 0, FailRep = 0;
		bool bDistrictStakes = false;
	};
	/** INVASION | DISTRESS | ROAMING_BOSS | CONVOY | FRACTURE */
	WORLDFRACTURECORE_API const FRule& RuleOf(const std::string& Kind);
	inline constexpr double FractureHold = 25, FractureRadius = 9, AbandonMargin = 80, FirstEventDelay = 75, GapLo = 150, GapHi = 240, RetakeDelay = 45, ResultHold = 6, FractureWaveEvery = 10;

	struct FDistrict { std::string Id, City, Name; double X = 0, Z = 0; std::string Faction; };
	WORLDFRACTURECORE_API const std::vector<FDistrict>& Districts();
	WORLDFRACTURECORE_API const FDistrict* DistrictById(const std::string& Id);

	struct FEvent
	{
		std::string Id, Kind, City, District;
		double X = 0, Z = 0;
		std::string Phase = "WARNING"; // WARNING | ACTIVE | WON | FAILED
		double Timer = 0, Hold = 0;
		bool bSpawned = false;
		double Wave = 0;
		bool bCleared = false;
	};
	struct FDirector { double Next = FirstEventDelay; std::optional<FEvent> Current; double Serial = 0; };
	struct FConvoy { std::string Owner, Beneficiary; };
	WORLDFRACTURECORE_API FConvoy ConvoyFactions(const std::string& City);
	WORLDFRACTURECORE_API std::string EventBeneficiary(const FEvent& Ev);
	/** the next event for a city; a fallen district there is retaken first (always an invasion). NowMs is a whole number. */
	WORLDFRACTURECORE_API FEvent PickEvent(const std::string& City, const std::function<double()>& Rnd, const std::vector<std::string>& Fallen, double NowMs, double Serial);
	struct FInput
	{
		double Dt = 0, NowMs = 0;
		std::function<double()> Rnd;
		double Px = 0, Pz = 0;
		bool bAlive = true;
		std::string City; // "" outside both cities
		bool bBlocked = false;
		double TagAlive = 0, PlayerKills = 0;
		std::vector<std::string> Fallen;
	};
	struct FResolved { FEvent Event; std::string Outcome; };
	struct FStep { FDirector Director; std::optional<FEvent> Activated, Started; std::optional<FResolved> Resolved; };
	WORLDFRACTURECORE_API FStep StepDirector(const FDirector& D, const FInput& In);
	WORLDFRACTURECORE_API std::vector<std::string> FallenDistricts(const FProgression& P, double NowMs);
	/** apply an outcome once per event id; returns the line to show ("" when this event already counted) */
	WORLDFRACTURECORE_API std::string ResolveEvent(FProgression& P, const FEvent& Ev, const std::string& Outcome, double NowMs);

	/** living-runtime.ts spawnFor: who comes, how many (elites among them) and how spread; Region "" = the city's invaders */
	struct FSpawnPlan { std::string Region; int Size = 0, Elites = 0; double Spread = 0; bool bBoss = false; };
	WORLDFRACTURECORE_API FSpawnPlan SpawnPlan(const FEvent& Ev);
	/** a live fracture sends two more aberrations every 10 s while fewer than five are up */
	WORLDFRACTURECORE_API std::optional<FSpawnPlan> FractureWave(FDirector& D, double TagAlive);
}
