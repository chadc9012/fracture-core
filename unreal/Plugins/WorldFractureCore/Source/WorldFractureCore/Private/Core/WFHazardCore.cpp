#include "Core/WFHazardCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numbers>

namespace wf::hazard
{
	namespace
	{
		constexpr double HzPi = std::numbers::pi;
	}

	const FHazardDef& RegionHazard(const std::string& RegionId)
	{
		static const std::vector<std::pair<std::string, FHazardDef>> Defs{
			{"nexus", {"none", "Safe zone", "No hazards"}},
			{"veridan", {"overgrowth", "Overgrowth", "Dense growth slows you on foot"}},
			{"frostspire", {"exposure", "Exposure", "Cold builds outside — shelter in vehicles or interiors"}},
			{"ember", {"gravity-shift", "Shifting gravity", "Gravity swings between light and crushing"}},
			{"wastelands", {"dust-storm", "Dust storms", "Storm pulses scour the hull — vehicles shield you"}},
			{"solara", {"solar-flare", "Solar flares", "Flares burn exposed hulls — take shelter when warned"}},
			{"swamps", {"toxic-mire", "Toxic mire + gravity drift", "Bog drags and corrodes; gravity drifts"}},
		};
		for (const auto& [Id, Def] : Defs) if (Id == RegionId) return Def;
		return Defs.front().second;
	}

	FHazardEffect HazardAt(const FHazardInput& In)
	{
		const FHazardDef& Def = RegionHazard(In.RegionId);
		FHazardEffect Out;
		Out.Id = Def.Id; Out.Name = Def.Name;
		Out.Exposure = std::max(0.0, In.Exposure - In.Dt / 10);
		if (Def.Id == "overgrowth")
		{
			if (!In.bSheltered) { Out.SpeedMul = 0.9; Out.Intensity = 0.2; }
		}
		else if (Def.Id == "exposure")
		{
			const double E = In.bSheltered ? std::max(0.0, In.Exposure - In.Dt / 8) : std::min(1.0, In.Exposure + In.Dt / ExposureFillS);
			Out.Exposure = E;
			Out.Intensity = E;
			if (E > ExposureHarm) { Out.DamagePerSec = 4 * (E - ExposureHarm) / (1 - ExposureHarm); Out.SpeedMul = 0.85; Out.Warning = "Exposure critical — find shelter"; }
		}
		else if (Def.Id == "gravity-shift")
		{
			const double G = std::sin((In.T / 12) * HzPi * 2);
			Out.GravityMul = 1 + G * (G > 0 ? 0.6 : 0.65);
			Out.Intensity = std::fabs(G);
			if (G > 0.85) Out.Warning = "Gravity surge";
			else if (G < -0.85) Out.Warning = "Low gravity";
		}
		else if (Def.Id == "dust-storm")
		{
			const double Pulse = std::max(0.0, std::sin((In.T / 20) * HzPi * 2));
			Out.Intensity = Pulse;
			if (Pulse > 0.5 && !In.bSheltered) { Out.DamagePerSec = 1.5 * Pulse; Out.SpeedMul = 0.9; Out.Warning = "Dust storm — hull scouring"; }
		}
		else if (Def.Id == "solar-flare")
		{
			const double Ph = std::fmod(In.T, FlarePeriod);
			const double Start = FlarePeriod - FlareWarn - FlareBurn;
			if (Ph >= Start && Ph < Start + FlareWarn) { Out.Intensity = 0.5; Out.Warning = "Solar flare incoming — take shelter"; }
			else if (Ph >= Start + FlareWarn) { Out.Intensity = 1; if (!In.bSheltered) { Out.DamagePerSec = 6; Out.Warning = "Solar flare — hull burning"; } }
		}
		else if (Def.Id == "toxic-mire")
		{
			const double G = std::sin((In.T / 18) * HzPi * 2 + 1.3);
			Out.GravityMul = 1 + G * 0.35;
			if (!In.bSheltered) { Out.SpeedMul = 0.8; Out.DamagePerSec = 0.5; }
			Out.Intensity = 0.4 + std::fabs(G) * 0.4;
		}
		return Out;
	}

	std::string RegionIdAt(double X, double Z, const std::vector<FRegionCircle>& Regions)
	{
		std::string Best;
		double Bd = std::numeric_limits<double>::infinity();
		for (const FRegionCircle& R : Regions)
		{
			const double D = js::Hypot(X - R.X, Z - R.Z);
			if (D < R.Radius && D < Bd) { Bd = D; Best = R.Id; }
		}
		return Best;
	}

	const std::vector<FZone>& HazardZones()
	{
		static const std::vector<FZone> Zones{
			{"z-quicksand", "quicksand", "Moving Quicksand", "quicksand-basin", 16 * ZoneScale, "Sinks and slows you on foot — vehicles cross it"},
			{"z-avalanche", "avalanche", "Avalanche Danger Zone", "avalanche-run", 20 * ZoneScale, "Slides on a cycle; the rumble gives a few seconds to run"},
			{"z-sink", "spatial-sink", "Spatial Sink", "spatial-sink", 14 * ZoneScale, "Distance folds: gravity drops and you are drawn to the centre"},
			{"z-trench", "lava-trench", "Smoldering Trench", "smoldering-trench", 15 * ZoneScale, "Heat burns anything on foot; keep moving"},
			{"z-crevasse", "crevasse", "Glacial Crevasse Network", "glacial-crevasse", 17 * ZoneScale, "Ice fields chill and slow you"},
			{"z-tear", "fracture-tear", "Fracture Tear", "fracture-grottos", 14 * ZoneScale, "Gravity surges when the tear pulses"},
		};
		return Zones;
	}

	const FLandmarkSpec* HazardLandmark(const std::string& LandmarkId)
	{
		static const std::vector<FLandmarkSpec> Specs{
			{"fracture-grottos", "veridan", 0.1, -0.6},
			{"smoldering-trench", "ember", 0.5, -0.4},
			{"glacial-crevasse", "frostspire", -0.5, 0.4},
			{"avalanche-run", "frostspire", 0.45, 0.35},
			{"quicksand-basin", "solara", -0.2, 0.6},
			{"spatial-sink", "swamps", 0.5, -0.1},
		};
		for (const FLandmarkSpec& S : Specs) if (S.Id == LandmarkId) return &S;
		return nullptr;
	}

	std::optional<FPoint> LandmarkPoint(const std::string& LandmarkId, const FRegionLookup& Regions)
	{
		const FLandmarkSpec* S = HazardLandmark(LandmarkId);
		if (!S || !Regions) return std::nullopt;
		const std::optional<FRegionCircle> R = Regions(S->RegionId);
		if (!R) return std::nullopt;
		return FPoint{R->X + S->Dx * R->Radius, R->Z + S->Dz * R->Radius};
	}

	std::optional<FPoint> ZoneCenter(const FZone& Zone, double T, const FRegionLookup& Regions)
	{
		const std::optional<FPoint> Lm = LandmarkPoint(Zone.LandmarkId, Regions);
		if (!Lm || Zone.Kind != "quicksand") return Lm;
		const double A = (T / 90) * HzPi * 2;
		return FPoint{Lm->X + std::cos(A) * QuicksandDriftRadius, Lm->Z + std::sin(A) * QuicksandDriftRadius};
	}

	FZoneEffect ZoneAt(double X, double Z, double T, bool bSheltered, const FRegionLookup& Regions)
	{
		for (const FZone& Zone : HazardZones())
		{
			const std::optional<FPoint> C = ZoneCenter(Zone, T, Regions);
			if (!C) continue;
			const double D = js::Hypot(X - C->X, Z - C->Z);
			if (D > Zone.Radius) continue;
			const double Depth = 1 - D / Zone.Radius; // 0 at the rim, 1 at the centre
			FZoneEffect Out;
			Out.ZoneId = Zone.Id; Out.Name = Zone.Name; Out.Intensity = 0.3 + Depth * 0.7;
			if (Zone.Kind == "quicksand")
			{
				if (!bSheltered) { Out.SpeedMul = 0.45 + 0.35 * (1 - Depth); Out.Warning = "Quicksand — keep moving"; }
			}
			else if (Zone.Kind == "avalanche")
			{
				const double Ph = std::fmod(T, AvalanchePeriod);
				const double Start = AvalanchePeriod - AvalancheWarn - AvalancheSlide;
				if (Ph >= Start && Ph < Start + AvalancheWarn) { Out.Warning = "Avalanche rumble — leave the slope"; Out.Intensity = 0.6; }
				else if (Ph >= Start + AvalancheWarn) { Out.Intensity = 1; Out.SpeedMul = 0.7; if (!bSheltered) { Out.DamagePerSec = 9; Out.Warning = "Avalanche — buried"; } }
				else Out.Intensity = 0.15;
			}
			else if (Zone.Kind == "spatial-sink")
			{
				Out.GravityMul = 0.55;
				if (!bSheltered && D > 0.5) { Out.PullX = ((C->X - X) / D) * SinkPull * Depth; Out.PullZ = ((C->Z - Z) / D) * SinkPull * Depth; }
				Out.Warning = "Spatial sink — gravity unstable";
			}
			else if (Zone.Kind == "lava-trench")
			{
				if (!bSheltered) { Out.DamagePerSec = 2 + 3 * Depth; Out.SpeedMul = 0.9; Out.Warning = "Trench heat — keep moving"; }
			}
			else if (Zone.Kind == "crevasse")
			{
				if (!bSheltered) { Out.SpeedMul = 0.8; Out.DamagePerSec = 0.6; Out.Warning = "Crevasse chill"; }
			}
			else if (Zone.Kind == "fracture-tear")
			{
				const double G = std::sin((T / 9) * HzPi * 2);
				Out.GravityMul = 1 + G * 0.5;
				if (G > 0.8) Out.Warning = "Tear pulse — gravity surge";
				else Out.Warning.reset();
			}
			return Out;
		}
		return FZoneEffect{};
	}

	FHazardEffect CombineHazard(const FHazardEffect& Region, const FZoneEffect& Zone)
	{
		if (!Zone.ZoneId) return Region;
		FHazardEffect Out = Region;
		Out.Name = Region.Id == "none" ? Zone.Name : Region.Name + " · " + Zone.Name;
		Out.GravityMul = Region.GravityMul * Zone.GravityMul;
		Out.SpeedMul = Region.SpeedMul * Zone.SpeedMul;
		Out.DamagePerSec = Region.DamagePerSec + Zone.DamagePerSec;
		Out.Intensity = std::max(Region.Intensity, Zone.Intensity);
		// zone.damagePerSec > 0 || !region.warning ? zone.warning ?? region.warning : region.warning
		Out.Warning = Zone.DamagePerSec > 0 || !Region.Warning ? (Zone.Warning ? Zone.Warning : Region.Warning) : Region.Warning;
		return Out;
	}
}
