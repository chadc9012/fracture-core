// Golden test for the C++ strikes, difficulty ladder, encounter engine and World Boss raids: replays tools/gen-strike-golden.ts,
// recorded from the web build's real raid-stages.ts, difficulty-ladder.ts, strikes.ts and world-boss.ts. Every authored strike,
// every tier scaling (hazard tuning included), every run step, claim, payout and raid must match. The raid-site positions ride
// on sin / cos and compare to 1e-9.
#include "Core/WFStrikeCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::strike;

namespace
{
	const std::string None = "~";
	const char Fs = '\x1f', Ss = '\x1e', Is = '\x1d', Js = '\x1c';
	std::vector<std::string> Split(const std::string& S, char Sep)
	{
		std::vector<std::string> Out;
		std::string Cur;
		for (char C : S) { if (C == Sep) { Out.push_back(Cur); Cur.clear(); } else Cur += C; }
		Out.push_back(Cur);
		return Out;
	}
	std::vector<std::string> SplitList(const std::string& S, char Sep) { return S.empty() ? std::vector<std::string>{} : Split(S, Sep); }
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
	std::string Printable(std::string S) { for (char& C : S) if (C >= 0x1c && C <= 0x1f) C = static_cast<char>("{}[]"[C - 0x1c]); return S; }
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Printable(Got).c_str(), Printable(Want).c_str());
	}
	std::string Join(const std::vector<std::string>& Xs, char Sep)
	{
		std::string S;
		for (size_t I = 0; I < Xs.size(); ++I) { if (I) S += Sep; S += Xs[I]; }
		return S;
	}
	std::string JoinS(const std::vector<std::string>& Xs, const char* Sep)
	{
		std::string S;
		for (size_t I = 0; I < Xs.size(); ++I) { if (I) S += Sep; S += Xs[I]; }
		return S;
	}

	std::string StageText(const FStage& S)
	{
		std::vector<std::string> Phases, Routes;
		for (const FBossPhase& P : S.BossPhases) Phases.push_back(Join({P.Name, N(P.Threshold), P.Mechanic, P.Counter}, Js));
		for (const FRoute& R : S.Routes) Routes.push_back(Join({R.Id, R.Name, R.Tradeoff}, Js));
		return Join({S.Id, S.Name, S.Type, S.Objective, N(S.Target), B(S.bCheckpoint), S.HazardLabel, S.HazardPerStep ? N(*S.HazardPerStep) : None,
			Join(Phases, Is), Join(Routes, Is), Join(S.Enemies, Js), S.Reward}, Fs);
	}
	std::string DefText(const FDefinition& D)
	{
		std::vector<std::string> Parts{Join({D.Id, D.Name, D.Activity, N(D.MaxLives), B(D.bNoCheckpointRelief), B(D.bBlackout), D.DamageMult ? N(*D.DamageMult) : None}, Fs)};
		for (const FStage& S : D.Stages) Parts.push_back(StageText(S));
		return Join(Parts, Ss);
	}
	std::string Flavour(const FDefinition& D)
	{
		return Join({D.Region, D.Identity, D.Hazard, D.Boss, D.Duration, D.Signature.Name, D.Signature.Type, D.Signature.Perk, Join(D.Signature.RepeatTraits, Js)}, Fs);
	}
	FDefinition ParseDef(const std::string& Text)
	{
		const std::vector<std::string> Parts = Split(Text, Ss);
		const std::vector<std::string> H = Split(Parts[0], Fs);
		FDefinition D;
		D.Id = H[0]; D.Name = H[1]; D.Activity = H[2]; D.MaxLives = Num(H[3]); D.bNoCheckpointRelief = H[4] == "1"; D.bBlackout = H[5] == "1";
		if (H[6] != None) D.DamageMult = Num(H[6]);
		for (size_t I = 1; I < Parts.size(); ++I)
		{
			const std::vector<std::string> F = Split(Parts[I], Fs);
			FStage S;
			S.Id = F[0]; S.Name = F[1]; S.Type = F[2]; S.Objective = F[3]; S.Target = Num(F[4]); S.bCheckpoint = F[5] == "1"; S.HazardLabel = F[6];
			if (F[7] != None) S.HazardPerStep = Num(F[7]);
			for (const std::string& P : SplitList(F[8], Is)) { const std::vector<std::string> X = Split(P, Js); S.BossPhases.push_back({X[0], Num(X[1]), X[2], X[3]}); }
			for (const std::string& R : SplitList(F[9], Is)) { const std::vector<std::string> X = Split(R, Js); S.Routes.push_back({X[0], X[1], X[2]}); }
			S.Enemies = SplitList(F[10], Js);
			S.Reward = F[11];
			D.Stages.push_back(S);
		}
		return D;
	}
	std::string RunText(const FRun& R)
	{
		std::vector<std::string> Perf;
		for (const FStagePerformance& P : R.StagePerformance) Perf.push_back(Join({P.Name, N(P.Objectives), N(P.Hazard)}, Js));
		return Join({R.Status, N(R.StageIndex), N(R.Progress), N(R.Lives), N(R.Hazard), R.Message, R.SelectedRoute ? *R.SelectedRoute : None, N(R.BossPhase), N(R.LivesUsed),
			Perf.empty() ? None : Join(Perf, Is), N(R.Damage), N(R.Support)}, Fs);
	}
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
		return JoinS({P.EarnedRewards.empty() ? None : Join(P.EarnedRewards, ','), Kv(P.NexLedger), P.PocketClass.empty() ? None : P.PocketClass, N(P.FractureShards), N(P.Xp), N(P.Level), N(P.CalibrationTokens),
			N(P.NovaLevel), P.NovaUnlocks.empty() ? None : Join(P.NovaUnlocks, ','), Kv(P.DungeonClears), Kv(P.Materials)}, "|");
	}
	FProgression ParseP(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FProgression P;
		if (F[0] != None) P.EarnedRewards = Split(F[0], ',');
		P.NexLedger = ParseKv(F[1]);
		P.PocketClass = F[2] == None ? "" : F[2];
		P.FractureShards = Num(F[3]); P.Xp = Num(F[4]); P.Level = Num(F[5]); P.CalibrationTokens = Num(F[6]); P.NovaLevel = Num(F[7]);
		if (F[8] != None) P.NovaUnlocks = Split(F[8], ',');
		P.DungeonClears = ParseKv(F[9]);
		P.Materials = ParseKv(F[10]);
		return P;
	}
	std::string RaidText(const worldboss::FRaid& R)
	{
		return Join({R.Id, R.Site.Region, R.Site.Name, R.Site.Boss, N(R.StartsAt), N(R.EndsAt), B(R.bLive)}, Fs);
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: StrikeCoreTest <strike_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FDefinition Base, Scaled;
	FRun Run;
	FProgression P;
	size_t StrikeIndex = 0;
	int Scalings = 0, Steps = 0, Claims = 0, Raids = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "SD")
		{
			if (StrikeIndex >= Strikes().size()) { Same(LineNo, "strike", "missing", F[1]); continue; }
			const FDefinition& D = Strikes()[StrikeIndex++];
			Same(LineNo, "strike data", DefText(D), F[1]);
			Same(LineNo, "strike flavour", Flavour(D), F[2]);
			if (StrikeIndex == Strikes().size() && StrikeIds().size() != Strikes().size()) Same(LineNo, "strike ids", "short", "all");
		}
		else if (T == "TR")
		{
			std::vector<std::string> Ts;
			for (const FTier& X : TiersOf(F[1])) Ts.push_back(Join({X.Id, X.Name, N(X.Rank), N(X.Peak), N(X.EnemyScale), N(X.BossHealthScale), N(X.LivesDelta), N(X.PayMult), N(X.Power), X.Blurb}, Js));
			Same(LineNo, "tiers", Join(Ts, Is), F[2]);
		}
		else if (T == "RC")
		{
			std::vector<std::string> Cs;
			for (const FModifier& M : RaidChallenges()) Cs.push_back(Join({M.Id, M.Name, M.Effect}, Js));
			Same(LineNo, "raid challenges", Join(Cs, Is), F[1]);
		}
		else if (T == "D") { Base = ParseDef(F[1]); Same(LineNo, "definition round trip", DefText(Base), F[1]); }
		else if (T == "SC")
		{
			++Scalings;
			Scaled = ScaleEncounter(Base, TierById(F[1], F[2]), F[3] == None ? "" : F[3]);
			Same(LineNo, "scaleEncounter", DefText(Scaled) + "\t" + N(FlawlessPeak(Scaled)), F[4] + "\t" + F[5]);
			Scaled = ParseDef(F[4]); // runs replay on the web build's scaled definition, so one tuning slip does not cascade
		}
		else if (T == "RN") { Run = CreateRun(Scaled); Same(LineNo, "createEncounterRun", RunText(Run), F[1]); }
		else if (T == "GO")
		{
			Run.Status = "ACTIVE";
			Run.Message = "Entered " + (static_cast<size_t>(Run.StageIndex) < Scaled.Stages.size() ? Scaled.Stages[static_cast<size_t>(Run.StageIndex)].Name : Scaled.Name) + ".";
			Same(LineNo, "launch", RunText(Run), F[1]);
		}
		else if (T == "A") { ++Steps; Run = Advance(Scaled, Run); Same(LineNo, "advanceEncounter", RunText(Run), F[1]); }
		else if (T == "L") { ++Steps; Run = LoseLife(Scaled, Run); Same(LineNo, "loseEncounterLife", RunText(Run), F[1]); }
		else if (T == "C") { ++Steps; Run = ChooseRoute(Run, F[1]); Same(LineNo, "chooseEncounterRoute", RunText(Run), F[2]); }
		else if (T == "P") { P = ParseP(F[1]); Same(LineNo, "save round trip", Ps(P), F[1]); }
		else if (T == "OP") P.PocketClass = F[1];
		else if (T == "EK") P.EarnedRewards.push_back(F[1]);
		else if (T == "DC") P.DungeonClears[F[1]] = Num(F[2]);
		else if (T == "CL")
		{
			++Claims;
			const FClaim C = ClaimStrikeClear(P, F[1], F[2], Num(F[3]));
			Same(LineNo, "claimStrikeClear", Join({N(C.Paid), B(C.bFirst), Ps(C.Progression)}, Fs), F[4]);
			P = C.Progression;
		}
		else if (T == "PO")
		{
			const std::optional<FStrikePayout> Po = StrikePayout(P, F[1], F[2], Num(F[3]));
			Same(LineNo, "strikePayout", Po ? Join({Po->Key, N(Po->Nex), B(Po->bFirst)}, Fs) : None, F[4]);
		}
		else if (T == "CC") Same(LineNo, "canClaimStrike", B(CanClaimStrike(P, F[1], F[2], Num(F[3]))), F[4]);
		else if (T == "TU") Same(LineNo, "strikeTierUnlocked", B(StrikeTierUnlocked(P, F[1])), F[2]);
		else if (T == "HU") Same(LineNo, "highestUnlocked", HighestUnlocked(P, F[1], Split(F[2], ',')).Id, F[3]);
		else if (T == "WK")
		{
			const double Now = Num(F[1]);
			std::vector<std::string> W{WeeklyStrike(Now).Id, WeeklyRaidChallenge(Now).Id};
			for (const FTier& X : TiersOf("strike")) W.push_back(N(WeeklyMult("strike", X, true, false)));
			W.push_back(N(WeeklyMult("raid", TierById("raid", "heroic"), true, true)));
			Same(LineNo, "weekly", Join(W, Fs), F[2]);
		}
		else if (T == "WB")
		{
			++Raids;
			const double Now = Num(F[1]);
			const worldboss::FRaids R = worldboss::WorldBossAt(Now);
			Same(LineNo, "worldBossAt", Join({RaidText(R.Current), RaidText(R.Next), worldboss::WorldBossBanner(Now)}, Ss), F[2]);
		}
		else if (T == "PW")
		{
			const bool bPaid = worldboss::PayWorldBoss(P, F[1]);
			Same(LineNo, "payWorldBoss", Join({B(bPaid), Ps(P)}, Fs), F[2]);
		}
		else if (T == "RS")
		{
			++Checks;
			const worldboss::FRaidSite& Site = worldboss::RaidSites()[static_cast<size_t>(Num(F[1]))];
			auto Ground = [](double X, double Z) { return std::fmod(std::fabs(X), 23.0) + std::fmod(std::fabs(Z), 11.0) - 12; };
			const worldboss::FPoint At = worldboss::RaidSiteWorld(Site, Num(F[2]), Num(F[3]), Num(F[4]), Ground, Num(F[5]));
			const std::vector<std::string> W = Split(F[6], '|');
			const double Wx = Num(W[0]), Wz = Num(W[1]);
			if (N(At.X) == W[0] && N(At.Z) == W[1]) {}
			else if (std::fabs(At.X - Wx) <= 1e-9 * std::max(1.0, std::fabs(Wx)) && std::fabs(At.Z - Wz) <= 1e-9 * std::max(1.0, std::fabs(Wz))) ++Near;
			else if (++Mismatches <= 25) std::fprintf(stderr, "line %d raidSiteWorld:\n   got  %s|%s\n   want %s\n", LineNo, N(At.X).c_str(), N(At.Z).c_str(), F[6].c_str());
		}
		else Same(LineNo, "line", T, "known");
	}
	if (StrikeIndex != Strikes().size()) Same(0, "strike count", N(static_cast<double>(Strikes().size())), N(static_cast<double>(StrikeIndex)));
	std::printf("%d scalings, %d run steps, %d claims, %d raid times, %d checks (%d within float tolerance), %d mismatches\n", Scalings, Steps, Claims, Raids, Checks, Near, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
