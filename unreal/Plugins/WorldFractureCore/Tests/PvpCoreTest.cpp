// Golden test for the C++ Killbox: replays tools/gen-pvp-golden.ts, recorded from the web build's real pvp.ts and crucible.ts.
// Every match frame (scores, zones, rounds, the royale circle, the seeded off-field fight), the HUD line, and every rival-field
// step (respawn timers, spent slots, which rivals come on with which random draws) must match.
#include "Core/WFPvpCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <algorithm>
#include <deque>
#include <fstream>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::pvp;

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
	std::string Join(const std::vector<std::string>& Xs, const char* Sep)
	{
		std::string S;
		for (size_t I = 0; I < Xs.size(); ++I) { if (I) S += Sep; S += Xs[I]; }
		return S;
	}
	std::string StText(const FState& S)
	{
		std::vector<std::string> Board, Zones;
		for (double V : S.Board) Board.push_back(N(V));
		for (const FZone& Z : S.Zones) Zones.push_back(Z.Id + ":" + N(Z.Dx) + ":" + N(Z.Dz) + ":" + (Z.Owner.empty() ? None : Z.Owner) + ":" + N(Z.Cap));
		return Join({S.Mode, N(S.Clock), N(S.Us), N(S.Them), Board.empty() ? None : Join(Board, ","), Zones.empty() ? None : Join(Zones, ","), N(S.Round), N(S.RoundClock), N(S.UsRounds), N(S.ThemRounds), B(S.bAttacking),
			N(S.Plant), N(S.ZoneHold), N(S.RoundRivalsLeft), N(S.RoundOver), N(S.Alive), N(S.Phase), N(S.Radius), N(S.NextWave), S.Result.empty() ? None : S.Result, S.Reason.empty() ? None : S.Reason, N(S.Seed)}, "|");
	}
	std::string FieldText(const FField& F)
	{
		std::vector<std::string> R, Sp;
		for (double V : F.Respawn) R.push_back(N(V));
		for (bool V : F.Spent) Sp.push_back(B(V));
		return F.Mode + "|" + (R.empty() ? None : Join(R, ",")) + "|" + (!F.bSpentSet ? std::string("U") : Sp.empty() ? None : Join(Sp, ","));
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: PvpCoreTest <pvp_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FState St;
	FField Field;
	int Frames = 0, FieldSteps = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "MD")
		{
			const FMode* M = ModeById(F[1]);
			if (!M) { Same(LineNo, "mode", "missing", F[1]); continue; }
			Same(LineNo, "mode data", Join({M->Name, M->Kind, M->Tagline, M->Brief, N(M->TeamSize), N(M->Players), N(M->OnField), N(M->Target), N(M->TimeLimit), N(M->RoundTime), M->Activity, B(M->bElite)}, "^"), F[2]);
			Same(LineNo, "mode for activity", ModeForActivity(M->Activity) == M ? "1" : "0", "1");
		}
		else if (T == "CM")
		{
			const FCrucibleMode* M = CrucibleMode(F[1]);
			Same(LineNo, "crucible mode", M ? Join({M->Name, N(M->Rivals), N(M->Target), M->Brief}, "^") : None, F[2]);
		}
		else if (T == "NP") { St = NewPvp(F[1], static_cast<uint32_t>(Num(F[2]))); Same(LineNo, "newPvp", StText(St), F[3]); }
		else if (T == "SP")
		{
			++Frames;
			const FEvents E{Num(F[1]), Num(F[2]), F[3] == "1", Num(F[4]), Num(F[5]), Num(F[6])};
			const bool bDone = StepPvp(St, E);
			Same(LineNo, "stepPvp", B(bDone) + "\t" + StText(St) + "\t" + PvpLine(St) + "\t" + N(FieldSize(St)) + "\t" + B(Respawns(St)) + "\t" + N(StormDamage(St, 0)) + "\t" + N(StormDamage(St, St.Radius + 1)),
				F[7] + "\t" + F[8] + "\t" + F[9] + "\t" + F[10] + "\t" + F[11] + "\t" + F[12] + "\t" + F[13]);
		}
		else if (T == "PS")
		{
			St.Clock = Num(F[1]); St.Us = Num(F[2]); St.Them = Num(F[3]);
			if (St.Board.size() >= 2) { St.Board[0] = St.Us; St.Board[1] = St.Them; }
		}
		else if (T == "RR") { const FCircle C = RoyaleRadius(Num(F[1])); Same(LineNo, "royaleRadius", N(C.Radius) + "|" + N(C.Phase) + "|" + B(C.bClosing), F[2]); }
		else if (T == "LU") Same(LineNo, "rivalLineup", Join(RivalLineup(F[1], F[2]), ","), F[3]);
		else if (T == "SQ") { const std::vector<std::string> Sq = RivalSquad(static_cast<int>(Num(F[1])), static_cast<int>(Num(F[2]))); Same(LineNo, "rivalSquad", Sq.empty() ? None : Join(Sq, ","), F[3]); }
		else if (T == "NC" || T == "NF") { Field = NewCrucible(F[1]); Same(LineNo, "newCrucible", FieldText(Field), F[2]); }
		else if (T == "RF") { ResetField(Field); Same(LineNo, "resetField", FieldText(Field), F[1]); }
		else if (T == "SR" || T == "SF")
		{
			++FieldSteps;
			const bool bField = T == "SF";
			const size_t At = bField ? 3 : 2; // dt index
			std::vector<std::string> Lineup;
			if (bField && F[1] != None) Lineup = Split(F[1], ',');
			std::set<int> Alive;
			if (F[At + 1] != None) for (const std::string& X : Split(F[At + 1], ',')) Alive.insert(static_cast<int>(Num(X)));
			const bool bRoom = F[At + 2] == "1";
			std::deque<double> Draws;
			if (F[At + 3] != None) for (const std::string& X : Split(F[At + 3], ',')) Draws.push_back(Num(X));
			// stepField first takes the rivals past the lineup off the field: their machines are free again
			int Free = bRoom ? 1 : 0;
			if (bField) for (auto It = Alive.begin(); It != Alive.end();) { if (*It >= static_cast<int>(Lineup.size())) { ++Free; It = Alive.erase(It); } else ++It; }
			int Used = 0;
			FFieldWorld W;
			W.SlotAlive = [&Alive](int Slot) { return Alive.count(Slot) > 0; };
			W.HasRoom = [&Used, Free]() { if (Used >= Free) return false; ++Used; return true; }; // sim.ts: the first free machine is taken
			W.Rand = [&]() { if (Draws.empty()) { Same(LineNo, "rand", "extra draw", "none"); return 0.0; } const double V = Draws.front(); Draws.pop_front(); return V; };
			const std::vector<FSpawn> Got = bField ? StepField(Field, Lineup, F[2] == "1", Num(F[At]), W) : StepRivals(Field, F[1], Num(F[At]), W);
			if (!Draws.empty()) Same(LineNo, "rand", "unused draws", "all used");
			std::vector<std::string> Sp;
			for (const FSpawn& S : Got) Sp.push_back(N(S.Slot) + ":" + S.Class + ":" + N(S.Cool));
			std::sort(Sp.begin(), Sp.end());
			Same(LineNo, bField ? "stepField" : "stepRivals", (Sp.empty() ? None : Join(Sp, ",")) + "|" + FieldText(Field), F[At + 4]);
		}
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d match frames, %d field steps, %d checks, %d mismatches\n", Frames, FieldSteps, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
