#include "Core/WFLivingEventCore.h"

#include "Core/WFJsCompat.h"
#include "Core/WFLivingNpcCore.h"
#include "Core/WFShopCore.h"

#include <algorithm>
#include <cctype>
#include <cmath>

namespace wf::livingevent
{
	namespace
	{
		std::string LeN(double V) { return js::NumberToString(V); }
		std::string LeLower(std::string S) { for (char& C : S) C = static_cast<char>(std::tolower(static_cast<unsigned char>(C))); return S; }
		std::string LeFactionName(const std::string& F) { const shop::FFaction* X = shop::FactionById(F); return X ? X->Name : F; }
		std::string LeMats(const std::vector<std::pair<std::string, double>>& M)
		{
			std::string Out;
			for (const auto& [K, V] : M)
			{
				std::string Spoken;
				for (char C : K) { if (std::isupper(static_cast<unsigned char>(C))) { Spoken += ' '; Spoken += static_cast<char>(std::tolower(static_cast<unsigned char>(C))); } else Spoken += C; }
				Out += (Out.empty() ? "" : ", ") + std::string("+") + LeN(V) + " " + Spoken;
			}
			return Out;
		}
		FStep LeFinish(const FDirector& D, FEvent Ev, const std::string& Outcome)
		{
			Ev.Phase = Outcome;
			Ev.Timer = ResultHold;
			FStep S;
			S.Director = D;
			S.Director.Current = Ev;
			S.Resolved = FResolved{Ev, Outcome};
			return S;
		}
	}

	const FRule& RuleOf(const std::string& Kind)
	{
		static const std::vector<std::pair<std::string, FRule>> Rules{
			{"INVASION", {"District Invasion", "Hostiles are pushing into the district. Drive them out before it falls.", 15, 150, 10, {{"reinforcedAlloy", 3}, {"microCircuits", 3}}, 30, -6, true}},
			{"DISTRESS", {"Distress Call", "Civilians pinned down. Reach them and clear the attackers.", 8, 70, 6, {{"scrapMetal", 8}}, 15, -4, false}},
			{"ROAMING_BOSS", {"Roaming Warlord", "A boss-class threat is walking the city edge. Bring it down before it moves on.", 20, 210, 14, {{"aegisCore", 1}}, 60, -5, true}},
			{"CONVOY", {"Smuggler Convoy", "An armed smuggler convoy is crossing the city. Stop it before it slips out.", 12, 100, 8, {{"vehicleParts", 3}, {"fuel", 6}}, 25, -3, false}},
			{"FRACTURE", {"Reality Fracture", "A rift has torn open. Hold position inside it while it spits out aberrations.", 12, 120, 8, {{"anomalyCarbon", 3}, {"dataShards", 3}}, 50, -3, false}},
		};
		for (const auto& [K, R] : Rules) if (K == Kind) return R;
		return Rules.front().second;
	}

	const std::vector<FDistrict>& Districts()
	{
		// living-world.ts DISTRICTS: Nexus anchors 60 m out on the four bearings, Neon's at its blocks (the web world's metres)
		static const std::vector<FDistrict> All{
			{"nexus:spire", "nexus", "Spire District", 62.400000000000006, -356.4, "wardens"},
			{"nexus:market", "nexus", "Market District", 122.4, -296.4, "guild"},
			{"nexus:shipyard", "nexus", "Shipyard", 62.40000000000001, -236.39999999999998, "guild"},
			{"nexus:arcology", "nexus", "Arcology", 2.4000000000000057, -296.4, "wardens"},
			{"neon:spire", "neon", "Aegis Spire", -273.35298563379115, -227.4140222378975, "aegis"},
			{"neon:undercity", "neon", "Undercity", -295.35298563379115, -205.4140222378975, "syndicate"},
			{"neon:market", "neon", "Neon Market", -273.35298563379115, -186.4140222378975, "syndicate"},
			{"neon:grid", "neon", "The Grid", -233.35298563379115, -178.4140222378975, "aegis"},
		};
		return All;
	}
	const FDistrict* DistrictById(const std::string& Id) { for (const FDistrict& D : Districts()) if (D.Id == Id) return &D; return nullptr; }

	FConvoy ConvoyFactions(const std::string& City) { return City == "neon" ? FConvoy{"syndicate", "aegis"} : FConvoy{"", "wardens"}; }

	std::string EventBeneficiary(const FEvent& Ev)
	{
		if (Ev.Kind == "CONVOY") return ConvoyFactions(Ev.City).Beneficiary;
		if (const FDistrict* D = DistrictById(Ev.District)) return D->Faction;
		return Ev.City == "neon" ? "syndicate" : "wardens"; // CITY_FACTIONS[city][0]
	}

	FEvent PickEvent(const std::string& City, const std::function<double()>& Rnd, const std::vector<std::string>& Fallen, double NowMs, double Serial)
	{
		std::vector<const FDistrict*> InCity;
		for (const FDistrict& D : Districts()) if (D.City == City) InCity.push_back(&D);
		const FDistrict* Retake = nullptr;
		for (const FDistrict* D : InCity) if (std::find(Fallen.begin(), Fallen.end(), D->Id) != Fallen.end()) { Retake = D; break; }
		static const char* const Kinds[7] = {"INVASION", "INVASION", "DISTRESS", "DISTRESS", "CONVOY", "FRACTURE", "ROAMING_BOSS"};
		const std::string Kind = Retake ? "INVASION" : Kinds[static_cast<size_t>(std::floor(Rnd() * 7))];
		const FDistrict* District = Retake ? Retake : InCity[static_cast<size_t>(std::floor(Rnd() * static_cast<double>(InCity.size())))];
		const living::FCity* C = living::CityById(City);
		FEvent Ev;
		Ev.Kind = Kind; Ev.City = City; Ev.District = District->Id;
		Ev.X = District->X; Ev.Z = District->Z;
		if (City == "neon" && C && (Kind == "ROAMING_BOSS" || Kind == "CONVOY"))
		{
			// Neon's edge: either open end of the cross street
			Ev.X = C->X + (District->X >= C->X ? 45 : -45);
			Ev.Z = C->Z + 7;
		}
		Ev.Id = City + "-" + LeLower(Kind) + "-" + js::ToBase36(NowMs) + "-" + LeN(Serial);
		Ev.Timer = RuleOf(Kind).Warn;
		return Ev;
	}

	FStep StepDirector(const FDirector& D, const FInput& In)
	{
		FStep S;
		S.Director = D;
		if (!D.Current)
		{
			if (In.City.empty() || In.bBlocked || !In.bAlive) return S;
			const std::string Prefix = In.City + ":";
			const bool bRetakeDue = std::any_of(In.Fallen.begin(), In.Fallen.end(), [&](const std::string& Id) { return Id.rfind(Prefix, 0) == 0; });
			const double Next = std::min(D.Next, bRetakeDue ? RetakeDelay : D.Next) - In.Dt;
			if (Next > 0) { S.Director.Next = Next; return S; }
			const FEvent Started = PickEvent(In.City, In.Rnd, In.Fallen, In.NowMs, D.Serial + 1);
			S.Director = FDirector{0, Started, D.Serial + 1};
			S.Started = Started;
			return S;
		}
		const FEvent& Ev = *D.Current;
		const FRule& Rule = RuleOf(Ev.Kind);
		if (Ev.Phase == "WON" || Ev.Phase == "FAILED")
		{
			const double Timer = Ev.Timer - In.Dt;
			if (Timer > 0) { S.Director.Current->Timer = Timer; return S; }
			S.Director.Current.reset();
			S.Director.Next = GapLo + In.Rnd() * (GapHi - GapLo);
			return S;
		}
		const living::FCity* C = living::CityById(Ev.City);
		const bool bAbandoned = C && js::Hypot(In.Px - C->X, In.Pz - C->Z) > C->Radius + AbandonMargin;
		if (Ev.Phase == "WARNING")
		{
			if (bAbandoned) return LeFinish(D, Ev, "FAILED");
			const double Timer = Ev.Timer - In.Dt;
			if (Timer > 0) { S.Director.Current->Timer = Timer; return S; }
			FEvent Act = Ev;
			Act.Phase = "ACTIVE"; Act.Timer = Rule.Limit; Act.Wave = 0;
			S.Director.Current = Act;
			S.Activated = Act;
			return S;
		}
		if (bAbandoned) return LeFinish(D, Ev, "FAILED");
		const double Timer = Ev.Timer - In.Dt;
		double Hold = Ev.Hold;
		if (Ev.Kind == "FRACTURE")
		{
			if (In.bAlive && js::Hypot(In.Px - Ev.X, In.Pz - Ev.Z) <= FractureRadius) Hold += In.Dt;
			if (Hold >= FractureHold) { FEvent Won = Ev; Won.Hold = Hold; return LeFinish(D, Won, "WON"); }
		}
		else if (Ev.bSpawned && In.TagAlive == 0)
		{
			if (In.PlayerKills > 0) return LeFinish(D, Ev, "WON");
			FEvent Cleared = Ev;
			Cleared.bCleared = true;
			return LeFinish(D, Cleared, "FAILED");
		}
		if (Timer <= 0) { FEvent Lost = Ev; Lost.Hold = Hold; return LeFinish(D, Lost, "FAILED"); }
		FEvent Next = Ev;
		Next.Timer = Timer; Next.Hold = Hold; Next.Wave = std::max(0.0, Ev.Wave - In.Dt);
		S.Director.Current = Next;
		return S;
	}

	std::vector<std::string> FallenDistricts(const FProgression& P, double NowMs)
	{
		std::vector<std::string> Out;
		for (const FDistrict& D : Districts()) if (shop::DistrictStatus(P.Living, D.Id, NowMs) == "FALLEN") Out.push_back(D.Id);
		return Out;
	}

	std::string ResolveEvent(FProgression& P, const FEvent& Ev, const std::string& Outcome, double NowMs)
	{
		const std::string Key = "living-event:" + Ev.Id;
		if (std::find(P.EarnedRewards.begin(), P.EarnedRewards.end(), Key) != P.EarnedRewards.end()) return "";
		const FRule& Rule = RuleOf(Ev.Kind);
		const std::string Beneficiary = EventBeneficiary(Ev);
		P.EarnedRewards.push_back(Key);
		if (Outcome == "WON")
		{
			shop::AdjustRep(P.Living, Beneficiary, Rule.WinRep, Ev.Kind != "CONVOY");
			const std::string Owner = Ev.Kind == "CONVOY" ? ConvoyFactions(Ev.City).Owner : "";
			if (!Owner.empty()) shop::AdjustRep(P.Living, Owner, -8, false);
			if (Rule.bDistrictStakes) shop::RecordDistrict(P.Living, Ev.District, true, NowMs);
			for (const auto& [K, V] : Rule.WinMaterials) { const auto It = P.Materials.find(K); P.Materials[K] = (It == P.Materials.end() ? 0 : It->second) + V; }
			P.FractureShards += Rule.WinShards;
			living::RecordEventWin(P, Ev.City);
			return Rule.Title + " won · +" + LeN(Rule.WinRep) + " " + LeFactionName(Beneficiary) + " · " + LeMats(Rule.WinMaterials) + ", +" + LeN(Rule.WinShards) + " shards"
				+ (Owner.empty() ? std::string() : " · " + LeFactionName(Owner) + " won't forget");
		}
		if (Ev.bCleared) return Rule.Title + ": the city patrols handled it without you. No reward.";
		shop::AdjustRep(P.Living, Beneficiary, Rule.FailRep, false);
		if (Rule.bDistrictStakes) shop::RecordDistrict(P.Living, Ev.District, false, NowMs);
		const FDistrict* District = DistrictById(Ev.District);
		return Rule.Title + " lost" + (Rule.bDistrictStakes && District ? " · " + District->Name + " has fallen; its trade is closed until you retake it" : std::string());
	}

	FSpawnPlan SpawnPlan(const FEvent& Ev)
	{
		const std::string Invaders = Ev.City == "nexus" ? "wastelands" : "nexus";
		if (Ev.Kind == "INVASION") return {Invaders, 6, 1, 12, false};
		if (Ev.Kind == "DISTRESS") return {Invaders, 3, 0, 8, false};
		if (Ev.Kind == "CONVOY") return {"wastelands", 4, 2, 6, false};
		if (Ev.Kind == "ROAMING_BOSS") return {"nexus", 1, 0, 0, true}; // the Nexus region's boss; without one, 4 elites of the invaders
		return {"swamps", 3, 0, FractureRadius + 4, false};
	}

	std::optional<FSpawnPlan> FractureWave(FDirector& D, double TagAlive)
	{
		if (!D.Current || D.Current->Phase != "ACTIVE" || D.Current->Kind != "FRACTURE" || D.Current->Wave > 0) return std::nullopt;
		D.Current->Wave = FractureWaveEvery;
		if (TagAlive >= 5) return std::nullopt;
		return FSpawnPlan{"swamps", 2, 0, FractureRadius + 5, false};
	}
}
