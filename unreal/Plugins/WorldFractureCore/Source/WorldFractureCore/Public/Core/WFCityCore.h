// World Fracture — city systems: combat heat, the Neon City heat meter, Nexus City surveillance (perimeter turrets as
// vision-cone sensors, detection, lockdown tiers, hacking), the vehicle damage ladder, and the bridge that turns these
// readings into quest events.
//
// Port of the web build's authoritative rules:
//   sim.ts           combatHeat gains (shots, bursts, grenades, crashes, rams, melee, flame jets) and its 6/s decay;
//                    the safe-zone perimeter turrets (createSim layout, the stepSim turret loop)
//   heat.ts          stepHeatMeter, heatLevelFor, heatStatus
//   stealth.ts       inVisionCone, anySensorSees, nexusSensors, stepDetectionMeter, detectionStateFor, lockdownStatus,
//                    stepHackProgress, hackComplete
//   chase-ai.ts      vehicleDamageStage, VEHICLE_DAMAGE_EFFECT, shouldForceFootTransition (the parts Scene.tsx uses)
//   quest-signals.ts questEventsFromHud
// Golden-tested (Tests/CityCoreTest.cpp), except the turret firing loop, which is inline in stepSim.
#pragma once

#include "Core/WFCoreApi.h"

#include <optional>
#include <string>
#include <vector>

namespace wf::city
{
	// ---- combat heat (sim.ts) ----
	/** what each event adds to combatHeat */
	struct FHeatGain
	{
		static constexpr double BulletHit = 1.5, Burst = 3, Grenade = 3, Crash = 3, RamMachine = 4, RamConvoy = 4, EnemyMelee = 2, FlamePerSecond = 2;
	};
	WORLDFRACTURECORE_API double DecayCombatHeat(double Heat, double Dt);

	// ---- the heat meter (heat.ts) ----
	WORLDFRACTURECORE_API int HeatLevelFor(double Heat);
	WORLDFRACTURECORE_API double StepHeatMeter(double Heat, double CombatIntensity, double Dt);
	struct FHeatStatus { int Level = 1; const char* Label = ""; const char* Response = ""; };
	WORLDFRACTURECORE_API FHeatStatus HeatStatus(double Heat);

	// ---- the vehicle damage ladder (chase-ai.ts) ----
	struct FDamageEffect { const char* Stage = "NOMINAL"; double SpeedMult = 1, HandlingMult = 1; bool bWeaponsDisabled = false; };
	/** from a 0-100 health percentage (100 - body damage) */
	WORLDFRACTURECORE_API FDamageEffect VehicleDamageStage(double HealthPct);
	WORLDFRACTURECORE_API bool ShouldForceFootTransition(const std::string& Stage, bool bBlocked);

	// ---- Nexus surveillance (stealth.ts) ----
	struct FSensor { double X = 0, Z = 0, Rot = 0, Range = 0; };
	inline constexpr double VisionHalfAngle = 3.141592653589793 / 5;
	WORLDFRACTURECORE_API bool InVisionCone(const FSensor& S, double Px, double Pz, double HalfAngle = VisionHalfAngle);
	WORLDFRACTURECORE_API bool AnySensorSees(const std::vector<FSensor>& Sensors, double Px, double Pz);
	WORLDFRACTURECORE_API double StepDetectionMeter(double Meter, double Dt, bool bSeen, bool bHacking);
	WORLDFRACTURECORE_API std::string DetectionStateFor(double Meter); // GREEN | YELLOW | RED
	struct FLockdownStatus { std::string Tier; const char* Label = ""; const char* Response = ""; };
	WORLDFRACTURECORE_API FLockdownStatus LockdownStatus(double Meter); // MONITORING | DRONE_TRACKING | INTERCEPTION | LOCKDOWN_PURGE
	WORLDFRACTURECORE_API double StepHackProgress(double Progress, double Dt, const std::string& Detection);
	inline bool HackComplete(double Progress) { return Progress >= 100; }

	// ---- perimeter turrets (sim.ts) ----
	struct FRegionCircle { std::string Id, Kind; double X = 0, Z = 0, Radius = 0; };
	struct FTurret { double X = 0, Z = 0; std::string Zone; double Cool = 0, Flash = 0, Rot = 0, Range = 0; };
	/** createSim: 8 turrets on each safe zone's rim, 5 on each starter zone's; Cool0 gives each its first cooldown (Math.random) */
	WORLDFRACTURECORE_API std::vector<FTurret> MakeTurrets(const std::vector<FRegionCircle>& Regions, double (*Cool0)());
	/** the turrets of the Nexus zone as sensors, at three quarters of their range */
	WORLDFRACTURECORE_API std::vector<FSensor> NexusSensors(const std::vector<FTurret>& Turrets);
	struct FTurretTarget { double X = 0, Z = 0; bool bAlive = true, bLiving = false; };
	struct FTurretShot { int Target = -1; double Damage = 2, KnockX = 0, KnockZ = 0; };
	/** one turret's step: track the nearest hostile in range, fire every 0.9 s for 2 damage and an 8 m/s shove outward */
	WORLDFRACTURECORE_API std::optional<FTurretShot> StepTurret(FTurret& T, const std::vector<FTurretTarget>& Targets, double Dt);

	// ---- quest signals (quest-signals.ts) ----
	inline constexpr double MaxSurviveDt = 0.5;
	struct FQuestHud { std::string RegionId; int HeatLevel = 1; std::string LockdownTier = "MONITORING"; double HackProgress = 0; bool bDiving = false; double Kills = 0; double Hp = 100; };
	struct FQuestSignals { std::string Region; int HeatLevel = 1; std::string LockdownTier = "MONITORING"; bool bHackDone = false; std::optional<double> Kills; };
	struct FSignalEvent { std::string Type; std::string World; double Number = 0; std::string Tier; }; // ENTER_WORLD HEAT_LEVEL LOCKDOWN_TIER HACK_COMPLETE KILL SURVIVED
	WORLDFRACTURECORE_API std::vector<FSignalEvent> QuestEventsFromHud(FQuestSignals& Signals, const FQuestHud& Hud, double Dt);
}
