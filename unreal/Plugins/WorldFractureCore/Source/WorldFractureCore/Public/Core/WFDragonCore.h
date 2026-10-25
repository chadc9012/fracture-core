// World Fracture — Dragonite abilities, Vyrak trust and dragon riding (per Operator class).
//
// Port of the web build's authoritative rules:
//   dragonite.ts       upgradeLevel / upgradeDragonite, wornCovenant / armorBonus, appearanceStage, dragoniteStats,
//                      cappedResist, the Wyrmcall ally (createWyrm / summonWyrm / stepWyrm)
//   dragonite-cast.ts  statsFor (the numbers an Operator's cast uses)
//   vyrak-trust.ts     trustOf / trustStage, recordTrust, claimAncientBond, claimEternalCovenant, canRide, stepFlight
// Everything lives in earnedRewards keys, per class, so one Operator's progress never unlocks another's:
//   dragonite-up:<CLASS>:<ability>:<n>, vyrak-ruin|puzzle|protect:<CLASS>:<id>, vyrak-riding:<CLASS>, vyrak-eternal:<CLASS>.
// Golden-tested against those functions (Tests/DragonCoreTest.cpp).
//
// Not ported: the casts themselves against the world (cone damage, burn, knockback in dragonite-cast.ts), and Vyrak's
// voice lines (vyrak-personality.ts).
#pragma once

#include "Core/WFCoreApi.h"

#include "Core/WFProgression.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::dragon
{
	inline constexpr int MaxUpgrade = 4;
	inline constexpr double UpgradeCost[MaxUpgrade] = {3, 6, 10, 15}; // Dragonite material
	inline constexpr double ResistCap = 0.5;
	inline constexpr double FullTrust = 100;
	inline constexpr int EternalChallenges = 3;

	/** dragonfire, wyrmwing, dragonhide, wyrmcall, roar, scalebreaker, skyfall (dragonite.ts DRAGONITE order). */
	extern WORLDFRACTURECORE_API const char* const AbilityIds[7];
	struct FAbilityDef
	{
		const char* Id;
		double Cooldown;
		double Energy;
		double Windup;
	};
	WORLDFRACTURECORE_API const FAbilityDef* FindAbility(const std::string& Id);

	WORLDFRACTURECORE_API int UpgradeLevel(const FProgression& P, const std::string& Class, const std::string& Ability);
	/** Spends Dragonite on the next upgrade. Error text (as the web build words it) when it cannot. */
	struct FUpgradeResult
	{
		FProgression Progression;
		std::optional<std::string> Error;
	};
	WORLDFRACTURECORE_API FUpgradeResult UpgradeDragonite(FProgression P, const std::optional<std::string>& Class, const std::string& Ability);

	/** Slots of the worn Vyrak's Covenant pieces (set dragons-covenant), in inventory order. */
	WORLDFRACTURECORE_API std::vector<std::string> WornCovenant(const std::vector<FGearItem>& Inventory, const std::map<std::string, std::string>& Equipped);
	struct FArmorBonus
	{
		double EnergyCost = 0, Stagger = 0, BurnChance = 0, AirControl = 0, SummonTime = 0, Potency = 0;
		std::optional<std::string> Enhanced;
		bool bAura = false;
	};
	WORLDFRACTURECORE_API FArmorBonus ArmorBonus(const std::vector<std::string>& Worn, const std::optional<std::string>& Enhance = std::nullopt);
	WORLDFRACTURECORE_API int AppearanceStage(double Clears);

	/** Ability numbers (cooldown, energy, damage, range, ...) keyed as the web build names them. */
	using FStats = std::map<std::string, double>;
	WORLDFRACTURECORE_API FStats DragoniteStats(const std::string& Ability, double Level, const FArmorBonus& Armor);
	/** dragonite-cast.ts statsFor: the class's upgrade level and worn Covenant pieces. */
	WORLDFRACTURECORE_API FStats StatsFor(const FProgression& P, const std::string& Class, const std::string& Ability);
	WORLDFRACTURECORE_API double CappedResist(double ArmorResist, double Dragonhide);

	// ---- Wyrmcall ally ----
	enum class EWyrmState { Bonded, Approach, Assess, Attack, Defend, Withdraw, Recovery };
	WORLDFRACTURECORE_API const char* WyrmStateName(EWyrmState S);
	struct FWyrm
	{
		EWyrmState State = EWyrmState::Bonded;
		double T = 0, Left = 0, StrafesLeft = 0;
		std::optional<double> Target;
		double Cooldown = 0;
		bool bFinished = false;
	};
	struct FWyrmTarget
	{
		double Id = 0, Dist = 0;
		bool bBoss = false, bWindingUp = false;
	};
	struct FWyrmAction
	{
		std::string Kind; // strafe | breath | interrupt | finisher
		double Target = 0;
	};
	WORLDFRACTURECORE_API bool SummonWyrm(FWyrm& W, const FStats& Stats);
	WORLDFRACTURECORE_API std::optional<FWyrmAction> StepWyrm(FWyrm& W, double Dt, const std::vector<FWyrmTarget>& Targets, const FStats& Stats);
	inline constexpr double ApproachTime = 1.2, AttackTime = 1.6, AssessTime = 0.5, WithdrawTime = 1.0;

	// ---- trust and riding ----
	struct FTrust
	{
		double Challenge = 0, Encounter = 0, Ruin = 0, Puzzle = 0, Protect = 0, Total = 0;
	};
	WORLDFRACTURECORE_API FTrust TrustOf(const FProgression& P, const std::optional<std::string>& Class);
	/** 0 no bond, 1 (unused here), 2 Companion, 3 Proven Covenant, 4 Ancient Bond, 5 Eternal Covenant. */
	WORLDFRACTURECORE_API int TrustStage(const FProgression& P, const std::optional<std::string>& Class);
	/** Kind: ruin | puzzle | protect. One-time per id. */
	WORLDFRACTURECORE_API FProgression RecordTrust(FProgression P, const std::optional<std::string>& Class, const std::string& Kind, const std::string& Id);
	WORLDFRACTURECORE_API FGearItem AncientBondGear(const std::string& Class);
	WORLDFRACTURECORE_API FGearItem EternalGear(const std::string& Class);
	struct FClaimResult
	{
		FProgression Progression;
		bool bOk = false;
		std::optional<std::string> Reason;
	};
	WORLDFRACTURECORE_API FClaimResult ClaimAncientBond(FProgression P, const std::optional<std::string>& Class);
	WORLDFRACTURECORE_API FClaimResult ClaimEternalCovenant(FProgression P, const std::optional<std::string>& Class);

	struct FRideContext
	{
		std::optional<std::string> RegionId;
		bool bInDungeon = false, bInStoryMission = false, bIndoors = false;
	};
	struct FRideCheck
	{
		bool bOk = false;
		std::optional<std::string> Reason;
	};
	WORLDFRACTURECORE_API FRideCheck CanRide(const FProgression& P, const std::optional<std::string>& Class, const FRideContext& Ctx);

	/** Riding flight model, metres and radians (vyrak-trust.ts FLIGHT / stepFlight). */
	struct FFlight
	{
		double X = 0, Y = 0, Z = 0, Yaw = 0, Pitch = 0, Bank = 0, Speed = 24;
	};
	inline constexpr double FlightMin = 8, FlightCruise = 24, FlightMax = 42, FlightCeiling = 140, FlightClimbMax = 0.7, FlightDiveMax = 0.9, FlightTurnRate = 1.2;
	WORLDFRACTURECORE_API FFlight CreateFlight(double X, double Y, double Z, double Yaw);
	/** GroundAt is the terrain height under (x, z); a non-finite value means unknown ground. */
	template <typename FGroundAt>
	WORLDFRACTURECORE_API FFlight StepFlight(const FFlight& F, double InPitch, double InTurn, double InThrottle, double Dt, FGroundAt&& GroundAt);
	/** The non-template part: everything up to the terrain clamp. */
	WORLDFRACTURECORE_API bool StepFlightAir(const FFlight& F, double InPitch, double InTurn, double InThrottle, double Dt, FFlight& Out);

	template <typename FGroundAt>
	FFlight StepFlight(const FFlight& F, double InPitch, double InTurn, double InThrottle, double Dt, FGroundAt&& GroundAt)
	{
		FFlight Out;
		if (!StepFlightAir(F, InPitch, InTurn, InThrottle, Dt, Out)) return F;
		const double Terrain = GroundAt(Out.X, Out.Z);
		const double Floor = (Terrain == Terrain && Terrain - Terrain == 0 ? Terrain : F.Y - 2) + 2; // finite check without <cmath>
		if (Out.Y < Floor) Out.Y = Floor; // terrain collision: skim, never clip through
		return Out;
	}
}
