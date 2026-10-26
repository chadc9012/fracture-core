#include "Core/WFArmsCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>

namespace wf::arms
{
	namespace
	{
		vweapons::FOrdnanceDef ArRocket(const std::string& Id, const std::string& Name, double Speed, double Splash, double Life = 4, double Proximity = 1.4)
		{
			// launchers.ts rocket(): speed 70, life 4, splash 6, damage 1, proximity 1.4, any domain, then the overrides
			vweapons::FOrdnanceDef D;
			D.Id = Id; D.Kind = "ROCKET"; D.Name = Name; D.Speed = Speed; D.TurnRate = 0; D.Life = Life; D.SplashRadius = Splash; D.Damage = 1; D.Proximity = Proximity; D.Domain = "ANY";
			return D;
		}
	}

	bool InSwordArc(const FSwingBody& P, const FSwingTarget& E, double Reach)
	{
		const double Dx = E.X - P.X, Dz = E.Z - P.Z, D = js::Hypot(Dx, Dz);
		if (D > Reach * E.Scale + 1) return false;
		if (std::fabs(E.Feet - P.Feet) > MeleeHeight * std::max(1.0, E.Scale)) return false;
		if (D < 0.6) return true; // standing inside you: always caught
		return (Dx * std::sin(P.Yaw) + Dz * std::cos(P.Yaw)) / D >= std::cos(MeleeHalfArc);
	}

	const std::vector<FBlade>& Blades()
	{
		static const std::vector<FBlade> All = {
			{"vectal", "Vectal Monoblade Mk-IV", "HAKKE", "LEGENDARY", "Monomolecular Edge", 1.1, 1.4, 0, std::nullopt, 0},
			{"aegis-broadsword", "Aegis Resonance Broadsword", "BLACK_ARMORY", "EXOTIC", "Fracture Shockwave", 1.25, 1, 1, FShockwave{12, 2.5, 4}, 0},
			{"sun-cutter", "Sun-Cutter Curved Sabra", "SUROS", "EXOTIC", "Thermal Reflection", 1, 1, 2, std::nullopt, 0.6},
		};
		return All;
	}

	std::string BladeKey(const std::string& Id) { return "blade:" + Id; }

	const FBlade* ActiveBlade(const std::vector<std::string>& EarnedRewards, const std::optional<std::string>& Equipped)
	{
		if (!Equipped) return nullptr;
		for (const FBlade& B : Blades())
			if (B.Id == *Equipped)
				return std::find(EarnedRewards.begin(), EarnedRewards.end(), BladeKey(B.Id)) != EarnedRewards.end() ? &B : nullptr;
		return nullptr;
	}

	FSwing SwingStats(const FBlade* Blade, int Combo, double BaseDamage, double BaseReach, bool bArmored)
	{
		const bool bFinisher = Combo == 3;
		FSwing S;
		S.Damage = BaseDamage * (bFinisher ? 1.8 : 1) * (Blade ? Blade->Damage : 1) * (bArmored ? (Blade ? Blade->Armored : 1) : 1);
		S.Reach = BaseReach + (Blade ? Blade->Reach : 0);
		if (bFinisher && Blade) S.Shockwave = Blade->Shockwave;
		S.Deflect = Blade ? Blade->Deflect : 0;
		return S;
	}

	bool InShockwave(const FShockwave& Sw, double Ox, double Oz, double Yaw, double X, double Z)
	{
		const double Fx = std::sin(Yaw), Fz = std::cos(Yaw);
		const double Dx = X - Ox, Dz = Z - Oz;
		const double Along = Dx * Fx + Dz * Fz, Across = std::fabs(Dx * Fz - Dz * Fx);
		return Along >= 0 && Along <= Sw.Length && Across <= Sw.Width;
	}

	void TickCombo(FCombo& C, double Dt)
	{
		C.Cool -= Dt;
		C.Window = std::max(0.0, C.Window - Dt);
		if (C.Window <= 0) C.Step = 0;
	}

	int Swing(FCombo& C, double FireRate)
	{
		if (C.Cool > 0) return 0;
		C.Cool = FireRate;
		C.Step = (C.Step % 3) + 1;
		C.Window = ComboWindow;
		return C.Step;
	}

	const std::vector<FLauncher>& Launchers()
	{
		static const std::vector<FLauncher> All = [] {
			std::vector<FLauncher> L;
			L.push_back({"ROCKET", "KINETIC", "BALLISTIC", false, 0, 0, ArRocket("launcher-rocket", "Breacher rocket", 75, 7)});
			L.push_back({"CINDER", "THERMAL", "FIRE", false, 0, 0, ArRocket("launcher-cinder", "Cinder incendiary rocket", 62, 8)});
			FLauncher Frost{"FROSTBITE", "CRYO", "ICE", true, 0.45, 90, ArRocket("launcher-frostbite", "Frostbite guided missile", 58, 6, 6, 2)};
			Frost.Ordnance.Kind = "MISSILE";
			Frost.Ordnance.TurnRate = 1.3;
			L.push_back(Frost);
			L.push_back({"VITRIOL", "BIO", "ACID", false, 0, 0, ArRocket("launcher-vitriol", "Vitriol corrosive rocket", 55, 9, 4.5)});
			return L;
		}();
		return All;
	}

	const FLauncher* LauncherById(const std::string& Id)
	{
		for (const FLauncher& L : Launchers()) if (L.Id == Id) return &L;
		return nullptr;
	}

	FLaunch FireLauncher(const FLauncher& L, const vweapons::FVec& From, double Yaw, double Pitch, double Damage, const std::vector<vweapons::FCandidate>& Cands)
	{
		FLaunch Out;
		Out.Target = L.bGuided ? vweapons::PickLockTarget(From.X, From.Z, Yaw, Cands, L.LockCone, L.LockRange) : -1;
		vweapons::FOrdnanceDef D = L.Ordnance;
		D.Damage = Damage;
		Out.Round = vweapons::FireRound(D, From, {std::sin(Yaw) * std::cos(Pitch), std::sin(Pitch), std::cos(Yaw) * std::cos(Pitch)});
		Out.Round.Target = Out.Target;
		return Out;
	}

	vweapons::FVec StepKnock(double& Kx, double& Kz, double Dt, bool bBoss)
	{
		const double Mass = bBoss ? BossKnockMass : 1;
		const vweapons::FVec Step{(Kx / Mass) * Dt, 0, (Kz / Mass) * Dt};
		const double Decay = std::exp(-3 * Dt);
		Kx *= Decay;
		Kz *= Decay;
		return Step;
	}
}
