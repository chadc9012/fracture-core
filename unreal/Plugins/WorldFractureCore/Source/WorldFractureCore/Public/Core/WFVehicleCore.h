// World Fracture — vehicles: per-type handling, ground grip, damage condition and repair, ownership.
//
// Port of the web build's authoritative rules:
//   vehicle-handling.ts  handlingFor / stepVehicle / canExitVehicle / vehicleCamera (RACER, OFFROAD, TANK, JET, HELI,
//                        BOAT, SUB: a jet needs takeoff speed, a heli hovers, a boat floats, a sub dives, a tank pivots)
//   vehicle-surface.ts   surfaceAt / surfaceGrip
//   vehicle-condition.ts impactVehicle / conditionEffects / recoverVehicle / repairCost / repairVehicle
//   progression.ts       rewardVehicle (owned list, 3-slot garage loadout, selection)
//   Scene.tsx            the vehicle top speed: 62 m/s x biome x boost x mods x vehicle x upgrades x damage x race slow
// The 14 vehicles' stats come from DataTables/Vehicles.json. Golden-tested (Tests/VehicleCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"

#include "Core/WFProgression.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::vehicle
{
	inline constexpr double BaseTopSpeed = 62; // m/s
	inline constexpr double RideHeight = 1.9;  // m

	struct FProfile
	{
		std::string Kind; // RACER OFFROAD TANK JET HELI BOAT SUB
		std::string Mode; // GROUND AIR WATER
		double Top = 1, Accel = 52, Brake = 70, Reverse = 18, Steer = 1.5;
		bool bPivot = false;
		double Grip = 0.9, Takeoff = 0, Climb = 0, SafeExit = 6;
	};
	WORLDFRACTURECORE_API const FProfile& ProfileFor(const std::string& Kind);
	/** The handling kind of a vehicle id, falling back by domain (LAND AIR WATER AMPHIBIOUS SPACE). */
	WORLDFRACTURECORE_API std::string KindFor(const std::string& VehicleId, const std::string& Domain);
	inline const FProfile& HandlingFor(const std::string& VehicleId, const std::string& Domain) { return ProfileFor(KindFor(VehicleId, Domain)); }

	struct FInput
	{
		double Throttle = 0, Brake = 0, Steer = 0, Ascend = 0, Descend = 0;
		bool bHandbrake = false, bBoost = false;
	};
	struct FEnv
	{
		double Grip = 1, Slope = 0, Floor = 0, Water = 0;
		bool bOverWater = false;
	};
	struct FState
	{
		double Speed = 0, Yaw = 0, Y = 0, Vy = 0;
		bool bAirborne = false;
		double Slip = 0, Roll = 0, Pitch = 0;
	};
	struct FStepResult : FState
	{
		bool bLanded = false, bHardLanding = false, bBlocked = false, bSkidding = false;
	};
	/** One frame. TopSpeed is the tuned max (TopSpeedFor) without the boost factor; Input.bBoost adds x1.4 here. */
	WORLDFRACTURECORE_API FStepResult StepVehicle(const FProfile& P, const FState& St, const FInput& In, const FEnv& Env, double TopSpeed, double Dt);

	struct FExitCheck
	{
		bool bOk = false;
		std::string Reason;
	};
	WORLDFRACTURECORE_API FExitCheck CanExitVehicle(const FProfile& P, const FState& St, bool bDeepWater);
	WORLDFRACTURECORE_API void VehicleCamera(const FProfile& P, double& OutDistance, double& OutHeight);

	WORLDFRACTURECORE_API std::string SurfaceAt(const std::string& RegionId, double Height, double WaterLevel);
	WORLDFRACTURECORE_API double SurfaceGrip(const std::string& Surface, double Slope);

	struct FCondition
	{
		double Body = 0, Engine = 0, Tires = 0, Suspension = 0;
	};
	WORLDFRACTURECORE_API FCondition NormalizeCondition(const FCondition& C);
	/** A collision that cost SpeedLost m/s. Mode: world | casual | competitive. */
	WORLDFRACTURECORE_API FCondition ImpactVehicle(const FCondition& C, double SpeedLost, const std::string& Mode = "world");
	struct FConditionEffects
	{
		double Speed = 1, Acceleration = 1, Grip = 1, Stability = 1;
		bool bDisabled = false;
	};
	WORLDFRACTURECORE_API FConditionEffects ConditionEffects(const FCondition& C);
	WORLDFRACTURECORE_API double RepairPrice(const FCondition& C);
	WORLDFRACTURECORE_API FCondition RecoverVehicle(const FCondition& C, bool bCalm, bool bStopped);
	inline constexpr double RepairNexPerPoint = 3;
	WORLDFRACTURECORE_API double RepairCost(const FCondition& C);
	WORLDFRACTURECORE_API double NexBalance(const std::map<std::string, double>& Ledger);
	/** nex.ts spendNex: a new negative entry, or false (bad price, used id, not enough Nex). */
	WORLDFRACTURECORE_API bool SpendNex(std::map<std::string, double>& Ledger, const std::string& Id, double Price);

	/** Scene.tsx: the vehicle's top speed before the boost factor stepVehicle applies itself. */
	WORLDFRACTURECORE_API double TopSpeedFor(double BiomeGrip, double VehicleSpeedMod, double VehicleSpeed, std::optional<double> GearLevel, double DamageSpeed, double RaceSlow);
	/** Scene.tsx venv.grip: surface grip x damage grip x stability x the vehicle's handling stat. */
	WORLDFRACTURECORE_API double EnvGrip(double SurfaceGripValue, const FConditionEffects& Fx, double VehicleHandling);
}

namespace wf
{
	/** Vehicle ownership and wear, kept on the save (progression.ts ownedVehicles / garageLoadout / selectedVehicle /
	 *  vehicleConditions). Separate from FProgression so the older systems' tests are untouched. */
	struct FGarage
	{
		std::vector<std::string> Owned;
		std::vector<std::string> Loadout; // last 3 rewarded
		std::optional<std::string> Selected;
		std::map<std::string, vehicle::FCondition> Conditions;
	};
	namespace vehicle
	{
		WORLDFRACTURECORE_API FGarage RewardVehicle(FGarage G, const std::string& VehicleId);
		/** vehicle-condition.ts repairVehicle: pays Nex to restore a vehicle; Error says why not. */
		WORLDFRACTURECORE_API bool RepairVehicle(FGarage& G, std::map<std::string, double>& NexLedger, const std::string& VehicleId, double NowMs, std::string& OutMessage);
	}
}
