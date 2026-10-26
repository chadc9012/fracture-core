// Golden test for the C++ heavy arms: replays tools/gen-arms-golden.ts, recorded from the web build's real melee-arc.ts,
// foundries.ts and launchers.ts (fired through ordnance.ts fireRound).
#include "Core/WFArmsCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::arms;

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
	int Fuzzy = 0;
	/** fields separated by |, numbers equal within 1e-9 relative: V8's Math.sin/cos and std::sin/cos may differ in the last bit */
	void Near(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		if (Got == Want) { ++Checks; return; }
		const std::vector<std::string> G = Split(Got, '|'), W = Split(Want, '|');
		bool bOk = G.size() == W.size();
		for (size_t K = 0; bOk && K < G.size(); ++K)
		{
			if (G[K] == W[K]) continue;
			const double A = Num(G[K]), B = Num(W[K]);
			bOk = std::fabs(A - B) <= 1e-9 * std::max(1.0, std::max(std::fabs(A), std::fabs(B)));
		}
		if (bOk) { ++Checks; ++Fuzzy; return; }
		Same(Line, What, Got, Want);
	}
	std::string Sw(const std::optional<FShockwave>& S) { return S ? N(S->Length) + "|" + N(S->Width) + "|" + N(S->Damage) : None; }
	const FBlade* Find(const std::string& Id) { for (const FBlade& B : Blades()) if (B.Id == Id) return &B; return nullptr; }
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: ArmsCoreTest <arms_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	size_t BladeRow = 0, LauncherRow = 0;
	int Flights = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "BL")
		{
			const FBlade* B = BladeRow < Blades().size() ? &Blades()[BladeRow] : nullptr;
			++BladeRow;
			const std::string Got = B ? B->Id + "\t" + B->Name + "\t" + B->Foundry + "\t" + B->Rarity + "\t" + B->Perk + "\t" + N(B->Damage) + "\t" + N(B->Armored) + "\t" + N(B->Reach) + "\t" + Sw(B->Shockwave) + "\t" + N(B->Deflect) : "missing";
			std::string Want;
			for (size_t K = 1; K < F.size(); ++K) { if (K > 1) Want += "\t"; Want += F[K]; }
			Same(LineNo, "blade", Got, Want);
		}
		else if (T == "AR") Same(LineNo, "inSwordArc", InSwordArc({Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4])}, {Num(F[5]), Num(F[6]), Num(F[7]), Num(F[8])}, Num(F[9])) ? "1" : "0", F[10]);
		else if (T == "SW")
		{
			const FSwing S = SwingStats(F[1] == None ? nullptr : Find(F[1]), static_cast<int>(Num(F[2])), Num(F[3]), Num(F[4]), F[5] == "1");
			Same(LineNo, "swingStats", N(S.Damage) + "|" + N(S.Reach) + "|" + Sw(S.Shockwave) + "|" + N(S.Deflect), F[6]);
		}
		else if (T == "SK") Same(LineNo, "inShockwave", InShockwave({Num(F[1]), Num(F[2]), 0}, Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6]), Num(F[7])) ? "1" : "0", F[8]);
		else if (T == "AB")
		{
			std::vector<std::string> Earned;
			if (F[1] != None) Earned = Split(F[1], ',');
			const FBlade* B = ActiveBlade(Earned, F[2] == None ? std::nullopt : std::optional<std::string>(F[2]));
			Same(LineNo, "activeBlade", B ? B->Id : None, F[3]);
		}
		else if (T == "LA")
		{
			const FLauncher* L = LauncherRow < Launchers().size() ? &Launchers()[LauncherRow] : nullptr;
			++LauncherRow;
			const std::string Got = L ? L->Id + "\t" + L->Element + "\t" + L->Fx + "\t" + (L->bGuided ? "1" : "0") + "\t" + N(L->LockCone) + "\t" + N(L->LockRange) + "\t" + L->Ordnance.Kind + "\t" + N(L->Ordnance.Speed) + "\t" + N(L->Ordnance.TurnRate) + "\t" + N(L->Ordnance.Life) + "\t" + N(L->Ordnance.SplashRadius) + "\t" + N(L->Ordnance.Proximity) : "missing";
			std::string Want;
			for (size_t K = 1; K < F.size(); ++K) { if (K > 1) Want += "\t"; Want += F[K]; }
			Same(LineNo, "launcher", Got, Want);
		}
		else if (T == "LF")
		{
			++Flights;
			const FLauncher* L = LauncherById(F[1]);
			std::vector<vweapons::FCandidate> Cands;
			if (F[8] != None) for (const std::string& C : Split(F[8], ';')) { const auto P = Split(C, ':'); Cands.push_back({Num(P[0]), Num(P[1]), P[2] == "1"}); }
			if (!L) { Same(LineNo, "launcher", "missing", F[1]); continue; }
			const FLaunch R = FireLauncher(*L, {Num(F[2]), Num(F[3]), Num(F[4])}, Num(F[5]), Num(F[6]), Num(F[7]), Cands);
			Near(LineNo, "fireLauncher", N(R.Target) + "|" + N(R.Round.X) + "|" + N(R.Round.Y) + "|" + N(R.Round.Z) + "|" + N(R.Round.Dx) + "|" + N(R.Round.Dy) + "|" + N(R.Round.Dz) + "|" + N(R.Round.Def.Speed) + "|" + N(R.Round.Def.Damage), F[9]);
		}
		else Same(LineNo, "line", T, "known");
	}
	Same(0, "blade count", std::to_string(Blades().size()), std::to_string(BladeRow));
	Same(0, "launcher count", std::to_string(Launchers().size()), std::to_string(LauncherRow));
	std::printf("%zu blades, %zu launchers, %d launches, %d checks (%d within float tolerance), %d mismatches\n", Blades().size(), Launchers().size(), Flights, Checks, Fuzzy, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
