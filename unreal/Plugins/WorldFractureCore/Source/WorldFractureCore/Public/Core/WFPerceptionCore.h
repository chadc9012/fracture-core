// World Fracture — enemy perception: the awareness state machine (PATROL -> SUSPICIOUS -> ALERT -> SEARCH -> PATROL),
// sight and hearing, the wounded-trooper cover retreat, the chance a ranged shot lands, and the trooper tuning.
//
// Port of the web build's authoritative rules:
//   enemy-perception.ts  createAi, sightRange, awarenessGain, stepAwareness, shouldTakeCover, pickCover
//   enemy-tuning.ts      aggroRadius, trooperSpeed, windupFor, rangedCooldownFor
//   line-of-sight.ts     enemyHitChance
//   sim.ts               the per-machine perception step that feeds them (forced alert for bosses, mission targets and a
//                        badly hurt player close by; the aggro-scaled sight; noise from gunfire and combat heat)
// Golden-tested (Tests/PerceptionCoreTest.cpp); PerceiveStep is the sim.ts glue, transcribed.
#pragma once

#include "Core/WFCoreApi.h"

#include <string>

namespace wf::perception
{
	inline constexpr double SuspiciousAt = 0.3, AlertAt = 1, SearchSeconds = 8, BaseSight = 85;
	/** sim.ts: past this the line of sight is not traced and the enemy is treated as able to see */
	inline constexpr double LosRange = 160;

	struct FAi
	{
		std::string State = "PATROL"; // PATROL | SUSPICIOUS | ALERT | SEARCH
		double Awareness = 0, LastX = 0, LastZ = 0, HomeX = 0, HomeZ = 0, WpX = 0, WpZ = 0, Timer = 0, CoverX = 0, CoverZ = 0, CoverTime = 0, LastHp = 0;
	};
	WORLDFRACTURECORE_API FAi CreateAi(double X, double Z, double Hp);

	/** night 0..1 cuts sight to 55%, weather visibility down to its value (floor 0.25), elites see 30% further */
	WORLDFRACTURECORE_API double SightRange(double Night, double Visibility, bool bElite);

	struct FStimulus
	{
		double Distance = 0, Sight = 0;
		double Noise = 0;      // 0..1
		bool bDamaged = false;
		bool bFacing = false;  // the enemy faces roughly toward the player
		bool bInView = true;   // no terrain, building or cover in between (hearing still works)
	};
	WORLDFRACTURECORE_API double AwarenessGain(const FStimulus& S);
	WORLDFRACTURECORE_API std::string StepAwareness(FAi& Ai, const FStimulus& S, double Px, double Pz, double Dt);

	WORLDFRACTURECORE_API bool ShouldTakeCover(double HpFraction, double CoverTime, bool bBoss);
	struct FPoint { double X = 0, Z = 0; };
	WORLDFRACTURECORE_API FPoint PickCover(double Mx, double Mz, double Px, double Pz, double Side);

	/** 38% point blank to 14% at the edge of range, less against a fast mover, a crouch (x0.75) or prone (x0.55) */
	WORLDFRACTURECORE_API double EnemyHitChance(double Distance, double Range, double PlayerSpeed, const std::string& Stance = "STAND");

	// ---- trooper tuning (enemy-tuning.ts) ----
	inline constexpr double RangedRange = 40, MeleeCooldown = 1.4;
	WORLDFRACTURECORE_API double AggroRadius(double Night, bool bElite, double RadiusMod, double Aggression);
	WORLDFRACTURECORE_API double TrooperSpeed(double Night, bool bElite);
	WORLDFRACTURECORE_API double WindupFor(bool bBoss, bool bElite);
	WORLDFRACTURECORE_API double RangedCooldownFor(bool bBoss, bool bElite);

	// ---- the sim.ts perception step ----
	struct FPerceiveInput
	{
		double Hp = 0;                  // the enemy's health now
		double X = 0, Z = 0, Rot = 0;   // the enemy (rules metres; rot = atan2 facing)
		double Px = 0, Pz = 0;          // the player
		bool bElite = false, bBoss = false, bMission = false;
		double Night = 0, Visibility = 1;
		double StealthMult = 1;         // the Operator's concealment (Phase Veil)
		double Aggro = 48;              // AggroRadius for this enemy
		double PlayerHp = 100;
		double PlayerNoise = 0;         // 1 right after gunfire, decaying 1.5 per second
		double CombatHeat = 0;
		bool bLineClear = true;         // the traced line of sight (ignored beyond LosRange)
	};
	struct FPerceiveResult { std::string State; bool bDamaged = false; };
	/** One frame of sim.ts's awareness block: resets the AI when the enemy was healed, then forced alert or stepAwareness. */
	WORLDFRACTURECORE_API FPerceiveResult PerceiveStep(FAi& Ai, const FPerceiveInput& In, double Dt);
}
