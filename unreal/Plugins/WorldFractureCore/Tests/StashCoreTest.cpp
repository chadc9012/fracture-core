// Golden test for the C++ stash: replays tools/gen-stash-golden.ts, recorded from the web build's real stash.ts. Every craft,
// stim use (stacks and timers), sale, dismantle, upgrade and vault move must leave the same save and buffs.
#include "Core/WFStashCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::stash;

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
	std::string Join(const std::vector<std::string>& Xs, const char* Sep)
	{
		std::string S;
		for (const std::string& X : Xs) { if (!S.empty()) S += Sep; S += X; }
		return S;
	}
	std::string Kv(const std::map<std::string, double>& M)
	{
		std::string S;
		for (const auto& [K, V] : M) { if (!S.empty()) S += ","; S += K + "=" + N(V); }
		return S.empty() ? None : S;
	}
	std::string Item(const FGearItem& G)
	{
		return G.Id + "^" + G.Name + "^" + G.Slot + "^" + N(G.Power) + "^" + N(G.Level) + "^" + G.Source + "^" + (G.SetId ? *G.SetId : None) + "^" + (G.Rarity ? *G.Rarity : None) + "^" + (G.bFavorite ? "1" : "0");
	}
	std::string Ps(const FProgression& P)
	{
		std::vector<std::string> Inv, Eq;
		for (const FGearItem& G : P.Inventory) Inv.push_back(Item(G));
		for (const auto& [K, V] : P.EquippedGear) Eq.push_back(K + "=" + V);
		return Join({Inv.empty() ? None : Join(Inv, ";"), Eq.empty() ? None : Join(Eq, ","), P.VaultIds.empty() ? None : Join(P.VaultIds, ","), Kv(P.Materials),
			P.EarnedRewards.empty() ? None : Join(P.EarnedRewards, ","), N(P.FractureShards)}, "|");
	}
	FProgression ParseP(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FProgression P;
		if (F[0] != None)
			for (const std::string& E : Split(F[0], ';'))
			{
				const std::vector<std::string> X = Split(E, '^');
				FGearItem G;
				G.Id = X[0]; G.Name = X[1]; G.Slot = X[2]; G.Power = Num(X[3]); G.Level = Num(X[4]); G.Element = "KINETIC"; G.Source = X[5];
				if (X[6] != None) G.SetId = X[6];
				if (X[7] != None) G.Rarity = X[7];
				G.bFavorite = X[8] == "1";
				P.Inventory.push_back(G);
			}
		if (F[1] != None) for (const std::string& E : Split(F[1], ',')) { const size_t Eq = E.find('='); P.EquippedGear[E.substr(0, Eq)] = E.substr(Eq + 1); }
		if (F[2] != None) P.VaultIds = Split(F[2], ',');
		if (F[3] != None) for (const std::string& E : Split(F[3], ',')) { const size_t Eq = E.rfind('='); P.Materials[E.substr(0, Eq)] = Num(E.substr(Eq + 1)); }
		P.EarnedRewards.clear();
		if (F[4] != None) P.EarnedRewards = Split(F[4], ',');
		P.FractureShards = Num(F[5]);
		return P;
	}
	std::string Bs(const FBuffs& B)
	{
		std::string S;
		for (const auto& [K, V] : B) { if (!S.empty()) S += ","; S += K + "=" + N(V.Stacks) + ":" + N(V.Until); }
		return S.empty() ? None : S;
	}
	FBuffs ParseB(const std::string& S)
	{
		FBuffs B;
		if (S == None) return B;
		for (const std::string& E : Split(S, ','))
		{
			const size_t Eq = E.find('='), Colon = E.find(':');
			B[E.substr(0, Eq)] = {Num(E.substr(Eq + 1, Colon - Eq - 1)), Num(E.substr(Colon + 1))};
		}
		return B;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: StashCoreTest <stash_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FProgression P;
	FBuffs Buffs;
	int Ops = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "CS")
		{
			std::vector<std::string> Cs;
			for (const FConsumable& C : Consumables())
			{
				std::vector<std::string> R;
				for (const auto& [K, V] : C.Recipe) R.push_back(K + "=" + N(V));
				Cs.push_back(C.Id + "^" + C.Name + "^" + N(C.Seconds) + "^" + C.Blurb + "^" + Join(R, ","));
			}
			Same(LineNo, "consumables", Join(Cs, ";"), F[1]);
		}
		else if (T == "P") { P = ParseP(F[1]); Same(LineNo, "save round trip", Ps(P), F[1]); }
		else if (T == "B") { Buffs = ParseB(F[1]); Same(LineNo, "buffs round trip", Bs(Buffs), F[1]); }
		else if (T == "OP")
		{
			++Ops;
			const std::string& Op = F[1];
			const std::string& Arg = F[2];
			const double Now = Num(F[3]);
			bool bChanged = true;
			if (Op == "grant") { const size_t Eq = Arg.find('='); Grant(P, Arg.substr(0, Eq), Num(Arg.substr(Eq + 1))); }
			else if (Op == "craftRuin") bChanged = CraftRuinStone(P);
			else if (Op == "craftStim") bChanged = CraftStim(P, Arg);
			else if (Op == "use") bChanged = UseStim(P, Buffs, Arg, Now);
			else if (Op == "sell") bChanged = SellDuplicate(P, Arg);
			else if (Op == "dismantle") bChanged = Dismantle(P, Arg);
			else if (Op == "upgrade") bChanged = UpgradeWithParts(P, Arg);
			else if (Op == "toVault") bChanged = ToVault(P, Arg);
			else if (Op == "fromVault") FromVault(P, Arg); // the web build always returns a new save here
			else { Same(LineNo, "op", Op, "known"); continue; }
			Same(LineNo, Op.c_str(), std::string(bChanged ? "1" : "0") + "|" + Ps(P) + "|" + Bs(Buffs), F[4]);
		}
		else if (T == "Q")
		{
			const FGearItem* G = nullptr;
			for (const FGearItem& X : P.Inventory) if (X.Id == F[1]) G = &X;
			if (!G) { Same(LineNo, "item", "missing", F[1]); continue; }
			Same(LineNo, "item queries", Join({N(IsDuplicate(P, *G) ? 1 : 0), N(CanSellDuplicate(P, *G) ? 1 : 0), N(SellValue(*G)), N(DismantleParts(*G)), N(PartsCost(*G)), N(InVault(P, G->Id) ? 1 : 0)}, "|"), F[2]);
		}
		else if (T == "VC") Same(LineNo, "visibleConsumables", Join(VisibleConsumables(P.Materials, Buffs, Num(F[1])), ","), F[2]);
		else if (T == "BE") { const FBuffEffect E = BuffEffect(Buffs, Num(F[1])); Same(LineNo, "buffEffect", N(E.Resist) + "|" + N(E.Regen) + "|" + N(E.DamageMult), F[2]); }
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d stash operations, %d checks, %d mismatches\n", Ops, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
