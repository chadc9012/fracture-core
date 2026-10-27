// World Fracture — the Killbox: PvP against AI rival operators (there is no online multiplayer yet).
//
// Duel and Skirmish (crucible.ts): rival GOLIATH / NYX / CIPHER operators in an enemy colourway respawn at the arena edge 3.5 s
// after they fall; you score by eliminating them, they score when you die; first to the target wins.
// The Killbox modes (pvp.ts): Clash (6v6 team deathmatch to 75), Dominion (6v6 zones A / B / C to 150), Freefall (12-player
// free-for-all to 20), Lockdown (4v4 attack and defend, rounds, first to 4), Killbox: Ascendancy (elite 3v3 elimination with a
// capture zone at the buzzer, first to 5) and Fracture Royale (60 players, a closing circle, last squad standing). Around you
// the fight is real; the off-field members of each team trade eliminations at a steady, seeded rate, so a 6v6 score moves like
// a 6v6.
//
// Port of the web build's authoritative rules:
//   crucible.ts  CRUCIBLE_MODES, ARENA_RADIUS, RIVAL_RESPAWN_S, RIVAL_HP, RIVAL_LABEL, rivalLineup, newCrucible, stepRivals,
//                stepField, resetField, rivalSquad (the field logic, with the world's machines behind callbacks)
//   pvp.ts       PVP_MODES, FRONT_RATE, FIRETEAM, zones, ROYALE, newPvp, stepPvp (team / zones / ffa / rounds / royale),
//                royaleRadius, stormDamage, fieldSize, respawns, pvpLine
// Golden-tested (Tests/PvpCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace wf::pvp
{
	// ---- crucible.ts ----
	struct FCrucibleMode { std::string Id, Name; int Rivals = 0; double Target = 0; std::string Brief; };
	/** duel | skirmish */
	WORLDFRACTURECORE_API const FCrucibleMode* CrucibleMode(const std::string& Id);
	inline constexpr double ArenaRadius = 34, RivalRespawnS = 3.5, RivalHp = 9;
	/** GOLIATH (TITAN), NYX (HUNTER), CIPHER (WARLOCK) */
	WORLDFRACTURECORE_API std::string RivalLabel(const std::string& Class);
	/** the duel opponent is never your own class; a skirmish fields all three */
	WORLDFRACTURECORE_API std::vector<std::string> RivalLineup(const std::string& Mode, const std::string& PlayerClass);
	/** n rival operators cycling the three classes */
	WORLDFRACTURECORE_API std::vector<std::string> RivalSquad(int N, int Offset = 0);
	struct FField { std::string Mode; std::vector<double> Respawn; std::vector<bool> Spent; bool bSpentSet = false; };
	WORLDFRACTURECORE_API FField NewCrucible(const std::string& Mode);
	/** a rival to bring on: its slot (tag crucible:<slot>), class, the bearing round the centre (rad) and its first-shot delay */
	struct FSpawn { int Slot = 0; std::string Class; double Angle = 0, Cool = 0; };
	/** the world's side: is the rival in this slot on the field; HasRoom claims a free machine for one more rival (sim.ts takes
	 *  the first dead machine) and says false when there is none */
	struct FFieldWorld
	{
		std::function<bool(int Slot)> SlotAlive;
		std::function<bool()> HasRoom;
		std::function<double()> Rand;
	};
	/** crucible.ts stepRivals: keep the duel / skirmish lineup on the field */
	WORLDFRACTURECORE_API std::vector<FSpawn> StepRivals(FField& St, const std::string& PlayerClass, double Dt, const FFieldWorld& World);
	/** crucible.ts stepField: keep a mode's lineup on the field; without respawns a slot takes the field once a round.
	 *  Rivals in slots at or past the lineup's size must leave the field (the caller removes them first). */
	WORLDFRACTURECORE_API std::vector<FSpawn> StepField(FField& St, const std::vector<std::string>& Lineup, bool bRespawn, double Dt, const FFieldWorld& World);
	/** a new round: every slot fresh (the caller clears the field) */
	WORLDFRACTURECORE_API void ResetField(FField& St);

	// ---- pvp.ts ----
	struct FMode
	{
		std::string Id, Name, Kind /* team zones ffa rounds royale */, Tagline, Brief;
		int TeamSize = 0, Players = 0, OnField = 0;
		double Target = 0, TimeLimit = 0, RoundTime = 0;
		std::string Activity;
		bool bElite = false;
	};
	WORLDFRACTURECORE_API const std::vector<FMode>& Modes();
	WORLDFRACTURECORE_API const FMode* ModeById(const std::string& Id);
	WORLDFRACTURECORE_API const FMode* ModeForActivity(const std::string& ActivityId);
	inline constexpr double FrontRate = 1.0 / 15, ZoneRadius = 7, ZoneCaptureS = 5, ZoneTickS = 2, RoundZoneS = 6;
	inline constexpr int Fireteam = 3;
	inline constexpr double RoyaleStartRadius = 230, RoyaleFinalRadius = 18, RoyalePhaseHold = 50, RoyalePhaseShrink = 35, RoyaleWaveEvery = 40;
	inline constexpr int RoyalePhases = 5;
	struct FZone { std::string Id; double Dx = 0, Dz = 0; std::string Owner; /* us | them | "" */ double Cap = 0; };
	struct FState
	{
		std::string Mode;
		double Clock = 0, Us = 0, Them = 0;
		std::vector<double> Board; // ffa: everyone's eliminations, [0] is you
		std::vector<FZone> Zones;
		double Round = 1, RoundClock = 0, UsRounds = 0, ThemRounds = 0;
		bool bAttacking = true;
		double Plant = 0, ZoneHold = 0, RoundRivalsLeft = 0, RoundOver = 0;
		double Alive = 0, Phase = 0, Radius = 0, NextWave = 0;
		std::string Result; // win | loss | ""
		std::string Reason;
		uint32_t Seed = 1;
	};
	WORLDFRACTURECORE_API FState NewPvp(const std::string& Mode, uint32_t Seed = 1);
	struct FEvents { double Dt = 0, Kills = 0; bool bDied = false; double Px = 0, Pz = 0; double RivalsAlive = 0; };
	/** one frame; true once the match is decided */
	WORLDFRACTURECORE_API bool StepPvp(FState& St, const FEvents& E);
	struct FCircle { double Radius = 0, Phase = 0; bool bClosing = false; };
	WORLDFRACTURECORE_API FCircle RoyaleRadius(double T);
	/** the closing fracture's damage a second at a distance from the circle's centre (0 inside) */
	WORLDFRACTURECORE_API double StormDamage(const FState& St, double Dist);
	/** rival operators that should be on the field now */
	WORLDFRACTURECORE_API int FieldSize(const FState& St);
	/** downed rivals come back (not in rounds) */
	WORLDFRACTURECORE_API bool Respawns(const FState& St);
	/** the HUD's line of match state */
	WORLDFRACTURECORE_API std::string PvpLine(const FState& St);
}
