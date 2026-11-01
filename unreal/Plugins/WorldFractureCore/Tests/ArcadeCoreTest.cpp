// Golden test for the C++ Pixel Pit cabinet: replays tools/gen-arcade-golden.ts, recorded from the web build's real arcade.ts.
// Each step starts from the web build's own run before it; everything compares exactly.
#include "Core/WFVenueCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <limits>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::venue;

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
		if (S == "NaN") return std::numeric_limits<double>::quiet_NaN();
		double V = 0;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		if (R.ec != std::errc() || R.ptr != S.data() + S.size()) throw std::runtime_error("bad number: " + S);
		return V;
	}
	std::string N(double V) { return js::NumberToString(V); }
	std::string B(bool V) { return V ? "1" : "0"; }
	int Checks = 0, Mismatches = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	std::string Join(const std::vector<std::string>& Xs, const char* Sep)
	{
		std::string S;
		for (size_t I = 0; I < Xs.size(); ++I) { if (I) S += Sep; S += Xs[I]; }
		return S;
	}
	std::string Kv(const std::map<std::string, double>& M)
	{
		std::string S;
		for (const auto& [K, V] : M) { if (!S.empty()) S += ","; S += K + "=" + N(V); }
		return S.empty() ? None : S;
	}
	std::string KvPairs(std::vector<std::pair<std::string, double>> M)
	{
		std::sort(M.begin(), M.end());
		std::string S;
		for (const auto& [K, V] : M) { if (!S.empty()) S += ","; S += K + "=" + N(V); }
		return S.empty() ? None : S;
	}
	std::map<std::string, double> ParseKv(const std::string& S)
	{
		std::map<std::string, double> M;
		if (S == None) return M;
		for (const std::string& E : Split(S, ',')) { const size_t Eq = E.rfind('='); M[E.substr(0, Eq)] = Num(E.substr(Eq + 1)); }
		return M;
	}
	double NumJs(const std::string& S)
	{
		if (S == "NaN") return std::numeric_limits<double>::quiet_NaN();
		if (S == "Infinity") return std::numeric_limits<double>::infinity();
		if (S == "-Infinity") return -std::numeric_limits<double>::infinity();
		return Num(S);
	}
	std::string Run(const FArcadeRun& S)
	{
		std::vector<std::string> T;
		for (double X : S.Targets) T.push_back(N(X));
		return Join({S.Venue, S.Day, N(S.Round), N(S.RoundStartsAt), T.empty() ? None : Join(T, ";"), N(S.Next), N(S.Hits), N(S.Misses), N(S.Score), B(S.bPressedThisRound), B(S.bDone), B(S.bWon), S.EndedBy.empty() ? None : S.EndedBy,
			S.Last ? S.Last->Kind + ";" + N(S.Last->Points) + ";" + N(S.Last->At) : None}, ",");
	}
	FArcadeRun ParseRun(const std::string& Text)
	{
		const std::vector<std::string> F = Split(Text, ',');
		FArcadeRun S;
		S.Venue = F[0]; S.Day = F[1]; S.Round = Num(F[2]); S.RoundStartsAt = Num(F[3]);
		if (F[4] != None) for (const std::string& X : Split(F[4], ';')) S.Targets.push_back(Num(X));
		S.Next = Num(F[5]); S.Hits = Num(F[6]); S.Misses = Num(F[7]); S.Score = Num(F[8]);
		S.bPressedThisRound = F[9] == "1"; S.bDone = F[10] == "1"; S.bWon = F[11] == "1"; S.EndedBy = F[12] == None ? "" : F[12];
		if (F[13] != None) { const std::vector<std::string> L = Split(F[13], ';'); S.Last = FArcadeEvent{L[0], Num(L[1]), Num(L[2])}; }
		return S;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: ArcadeCoreTest <arcade_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);
	FProgression P;
	int Runs = 0, Taps = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "TF") Same(LineNo, "toleranceFor", N(ToleranceFor(Num(F[1]))), F[2]);
		else if (T == "RT")
		{
			std::vector<std::string> Xs;
			for (double X : RoundTargets(F[1], F[2], Num(F[3]))) Xs.push_back(N(X));
			Same(LineNo, "roundTargets", Join(Xs, ";"), F[4]);
		}
		else if (T == "SA") { ++Runs; Same(LineNo, "startArcade", Run(StartArcade(F[1], F[2], Num(F[3]))), F[4]); }
		else if (T == "TP") { ++Taps; const FArcadeRun S = ParseRun(F[1]); Same(LineNo, "run round trip", Run(S), F[1]); Same(LineNo, "arcadeTap", Run(ArcadeTap(S, NumJs(F[2]))), F[3]); }
		else if (T == "TK") Same(LineNo, "arcadeTick", Run(ArcadeTick(ParseRun(F[1]), NumJs(F[2]))), F[3]);
		else if (T == "SG") Same(LineNo, "arcadeSignal", ArcadeSignal(ParseRun(F[1]), NumJs(F[2])), F[3]);
		else if (T == "P") { P = FProgression{}; if (F[1] != None) P.EarnedRewards = Split(F[1], ','); }
		else if (T == "RA") { RecordArcade(P, F[1], Num(F[2])); Same(LineNo, "recordArcade", P.EarnedRewards.empty() ? None : Join(P.EarnedRewards, ","), F[3]); }
		else if (T == "AB") Same(LineNo, "arcadeBest", N(ArcadeBest(P, F[1])), F[2]);
		else { std::fprintf(stderr, "line %d: unknown record %s\n", LineNo, T.c_str()); ++Mismatches; }
	}
	std::printf("ArcadeCoreTest: %d runs, %d taps, %d checks, %d mismatches\n", Runs, Taps, Checks, Mismatches);
	return Mismatches ? 1 : 0;
}
