// Golden test for the C++ squadmates: replays tools/gen-squad-golden.ts, recorded from the web build's real squad.ts. Each step
// starts from the web build's own squad state before it and replays the random draws it took; facing rides on atan2 / sin / cos,
// so states compare to 1e-9 and everything else exactly.
#include "Core/WFSquadCore.h"
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
using namespace wf::squad;

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
	std::string B(bool V) { return V ? "1" : "0"; }
	int Checks = 0, Mismatches = 0, Near = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	/** every number to 1e-9 (relative above 1), everything else exactly */
	void SameNumbers(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		auto Tokens = [](const std::string& X) { std::vector<std::string> Out; std::string Cur; for (char C : X) { if (C == '|' || C == ',' || C == ';' || C == '/') { Out.push_back(Cur); Out.push_back(std::string(1, C)); Cur.clear(); } else Cur += C; } Out.push_back(Cur); return Out; };
		const std::vector<std::string> G = Tokens(Got), W = Tokens(Want);
		bool bOk = G.size() == W.size(), bLoose = false;
		for (size_t I = 0; bOk && I < G.size(); ++I)
		{
			if (G[I] == W[I]) continue;
			double A = 0, Bv = 0;
			const auto Ra = std::from_chars(G[I].data(), G[I].data() + G[I].size(), A), Rb = std::from_chars(W[I].data(), W[I].data() + W[I].size(), Bv);
			if (Ra.ec == std::errc() && Rb.ec == std::errc() && std::fabs(A - Bv) <= 1e-9 * std::max(1.0, std::fabs(Bv))) { bLoose = true; continue; }
			bOk = false;
		}
		if (bLoose && bOk) ++Near;
		if (!bOk && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	std::string SquadText(const FState& S)
	{
		std::string Mates, Shots;
		for (const FMate& M : S.Mates) { if (!Mates.empty()) Mates += ";"; Mates += N(M.Id) + "," + M.Name + "," + N(M.X) + "," + N(M.Z) + "," + N(M.Yaw) + "," + N(M.Speed) + "," + N(M.Cool) + "," + N(M.Target) + "," + N(M.Firing); }
		for (const FShot& H : S.Shots) { if (!Shots.empty()) Shots += ";"; Shots += N(H.Id) + "," + N(H.FromX) + "," + N(H.FromZ) + "," + N(H.ToX) + "," + N(H.ToZ) + "," + B(H.bHit) + "," + N(H.At); }
		return B(S.bEnabled) + "/" + N(S.NextShot) + "/" + N(S.Clock) + "/" + (Mates.empty() ? None : Mates) + "/" + (Shots.empty() ? None : Shots);
	}
	FState ParseSquad(const std::string& T)
	{
		const std::vector<std::string> P = Split(T, '/');
		FState S;
		S.bEnabled = P.at(0) == "1"; S.NextShot = Num(P.at(1)); S.Clock = Num(P.at(2));
		if (P.at(3) != None)
			for (const std::string& X : Split(P[3], ';')) { const std::vector<std::string> F = Split(X, ','); S.Mates.push_back({Num(F[0]), F[1], Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6]), Num(F[7]), Num(F[8])}); }
		if (P.at(4) != None)
			for (const std::string& X : Split(P[4], ';')) { const std::vector<std::string> F = Split(X, ','); S.Shots.push_back({Num(F[0]), Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4]), F[5] == "1", Num(F[6])}); }
		return S;
	}
	FTarget ParseTarget(const std::string& T)
	{
		const std::vector<std::string> F = Split(T, ',');
		FTarget X{Num(F[0]), Num(F[1]), F[2] == "1", F[3] == "1", Num(F[4]), std::nullopt, F[6] == "1"};
		if (F[5] != None) X.MaxHp = Num(F[5]);
		return X;
	}
	std::vector<FTarget> ParseTargets(const std::string& T)
	{
		std::vector<FTarget> Out;
		if (T != None) for (const std::string& X : Split(T, ';')) Out.push_back(ParseTarget(X));
		return Out;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: SquadCoreTest <squad_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	int Steps = 0, Hits = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "CR") Same(LineNo, "createSquad", SquadText(CreateSquad(Num(F[1]), Num(F[2]), F[3] == "1")), F[4]);
		else if (T == "FS") { const FSlot S = FormationSlot(static_cast<int>(Num(F[1])), Num(F[2]), Num(F[3]), Num(F[4])); SameNumbers(LineNo, "formationSlot", N(S.X) + "," + N(S.Z), F[5]); }
		else if (T == "PT") Same(LineNo, "pickTarget", N(PickTarget(ParseTargets(F[1]), Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]))), F[6]);
		else if (T == "SD") Same(LineNo, "squadDamage", N(SquadDamage(ParseTarget(F[1]), Num(F[2]))), F[3]);
		else if (T == "ST")
		{
			++Steps;
			FState S = ParseSquad(F[1]);
			Same(LineNo, "squad round trip", SquadText(S), F[1]);
			std::vector<double> Draws;
			if (F[9] != None) for (const std::string& X : Split(F[9], ',')) Draws.push_back(Num(X));
			size_t Next = 0;
			bool bOverdrawn = false;
			FInput Input{Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6]), Num(F[7]), F[8] == "1", [&]() { if (Next >= Draws.size()) { bOverdrawn = true; return 0.5; } return Draws[Next++]; }};
			const std::vector<FHit> H = StepSquad(S, ParseTargets(F[2]), Input);
			Hits += static_cast<int>(H.size());
			std::string HitText;
			for (const FHit& X : H) { if (!HitText.empty()) HitText += ","; HitText += N(X.Index) + ";" + N(X.Damage); }
			Same(LineNo, "random draws", N(static_cast<double>(Next)) + (bOverdrawn ? "+" : ""), N(static_cast<double>(Draws.size())));
			SameNumbers(LineNo, "stepSquad", SquadText(S) + "|" + (HitText.empty() ? None : HitText), F[10]);
		}
		else { std::fprintf(stderr, "line %d: unknown record %s\n", LineNo, T.c_str()); ++Mismatches; }
	}
	std::printf("SquadCoreTest: %d squad steps (%d hits), %d checks (%d within 1e-9), %d mismatches\n", Steps, Hits, Checks, Near, Mismatches);
	return Mismatches ? 1 : 0;
}
