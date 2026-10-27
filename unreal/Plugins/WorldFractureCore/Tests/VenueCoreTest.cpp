// Golden test for the C++ nightlife: replays tools/gen-venue-golden.ts, recorded from the web build's real nightlife.ts,
// venue-life.ts and dance.ts: the data field for field, hours and events, visits, talk, specials, challenges and discoveries
// over months of nights, the Four-Beat Dance and the clubs' dance sets. Everything compares exactly.
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
	std::string Pairs(const std::vector<std::pair<std::string, double>>& M)
	{
		std::string S;
		for (const auto& [K, V] : M) { if (!S.empty()) S += ","; S += K + "=" + N(V); }
		return S.empty() ? None : S;
	}
	std::string Ps(const FProgression& P)
	{
		return Join({P.EarnedRewards.empty() ? None : Join(P.EarnedRewards, ","), Kv(P.NexLedger), Kv(P.Materials), N(P.Xp), N(P.Level), N(P.CalibrationTokens), N(P.NovaLevel), P.NovaUnlocks.empty() ? None : Join(P.NovaUnlocks, ",")}, "|");
	}
	FProgression ParseP(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FProgression P;
		if (F[0] != None) P.EarnedRewards = Split(F[0], ',');
		P.NexLedger = ParseKv(F[1]);
		P.Materials = ParseKv(F[2]);
		P.Xp = Num(F[3]); P.Level = Num(F[4]); P.CalibrationTokens = Num(F[5]); P.NovaLevel = Num(F[6]);
		if (F[7] != None) P.NovaUnlocks = Split(F[7], ',');
		return P;
	}
	std::string Ls(const std::vector<FLine>& Xs)
	{
		std::string S;
		for (const FLine& L : Xs) { if (!S.empty()) S += "~~"; S += L.Speaker + "^" + L.Text; }
		return S.empty() ? None : S;
	}
	std::string RewardStr(const FReward& R) { return N(R.Nex) + "^" + N(R.Xp) + "^" + Pairs(R.Materials) + "^" + RewardText(R); }
	std::string Bf(const stash::FBuffs& X)
	{
		std::string S;
		for (const auto& [K, V] : X) { if (!S.empty()) S += ","; S += K + "=" + N(V.Stacks) + ":" + N(V.Until); }
		return S.empty() ? None : S;
	}
	stash::FBuffs ParseBf(const std::string& S)
	{
		stash::FBuffs X;
		if (S == None) return X;
		for (const std::string& E : Split(S, ',')) { const size_t Eq = E.find('='); const std::vector<std::string> T = Split(E.substr(Eq + 1), ':'); X[E.substr(0, Eq)] = {Num(T[0]), Num(T[1])}; }
		return X;
	}
	std::string Fb(const FFourBeat& S) { return S.Venue + "," + N(S.BeatMs) + "," + N(S.Hits) + "," + N(S.Misses) + "," + N(S.LastBeat) + "," + B(S.bDone) + "," + B(S.bWon); }
	FFourBeat ParseFb(const std::string& T)
	{
		const std::vector<std::string> F = Split(T, ',');
		return {F[0], Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4]), F[5] == "1", F[6] == "1"};
	}
	EArrow ArrowOf(const std::string& S)
	{
		for (int I = 0; I < 4; ++I) if (S == ArrowNames[I]) return static_cast<EArrow>(I);
		throw std::runtime_error("bad arrow " + S);
	}
	std::string Bt(const std::vector<FBeat>& Xs)
	{
		std::string S;
		for (const FBeat& X : Xs) { if (!S.empty()) S += ","; S += N(X.T) + ":" + ArrowNames[static_cast<int>(X.Arrow)] + ":" + (X.Hit.empty() ? None : X.Hit); }
		return S.empty() ? None : S;
	}
	std::vector<FBeat> ParseBt(const std::string& T)
	{
		std::vector<FBeat> Out;
		if (T == None) return Out;
		for (const std::string& E : Split(T, ',')) { const std::vector<std::string> F = Split(E, ':'); Out.push_back({Num(F[0]), ArrowOf(F[1]), F[2] == None ? "" : F[2]}); }
		return Out;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: VenueCoreTest <venue_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FProgression P;
	stash::FBuffs Buffs;
	size_t VenueRow = 0, CastRow = 0, SpecialRow = 0, ChallengeRow = 0, EventRow = 0;
	int Nights = 0, Taps = 0, Presses = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "VN") { const FVenue& V = Venues().at(VenueRow++); Same(LineNo, "venue", Join({V.Id, V.Name, V.Sub, V.Kind, V.Color, V.Accent, N(V.Dx), N(V.Dz)}, "^"), F[1]); }
		else if (T == "HR") { const FHours* H = HoursOf(F[1]); Same(LineNo, "hours", H ? N(H->Open) + "," + N(H->Close) : None, F[2] + "," + F[3]); }
		else if (T == "EV") { const FVenueEvent& E = VenueEvents().at(EventRow++); Same(LineNo, "event", Join({E.Id, E.Venue, E.Title, N(E.Start), N(E.End)}, "^"), F[1]); }
		else if (T == "CM")
		{
			const FCastMember& C = Cast().at(CastRow++);
			std::vector<std::string> Rem, Top;
			for (const auto& [K, V] : C.Remembers) Rem.push_back(K + "=" + V);
			for (const FTopic& X : C.Topics)
				Top.push_back(Join({X.Id, X.Title, X.Text, X.Needs.empty() ? None : X.Needs, X.Discovery ? RewardStr({X.Discovery->Nex, X.Discovery->Xp, X.Discovery->Materials}) + "^" + X.Discovery->Title : None}, "``"));
			Same(LineNo, "cast", Join({C.Id, C.Venue, C.Name, C.Role, N(C.SpotX), N(C.SpotZ), C.First, Join(C.Known, "~~"), Rem.empty() ? None : Join(Rem, "~~"), Join(Top, "~~")}, "^"), F[1]);
		}
		else if (T == "SP") { const FSpecial& S = Specials().at(SpecialRow++); Same(LineNo, "special", Join({S.Venue, S.Name, S.Blurb, N(S.Price), S.Buff, N(S.Seconds)}, "^"), F[1]); }
		else if (T == "CH") { const FChallenge& C = Challenges().at(ChallengeRow++); Same(LineNo, "challenge", Join({C.Id, C.Venue, C.Title, C.Blurb, N(C.Target), RewardStr(C.Reward)}, "^"), F[1]); }
		else if (T == "IH") Same(LineNo, "inHours", B(InHours(Num(F[1]), Num(F[2]), Num(F[3]))), F[4]);
		else if (T == "VO") Same(LineNo, "venueOpen", B(VenueOpen(F[1], Num(F[2]))), F[3]);
		else if (T == "VE") { const FVenueEvent* E = VenueEventAt(F[1], Num(F[2])); Same(LineNo, "venueEvent", E ? E->Id : None, F[3]); }
		else if (T == "VD") Same(LineNo, "venueDialogue", Ls(VenueDialogue(F[1], Num(F[2]), Num(F[3]))), F[4]);
		else if (T == "P") { P = ParseP(F[1]); Buffs.clear(); ++Nights; Same(LineNo, "save round trip", Ps(P), F[1]); }
		else if (T == "RV") { RecordVenueVisit(P, F[1], Num(F[2])); Same(LineNo, "recordVenueVisit", Ps(P), F[3]); }
		else if (T == "RT") { RecordTalk(P, F[1], Num(F[2])); Same(LineNo, "recordTalk", Ps(P), F[3]); }
		else if (T == "RF") { RecordFact(P, F[1], F[2], Num(F[3])); Same(LineNo, "recordFact", Ps(P), F[4]); }
		else if (T == "RD") { RecordDance(P, F[1], Num(F[2])); Same(LineNo, "recordDance", Ps(P), F[3]); }
		else if (T == "OS")
		{
			Buffs = ParseBf(F[4]);
			const std::string Err = OrderSpecial(P, Buffs, F[1], Num(F[2]), Num(F[3]));
			Same(LineNo, "orderSpecial", Err + "|" + Ps(P) + "|" + Bf(Buffs), F[5]);
		}
		else if (T == "CC")
		{
			std::vector<std::string> Xs;
			for (const FPayout& X : ClaimChallenges(P)) Xs.push_back(X.Title + "^" + RewardStr(X.Reward));
			Same(LineNo, "claimChallenges", Xs.empty() ? None : Join(Xs, "~~"), F[1]);
			Same(LineNo, "claimChallenges save", Ps(P), F[2]);
		}
		else if (T == "CD")
		{
			const FCastMember* C = CastById(F[1]);
			const FTopic* Topic = nullptr;
			if (C) for (const FTopic& X : C->Topics) if (X.Id == F[2]) Topic = &X;
			if (!Topic) { Same(LineNo, "topic", None, F[2]); continue; }
			const std::optional<FPayout> X = ClaimDiscovery(P, *Topic);
			Same(LineNo, "claimDiscovery", (X ? X->Title + "^" + RewardStr(X->Reward) : None) + "|" + Ps(P), F[3]);
		}
		else if (T == "OT")
		{
			std::vector<std::string> Ids;
			for (const FTopic* X : OpenTopics(P, F[1], Num(F[2]))) Ids.push_back(X->Id);
			Same(LineNo, "openTopics", Ids.empty() ? None : Join(Ids, ","), F[3]);
		}
		else if (T == "GR") Same(LineNo, "greeting", Ls(Greeting(P, F[1], Num(F[2]))), F[3]);
		else if (T == "HF") Same(LineNo, "hasFact", B(HasFact(P, F[1], F[2])), F[3]);
		else if (T == "NT") Same(LineNo, "nightsTalked", N(NightsTalked(P, F[1])), F[2]);
		else if (T == "ST") Same(LineNo, "standing", N(VenueStanding(P, F[1])) + "," + B(IsVip(P, F[1])), F[2]);
		else if (T == "HS") Same(LineNo, "hadSpecialTonight", B(HadSpecialTonight(P, F[1], Num(F[2]))), F[3]);
		else if (T == "CP")
		{
			std::vector<std::string> Xs;
			for (const FChallenge& C : Challenges()) Xs.push_back(N(ChallengeProgress(P, C)));
			Same(LineNo, "challenge progress", Join(Xs, ","), F[1]);
		}
		else if (T == "DB") Same(LineNo, "danceBest", N(DanceBest(P, F[1])), F[2]);
		else if (T == "FB") Same(LineNo, "startFourBeat", Fb(StartFourBeat(F[1])), F[2]);
		else if (T == "FT") { ++Taps; const FTap X = FourBeatTap(ParseFb(F[1]), NumJs(F[2])); Same(LineNo, "fourBeatTap", Fb(X.State) + "|" + (X.Grade.empty() ? None : X.Grade), F[3]); }
		else if (T == "FK") Same(LineNo, "fourBeatTick", Fb(FourBeatTick(ParseFb(F[1]), Num(F[2]))), F[3]);
		else if (T == "FP") Same(LineNo, "fourBeatPhase", N(FourBeatPhase(ParseFb(F[1]), Num(F[2]))), F[3]);
		else if (T == "DS") Same(LineNo, "danceSet", Bt(DanceSet(F[1], F[2])), F[3]);
		else if (T == "PR") { ++Presses; std::vector<FBeat> Bs = ParseBt(F[1]); const std::string G = Press(Bs, ArrowOf(F[2]), Num(F[3])); Same(LineNo, "press", (G.empty() ? None : G) + "|" + Bt(Bs), F[4]); }
		else if (T == "EX") { std::vector<FBeat> Bs = ParseBt(F[1]); const int Nx = Expire(Bs, Num(F[2])); Same(LineNo, "expire", N(Nx) + "|" + Bt(Bs), F[3]); }
		else if (T == "RS")
		{
			const std::vector<FBeat> Bs = ParseBt(F[1]);
			const FDanceResult R = Result(Bs);
			Same(LineNo, "result", Join({N(R.Score), N(R.Perfect), N(R.Good), N(R.Miss), N(R.BestCombo), R.Grade, B(Finished(Bs))}, ","), F[2]);
		}
		else { std::fprintf(stderr, "line %d: unknown record %s\n", LineNo, T.c_str()); ++Mismatches; }
	}
	Same(0, "data rows", N(static_cast<double>(VenueRow)) + "," + N(static_cast<double>(CastRow)) + "," + N(static_cast<double>(SpecialRow)) + "," + N(static_cast<double>(ChallengeRow)) + "," + N(static_cast<double>(EventRow)),
		N(static_cast<double>(Venues().size())) + "," + N(static_cast<double>(Cast().size())) + "," + N(static_cast<double>(Specials().size())) + "," + N(static_cast<double>(Challenges().size())) + "," + N(static_cast<double>(VenueEvents().size())));
	std::printf("VenueCoreTest: %d nights-out runs, %d four-beat taps, %d dance presses, %d checks, %d mismatches\n", Nights, Taps, Presses, Checks, Mismatches);
	return Mismatches ? 1 : 0;
}
