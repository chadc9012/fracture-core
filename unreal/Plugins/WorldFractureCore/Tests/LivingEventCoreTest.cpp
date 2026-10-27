// Golden test for the C++ city world events: replays tools/gen-livingevent-golden.ts, recorded from the web build's real
// living-events.ts. Every event pick, director step (warnings, activation, holds, clears, abandonment, the gaps between
// events) and resolution on a save must match.
#include "Core/WFLivingEventCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <deque>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::livingevent;

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
	int Checks = 0, Mismatches = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	std::string Ev(const std::optional<FEvent>& E)
	{
		if (!E) return None;
		return E->Id + "^" + E->Kind + "^" + E->City + "^" + E->District + "^" + N(E->X) + "^" + N(E->Z) + "^" + E->Phase + "^" + N(E->Timer) + "^" + N(E->Hold) + "^" + B(E->bSpawned) + "^" + N(E->Wave) + "^" + B(E->bCleared);
	}
	FEvent ParseEv(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '^');
		FEvent E;
		E.Id = F[0]; E.Kind = F[1]; E.City = F[2]; E.District = F[3]; E.X = Num(F[4]); E.Z = Num(F[5]); E.Phase = F[6]; E.Timer = Num(F[7]); E.Hold = Num(F[8]); E.bSpawned = F[9] == "1"; E.Wave = Num(F[10]); E.bCleared = F[11] == "1";
		return E;
	}
	std::string Dir(const FDirector& D) { return N(D.Next) + ";" + Ev(D.Current) + ";" + N(D.Serial); }
	std::vector<std::string> List(const std::string& S) { return S == None ? std::vector<std::string>{} : Split(S, ','); }
	std::string Kv(const std::map<std::string, double>& M)
	{
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
	std::string Ps(const FProgression& P)
	{
		std::string D, C, E;
		for (const auto& [K, V] : P.Living.Districts) { if (!D.empty()) D += ","; D += K + "=" + N(V.SecuredAt) + ":" + N(V.FallenAt); }
		for (const auto& [K, V] : P.Living.Contracts) { if (!C.empty()) C += ","; C += K + "=" + N(V.Progress) + ":" + N(V.AcceptedAt); }
		for (const std::string& X : P.EarnedRewards) { if (!E.empty()) E += ","; E += X; }
		return Kv(P.Living.Gain) + "|" + Kv(P.Living.Loss) + "|" + (D.empty() ? None : D) + "|" + (C.empty() ? None : C) + "|" + Kv(P.Materials) + "|" + (E.empty() ? None : E) + "|" + N(P.FractureShards);
	}
	FProgression ParseP(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FProgression P;
		P.Living.Gain = ParseKv(F[0]); P.Living.Loss = ParseKv(F[1]);
		for (const std::string& X : List(F[2])) { const size_t Eq = X.find('='); const std::vector<std::string> T = Split(X.substr(Eq + 1), ':'); P.Living.Districts[X.substr(0, Eq)] = {Num(T[0]), Num(T[1])}; }
		for (const std::string& X : List(F[3])) { const size_t Eq = X.find('='); const std::vector<std::string> T = Split(X.substr(Eq + 1), ':'); P.Living.Contracts[X.substr(0, Eq)] = {Num(T[0]), Num(T[1])}; }
		P.Materials = ParseKv(F[4]);
		P.EarnedRewards = List(F[5]);
		P.FractureShards = Num(F[6]);
		return P;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: LivingEventCoreTest <livingevent_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FDirector D;
	FProgression P;
	size_t DistrictI = 0;
	int Steps = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		auto Draws = [&](const std::string& S, std::deque<double>& Q) { for (const std::string& X : List(S)) Q.push_back(Num(X)); };
		auto Rnd = [&LineNo](std::deque<double>& Q) { return [&Q, LineNo]() { if (Q.empty()) { Same(LineNo, "rand", "extra draw", "none"); return 0.0; } const double V = Q.front(); Q.pop_front(); return V; }; };
		if (T == "RU")
		{
			const FRule& R = RuleOf(F[1]);
			std::string M;
			for (const auto& [K, V] : R.WinMaterials) { if (!M.empty()) M += ","; M += K + "=" + N(V); }
			Same(LineNo, "rule", R.Title + "^" + R.Brief + "^" + N(R.Warn) + "^" + N(R.Limit) + "^" + N(R.WinRep) + "^" + M + "^" + N(R.WinShards) + "^" + N(R.FailRep) + "^" + B(R.bDistrictStakes), F[2]);
		}
		else if (T == "DI") { const FDistrict& X = Districts().at(DistrictI++); Same(LineNo, "district", X.Id + "^" + X.City + "^" + X.Name + "^" + N(X.X) + "^" + N(X.Z) + "^" + X.Faction, F[1]); }
		else if (T == "PK")
		{
			std::deque<double> Q;
			Draws(F[5], Q);
			const FEvent E = PickEvent(F[1], Rnd(Q), List(F[2]), Num(F[3]), Num(F[4]));
			if (!Q.empty()) Same(LineNo, "rand", "unused draws", "all used");
			Same(LineNo, "pickEvent", Ev(E), F[6]);
		}
		else if (T == "D") { D = FDirector{}; Same(LineNo, "createLivingDirector", Dir(D), F[1]); }
		else if (T == "SE") { D.Current = ParseEv(F[1]); D.Next = Num(F[2]); D.Serial = Num(F[3]); }
		else if (T == "SP") { if (D.Current) { D.Current->bSpawned = true; D.Current->Wave = 10; } }
		else if (T == "ST")
		{
			++Steps;
			std::deque<double> Q;
			Draws(F[11], Q);
			FInput In;
			In.Dt = Num(F[1]); In.NowMs = Num(F[2]); In.Px = Num(F[3]); In.Pz = Num(F[4]); In.bAlive = F[5] == "1"; In.City = F[6] == None ? "" : F[6]; In.bBlocked = F[7] == "1";
			In.TagAlive = Num(F[8]); In.PlayerKills = Num(F[9]); In.Fallen = List(F[10]); In.Rnd = Rnd(Q);
			const FStep S = StepDirector(D, In);
			if (!Q.empty()) Same(LineNo, "rand", "unused draws", "all used");
			Same(LineNo, "stepLivingDirector", Dir(S.Director) + "|" + Ev(S.Started) + "|" + Ev(S.Activated) + "|" + (S.Resolved ? Ev(S.Resolved->Event) + "@" + S.Resolved->Outcome : None), F[12]);
			D = S.Director;
		}
		else if (T == "P") { P = ParseP(F[1]); Same(LineNo, "save round trip", Ps(P), F[1]); }
		else if (T == "RV")
		{
			const std::string M = ResolveEvent(P, ParseEv(F[1]), F[2], Num(F[3]));
			Same(LineNo, "resolveLivingEvent", (M.empty() ? None : M) + "|" + Ps(P), F[4]);
		}
		else if (T == "FD")
		{
			std::string S;
			for (const std::string& X : FallenDistricts(P, Num(F[1]))) { if (!S.empty()) S += ","; S += X; }
			Same(LineNo, "fallenDistricts", S.empty() ? None : S, F[2]);
		}
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d director steps, %d checks, %d mismatches\n", Steps, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
