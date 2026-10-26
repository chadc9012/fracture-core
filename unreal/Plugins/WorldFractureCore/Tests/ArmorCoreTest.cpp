// Golden test for the C++ armor effects: replays tools/gen-armor-golden.ts, recorded from the web build's real
// armor-sets.ts, armor-perks.ts, armor-attributes.ts and inventory.ts weaponDamageMultiplier.
#include "Core/WFArmorCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::armor;

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
	FEffects Fx(const std::string& S)
	{
		const auto P = Split(S, '|');
		FEffects E;
		E.Resist = Num(P.at(0)); E.WeaponDamage = Num(P.at(1)); E.MoveSpeed = Num(P.at(2)); E.Regen = Num(P.at(3)); E.SlideBoost = Num(P.at(4)); E.AbilityRecharge = Num(P.at(5));
		return E;
	}
	std::string Fx(const FEffects& E) { return N(E.Resist) + "|" + N(E.WeaponDamage) + "|" + N(E.MoveSpeed) + "|" + N(E.Regen) + "|" + N(E.SlideBoost) + "|" + N(E.AbilityRecharge); }
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: ArmorCoreTest <armor_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FCatalog C;
	FInventory Inv;
	FEquipped Eq;
	int Cases = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "SET") C.Sets.push_back({F[1], Fx(F[2]), Fx(F[3])});
		else if (T == "PERK") C.Perks[F[1]][F[2]] = Fx(F[3]);
		else if (T == "C") { ++Cases; Inv.clear(); Eq.clear(); }
		else if (T == "IT")
		{
			FGearItem G;
			G.Id = F[1]; G.Slot = F[2]; G.Power = Num(F[3]); G.Level = Num(F[4]);
			if (F[5] != None) G.SetId = F[5];
			G.Source = F[6];
			Inv.push_back(G);
		}
		else if (T == "EQ") Eq[F[1]] = F[2];
		else if (T == "R")
		{
			const FLoadoutAttributes A = LoadoutAttributes(Inv, Eq);
			Same(LineNo, "armorEffects", Fx(ArmorEffects(C, Inv, Eq)), F[1]);
			Same(LineNo, "perkEffects", Fx(PerkEffects(C, Inv, Eq)), F[2]);
			Same(LineNo, "raw attributes", N(A.Raw.Intellect) + "|" + N(A.Raw.Mobility) + "|" + N(A.Raw.Defense), F[3]);
			Same(LineNo, "effective attributes", N(A.Effective.Intellect) + "|" + N(A.Effective.Mobility) + "|" + N(A.Effective.Defense), F[4]);
			Same(LineNo, "worn", std::to_string(A.Worn), F[5]);
			Same(LineNo, "hasFlexibility", HasFlexibility(C, Inv, Eq) ? "1" : "0", F[6]);
			Same(LineNo, "loadoutEffects", Fx(LoadoutEffects(C, Inv, Eq)), F[7]);
		}
		else if (T == "WD") Same(LineNo, "weaponDamageMultiplier", N(WeaponDamageMultiplier(Num(F[1]))), F[2]);
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%zu sets, %d loadouts, %d checks, %d mismatches\n", C.Sets.size(), Cases, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
