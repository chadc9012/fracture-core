// Golden test for the C++ nemeses: replays tools/gen-nemesis-golden.ts, recorded from the web build's real nemesis.ts. Every
// promotion, rank-up, kill, payout, ambush pick, stat block and merge must match, with the whole save after each event.
#include "Core/WFNemesisCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::nemesis;

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
	std::string Nem(const FNemesis& X)
	{
		return X.Id + "^" + X.Status + "^" + X.Name + "^" + X.Epithet + "^" + X.Profile + "^" + X.RegionId + "^" + N(X.Rank) + "^" + (X.Traits.empty() ? None : Join(X.Traits, ".")) + "^"
			+ N(X.Kills) + "^" + N(X.Returns) + "^" + N(X.CreatedAt) + "^" + N(X.LastSeenAt) + "^" + X.Grudge;
	}
	std::string List(const std::vector<FNemesis>& L)
	{
		std::vector<std::string> Xs;
		for (const FNemesis& X : L) Xs.push_back(Nem(X));
		return Xs.empty() ? None : Join(Xs, ";");
	}
	std::vector<FNemesis> ParseList(const std::string& S)
	{
		std::vector<FNemesis> Out;
		if (S == None) return Out;
		for (const std::string& E : Split(S, ';'))
		{
			const std::vector<std::string> F = Split(E, '^');
			FNemesis X;
			X.Id = F[0]; X.Status = F[1]; X.Name = F[2]; X.Epithet = F[3]; X.Profile = F[4]; X.RegionId = F[5]; X.Rank = Num(F[6]);
			if (F[7] != None) X.Traits = Split(F[7], '.');
			X.Kills = Num(F[8]); X.Returns = Num(F[9]); X.CreatedAt = Num(F[10]); X.LastSeenAt = Num(F[11]); X.Grudge = F[12];
			Out.push_back(X);
		}
		return Out;
	}
	std::string Ps(const FProgression& P)
	{
		std::string Mats;
		for (const auto& [K, V] : P.Materials) { if (!Mats.empty()) Mats += ","; Mats += K + "=" + N(V); }
		return List(P.Nemeses) + "|" + (P.EarnedRewards.empty() ? None : Join(P.EarnedRewards, ",")) + "|" + (Mats.empty() ? None : Mats) + "|" + N(P.FractureShards);
	}
	FProgression ParseP(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FProgression P;
		P.Nemeses = ParseList(F[0]);
		if (F[1] != None) P.EarnedRewards = Split(F[1], ',');
		if (F[2] != None) for (const std::string& E : Split(F[2], ',')) { const size_t Eq = E.find('='); P.Materials[E.substr(0, Eq)] = Num(E.substr(Eq + 1)); }
		P.FractureShards = Num(F[3]);
		return P;
	}
	const FNemesis* Find(const FProgression& P, const std::string& Id)
	{
		for (const FNemesis& X : P.Nemeses) if (X.Id == Id) return &X;
		return nullptr;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: NemesisCoreTest <nemesis_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FProgression P;
	int Events = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "P") { P = ParseP(F[1]); Same(LineNo, "save round trip", Ps(P), F[1]); }
		else if (T == "EK") P.EarnedRewards.push_back(F[1]);
		else if (T == "PD")
		{
			++Events;
			FKiller K;
			K.Profile = F[1] == None ? "" : F[1]; K.Zone = F[2]; K.bElite = F[3] == "1"; K.bBoss = F[4] == "1"; K.Nemesis = F[5] == None ? "" : F[5];
			const FApplied R = ApplyPlayerDeath(P, K, F[6], Num(F[7]));
			Same(LineNo, "death line", R.Line.empty() ? None : R.Line, F[8]);
			Same(LineNo, "death save", Ps(R.Progression), F[9]);
			P = R.Progression;
		}
		else if (T == "NK")
		{
			++Events;
			const FApplied R = ApplyNemesisKill(P, F[1], Num(F[2]));
			Same(LineNo, "kill line", R.Line.empty() ? None : R.Line, F[3]);
			Same(LineNo, "kill save", Ps(R.Progression), F[4]);
			P = R.Progression;
		}
		else if (T == "AD")
		{
			++Events;
			const FNemesis* Due = AmbushDue(P.Nemeses, F[1] == None ? "" : F[1], Num(F[2]), Num(F[3]), F[4] == None ? "" : F[4]);
			Same(LineNo, "ambushDue", Due ? Due->Id : None, F[5]);
		}
		else if (T == "ST")
		{
			const FNemesis* X = Find(P, F[1]);
			if (!X) { Same(LineNo, "nemesis", "missing", F[1]); continue; }
			const FStats S = NemesisStats(*X);
			const std::string W = WeakElement(*X);
			Same(LineNo, "nemesisStats", N(S.Hp) + "|" + N(S.Damage) + "|" + N(S.Scale) + "|" + (W.empty() ? None : W), F[2]);
		}
		else if (T == "WM") { const FNemesis* X = Find(P, F[1]); Same(LineNo, "weaknessMult", N(WeaknessMult(X, F[2] == None ? "" : F[2])), F[3]); }
		else if (T == "MG") Same(LineNo, "mergeNemeses", List(MergeNemeses(P.Nemeses, ParseList(F[1]))), F[2]);
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d nemesis events, %d checks, %d mismatches\n", Events, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
