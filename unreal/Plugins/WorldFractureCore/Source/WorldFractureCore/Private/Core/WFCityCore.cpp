#include "Core/WFCityCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>

namespace wf::city
{
	namespace
	{
		constexpr double CityPi = 3.141592653589793;
		constexpr double CityHeatRise = 6, CityHeatDecay = 4;
		constexpr double CityDetectRise = 22, CityDetectFall = 14;
		constexpr double CityHackRate = 28;
		constexpr int CityMaxKillsPerSnapshot = 20;
	}

	double DecayCombatHeat(double Heat, double Dt) { return std::max(0.0, Heat - Dt * 6); }

	int HeatLevelFor(double Heat)
	{
		if (Heat >= 80) return 5;
		if (Heat >= 55) return 4;
		if (Heat >= 32) return 3;
		if (Heat >= 12) return 2;
		return 1;
	}

	double StepHeatMeter(double Heat, double CombatIntensity, double Dt)
	{
		const bool bEngaged = CombatIntensity > 8;
		const double Next = bEngaged ? Heat + CityHeatRise * Dt : Heat - CityHeatDecay * Dt;
		return std::max(0.0, std::min(100.0, Next));
	}

	FHeatStatus HeatStatus(double Heat)
	{
		switch (HeatLevelFor(Heat))
		{
		case 5: return {5, "LOCKDOWN", "City status: LOCKED DOWN \xC2\xB7 all districts on active pursuit"};
		case 4: return {4, "SUPPRESSED", "Drones + armored units \xC2\xB7 roadblocks active"};
		case 3: return {3, "ENGAGED", "Police units dispatched \xC2\xB7 roadblocks forming"};
		case 2: return {2, "PURSUED", "Traffic rerouting \xC2\xB7 pursuit vehicles inbound"};
		default: return {1, "MONITORED", "Patrol units aware of your position"};
		}
	}

	FDamageEffect VehicleDamageStage(double HealthPct)
	{
		if (HealthPct <= 15) return {"CRITICAL", 0.3, 0.35, true};
		if (HealthPct <= 35) return {"HEAVY", 0.55, 0.6, true};
		if (HealthPct <= 60) return {"MEDIUM", 0.8, 0.85, false};
		if (HealthPct <= 85) return {"LIGHT", 0.95, 0.95, false};
		return {"NOMINAL", 1, 1, false};
	}

	bool ShouldForceFootTransition(const std::string& Stage, bool bBlocked) { return Stage == "CRITICAL" || (Stage == "HEAVY" && bBlocked); }

	bool InVisionCone(const FSensor& S, double Px, double Pz, double HalfAngle)
	{
		const double Dx = Px - S.X, Dz = Pz - S.Z;
		const double Dist = js::Hypot(Dx, Dz);
		if (Dist > S.Range) return false;
		if (Dist < 0.05) return true;
		const double ToPlayer = std::atan2(Dx, Dz);
		const double Delta = std::atan2(std::sin(ToPlayer - S.Rot), std::cos(ToPlayer - S.Rot));
		return std::fabs(Delta) <= HalfAngle;
	}

	bool AnySensorSees(const std::vector<FSensor>& Sensors, double Px, double Pz)
	{
		return std::any_of(Sensors.begin(), Sensors.end(), [&](const FSensor& S) { return InVisionCone(S, Px, Pz); });
	}

	double StepDetectionMeter(double Meter, double Dt, bool bSeen, bool bHacking)
	{
		const double Rise = CityDetectRise * (bHacking ? 1.6 : 1);
		const double Next = bSeen ? Meter + Rise * Dt : Meter - CityDetectFall * Dt;
		return std::max(0.0, std::min(100.0, Next));
	}

	std::string DetectionStateFor(double Meter)
	{
		if (Meter >= 75) return "RED";
		if (Meter >= 30) return "YELLOW";
		return "GREEN";
	}

	FLockdownStatus LockdownStatus(double Meter)
	{
		if (Meter >= 90) return {"LOCKDOWN_PURGE", "LOCKDOWN \xC2\xB7 PURGE", "Sector sealed \xE2\x80\x94 purge protocol engaged"};
		if (Meter >= 75) return {"INTERCEPTION", "INTERCEPTION", "Security units moving to intercept"};
		if (Meter >= 30) return {"DRONE_TRACKING", "DRONE TRACKING", "Drones re-tasked to your last known position"};
		return {"MONITORING", "MONITORING", "Passive surveillance sweep"};
	}

	double StepHackProgress(double Progress, double Dt, const std::string& Detection)
	{
		if (Detection == "RED") return std::max(0.0, Progress - CityHackRate * 0.8 * Dt);
		const double Rate = Detection == "YELLOW" ? CityHackRate * 0.5 : CityHackRate;
		return std::min(100.0, Progress + Rate * Dt);
	}

	std::vector<FTurret> MakeTurrets(const std::vector<FRegionCircle>& Regions, double (*Cool0)())
	{
		std::vector<FTurret> Out;
		for (const FRegionCircle& R : Regions)
		{
			if (R.Kind != "safe" && R.Kind != "starter") continue;
			const int Count = R.Kind == "safe" ? 8 : 5;
			for (int I = 0; I < Count; ++I)
			{
				const double A = (static_cast<double>(I) / Count) * CityPi * 2;
				FTurret T;
				T.X = R.X + std::cos(A) * R.Radius * 0.92;
				T.Z = R.Z + std::sin(A) * R.Radius * 0.92;
				T.Zone = R.Id;
				T.Cool = Cool0 ? Cool0() : 0;
				T.Rot = A;
				T.Range = R.Kind == "safe" ? 62 : 44;
				Out.push_back(T);
			}
		}
		return Out;
	}

	std::vector<FSensor> NexusSensors(const std::vector<FTurret>& Turrets)
	{
		std::vector<FSensor> Out;
		for (const FTurret& T : Turrets) if (T.Zone == "nexus") Out.push_back({T.X, T.Z, T.Rot, T.Range * 0.75});
		return Out;
	}

	std::optional<FTurretShot> StepTurret(FTurret& T, const std::vector<FTurretTarget>& Targets, double Dt)
	{
		T.Flash = std::max(0.0, T.Flash - Dt * 3);
		T.Cool -= Dt;
		int Best = -1;
		double BestD = T.Range;
		for (size_t I = 0; I < Targets.size(); ++I)
		{
			const FTurretTarget& M = Targets[I];
			if (!M.bAlive || M.bLiving) continue; // Living World events are the player's fight, not the hub turrets'
			const double D = js::Hypot(M.X - T.X, M.Z - T.Z);
			if (D < BestD) { BestD = D; Best = static_cast<int>(I); }
		}
		if (Best < 0) return std::nullopt;
		const FTurretTarget& M = Targets[static_cast<size_t>(Best)];
		T.Rot = std::atan2(M.X - T.X, M.Z - T.Z);
		if (T.Cool > 0) return std::nullopt;
		T.Cool = 0.9;
		T.Flash = 1;
		const double Dx = M.X - T.X, Dz = M.Z - T.Z;
		double D = js::Hypot(Dx, Dz);
		if (D == 0) D = 1;
		FTurretShot Shot;
		Shot.Target = Best;
		Shot.KnockX = (Dx / D) * 8;
		Shot.KnockZ = (Dz / D) * 8;
		return Shot;
	}

	std::vector<FSignalEvent> QuestEventsFromHud(FQuestSignals& Signals, const FQuestHud& Hud, double Dt)
	{
		std::vector<FSignalEvent> Events;
		const FQuestSignals Prev = Signals;
		const double Slice = std::max(0.0, std::min(MaxSurviveDt, std::isfinite(Dt) ? Dt : 0.0));

		if (!Hud.RegionId.empty() && Hud.RegionId != Prev.Region) { Signals.Region = Hud.RegionId; Events.push_back({"ENTER_WORLD", Hud.RegionId, 0, ""}); }
		if (Hud.HeatLevel > Prev.HeatLevel) { Signals.HeatLevel = Hud.HeatLevel; Events.push_back({"HEAT_LEVEL", "", static_cast<double>(Hud.HeatLevel), ""}); }
		if (Hud.LockdownTier != Prev.LockdownTier) { Signals.LockdownTier = Hud.LockdownTier; Events.push_back({"LOCKDOWN_TIER", "", 0, Hud.LockdownTier}); }
		if (Hud.HackProgress >= 100 && !Prev.bHackDone) { Signals.bHackDone = true; Events.push_back({"HACK_COMPLETE", "", 0, ""}); }
		else if (Hud.HackProgress < 50) Signals.bHackDone = false;

		// kills: one event per machine the player actually defeated, credited to the region they are fighting in
		if (!Prev.Kills || Hud.Kills < *Prev.Kills) Signals.Kills = Hud.Kills; // first snapshot or counter reset: re-baseline
		else if (Hud.Kills > *Prev.Kills)
		{
			Signals.Kills = Hud.Kills;
			const int N = static_cast<int>(std::min(static_cast<double>(CityMaxKillsPerSnapshot), Hud.Kills - *Prev.Kills));
			for (int I = 0; I < N; ++I) Events.push_back({"KILL", Hud.RegionId, 0, ""});
		}

		// survive time: only while alive, in the region the player is standing in
		if (Hud.Hp > 0 && Slice > 0)
		{
			Events.push_back({"SURVIVED", Hud.RegionId, Slice, ""});
			if (Hud.bDiving) Events.push_back({"SURVIVED", "thalassia-dive", Slice, ""});
		}
		return Events;
	}
}
