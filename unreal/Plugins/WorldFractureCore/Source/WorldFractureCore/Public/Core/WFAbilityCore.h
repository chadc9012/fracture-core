// World Fracture — the Operator class abilities (primary / tactical / ultimate), their build, branches and verbs.
//
// Port of the web build's authoritative rules:
//   combat-engine.ts     ABILITY_CONFIGS, the ability runtime (ready / active / cooldown), resolveSynergyEffects
//   ability-network.ts   the ability nodes (names, streams, costs, evolution branches), DEFAULT_BUILD
//   branch-effects.ts    Power / Control / Utility branches (+18% effect, +25% duration, -15% cost), postures
//   subclass-verbs.ts    the nine subclass verbs (Weaken, Marked, Volatile, Suppress, Rage, Overshield, Haste)
//   live-build.ts        classBuild, createLiveBuild / rebindLiveBuild / tickLiveBuild / activateLiveAbility
//   ability-hud.ts       abilityCost, abilityHud
//   operator-abilities.ts  Siege, Veil, Shadow Strike, Rift Turrets
//   ability-effects.ts   castAbility (Siege Mode, Kinetic Slam, Bastion Shield, Phase Veil, Rift Dash, Shadow Strike,
//                        Recon Swarm, Disruption Pulse, Rift Turret, and the Covenant's Ember Bulwark / Wyrm Dash /
//                        Ash Nova), holdDisabledField, cancelAbilities, syncSimFromLive
//   operators.ts         migrateBuild / migrateBranches;  progression.ts selectAbilityBranch;  OperationsHub equip rule
// Golden-tested (Tests/AbilityCoreTest.cpp).
//
// As in dragonite-cast, the engine prices damage (IWorld::DamageMods) and resolves deaths (IWorld::Defeat).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFDragoniteCastCore.h"
#include "Core/WFProgression.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::ability
{
	extern WORLDFRACTURECORE_API const char* const Slots[3]; // PRIMARY TACTICAL ULTIMATE

	struct FEffect
	{
		std::string Kind; // BLOCK DAMAGE DASH MARK SILENCE FIELD DOME COOLDOWN_SHIFT SIEGE VEIL STRIKE TURRET
		double Value = 0;
		std::optional<double> Duration, Radius;
		std::vector<std::string> Tags;
		WORLDFRACTURECORE_API bool Has(const std::string& Tag) const;
	};
	struct FConfig
	{
		std::string Id, ClassId, Slot, Input;
		double Cooldown = 0, ResourceCost = 0, CastTime = 0, Recovery = 0;
		std::vector<FEffect> Effects;
	};
	WORLDFRACTURECORE_API const std::vector<FConfig>& Configs();
	WORLDFRACTURECORE_API const FConfig* ConfigById(const std::string& Id);

	struct FNode
	{
		std::string Id, Name, ClassId, Slot, Stream;
		double Cost = 0;
		std::vector<std::string> Branches;     // branch ids: [Power, Control, Utility]
		std::vector<std::string> BranchNames;
	};
	WORLDFRACTURECORE_API const std::vector<FNode>& Nodes();
	/** ability-network.ts nodeById: unknown ids fall back to the first node. */
	WORLDFRACTURECORE_API const FNode& NodeById(const std::string& Id);

	struct FBuild
	{
		std::string Mode = "HYBRID";
		std::map<std::string, std::string> Slots; // PRIMARY / TACTICAL / ULTIMATE -> ability id
		bool operator==(const FBuild& O) const { return Mode == O.Mode && Slots == O.Slots; }
	};
	WORLDFRACTURECORE_API FBuild DefaultBuild();
	WORLDFRACTURECORE_API FBuild ClassBuild(const std::string& ClassId);
	WORLDFRACTURECORE_API std::string MigrateAbilityId(const std::string& Id);
	WORLDFRACTURECORE_API FBuild MigrateBuild(const FBuild& B);
	WORLDFRACTURECORE_API std::map<std::string, std::string> MigrateBranches(const std::map<std::string, std::string>& Branches);

	struct FRuntime
	{
		std::string State = "READY"; // READY ACTIVE COOLDOWN
		double Cooldown = 0, ActiveFor = 0;
	};
	struct FSynergy { double DamageMultiplier = 1, CooldownMultiplier = 1, StabilityBonus = 0, MomentumBonus = 0; };
	WORLDFRACTURECORE_API FSynergy ResolveSynergy(const std::vector<std::string>& AbilityIds);

	// ---- branches ----
	inline constexpr double PowerMultValue = 1.18, ControlDurationMult = 1.25, UtilityCostMult = 0.85;
	/** POWER CONTROL UTILITY, or "" */
	WORLDFRACTURECORE_API std::string BranchTier(const std::string& AbilityId, const std::string& BranchId);
	WORLDFRACTURECORE_API double PowerMult(const std::string& Tier);
	WORLDFRACTURECORE_API double DurationMult(const std::string& Tier);
	WORLDFRACTURECORE_API double CostMult(const std::string& Tier);
	WORLDFRACTURECORE_API FConfig ScaleConfig(const FConfig& C, const std::string& BranchId);
	WORLDFRACTURECORE_API std::string BranchPosture(const std::map<std::string, std::string>& Slots, const std::map<std::string, std::string>& Branches);
	WORLDFRACTURECORE_API std::string PostureThreat(const std::string& Posture);
	WORLDFRACTURECORE_API std::string BranchLabel(const std::string& Tier);

	// ---- subclass verbs ----
	struct FVerbDef { std::string Slot, Verb, Target; double Magnitude = 0, Duration = 0, Radius = 0; };
	WORLDFRACTURECORE_API std::optional<FVerbDef> VerbForActivation(const std::string& SubclassId, const std::string& Slot);
	WORLDFRACTURECORE_API std::string VerbLabel(const std::string& Verb);
	/** The class's three subclasses (loadout.ts), the first is the default. */
	WORLDFRACTURECORE_API std::vector<std::string> SubclassesOf(const std::string& ClassId);

	// ---- the live build ----
	struct FPendingVerb { std::string Verb; double Magnitude = 0, Duration = 0, Radius = 0; };
	struct FLiveBuild
	{
		FBuild Equipped;
		std::map<std::string, std::string> Branches;
		std::map<std::string, FRuntime> Runtime;
		double Energy = 100;
		std::string Effect;
		double EffectTime = 0;
		std::string Threat = "Scanning loadout";
		double DamageMultiplier = 1, ShieldReflect = 0, DashTime = 0, HackTime = 0, FieldTime = 0, Momentum = 0, SiegeTime = 0, VeilTime = 0;
		std::string VerbKind;
		double VerbTime = 0, VerbMagnitude = 1;
		std::optional<FPendingVerb> PendingVerb;
		double StrikeBoost = 1, SiegeBoost = 1;
	};
	WORLDFRACTURECORE_API FLiveBuild CreateLiveBuild(const FBuild& Equipped, const std::map<std::string, std::string>& Branches = {});
	WORLDFRACTURECORE_API FLiveBuild RebindLiveBuild(const FLiveBuild& Live, const FBuild& Equipped, const std::map<std::string, std::string>& Branches);
	/** Recharge: armor INTELLECT's ability-recharge bonus (0 = none). */
	WORLDFRACTURECORE_API void TickLiveBuild(FLiveBuild& Live, double Dt, double Recharge = 0);
	WORLDFRACTURECORE_API std::optional<FConfig> ActivateLiveAbility(FLiveBuild& Live, const std::string& Slot, const std::string& Environment, const std::string& SubclassId);
	WORLDFRACTURECORE_API const FConfig* BaseConfig(const FLiveBuild& Live, const std::string& Slot);
	WORLDFRACTURECORE_API double AbilityCost(const FLiveBuild& Live, const std::string& Slot);
	struct FHudRow { std::string Slot, Key, Id, Name, State; bool bReady = false; double Cooldown = 0, CooldownMax = 0, Cost = 0; };
	/** Keys are the web build's Q / E / R labels; the Unreal layout binds its own. */
	WORLDFRACTURECORE_API std::vector<FHudRow> AbilityHud(const FLiveBuild& Live);

	// ---- operator-abilities.ts ----
	inline constexpr double SiegeDamageMultValue = 1.3, SiegeMoveMultValue = 0.8, SiegeBloomMult = 0.5, VeilSightMultValue = 0.15, VeilBreakTime = 0.4,
		ShadowStrikeBase = 4, RiftTurretRange = 34, RiftTurretInterval = 0.45, RiftTurretDamage = 1;
	inline constexpr int MaxRiftTurrets = 2;
	WORLDFRACTURECORE_API double VeilSightMult(double VeilTime);
	WORLDFRACTURECORE_API double SiegeDamageMult(double SiegeTime);
	WORLDFRACTURECORE_API double SiegeMoveMult(double SiegeTime);
	WORLDFRACTURECORE_API double StrikeDamage(double VeilTime);
	struct FPoint2 { double X = 0, Z = 0; };
	WORLDFRACTURECORE_API FPoint2 StrikeLanding(double Px, double Pz, double Ex, double Ez, double Behind = 1.8);
	WORLDFRACTURECORE_API FPoint2 KnockbackFrom(double Px, double Pz, double Ex, double Ez, double Dist);
	struct FRiftTurret { double X = 0, Z = 0, Until = 0, Cool = 0.4, Rot = 0, Flash = 0; };
	WORLDFRACTURECORE_API std::vector<FRiftTurret> DeployRiftTurret(const std::vector<FRiftTurret>& List, double X, double Z, double Now, double Duration);
	/** The index of the machine it fired at this tick, or -1. */
	WORLDFRACTURECORE_API int StepRiftTurret(FRiftTurret& T, const std::vector<dragoncast::FMachine>& Targets, double Dt);

	// ---- casting (ability-effects.ts) ----
	using FMachine = dragoncast::FMachine;
	inline constexpr double AreaScale = 2, ImpactStunSeconds = 1.2, DisruptBossPoise = 15, SlamKnockback = 6;
	inline constexpr int MaxAbilityEvents = 24;

	struct FPose { double X = 0, Z = 0, Yaw = 0; };
	struct FCastContext { std::string Environment = "war", SubclassId; bool bInVehicle = false; };
	struct FEvent
	{
		double Id = 0;
		std::string Kind, AbilityId, Slot, Effect; // Kind CAST REJECTED CANCELLED; Effect: effect kind or NONE
		double X = 0, Z = 0, Radius = 0, Duration = 0;
		std::optional<double> FromX, FromZ;
		int Hits = 0, BossHits = 0, Kills = 0;
		std::string Reason;
		double At = 0;
	};
	struct FEventLog { double NextId = 1; std::vector<FEvent> Events; };

	class IWorld
	{
	public:
		virtual ~IWorld() = default;
		virtual double Now() const = 0; // seconds (performance.now() / 1000)
		/** sim.ts applyMachineDamageMods: the damage a hit of Dmg really deals to machine I. */
		virtual double DamageMods(std::vector<FMachine>& Machines, size_t I, double Dmg, const std::string& Element, double X, double Z) = 0;
		/** sim.ts defeatMachine: machine I reached 0 hp. */
		virtual void Defeat(std::vector<FMachine>& Machines, size_t I) = 0;
		virtual void Alert(const std::string& Text) { (void)Text; }
		/** obstacles.ts: is a solid obstacle (radius r) within 1 + r of this ground point? (Rift Dash stops before it) */
		virtual bool Blocked(double X, double Z) const { (void)X; (void)Z; return false; }
		/** a boss takes poise (boss-poise.ts hitPoise) */
		virtual void BossPoise(std::vector<FMachine>& Machines, size_t I, double Amount) { (void)Machines; (void)I; (void)Amount; }
		virtual void SpawnVolatileZone(double X, double Z, double Radius, double Dps, double Duration) { (void)X; (void)Z; (void)Radius; (void)Dps; (void)Duration; }
		virtual void PlaceRiftTurret(double X, double Z, double Duration) { (void)X; (void)Z; (void)Duration; }
		/** these raise to at least Seconds */
		virtual void Iframes(double Seconds) { (void)Seconds; }
		virtual void Barrier(double Seconds) { (void)Seconds; }
		virtual void Dome(double Seconds) { (void)Seconds; }
		virtual void Noise() {}
		/** an ability hit landed (sim.lastHit, combatHeat += 1.5) */
		virtual void Hit() {}
		/** death / respawn: iframes, barrier, dome and turrets go */
		virtual void ClearDefences() {}
	};

	WORLDFRACTURECORE_API int NearestTarget(const std::vector<FMachine>& Machines, double X, double Z, double Range);
	/** REJECT reason (COOLDOWN ENERGY NO_TARGET NO_ABILITY IN_VEHICLE) or "". */
	WORLDFRACTURECORE_API std::string RejectionFor(const std::vector<FMachine>& Machines, const FLiveBuild& Live, const std::string& Slot, const FPose& Pose, bool bInVehicle);
	WORLDFRACTURECORE_API FPoint2 DashLanding(const IWorld& World, double X, double Z, double Yaw, double Distance);
	struct FCastResult
	{
		bool bOk = false;
		std::string Reason, Text;
		std::optional<FConfig> Config;
		FPose Pose;
		FEvent Event;
	};
	WORLDFRACTURECORE_API FCastResult CastAbility(IWorld& World, std::vector<FMachine>& Machines, FLiveBuild& Live, FEventLog& Log, const std::string& Slot, const FPose& Pose, const FCastContext& Ctx);
	WORLDFRACTURECORE_API void HoldDisabledField(std::vector<FMachine>& Machines, const FLiveBuild& Live, const FPose& Pose, double Radius = 12);
	WORLDFRACTURECORE_API FLiveBuild CancelAbilities(IWorld& World, const FLiveBuild& Live, FEventLog& Log, const FPose& Pose);
	struct FSimMods { double VerbDamageMult = 1, StealthMult = 1, VerbIncomingMult = 1; };
	WORLDFRACTURECORE_API FSimMods SyncSimFromLive(const FLiveBuild& Live);

	// ---- the save ----
	/** progression.ts selectAbilityBranch: spends a calibration token. False (unchanged) without one. */
	WORLDFRACTURECORE_API bool SelectAbilityBranch(FProgression& P, const std::string& AbilityId, const std::string& BranchId);
	/** OperationsHub AbilityNetwork: unlocked (bond, saved builds) or within the fixed stream mastery (34 / 34 / 31). */
	WORLDFRACTURECORE_API bool AbilityUnlocked(const FProgression& P, const std::string& AbilityId);
	/** Puts an unlocked ability in its slot of the active build. */
	WORLDFRACTURECORE_API bool EquipAbility(FProgression& P, const std::string& AbilityId, std::string& OutError);
}
