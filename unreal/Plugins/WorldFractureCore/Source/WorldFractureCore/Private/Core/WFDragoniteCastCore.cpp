// World Fracture — casting Dragonite abilities. See WFDragoniteCastCore.h.
#include "Core/WFDragoniteCastCore.h"

#include "Core/WFJsCompat.h"
#include "Core/WFScenarioCore.h"

#include <algorithm>
#include <cmath>

namespace wf::dragoncast
{
	namespace
	{
		constexpr double CastPi = 3.14159265358979323846;

		double StatOf(const dragon::FStats& S, const char* Key)
		{
			const auto F = S.find(Key);
			return F == S.end() ? 0 : F->second;
		}

		bool CastHasKey(const FProgression& P, const std::string& Key)
		{
			return std::find(P.EarnedRewards.begin(), P.EarnedRewards.end(), Key) != P.EarnedRewards.end();
		}

		/** dragonite-cast.ts cone: damage everything alive in range inside the cone (deg = full angle). Returns hits. */
		int Cone(IWorld& World, std::vector<FMachine>& Machines, double X, double Z, double Yaw, double Range, double Deg, double DamageBoss, double DamageOther)
		{
			int Hits = 0;
			const double Half = (Deg * CastPi) / 360;
			for (size_t I = 0; I < Machines.size(); ++I)
			{
				FMachine& M = Machines[I];
				if (!M.bAlive) continue;
				const double Dx = M.X - X, Dz = M.Z - Z, D = std::hypot(Dx, Dz);
				if (D > Range) continue;
				double Da = std::atan2(Dx, Dz) - Yaw;
				Da = std::atan2(std::sin(Da), std::cos(Da));
				if (D > 1 && std::fabs(Da) > Half) continue;
				M.Hp -= World.DamageMods(Machines, I, M.bBoss ? DamageBoss : DamageOther, "THERMAL", X, Z);
				StunMachine(Machines[I], 0.4);
				if (Machines[I].Hp <= 0) World.Defeat(Machines, I);
				++Hits;
			}
			return Hits;
		}

		dragon::FStats StatsFor(const FContext& Ctx, const std::string& Id)
		{
			return dragon::StatsFor(*Ctx.Progression, Ctx.Class.value_or("null"), Id);
		}

		std::string Ceil(double V) { return js::NumberToString(std::ceil(V)); }
	}

	FRuntime::FRuntime()
	{
		for (const char* Id : dragon::AbilityIds) Cd[Id] = 0;
	}

	void StunMachine(FMachine& M, double Seconds)
	{
		M.Cool = std::max(M.Cool, M.bBoss ? std::min(Seconds, BossStunCap) : Seconds);
	}

	void ApplyVulnPulse(std::vector<FMachine>& Machines, double X, double Z, double Radius, double Mult, double Duration, double Now)
	{
		const double Until = Now + Duration;
		for (FMachine& M : Machines)
		{
			if (!M.bAlive) continue;
			if (std::hypot(M.X - X, M.Z - Z) <= Radius) { M.VulnUntil = Until; M.VulnMult = Mult; }
		}
	}

	double RegenEnergy(double Energy, double Dt, double Rate) { return std::min(EnergyMax, Energy + Dt * EnergyRegenPerSec * Rate); }

	const char* AbilityName(const std::string& Id)
	{
		if (Id == "dragonfire") return "Dragonfire";
		if (Id == "wyrmwing") return "Wyrmwing";
		if (Id == "dragonhide") return "Dragonhide";
		if (Id == "wyrmcall") return "Wyrmcall";
		if (Id == "roar") return "Roar of Ruin";
		if (Id == "scalebreaker") return "Scalebreaker";
		if (Id == "skyfall") return "Skyfall";
		return "";
	}

	FCastOutcome CastDragonite(FRuntime& Rt, IWorld& World, std::vector<FMachine>& Machines, double& Energy, const std::string& Id, const FPose& Pose, bool bGrounded, const FContext& Ctx, double Now)
	{
		FCastOutcome R;
		const FProgression& P = *Ctx.Progression;
		if (!Ctx.Class || !scenario::IsBonded(P, Ctx.Class)) { R.Text = "Bond with Vyrak to use Dragonite"; return R; }
		if (Id == "skyfall" && !CastHasKey(P, "vyrak-riding:" + *Ctx.Class)) { R.Text = "Skyfall needs the Ancient Bond"; return R; }
		if (Id == "wyrmwing" && !bGrounded && Rt.AirDashes > 0) { Rt.AirDashes -= 1; R.bOk = true; R.Text = "WYRMWING \xC2\xB7 air dash"; return R; }
		const std::string Name = AbilityName(Id);
		if (Rt.Cd[Id] > 0) { R.Text = Name + " \xC2\xB7 " + Ceil(Rt.Cd[Id]) + "s"; return R; }
		const dragon::FStats St = StatsFor(Ctx, Id);
		const double Cost = StatOf(St, "energy");
		if (Energy < Cost) { R.Text = Name + " \xC2\xB7 not enough energy"; return R; }
		const int Level = std::min(dragon::MaxUpgrade, dragon::UpgradeLevel(P, *Ctx.Class, Id));
		const double Fury = 1 + std::max(0.0, std::min(0.15, Ctx.Fury));
		Energy -= Cost;
		Rt.Cd[Id] = StatOf(St, "cooldown");
		R.bOk = true;

		if (Id == "dragonfire")
		{
			const double Dmg = StatOf(St, "damage"), Range = StatOf(St, "range");
			const int N = Cone(World, Machines, Pose.X, Pose.Z, Pose.Yaw, Range, StatOf(St, "coneDeg"), Dmg * Fury, Dmg * Fury * StatOf(St, "corruptedMult"));
			if (Level >= 4) Cone(World, Machines, Pose.X + std::sin(Pose.Yaw) * Range, Pose.Z + std::cos(Pose.Yaw) * Range, Pose.Yaw, 4, 360, Dmg * 0.8, Dmg * 0.8);
			World.Noise();
			World.Alert(N ? "DRAGONFIRE \xC2\xB7 " + std::to_string(N) + " burned" : std::string("DRAGONFIRE"));
			R.Text = "DRAGONFIRE";
		}
		else if (Id == "wyrmwing")
		{
			Rt.Glide = StatOf(St, "glideSeconds");
			Rt.AirDashes = std::max(0.0, StatOf(St, "airDashes") - 1);
			Rt.LandingStrike = StatOf(St, "landingStrike");
			World.Alert("WYRMWING");
			R.Text = "WYRMWING";
			R.LaunchVy = StatOf(St, "launch");
			R.GlideSeconds = Rt.Glide;
			R.AirDashes = StatOf(St, "airDashes");
		}
		else if (Id == "dragonhide")
		{
			Rt.Hide = StatOf(St, "duration");
			Rt.HideStats = St;
			World.Alert("DRAGONHIDE \xC2\xB7 scales raised");
			R.Text = "DRAGONHIDE";
		}
		else if (Id == "roar")
		{
			int N = 0;
			const double Radius = StatOf(St, "radius"), Knock = StatOf(St, "knockback");
			for (FMachine& M : Machines)
			{
				if (!M.bAlive || std::hypot(M.X - Pose.X, M.Z - Pose.Z) > Radius) continue;
				StunMachine(M, StatOf(St, "stagger"));
				if (!M.bBoss) M.Aim = 0;
				++N;
				if (Knock != 0 && !M.bBoss)
				{
					// operator-abilities.ts knockbackFrom
					const double Dx = M.X - Pose.X, Dz = M.Z - Pose.Z;
					double D = std::hypot(Dx, Dz);
					if (D == 0) D = 1;
					M.X = M.X + (Dx / D) * Knock;
					M.Z = M.Z + (Dz / D) * Knock;
				}
			}
			if (StatOf(St, "vulnMult") > 1) ApplyVulnPulse(Machines, Pose.X, Pose.Z, Radius, StatOf(St, "vulnMult"), StatOf(St, "vulnSeconds"), Now);
			World.Noise();
			World.Alert(N ? "ROAR OF RUIN \xC2\xB7 " + std::to_string(N) + " staggered" : std::string("ROAR OF RUIN"));
			R.Text = "ROAR";
		}
		else if (Id == "scalebreaker")
		{
			int N = 0;
			const double Range = StatOf(St, "range"), Dmg = StatOf(St, "damage") * Fury;
			for (int K = 0; K < static_cast<int>(StatOf(St, "strikes")); ++K) N += Cone(World, Machines, Pose.X, Pose.Z, Pose.Yaw, Range, StatOf(St, "arcDeg"), Dmg, Dmg);
			if (StatOf(St, "shieldBreak") != 0)
				for (FMachine& M : Machines)
					if (M.bAlive && !M.bBoss && std::hypot(M.X - Pose.X, M.Z - Pose.Z) <= Range)
					{
						M.VulnUntil = std::max(M.VulnUntil, Now + 5);
						M.VulnMult = std::max(M.VulnMult, 1.2);
					}
			World.Alert(N ? "SCALEBREAKER \xC2\xB7 " + std::to_string(N) + " struck" : std::string("SCALEBREAKER"));
			R.Text = "SCALEBREAKER";
		}
		else if (Id == "skyfall")
		{
			if (Rt.Pending)
			{
				Energy += Cost;
				Rt.Cd[Id] = 0;
				R.bOk = false;
				R.Text = "Vyrak is already diving";
				return R;
			}
			Rt.Pending = FSkyfall{Pose.X + std::sin(Pose.Yaw) * 14, Pose.Z + std::cos(Pose.Yaw) * 14, StatOf(St, "windup"), Fury, St};
			World.Alert("SKYFALL \xC2\xB7 Vyrak climbs");
			R.Text = "SKYFALL";
		}
		else if (Id == "wyrmcall")
		{
			if (!dragon::SummonWyrm(Rt.Wyrm, St))
			{
				Energy += Cost;
				Rt.Cd[Id] = 0;
				R.bOk = false;
				R.Text = "Vyrak is already answering";
				return R;
			}
			World.Alert("WYRMCALL \xC2\xB7 Vyrak answers");
			R.Text = "WYRMCALL";
		}
		return R;
	}

	FStepResult StepDragonite(FRuntime& Rt, IWorld& World, std::vector<FMachine>& Machines, double Dt, const FPose& Pose, const FContext& Ctx)
	{
		for (auto& [Id, Cd] : Rt.Cd) Cd = std::max(0.0, Cd - Dt);
		Rt.Glide = std::max(0.0, Rt.Glide - Dt);
		Rt.Hide = std::max(0.0, Rt.Hide - Dt);
		if (Rt.Hide <= 0) Rt.HideStats.reset();
		if (Rt.Pending)
		{
			Rt.Pending->Left -= Dt;
			if (Rt.Pending->Left <= 0)
			{
				const FSkyfall S = *Rt.Pending;
				Rt.Pending.reset();
				const double Furious = 1 + std::max(0.0, Ctx.Fury) * (StatOf(S.Stats, "furyMult") > 1 ? 2.5 : 1);
				const double Dmg = StatOf(S.Stats, "damage") * S.Fury * Furious;
				const int N = Cone(World, Machines, S.X, S.Z, 0, StatOf(S.Stats, "radius"), 360, Dmg, Dmg);
				World.Noise();
				World.Alert(N ? "SKYFALL \xC2\xB7 " + std::to_string(N) + " crushed" : std::string("SKYFALL"));
			}
		}
		if (Ctx.Class && Rt.Wyrm.State != dragon::EWyrmState::Bonded)
		{
			const dragon::FStats St = StatsFor(Ctx, "wyrmcall");
			// machine slots carry no id, so the wyrm targets by slot index
			std::vector<dragon::FWyrmTarget> Targets;
			for (size_t I = 0; I < Machines.size(); ++I)
			{
				const FMachine& M = Machines[I];
				const double D = std::hypot(M.X - Pose.X, M.Z - Pose.Z);
				if (M.bAlive && D < WyrmSight) Targets.push_back({static_cast<double>(I), D, M.bBoss, M.Aim > 0});
			}
			if (const std::optional<dragon::FWyrmAction> A = dragon::StepWyrm(Rt.Wyrm, Dt, Targets, St))
			{
				const size_t I = static_cast<size_t>(A->Target);
				if (I < Machines.size() && Machines[I].bAlive)
				{
					const double Base = StatOf(St, "damage");
					const double Dmg = A->Kind == "finisher" ? Base * 3 : A->Kind == "breath" ? Base * 1.5 : Base;
					if (A->Kind == "interrupt") { Machines[I].Aim = 0; StunMachine(Machines[I], 1.5); }
					else
					{
						Machines[I].Hp -= World.DamageMods(Machines, I, Dmg, "THERMAL", Pose.X, Pose.Z);
						if (Machines[I].Hp <= 0) World.Defeat(Machines, I);
					}
				}
			}
			if (Rt.Wyrm.bFinished) { Rt.Wyrm.bFinished = false; World.Alert("Vyrak withdraws"); }
		}
		FStepResult Out;
		if (Rt.HideStats) { Out.Resist = StatOf(*Rt.HideStats, "resist"); Out.Stagger = StatOf(*Rt.HideStats, "stagger"); }
		Out.bGliding = Rt.Glide > 0;
		return Out;
	}
}
