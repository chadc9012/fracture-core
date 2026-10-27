// Golden test for the C++ city NPCs: replays tools/gen-living-golden.ts, recorded from the web build's real living-npcs.ts,
// npc-routine.ts and living-world.ts. Every talk-panel offer, action (contracts, intel, pledge, amends, commendations), opening
// line, contract progress, survey and stash, marker, standing and NPC routine must match.
#include "Core/WFLivingNpcCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::living;

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
	std::string Liv(const FProgression::FLiving& L)
	{
		std::vector<std::string> D, C;
		for (const auto& [K, V] : L.Districts) D.push_back(K + "=" + N(V.SecuredAt) + ":" + N(V.FallenAt));
		for (const auto& [K, V] : L.Contracts) C.push_back(K + "=" + N(V.Progress) + ":" + N(V.AcceptedAt));
		return Kv(L.Gain) + ";" + Kv(L.Loss) + ";" + (D.empty() ? None : Join(D, ",")) + ";" + (C.empty() ? None : Join(C, ",")) + ";" + (L.Intel.empty() ? None : Join(L.Intel, ","));
	}
	std::string Ps(const FProgression& P)
	{
		std::vector<std::string> Ch;
		for (const auto& [K, V] : P.Story.Choices) Ch.push_back(K + "=" + V);
		return Join({Liv(P.Living), Kv(P.Materials), P.EarnedRewards.empty() ? None : Join(P.EarnedRewards, ","), N(P.FractureShards), Ch.empty() ? None : Join(Ch, ","), P.Story.Flags.empty() ? None : Join(P.Story.Flags, ","),
			N(P.Xp), N(P.Level), N(P.CalibrationTokens), N(P.NovaLevel), P.NovaUnlocks.empty() ? None : Join(P.NovaUnlocks, ",")}, "|");
	}
	FProgression ParseP(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FProgression P;
		const std::vector<std::string> L = Split(F[0], ';');
		P.Living.Gain = ParseKv(L[0]); P.Living.Loss = ParseKv(L[1]);
		if (L[2] != None) for (const std::string& E : Split(L[2], ',')) { const size_t Eq = E.find('='); const std::vector<std::string> T = Split(E.substr(Eq + 1), ':'); P.Living.Districts[E.substr(0, Eq)] = {Num(T[0]), Num(T[1])}; }
		if (L[3] != None) for (const std::string& E : Split(L[3], ',')) { const size_t Eq = E.find('='); const std::vector<std::string> T = Split(E.substr(Eq + 1), ':'); P.Living.Contracts[E.substr(0, Eq)] = {Num(T[0]), Num(T[1])}; }
		if (L[4] != None) P.Living.Intel = Split(L[4], ',');
		P.Materials = ParseKv(F[1]);
		if (F[2] != None) P.EarnedRewards = Split(F[2], ',');
		P.FractureShards = Num(F[3]);
		if (F[4] != None) for (const std::string& E : Split(F[4], ',')) { const size_t Eq = E.find('='); P.Story.Choices[E.substr(0, Eq)] = E.substr(Eq + 1); }
		if (F[5] != None) P.Story.Flags = Split(F[5], ',');
		P.Xp = Num(F[6]); P.Level = Num(F[7]); P.CalibrationTokens = Num(F[8]); P.NovaLevel = Num(F[9]);
		if (F[10] != None) P.NovaUnlocks = Split(F[10], ',');
		return P;
	}
	std::optional<double> Hour(const std::string& S) { if (S == None) return std::nullopt; return Num(S); }
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: LivingNpcCoreTest <livingnpc_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FProgression P;
	int Actions = 0;
	size_t NpcI = 0, CoI = 0, InI = 0, CyI = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "CY") { const FCity& C = Cities().at(CyI++); Same(LineNo, "city", Join({C.Id, C.Name, N(C.X), N(C.Z), N(C.Radius)}, "^"), F[1]); }
		else if (T == "NPC")
		{
			const FNpc& X = Npcs().at(NpcI++);
			Same(LineNo, "npc", Join({X.Id, X.Name, X.Title, X.City, X.Faction, X.Role, N(X.Lx), N(X.Lz), X.Body, X.Greeting[0], X.Greeting[1], X.Greeting[2], X.Greeting[3], X.Greeting[4]}, "^"), F[1]);
		}
		else if (T == "CO")
		{
			const FContract& C = Contracts().at(CoI++);
			Same(LineNo, "contract", Join({C.Id, C.Giver, C.Faction, C.City, C.Kind, C.Title, C.Brief, N(C.Amount), C.Material, C.Lx ? N(*C.Lx) : None, C.Lz ? N(*C.Lz) : None, C.MinTier, N(C.RewardRep), KvPairs(C.RewardMaterials), N(C.RewardXp)}, "^"), F[1]);
		}
		else if (T == "IN")
		{
			const FIntel& X = Intel().at(InI++);
			Same(LineNo, "intel", Join({X.Id, X.Seller, X.City, X.Title, X.Rumor, X.CostMaterial, N(X.CostAmount), N(X.Lx), N(X.Lz), KvPairs(X.Reward), N(X.Shards)}, "^"), F[1]);
		}
		else if (T == "P") { P = ParseP(F[1]); Same(LineNo, "save round trip", Ps(P), F[1]); }
		else if (T == "NA")
		{
			std::vector<std::string> A;
			for (const FAction& X : NpcActions(P, *NpcById(F[1]))) A.push_back(Join({X.Id, X.Label, X.Detail, B(X.bEnabled), X.Reason.empty() ? None : X.Reason}, "^"));
			Same(LineNo, "npcActions", A.empty() ? None : Join(A, ";"), F[2]);
		}
		else if (T == "PA")
		{
			++Actions;
			// the recorder sometimes asks a nobody; the NPC id is then not the one in column 1
			const std::vector<std::string> W = Split(F[4], '|');
			const bool bNobody = W[1] == "Nobody here";
			const FResult R = PerformNpcAction(P, bNobody ? std::string("nobody") : F[1], F[2], Num(F[3]));
			Same(LineNo, "performNpcAction", std::string(R.bOk ? "1" : "0") + "|" + R.Message + "|" + Ps(P), F[4]);
		}
		else if (T == "NL") Same(LineNo, "npcLine", NpcLine(P, *NpcById(F[1]), "", Num(F[3])), F[4]);
		else if (T == "NE") Same(LineNo, "npcLine event", NpcLine(FProgression{}, *NpcById(F[1]), F[2], 0), F[3]);
		else if (T == "RK") { RecordCityKills(P, F[1], Num(F[2])); Same(LineNo, "recordCityKills", Ps(P), F[3]); }
		else if (T == "RE") { RecordEventWin(P, F[1]); Same(LineNo, "recordEventWin", Ps(P), F[2]); }
		else if (T == "RR")
		{
			std::vector<std::string> M = RecordReach(P, Num(F[1]), Num(F[2]));
			std::sort(M.begin(), M.end());
			Same(LineNo, "recordReach", (M.empty() ? None : Join(M, ";")) + "|" + Ps(P), F[3]);
		}
		else if (T == "MK")
		{
			std::vector<std::string> M;
			for (const FMarker& X : LivingMarkers(P)) M.push_back(X.Id + "^" + X.Label + "^" + N(X.X) + "^" + N(X.Z) + "^" + X.Kind);
			std::sort(M.begin(), M.end());
			Same(LineNo, "livingMarkers", M.empty() ? None : Join(M, ";"), F[1]);
		}
		else if (T == "RS")
		{
			std::vector<std::string> S;
			for (const FStanding& X : RepSummary(P, F[1])) S.push_back(X.Faction + "^" + X.Name + "^" + N(X.Rep) + "^" + X.Tier);
			Same(LineNo, "repSummary", Join(S, ";"), F[2]);
		}
		else if (T == "PO")
		{
			const FNpc& X = *NpcById(F[1]);
			const FPoint Pt = NpcPosition(X, Hour(F[2]));
			Same(LineNo, "npcPosition", N(Pt.X) + "|" + N(Pt.Z) + "|" + B(OnDuty(Hour(F[2]))), F[3]);
		}
		else if (T == "OD") Same(LineNo, "onDuty", B(OnDuty(Num(F[1]))), F[2]);
		else if (T == "NN") { const FNpc* X = NpcNear(Num(F[1]), Num(F[2]), Num(F[3])); Same(LineNo, "npcNear", X ? X->Id : None, F[4]); }
		else if (T == "CA") { const std::string C = CityAt(Num(F[1]), Num(F[2])); Same(LineNo, "cityAt", C.empty() ? None : C, F[3]); }
		else Same(LineNo, "line", T, "known");
	}
	if (NpcI != Npcs().size() || CoI != Contracts().size() || InI != Intel().size()) Same(0, "data counts", "short", "all");
	std::printf("%d talk actions, %d checks, %d mismatches\n", Actions, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
