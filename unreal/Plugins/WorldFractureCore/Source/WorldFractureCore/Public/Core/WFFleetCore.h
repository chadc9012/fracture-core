// World Fracture — the vehicle fleet (named builds on the 14 chassis), garage bases, tuning, paint and cosmetics, and the
// fleet builds' gadget hardpoints.
//
// Port of the web build's authoritative rules:
//   fleet.ts           buyGarage, buyFleetVehicle (material cost + Nex price, unlocks the base vehicle, makes it active),
//                      setActiveFleet, tuneNode, setPaint, setVehicleCosmetic, tunedVehicle, fleetTuningSummary, sanctuariesFor
//   market-prices.ts   fleetNexPrice (exported per build), fleetLedgerKey
//   vehicle-gadgets.ts gadgetFor, dropMine / mineTriggered, launchCaltrops / inCaltrops, inFlames, popFlares / stepFlares,
//                      launchDrone / stepDrone / droneTarget, ramFor, slowFor and the gadget tuning
// Golden-tested (Tests/FleetCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"
#include "Core/WFVehicleCore.h"

#include <map>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace wf::fleet
{
	using FCost = std::vector<std::pair<std::string, double>>; // material -> amount, in the data's order
	struct FNode { std::string Id, Name, Text, Stat; double PerLevel = 0, MaxLevel = 0; FCost Cost; };
	struct FEntry
	{
		std::string Id, Name, Category, Base, Garage, Ability;
		FCost Cost;
		std::vector<std::string> Hardpoints, Paints;
		std::vector<FNode> Nodes;
		double NexPrice = 0;
	};
	struct FGarageBase { std::string Id, Name, Region; double X = 0, Z = 0; bool bUnderwater = false; FCost Cost; };
	struct FCatalog
	{
		std::vector<FEntry> Fleet; // FLEET order
		std::vector<FGarageBase> Garages;
		WORLDFRACTURECORE_API const FEntry* Find(const std::string& Id) const;
		WORLDFRACTURECORE_API const FGarageBase* FindGarage(const std::string& Id) const;
	};

	struct FResult { bool bOk = false; std::string Message; };
	WORLDFRACTURECORE_API FResult BuyGarage(const FCatalog& C, FProgression& P, const std::string& GarageId);
	WORLDFRACTURECORE_API FResult BuyFleetVehicle(const FCatalog& C, FProgression& P, FGarage& G, const std::string& Id);
	WORLDFRACTURECORE_API FResult SetActiveFleet(const FCatalog& C, FProgression& P, FGarage& G, const std::string& Id);
	WORLDFRACTURECORE_API FResult TuneNode(const FCatalog& C, FProgression& P, const std::string& Id, const std::string& NodeId);
	WORLDFRACTURECORE_API FResult SetPaint(const FCatalog& C, FProgression& P, const std::string& Id, const std::string& Paint);
	/** Key wheels | body | spoiler | armor | glow; visual only. */
	WORLDFRACTURECORE_API FResult SetCosmetic(const FCatalog& C, FProgression& P, const std::string& Id, const std::string& Key, const std::string& Value);

	struct FVehicleStats { std::string Id, Name; double Speed = 1, Hull = 1, Handling = 1, Ram = 1; };
	/** The chassis's numbers with the active build's tuning applied (only when the active build uses this chassis). */
	WORLDFRACTURECORE_API FVehicleStats TunedVehicle(const FCatalog& C, const FVehicleStats& Base, const FProgression::FFleet& F);
	struct FStatTuning { std::string Stat; double Level = 0, MaxLevel = 0, Bonus = 0; };
	struct FTuningSummary { std::string BuildName, Category, Ability; std::vector<FStatTuning> Stats; };
	WORLDFRACTURECORE_API std::optional<FTuningSummary> TuningSummary(const FCatalog& C, const FProgression::FFleet& F);
	inline constexpr double SanctuaryRadius = 16;
	struct FCircle { double X = 0, Z = 0, Radius = 0; };
	/** Owned (dry-land) garage bases are sanctuaries (the Godforge heart is not ported). */
	WORLDFRACTURECORE_API std::vector<FCircle> Sanctuaries(const FCatalog& C, const FProgression& P);
	WORLDFRACTURECORE_API std::string FormatInt(double V); // toLocaleString("en-US") for whole numbers
}

namespace wf::gadget
{
	struct FGadget { std::string Kind, Name, Use; double Cooldown = 0; }; // Kind MINE EMP_MINE CALTROPS FLAME FLARES DRONE RAM BREACH; Use HELD PRESS PASSIVE
	WORLDFRACTURECORE_API std::optional<FGadget> GadgetFor(const std::string& BuildId);

	// tuning (vehicle-gadgets.ts GADGET)
	struct FMineTuning { double Arm, Trigger, Radius, Damage, Knock, Life; int Max; double Stun = 0, Slow = 1, SlowFor = 0; };
	WORLDFRACTURECORE_API const FMineTuning& MineTuning(const std::string& Kind);
	inline constexpr double CaltropRadius = 5.5, CaltropLife = 14, CaltropDps = 2, CaltropSlow = 0.4, CaltropBack = 7;
	inline constexpr double FlameReach = 5.5, FlameAhead = 3, FlameDps = 9, FlameHeat = 55;
	inline constexpr double FlareSpoof = 3.5, FlareFall = 3;
	inline constexpr int FlareCount = 8;
	inline constexpr double DroneLife = 24, DroneOrbit = 7, DroneHeight = 9, DroneRange = 70, DroneRate = 0.45, DroneDamage = 1.3, DroneSpeed = 28;
	inline constexpr double RamDamageMult = 2.4, RamSelfMult = 0.35, BreachImpulse = 1.8, BreachWindow = 1.2, BreachRamMult = 3, BreachSelfMult = 0.5;

	struct FMine { std::string Kind; double X = 0, Y = 0, Z = 0, ArmAt = 0, Until = 0, Id = 0; };
	struct FCaltrops { double X = 0, Z = 0, R = 0, Until = 0, Id = 0; };
	struct FDrone { double X = 0, Y = 0, Z = 0, Until = 0, Cool = 0, Angle = 0, Id = 0; };
	struct FFlare { double X = 0, Y = 0, Z = 0, Vx = 0, Vy = 0, Vz = 0, Until = 0; };
	struct FState
	{
		std::vector<FMine> Mines;
		std::vector<FCaltrops> Caltrops;
		std::vector<FDrone> Drones;
		std::vector<FFlare> Flares;
		double SpoofUntil = 0, BreachUntil = 0, NextId = 1;
	};
	struct FPoint { double X = 0, Z = 0; bool bAlive = true; };

	WORLDFRACTURECORE_API void DropMine(FState& S, const std::string& Kind, double X, double Y, double Z, double Now);
	WORLDFRACTURECORE_API bool MineTriggered(const FMine& M, double Now, const std::vector<FPoint>& Targets);
	WORLDFRACTURECORE_API void LaunchCaltrops(FState& S, double X, double Z, double Now);
	WORLDFRACTURECORE_API bool InCaltrops(const FState& S, double X, double Z, double Now);
	WORLDFRACTURECORE_API bool InFlames(double SrcX, double SrcZ, double SrcYaw, double TX, double TZ, double BodyR = 0);
	WORLDFRACTURECORE_API void PopFlares(FState& S, double X, double Y, double Z, double Yaw, double Now);
	WORLDFRACTURECORE_API void StepFlares(FState& S, double Now, double Dt);
	WORLDFRACTURECORE_API bool Spoofed(const FState& S, double Now);
	WORLDFRACTURECORE_API void LaunchDrone(FState& S, double X, double Y, double Z, double Now);
	WORLDFRACTURECORE_API void StepDrone(FDrone& D, double Px, double Py, double Pz, double Dt);
	/** Nearest live target in range (index) that Visible accepts, or -1. */
	WORLDFRACTURECORE_API int DroneTarget(const FDrone& D, const std::vector<FPoint>& Targets, const std::vector<bool>& Visible);
	struct FRam { double DamageMult = 1, SelfMult = 1; };
	WORLDFRACTURECORE_API FRam RamFor(const std::optional<FGadget>& G, double BreachUntil, double Now);
	WORLDFRACTURECORE_API double SlowFor(double Base, bool bBoss);
}
