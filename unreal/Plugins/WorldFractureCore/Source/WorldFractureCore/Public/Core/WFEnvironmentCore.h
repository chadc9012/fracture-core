// World Fracture — the world clock, weather fronts, seasons and environmental hazards.
//
// Port of the web build's authoritative rules:
//   world.ts          hourOf, sunElevation, phaseFor, clockLabel (the day clock: 1.0 = one day; sunrise 06:00, sunset 18:00)
//   Scene.tsx         nightFactor, the clock's start (0.36 = 08:38) and rate (0.008 days a second, 0.06 with T held)
//   weather-cycle.ts  frontAt, sampleWeather, weatherName: deterministic fronts per region (every 0.35 days, cross-faded)
//   environment.ts    seasonAt, environmentAt (seasonal weather, thermal index, temperature, summary), stepEnvironment
//                     (heat / cold / spore exposure meters, telegraphed lightning in storms)
//   sim.ts            applyLightning's damage numbers (14 to the player, 6 to machines, within the strike radius)
// Golden-tested (Tests/EnvironmentCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"

#include <functional>
#include <string>
#include <vector>

namespace wf::env
{
	// ---- the clock ----
	inline constexpr double ClockStart = 0.36, DayRate = 0.008, FastDayRate = 0.06;
	WORLDFRACTURECORE_API double HourOf(double T);
	WORLDFRACTURECORE_API double SunElevation(double T);
	WORLDFRACTURECORE_API std::string PhaseFor(double T); // Moonlight | Dawn | Day | Sunset | Night
	WORLDFRACTURECORE_API std::string ClockLabel(double T); // "08:38"
	WORLDFRACTURECORE_API double NightFactor(double T);    // 0 day .. 1 deep night

	// ---- weather fronts ----
	inline constexpr double FrontLength = 0.35;
	struct FWeather
	{
		std::string State; // CLEAR | OVERCAST | RAIN | STORM | FOG
		double Precipitation = 0, Cloud = 0, Visibility = 1, WindX = 0, WindZ = 0;
		std::string Label;
	};
	WORLDFRACTURECORE_API std::string FrontAt(const std::string& RegionId, double FrontIndex);
	WORLDFRACTURECORE_API FWeather SampleWeather(const std::string& RegionId, double T);
	WORLDFRACTURECORE_API std::string WeatherName(const FWeather& W, const std::string& RegionId);

	// ---- seasons and the environment ----
	inline constexpr double SeasonLengthDays = 6;
	struct FSeason { std::string Season; double Progress = 0, Year = 0; };
	WORLDFRACTURECORE_API FSeason SeasonAt(double T);
	struct FEnvironment
	{
		std::string Season;
		double SeasonProgress = 0;
		FWeather Weather;   // seasonally adjusted
		double Thermal = 0; // -1 freezing .. +1 scorching
		double TempC = 0;
		bool bShielded = false;
		std::string Summary; // "Autumn · Dense fog · 14°C"
	};
	WORLDFRACTURECORE_API FEnvironment EnvironmentAt(const std::string& RegionId, double T, double Night);

	// ---- hazards ----
	inline constexpr double StrikeWarnSeconds = 1.6, StrikeRadius = 5, StrikePlayerDamage = 14, StrikeMachineDamage = 6;
	struct FStrike { double Id = 0, X = 0, Z = 0, Radius = 0, Warn = 0; };
	struct FFlash { double X = 0, Z = 0, T = 0; };
	struct FEnvState
	{
		double Heat = 0, Cold = 0, Toxic = 0;
		std::vector<FStrike> Strikes;
		std::vector<FFlash> Flashes;
		double NextStrike = 8, NextId = 1;
	};
	struct FEnvInput
	{
		double Dt = 0;
		std::string RegionId;
		FEnvironment Env;
		bool bSheltered = false; // an interior, a safe zone or the Nexus shield
		double Px = 0, Pz = 0;
		std::function<double()> Rand;
	};
	struct FEnvOutput
	{
		double Damage = 0; // already dt-scaled
		std::string Cause, Warning;
		std::vector<FStrike> Detonated; // the caller applies their area damage
	};
	WORLDFRACTURECORE_API FEnvOutput StepEnvironment(FEnvState& S, const FEnvInput& In);
}
