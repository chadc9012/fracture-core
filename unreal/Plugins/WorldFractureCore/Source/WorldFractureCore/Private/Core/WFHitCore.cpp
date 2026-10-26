#include "Core/WFHitCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace wf::hit
{
	namespace
	{
		bool HtHas(const std::vector<std::string>& Xs, const std::string& X) { return std::find(Xs.begin(), Xs.end(), X) != Xs.end(); }
		double HtMat(const FProgression& P, const std::string& K) { const auto It = P.Materials.find(K); return It == P.Materials.end() ? 0 : It->second; }
		bool HtWeaponSlot(const std::string& Slot) { return Slot == "primary" || Slot == "secondary" || Slot == "heavy"; }
	}

	FElementEffect ApplyElementHit(FStatuses& St, const std::string& Element, double Now, bool bBoss)
	{
		FElementEffect Out;
		Out.Status = Element == "THERMAL" ? "BURN" : Element == "CRYO" ? "CHILL" : Element == "BIO" ? "CORRODE" : Element == "ARC" ? "SHOCK" : "";
		if (Out.Status.empty()) return Out;
		if (Out.Status == "BURN") { if (bBoss) { Out.Status.clear(); return Out; } St.BurnUntil = Now + BurnSeconds; }
		else if (Out.Status == "CHILL") { if (bBoss) { Out.Status.clear(); return Out; } St.ChillUntil = Now + ChillSeconds; }
		else if (Out.Status == "CORRODE") Out.Vuln = FVuln{bBoss ? CorrodeBossMult : CorrodeMult, Now + CorrodeSeconds};
		else if (Now >= St.ShockReadyAt) { St.ShockReadyAt = Now + ShockCooldown; Out.Stun = ShockStun; }
		else Out.Status.clear(); // shock on cooldown: no effect
		return Out;
	}

	FVuln MergeVuln(const FVuln& Cur, const FVuln& Add, double Now)
	{
		if (Cur.Until <= Now) return Add;
		return {std::max(Cur.Mult, Add.Mult), std::max(Cur.Until, Add.Until)};
	}

	const FMeta* MetaFor(const std::string& WeaponId)
	{
		static const double Inf = std::numeric_limits<double>::infinity();
		static const std::vector<std::pair<std::string, FMeta>> Table{
			{"SHOTGUN", {"CLOSE", "Close quarters \xC2\xB7 one-shot inside 8 m", 8, 20, 0.2, 1.15}},
			{"AUTO", {"MID", "Rapid-fire \xC2\xB7 mid range", 28, 55, 0.7, 1.5}},
			{"PULSE", {"MID", "Burst \xC2\xB7 mid range", 38, 70, 0.65, 1.6}},
			{"SIDEARM", {"MID", "Precision \xC2\xB7 rewards headshots", 26, 48, 0.6, 2.0}},
			{"HEAVY", {"LONG", "High impact \xC2\xB7 long range", 100, 160, 0.85, 1.8}},
			{"SWORD", {"CLOSE", "Melee", Inf, Inf, 1, 1}},
			{"ROCKET", {"ANY", "Explosive", Inf, Inf, 1, 1}},
			{"CINDER", {"ANY", "Explosive \xC2\xB7 burns", Inf, Inf, 1, 1}},
			{"FROSTBITE", {"ANY", "Explosive \xC2\xB7 chills", Inf, Inf, 1, 1}},
			{"VITRIOL", {"ANY", "Explosive \xC2\xB7 corrodes", Inf, Inf, 1, 1}},
		};
		for (const auto& [Id, M] : Table) if (Id == WeaponId) return &M;
		return nullptr;
	}

	double RangeFalloff(const std::string& WeaponId, double Distance)
	{
		const FMeta* M = MetaFor(WeaponId);
		if (!M || !(Distance > M->RangeFull)) return 1;
		if (Distance >= M->RangeEnd) return M->RangeFloor;
		return 1 - (1 - M->RangeFloor) * ((Distance - M->RangeFull) / (M->RangeEnd - M->RangeFull));
	}

	bool HasAffinity(const std::string& ClassId, const std::string& WeaponId)
	{
		if (ClassId == "TITAN") return WeaponId == "AUTO" || WeaponId == "SHOTGUN";
		if (ClassId == "HUNTER") return WeaponId == "SIDEARM" || WeaponId == "PULSE";
		if (ClassId == "WARLOCK") return WeaponId == "HEAVY" || WeaponId == "ROCKET" || WeaponId == "CINDER" || WeaponId == "FROSTBITE" || WeaponId == "VITRIOL";
		return false;
	}

	double PrecisionFor(const std::string& WeaponId, const std::string& ClassId)
	{
		const FMeta* M = MetaFor(WeaponId);
		return M && M->Precision > 1 ? M->Precision + (HasAffinity(ClassId, WeaponId) ? AffinityPrecision : 0) : 1;
	}

	double HitMultiplier(const std::string& WeaponId, double Distance, bool bPrecision, const std::string& ClassId)
	{
		return RangeFalloff(WeaponId, Distance) * (bPrecision ? PrecisionFor(WeaponId, ClassId) : 1) * (HasAffinity(ClassId, WeaponId) ? AffinityDamage : 1);
	}

	double EnemyPower(double Difficulty, bool bElite, bool bBoss) { return 90 + 30 * std::max(0.0, Difficulty) + (bBoss ? 20 : bElite ? 10 : 0); }

	double OperatorPower(const std::vector<double>& GearPowers, double Level)
	{
		double Sum = 0;
		for (double G : GearPowers) Sum += G;
		const double Avg = GearPowers.empty() ? 90 : Sum / static_cast<double>(GearPowers.size());
		return Avg + 4 * (std::min(50.0, std::max(1.0, std::floor(Level))) - 1);
	}

	double PowerScale(double Delta)
	{
		if (!std::isfinite(Delta)) return 1;
		if (Delta >= 0) return 1 + 0.4 * std::min(1.0, Delta / 100);
		return std::max(0.85, 1 + Delta / 500);
	}

	std::vector<double> EquippedGearPowers(const FProgression& P)
	{
		// Scene.tsx: inventory order, every item worn in its own slot, the vehicle slot excluded
		std::vector<double> Out;
		for (const FGearItem& I : P.Inventory)
		{
			if (I.Slot == "vehicle") continue;
			const auto It = P.EquippedGear.find(I.Slot);
			if (It != P.EquippedGear.end() && It->second == I.Id) Out.push_back(I.Power);
		}
		return Out;
	}

	std::string HitPart(double HitY, double FeetY, double Height)
	{
		const double F = (HitY - FeetY) / std::max(0.1, Height);
		return F >= 0.82 ? "HEAD" : F < 0.45 ? "LEGS" : "TORSO";
	}

	std::optional<FReaction> ReactTo(const std::optional<FReaction>& Prev, double Damage, double MaxHp, bool bElite, bool bBoss, double Now, double Dx, double Dz, const std::string& Part)
	{
		if (!(Damage > 0) || !(MaxHp > 0) || !std::isfinite(Now)) return Prev;
		const double Share = std::min(1.0, Damage / MaxHp);
		const bool bRecentStagger = Prev && Prev->Kind == "stagger" && Now < Prev->Until + 1.2;
		const std::string Kind = !bBoss && !bRecentStagger && Share >= (bElite ? 0.34 : 0.22) ? "stagger" : "flinch";
		if (Kind == "flinch" && Prev && Prev->Kind == "stagger" && Now < Prev->Until) return Prev; // a flinch never cuts a stagger short
		const double Lh = js::Hypot(Dx, Dz), L = Lh != 0 ? Lh : 1;
		FReaction R;
		R.Kind = Kind; R.Start = Now; R.Until = Now + (Kind == "stagger" ? 0.45 : 0.16) * (bBoss ? 0.6 : 1); R.Dx = Dx / L; R.Dz = Dz / L; R.K = Share;
		R.Part = Part.empty() ? "TORSO" : Part;
		return R;
	}

	const FAbilityRule* AbilityRule(const std::string& Ability)
	{
		static const std::vector<FAbilityRule> Table{
			{"EMBER_BRAND", "Ember Brand", "Every 5th hit detonates a thermal burst around the target.", 5, 6, 4, 0.8, 1, 0},
			{"RIME_SHATTER", "Rime Shatter", "+30% damage to chilled targets; every 6th hit shatters frost onto neighbours.", 6, 7, 3, 0.5, 1.3, 0},
			{"ROT_BLOOM", "Rot Bloom", "Every 4th hit blooms corrosive spores that eat armour on nearby machines.", 4, 6, 3, 0.4, 1, 0},
			{"STORM_ARC", "Storm Arc", "Every 4th hit chains lightning to up to 2 nearby machines.", 4, 10, 2, 0.5, 1, 0},
			{"SUN_FLARE", "Sun Flare", "Every 6th hit flares: nearby machines are blinded and stunned briefly.", 6, 8, 5, 0.25, 1, 0.9},
		};
		for (const FAbilityRule& R : Table) if (R.Id == Ability) return &R;
		return nullptr;
	}

	const std::vector<FRuin>& Ruins()
	{
		static const std::vector<FRuin> Table{
			{"cinderglass-vault", "Cinderglass Vault", "ember", "THERMAL", "EMBER_BRAND", "thermalShards", "A vitrified vault still humming with heat.", -616.7490532406422, -356.20756842293196},
			{"rimeheart-spire", "Rimeheart Spire", "frostspire", "CRYO", "RIME_SHATTER", "cryoCrystal", "A broken spire with a frozen core.", -88.94263606949465, -735.2652593197479},
			{"drowned-orchard", "Drowned Orchard", "swamps", "BIO", "ROT_BLOOM", "bioCatalyst", "Stone arches strangled by glowing spores.", 786.8358760433653, 282.26346280718207},
			{"stormwrecked-array", "Stormwrecked Array", "wastelands", "ARC", "STORM_ARC", "microCircuits", "A toppled relay array that still crackles.", -401.6886745368989, 346.8294042078952},
			{"sunken-heliostat", "Sunken Heliostat", "solara", "THERMAL", "SUN_FLARE", "thermalShards", "A mirror ring that once fed the sun.", 305.2755829751895, 473.94751844100415},
		};
		return Table;
	}

	const FRuin* RuinById(const std::string& Id)
	{
		for (const FRuin& R : Ruins()) if (R.Id == Id) return &R;
		return nullptr;
	}

	bool IsEvolved(const FProgression& P, const std::string& RuinId) { return HtHas(P.EarnedRewards, ClaimKey(RuinId)); }
	bool IsDiscovered(const FProgression& P, const std::string& RuinId) { return HtHas(P.EarnedRewards, SeenKey(RuinId)) || IsEvolved(P, RuinId); }

	FProgression DiscoverNearby(const FProgression& P, double X, double Z)
	{
		FProgression Out = P;
		for (const FRuin& R : Ruins())
			if (!IsDiscovered(P, R.Id) && js::Hypot(R.X - X, R.Z - Z) <= RuinDiscoverRadius) Out.EarnedRewards.push_back(SeenKey(R.Id));
		return Out;
	}

	FEvolveCheck CanEvolve(const FProgression& P, const FRuin& Ruin, const std::string& WeaponId)
	{
		if (IsEvolved(P, Ruin.Id)) return {false, "This ruin has already given its power"};
		const FGearItem* Item = nullptr;
		for (const FGearItem& G : P.Inventory) if (G.Id == WeaponId) { Item = &G; break; }
		if (!Item || !HtWeaponSlot(Item->Slot)) return {false, "Pick a weapon"};
		if (Item->Evolution) return {false, "Already evolved"};
		if (Item->Level < EvolveMinLevel) return {false, "Weapon must be level " + js::NumberToString(EvolveMinLevel)};
		if (HtMat(P, "forgeCatalyst") < EvolveCatalysts) return {false, "Needs " + js::NumberToString(EvolveCatalysts) + " forge catalysts"};
		if (HtMat(P, Ruin.Material) < EvolveElementAmount) return {false, "Needs " + js::NumberToString(EvolveElementAmount) + " " + Ruin.Material};
		return {true, ""};
	}

	FProgression EvolveWeapon(const FProgression& P, const std::string& RuinId, const std::string& WeaponId)
	{
		const FRuin* Ruin = RuinById(RuinId);
		if (!Ruin || !CanEvolve(P, *Ruin, WeaponId).bOk) return P;
		FProgression Out = P;
		Out.Materials["forgeCatalyst"] = HtMat(P, "forgeCatalyst") - EvolveCatalysts;
		Out.Materials[Ruin->Material] = HtMat(P, Ruin->Material) - EvolveElementAmount;
		Out.EarnedRewards.push_back(ClaimKey(Ruin->Id));
		for (FGearItem& G : Out.Inventory)
			if (G.Id == WeaponId) { G.Power += EvolvePowerBonus; G.Element = Ruin->Element; G.Evolution = FGearItem::FEvolution{Ruin->Id, Ruin->Ability}; }
		return Out;
	}

	bool RegisterEvolutionHit(FCharge& C, const std::string& Ability)
	{
		const FAbilityRule* R = AbilityRule(Ability);
		if (!R || R->EveryHits <= 0) return false;
		const double Hits = C.Hits + 1;
		if (Hits >= R->EveryHits) { C.Hits = 0; return true; }
		C.Hits = Hits;
		return false;
	}

	double EvolutionDamageMult(const std::string& Ability, bool bChilled)
	{
		const FAbilityRule* R = AbilityRule(Ability);
		return bChilled && R ? R->ChilledBonus : 1;
	}

	std::vector<size_t> BurstTargets(const FPoint& Origin, const std::vector<FPoint>& Others, const std::string& Ability)
	{
		const FAbilityRule* R = AbilityRule(Ability);
		std::vector<std::pair<size_t, double>> In;
		if (!R) return {};
		for (size_t I = 0; I < Others.size(); ++I)
		{
			const double D = js::Hypot(Others[I].X - Origin.X, Others[I].Z - Origin.Z);
			if (D > 0.01 && D <= R->Radius) In.push_back({I, D});
		}
		std::stable_sort(In.begin(), In.end(), [](const auto& A, const auto& B) { return A.second < B.second; });
		std::vector<size_t> Out;
		for (size_t I = 0; I < In.size() && static_cast<int>(I) < R->MaxTargets; ++I) Out.push_back(In[I].first);
		return Out;
	}

	std::string RuinElementOf(const std::string& Ability)
	{
		for (const FRuin& R : Ruins()) if (R.Ability == Ability) return R.Element;
		return "ARC";
	}

	bool RegisterNullHit(FNullCharge& S, double Now, bool bTimed, double EventId)
	{
		if (EventId == S.LastEventId) return false; // one activation per attack event
		S.LastEventId = EventId;
		if (S.Charge > 0 && Now - S.LastTimedAt > NullDecay) S.Charge = 0;
		if (S.Charge >= NullThreshold && Now >= S.CooldownUntil) { S.Charge = 0; S.CooldownUntil = Now + NullCooldown; return true; }
		if (bTimed && Now >= S.CooldownUntil) { S.Charge = std::min(NullThreshold, S.Charge + 1); S.LastTimedAt = Now; }
		return false;
	}

	bool RegisterMawHit(FMaw& S, double Now, double EventId)
	{
		if (EventId == S.LastEventId) return false;
		S.LastEventId = EventId;
		if (S.Hunger > 0 && Now - S.LastHitAt > MawDecay) S.Hunger = 0;
		if (S.Hunger >= MawThreshold && Now >= S.CooldownUntil) { S.Hunger = 0; S.CooldownUntil = Now + MawCooldown; return true; }
		if (Now >= S.CooldownUntil) { S.Hunger = std::min(MawThreshold, S.Hunger + 1); S.LastHitAt = Now; }
		return false;
	}

	std::optional<FMawEffect> MawEffect(double Dx, double Dz, double HitDamage)
	{
		const double D = js::Hypot(Dx, Dz);
		if (D > MawRadius) return std::nullopt;
		const double N = D < 1e-6 ? 0 : 1 / D;
		return FMawEffect{-Dx * N * MawPull + 0, -Dz * N * MawPull + 0, HitDamage * MawSplash};
	}
}
