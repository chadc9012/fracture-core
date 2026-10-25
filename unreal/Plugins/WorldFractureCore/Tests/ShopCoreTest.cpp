// Golden test for the C++ merchants: replays tools/gen-shop-golden.ts, recorded from the web build's real regional-shops.ts,
// weapon-catalog.ts, shop-hours.ts, living-world.ts and inventory.ts. Offers, locks, prices, purchases, services and the
// Living World state must match exactly.
#include "Core/WFJsCompat.h"
#include "Core/WFShopCore.h"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::shop;

namespace
{
	const std::string None = "~";
	std::vector<std::string> Split(const std::string& S, char Sep)
	{
		std::vector<std::string> Out;
		std::string Cur;
		for (char C : S) { if (C == Sep) { Out.push_back(Cur); Cur.clear(); } else Cur += C; }
		Out.push_back(Cur);
		return Out;
	}
	double Num(const std::string& S)
	{
		double V = 0;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		if (R.ec != std::errc() || R.ptr != S.data() + S.size()) throw std::runtime_error("bad number: " + S);
		return V;
	}
	std::string N(double V) { return js::NumberToString(V); }
	int Checks = 0, Mismatches = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	FGearItem Gear(const std::string& S)
	{
		const auto F = Split(S, '|');
		FGearItem G;
		G.Id = F[0]; G.Name = F[1]; G.Slot = F[2]; G.Power = Num(F[3]); G.Level = Num(F[4]); G.Element = F[5]; G.Source = F[6];
		if (!F[7].empty()) G.SetId = F[7];
		if (!F[8].empty()) G.Rarity = F[8];
		if (!F[9].empty()) G.Perk = F[9];
		return G;
	}
	std::string GearText(const FGearItem& G)
	{
		return G.Id + "|" + G.Name + "|" + G.Slot + "|" + N(G.Power) + "|" + N(G.Level) + "|" + G.Element + "|" + G.Source + "|" + G.SetId.value_or("") + "|" + G.Rarity.value_or("") + "|" + G.Perk.value_or("");
	}
	std::string StateText(const FProgression& P)
	{
		std::string M, I;
		for (const auto& [K, V] : P.Materials) { if (!M.empty()) M += ","; M += K + "=" + N(V); }
		for (const FGearItem& G : P.Inventory) { if (!I.empty()) I += ";"; I += GearText(G); }
		return M + "#" + I;
	}
	std::string LivingText(const FProgression::FLiving& L)
	{
		std::string G, Lo, D;
		for (const auto& [K, V] : L.Gain) { if (!G.empty()) G += ","; G += K + "=" + N(V); }
		for (const auto& [K, V] : L.Loss) { if (!Lo.empty()) Lo += ","; Lo += K + "=" + N(V); }
		for (const auto& [K, V] : L.Districts) { if (!D.empty()) D += ","; D += K + "=" + N(V.SecuredAt) + "/" + N(V.FallenAt); }
		return G + "|" + Lo + "|" + D;
	}
	void ReadLiving(const std::string& S, FProgression::FLiving& L)
	{
		const auto F = Split(S, '|');
		L = {};
		for (const std::string& P : Split(F[0], ',')) if (!P.empty()) { const auto KV = Split(P, '='); L.Gain[KV[0]] = Num(KV[1]); }
		for (const std::string& P : Split(F[1], ',')) if (!P.empty()) { const auto KV = Split(P, '='); L.Loss[KV[0]] = Num(KV[1]); }
		for (const std::string& P : Split(F[2], ',')) if (!P.empty()) { const auto KV = Split(P, '='); const auto T = Split(KV[1], '/'); L.Districts[KV[0]] = {Num(T[0]), Num(T[1])}; }
	}
	std::string OfferText(const FOffer& O)
	{
		return O.Key + "|" + O.Type + "|" + O.Name + "|" + O.Detail + "|" + N(O.Price) + "|" + N(O.MinLevel) + "|" + (O.bDeal ? "1" : "0") + "|" + (O.Type == "material" ? O.Material + "/" + N(O.Amount) : None)
			+ "|" + (O.Listing ? O.Listing->Kind + "/" + O.Listing->ItemId + "/" + N(O.Listing->Power) : None) + "|" + (O.Drop ? O.Drop->SetId + "/" + O.Drop->Slot : None);
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: %s golden.txt\n", Argv[0]); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FCatalog C;
	reward::FCatalog Rewards;
	FProgression P;
	double Now = 0;
	std::optional<double> Hour;
	int Cases = 0, Offers = 0, Buys = 0, Services = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const int LineNo = static_cast<int>(I) + 1;
		const auto F = Split(Lines[I], '\t');
		const std::string& T = F[0];
		if (T == "W") C.Weapons.push_back({F[1], F[2], F[3], F[4], F[5]});
		else if (T == "A") C.Armors.push_back({F[1], F[2], F[3], F[4], F[5]});
		else if (T == "NW") { FCatalogWeapon W; static_cast<FWeapon&>(W) = {F[1], F[2], F[3], F[4], F[5]}; W.Rarity = F[6]; W.Via = F[7]; W.Cls = F[8]; C.Named.push_back(W); }
		else if (T == "COL")
		{
			FCollection Co;
			Co.Id = F[1]; Co.Name = F[2]; Co.Family = F[3];
			if (F[4] != None) Co.Sources = Split(F[4], ',');
			Co.VendorTier = static_cast<int>(Num(F[5]));
			for (const std::string& P2 : Split(F[6], ';')) { const auto KV = Split(P2, '='); if (!KV[1].empty()) Co.Pieces[KV[0]] = KV[1]; }
			Co.TwoName = F[7]; Co.FourName = F[8];
			C.Collections.push_back(Co);
		}
		else if (T == "SET")
		{
			reward::FArmorSet S;
			S.Id = F[1]; S.Name = F[2]; S.RegionId = F[3]; S.Element = F[4];
			for (int K = 0; K < 5; ++K) S.Pieces[reward::SetSlots[K]] = F[5 + K];
			Rewards.Sets.push_back(S);
		}
		else if (T == "SHOP")
		{
			FShop S;
			S.Id = F[1]; S.Name = F[2]; S.Kind = F[3]; S.Place = F[4]; S.Currency = F[5]; S.X = Num(F[6]); S.Z = Num(F[7]); S.PriceMult = Num(F[8]); S.MinLevel = Num(F[9]); S.VendorTier = static_cast<int>(Num(F[10]));
			if (F[11] != None) S.RequiresMission = F[11];
			if (F[12] != None) S.RequiresLabel = F[12];
			if (F[13] != None) S.MinStanding = F[13];
			S.Faction = F[14] == None ? "" : F[14]; S.District = F[15] == None ? "" : F[15]; S.DistrictName = F[16] == None ? "" : F[16];
			C.Shops.push_back(S);
		}
		else if (T == "C") { ++Cases; P = FProgression{}; P.Materials.clear(); P.Inventory.clear(); P.CompletedMissions.clear(); Now = Num(F[2]); Hour = F[3] == None ? std::nullopt : std::optional<double>(Num(F[3])); P.Level = Num(F[4]); }
		else if (T == "PM") P.CompletedMissions.push_back(F[1]);
		else if (T == "PMAT") P.Materials[F[1]] = Num(F[2]);
		else if (T == "PI") P.Inventory.push_back(Gear(F[1]));
		else if (T == "LIV") ReadLiving(F[1], P.Living);
		else if (T == "OFF")
		{
			++Offers;
			const FShop& S = *C.Find(F[1]);
			Same(LineNo, "price mult", N(ShopPriceMult(S, P, Now)), F[3]);
			const std::vector<FOffer> Got = ShopOffers(C, S, Num(F[2]), Num(F[3]));
			const size_t Want = static_cast<size_t>(Num(F[4]));
			Same(LineNo, "offer count", std::to_string(Got.size()), F[4]);
			for (size_t K = 0; K < Want; ++K) { ++I; Same(static_cast<int>(I) + 1, "offer", K < Got.size() ? OfferText(Got[K]) : None, Split(Lines[I], '\t')[1]); }
		}
		else if (T == "LOCK")
		{
			const FShop& S = *C.Find(F[1]);
			const FTerms Terms = LivingShopTerms(&P.Living, S, Now);
			Same(LineNo, "lock", ShopLock(S, P, Now, Hour).value_or(None) + "\t" + Terms.Lock.value_or(None) + "\t" + N(Terms.PriceMult), F[2] + "\t" + F[3] + "\t" + F[4]);
		}
		else if (T == "BUY")
		{
			++Buys;
			const FShop& S = *C.Find(F[1]);
			const std::vector<FOffer> List = ShopOffers(C, S, Today(Now), ShopPriceMult(S, P, Now));
			const size_t Ix = static_cast<size_t>(Num(F[2]));
			if (Ix >= List.size()) { Same(LineNo, "buy index", "out of range", F[2]); continue; }
			const FResult R = BuyOffer(Rewards, P, S, List[Ix], Now, Hour, Num(F[3]));
			Same(LineNo, "buy", (R.bOk ? "OK:" : "ERR:") + R.Message, F[4]);
		}
		else if (T == "SVC")
		{
			++Services;
			const FShop& S = *C.Find(F[1]);
			std::string Targets;
			for (const std::string& Id : ServiceTargets(S, P)) { if (!Targets.empty()) Targets += ","; Targets += Id; }
			const auto Item = std::find_if(P.Inventory.begin(), P.Inventory.end(), [&F](const FGearItem& G) { return G.Id == F[2]; });
			Same(LineNo, "service fee and targets", N(ServiceFee(S, *Item)) + "\t" + (Targets.empty() ? None : Targets), F[4] + "\t" + F[5]);
			const FResult R = ServiceGear(P, S, F[2], F[3] == None ? std::nullopt : std::optional<std::string>(F[3]), Now, Hour);
			++I;
			Same(static_cast<int>(I) + 1, "service", (R.bOk ? "OK:" : "ERR:") + R.Message, Split(Lines[I], '\t')[1]);
		}
		else if (T == "UP") Same(LineNo, "upgrade", UpgradeGear(P, F[1]) ? "1" : "0", F[2]);
		else if (T == "INF") Same(LineNo, "infuse", InfuseGear(P, F[1], F[2]) ? "1" : "0", F[3]);
		else if (T == "ST") Same(LineNo, "state", StateText(P), F[1]);
		else if (T == "REP") { AdjustRep(P.Living, F[1], Num(F[2]), F[3] == "1"); Same(LineNo, "living", LivingText(P.Living), F[4]); }
		else if (T == "DIST") { RecordDistrict(P.Living, F[1], F[2] == "1", Num(F[3])); Same(LineNo, "living", LivingText(P.Living), F[4]); }
		else if (T == "WK")
		{
			std::string Got;
			for (const FCatalogWeapon& W : WeeklyCatalogStock(C, F[1], Num(F[2]))) { if (!Got.empty()) Got += ","; Got += W.Id; }
			Same(LineNo, "weekly", Got, F.size() > 3 ? F[3] : "");
		}
		else if (T == "HR")
		{
			const FShop& S = *C.Find(F[1]);
			Same(LineNo, "hours", IsOpenAt(ShopHours(S), F[2] == None ? std::nullopt : std::optional<double>(Num(F[2]))) ? "1" : "0", F[3]);
		}
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d cases, %d stock checks, %d purchases, %d services, %d checks, %d mismatches\n", Cases, Offers, Buys, Services, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
