// Golden test for the C++ activity-board objective engine: replays tools/gen-activity-golden.ts, recorded from the web build's
// real activities.ts. Every board activity and elite operation is run to completion, failure or abandonment; every tick's run
// state and marker must match, and the daily featured four and the weekly elites must rotate the same way.
#include "Core/WFActivityCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::activity;

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
	FFrac Fr(const std::string& S) { const std::vector<std::string> P = Split(S, ':'); return {Num(P[0]), Num(P[1])}; }
	std::string FrText(const FFrac& F) { return N(F.X) + ":" + N(F.Z); }
	FObjective ParseObj(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '^');
		FObjective O;
		O.Kind = F[0]; O.Label = F[1]; O.Count = Num(F[2]); O.Tier = F[3];
		if (F[4] != None) for (const std::string& P : Split(F[4], ',')) O.Points.push_back(Fr(P));
		O.TimeLimit = Num(F[5]); O.At = Fr(F[6]); O.Radius = Num(F[7]); O.Seconds = Num(F[8]); O.From = Fr(F[9]); O.To = Fr(F[10]);
		O.RaceId = F[11] == None ? "" : F[11]; O.Mode = F[12] == None ? "" : F[12]; O.Target = Num(F[13]);
		return O;
	}
	std::string ObjText(const FObjective& O)
	{
		std::string Pts;
		for (const FFrac& P : O.Points) { if (!Pts.empty()) Pts += ","; Pts += FrText(P); }
		return O.Kind + "^" + O.Label + "^" + N(O.Count) + "^" + O.Tier + "^" + (Pts.empty() ? None : Pts) + "^" + N(O.TimeLimit) + "^" + FrText(O.At) + "^" + N(O.Radius) + "^" + N(O.Seconds) + "^" + FrText(O.From) + "^" + FrText(O.To)
			+ "^" + (O.RaceId.empty() ? None : O.RaceId) + "^" + (O.Mode.empty() ? None : O.Mode) + "^" + N(O.Target);
	}
	std::string RunText(const FActivityRun& R)
	{
		std::string V;
		for (int X : R.Visited) { if (!V.empty()) V += ","; V += N(X); }
		return R.Status + "|" + (R.FailReason ? *R.FailReason : None) + "|" + N(R.Stage) + "|" + N(R.StageStartedAt) + "|" + N(R.Progress) + "|" + N(R.Need) + "|" + N(R.Cp) + "|" + (V.empty() ? None : V) + "|" + B(R.bCarrying) + "|" + N(R.Hold)
			+ "|" + N(R.KillsBase) + "|" + N(R.ElitesBase) + "|" + N(R.BossesBase) + "|" + N(R.HpMin) + "|" + N(R.Deaths0) + "|" + B(R.bDiedDuring) + "|" + B(R.bWasHurt)
			+ "|" + (R.RivalBase ? N(*R.RivalBase) : None) + "|" + (R.TheirScore ? N(*R.TheirScore) : None) + "|" + (R.PvpLine ? *R.PvpLine : None);
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: ActivityCoreTest <activity_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	std::vector<FArea> Areas;
	std::map<std::string, FArea> AreaById;
	std::vector<FBoardEntry> Board;
	std::vector<std::string> Elites;
	std::string DefId;
	FArea Area;
	std::vector<FObjective> Stages;
	FActivityRun Run;
	int Ticks = 0, Runs = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "AR") { const FArea A{F[1], F[2], Num(F[3]), Num(F[4]), Num(F[5])}; Areas.push_back(A); AreaById[A.Id] = A; }
		else if (T == "D")
		{
			DefId = F[1];
			Area = AreaById[F[3]];
			Stages.clear();
			for (const std::string& S : Split(F[4], ';')) Stages.push_back(ParseObj(S));
			std::string Back;
			for (const FObjective& O : Stages) { if (!Back.empty()) Back += ";"; Back += ObjText(O); }
			Same(LineNo, "objectives round trip", Back, F[4]);
		}
		else if (T == "N")
		{
			++Runs;
			Run = FActivityRun{};
			Run.Id = DefId; Run.StartedAt = Num(F[1]); Run.Status = "active";
			BeginObjectives(Run, Stages, Num(F[1]));
			Same(LineNo, "newRun", RunText(Run), F[2]);
		}
		else if (T == "T")
		{
			++Ticks;
			FTick Tk;
			Tk.X = Num(F[1]); Tk.Z = Num(F[2]); Tk.Dt = Num(F[3]); Tk.NowMs = Num(F[4]); Tk.Kills = Num(F[5]); Tk.Elites = Num(F[6]); Tk.Bosses = Num(F[7]); Tk.Hp = Num(F[8]); Tk.Deaths = Num(F[9]);
			if (F[10] != None) Tk.RivalKills = Num(F[10]);
			if (F[11] != None)
			{
				const std::vector<std::string> P = Split(F[11], ':');
				Tk.Pvp = FPvpTick{Num(P[0]), Num(P[1]), P[2], P[3], P[4]};
			}
			StepRun(Stages, Area, Run, Tk);
			const std::optional<FTarget> Tg = CurrentTarget(Stages, Area, Run);
			Same(LineNo, "stepRun", RunText(Run) + "|" + (Tg ? N(Tg->X) + ":" + N(Tg->Z) + ":" + Tg->Label : None), F[12]);
		}
		else if (T == "AB") { AbandonRun(Run); Same(LineNo, "abandonRun", RunText(Run), F[1]); }
		else if (T == "AP") Same(LineNo, "arena point", FrText(ArenaPoint), F[1]);
		else if (T == "CA")
		{
			Same(LineNo, "categoryOf", CategoryOf(F[1], F[2], F[3]), F[4]);
		}
		else if (T == "BE") Board.push_back({F[1], F[2], Num(F[3]), F[4] == "1"});
		else if (T == "EL") Elites.push_back(F[1]);
		else if (T == "FE")
		{
			std::string S;
			for (const std::string& Id : FeaturedFor(Num(F[1]), Board)) { if (!S.empty()) S += ","; S += Id; }
			Same(LineNo, "featuredFor", S, F.size() > 2 ? F[2] : "");
		}
		else if (T == "WE")
		{
			std::string S;
			for (const std::string& Id : WeeklyElitesFor(Num(F[1]), Elites)) { if (!S.empty()) S += ","; S += Id; }
			Same(LineNo, "weeklyElitesFor", S + "|" + WeekKeyUtc(Num(F[1])), F[2]);
		}
		else if (T == "AO") { const std::string A = AreaOfPoint(Num(F[1]), Num(F[2]), Areas); Same(LineNo, "areaOfPoint", A.empty() ? None : A, F[3]); }
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d runs, %d ticks, %d checks, %d mismatches\n", Runs, Ticks, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
