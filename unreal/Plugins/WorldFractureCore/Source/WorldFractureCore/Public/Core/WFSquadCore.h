// World Fracture — the AI squadmates VEX and HOLT: two troopers who run in formation beside the Operator and lay down
// support fire. Pure rules: formation, target choice, fire cadence and hit rolls; the host applies the returned hits.
//
// Boundaries, so the squad can never farm or replace the player: they shoot only while the player is in a fight (combat heat
// at least 0.5, on foot) and only at enemies within 34 m of the PLAYER; their damage is support-sized (2.2 a second each) and
// never takes a boss below a quarter of its max health, so a boss kill is always the player's; they cannot be hurt and never
// enter vehicles (left more than 60 m behind, they catch up at once).
//
// Port of the web build's squad.ts (createSquad, formationSlot, pickTarget, squadDamage, stepSquad). Golden-tested
// (Tests/SquadCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"

#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace wf::squad
{
	struct FMate
	{
		double Id = 0;
		std::string Name;
		double X = 0, Z = 0, Yaw = 0;
		double Speed = 0; // ground speed this frame (m/s): the run cycle
		double Cool = 0, Target = -1, Firing = 0;
	};
	struct FShot { double Id = 0, FromX = 0, FromZ = 0, ToX = 0, ToZ = 0; bool bHit = false; double At = 0; };
	struct FState { bool bEnabled = true; std::vector<FMate> Mates; std::vector<FShot> Shots; double NextShot = 1, Clock = 0; };
	struct FTarget { double X = 0, Z = 0; bool bAlive = true, bBoss = false; double Hp = 0; std::optional<double> MaxHp; bool bDecoy = false; };
	struct FHit { int Index = 0; double Damage = 0; };

	inline const char* const Names[2] = {"VEX", "HOLT"};
	/** formation offsets in the player's frame: right, back (metres) */
	inline constexpr double Formation[2][2] = {{-3.2, -2.6}, {3.4, -3.4}};
	inline constexpr double EngageRange = 34, SquadDps = 2.2, FireInterval = 0.22, BurstRest = 0.9, HitChance = 0.6, BossFloor = 0.25, EngageHeat = 0.5;
	inline constexpr int Burst = 5;

	WORLDFRACTURECORE_API FState CreateSquad(double Px, double Pz, bool bEnabled = true);
	struct FSlot { double X = 0, Z = 0; };
	/** where mate I stands for a player at (Px, Pz) facing Yaw (0 = +z) */
	WORLDFRACTURECORE_API FSlot FormationSlot(int I, double Px, double Pz, double Yaw);
	/** the nearest living, non-decoy target within EngageRange of the player, measured from the mate; -1 = none */
	WORLDFRACTURECORE_API int PickTarget(const std::vector<FTarget>& Targets, double Mx, double Mz, double Px, double Pz);
	/** a squad round's damage to T (bosses are floored so the squad never lands a boss kill) */
	WORLDFRACTURECORE_API double SquadDamage(const FTarget& T, double Dmg);
	struct FInput { double Px = 0, Pz = 0, Yaw = 0, Dt = 0, Heat = 0; bool bInVehicle = false; std::function<double()> Rand; };
	/** one step: moves the mates, fires, and returns the hits for the host to apply */
	WORLDFRACTURECORE_API std::vector<FHit> StepSquad(FState& Squad, const std::vector<FTarget>& Targets, const FInput& In);
}
