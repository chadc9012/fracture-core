// World Fracture — off-road air and stunts, and the Wastelands Stunt Park.
//
// A ground vehicle follows the ground while the ground can hold it; when the ground falls away faster than gravity can pull the
// vehicle after it (a crest, a ramp lip, a ledge) it flies until it meets the ground again. In the air, brake pitches the nose up
// (backflip), throttle down (frontflip), steer spins it flat, or rolls it with the handbrake held. A clean landing scores flips,
// rolls, spins, big air and air time; a powerslide scores too; stunts chained within 4 s multiply (x1.5, x2 ... x4); a landing
// too far off upright is a wipeout that breaks the chain. Stunt points pay Nex, 1 per 50 points, up to 600 a day.
//
// Port of the web build's authoritative rules:
//   stunts.ts      AIR, freshAir, wrap, stepAir, TRICK_POINTS, BIG_AIR / HUGE_AIR, landingTricks, POWERSLIDE, COMBO, freshRun,
//                  comboMult, scoreLanding, stepPowerslide, STUNT_PAY, stuntNex, payStunts
//   stunt-park.ts  STUNT_PARK, RAMPS, rampCentre, rampDeck, rampProfile, inStuntPark
// Heights and distances are rules metres; the park is placed in the web world (x, z). Golden-tested (Tests/StuntCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"

#include <map>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace wf::stunt
{
	// ---- air (stunts.ts AIR) ----
	inline constexpr double Gravity = 21, LaunchGap = 0.35, PitchRate = 4.6, RollRate = 5.2, YawRate = 3.6, CleanTilt = 0.85, HardImpact = 13;
	struct FAir
	{
		double Y = 0, Vy = 0;
		bool bAirborne = false;
		/** the stand height last frame, to read the ground's own vertical speed */
		double LastStand = 0;
		/** the stunt pose while airborne (rad, unbounded) */
		double Pitch = 0, Roll = 0, SpinYaw = 0;
		double AirTime = 0;
	};
	inline FAir FreshAir(double Y) { FAir A; A.Y = Y; A.LastStand = Y; return A; }
	struct FAirInput { double Throttle = 0, Brake = 0, Steer = 0; bool bHandbrake = false; };
	struct FLanding { double AirTime = 0, Pitch = 0, Roll = 0, SpinYaw = 0, Impact = 0; bool bClean = false; };
	/** an angle wrapped to (-pi, pi] */
	WORLDFRACTURECORE_API double Wrap(double A);
	/** One frame. Stand is the height the vehicle rests at here (ground + ride height). Returns the landing when it touched down. */
	WORLDFRACTURECORE_API std::optional<FLanding> StepAir(FAir& St, double Stand, const FAirInput& In, double Dt);

	// ---- scoring ----
	struct FTrick { std::string Name; double Points = 0; };
	inline constexpr double FlipPoints = 600, RollPoints = 500, Spin360Points = 300, BigAirPoints = 250, HugeAirPoints = 600, PowerslidePoints = 150, PerSecondAir = 80;
	inline constexpr double BigAir = 1.4, HugeAir = 2.4;
	/** the tricks a clean landing scored (none for a wipeout or a plain hop) */
	WORLDFRACTURECORE_API std::vector<FTrick> LandingTricks(const FLanding& L);
	inline constexpr double SlideSlip = 0.3, SlideMinSpeed = 15, SlideMinTime = 1.2;
	inline constexpr double ComboWindow = 4, ComboStep = 0.5, ComboMax = 4;
	struct FLast { std::string Label; double Points = 0, At = 0; bool bWipeout = false; };
	struct FRun
	{
		double Combo = 0, ComboUntil = 0, Total = 0, Best = 0;
		double SlideTime = 0;
		/** the latest scored event, for the HUD toast */
		std::optional<FLast> Last;
	};
	/** the combo multiplier for the n-th stunt in a chain (1, 1.5, 2 ... capped at 4) */
	WORLDFRACTURECORE_API double ComboMult(double N);
	/** score a landing (a wipeout breaks the combo); returns the points earned */
	WORLDFRACTURECORE_API double ScoreLanding(FRun& Run, const FLanding& L, double Now);
	/** every grounded frame; scores a powerslide when a long enough slide ends */
	WORLDFRACTURECORE_API double StepPowerslide(FRun& Run, double Slip, double Speed, double Dt, double Now);

	// ---- pay ----
	inline constexpr double PointsPerNex = 50, DailyCap = 600;
	WORLDFRACTURECORE_API double StuntNex(double Points, double PaidToday);
	/** credit stunt Nex to the day's ledger line stunts:<YYYY-MM-DD> (a running, capped total); false when nothing was paid */
	WORLDFRACTURECORE_API bool PayStunts(std::map<std::string, double>& Ledger, const std::string& Day, double Points);

	// ---- the Stunt Park (stunt-park.ts) ----
	struct FPark { double X = 0, Z = 0, DirX = 1, DirZ = 0, Length = 150, Width = 46; };
	/** a fenced dirt yard 40 m west and 160 m south of the Wastelands centre (it moves with the region) */
	WORLDFRACTURECORE_API const FPark& StuntPark();
	struct FRamp { std::string Id; double Along = 0, Across = 0, Length = 0, Ramp = 0, Width = 0, Height = 0; std::string Label; };
	WORLDFRACTURECORE_API const std::vector<FRamp>& Ramps();
	struct FPoint { double X = 0, Z = 0; };
	WORLDFRACTURECORE_API FPoint RampCentre(const FRamp& R);
	/** district-decks.ts Deck: a walkable box with a ramp at each end */
	struct FDeck { std::string Id; double X = 0, Z = 0, DirX = 1, DirZ = 0, Length = 0, Width = 0, Top = 0, Base = 0, Ramp = 0; };
	/** Ground is the terrain height at the ramp's centre */
	WORLDFRACTURECORE_API FDeck RampDeck(const FRamp& R, double Ground);
	/** the side profile (along, height above base): base, up the ramp, the flat top (if any), down to base */
	WORLDFRACTURECORE_API std::vector<std::pair<double, double>> RampProfile(const FRamp& R);
	WORLDFRACTURECORE_API bool InStuntPark(double X, double Z, double Margin = 0);
}
