// World Fracture — casting the bonded Operator's Dragonite abilities against the world, and ability energy.
//
// Port of the web build's dragonite-cast.ts (castDragonite / stepDragonite: Dragonfire cones and eruption, Wyrmwing
// launch / glide / air dashes, Dragonhide resistance, Roar of Ruin stagger / knockback / vulnerability, Scalebreaker
// strikes and shield break, Skyfall's delayed dive, Wyrmcall and the ally's attacks), sim.ts stunMachine /
// applyVulnPulse, and live-build.ts energy regeneration. Golden-tested against those (Tests/DragoniteCastCoreTest.cpp).
//
// The engine owns damage pricing and deaths: the core calls IWorld::DamageMods for the damage a hit really deals (boss
// rules, vulnerability) and IWorld::Defeat when a machine's hp reaches 0.
#pragma once

#include "Core/WFDragonCore.h"
#include "Core/WFProgression.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::dragoncast
{
	inline constexpr double EnergyMax = 100, EnergyRegenPerSec = 9;
	inline constexpr double BossStunCap = 1.4; // null-disruption.ts NULL_PULSE_STUN_SECONDS
	inline constexpr double WyrmSight = 40;    // metres

	/** What the casts read and change on an enemy (sim.ts Machine fields). Metres on the ground plane. */
	struct FMachine
	{
		bool bAlive = true;
		double X = 0, Z = 0, Hp = 3;
		bool bBoss = false;
		double Aim = 0;   // > 0 while winding up a shot
		double Cool = 0;  // stun / attack cooldown
		double VulnUntil = 0, VulnMult = 1;
	};

	class IWorld
	{
	public:
		virtual ~IWorld() = default;
		/** sim.ts applyMachineDamageMods: the damage a hit of Dmg really deals to machine I. */
		virtual double DamageMods(std::vector<FMachine>& Machines, size_t I, double Dmg, const std::string& Element, double X, double Z) = 0;
		/** sim.ts defeatMachine: machine I reached 0 hp (the engine pays it, or applies an hp floor). */
		virtual void Defeat(std::vector<FMachine>& Machines, size_t I) = 0;
		virtual void Alert(const std::string& Text) { (void)Text; }
		virtual void Noise() {}
	};

	void StunMachine(FMachine& M, double Seconds);
	void ApplyVulnPulse(std::vector<FMachine>& Machines, double X, double Z, double Radius, double Mult, double Duration, double Now);
	/** live-build.ts tickLiveBuild: energy refills 9 per second up to 100 (Rate: haste / ability-recharge factor). */
	double RegenEnergy(double Energy, double Dt, double Rate = 1);

	struct FSkyfall
	{
		double X = 0, Z = 0, Left = 0, Fury = 1;
		dragon::FStats Stats;
	};
	struct FRuntime
	{
		std::map<std::string, double> Cd; // per ability, seconds
		std::optional<FSkyfall> Pending;
		double Hide = 0;
		std::optional<dragon::FStats> HideStats;
		double Glide = 0, AirDashes = 0, LandingStrike = 0;
		dragon::FWyrm Wyrm;
		FRuntime();
	};
	struct FPose
	{
		double X = 0, Z = 0, Yaw = 0;
	};
	struct FContext
	{
		const FProgression* Progression = nullptr; // earnedRewards, inventory, equipped gear
		std::optional<std::string> Class;
		double Fury = 0; // Vyrak's mood bonus (vyrak-personality.ts), small
	};
	struct FCastOutcome
	{
		bool bOk = false;
		std::string Text;
		std::optional<double> LaunchVy, GlideSeconds, AirDashes;
	};
	const char* AbilityName(const std::string& Id);

	FCastOutcome CastDragonite(FRuntime& Rt, IWorld& World, std::vector<FMachine>& Machines, double& Energy, const std::string& Id, const FPose& Pose, bool bGrounded, const FContext& Ctx, double Now);

	struct FStepResult
	{
		double Resist = 0, Stagger = 0;
		bool bGliding = false;
	};
	FStepResult StepDragonite(FRuntime& Rt, IWorld& World, std::vector<FMachine>& Machines, double Dt, const FPose& Pose, const FContext& Ctx);
}
