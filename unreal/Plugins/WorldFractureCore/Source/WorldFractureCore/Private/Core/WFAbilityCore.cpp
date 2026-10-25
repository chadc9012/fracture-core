#include "Core/WFAbilityCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <set>

namespace wf::ability
{
	const char* const Slots[3] = {"PRIMARY", "TACTICAL", "ULTIMATE"};

	namespace
	{
		FEffect AbEffect(const char* Kind, double Value, std::optional<double> Duration, std::optional<double> Radius, std::vector<std::string> Tags)
		{
			FEffect E;
			E.Kind = Kind; E.Value = Value; E.Duration = Duration; E.Radius = Radius; E.Tags = std::move(Tags);
			return E;
		}
		FConfig AbConfig(const char* Id, const char* Cls, const char* Slot, const char* Input, double Cd, double Cost, double Cast, double Rec, FEffect E)
		{
			FConfig C;
			C.Id = Id; C.ClassId = Cls; C.Slot = Slot; C.Input = Input; C.Cooldown = Cd; C.ResourceCost = Cost; C.CastTime = Cast; C.Recovery = Rec; C.Effects = {std::move(E)};
			return C;
		}
		constexpr std::nullopt_t AbNone = std::nullopt;

		std::string AbSlug(const std::string& Name)
		{
			std::string Out;
			for (char C : Name) Out += C == ' ' ? '-' : static_cast<char>(std::tolower(static_cast<unsigned char>(C)));
			return Out;
		}
		FNode AbNode(const char* Id, const char* Name, const char* Cls, const char* Slot, const char* Stream, double Cost, const char* B1, const char* B2, const char* B3)
		{
			FNode N;
			N.Id = Id; N.Name = Name; N.ClassId = Cls; N.Slot = Slot; N.Stream = Stream; N.Cost = Cost;
			N.BranchNames = {B1, B2, B3};
			for (const std::string& B : N.BranchNames) N.Branches.push_back(AbSlug(B));
			return N;
		}
		std::string AbDashesToSpaces(std::string S) { std::replace(S.begin(), S.end(), '-', ' '); return S; }
		const std::string* AbFind(const std::map<std::string, std::string>& M, const std::string& K) { const auto It = M.find(K); return It == M.end() ? nullptr : &It->second; }
		std::string AbBranchOf(const std::map<std::string, std::string>& M, const std::string& K) { const std::string* V = AbFind(M, K); return V ? *V : std::string(); }
		std::vector<std::string> AbSlotIds(const FBuild& B)
		{
			std::vector<std::string> Out;
			for (const char* S : Slots) Out.push_back(AbBranchOf(B.Slots, S));
			return Out;
		}
		std::map<std::string, FRuntime> AbFreshRuntime() { return {{"PRIMARY", {}}, {"TACTICAL", {}}, {"ULTIMATE", {}}}; }
	}

	bool FEffect::Has(const std::string& Tag) const { return std::find(Tags.begin(), Tags.end(), Tag) != Tags.end(); }

	const std::vector<FConfig>& Configs()
	{
		static const std::vector<FConfig> C = {
			AbConfig("siege-mode", "TITAN", "PRIMARY", "Q", 25, 25, 0.2, 0.3, AbEffect("SIEGE", 1.3, 8, AbNone, {"stability", "firepower"})),
			AbConfig("kinetic-slam", "TITAN", "TACTICAL", "E", 18, 20, 0.25, 0.45, AbEffect("DAMAGE", 60, AbNone, 7, {"shockwave", "knockback", "interrupt"})),
			AbConfig("bastion-shield", "TITAN", "ULTIMATE", "R", 24, 40, 0.4, 0.5, AbEffect("DOME", 100, 10, 5, {})),
			AbConfig("phase-veil", "HUNTER", "PRIMARY", "Q", 18, 15, 0, 0.15, AbEffect("VEIL", 0.15, 6, AbNone, {"stealth"})),
			AbConfig("rift-dash", "HUNTER", "TACTICAL", "E", 10, 12, 0, 0.12, AbEffect("DASH", 11, 0.28, AbNone, {"invulnerable", "teleport"})),
			AbConfig("shadow-strike", "HUNTER", "ULTIMATE", "R", 22, 35, 0.15, 0.4, AbEffect("STRIKE", 4, AbNone, 16, {"close-range", "veil-bonus"})),
			AbConfig("recon-swarm", "WARLOCK", "PRIMARY", "Q", 20, 18, 0.15, 0.25, AbEffect("MARK", 1.25, 8, 30, {"reveal", "swarm"})),
			AbConfig("disruption-pulse", "WARLOCK", "TACTICAL", "E", 18, 24, 0.3, 0.4, AbEffect("SILENCE", 1, 5, 14, {"emp", "disable-tech"})),
			AbConfig("rift-turret", "WARLOCK", "ULTIMATE", "R", 30, 45, 0.4, 0.5, AbEffect("TURRET", 1, 20, 34, {"deployable"})),
			AbConfig("ember-bulwark", "TITAN", "TACTICAL", "E", 40, 30, 0.3, 0.4, AbEffect("DOME", 100, 8, 4.5, {"dragonfire", "barrier"})),
			AbConfig("wyrm-dash", "HUNTER", "TACTICAL", "E", 30, 20, 0, 0.2, AbEffect("DASH", 13, 0.3, AbNone, {"invulnerable", "dragonfire"})),
			AbConfig("ash-nova", "WARLOCK", "TACTICAL", "E", 40, 28, 0.25, 0.4, AbEffect("DAMAGE", 60, AbNone, 8, {"ash", "weaken"})),
		};
		return C;
	}

	const FConfig* ConfigById(const std::string& Id)
	{
		for (const FConfig& C : Configs()) if (C.Id == Id) return &C;
		return nullptr;
	}

	const std::vector<FNode>& Nodes()
	{
		static const std::vector<FNode> N = {
			AbNode("siege-mode", "Siege Mode", "TITAN", "PRIMARY", "COMBAT", 0, "Hold Fast", "Suppressor", "Shared Stance"),
			AbNode("kinetic-slam", "Kinetic Slam", "TITAN", "TACTICAL", "COMBAT", 12, "Fault Line", "Aftershock", "Safeguard"),
			AbNode("bastion-shield", "Bastion Shield", "TITAN", "ULTIMATE", "SYSTEMS", 28, "Citadel", "Mirror Plate", "Sanctuary"),
			AbNode("phase-veil", "Phase Veil", "HUNTER", "PRIMARY", "EXPLORATION", 0, "Deep Cover", "Afterglow", "Shared Veil"),
			AbNode("rift-dash", "Rift Dash", "HUNTER", "TACTICAL", "EXPLORATION", 10, "Kinetic Edge", "Ghost Step", "Slipstream"),
			AbNode("shadow-strike", "Shadow Strike", "HUNTER", "ULTIMATE", "COMBAT", 30, "Killing Edge", "Echo Blade", "Zero Hour"),
			AbNode("recon-swarm", "Recon Swarm", "WARLOCK", "PRIMARY", "SYSTEMS", 0, "Deep Scan", "Hunter Swarm", "Relay"),
			AbNode("disruption-pulse", "Disruption Pulse", "WARLOCK", "TACTICAL", "SYSTEMS", 14, "Blackout", "Null Zone", "Feedback"),
			AbNode("rift-turret", "Rift Turret", "WARLOCK", "ULTIMATE", "SYSTEMS", 32, "Overclock", "Twin Mount", "Shared Clock"),
			AbNode("ember-bulwark", "Ember Bulwark", "TITAN", "TACTICAL", "COMBAT", 999, "Searing Wall", "Long Burn", "Shared Hearth"),
			AbNode("wyrm-dash", "Wyrm Dash", "HUNTER", "TACTICAL", "COMBAT", 999, "Wildfire Trail", "Long Glide", "Shared Wings"),
			AbNode("ash-nova", "Ash Nova", "WARLOCK", "TACTICAL", "SYSTEMS", 999, "Heavy Ash", "Wide Nova", "Shared Embers"),
		};
		return N;
	}

	const FNode& NodeById(const std::string& Id)
	{
		for (const FNode& N : Nodes()) if (N.Id == Id) return N;
		return Nodes().front();
	}

	FBuild DefaultBuild() { return {"HYBRID", {{"PRIMARY", "siege-mode"}, {"TACTICAL", "rift-dash"}, {"ULTIMATE", "rift-turret"}}}; }

	FBuild ClassBuild(const std::string& ClassId)
	{
		if (ClassId == "TITAN") return {"SOLO", {{"PRIMARY", "siege-mode"}, {"TACTICAL", "kinetic-slam"}, {"ULTIMATE", "bastion-shield"}}};
		if (ClassId == "HUNTER") return {"SOLO", {{"PRIMARY", "phase-veil"}, {"TACTICAL", "rift-dash"}, {"ULTIMATE", "shadow-strike"}}};
		return {"SOLO", {{"PRIMARY", "recon-swarm"}, {"TACTICAL", "disruption-pulse"}, {"ULTIMATE", "rift-turret"}}};
	}

	namespace
	{
		const std::map<std::string, std::string>& AbLegacy()
		{
			static const std::map<std::string, std::string> M = {
				{"fracture-shield", "siege-mode"}, {"ground-breaker", "kinetic-slam"}, {"reality-bulwark", "bastion-shield"},
				{"phase-dash", "phase-veil"}, {"mark-target", "rift-dash"}, {"time-split", "shadow-strike"},
				{"code-pulse", "recon-swarm"}, {"reality-field", "disruption-pulse"}, {"system-override", "rift-turret"},
			};
			return M;
		}
	}

	std::string MigrateAbilityId(const std::string& Id) { const std::string* V = AbFind(AbLegacy(), Id); return V ? *V : Id; }

	FBuild MigrateBuild(const FBuild& B)
	{
		FBuild Out = B;
		for (const char* S : Slots) Out.Slots[S] = MigrateAbilityId(AbBranchOf(B.Slots, S));
		return Out;
	}

	std::map<std::string, std::string> MigrateBranches(const std::map<std::string, std::string>& Branches)
	{
		std::map<std::string, std::string> Out;
		for (const auto& [Id, Pick] : Branches) if (!AbLegacy().count(Id)) Out[Id] = Pick;
		return Out;
	}

	FSynergy ResolveSynergy(const std::vector<std::string>& AbilityIds)
	{
		std::set<std::string> Classes;
		for (const std::string& Id : AbilityIds) if (const FConfig* C = ConfigById(Id)) Classes.insert(C->ClassId);
		FSynergy S;
		S.DamageMultiplier = Classes.size() == 3 ? 1.18 : Classes.size() == 2 ? 1.12 : 1.08;
		S.CooldownMultiplier = Classes.count("WARLOCK") ? 0.9 : 1;
		S.StabilityBonus = Classes.count("TITAN") ? 12 : 0;
		S.MomentumBonus = Classes.count("HUNTER") ? 0.15 : 0;
		return S;
	}

	std::string BranchTier(const std::string& AbilityId, const std::string& BranchId)
	{
		if (BranchId.empty()) return "";
		const FNode& N = NodeById(AbilityId);
		static const char* const Tiers[3] = {"POWER", "CONTROL", "UTILITY"};
		for (size_t I = 0; I < N.Branches.size() && I < 3; ++I) if (N.Branches[I] == BranchId) return Tiers[I];
		return "";
	}
	double PowerMult(const std::string& Tier) { return Tier == "POWER" ? PowerMultValue : 1; }
	double DurationMult(const std::string& Tier) { return Tier == "CONTROL" ? ControlDurationMult : 1; }
	double CostMult(const std::string& Tier) { return Tier == "UTILITY" ? UtilityCostMult : 1; }

	FConfig ScaleConfig(const FConfig& C, const std::string& BranchId)
	{
		const std::string Tier = BranchTier(C.Id, BranchId);
		if (Tier.empty() || Tier == "UTILITY") return C;
		FConfig Out = C;
		for (FEffect& E : Out.Effects)
		{
			if (Tier == "POWER")
			{
				const bool bMult = E.Kind == "MARK" || E.Kind == "SIEGE" || E.Kind == "VEIL";
				const double V = bMult ? 1 + (E.Value - 1) * PowerMultValue : E.Value * PowerMultValue;
				if (E.Kind != "VEIL") E.Value = V;
			}
			else if (E.Duration && *E.Duration != 0) E.Duration = *E.Duration * ControlDurationMult;
		}
		return Out;
	}

	std::string BranchPosture(const std::map<std::string, std::string>& SlotIds, const std::map<std::string, std::string>& Branches)
	{
		std::array<int, 3> Counts{0, 0, 0};
		static const char* const Tiers[3] = {"POWER", "CONTROL", "UTILITY"};
		for (const auto& [Slot, Id] : SlotIds)
		{
			const std::string T = BranchTier(Id, AbBranchOf(Branches, Id));
			for (int I = 0; I < 3; ++I) if (T == Tiers[I]) ++Counts[I];
		}
		int Best = 0;
		for (int I = 1; I < 3; ++I) if (Counts[I] > Counts[Best]) Best = I; // a stable sort keeps POWER, CONTROL, UTILITY on ties
		return Counts[Best] >= 2 ? Tiers[Best] : "NONE";
	}

	std::string PostureThreat(const std::string& Posture)
	{
		if (Posture == "POWER") return "Ranged units keeping a long standoff from your burst damage";
		if (Posture == "CONTROL") return "Squads spreading out to avoid your lingering fields";
		if (Posture == "UTILITY") return "Flankers committing early against your sustained rotation";
		return "";
	}

	std::string BranchLabel(const std::string& Tier)
	{
		if (Tier == "POWER") return "+18% power";
		if (Tier == "CONTROL") return "+25% duration";
		return "−15% energy cost";
	}

	std::optional<FVerbDef> VerbForActivation(const std::string& SubclassId, const std::string& Slot)
	{
		static const std::map<std::string, FVerbDef> V = {
			{"SHIELD_TITAN", {"ULTIMATE", "WEAKEN", "enemy", 1.35, 6, 10}},
			{"BERSERKER_TITAN", {"TACTICAL", "RAGE", "self", 1.4, 5, 0}},
			{"BULWARK_TITAN", {"PRIMARY", "OVERSHIELD", "self", 0.5, 6, 0}},
			{"SHADOW_HUNTER", {"PRIMARY", "WEAKEN", "enemy", 1.5, 3, 6}},
			{"TRACKER_HUNTER", {"TACTICAL", "MARKED", "enemy", 1.3, 8, 24}},
			{"FRACTURE_RUNNER", {"ULTIMATE", "HASTE", "self", 2, 4, 0}},
			{"CODE_WARLOCK", {"PRIMARY", "SUPPRESS", "enemy", 3, 4, 12}},
			{"VOID_WARLOCK", {"TACTICAL", "VOLATILE", "enemy", 4, 8, 7}},
			{"ORACLE_WARLOCK", {"ULTIMATE", "WEAKEN", "enemy", 1.3, 10, 14}},
		};
		const auto It = V.find(SubclassId);
		if (It == V.end() || It->second.Slot != Slot) return std::nullopt;
		return It->second;
	}

	std::string VerbLabel(const std::string& Verb)
	{
		static const std::map<std::string, std::string> L = {{"WEAKEN", "Weaken"}, {"MARKED", "Marked"}, {"VOLATILE", "Volatile"}, {"SUPPRESS", "Suppressed"}, {"RAGE", "Rage"}, {"OVERSHIELD", "Overshield"}, {"HASTE", "Haste"}};
		const auto It = L.find(Verb);
		return It == L.end() ? Verb : It->second;
	}

	std::vector<std::string> SubclassesOf(const std::string& ClassId)
	{
		if (ClassId == "TITAN") return {"SHIELD_TITAN", "BERSERKER_TITAN", "BULWARK_TITAN"};
		if (ClassId == "HUNTER") return {"SHADOW_HUNTER", "TRACKER_HUNTER", "FRACTURE_RUNNER"};
		if (ClassId == "WARLOCK") return {"CODE_WARLOCK", "VOID_WARLOCK", "ORACLE_WARLOCK"};
		return {};
	}

	FLiveBuild CreateLiveBuild(const FBuild& Equipped, const std::map<std::string, std::string>& Branches)
	{
		FLiveBuild L;
		L.Equipped = MigrateBuild(Equipped);
		L.Branches = Branches;
		L.Runtime = AbFreshRuntime();
		return L;
	}

	FLiveBuild RebindLiveBuild(const FLiveBuild& Live, const FBuild& EquippedIn, const std::map<std::string, std::string>& Branches)
	{
		const FBuild Equipped = MigrateBuild(EquippedIn);
		bool bChanged = AbSlotIds(Equipped) != AbSlotIds(Live.Equipped);
		for (const auto& [Id, B] : Branches) if (!bChanged && AbBranchOf(Live.Branches, Id) != B) bChanged = true;
		for (const auto& [Id, B] : Live.Branches) if (!bChanged && !Branches.count(Id)) bChanged = true;
		if (!bChanged) return Live;
		const FSynergy Syn = ResolveSynergy(AbSlotIds(Equipped));
		FLiveBuild L = Live;
		L.Equipped = Equipped;
		L.Branches = Branches;
		L.Runtime = AbFreshRuntime();
		L.DamageMultiplier = Syn.DamageMultiplier;
		L.ShieldReflect = AbBranchOf(Branches, "bastion-shield") == "mirror-plate" ? 0.4 : 0;
		const std::string Posture = PostureThreat(BranchPosture(Equipped.Slots, Branches));
		const std::string Primary = AbBranchOf(Equipped.Slots, "PRIMARY");
		L.Threat = L.ShieldReflect != 0 ? "Ranged units holding fire · melee pressure incoming" : !Posture.empty() ? Posture
			: Primary == "phase-veil" ? "Trackers predicting movement lanes" : Primary == "recon-swarm" ? "Defenders guarding system nodes" : "Hostiles closing on shield position";
		L.Effect = "Loadout synchronized · combat rules updated";
		L.EffectTime = 3;
		return L;
	}

	void TickLiveBuild(FLiveBuild& L, double Dt, double Recharge)
	{
		const bool bHaste = L.VerbKind == "HASTE" && L.VerbTime > 0;
		const double Rate = (bHaste ? L.VerbMagnitude : 1) * (1 + std::max(0.0, Recharge));
		for (auto& [Slot, R] : L.Runtime)
		{
			R.Cooldown = std::max(0.0, R.Cooldown - Dt * Rate);
			R.ActiveFor = std::max(0.0, R.ActiveFor - Dt * Rate);
			R.State = R.ActiveFor > 0 ? "ACTIVE" : R.Cooldown > 0 ? "COOLDOWN" : "READY";
		}
		L.Energy = std::min(100.0, L.Energy + Dt * 9 * Rate);
		L.EffectTime = std::max(0.0, L.EffectTime - Dt);
		L.DashTime = std::max(0.0, L.DashTime - Dt);
		L.HackTime = std::max(0.0, L.HackTime - Dt);
		L.FieldTime = std::max(0.0, L.FieldTime - Dt);
		L.SiegeTime = std::max(0.0, L.SiegeTime - Dt);
		L.VeilTime = std::max(0.0, L.VeilTime - Dt);
		L.Momentum = std::max(0.0, L.Momentum - Dt * 0.05);
		L.VerbTime = std::max(0.0, L.VerbTime - Dt);
		if (L.VerbTime == 0 && !L.VerbKind.empty()) { L.VerbKind.clear(); L.VerbMagnitude = 1; }
	}

	const FConfig* BaseConfig(const FLiveBuild& L, const std::string& Slot) { return ConfigById(AbBranchOf(L.Equipped.Slots, Slot)); }

	double AbilityCost(const FLiveBuild& L, const std::string& Slot)
	{
		const FConfig* B = BaseConfig(L, Slot);
		return B ? B->ResourceCost * CostMult(BranchTier(B->Id, AbBranchOf(L.Branches, B->Id))) : 0;
	}

	std::optional<FConfig> ActivateLiveAbility(FLiveBuild& L, const std::string& Slot, const std::string& Environment, const std::string& SubclassId)
	{
		const FConfig* Base = BaseConfig(L, Slot);
		const auto Rt = L.Runtime.find(Slot);
		if (!Base || Rt == L.Runtime.end() || Rt->second.Cooldown > 0) return std::nullopt;
		const std::string Branch = AbBranchOf(L.Branches, Base->Id);
		const std::string Tier = BranchTier(Base->Id, Branch);
		const FConfig Config = ScaleConfig(*Base, Branch);
		const double Cost = Config.ResourceCost * CostMult(Tier);
		if (L.Energy < Cost) return std::nullopt;
		const FSynergy Syn = ResolveSynergy(AbSlotIds(L.Equipped));
		L.Energy -= Cost;
		Rt->second = {"ACTIVE", Config.Cooldown * Syn.CooldownMultiplier, std::max(0.25, Config.CastTime + Config.Recovery)};
		const FEffect* First = Config.Effects.empty() ? nullptr : &Config.Effects[0];
		const auto DurOr = [First](double D) { return First && First->Duration ? *First->Duration : D; };
		if (Config.Id == "rift-dash") { L.DashTime = 0.45 * DurationMult(Tier); L.Momentum = std::min(1.0, L.Momentum + 0.4 * PowerMult(Tier)); }
		if (Config.Id == "disruption-pulse") L.HackTime = DurOr(5);
		if (Config.Id == "siege-mode") { L.SiegeTime = DurOr(8); L.SiegeBoost = PowerMult(Tier); }
		if (Config.Id == "phase-veil") L.VeilTime = DurOr(6);
		if (Config.Id == "shadow-strike") L.StrikeBoost = PowerMult(Tier);
		if (Config.Id == "bastion-shield") L.ShieldReflect = Branch == "mirror-plate" ? 0.4 : 0;
		const std::optional<FVerbDef> Verb = SubclassId.empty() ? std::nullopt : VerbForActivation(SubclassId, Slot);
		if (Verb)
		{
			const bool bBonus = Verb->Verb == "WEAKEN" || Verb->Verb == "MARKED" || Verb->Verb == "RAGE" || Verb->Verb == "HASTE";
			const double Magnitude = bBonus ? 1 + (Verb->Magnitude - 1) * PowerMult(Tier) : Verb->Verb == "OVERSHIELD" ? std::min(0.9, Verb->Magnitude * PowerMult(Tier)) : Verb->Magnitude * PowerMult(Tier);
			const double Duration = Verb->Duration * DurationMult(Tier);
			if (Verb->Target == "self") { L.VerbKind = Verb->Verb; L.VerbTime = Duration; L.VerbMagnitude = Magnitude; }
			else L.PendingVerb = FPendingVerb{Verb->Verb, Magnitude, Duration, Verb->Radius};
		}
		const std::string Note = Tier.empty() ? "" : " · " + BranchLabel(Tier);
		const std::string What = Verb ? VerbLabel(Verb->Verb) + " applied" : Environment == "fracture" && Config.ClassId == "WARLOCK" ? "fracture amplified" : !Branch.empty() ? AbDashesToSpaces(Branch) + " active" : "effect active";
		L.Effect = AbDashesToSpaces(Config.Id) + " · " + What + Note;
		L.EffectTime = 3;
		return Config;
	}

	std::vector<FHudRow> AbilityHud(const FLiveBuild& L)
	{
		static const char* const Keys[3] = {"Q", "E", "R"};
		std::vector<FHudRow> Out;
		for (int I = 0; I < 3; ++I)
		{
			const std::string Slot = Slots[I];
			const std::string Id = AbBranchOf(L.Equipped.Slots, Slot);
			const FConfig* Cfg = ConfigById(Id);
			const auto Rt = L.Runtime.find(Slot);
			const double Cd = Rt == L.Runtime.end() ? 0 : Rt->second.Cooldown, Active = Rt == L.Runtime.end() ? 0 : Rt->second.ActiveFor;
			const double Cost = AbilityCost(L, Slot);
			const bool bCooling = Cd > 0;
			FHudRow R;
			R.Slot = Slot; R.Key = Keys[I]; R.Id = Id; R.Name = NodeById(Id).Name;
			R.State = Active > 0 ? "ACTIVE" : bCooling ? "COOLDOWN" : L.Energy < Cost ? "NO_ENERGY" : "READY";
			R.bReady = !bCooling && L.Energy >= Cost;
			R.Cooldown = js::Round(Cd * 10) / 10;
			R.CooldownMax = Cfg ? Cfg->Cooldown : 0;
			R.Cost = js::Round(Cost);
			Out.push_back(R);
		}
		return Out;
	}

	double VeilSightMult(double VeilTime) { return VeilTime > 0 ? VeilSightMultValue : 1; }
	double SiegeDamageMult(double SiegeTime) { return SiegeTime > 0 ? SiegeDamageMultValue : 1; }
	double SiegeMoveMult(double SiegeTime) { return SiegeTime > 0 ? SiegeMoveMultValue : 1; }
	double StrikeDamage(double VeilTime) { return ShadowStrikeBase * (VeilTime > 0 ? 2 : 1); }

	FPoint2 StrikeLanding(double Px, double Pz, double Ex, double Ez, double Behind)
	{
		const double Dx = Ex - Px, Dz = Ez - Pz;
		double D = std::hypot(Dx, Dz);
		if (D == 0) D = 1;
		return {Ex + (Dx / D) * Behind, Ez + (Dz / D) * Behind};
	}
	FPoint2 KnockbackFrom(double Px, double Pz, double Ex, double Ez, double Dist) { return StrikeLanding(Px, Pz, Ex, Ez, Dist); }

	std::vector<FRiftTurret> DeployRiftTurret(const std::vector<FRiftTurret>& List, double X, double Z, double Now, double Duration)
	{
		std::vector<FRiftTurret> Next;
		for (const FRiftTurret& T : List) if (T.Until > Now) Next.push_back(T);
		Next.push_back({X, Z, Now + Duration, 0.4, 0, 0});
		if (Next.size() > static_cast<size_t>(MaxRiftTurrets)) Next.erase(Next.begin(), Next.end() - MaxRiftTurrets);
		return Next;
	}

	int StepRiftTurret(FRiftTurret& T, const std::vector<FMachine>& Targets, double Dt)
	{
		T.Flash = std::max(0.0, T.Flash - Dt * 4);
		T.Cool -= Dt;
		int Best = -1;
		double BestD = RiftTurretRange;
		for (int I = 0; I < static_cast<int>(Targets.size()); ++I)
		{
			const FMachine& M = Targets[I];
			if (!M.bAlive) continue;
			const double D = std::hypot(M.X - T.X, M.Z - T.Z);
			if (D < BestD) { BestD = D; Best = I; }
		}
		if (Best < 0) return -1;
		T.Rot = std::atan2(Targets[Best].X - T.X, Targets[Best].Z - T.Z);
		if (T.Cool > 0) return -1;
		T.Cool = RiftTurretInterval;
		T.Flash = 1;
		return Best;
	}

	// ---- casting ----

	namespace
	{
		FEvent AbRecord(IWorld& W, FEventLog& Log, FEvent E)
		{
			E.Id = Log.NextId++;
			E.At = W.Now();
			Log.Events.push_back(E);
			if (Log.Events.size() > static_cast<size_t>(MaxAbilityEvents)) Log.Events.erase(Log.Events.begin(), Log.Events.end() - MaxAbilityEvents);
			return E;
		}
		FEvent AbEvent(const char* Kind, const std::string& AbilityId, const std::string& Slot, const FPose& P, const std::string& Reason)
		{
			FEvent E;
			E.Kind = Kind; E.AbilityId = AbilityId; E.Slot = Slot; E.Effect = "NONE"; E.X = P.X; E.Z = P.Z; E.Reason = Reason;
			return E;
		}
		std::string AbRejectText(const std::string& Reason, const std::string& Name)
		{
			if (Reason == "COOLDOWN") return Name + " · recharging";
			if (Reason == "ENERGY") return Name + " · not enough energy";
			if (Reason == "NO_TARGET") return "Shadow Strike · no target in reach";
			if (Reason == "NO_ABILITY") return "No ability equipped";
			return Name + " · unavailable in a vehicle";
		}
		int AbApplyPendingVerb(IWorld& W, std::vector<FMachine>& Ms, FLiveBuild& L, const FPose& P)
		{
			if (!L.PendingVerb) return 0;
			const FPendingVerb V = *L.PendingVerb;
			L.PendingVerb.reset();
			int InRange = 0;
			for (const FMachine& M : Ms) if (M.bAlive && std::hypot(M.X - P.X, M.Z - P.Z) <= V.Radius) ++InRange;
			if (V.Verb == "VOLATILE") W.SpawnVolatileZone(P.X, P.Z, V.Radius, V.Magnitude, V.Duration);
			else if (V.Verb == "SUPPRESS") { for (FMachine& M : Ms) if (M.bAlive && std::hypot(M.X - P.X, M.Z - P.Z) <= V.Radius) dragoncast::StunMachine(M, V.Magnitude); }
			else dragoncast::ApplyVulnPulse(Ms, P.X, P.Z, V.Radius, V.Magnitude, V.Duration, W.Now());
			W.Alert(VerbLabel(V.Verb) + " applied to nearby hostiles");
			return InRange;
		}
	}

	int NearestTarget(const std::vector<FMachine>& Ms, double X, double Z, double Range)
	{
		int Best = -1;
		double BestD = Range;
		for (int I = 0; I < static_cast<int>(Ms.size()); ++I)
		{
			if (!Ms[I].bAlive) continue;
			const double D = std::hypot(Ms[I].X - X, Ms[I].Z - Z);
			if (D < BestD) { BestD = D; Best = I; }
		}
		return Best;
	}

	std::string RejectionFor(const std::vector<FMachine>& Ms, const FLiveBuild& L, const std::string& Slot, const FPose& P, bool bInVehicle)
	{
		const FConfig* Base = BaseConfig(L, Slot);
		if (!Base) return "NO_ABILITY";
		if (bInVehicle) return "IN_VEHICLE";
		const auto Rt = L.Runtime.find(Slot);
		if ((Rt == L.Runtime.end() ? 0 : Rt->second.Cooldown) > 0) return "COOLDOWN";
		if (L.Energy < AbilityCost(L, Slot)) return "ENERGY";
		if (!Base->Effects.empty() && Base->Effects[0].Kind == "STRIKE" && NearestTarget(Ms, P.X, P.Z, Base->Effects[0].Radius.value_or(16)) < 0) return "NO_TARGET";
		return "";
	}

	FPoint2 DashLanding(const IWorld& W, double X, double Z, double Yaw, double Distance)
	{
		FPoint2 Last{X, Z};
		for (double D = 0.5; D <= Distance + 1e-6; D += 0.5)
		{
			const FPoint2 Probe{X + std::sin(Yaw) * D, Z + std::cos(Yaw) * D};
			if (W.Blocked(Probe.X, Probe.Z)) break;
			Last = Probe;
		}
		return Last;
	}

	FCastResult CastAbility(IWorld& W, std::vector<FMachine>& Ms, FLiveBuild& L, FEventLog& Log, const std::string& Slot, const FPose& Pose, const FCastContext& Ctx)
	{
		FCastResult Out;
		Out.Pose = Pose;
		const FConfig* Base = BaseConfig(L, Slot);
		const std::string Name = Base ? NodeById(Base->Id).Name : "";
		const std::string Reason = RejectionFor(Ms, L, Slot, Pose, Ctx.bInVehicle);
		if (!Reason.empty())
		{
			Out.Reason = Reason;
			Out.Text = AbRejectText(Reason, Name);
			L.Effect = Out.Text;
			L.EffectTime = 1.5;
			Out.Event = AbRecord(W, Log, AbEvent("REJECTED", Base ? Base->Id : "", Slot, Pose, Reason));
			return Out;
		}
		const std::optional<FConfig> Config = ActivateLiveAbility(L, Slot, Ctx.Environment, Ctx.SubclassId);
		if (!Config)
		{
			Out.Reason = "ENERGY";
			Out.Text = AbRejectText("ENERGY", Name);
			Out.Event = AbRecord(W, Log, AbEvent("REJECTED", Base->Id, Slot, Pose, "ENERGY"));
			return Out;
		}
		const FEffect* Effect = Config->Effects.empty() ? nullptr : &Config->Effects[0];
		FPose P = Pose;
		int Hits = 0, BossHits = 0, Kills = 0;
		double Radius = 0;
		const double Duration = Effect && Effect->Duration ? *Effect->Duration : 0;
		const double Px = Pose.X, Pz = Pose.Z;
		auto Hurt = [&](size_t I, double Dmg, double Stun, bool bInterrupt) {
			const double Dealt = W.DamageMods(Ms, I, Dmg, "KINETIC", Px, Pz);
			FMachine& M = Ms[I];
			M.Hp -= Dealt;
			dragoncast::StunMachine(M, Stun);
			if (bInterrupt && !M.bBoss) M.Aim = 0;
			++Hits;
			if (M.bBoss) ++BossHits;
			W.Hit();
			if (M.Hp <= 0) { const bool bWas = M.bAlive; W.Defeat(Ms, I); if (bWas && !Ms[I].bAlive) ++Kills; }
		};
		const int VerbHits = AbApplyPendingVerb(W, Ms, L, Pose);
		const std::string Kind = Effect ? Effect->Kind : "";
		if (Kind == "DASH")
		{
			const FPoint2 To = DashLanding(W, Pose.X, Pose.Z, Pose.Yaw, Effect->Value);
			P.X = To.X; P.Z = To.Z;
			W.Iframes(Effect->Duration.value_or(0.28));
			if (Effect->Has("dragonfire"))
			{
				int Burned = 0;
				for (size_t I = 0; I < Ms.size(); ++I)
				{
					if (!Ms[I].bAlive) continue;
					const double Dx = To.X - Px, Dz = To.Z - Pz, L2 = Dx * Dx + Dz * Dz;
					const double T = L2 == 0 ? 0 : std::max(0.0, std::min(1.0, ((Ms[I].X - Px) * Dx + (Ms[I].Z - Pz) * Dz) / L2));
					if (std::hypot(Ms[I].X - (Px + T * Dx), Ms[I].Z - (Pz + T * Dz)) > 2.5) continue;
					Hurt(I, 3, 0.8, false);
					++Burned;
				}
				if (Burned) L.Energy = std::min(100.0, L.Energy + Burned * 6);
				Radius = Effect->Value;
				W.Alert(Burned ? "WYRM DASH · " + std::to_string(Burned) + " burned, energy refunded" : std::string("WYRM DASH"));
			}
			else W.Alert("RIFT DASH · incoming damage negated");
		}
		else if (Kind == "DAMAGE")
		{
			Radius = Effect->Radius.value_or(6) * AreaScale;
			W.Noise();
			for (size_t I = 0; I < Ms.size(); ++I)
			{
				FMachine& M = Ms[I];
				if (!M.bAlive || std::hypot(M.X - Px, M.Z - Pz) >= Radius) continue;
				if (Effect->Has("knockback") && !M.bBoss) { const FPoint2 Pushed = KnockbackFrom(Px, Pz, M.X, M.Z, SlamKnockback); M.X = Pushed.X; M.Z = Pushed.Z; }
				Hurt(I, Effect->Value / 20, ImpactStunSeconds, true);
			}
			if (Effect->Has("weaken"))
			{
				dragoncast::ApplyVulnPulse(Ms, Px, Pz, Radius, 1.2, 8, W.Now());
				W.Alert("ASH NOVA · hostiles weakened");
			}
		}
		else if (Kind == "DOME")
		{
			W.Barrier(Effect->Duration.value_or(5));
			W.Dome(Effect->Duration.value_or(5));
			Radius = Effect->Radius.value_or(5);
			W.Alert("Barrier projected");
		}
		else if (Kind == "MARK")
		{
			Radius = Effect->Radius.value_or(24);
			for (const FMachine& M : Ms)
				if (M.bAlive && std::hypot(M.X - Px, M.Z - Pz) <= Radius) { ++Hits; if (M.bBoss) ++BossHits; }
			dragoncast::ApplyVulnPulse(Ms, Px, Pz, Radius, Effect->Value, Effect->Duration.value_or(8), W.Now());
			W.Alert("Recon swarm deployed · hostiles revealed");
		}
		else if (Kind == "SILENCE")
		{
			Radius = Effect->Radius.value_or(12);
			for (size_t I = 0; I < Ms.size(); ++I)
			{
				FMachine& M = Ms[I];
				if (!M.bAlive || std::hypot(M.X - Px, M.Z - Pz) >= Radius) continue;
				dragoncast::StunMachine(M, Effect->Duration.value_or(3));
				if (M.bBoss) W.BossPoise(Ms, I, DisruptBossPoise);
				if (!M.bBoss) M.Aim = 0;
				++Hits;
				if (M.bBoss) ++BossHits;
			}
			W.Alert("Hostile systems disrupted · environment recalibrated");
		}
		else if (Kind == "SIEGE") W.Alert("SIEGE MODE · stability and firepower up");
		else if (Kind == "VEIL") W.Alert("PHASE VEIL · concealed until you attack");
		else if (Kind == "TURRET")
		{
			W.PlaceRiftTurret(Px + std::sin(Pose.Yaw) * 2.5, Pz + std::cos(Pose.Yaw) * 2.5, Effect->Duration.value_or(20));
			W.Alert("Rift Turret deployed");
		}
		else if (Kind == "STRIKE")
		{
			const int T = NearestTarget(Ms, Px, Pz, Effect->Radius.value_or(16)); // RejectionFor guaranteed one
			const FPoint2 Land = StrikeLanding(Px, Pz, Ms[T].X, Ms[T].Z);
			P.X = Land.X; P.Z = Land.Z; P.Yaw = std::atan2(Ms[T].X - Land.X, Ms[T].Z - Land.Z);
			W.Noise();
			Hurt(static_cast<size_t>(T), StrikeDamage(L.VeilTime) * L.StrikeBoost, ImpactStunSeconds, true);
			L.VeilTime = 0;
			Radius = std::hypot(Ms[T].X - Px, Ms[T].Z - Pz);
			W.Alert("SHADOW STRIKE");
		}
		if (!Hits && VerbHits) Hits = VerbHits;
		FEvent E = AbEvent("CAST", Config->Id, Slot, P, "");
		E.Effect = Effect ? Effect->Kind : "NONE";
		E.FromX = Px; E.FromZ = Pz; E.Radius = Radius; E.Duration = Duration; E.Hits = Hits; E.BossHits = BossHits; E.Kills = Kills;
		Out.bOk = true;
		Out.Config = Config;
		Out.Pose = P;
		Out.Event = AbRecord(W, Log, E);
		return Out;
	}

	void HoldDisabledField(std::vector<FMachine>& Ms, const FLiveBuild& L, const FPose& P, double Radius)
	{
		if (L.HackTime <= 0) return;
		for (FMachine& M : Ms) if (M.bAlive && !M.bBoss && std::hypot(M.X - P.X, M.Z - P.Z) < Radius) M.Cool = std::max(M.Cool, 0.3);
	}

	FLiveBuild CancelAbilities(IWorld& W, const FLiveBuild& L, FEventLog& Log, const FPose& P)
	{
		for (const char* Slot : Slots)
		{
			const auto Rt = L.Runtime.find(Slot);
			if (Rt != L.Runtime.end() && (Rt->second.State == "ACTIVE" || Rt->second.Cooldown > 0))
				AbRecord(W, Log, AbEvent("CANCELLED", AbBranchOf(L.Equipped.Slots, Slot), Slot, P, ""));
		}
		W.ClearDefences();
		FLiveBuild Fresh = CreateLiveBuild(L.Equipped, L.Branches);
		Fresh.DamageMultiplier = L.DamageMultiplier;
		Fresh.ShieldReflect = L.ShieldReflect;
		Fresh.Threat = L.Threat;
		return Fresh;
	}

	FSimMods SyncSimFromLive(const FLiveBuild& L)
	{
		FSimMods M;
		M.VerbDamageMult = (L.VerbKind == "RAGE" && L.VerbTime > 0 ? L.VerbMagnitude : 1) * (L.SiegeTime > 0 ? L.SiegeBoost : 1) * SiegeDamageMult(L.SiegeTime);
		M.StealthMult = VeilSightMult(L.VeilTime);
		M.VerbIncomingMult = L.VerbKind == "OVERSHIELD" && L.VerbTime > 0 ? 1 - L.VerbMagnitude : 1;
		return M;
	}

	bool SelectAbilityBranch(FProgression& P, const std::string& AbilityId, const std::string& BranchId)
	{
		if (P.CalibrationTokens < 1) return false;
		P.CalibrationTokens -= 1;
		P.AbilityBranches[AbilityId] = BranchId;
		return true;
	}

	bool AbilityUnlocked(const FProgression& P, const std::string& AbilityId)
	{
		const FNode& N = NodeById(AbilityId);
		if (std::find(P.UnlockedAbilities.begin(), P.UnlockedAbilities.end(), N.Id) != P.UnlockedAbilities.end()) return true;
		const double Mastery = N.Stream == "EXPLORATION" ? 31 : 34;
		return Mastery >= N.Cost;
	}

	bool EquipAbility(FProgression& P, const std::string& AbilityId, std::string& OutError)
	{
		const FConfig* C = ConfigById(AbilityId);
		if (!C) { OutError = "Unknown ability " + AbilityId; return false; }
		if (!AbilityUnlocked(P, AbilityId)) { OutError = NodeById(AbilityId).Name + " is locked"; return false; }
		P.ActiveBuildSlots[NodeById(AbilityId).Slot] = AbilityId;
		return true;
	}
}
