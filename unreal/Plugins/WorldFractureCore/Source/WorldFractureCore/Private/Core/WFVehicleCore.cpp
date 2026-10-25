// World Fracture — vehicles. See WFVehicleCore.h.
#include "Core/WFVehicleCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>

namespace wf::vehicle
{
	namespace
	{
		FProfile MakeProfile(const char* Kind, const char* Mode)
		{
			FProfile P;
			P.Kind = Kind;
			P.Mode = Mode;
			return P;
		}

		const std::map<std::string, FProfile>& Profiles()
		{
			static const std::map<std::string, FProfile> Out = [] {
				std::map<std::string, FProfile> M;
				FProfile P = MakeProfile("RACER", "GROUND"); P.Top = 1.1; P.Accel = 60; P.Brake = 80; P.Steer = 1.7; P.Grip = 0.95; M["RACER"] = P;
				P = MakeProfile("OFFROAD", "GROUND"); P.Top = 0.9; P.Accel = 48; P.Steer = 1.5; P.Grip = 0.85; M["OFFROAD"] = P;
				P = MakeProfile("TANK", "GROUND"); P.Top = 0.55; P.Accel = 22; P.Brake = 40; P.Reverse = 10; P.Steer = 0.9; P.bPivot = true; P.Grip = 1; M["TANK"] = P;
				P = MakeProfile("JET", "AIR"); P.Top = 1.6; P.Accel = 40; P.Brake = 25; P.Reverse = 0; P.Steer = 1.0; P.Grip = 1; P.Takeoff = 32; P.Climb = 22; P.SafeExit = 4; M["JET"] = P;
				P = MakeProfile("HELI", "AIR"); P.Top = 0.8; P.Accel = 30; P.Brake = 40; P.Reverse = 10; P.Steer = 1.6; P.Grip = 1; P.Takeoff = 0; P.Climb = 9; P.SafeExit = 4; M["HELI"] = P;
				P = MakeProfile("BOAT", "WATER"); P.Top = 0.75; P.Accel = 30; P.Brake = 30; P.Reverse = 8; P.Steer = 1.2; P.Grip = 0.7; M["BOAT"] = P;
				P = MakeProfile("SUB", "WATER"); P.Top = 0.5; P.Accel = 18; P.Brake = 24; P.Reverse = 8; P.Steer = 1.0; P.Grip = 0.9; P.Climb = 4; M["SUB"] = P;
				return M;
			}();
			return Out;
		}

		double Sign(double V) { return V > 0 ? 1 : V < 0 ? -1 : 0; } // Math.sign (no -0 distinction needed here)
		double Clamp100(double V) { return std::isfinite(V) ? std::max(0.0, std::min(100.0, V)) : 0; }
	}

	const FProfile& ProfileFor(const std::string& Kind)
	{
		const auto F = Profiles().find(Kind);
		return F == Profiles().end() ? Profiles().at("OFFROAD") : F->second;
	}

	std::string KindFor(const std::string& Id, const std::string& Domain)
	{
		static const std::map<std::string, std::string> ById = {
			{"scrap-interceptor", "RACER"}, {"aether-hoverbike", "RACER"}, {"ai-interceptor", "JET"}, {"raider-buggy", "OFFROAD"}, {"wasteland-jeep", "OFFROAD"},
			{"tech-transport", "OFFROAD"}, {"goliath-tank", "TANK"}, {"fracture-behemoth", "TANK"}, {"rift-helicopter", "HELI"}, {"vanguard-jet", "JET"},
			{"void-skimmer", "JET"}, {"scrap-patrol-boat", "BOAT"}, {"leviathan", "BOAT"}, {"hydro-sub-skiff", "SUB"},
		};
		const auto F = ById.find(Id);
		if (F != ById.end()) return F->second;
		return Domain == "AIR" || Domain == "SPACE" ? "JET" : Domain == "WATER" ? "BOAT" : Domain == "AMPHIBIOUS" ? "SUB" : "OFFROAD";
	}

	FStepResult StepVehicle(const FProfile& P, const FState& St, const FInput& In, const FEnv& Env, double TopSpeed, double Dt)
	{
		double Speed = St.Speed, Yaw = St.Yaw, Y = St.Y, Vy = St.Vy, Slip = St.Slip, Roll = St.Roll, Pitch = St.Pitch;
		bool bAirborne = St.bAirborne;
		const bool bAir = P.Mode == "AIR", bWater = P.Mode == "WATER", bGround = P.Mode == "GROUND";
		const double Ground = bAir ? 1 : bWater ? 1 : Env.Grip;
		const double Max = TopSpeed * P.Top * (In.bBoost ? 1.4 : 1);
		// longitudinal
		if (In.Throttle > 0) Speed += P.Accel * Ground * In.Throttle * Dt;
		else if (In.Brake > 0) Speed -= (Speed > 0.5 ? P.Brake : P.Accel * 0.8) * In.Brake * Dt;
		else Speed *= std::exp(-(bAir && bAirborne ? 0.15 : bWater ? 1.0 : 1.4) * Dt);
		if (bGround) Speed *= std::exp(-(0.22 + Env.Slope * 1.6) * Dt);
		Speed = std::max(-P.Reverse, std::min(Max, Speed));
		// steering
		const double SpeedFactor = P.bPivot ? 1 : std::min(1.0, std::max(0.15, std::fabs(Speed) / 14));
		const bool bHandbrake = In.bHandbrake && bGround && std::fabs(Speed) > 8;
		const double SteerGrip = bGround ? Ground : 1;
		const double YawRate = P.Steer * SteerGrip * SpeedFactor * (bHandbrake ? 1.6 : 1) * (P.Kind == "JET" && !bAirborne ? 0.5 : 1);
		const double SignSpeed = Speed != 0 ? Sign(Speed) : 1; // Math.sign(speed || 1)
		Yaw += In.Steer * YawRate * Dt * (P.bPivot ? 1 : SignSpeed);
		// drift: lateral grip vs cornering load
		const double Load = std::fabs(In.Steer) * std::fabs(Speed) / 30;
		const double Hold = P.Grip * (bGround ? Env.Grip : 1) * (bHandbrake ? 0.45 : 1);
		Slip = Slip + (std::max(0.0, Load - Hold) - Slip) * (1 - std::exp(-6 * Dt));
		if (Slip > 0.3 && bGround) Speed *= std::exp(-0.5 * Slip * Dt);
		Roll += ((bAir ? -In.Steer * 0.6 : -In.Steer * std::min(0.12, Load * 0.1)) - Roll) * (1 - std::exp(-5 * Dt));

		// vertical
		FStepResult R;
		const bool bBlocked = bWater && !Env.bOverWater;
		if (bGround)
		{
			Y = Env.Floor + RideHeight; Vy = 0; bAirborne = false; Pitch = 0;
		}
		else if (bWater)
		{
			const double Surface = Env.Water + 0.6;
			if (P.Kind == "SUB")
			{
				Vy = (In.Ascend - In.Descend) * P.Climb;
				Y = std::min(Surface, std::max(Env.Floor + 1.2, Y + Vy * Dt));
			}
			else { Y = Surface; Vy = 0; }
			Pitch = 0;
			if (bBlocked) Speed *= std::exp(-6 * Dt); // beached: grinds to a halt in the shallows
		}
		else
		{
			const double Floor = Env.Floor + RideHeight;
			const bool bCanLift = P.Takeoff == 0 || Speed >= P.Takeoff;
			if (!bAirborne)
			{
				Y = Floor; Vy = 0;
				if (bCanLift && In.Ascend > 0) { bAirborne = true; Vy = P.Climb * 0.4; }
			}
			else
			{
				const double Want = (In.Ascend - In.Descend) * P.Climb;
				// a jet below takeoff speed sinks; a helicopter hovers
				const double SinkV = P.Takeoff > 0 && Speed < P.Takeoff * 0.7 ? -8 : 0;
				Vy += (Want + SinkV - Vy) * (1 - std::exp(-2.5 * Dt));
				Y += Vy * Dt;
				if (Y <= Floor)
				{
					R.bHardLanding = Vy < -7 || std::fabs(Speed) > P.Takeoff + 12;
					Y = Floor; Vy = 0; bAirborne = false; R.bLanded = true;
					if (R.bHardLanding) Speed *= 0.4;
				}
			}
			Pitch += ((bAirborne ? std::max(-0.35, std::min(0.35, Vy / 40)) : 0) - Pitch) * (1 - std::exp(-4 * Dt));
		}
		R.Speed = Speed; R.Yaw = Yaw; R.Y = Y; R.Vy = Vy; R.bAirborne = bAirborne; R.Slip = Slip; R.Roll = Roll; R.Pitch = Pitch;
		R.bBlocked = bBlocked;
		R.bSkidding = Slip > 0.3 || (bHandbrake && std::fabs(Speed) > 10);
		return R;
	}

	FExitCheck CanExitVehicle(const FProfile& P, const FState& St, bool bDeepWater)
	{
		FExitCheck R;
		if (St.bAirborne) { R.Reason = P.Kind == "JET" ? "Land first" : "Set down first"; return R; }
		if (std::fabs(St.Speed) > P.SafeExit) { R.Reason = "Too fast to get out"; return R; }
		if (bDeepWater && P.Mode == "WATER") { R.Reason = "Pull up to the shore first"; return R; }
		R.bOk = true;
		return R;
	}

	void VehicleCamera(const FProfile& P, double& OutDistance, double& OutHeight)
	{
		if (P.Mode == "AIR") { OutDistance = 22; OutHeight = 7; }
		else if (P.Mode == "WATER") { OutDistance = 13; OutHeight = 3.5; }
		else if (P.Kind == "TANK") { OutDistance = 15; OutHeight = 6; }
		else { OutDistance = 14; OutHeight = 5; }
	}

	std::string SurfaceAt(const std::string& RegionId, double Height, double WaterLevel)
	{
		if (Height < WaterLevel - 0.2) return "WATER";
		if (RegionId == "nexus") return "ROAD";
		if (RegionId == "solara") return "SAND";
		if (RegionId == "swamps") return "MUD";
		if (RegionId == "frostspire") return Height > 40 ? "ICE" : "SNOW";
		if (RegionId == "ember" || RegionId == "wastelands") return "GRAVEL";
		return "GRASS";
	}

	double SurfaceGrip(const std::string& Surface, double Slope)
	{
		static const std::map<std::string, double> Grip = {{"ROAD", 1}, {"GRASS", 0.85}, {"GRAVEL", 0.82}, {"SAND", 0.7}, {"SNOW", 0.62}, {"MUD", 0.55}, {"ICE", 0.35}, {"WATER", 1}};
		const auto F = Grip.find(Surface);
		return std::max(0.2, (F == Grip.end() ? 1.0 : F->second) * (1 - std::min(1.0, Slope) * 0.6));
	}

	FCondition NormalizeCondition(const FCondition& C) { return {Clamp100(C.Body), Clamp100(C.Engine), Clamp100(C.Tires), Clamp100(C.Suspension)}; }

	FCondition ImpactVehicle(const FCondition& C, double SpeedLost, const std::string& Mode)
	{
		const double Severity = std::max(0.0, std::fabs(SpeedLost) - 2) * (Mode == "casual" ? 0.4 : Mode == "competitive" ? 1.25 : 1);
		if (Severity == 0) return C;
		return NormalizeCondition({C.Body + Severity, C.Engine + Severity * 0.45, C.Tires + Severity * 0.3, C.Suspension + Severity * (SpeedLost > 18 ? 0.8 : 0.2)});
	}

	FConditionEffects ConditionEffects(const FCondition& C)
	{
		return {1 - C.Engine * 0.006, 1 - C.Engine * 0.007, 1 - C.Tires * 0.006, 1 - C.Suspension * 0.006, C.Engine >= 90 || C.Body >= 100};
	}

	double RepairPrice(const FCondition& C) { return std::ceil((C.Body + C.Engine + C.Tires + C.Suspension) / 4); }

	FCondition RecoverVehicle(const FCondition& C, bool bCalm, bool bStopped)
	{
		if (!(bCalm && bStopped)) return C;
		FCondition Out = C;
		Out.Body = std::min(85.0, C.Body);
		Out.Engine = std::min(70.0, C.Engine);
		return Out;
	}

	double RepairCost(const FCondition& C) { return RepairPrice(C) * RepairNexPerPoint; }

	double NexBalance(const std::map<std::string, double>& Ledger)
	{
		double Sum = 0;
		for (const auto& [K, V] : Ledger) Sum += V;
		return std::max(0.0, Sum);
	}

	bool SpendNex(std::map<std::string, double>& Ledger, const std::string& Id, double Price)
	{
		if (Price != std::floor(Price) || !std::isfinite(Price) || Price <= 0 || Ledger.count(Id) || NexBalance(Ledger) < Price) return false;
		Ledger[Id] = -Price;
		return true;
	}

	double TopSpeedFor(double BiomeGrip, double VehicleSpeedMod, double VehicleSpeed, std::optional<double> GearLevel, double DamageSpeed, double RaceSlow)
	{
		return BaseTopSpeed * BiomeGrip * VehicleSpeedMod * VehicleSpeed * (GearLevel ? 1 + *GearLevel * 0.04 : 1) * DamageSpeed * RaceSlow;
	}

	double EnvGrip(double SurfaceGripValue, const FConditionEffects& Fx, double VehicleHandling) { return SurfaceGripValue * Fx.Grip * Fx.Stability * VehicleHandling; }

	FGarage RewardVehicle(FGarage G, const std::string& VehicleId)
	{
		if (std::find(G.Owned.begin(), G.Owned.end(), VehicleId) == G.Owned.end()) G.Owned.push_back(VehicleId);
		if (std::find(G.Loadout.begin(), G.Loadout.end(), VehicleId) == G.Loadout.end())
		{
			G.Loadout.push_back(VehicleId);
			if (G.Loadout.size() > 3) G.Loadout.erase(G.Loadout.begin(), G.Loadout.end() - 3);
		}
		G.Selected = VehicleId;
		return G;
	}

	bool RepairVehicle(FGarage& G, std::map<std::string, double>& NexLedger, const std::string& VehicleId, double NowMs, std::string& OutMessage)
	{
		const auto Found = G.Conditions.find(VehicleId);
		const FCondition C = NormalizeCondition(Found == G.Conditions.end() ? FCondition{} : Found->second);
		const double Price = RepairCost(C);
		if (Price <= 0) { OutMessage = "Already in good condition"; return false; }
		if (!SpendNex(NexLedger, "repair:" + VehicleId + ":" + js::NumberToString(NowMs), Price))
		{
			OutMessage = "Needs " + js::NumberToString(Price) + " Nex (you have " + js::NumberToString(NexBalance(NexLedger)) + ")";
			return false;
		}
		G.Conditions[VehicleId] = FCondition{};
		OutMessage = "Repaired \xC2\xB7 -" + js::NumberToString(Price) + " Nex";
		return true;
	}
}
