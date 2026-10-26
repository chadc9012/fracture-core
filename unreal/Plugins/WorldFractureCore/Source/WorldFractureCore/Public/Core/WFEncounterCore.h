// World Fracture — boss fights: poise and weak points, regional boss phases, Unique Scenario gimmicks, and the authored
// multi-phase encounters (Dark Knight, Rime Alpha, Drowned Monarch, Hollow Saint, Vaelith, Vyrak).
//
// Port of the web build's authoritative rules:
//   boss-poise.ts         decayPoise / hitPoise / openWeakPoint / isStaggered / isWeakPointOpen
//   boss-phases.ts        phaseForHpFraction / tuningFor (regional bosses' three phases)
//   scenario-gimmicks.ts  gimmickMultiplier (poise / adaptive / attune / closing)
//   sim.ts                applyMachineDamageMods, boss half (poise multiplier, outside-window immunity, gimmick, hit count)
//   scenario-encounters.ts + encounter-sim.ts   the encounter state machine: tells, impacts with real hit geometry,
//                         punish windows, phase changes, hazard zones, False Saint decoys, Vaelith's truce, the finale
//                         window and its hp floor, reset on player death
// Golden-tested against those functions (Tests/EncounterCoreTest.cpp).
//
// The engine owns the world: it moves bosses between attacks, applies the player hits this core reports, spawns actors
// for the decoys it lists, and calls ResetEncounters when the player dies.
#pragma once

#include "Core/WFCoreApi.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::encounter
{
	// ---- poise (boss-poise.ts) ----
	inline constexpr double PoiseMax = 100, PoiseDecayPerSec = 4, WeakPointDuration = 5, StaggerDuration = 4;
	/** Boss pacing (boss-poise.ts): hull for a fight of about a minute, poise from sustained fire, no poise for a few
	 *  seconds after a stagger, and bosses barely shoved by knockback. */
	inline constexpr double BossHpRegional = 360, BossHpScenario = 520, PoisePerDamage = 1.6, PoiseRefractory = 6, BossKnockMass = 14;
	inline constexpr double WeakPointDamageMult = 1.6, StaggerDamageMult = 2.25;
	struct FPoise
	{
		double Poise = 0, StaggerUntil = 0, WeakPointUntil = 0;
	};
	WORLDFRACTURECORE_API FPoise DecayPoise(const FPoise& S, double Dt, double Now);
	WORLDFRACTURECORE_API FPoise HitPoise(const FPoise& S, double PoiseDamage, double Now, double& OutDamageMult);
	WORLDFRACTURECORE_API FPoise OpenWeakPoint(const FPoise& S, double Now);
	inline bool IsStaggered(const FPoise& S, double Now) { return Now < S.StaggerUntil; }
	inline bool IsWeakPointOpen(const FPoise& S, double Now) { return Now < S.WeakPointUntil; }

	// ---- regional boss phases (boss-phases.ts) ----
	struct FPhaseTuning
	{
		const char* Label;
		const char* Telegraph;
		double SpeedMult, DamageMult, CooldownMult;
	};
	WORLDFRACTURECORE_API int PhaseForHpFraction(double Fraction);
	WORLDFRACTURECORE_API const FPhaseTuning& TuningFor(int Phase);

	// ---- gimmicks (scenario-gimmicks.ts) ----
	inline constexpr double AttuneSeconds = 9, CloseRange = 14, FarRange = 34;
	inline constexpr size_t HistoryLength = 6;
	WORLDFRACTURECORE_API std::string AttunedElement(double NowSec);
	WORLDFRACTURECORE_API double GimmickMultiplier(const std::string& Gimmick, const std::string& Element, double NowSec, double Distance, std::vector<std::string>& InOutHistory);

	// ---- authored encounters (scenario-encounters.ts) ----
	struct FZoneSpec
	{
		std::string Kind;  // DAMAGE | SLOW
		double Radius = 0, Dps = 0, Slow = 1, Count = 0, Arm = 0, Life = 0;
		std::string Place; // PLAYER | RING | ORBIT
		std::optional<double> RingRadius, OrbitSpeed;
		std::string Name;
	};
	/** Troops an encounter boss calls in (scenario-encounters.ts SummonGroup): ordinary hostile enemies. */
	struct FSummonGroup
	{
		std::string Profile, Kind; // Kind: RAIDER | OVERCLOCKED | ABERRATION | VANGUARD
		double Count = 0, Hp = 0, Scale = 1;
		bool bElite = false;
	};
	struct FAttackDef
	{
		std::string Id, Kind, Label, Tell; // Kind: SLAM | LUNGE | POUNCE | FAN | FIELD | CLONES | SUMMON
		double TellTime = 0, Damage = 0, MinRange = 0, MaxRange = 0;
		std::optional<double> Radius, Width, Arc, Reach, Decoys;
		std::optional<FZoneSpec> Zones;
		std::vector<FSummonGroup> Summon;
		double Recovery = 0, Window = 0;
	};
	struct FFinale
	{
		std::string Attack;
		double Window = 0, FloorHp = 0;
		std::string Nova;
	};
	struct FPhaseDef
	{
		std::string Id, Name;
		double Below = 1;
		std::string Nova;
		std::vector<std::string> Attacks;
		double Gap = 0;
		std::optional<FZoneSpec> Arena;
		std::optional<FFinale> Finale;
	};
	struct FTruce
	{
		double Below = 0, FloorFrac = 0;
		std::string Nova;
	};
	struct FEncounterDef
	{
		std::string ScenarioId, Victory;
		std::map<std::string, FAttackDef> Attacks;
		std::vector<FPhaseDef> Phases;
		std::optional<FTruce> Truce;
	};
	/** Unique Scenario damage rules (unique-scenarios.ts outsideWindowMult / gimmick). */
	struct FScenarioRule
	{
		double OutsideWindowMult = 1;
		std::string Gimmick; // "" | poise | adaptive | attune | closing
	};
	struct FCatalog
	{
		std::map<std::string, FEncounterDef> Encounters;
		std::map<std::string, FScenarioRule> Scenarios;
		WORLDFRACTURECORE_API const FEncounterDef* Find(const std::string& Id) const;
	};

	WORLDFRACTURECORE_API int PhaseIndexFor(const FEncounterDef& Def, double HpFraction);
	WORLDFRACTURECORE_API bool InCircle(double Px, double Pz, double Cx, double Cz, double R);
	WORLDFRACTURECORE_API double DistToSegment(double Px, double Pz, double Ax, double Az, double Bx, double Bz);
	WORLDFRACTURECORE_API bool InFan(double Px, double Pz, double Ox, double Oz, double Tx, double Tz, double Arc, double Reach);

	// ---- the fight ----
	inline constexpr double EngageRange = 90;
	inline constexpr double TruceDepartSeconds = 20;
	inline constexpr size_t MaxEvents = 40;
	inline constexpr int MaxDecoys = 4;
	/** most called-in troops alive at once (encounter-sim.ts MAX_SUMMONED) */
	inline constexpr int MaxSummoned = 6;

	struct FEncounterState
	{
		int Phase = 0;
		std::string State = "IDLE"; // IDLE | TELL | RECOVER
		double Timer = 2.5;
		std::optional<std::string> Atk;
		double Cursor = 0, Tx = 0, Tz = 0, Cx = 0, Cz = 0, SinceFinale = 0, FinaleUntil = 0, TellTotal = 0;
		bool bTruce = false;
		std::optional<double> TruceAt;
	};

	/** A boss as the rules see it (sim.ts Machine fields). Positions in metres on the ground plane. */
	struct FBoss
	{
		bool bAlive = true;
		bool bBoss = true;
		double X = 0, Z = 0, Hp = 34, MaxHp = 34;
		double Cool = 0; // stun / attack cooldown: a stunned boss starts no new attack
		FPoise Poise;
		std::optional<std::string> ScenarioId;
		std::string Profile;
		std::optional<FEncounterState> Encounter;
		int RegionalPhase = 0;                   // boss-phases.ts, for bosses without an authored encounter
		std::vector<std::string> GimmickHistory;
		double PlayerHits = 0;
	};

	struct FZone
	{
		double Id = 0;
		std::string ScenarioId, Name, Kind;
		double X = 0, Z = 0, Radius = 0, Dps = 0, Slow = 1, ArmAt = 0, Until = 0;
		struct FOrbit { double Cx = 0, Cz = 0, R = 0, Ang = 0, Speed = 0; };
		std::optional<FOrbit> Orbit;
		std::string Scope; // attack | phase
	};

	struct FEvent
	{
		double Id = 0;
		std::string Kind; // TRUCE DEPART TELL IMPACT INTERRUPT PHASE ZONE FINALE DECOY DECOY_SHATTER SUMMON RESET VICTORY
		std::string ScenarioId;
		int Phase = 0;
		std::string PhaseName;
		std::optional<std::string> Attack;
		std::string Text;
		double X = 0, Z = 0, Radius = 0, Duration = 0;
		std::optional<bool> Hit;
		double At = 0;
	};

	struct FPlayerHit
	{
		double Damage = 0;
		std::string Label;
	};

	struct FDecoy
	{
		double Id = 0, X = 0, Z = 0;
	};

	/** A called-in trooper (encounter-sim.ts spawnSummons). The engine spawns a real enemy for each and reports its death. */
	struct FSummon
	{
		double Id = 0;
		std::string ScenarioId, Profile, Kind;
		double X = 0, Z = 0, Hp = 0, Scale = 1;
		bool bElite = false;
		/** the machine slot the web build gives it (the lowest free one): the skills run in slot order */
		int Slot = 0;
		double Rot = 0; // facing (atan2(dx, dz)), set by the skills
		/** summon-skills.ts SkillState: IDLE | TELL, the wind-up, cooldown, anchor, target, radius, turret life, and the position
		 *  at the end of the skill step (the pins move from there) */
		struct FSkill { std::string St = "IDLE"; double T = 0, Total = 0, Cd = 0, Ax = 0, Az = 0, Tx = 0, Tz = 0, Radius = 0, Life = 0, Ox = 0, Oz = 0; };
		std::optional<FSkill> Skill;
	};

	// ---- summon-skills.ts: the concept-art roles of Astravore's troops ----
	inline const std::string Reaver = "Void Reaver", Arcanist = "Void Arcanist", Sentinel = "Void Sentinel", Turret = "Void Turret";
	inline constexpr int MaxTurrets = 3;
	inline constexpr double TurretLife = 25;
	/** a Reaver aims just behind the player and strikes there (a flank, not a charge) */
	struct FReaverStrike { double Windup = 0.9, Radius = 3.2, Damage = 9, Cooldown = 4.5, MinRange = 1, MaxRange = 16, Behind = 2.2; };
	/** an Arcanist's orb hits where the player stood and leaves a slowing pool */
	struct FArcanistOrb { double Windup = 1.3, Radius = 6, Damage = 11, Cooldown = 6, MaxRange = 45, PoolLife = 4, PoolDps = 4, PoolSlow = 0.6; };
	struct FSentinelDeploy { double Windup = 1.0, Cooldown = 9, MaxRange = 50, Distance = 8; };
	inline constexpr FReaverStrike ReaverStrike{};
	inline constexpr FArcanistOrb ArcanistOrb{};
	inline constexpr FSentinelDeploy SentinelDeploy{};
	inline constexpr double ReaverSpeed = 9, ArcanistSpeed = 4.5, ArcanistBandMin = 16, ArcanistBandMax = 28;
	inline bool IsTurret(const FSummon& S) { return S.Profile == Turret; }
	/** Reavers and Arcanists attack only with their skills (their rifle cooldown is held at 99 s) */
	inline bool HoldsFire(const FSummon& S) { return S.Profile == Reaver || S.Profile == Arcanist; }
	/** the skills own its position: turrets, Reavers and Arcanists (StepSummonPins), so the engine's AI must not move it */
	inline bool IsPinned(const FSummon& S) { return S.Skill && (IsTurret(S) || S.Profile == Reaver || S.Profile == Arcanist); }

	/** Everything an encounter leaves in the world besides the boss. Hits and new events are for the engine to drain. */
	struct FArena
	{
		std::vector<FZone> Zones;
		std::vector<FEvent> Events;     // last MaxEvents
		std::vector<FPlayerHit> Hits;   // drained by the engine each frame
		std::vector<FDecoy> Decoys;     // live False Saints
		std::vector<FSummon> Summons;   // live called-in troops (cleared when the fight ends or resets)
		double NextEventId = 1, NextZoneId = 1, NextDecoyId = 1, NextSummonId = 1;
		double EnemyHpScale = 1;        // the difficulty challenge's enemy health (sim.challenge.enemyHp)
		double HazardSpeedMult = 1;     // the player's speed multiplier from SLOW zones this frame
	};

	/** encounter-sim.ts stepEncounters: every live boss with an authored encounter, then the zones. */
	WORLDFRACTURECORE_API void StepEncounters(const FCatalog& C, std::vector<FBoss*>& Bosses, FArena& A, double Dt, double Px, double Pz, double Now);
	/** The hp a boss cannot be brought under until its finale window opens (0 = none). */
	WORLDFRACTURECORE_API double EncounterHpFloor(const FCatalog& C, const FBoss& B, double Now);
	/** The player died: every encounter boss back to full health, phase 0 and its arena centre. */
	WORLDFRACTURECORE_API void ResetEncounters(const FCatalog& C, std::vector<FBoss*>& Bosses, FArena& A, double Now);
	/** The boss died: clear its zones and decoys, announce the victory. */
	WORLDFRACTURECORE_API void EndEncounter(const FCatalog& C, const FBoss& B, FArena& A, double Now);
	/** A False Saint was destroyed (no kill or loot); the last one exposes the real Saint. */
	WORLDFRACTURECORE_API void OnDecoyShattered(const FCatalog& C, std::vector<FBoss*>& Bosses, FArena& A, double DecoyId, double Now);

	/** summon-skills.ts stepSummonSkills (run by StepEncounters while a boss lives): Reaver strikes, Arcanist orbs and their
	 *  pools, Sentinel turrets (at most three, 25 s each). The engine writes each summon's live X / Z in first. */
	WORLDFRACTURECORE_API void StepSummonSkills(FArena& A, double Dt, double Px, double Pz, double Now);
	/** summon-skills.ts stepSummonPins, at the end of the frame: turrets and winding-up troops hold still, a Reaver rushes the
	 *  player at 9 m/s, an Arcanist keeps 16-28 m away at 4.5 m/s. The engine then moves pinned summons (IsPinned) to X / Z. */
	WORLDFRACTURECORE_API void StepSummonPins(FArena& A, double Dt, double Px, double Pz);

	/** Puts a called-in troop into the fight outside an attack (the lowest free slot, no skill state yet). */
	WORLDFRACTURECORE_API FSummon& AddSummon(FArena& A, const std::string& ScenarioId, const std::string& Profile, const std::string& Kind, double X, double Z, double Hp, double Scale, bool bElite);

	/** A called-in trooper was killed: it leaves the fight's count. */
	WORLDFRACTURECORE_API void OnSummonDefeated(FArena& A, double SummonId);

	/** sim.ts applyMachineDamageMods, boss half: dmg already includes vulnerability; returns the damage to subtract. */
	WORLDFRACTURECORE_API double ApplyBossDamage(const FCatalog& C, FBoss& B, double Dmg, const std::string& Element, double Distance, double Now);
	/** Regional boss phase step (sim.ts): decays poise; returns the new phase when it changed (its weak point opens). */
	WORLDFRACTURECORE_API std::optional<int> StepRegionalPhase(FBoss& B, double Dt, double Now);

	/** HUD: the attack being wound up and 0..1 progress, if any. */
	WORLDFRACTURECORE_API bool WindupHud(const FCatalog& C, const FBoss& B, std::string& OutLabel, double& OutProgress);
}
