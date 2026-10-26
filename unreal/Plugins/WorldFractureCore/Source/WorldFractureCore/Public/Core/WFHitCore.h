// World Fracture — what a player hit does: element statuses, the weapon's range band, precision and class affinity, the
// power-level scale, evolved weapons and their bursts, the exotic perks (Null Disruption, Maw Collapse) and the enemy's
// flinch or stagger.
//
// Port of the web build's authoritative rules:
//   weapon-elements.ts   applyElementHit (BURN / CHILL / CORRODE / SHOCK), mergeVuln, isChilled, statusSpeedMult, burnDamage
//   weapon-meta.ts       WEAPON_META, rangeFalloff, AFFINITY, precisionFor, enemyPower, operatorPower, powerScale, hitMultiplier
//   weapon-evolution.ts  ABILITY_RULES, the five ruins, canEvolve / evolveWeapon / discoverNearby, registerEvolutionHit,
//                        evolutionDamageMult, burstTargets, ruinElementOf
//   null-disruption.ts   registerNullHit;  maw-collapse.ts  registerMawHit, mawEffect
//   enemy-reactions.ts   reactTo, isStaggeredNow, hitPart;  sim.ts enemyBodyScaleOf, BOSS_STUN_CAP
// legendary-chain.ts is not ported: every player hit carries the same source id ("local-operator") and a reaction needs two
// sources, so in single player it never changes damage. Golden-tested (Tests/HitCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <optional>
#include <string>
#include <vector>

namespace wf::hit
{
	// ---- element statuses ----
	struct FStatuses { double BurnUntil = 0, ChillUntil = 0, ShockReadyAt = 0; };
	struct FVuln { double Mult = 1, Until = 0; };
	struct FElementEffect { std::string Status; /* BURN CHILL CORRODE SHOCK or "" */ double Stun = 0; std::optional<FVuln> Vuln; };
	inline constexpr double BurnSeconds = 3, BurnDps = 0.5, ChillSeconds = 3, ChillSpeedMult = 0.55, CorrodeSeconds = 4, CorrodeMult = 1.25,
		CorrodeBossMult = 1.1, ShockStun = 0.7, ShockCooldown = 3.5;
	WORLDFRACTURECORE_API FElementEffect ApplyElementHit(FStatuses& St, const std::string& Element, double Now, bool bBoss);
	WORLDFRACTURECORE_API FVuln MergeVuln(const FVuln& Cur, const FVuln& Add, double Now);
	inline bool IsChilled(const FStatuses& St, double Now) { return St.ChillUntil > Now; }
	inline bool IsBurning(const FStatuses& St, double Now) { return St.BurnUntil > Now; }
	inline double StatusSpeedMult(const FStatuses* St, double Now) { return St && IsChilled(*St, Now) ? ChillSpeedMult : 1; }
	inline double BurnDamage(const FStatuses* St, double Now, double Dt) { return St && IsBurning(*St, Now) ? BurnDps * Dt : 0; }
	/** sim.ts: a stun on a boss is capped to the Null Disruption window */
	inline constexpr double BossStunCap = 1.4;

	// ---- the weapon's class ----
	struct FMeta { std::string Role, Label; double RangeFull = 0, RangeEnd = 0, RangeFloor = 1, Precision = 1; };
	/** WEAPON_META for AUTO PULSE SIDEARM SHOTGUN HEAVY SWORD and the four launchers (unbounded range bands are +inf) */
	WORLDFRACTURECORE_API const FMeta* MetaFor(const std::string& WeaponId);
	WORLDFRACTURECORE_API double RangeFalloff(const std::string& WeaponId, double Distance);
	WORLDFRACTURECORE_API bool HasAffinity(const std::string& ClassId, const std::string& WeaponId);
	inline constexpr double AffinityDamage = 1.12, AffinityPrecision = 0.25;
	WORLDFRACTURECORE_API double PrecisionFor(const std::string& WeaponId, const std::string& ClassId);
	WORLDFRACTURECORE_API double HitMultiplier(const std::string& WeaponId, double Distance, bool bPrecision, const std::string& ClassId);
	// ---- power level (applies to every source of player damage) ----
	WORLDFRACTURECORE_API double EnemyPower(double Difficulty, bool bElite, bool bBoss);
	WORLDFRACTURECORE_API double OperatorPower(const std::vector<double>& GearPowers, double Level);
	WORLDFRACTURECORE_API double PowerScale(double Delta);
	/** the powers of the equipped gear Scene.tsx averages: everything worn except the vehicle slot */
	WORLDFRACTURECORE_API std::vector<double> EquippedGearPowers(const FProgression& P);

	// ---- the body ----
	/** enemy-reactions.ts hitPart: HEAD (top 18%), TORSO, LEGS (lower 45%) */
	WORLDFRACTURECORE_API std::string HitPart(double HitY, double FeetY, double Height);
	inline double EnemyBodyScaleOf(double SimScale) { return 1 + (SimScale - 1) * 0.35; }
	struct FReaction { std::string Kind; /* flinch | stagger */ double Until = 0, Start = 0, Dx = 0, Dz = 0, K = 0; std::string Part = "TORSO"; };
	WORLDFRACTURECORE_API std::optional<FReaction> ReactTo(const std::optional<FReaction>& Prev, double Damage, double MaxHp, bool bElite, bool bBoss, double Now, double Dx, double Dz, const std::string& Part);
	inline bool IsStaggeredNow(const std::optional<FReaction>& R, double Now) { return R && R->Kind == "stagger" && Now < R->Until; }

	// ---- evolved weapons ----
	struct FAbilityRule { std::string Id, Name, Blurb; int EveryHits = 0; double Radius = 0; int MaxTargets = 0; double BurstFraction = 0, ChilledBonus = 1, Stun = 0; };
	WORLDFRACTURECORE_API const FAbilityRule* AbilityRule(const std::string& Ability); // EMBER_BRAND RIME_SHATTER ROT_BLOOM STORM_ARC SUN_FLARE
	struct FRuin { std::string Id, Name, RegionId, Element, Ability, Material, Blurb; double X = 0, Z = 0; };
	/** the five ruins (weapon-evolution.ts ruins(): sites placed by the web world's terrain, recorded here) */
	WORLDFRACTURECORE_API const std::vector<FRuin>& Ruins();
	WORLDFRACTURECORE_API const FRuin* RuinById(const std::string& Id);
	inline constexpr double EvolvePowerBonus = 60, EvolveMinLevel = 5, EvolveCatalysts = 2, EvolveElementAmount = 6, RuinReach = 6, RuinDiscoverRadius = 40;
	inline std::string ClaimKey(const std::string& RuinId) { return "ruin:" + RuinId; }
	inline std::string SeenKey(const std::string& RuinId) { return "ruin-seen:" + RuinId; }
	WORLDFRACTURECORE_API bool IsEvolved(const FProgression& P, const std::string& RuinId);
	WORLDFRACTURECORE_API bool IsDiscovered(const FProgression& P, const std::string& RuinId);
	/** the nearest undiscovered ruins within 40 m are recorded as seen */
	WORLDFRACTURECORE_API FProgression DiscoverNearby(const FProgression& P, double X, double Z);
	struct FEvolveCheck { bool bOk = false; std::string Reason; };
	WORLDFRACTURECORE_API FEvolveCheck CanEvolve(const FProgression& P, const FRuin& Ruin, const std::string& WeaponId);
	/** evolves the weapon at the ruin (+60 power, the ruin's element and ability); unchanged when refused */
	WORLDFRACTURECORE_API FProgression EvolveWeapon(const FProgression& P, const std::string& RuinId, const std::string& WeaponId);
	struct FCharge { double Hits = 0; };
	/** one landed hit; true on every Nth */
	WORLDFRACTURECORE_API bool RegisterEvolutionHit(FCharge& C, const std::string& Ability);
	WORLDFRACTURECORE_API double EvolutionDamageMult(const std::string& Ability, bool bChilled);
	struct FPoint { double X = 0, Z = 0; };
	/** the burst's victims (indices into Others): nearest first, not the struck one, within the radius, capped */
	WORLDFRACTURECORE_API std::vector<size_t> BurstTargets(const FPoint& Origin, const std::vector<FPoint>& Others, const std::string& Ability);
	WORLDFRACTURECORE_API std::string RuinElementOf(const std::string& Ability);

	// ---- exotic perks ----
	inline const std::string NullPerk = "NULL_DISRUPTION", MawPerk = "MAW_COLLAPSE";
	inline constexpr double NullThreshold = 5, NullDecay = 6, NullCooldown = 8, NullPulseRadius = 14, NullPulsePoise = 35, NullPulseStun = 1.4;
	struct FNullCharge { double Charge = 0, LastTimedAt = -1e9, CooldownUntil = 0, LastEventId = -1; };
	/** a timed hit (the target winding up, or a boss's weak point / stagger open) builds charge; at 5 the next hit pulses */
	WORLDFRACTURECORE_API bool RegisterNullHit(FNullCharge& S, double Now, bool bTimed, double EventId);
	inline FNullCharge ResetNullCharge() { return {}; }
	inline constexpr double MawThreshold = 6, MawDecay = 5, MawCooldown = 7, MawRadius = 10, MawPull = 14, MawSplash = 0.6;
	struct FMaw { double Hunger = 0, LastHitAt = -1e9, CooldownUntil = 0, LastEventId = -1; };
	WORLDFRACTURECORE_API bool RegisterMawHit(FMaw& S, double Now, double EventId);
	/** switching weapons clears hunger but keeps the lockout */
	inline FMaw ResetMaw(const FMaw& S) { FMaw R; R.CooldownUntil = S.CooldownUntil; R.LastEventId = S.LastEventId; return R; }
	struct FMawEffect { double PullX = 0, PullZ = 0, Damage = 0; };
	WORLDFRACTURECORE_API std::optional<FMawEffect> MawEffect(double Dx, double Dz, double HitDamage);
}
