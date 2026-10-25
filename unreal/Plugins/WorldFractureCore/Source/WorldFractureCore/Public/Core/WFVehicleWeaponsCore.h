// World Fracture — vehicle hardpoints and ordnance.
//
// Port of the web build's authoritative rules:
//   vehicle-weapons.ts  armamentFor (per handling class, per vehicle, per fleet build), vehiclePoint (muzzles in the
//                       vehicle's frame), aimFor (turrets follow the camera, fixed guns the nose, converging), vehicleVelocity
//   ordnance.ts         the ordnance catalogue, fireRound / stepRound (guided turn-rate steering, proximity / ground /
//                       timeout bursts), splashDamage
//   launchers.ts        pickLockTarget (the nearest machine in a forward cone)
//   sim.ts              fireBullet's round (muzzle velocity + inherited velocity, life), fireOrdnance's launch, the shared
//                       weapon heat (11 per vehicle round x the gun's heat, overheat at 100, venting 22/s, cooling 34/s)
//   chase-ai.ts         vehicleDamageStage / VEHICLE_DAMAGE_EFFECT.weaponsDisabled
//   Scene.tsx           the vehicle fire loop: primary trigger, the secondary gun or the ordnance salvo, barrel rotation
// Golden-tested (Tests/VehicleWeaponsCoreTest.cpp).
//
// Not ported: the non-gun gadget hardpoints of fleet builds (vehicle-gadgets.ts), which need the fleet catalogue.
#pragma once

#include "Core/WFCoreApi.h"

#include <array>
#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace wf::vweapons
{
	using FOffset = std::array<double, 3>; // right, up, forward (m)

	struct FGun
	{
		std::string Name;
		double Rate = 0.12, Damage = 1, Spread = 0.012, Speed = 160, Knock = 1, Heat = 0.6;
		std::vector<FOffset> Muzzles;
		std::string Mount = "FIXED"; // TURRET | FIXED
		double PitchAssist = 0.18, Converge = 0;
		std::string Sound = "VEHICLE"; // VEHICLE | AUTO | PULSE
		std::optional<double> Shell;   // cannon shells: splash radius (m)
	};
	struct FOrdnanceMount
	{
		std::string Ordnance, Name;
		double Rate = 0;
		int Salvo = 1;
		double SalvoGap = 0, Damage = 0;
		std::vector<FOffset> Muzzles;
		std::string Mount = "FIXED";
	};
	struct FArmament
	{
		std::optional<FGun> Primary;
		std::optional<FOrdnanceMount> Secondary;
		std::optional<FGun> SecondaryGun;
	};
	/** Kind: RACER OFFROAD TANK JET HELI BOAT SUB. BuildId: a fleet.ts build, or "" for the bare chassis. */
	WORLDFRACTURECORE_API FArmament ArmamentFor(const std::string& VehicleId, const std::string& Kind, const std::string& BuildId = "");
	/** The fleet builds with their own hardpoints (vehicle-weapons.ts BY_BUILD keys). */
	WORLDFRACTURECORE_API std::vector<std::string> BuildIds();

	struct FVec { double X = 0, Y = 0, Z = 0; };
	struct FPose { double X = 0, Y = 0, Z = 0, Yaw = 0, Pitch = 0, Roll = 0; };
	WORLDFRACTURECORE_API FVec VehiclePoint(const FPose& P, const FOffset& Local);
	struct FAim { double Yaw = 0, Pitch = 0; };
	WORLDFRACTURECORE_API FAim AimFor(const std::string& Mount, const FPose& Pose, double CamYaw, double CamPitch, double PitchAssist, const FVec& Muzzle, double Converge);
	WORLDFRACTURECORE_API FVec VehicleVelocity(double Yaw, double Speed, double Vy);

	// ---- ordnance ----
	struct FOrdnanceDef
	{
		std::string Id, Kind, Name; // Kind: ROCKET MISSILE TORPEDO
		double Speed = 0, TurnRate = 0, Life = 0, SplashRadius = 0, Damage = 0, Proximity = 0;
		std::string Domain = "ANY"; // AIR LAND WATER ANY
	};
	WORLDFRACTURECORE_API const std::vector<FOrdnanceDef>& Ordnance();
	WORLDFRACTURECORE_API const FOrdnanceDef* OrdnanceById(const std::string& Id);
	/** A gun's cannon shell as ordnance (Scene.tsx: flat, fast, bursts with the gun's splash). */
	WORLDFRACTURECORE_API FOrdnanceDef CannonShell(const FGun& G);
	struct FRound
	{
		bool bAlive = false;
		FOrdnanceDef Def;
		double X = 0, Y = 0, Z = 0, Dx = 0, Dy = 0, Dz = 0, Age = 0;
		int Target = -1;
		double Knock = 2;
	};
	WORLDFRACTURECORE_API FRound FireRound(const FOrdnanceDef& Def, const FVec& From, const FVec& Aim);
	struct FBurst { double X = 0, Y = 0, Z = 0, Radius = 0, Damage = 0; std::string Reason; };
	WORLDFRACTURECORE_API std::optional<FBurst> StepRound(FRound& R, double Dt, const std::optional<FVec>& Target, const std::function<double(double, double)>& Ground);
	WORLDFRACTURECORE_API double SplashDamage(const FBurst& B, double Distance);
	struct FCandidate { double X = 0, Z = 0; bool bAlive = true; };
	WORLDFRACTURECORE_API int PickLockTarget(double FromX, double FromZ, double Yaw, const std::vector<FCandidate>& Cands, double Cone, double Range);
	/** sim.ts fireOrdnance's round: speed + carry, damage dmg x bulletDamage, a lock for guided rounds (cone 0.5, 260 m
	 *  for missiles, 120 m otherwise). */
	WORLDFRACTURECORE_API FRound LaunchOrdnance(const FOrdnanceDef& Def, const FVec& From, double Yaw, double Pitch, double Damage, double Carry, double Knock, const std::vector<FCandidate>& Cands);

	// ---- bullets and heat ----
	struct FBullet { FVec Pos, Vel; double Life = 0, Damage = 0, Knock = 1; };
	WORLDFRACTURECORE_API FBullet MakeBullet(const FVec& From, double Yaw, double Pitch, double Speed, const FVec& Inherit, double Damage, double Knock);
	inline constexpr double HeatPerShotVehicle = 11, HeatPerShotFoot = 7;
	struct FHeat { double Heat = 0; bool bOverheated = false; };
	/** Adds a shot's heat; true when it tipped the guns into an overheat. */
	WORLDFRACTURECORE_API bool AddHeat(FHeat& H, double Amount);
	WORLDFRACTURECORE_API double BulletHeat(double GunHeat);
	WORLDFRACTURECORE_API double OrdnanceHeat(const FOrdnanceDef& Def);
	/** Cooling each step; true when an overheat just ended. */
	WORLDFRACTURECORE_API bool CoolHeat(FHeat& H, double Dt);

	/** chase-ai.ts vehicleDamageStage(100 - body damage): NOMINAL LIGHT MEDIUM HEAVY CRITICAL; HEAVY and CRITICAL
	 *  (VEHICLE_DAMAGE_EFFECT.weaponsDisabled) silence the hardpoints. */
	WORLDFRACTURECORE_API const char* DamageStage(double BodyDamage);
	WORLDFRACTURECORE_API bool WeaponsDisabled(double BodyDamage);

	// ---- the fire loop (Scene.tsx, vehicle branch) ----
	struct FFireState
	{
		double Cool = 0, GunCool = 0, SecCool = 0, SalvoCool = 0;
		int SalvoLeft = 0, Barrel = 0, GunBarrel = 0, PodBarrel = 0;
	};
	struct FShot
	{
		std::string Slot; // PRIMARY | SECONDARY_GUN | ORDNANCE
		FOffset Muzzle{};
	};
	/** One frame: the shots this frame fires. bBlocked (overheated, weapons disabled) still runs the timers.
	 *  FireRateMod is sim.mods.fireRate. */
	WORLDFRACTURECORE_API std::vector<FShot> StepFire(const FArmament& A, FFireState& S, bool bTrigger, bool bSecondary, double Dt, double FireRateMod, bool bBlocked);
}
