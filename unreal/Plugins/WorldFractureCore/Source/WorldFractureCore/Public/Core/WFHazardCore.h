// World Fracture — region-wide hazards and the localized hazard zones on top of them.
//
// Every region has its own hazard: Veridan's overgrowth slows you on foot; Frostspire's cold builds exposure outside shelter
// (vehicles and interiors), which hurts past 60%; Ember Peaks' gravity swings between light and crushing; Wastelands dust storms
// scour you on their pulses; Solara's solar flares burn the exposed (telegraphed 4 s ahead); the Swamps' toxic mire drags,
// corrodes and drifts the gravity. Six landmark zones stack on top: the drifting Moving Quicksand, the Avalanche Danger Zone
// (a slide every 26 s after a 4 s rumble), the Spatial Sink (low gravity, drawn to the centre), the Smoldering Trench (heat),
// the Glacial Crevasse Network (chill) and the Fracture Tear (gravity surges). Zones never kill outright: the damage path
// floors at 1 health unless a hazard catches you there.
//
// Port of the web build's authoritative rules:
//   region-hazards.ts  REGION_HAZARD, hazardAt, regionIdAt, FLARE_* / EXPOSURE_*
//   hazard-zones.ts    HAZARD_ZONES (radius x max(1, WORLD_SCALE / 2) = x3), zoneCenter, zoneAt, combineHazard
//   landmarks.ts       the six hazard landmarks' places (a fraction of their region's radius from its centre)
// Golden-tested (Tests/HazardCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"

#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace wf::hazard
{
	// ---- region hazards (region-hazards.ts) ----
	struct FHazardDef { std::string Id, Name, Hint; };
	/** the region's hazard; unknown regions and none fall back to the Nexus safe zone */
	WORLDFRACTURECORE_API const FHazardDef& RegionHazard(const std::string& RegionId);
	inline constexpr double FlarePeriod = 30, FlareWarn = 4, FlareBurn = 4, ExposureFillS = 40, ExposureHarm = 0.6;
	struct FHazardInput { std::string RegionId; /* "" = none */ double T = 0, Dt = 0; bool bSheltered = false; double Exposure = 0; };
	struct FHazardEffect
	{
		std::string Id = "none", Name;
		double GravityMul = 1, SpeedMul = 1, DamagePerSec = 0, Exposure = 0, Intensity = 0;
		std::optional<std::string> Warning;
	};
	WORLDFRACTURECORE_API FHazardEffect HazardAt(const FHazardInput& In);
	struct FRegionCircle { std::string Id; double X = 0, Z = 0, Radius = 0; };
	/** the region whose centre is closest, within its radius ("" outside them all) */
	WORLDFRACTURECORE_API std::string RegionIdAt(double X, double Z, const std::vector<FRegionCircle>& Regions);

	// ---- hazard zones (hazard-zones.ts) ----
	inline constexpr double ZoneScale = 3; // max(1, WORLD_SCALE / 2) at the web build's world scale 6
	inline constexpr double AvalanchePeriod = 26, AvalancheWarn = 4, AvalancheSlide = 3, SinkPull = 3.2, QuicksandDriftRadius = 7 * ZoneScale;
	struct FZone { std::string Id, Kind, Name, LandmarkId; double Radius = 0; std::string Hint; };
	WORLDFRACTURECORE_API const std::vector<FZone>& HazardZones();
	/** a hazard landmark's place: its region and the fractions of the region radius out from the centre */
	struct FLandmarkSpec { std::string Id, RegionId; double Dx = 0, Dz = 0; };
	WORLDFRACTURECORE_API const FLandmarkSpec* HazardLandmark(const std::string& LandmarkId);
	struct FPoint { double X = 0, Z = 0; };
	/** where the regions are (world.ts REGIONS): id -> circle, or none */
	using FRegionLookup = std::function<std::optional<FRegionCircle>(const std::string& RegionId)>;
	WORLDFRACTURECORE_API std::optional<FPoint> LandmarkPoint(const std::string& LandmarkId, const FRegionLookup& Regions);
	/** only the quicksand drifts, on a 90 s orbit */
	WORLDFRACTURECORE_API std::optional<FPoint> ZoneCenter(const FZone& Zone, double T, const FRegionLookup& Regions);
	struct FZoneEffect
	{
		std::optional<std::string> ZoneId;
		std::string Name;
		double SpeedMul = 1, GravityMul = 1, DamagePerSec = 0, PullX = 0, PullZ = 0, Intensity = 0;
		std::optional<std::string> Warning;
	};
	WORLDFRACTURECORE_API FZoneEffect ZoneAt(double X, double Z, double T, bool bSheltered, const FRegionLookup& Regions);
	/** speed and gravity multiply, damage adds, the louder warning wins */
	WORLDFRACTURECORE_API FHazardEffect CombineHazard(const FHazardEffect& Region, const FZoneEffect& Zone);
}
