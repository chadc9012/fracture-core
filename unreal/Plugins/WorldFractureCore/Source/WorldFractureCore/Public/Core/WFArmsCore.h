// World Fracture — the on-foot heavy arms: the Fracture Blade (three-step combo, the monoblades' damage, reach,
// finisher shockwave and deflect window), the four launchers (Breacher, Cinder, Frostbite, Vitriol) on the ordnance
// rules, and knockback on enemies.
//
// Port of the web build's authoritative rules:
//   melee-arc.ts   inSwordArc (150-degree arc, height check)
//   foundries.ts   BLADES, ownsBlade, activeBlade, swingStats, inShockwave
//   launchers.ts   LAUNCHERS (ordnance, element, guidance), fired through ordnance.ts fireRound (WFVehicleWeaponsCore)
//   Scene.tsx      the sword step (combo counter, 0.9 s combo window, knock x8 outward, 0.6 s stagger) and fireLauncher's aim
//   sim.ts         knockback integration (bosses divide by boss-poise.ts BOSS_KNOCK_MASS, decay e^-3t), bullet and
//                  splash knock
// Golden-tested (Tests/ArmsCoreTest.cpp); the combo counter and knockback integration are transcribed.
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFVehicleWeaponsCore.h"

#include <optional>
#include <string>
#include <vector>

namespace wf::arms
{
	// ---- the sword ----
	inline constexpr double MeleeHalfArc = 75 * 3.141592653589793 / 180, MeleeHeight = 2.5;
	struct FSwingBody { double X = 0, Z = 0, Feet = 0, Yaw = 0; };
	struct FSwingTarget { double X = 0, Z = 0, Feet = 0, Scale = 1; };
	WORLDFRACTURECORE_API bool InSwordArc(const FSwingBody& P, const FSwingTarget& E, double Reach);

	struct FShockwave { double Length = 0, Width = 0, Damage = 0; };
	struct FBlade
	{
		std::string Id, Name, Foundry, Rarity, Perk;
		double Damage = 1, Armored = 1, Reach = 0;
		std::optional<FShockwave> Shockwave;
		double Deflect = 0;
	};
	WORLDFRACTURECORE_API const std::vector<FBlade>& Blades();
	WORLDFRACTURECORE_API std::string BladeKey(const std::string& Id); // blade:<id>, the claim in earnedRewards
	/** the equipped blade, only while it is still owned */
	WORLDFRACTURECORE_API const FBlade* ActiveBlade(const std::vector<std::string>& EarnedRewards, const std::optional<std::string>& Equipped);
	struct FSwing { double Damage = 0, Reach = 0; std::optional<FShockwave> Shockwave; double Deflect = 0; };
	WORLDFRACTURECORE_API FSwing SwingStats(const FBlade* Blade, int Combo, double BaseDamage, double BaseReach, bool bArmored);
	WORLDFRACTURECORE_API bool InShockwave(const FShockwave& Sw, double Ox, double Oz, double Yaw, double X, double Z);

	/** Scene.tsx: the combo counter. A swing advances 1 -> 2 -> 3 -> 1 and opens a 0.9 s window; letting it lapse resets to 0. */
	struct FCombo { int Step = 0; double Window = 0; double Cool = 0; };
	inline constexpr double ComboWindow = 0.9, SwingKnock = 8, SwingStagger = 0.6;
	WORLDFRACTURECORE_API void TickCombo(FCombo& C, double Dt);
	/** a swing if the blade is ready (FireRate s between swings); returns the combo step it lands as, or 0 */
	WORLDFRACTURECORE_API int Swing(FCombo& C, double FireRate);
	/** the plain swing's reach: 6 m, the finisher 8 m (before the blade's bonus) */
	inline double BaseReachFor(int Combo) { return Combo == 3 ? 8 : 6; }

	// ---- launchers ----
	struct FLauncher
	{
		std::string Id, Element, Fx;
		bool bGuided = false;
		double LockCone = 0, LockRange = 0;
		vweapons::FOrdnanceDef Ordnance;
	};
	WORLDFRACTURECORE_API const std::vector<FLauncher>& Launchers();
	WORLDFRACTURECORE_API const FLauncher* LauncherById(const std::string& Id);
	/** sim.ts fireLauncher: the round flies along (yaw, pitch) carrying Damage; a guided launcher locks the nearest live
	 *  candidate inside its cone (Target, -1 = none) */
	struct FLaunch { vweapons::FRound Round; int Target = -1; };
	WORLDFRACTURECORE_API FLaunch FireLauncher(const FLauncher& L, const vweapons::FVec& From, double Yaw, double Pitch, double Damage, const std::vector<vweapons::FCandidate>& Cands);

	// ---- knockback (sim.ts) ----
	inline constexpr double BossKnockMass = 14;
	/** moves by the knock velocity for Dt (a boss by a fourteenth of it) and decays it by e^-3dt; returns the step */
	WORLDFRACTURECORE_API vweapons::FVec StepKnock(double& Kx, double& Kz, double Dt, bool bBoss);
	/** a bullet's shove: its velocity x 0.06 x the weapon's knock */
	inline void BulletKnock(double& Kx, double& Kz, double Vx, double Vz, double Knock) { Kx += Vx * 0.06 * Knock; Kz += Vz * 0.06 * Knock; }
}
