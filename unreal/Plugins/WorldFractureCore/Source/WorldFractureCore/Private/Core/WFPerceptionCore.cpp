#include "Core/WFPerceptionCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>

namespace wf::perception
{
	FAi CreateAi(double X, double Z, double Hp)
	{
		FAi A;
		A.LastX = X; A.LastZ = Z; A.HomeX = X; A.HomeZ = Z; A.WpX = X; A.WpZ = Z; A.CoverX = X; A.CoverZ = Z; A.LastHp = Hp;
		return A;
	}

	double SightRange(double Night, double Visibility, bool bElite)
	{
		return BaseSight * (1 - Night * 0.45) * std::max(0.25, Visibility) * (bElite ? 1.3 : 1);
	}

	double AwarenessGain(const FStimulus& S)
	{
		if (S.bDamaged) return 10;
		double G = 0;
		if (S.Distance < S.Sight && S.bInView)
		{
			const double Closeness = 1 - S.Distance / S.Sight;
			G += (S.bFacing ? 1.6 : 0.5) * (0.3 + Closeness * 1.7);
		}
		const double Hearing = 60 * S.Noise;
		if (S.Distance < Hearing) G += 1.2 * (1 - S.Distance / Hearing);
		return G;
	}

	std::string StepAwareness(FAi& Ai, const FStimulus& S, double Px, double Pz, double Dt)
	{
		const double Gain = AwarenessGain(S);
		if (Gain > 0)
		{
			Ai.Awareness = std::min(1.5, Ai.Awareness + Gain * Dt);
			if (Ai.Awareness >= SuspiciousAt) { Ai.LastX = Px; Ai.LastZ = Pz; }
		}
		else Ai.Awareness = std::max(0.0, Ai.Awareness - 0.18 * Dt);
		const std::string Prev = Ai.State;
		if (Ai.Awareness >= AlertAt) Ai.State = "ALERT";
		else if (Prev == "ALERT") { Ai.State = "SEARCH"; Ai.Timer = SearchSeconds; }
		else if (Prev == "SEARCH") { Ai.Timer -= Dt; if (Ai.Timer <= 0 && Ai.Awareness < SuspiciousAt) Ai.State = "PATROL"; }
		else Ai.State = Ai.Awareness >= SuspiciousAt ? "SUSPICIOUS" : "PATROL";
		// once in combat, keep the target locked while it remains perceived
		if (Ai.State == "ALERT" && Gain > 0) Ai.Awareness = std::max(Ai.Awareness, AlertAt);
		return Ai.State;
	}

	bool ShouldTakeCover(double HpFraction, double CoverTime, bool bBoss) { return !bBoss && CoverTime <= 0 && HpFraction < 0.5; }

	FPoint PickCover(double Mx, double Mz, double Px, double Pz, double Side)
	{
		const double Dx = Mx - Px, Dz = Mz - Pz;
		double D = js::Hypot(Dx, Dz);
		if (D == 0) D = 1;
		const double Nx = Dx / D, Nz = Dz / D;
		return {Mx + Nx * 14 + -Nz * Side * 9, Mz + Nz * 14 + Nx * Side * 9};
	}

	double EnemyHitChance(double Distance, double Range, double PlayerSpeed, const std::string& Stance)
	{
		const double Reach = std::min(1.0, std::max(0.0, Distance / std::max(1.0, Range)));
		const double Base = 0.38 - 0.24 * Reach;
		const double Moving = 1 - std::min(0.4, std::max(0.0, PlayerSpeed) / 40);
		const double Low = Stance == "PRONE" ? 0.55 : Stance == "CROUCH" ? 0.75 : 1;
		return Base * Moving * Low;
	}

	double AggroRadius(double Night, bool bElite, double RadiusMod, double Aggression)
	{
		const double Mult = std::min(1.3, std::max(0.7, RadiusMod * Aggression));
		return (48 + Night * 22) * (bElite ? 1.25 : 1) * Mult;
	}

	double TrooperSpeed(double Night, bool bElite) { return (6.5 + Night * 1.5) * (bElite ? 1.1 : 1); }
	double WindupFor(bool bBoss, bool bElite) { return bBoss ? 0.25 : bElite ? 0.42 : 0.6; }
	double RangedCooldownFor(bool bBoss, bool bElite) { return bBoss ? 1.3 : bElite ? 1.9 : 2.6; }

	FPerceiveResult PerceiveStep(FAi& Ai, const FPerceiveInput& In, double Dt)
	{
		if (In.Hp > Ai.LastHp + 0.01) Ai = CreateAi(In.X, In.Z, In.Hp); // healed (or a fresh body in an old slot): start over
		FPerceiveResult R;
		R.bDamaged = In.Hp < Ai.LastHp - 0.001;
		Ai.LastHp = In.Hp;
		const double Dx = In.Px - In.X, Dz = In.Pz - In.Z;
		double D = js::Hypot(Dx, Dz);
		if (D == 0) D = 1; // sim.ts: Math.hypot(dx, dz) || 1
		const double FacingDot = (std::sin(In.Rot) * Dx + std::cos(In.Rot) * Dz) / D;
		const bool bInView = D >= LosRange || In.bLineClear;
		const double Sight = SightRange(In.Night, In.Visibility, In.bElite) * In.StealthMult * (In.Aggro / 70 > 1 ? std::min(1.6, In.Aggro / 70) : 1);
		const bool bForced = In.bBoss || In.bMission || (In.PlayerHp < 35 && D < 40);
		if (bForced && D < In.Aggro)
		{
			Ai.State = "ALERT"; Ai.Awareness = 1; Ai.LastX = In.Px; Ai.LastZ = In.Pz;
			R.State = "ALERT";
			return R;
		}
		FStimulus S;
		S.Distance = D; S.Sight = Sight; S.Noise = std::min(1.0, In.PlayerNoise + In.CombatHeat / 120); S.bDamaged = R.bDamaged; S.bFacing = FacingDot > 0.3; S.bInView = bInView;
		R.State = StepAwareness(Ai, S, In.Px, In.Pz, Dt);
		return R;
	}
}
