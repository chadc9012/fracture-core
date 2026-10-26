// World Fracture — enemy squad tactics: squad roles and how each role moves (pressed or spread by the player's state and
// ability build), flanking a player who hides, grenades lobbed over cover, and getting out of the way of rockets and
// orbital strikes.
//
// Port of the web build's authoritative rules:
//   enemy-intelligence.ts  squadRole, squadMove
//   ability-network.ts     buildSynergy's archetype (Scene.tsx maps it to the squad archetype)
//   enemy-tactics.ts       findFlankSpot, lobVelocity, stepGrenade, grenadeDamage, beepEvery, throwsGrenades, GRENADE / FLANK
//   enemy-evasion.ts       roundThreat, diveDirection, reactsInTime, fleeDirection, DIVE / FLEE
// Golden-tested (Tests/TacticsCoreTest.cpp; findFlankSpot against a recorded line-of-sight stand-in).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFAbilityCore.h"

#include <functional>
#include <optional>
#include <string>

namespace wf::tactics
{
	// ---- squads ----
	WORLDFRACTURECORE_API std::string SquadRole(int Index, bool bElite, bool bBoss); // ASSAULT | RANGED | FLANKER | LEADER
	struct FMove { double Forward = 0, Strafe = 0; };
	/** forward (toward the player) and strafe intent in -1..1; Archetype BALANCED | DEFENSIVE | STRIKER | STRATEGIST, Posture NONE | POWER | CONTROL | UTILITY */
	WORLDFRACTURECORE_API FMove SquadMove(const std::string& Role, double Distance, double PlayerHp, double PlayerThreat, double T, const std::string& Archetype = "BALANCED", bool bRangedHoldFire = false, const std::string& Posture = "NONE");
	/** Scene.tsx: the equipped build's synergy archetype as a squad archetype (Defender, Striker, Strategist; else BALANCED) */
	WORLDFRACTURECORE_API std::string SquadArchetypeFor(const ability::FBuild& Build);

	// ---- flanking and grenades ----
	inline constexpr double FlankAfter = 3, FlankGiveUp = 8, GrenadeAfter = 2.5;
	inline constexpr int MaxFlankers = 2;
	struct FGrenadeTuning
	{
		static constexpr double Fuse = 2.4, Radius = 6, Damage = 34, CoverSoak = 0.3, Gravity = 14, Bounce = 0.35, Friction = 0.55;
		static constexpr int MaxLive = 1;
		static constexpr double SquadCooldown = 7, OwnCooldown = 16, MinRange = 7, MaxRange = 32;
	};
	struct FPoint3 { double X = 0, Y = 0, Z = 0; };
	struct FPoint { double X = 0, Z = 0; };
	WORLDFRACTURECORE_API bool ThrowsGrenades(const std::string& Kind);
	using FGround = std::function<double(double, double)>;
	using FSightBlocked = std::function<bool(const FPoint3& From, const FPoint3& To)>;
	/** a spot on a ring round the player (11 / 15 / 19 m), swung 55 / 80 / 110 degrees to Side, that sees the player's chest */
	WORLDFRACTURECORE_API std::optional<FPoint> FindFlankSpot(double Mx, double Mz, const FPoint3& Player, int Side, const FGround& Ground, const FSightBlocked& Blocked, double EyeHeight = 1.55);
	struct FLob { double Vx = 0, Vy = 0, Vz = 0, T = 0; };
	WORLDFRACTURECORE_API FLob LobVelocity(const FPoint3& From, const FPoint3& To, double G = FGrenadeTuning::Gravity);
	struct FGrenade { double X = 0, Y = 0, Z = 0, Vx = 0, Vy = 0, Vz = 0, Fuse = 0, Id = 0; bool bRest = false; };
	WORLDFRACTURECORE_API void StepGrenade(FGrenade& G, double Dt, const FGround& Ground);
	WORLDFRACTURECORE_API double GrenadeDamage(double Dist, bool bCovered);
	WORLDFRACTURECORE_API double BeepEvery(double Fuse);

	// ---- evasion ----
	inline constexpr double ReactMin = 0.28;
	struct FDive { static constexpr double Seconds = 0.6, Speed = 7.5, Cooldown = 2.2; };
	struct FFlee { static constexpr double Notice = 0.5, Seconds = 1.8, Pad = 2; };
	struct FRoundLike { double X = 0, Y = 0, Z = 0, Dx = 0, Dy = 0, Dz = 0, Speed = 0, SplashRadius = 0, Proximity = 0, Life = 0, Age = 0; };
	struct FThreat { double X = 0, Z = 0, T = 0; };
	WORLDFRACTURECORE_API std::optional<FThreat> RoundThreat(const FRoundLike& R, double Mx, double Mz, const FGround& Ground, double Body = 1.5);
	WORLDFRACTURECORE_API FPoint DiveDirection(double Mx, double Mz, const FPoint& Burst, double RoundDx, double RoundDz, int Side);
	WORLDFRACTURECORE_API bool ReactsInTime(double TimeToBurst, bool bElite, double Roll);
	WORLDFRACTURECORE_API FPoint FleeDirection(double Mx, double Mz, double Cx, double Cz, double Seed);
}
