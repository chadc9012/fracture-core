// Golden test for the C++ racing and activity rules: replays races recorded from the web build's real racing.ts and
// activities.ts (tools/gen-race-golden.ts). Run states and rival positions compare numbers to 1e-9 relative (hypot,
// pow, sin); records, payouts and progression must match exactly.
#include "Core/WFJsCompat.h"
#include "Core/WFRaceCore.h"

#include <cctype>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::race;
using namespace wf::activity;

namespace
{
	const std::string None = "~";

	std::vector<std::string> Split(const std::string& S, char Sep)
	{
		std::vector<std::string> Out;
		std::string Cur;
		for (char C : S)
		{
			if (C == Sep) { Out.push_back(Cur); Cur.clear(); }
			else Cur += C;
		}
		Out.push_back(Cur);
		return Out;
	}
	std::vector<std::string> SplitNonEmpty(const std::string& S, char Sep) { return S.empty() || S == None ? std::vector<std::string>{} : Split(S, Sep); }
	double Num(const std::string& S)
	{
		double V = 0;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		if (R.ec != std::errc() || R.ptr != S.data() + S.size()) throw std::runtime_error("bad number: " + S);
		return V;
	}
	std::optional<double> OptNum(const std::string& S) { return S == None ? std::nullopt : std::optional<double>(Num(S)); }
	std::string N(double V) { return js::NumberToString(V); }
	std::string O(const std::optional<double>& V) { return V ? N(*V) : None; }

	std::string RunText(const FRun& R)
	{
		std::string Passed;
		for (size_t I = 0; I < R.Passed.size(); ++I) { if (I) Passed += ","; Passed += std::to_string(R.Passed[I]); }
		std::string Hits;
		for (size_t I = 0; I < R.HitObstacles.size(); ++I) { if (I) Hits += ","; Hits += R.HitObstacles[I]; }
		const std::string Rec = R.Recover ? N(R.Recover->X) + "/" + N(R.Recover->Z) + "/" + O(R.Recover->Depth) : None;
		std::string Res = None;
		if (R.Result)
		{
			const FResult& X = *R.Result;
			Res = std::string(X.bValid ? "1" : "0") + "/" + N(X.Time) + "/" + N(X.Penalties) + "/" + N(X.Par) + "/" + X.Medal.value_or(None) + "/" + std::to_string(X.Place) + "/" + std::to_string(X.Field) + "/" + N(X.Style) + "/" + X.Difficulty;
		}
		return R.Phase + "|" + N(R.Wall0) + "|" + N(R.Countdown) + "|" + N(R.Time) + "|" + std::to_string(R.Next) + "|" + Passed + "|" + N(R.Penalties) + "|" + N(R.Collisions) + "|" + Hits + "|" + N(R.Impact)
			+ "|" + std::to_string(R.Recoveries) + "|" + N(R.Outside) + "|" + N(R.Style) + "|" + R.Notice.value_or(None) + "|" + R.FailReason.value_or(None) + "|" + (R.bViaShortcut ? "1" : "0") + "|" + Rec + "|" + Res;
	}

	std::string Map(const std::map<std::string, double>& M)
	{
		std::string Out;
		for (const auto& [K, V] : M) { if (!Out.empty()) Out += ","; Out += K + ":" + N(V); }
		return Out;
	}
	std::string ProgText(const FProgression& P)
	{
		std::string E;
		for (size_t I = 0; I < P.EarnedRewards.size(); ++I) { if (I) E += ","; E += P.EarnedRewards[I]; }
		std::string Runs;
		for (const auto& [K, R] : P.MissionRuns) { if (!Runs.empty()) Runs += ","; Runs += K + ":" + R.Day + "/" + N(R.Count) + "/" + O(R.Last); }
		std::string Nova;
		for (size_t I = 0; I < P.NovaUnlocks.size(); ++I) { if (I) Nova += ","; Nova += P.NovaUnlocks[I]; }
		return "earned=[" + E + "];nex={" + Map(P.NexLedger) + "};runs={" + Runs + "};materials={" + Map(P.Materials) + "};xp=" + N(P.Xp) + ";level=" + N(P.Level) + ";tokens=" + N(P.CalibrationTokens) + ";nova=" + N(P.NovaLevel) + ";novaUnlocks=[" + Nova + "]";
	}

	bool FuzzyEqual(const std::string& A, const std::string& B)
	{
		if (A == B) return true;
		auto Tokens = [](const std::string& S) {
			std::vector<std::pair<bool, std::string>> Out;
			std::string Text;
			size_t I = 0;
			while (I < S.size())
			{
				const bool bPrev = I > 0 && (std::isalnum(static_cast<unsigned char>(S[I - 1])) || S[I - 1] == '_' || S[I - 1] == '-');
				const bool bStart = !bPrev && (std::isdigit(static_cast<unsigned char>(S[I])) || (S[I] == '-' && I + 1 < S.size() && std::isdigit(static_cast<unsigned char>(S[I + 1]))));
				if (bStart)
				{
					size_t J = I + 1;
					while (J < S.size() && (std::isdigit(static_cast<unsigned char>(S[J])) || S[J] == '.' || S[J] == 'e' || ((S[J] == '-' || S[J] == '+') && S[J - 1] == 'e'))) ++J;
					if (!Text.empty()) { Out.push_back({false, Text}); Text.clear(); }
					Out.push_back({true, S.substr(I, J - I)});
					I = J;
				}
				else Text += S[I++];
			}
			if (!Text.empty()) Out.push_back({false, Text});
			return Out;
		};
		const auto Ta = Tokens(A), Tb = Tokens(B);
		if (Ta.size() != Tb.size()) return false;
		for (size_t I = 0; I < Ta.size(); ++I)
		{
			if (Ta[I].first != Tb[I].first) return false;
			if (!Ta[I].first) { if (Ta[I].second != Tb[I].second) return false; continue; }
			double X = 0, Y = 0;
			std::from_chars(Ta[I].second.data(), Ta[I].second.data() + Ta[I].second.size(), X);
			std::from_chars(Tb[I].second.data(), Tb[I].second.data() + Tb[I].second.size(), Y);
			if (!(X == Y || std::fabs(X - Y) <= 1e-9 * std::max(1.0, std::max(std::fabs(X), std::fabs(Y))))) return false;
		}
		return true;
	}

	size_t Checked = 0, Failures = 0, Fuzzy = 0;
	std::string CaseName;
	void Expect(const std::string& What, const std::string& Want, const std::string& Got, size_t Line, bool bFuzzy = false)
	{
		++Checked;
		if (Want == Got) return;
		if (bFuzzy && FuzzyEqual(Want, Got)) { ++Fuzzy; return; }
		if (++Failures <= 6) std::fprintf(stderr, "MISMATCH %s in %s (line %zu)\n  want %s\n  got  %s\n", What.c_str(), CaseName.c_str(), Line, Want.c_str(), Got.c_str());
	}
}

int main(int Argc, char** Argv)
{
	const char* Path = Argc > 1 ? Argv[1] : "race_golden.txt";
	std::ifstream In(Path);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Path); return 2; }

	FCatalog C;
	std::map<std::string, FActivityDef> Acts;
	FProgression P;
	FActivityRun ActRun;
	FRun Run;
	const FRaceDef* Race = nullptr;
	std::string Line;
	size_t LineNo = 0, Ticks = 0, Runs = 0;

	while (std::getline(In, Line))
	{
		++LineNo;
		if (Line.empty()) continue;
		const std::vector<std::string> F = Split(Line, '\t');
		const std::string& K = F[0];
		if (K == "RACE")
		{
			FRaceDef R;
			R.Id = F.at(1); R.Area = F.at(2); R.Name = F.at(3); R.Type = F.at(4); R.Mode = F.at(5); R.Par = Num(F.at(6));
			R.Rivals = static_cast<int>(Num(F.at(7))); R.Rank = static_cast<int>(Num(F.at(8))); R.Laps = static_cast<int>(Num(F.at(9)));
			if (F.at(10) != None)
			{
				const auto H = Split(F.at(10), '|');
				R.bHidden = true; R.HiddenNeed = static_cast<int>(Num(H.at(0))); R.HiddenMarkers = SplitNonEmpty(H.at(1), ',');
			}
			C.Races.push_back(R);
		}
		else if (K == "PT") C.Races.back().Points.push_back({Num(F.at(1)), Num(F.at(2)), OptNum(F.at(3)), OptNum(F.at(4)), OptNum(F.at(5))});
		else if (K == "SC") C.Races.back().Shortcuts.push_back({static_cast<int>(Num(F.at(1))), Num(F.at(2)), Num(F.at(3)), static_cast<int>(Num(F.at(4)))});
		else if (K == "OB") C.Races.back().Obstacles.push_back({F.at(1), Num(F.at(2)), Num(F.at(3)), Num(F.at(4)), static_cast<int>(Num(F.at(5)))});
		else if (K == "ACT")
		{
			FActivityDef A;
			A.Id = F.at(1); A.Kind = F.at(2); A.Faction = F.at(3); A.Period = F.at(4) == None ? "" : F.at(4);
			A.Attempts = Num(F.at(5)); A.CooldownMin = Num(F.at(6)); A.MinRep = Num(F.at(7));
			if (F.at(8) != None) A.ChallengeId = F.at(8);
			A.TimeLimitSum = Num(F.at(9));
			A.Rewards.Nex = Num(F.at(10)); A.Rewards.Xp = Num(F.at(11)); A.Rewards.Rep = Num(F.at(12)); A.Rewards.ShaderChance = Num(F.at(13));
			for (const std::string& M : SplitNonEmpty(F.at(14), ','))
			{
				const size_t Colon = M.find(':');
				A.Rewards.Materials[M.substr(0, Colon)] = Num(M.substr(Colon + 1));
			}
			if (F.at(15) != None) A.RaceRankGate = static_cast<int>(Num(F.at(15)));
			Acts[A.Id] = A;
		}
		else if (K == "CH") C.Championships.push_back({F.at(1), F.at(2), F.at(3), Split(F.at(5), ','), static_cast<int>(Num(F.at(4)))});
		else if (K == "CASE") { CaseName = F.at(1); P = FProgression{}; P.EarnedRewards.clear(); P.MissionRuns.clear(); P.NexLedger.clear(); P.Materials.clear(); ++Runs; }
		else if (K == "PER") P.EarnedRewards.push_back(F.at(1));
		else if (K == "PRUN")
		{
			FProgression::FRunRecord R;
			R.Day = F.at(2); R.Count = Num(F.at(3)); R.Last = OptNum(F.at(4));
			P.MissionRuns[F.at(1)] = R;
		}
		else if (K == "PNEX") P.NexLedger[F.at(1)] = Num(F.at(2));
		else if (K == "PX") { P.Xp = Num(F.at(1)); P.Level = Num(F.at(2)); P.CalibrationTokens = Num(F.at(3)); P.NovaLevel = Num(F.at(4)); }
		else if (K == "START")
		{
			Race = C.Find(F.at(1));
			const FActivityDef& A = Acts.at(F.at(1));
			const double Now = Num(F.at(2));
			const FState S = ActivityState(C, P, A, Now);
			std::string Error;
			const bool bOk = StartActivity(C, P, A, Now, F.at(3), ActRun, Error);
			if (!bOk) { ActRun = FActivityRun{}; ActRun.Id = A.Id; ActRun.StartedAt = Now; ActRun.Difficulty = F.at(3); }
			std::getline(In, Line); ++LineNo;
			Expect("start", Split(Line, '\t').at(1), std::string(bOk ? "1" : "0") + "|" + (bOk ? None : Error) + "|" + N(S.AttemptsLeft) + "|" + N(S.CooldownLeftMs), LineNo);
			Run = NewRaceRun(*Race, F.at(3), Now);
		}
		else if (K == "ASTART")
		{
			const FActivityDef& A = Acts.at(F.at(1));
			const double Now = Num(F.at(2));
			const FState S = ActivityState(C, P, A, Now);
			std::string Error;
			const bool bOk = StartActivity(C, P, A, Now, std::nullopt, ActRun, Error);
			if (!bOk) { ActRun = FActivityRun{}; ActRun.Id = A.Id; ActRun.StartedAt = Now; }
			std::getline(In, Line); ++LineNo;
			Expect("start", Split(Line, '\t').at(1), std::string(bOk ? "1" : "0") + "|" + (bOk ? None : Error) + "|" + N(S.AttemptsLeft) + "|" + N(S.CooldownLeftMs), LineNo);
		}
		else if (K == "RK") Expect("rank", F.at(1), std::to_string(RankIndex(C, P)) + "|" + N(RacingScore(C, P)) + "|" + std::to_string(ChampionshipsWon(C, P)), LineNo);
		else if (K == "ARUN") { ActRun.Status = F.at(1); ActRun.bWasHurt = F.at(2) == "1"; ActRun.bDiedDuring = F.at(3) == "1"; }
		else if (K == "L") Expect("progression", F.at(1), ProgText(P), LineNo);
		else if (K == "RT")
		{
			std::string Got;
			for (const double T : RivalTimes(*Race, F.at(1))) { if (!Got.empty()) Got += ","; Got += N(T); }
			Expect("rivalTimes", F.at(2), Got, LineNo);
		}
		else if (K == "TICK")
		{
			FTick T;
			T.X = Num(F.at(1)); T.Z = Num(F.at(2)); T.Dt = Num(F.at(3)); T.Now = Num(F.at(4)); T.Mode = F.at(5); T.Y = OptNum(F.at(6));
			T.bVehicleDisabled = F.at(7) == "1"; T.bFell = F.at(8) == "1"; T.Collisions = Num(F.at(9)); T.Style = Num(F.at(10));
			TickRace(*Race, Run, T);
			++Ticks;
		}
		else if (K == "X") Expect("race state", F.at(1), RunText(Run), LineNo, true);
		else if (K == "RECOVERED") Run.Recover.reset();
		else if (K == "RP")
		{
			int Place = 0, Field = 0;
			LivePlace(*Race, Run, Num(F.at(1)), Num(F.at(2)), Place, Field);
			std::string Got = std::to_string(Place) + "/" + std::to_string(Field) + "|";
			bool bFirst = true;
			for (const FRivalPos& R : RivalPositions(*Race, Run.Difficulty, Run.Time))
			{
				if (!bFirst) Got += ";";
				bFirst = false;
				Got += N(R.X) + "/" + N(R.Z) + "/" + O(R.Depth) + "/" + N(R.Progress);
			}
			Expect("rivals", F.at(3), Got, LineNo, true);
		}
		else if (K == "APPLY")
		{
			ActRun.Race = Run;
			if (Run.Phase == "finished" && Run.Result && Run.Result->bValid) ActRun.Status = "complete";
			FRaceReward Rw;
			std::string Error;
			const bool bOk = ApplyRaceResult(C, P, F.at(1), Num(F.at(2)), Num(F.at(3)), Run, Rw, Error);
			std::string Got = bOk ? "1|" + N(Rw.NexBonus) + "|" + (Rw.bPersonalBest ? "1" : "0") + "|" + Rw.Medal.value_or(None) + "|" + (Rw.bNewMedal ? "1" : "0") + "|" + O(Rw.ChampionshipPoints) + "|" + (Rw.bChampionshipDone ? "1" : "0") + "|" + Rw.RankUp.value_or(None) + "|" : "0|" + Error;
			if (bOk) for (size_t I = 0; I < Rw.RivalsFirstBeaten.size(); ++I) { if (I) Got += ","; Got += Rw.RivalsFirstBeaten[I]; }
			std::getline(In, Line); ++LineNo;
			Expect("applyRaceResult", Split(Line, '\t').at(1), Got, LineNo);
		}
		else if (K == "DONE")
		{
			FPayout Pay;
			std::string Error;
			const bool bOk = CompleteActivity(P, Acts.at(F.at(1)), ActRun, Num(F.at(2)), F.at(3) == "1", Pay, Error);
			std::string Got = bOk ? "1|" + N(Pay.Nex) + "|" + N(Pay.Xp) + "|" + N(Pay.Rep) + "|" + Map(Pay.Materials) + "|" + (Pay.bBonus ? "1" : "0") : "0|" + Error;
			std::getline(In, Line); ++LineNo;
			Expect("completeActivity", Split(Line, '\t').at(1), Got, LineNo);
		}
		else if (K == "STATE")
		{
			const FState S = ActivityState(C, P, Acts.at(F.at(1)), Num(F.at(2)));
			Expect("activityState", F.at(3), std::string(S.bAvailable ? "1" : "0") + "|" + S.Reason.value_or(None) + "|" + N(S.AttemptsLeft) + "|" + N(S.CooldownLeftMs), LineNo);
		}
		else throw std::runtime_error("unknown line kind: " + K);
	}
	std::printf("%zu races, %zu runs, %zu ticks, %zu checks (%zu within float tolerance), %zu mismatches\n", C.Races.size(), Runs, Ticks, Checked, Fuzzy, Failures);
	return Failures == 0 && Ticks > 0 ? 0 : 1;
}
