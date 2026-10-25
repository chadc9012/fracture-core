// World Fracture — Dragonite abilities, Vyrak trust and dragon riding. See WFDragonCore.h.
#include "Core/WFDragonCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <set>

namespace wf::dragon
{
	const char* const AbilityIds[7] = {"dragonfire", "wyrmwing", "dragonhide", "wyrmcall", "roar", "scalebreaker", "skyfall"};

	namespace
	{
		const FAbilityDef Abilities[7] = {
			{"dragonfire", 18, 25, 0.6}, {"wyrmwing", 22, 20, 0.2}, {"dragonhide", 30, 30, 0}, {"wyrmcall", 120, 60, 0.8},
			{"roar", 26, 28, 0.4}, {"scalebreaker", 20, 22, 0.3}, {"skyfall", 150, 80, 1.0},
		};
		const char* const ChallengeIds[3] = {"unbroken-covenant", "wings-of-the-ancient", "dragons-patience"};

		bool DragonHas(const FProgression& P, const std::string& Key)
		{
			return std::find(P.EarnedRewards.begin(), P.EarnedRewards.end(), Key) != P.EarnedRewards.end();
		}
		void DragonAdd(FProgression& P, const std::string& Key)
		{
			if (!DragonHas(P, Key)) P.EarnedRewards.push_back(Key);
		}
		bool DragonBonded(const FProgression& P, const std::optional<std::string>& Class)
		{
			return Class && DragonHas(P, "covenant:vyrak:" + *Class);
		}
		std::string UpKey(const std::string& Class, const std::string& Ability, int N)
		{
			return "dragonite-up:" + Class + ":" + Ability + ":" + std::to_string(N);
		}
		std::string DragonLower(std::string S)
		{
			for (char& C : S) if (C >= 'A' && C <= 'Z') C = static_cast<char>(C - 'A' + 'a');
			return S;
		}
		/** unique, non-empty source ids under a prefix (vyrak-trust.ts count) */
		double CountUnique(const FProgression& P, const std::string& Prefix, const std::string& Exclude = std::string())
		{
			std::set<std::string> Seen;
			for (const std::string& R : P.EarnedRewards)
			{
				if (R.size() <= Prefix.size() || R.compare(0, Prefix.size(), Prefix) != 0) continue;
				if (!Exclude.empty() && R.size() >= Exclude.size() && R.compare(R.size() - Exclude.size(), Exclude.size(), Exclude) == 0) continue;
				Seen.insert(R);
			}
			return static_cast<double>(Seen.size());
		}
		double ChallengesDone(const FProgression& P, const std::string& Class)
		{
			double N = 0;
			for (const char* Id : ChallengeIds) if (DragonHas(P, "covenant-challenge:" + Class + ":" + Id)) N += 1;
			return N;
		}
		bool FullRidingTrust(const FProgression& P, const std::string& Class)
		{
			return DragonBonded(P, Class) && TrustOf(P, Class).Total >= FullTrust;
		}
		void WithGear(FProgression& P, const FGearItem& Item)
		{
			if (std::none_of(P.Inventory.begin(), P.Inventory.end(), [&Item](const FGearItem& G) { return G.Id == Item.Id; })) P.Inventory.push_back(Item);
		}
		double Clamp(double V, double A, double B) { return std::max(A, std::min(B, V)); }
		bool Finite(double V) { return std::isfinite(V); }
	}

	const FAbilityDef* FindAbility(const std::string& Id)
	{
		for (const FAbilityDef& A : Abilities) if (Id == A.Id) return &A;
		return nullptr;
	}

	int UpgradeLevel(const FProgression& P, const std::string& Class, const std::string& Ability)
	{
		int N = 0;
		while (N < MaxUpgrade && DragonHas(P, UpKey(Class, Ability, N + 1))) ++N;
		return N;
	}

	FUpgradeResult UpgradeDragonite(FProgression P, const std::optional<std::string>& Class, const std::string& Ability)
	{
		FUpgradeResult R;
		if (!Class || !DragonBonded(P, Class)) { R.Error = "Bond with Vyrak on this Operator first"; R.Progression = std::move(P); return R; }
		const int Lv = UpgradeLevel(P, *Class, Ability);
		if (Lv >= MaxUpgrade) { R.Error = "Fully upgraded"; R.Progression = std::move(P); return R; }
		const double Cost = UpgradeCost[Lv];
		const auto Found = P.Materials.find("dragonite");
		const double Have = Found == P.Materials.end() ? 0 : Found->second;
		if (Have < Cost) { R.Error = "Needs " + js::NumberToString(Cost) + " Dragonite (you have " + js::NumberToString(Have) + ")"; R.Progression = std::move(P); return R; }
		P.Materials["dragonite"] = Have - Cost;
		P.EarnedRewards.push_back(UpKey(*Class, Ability, Lv + 1));
		R.Progression = std::move(P);
		return R;
	}

	std::vector<std::string> WornCovenant(const std::vector<FGearItem>& Inventory, const std::map<std::string, std::string>& Equipped)
	{
		std::set<std::string> Ids;
		for (const auto& [Slot, Id] : Equipped) Ids.insert(Id);
		std::vector<std::string> Out;
		for (const FGearItem& G : Inventory)
			if (G.SetId && *G.SetId == "dragons-covenant" && Ids.count(G.Id)) Out.push_back(G.Slot);
		return Out;
	}

	FArmorBonus ArmorBonus(const std::vector<std::string>& Worn, const std::optional<std::string>& Enhance)
	{
		auto Wearing = [&Worn](const char* Slot) { return std::find(Worn.begin(), Worn.end(), Slot) != Worn.end(); };
		const size_t N = std::set<std::string>(Worn.begin(), Worn.end()).size();
		FArmorBonus B;
		B.EnergyCost = Wearing("helmet") ? 0.1 : 0;
		B.Stagger = Wearing("chest") ? 0.15 : 0;
		B.BurnChance = Wearing("gauntlets") ? 0.2 : 0;
		B.AirControl = Wearing("legs") ? 0.2 : 0;
		B.SummonTime = Wearing("classItem") ? 0.15 : 0;
		B.Potency = N >= 5 ? 0.12 : N >= 2 ? 0.04 : 0;
		if (N >= 3) B.Enhanced = Enhance;
		B.bAura = N >= 5;
		return B;
	}

	int AppearanceStage(double Clears) { return Clears >= 6 ? 3 : Clears >= 3 ? 2 : 1; }

	FStats DragoniteStats(const std::string& Ability, double Level, const FArmorBonus& Armor)
	{
		const FAbilityDef* Base = FindAbility(Ability);
		if (!Base) return {};
		const double L = std::max(0.0, std::min(static_cast<double>(MaxUpgrade), Level));
		const double Boost = 1 + Armor.Potency + (Armor.Enhanced && *Armor.Enhanced == Ability ? 0.15 : 0);
		const double Energy = js::Round(Base->Energy * (1 - Armor.EnergyCost));
		if (Ability == "dragonfire")
			return {{"cooldown", Base->Cooldown}, {"energy", Energy}, {"damage", (6 + 1.5 * L) * Boost}, {"range", 10 + (L >= 1 ? 3 : 0)}, {"coneDeg", 40 + (L >= 2 ? 20 : 0)},
				{"corruptedMult", L >= 3 ? 1.5 : 1.2}, {"burnSeconds", 4}, {"burnChance", std::min(1.0, 0.7 + Armor.BurnChance)}, {"eruption", L >= 4 ? 1 : 0}};
		if (Ability == "wyrmwing")
			return {{"cooldown", Base->Cooldown}, {"energy", Energy}, {"launch", (9 + (L >= 1 ? 2 : 0)) * Boost}, {"glideSeconds", 4 + (L >= 2 ? 2 : 0)}, {"airDashes", L >= 3 ? 2 : 1},
				{"control", 0.5 + Armor.AirControl}, {"landingStrike", L >= 4 ? 1 : 0}};
		if (Ability == "dragonhide")
			return {{"cooldown", Base->Cooldown}, {"energy", Energy}, {"resist", std::min(ResistCap, (0.25 + 0.03 * L) * Boost)}, {"duration", 8},
				{"stagger", std::min(0.9, 0.3 + (L >= 2 ? 0.2 : 0) + Armor.Stagger)}, {"perfectWindow", 0.3 + (L >= 3 ? 0.15 : 0)}, {"perfectBonus", 0.1}, {"allyShield", L >= 4 ? 0.1 : 0}};
		if (Ability == "roar")
			return {{"cooldown", Base->Cooldown}, {"energy", Energy}, {"radius", (9 + (L >= 1 ? 3 : 0)) * Boost}, {"stagger", 2 + (L >= 2 ? 1.2 : 0)}, {"vulnMult", L >= 3 ? 1.25 : 1},
				{"vulnSeconds", 6}, {"knockback", L >= 4 ? 5 : 0}};
		if (Ability == "scalebreaker")
			return {{"cooldown", Base->Cooldown}, {"energy", Energy}, {"damage", (8 + 2 * L) * Boost}, {"arcDeg", 70 + (L >= 1 ? 30 : 0)}, {"range", 5.5}, {"shieldBreak", L >= 2 ? 1 : 0},
				{"strikes", L >= 3 ? 2 : 1}};
		if (Ability == "skyfall")
			return {{"cooldown", L >= 1 ? 120 : Base->Cooldown}, {"energy", Energy}, {"radius", (9 + (L >= 2 ? 3 : 0)) * Boost}, {"damage", 32 * Boost}, {"windup", Base->Windup},
				{"burn", L >= 3 ? 1 : 0}, {"furyMult", L >= 4 ? 1.5 : 1}};
		// wyrmcall
		return {{"cooldown", std::max(60.0, 120.0 - (L >= 2 ? 25 : 0))}, {"energy", Energy}, {"duration", (12 + (L >= 1 ? 4 : 0)) * (1 + Armor.SummonTime)}, {"strafes", 1 + (L >= 3 ? 1 : 0)},
			{"damage", 14 * Boost}, {"finisher", L >= 4 ? 1 : 0}};
	}

	FStats StatsFor(const FProgression& P, const std::string& Class, const std::string& Ability)
	{
		const FArmorBonus Armor = ArmorBonus(WornCovenant(P.Inventory, P.EquippedGear));
		return DragoniteStats(Ability, std::min(MaxUpgrade, UpgradeLevel(P, Class, Ability)), Armor);
	}

	double CappedResist(double ArmorResist, double Dragonhide) { return std::min(ResistCap, std::max(0.0, ArmorResist) + std::max(0.0, Dragonhide)); }

	// ---- Wyrmcall ally ----
	const char* WyrmStateName(EWyrmState S)
	{
		switch (S)
		{
		case EWyrmState::Bonded: return "BONDED";
		case EWyrmState::Approach: return "APPROACH";
		case EWyrmState::Assess: return "ASSESS";
		case EWyrmState::Attack: return "ATTACK";
		case EWyrmState::Defend: return "DEFEND";
		case EWyrmState::Withdraw: return "WITHDRAW";
		case EWyrmState::Recovery: return "RECOVERY";
		}
		return "BONDED";
	}

	bool SummonWyrm(FWyrm& W, const FStats& Stats)
	{
		if (W.State != EWyrmState::Bonded || W.Cooldown > 0) return false;
		const auto Duration = Stats.find("duration");
		const auto Strafes = Stats.find("strafes");
		W.State = EWyrmState::Approach;
		W.T = 0;
		W.Left = Duration != Stats.end() ? Duration->second : 12;
		W.StrafesLeft = Strafes != Stats.end() ? Strafes->second : 1;
		W.Target.reset();
		W.bFinished = false;
		return true;
	}

	std::optional<FWyrmAction> StepWyrm(FWyrm& W, double Dt, const std::vector<FWyrmTarget>& Targets, const FStats& Stats)
	{
		W.Cooldown = std::max(0.0, W.Cooldown - Dt);
		if (W.State == EWyrmState::Bonded || W.State == EWyrmState::Recovery)
		{
			if (W.State == EWyrmState::Recovery && W.Cooldown <= 0) W.State = EWyrmState::Bonded;
			return std::nullopt;
		}
		W.T += Dt;
		W.Left -= Dt;
		if (W.State != EWyrmState::Withdraw && W.Left <= 0) { W.State = EWyrmState::Withdraw; W.T = 0; return std::nullopt; }
		switch (W.State)
		{
		case EWyrmState::Approach:
			if (W.T >= ApproachTime) { W.State = EWyrmState::Assess; W.T = 0; }
			return std::nullopt;
		case EWyrmState::Assess:
		{
			if (W.T < AssessTime) return std::nullopt;
			for (const FWyrmTarget& X : Targets)
				if (X.bWindingUp && !X.bBoss) { W.State = EWyrmState::Defend; W.T = 0; W.Target = X.Id; return std::nullopt; }
			std::vector<FWyrmTarget> Sorted = Targets;
			std::stable_sort(Sorted.begin(), Sorted.end(), [](const FWyrmTarget& A, const FWyrmTarget& B) {
				if (A.bBoss != B.bBoss) return A.bBoss;
				return A.Dist < B.Dist;
			});
			if (Sorted.empty()) { W.T = 0; return std::nullopt; }
			W.State = EWyrmState::Attack;
			W.T = 0;
			W.Target = Sorted.front().Id;
			return std::nullopt;
		}
		case EWyrmState::Attack:
		{
			if (W.T < AttackTime) return std::nullopt;
			const double Target = W.Target.value_or(0);
			bool bBoss = false;
			for (const FWyrmTarget& X : Targets) if (X.Id == Target) { bBoss = X.bBoss; break; }
			W.T = 0;
			const auto Finisher = Stats.find("finisher");
			const bool bFinisher = Finisher != Stats.end() && Finisher->second != 0 && Finisher->second == Finisher->second;
			if (bBoss && bFinisher && W.StrafesLeft <= 0) { W.State = EWyrmState::Withdraw; return FWyrmAction{"finisher", Target}; }
			FWyrmAction Action{W.StrafesLeft > 0 ? "strafe" : "breath", Target};
			if (W.StrafesLeft > 0) W.StrafesLeft -= 1;
			W.State = EWyrmState::Assess;
			return Action;
		}
		case EWyrmState::Defend:
		{
			const double Target = W.Target.value_or(0);
			W.State = EWyrmState::Assess;
			W.T = 0;
			return FWyrmAction{"interrupt", Target};
		}
		case EWyrmState::Withdraw:
			if (W.T >= WithdrawTime)
			{
				W.State = EWyrmState::Recovery;
				const auto Cooldown = Stats.find("cooldown");
				W.Cooldown = Cooldown != Stats.end() ? Cooldown->second : 0;
				W.bFinished = true;
			}
			return std::nullopt;
		default:
			return std::nullopt;
		}
	}

	// ---- trust and riding ----
	FTrust TrustOf(const FProgression& P, const std::optional<std::string>& Class)
	{
		FTrust T;
		if (!Class || !DragonBonded(P, Class)) return T;
		const std::string& C = *Class;
		T.Challenge = std::min(ChallengesDone(P, C) * 25, 75.0);
		T.Encounter = std::min(CountUnique(P, "enc-done:" + C + ":", ":vyrak") * 8, 32.0);
		T.Ruin = std::min(CountUnique(P, "vyrak-ruin:" + C + ":") * 6, 18.0);
		T.Puzzle = std::min(CountUnique(P, "vyrak-puzzle:" + C + ":") * 10, 20.0);
		T.Protect = std::min(CountUnique(P, "vyrak-protect:" + C + ":") * 15, 15.0);
		T.Total = std::min(FullTrust, T.Challenge + T.Encounter + T.Ruin + T.Puzzle + T.Protect);
		return T;
	}

	int TrustStage(const FProgression& P, const std::optional<std::string>& Class)
	{
		if (!Class || !DragonBonded(P, Class)) return 0;
		if (FullRidingTrust(P, *Class) && DragonHas(P, "vyrak-riding:" + *Class)) return DragonHas(P, "vyrak-eternal:" + *Class) ? 5 : 4;
		return TrustOf(P, Class).Total > 0 ? 3 : 2;
	}

	FProgression RecordTrust(FProgression P, const std::optional<std::string>& Class, const std::string& Kind, const std::string& Id)
	{
		if (!Class || !DragonBonded(P, Class) || Id.empty()) return P;
		const char* Prefix = Kind == "ruin" ? "vyrak-ruin:" : Kind == "puzzle" ? "vyrak-puzzle:" : "vyrak-protect:";
		DragonAdd(P, Prefix + *Class + ":" + Id);
		return P;
	}

	FGearItem AncientBondGear(const std::string& Class)
	{
		FGearItem G;
		G.Id = "vyrak-wingmantle-" + DragonLower(Class);
		G.Name = "Wingmantle of the Ancient Bond";
		G.Slot = "classItem";
		G.Power = 330;
		G.Level = 1;
		G.Element = "THERMAL";
		G.Rarity = "EXOTIC";
		G.SetId = "dragons-covenant";
		G.Source = "Vyrak's Ancient Bond";
		return G;
	}

	FGearItem EternalGear(const std::string& Class)
	{
		FGearItem G;
		G.Id = "vyrak-eternal-crest-" + DragonLower(Class);
		G.Name = "Crest of the Eternal Covenant";
		G.Slot = "helmet";
		G.Power = 340;
		G.Level = 1;
		G.Element = "THERMAL";
		G.Rarity = "EXOTIC";
		G.SetId = "dragons-covenant";
		G.Source = "Vyrak's Eternal Covenant";
		return G;
	}

	FClaimResult ClaimAncientBond(FProgression P, const std::optional<std::string>& Class)
	{
		FClaimResult R;
		if (!Class || !DragonBonded(P, Class)) { R.Reason = "Not bonded on this Operator"; R.Progression = std::move(P); return R; }
		if (DragonHas(P, "vyrak-riding:" + *Class)) { R.Reason = "Already complete"; R.Progression = std::move(P); return R; }
		const double Total = TrustOf(P, Class).Total;
		if (Total < FullTrust) { R.Reason = "Trust " + js::NumberToString(Total) + "/" + js::NumberToString(FullTrust); R.Progression = std::move(P); return R; }
		DragonAdd(P, "vyrak-riding:" + *Class);
		WithGear(P, AncientBondGear(*Class));
		R.Progression = std::move(P);
		R.bOk = true;
		return R;
	}

	FClaimResult ClaimEternalCovenant(FProgression P, const std::optional<std::string>& Class)
	{
		FClaimResult R;
		if (!Class || !FullRidingTrust(P, *Class) || !DragonHas(P, "vyrak-riding:" + *Class) || ChallengesDone(P, *Class) < EternalChallenges)
		{
			R.Progression = std::move(P);
			return R;
		}
		DragonAdd(P, "vyrak-eternal:" + *Class);
		WithGear(P, EternalGear(*Class));
		R.Progression = std::move(P);
		R.bOk = true;
		return R;
	}

	FRideCheck CanRide(const FProgression& P, const std::optional<std::string>& Class, const FRideContext& Ctx)
	{
		FRideCheck R;
		if (!Class || !FullRidingTrust(P, *Class) || !DragonHas(P, "vyrak-riding:" + *Class)) { R.Reason = "Vyrak does not trust you enough to carry you"; return R; }
		if (Ctx.bIndoors) { R.Reason = "Too cramped to ride indoors"; return R; }
		if (Ctx.bInDungeon) { R.Reason = "Vyrak will not enter this place"; return R; }
		if (Ctx.bInStoryMission) { R.Reason = "The mission requires you on foot"; return R; }
		if (Ctx.RegionId && (*Ctx.RegionId == "nexus" || *Ctx.RegionId == "neon")) { R.Reason = "The city's airspace is locked down"; return R; }
		R.bOk = true;
		return R;
	}

	FFlight CreateFlight(double X, double Y, double Z, double Yaw)
	{
		FFlight F;
		F.X = X; F.Y = Y; F.Z = Z; F.Yaw = Yaw; F.Pitch = 0; F.Bank = 0; F.Speed = FlightCruise;
		return F;
	}

	bool StepFlightAir(const FFlight& F, double InPitch, double InTurn, double InThrottle, double Dt, FFlight& Out)
	{
		// A paused tab or malformed controller packet must never teleport the mount.
		if (!Finite(Dt) || Dt <= 0 || !Finite(InPitch) || !Finite(InTurn) || !Finite(InThrottle)) return false;
		if (!Finite(F.X) || !Finite(F.Y) || !Finite(F.Z) || !Finite(F.Yaw) || !Finite(F.Pitch) || !Finite(F.Bank) || !Finite(F.Speed)) return false;
		Dt = std::min(Dt, 1.0 / 15);
		const double Pitch = Clamp(F.Pitch + (Clamp(InPitch, -1, 1) * FlightClimbMax - F.Pitch) * std::min(1.0, Dt * 3), -FlightDiveMax, FlightClimbMax);
		const double Bank = F.Bank + (Clamp(InTurn, -1, 1) * 0.8 - F.Bank) * std::min(1.0, Dt * 4);
		const double Yaw = F.Yaw + Clamp(InTurn, -1, 1) * FlightTurnRate * Dt;
		// diving gains speed, climbing loses it, the throttle trims toward its target
		const double Target = FlightCruise + Clamp(InThrottle, -1, 1) * (FlightMax - FlightCruise) * (InThrottle > 0 ? 1 : 0.6);
		const double Speed = Clamp(F.Speed + (Target - F.Speed) * std::min(1.0, Dt * 0.8) - std::sin(Pitch) * 14 * Dt, FlightMin, FlightMax);
		const double Horiz = std::cos(Pitch) * Speed;
		Out.X = F.X + std::sin(Yaw) * Horiz * Dt;
		Out.Z = F.Z + std::cos(Yaw) * Horiz * Dt;
		Out.Y = std::min(F.Y + std::sin(Pitch) * Speed * Dt, FlightCeiling);
		Out.Yaw = Yaw;
		Out.Pitch = Pitch;
		Out.Bank = Bank;
		Out.Speed = Speed;
		return true;
	}
}
