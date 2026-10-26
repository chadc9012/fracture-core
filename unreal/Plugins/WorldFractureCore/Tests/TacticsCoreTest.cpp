// Golden test for the C++ enemy tactics: replays tools/gen-tactics-golden.ts, recorded from the web build's real
// enemy-intelligence.ts, ability-network.ts buildSynergy, enemy-tactics.ts and enemy-evasion.ts. Line of sight is the
// recorder's stand-in (tools/shims/tactics-sight-shim.ts), mirrored here as TcBlocked; the ground is TcGround.
#include "Core/WFTacticsCore.h"
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
using namespace wf::tactics;

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
	int Checks = 0, Mismatches = 0, Fuzzy = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	/** |-separated numbers within 1e-9 relative (V8's Math.sin / cos / pow may differ from libm in the last bit) */
	void Near(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		if (Got == Want) { ++Checks; return; }
		const auto G = Split(Got, '|'), W = Split(Want, '|');
		bool bOk = G.size() == W.size();
		for (size_t K = 0; bOk && K < G.size(); ++K)
		{
			if (G[K] == W[K]) continue;
			const double A = Num(G[K]), B = Num(W[K]);
			bOk = std::fabs(A - B) <= 1e-9 * std::max(1.0, std::max(std::fabs(A), std::fabs(B)));
		}
		if (bOk) { ++Checks; ++Fuzzy; return; }
		Same(Line, What, Got, Want);
	}
	double TcGround(double X, double Z) { return std::floor(X / 9) * 0.5 - std::floor(Z / 13) * 0.3 + 1; }
	bool TcBlocked(const FPoint3& From, const FPoint3& To)
	{
		const double K = std::floor(From.X * 0.37) + std::floor(From.Z * 0.23) + std::floor(To.X * 0.11) + std::floor(To.Y * 7);
		return std::fmod(std::fmod(K, 3) + 3, 3) == 0;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: TacticsCoreTest <tactics_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FGrenade G;
	int Grenades = 0, Flanks = 0, Threats = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "SR") Same(LineNo, "squadRole", SquadRole(static_cast<int>(Num(F[1])), F[2] == "1", F[3] == "1"), F[4]);
		else if (T == "SM")
		{
			const FMove M = SquadMove(F[1], Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]), F[6], F[7] == "1", F[8]);
			Near(LineNo, "squadMove", N(M.Forward) + "|" + N(M.Strafe), F[9]);
		}
		else if (T == "SA")
		{
			ability::FBuild B;
			B.Slots = {{"PRIMARY", F[1]}, {"TACTICAL", F[2]}, {"ULTIMATE", F[3]}};
			Same(LineNo, "squad archetype", SquadArchetypeFor(B), F[4]);
		}
		else if (T == "FF")
		{
			++Flanks;
			const std::optional<FPoint> S = FindFlankSpot(Num(F[1]), Num(F[2]), {Num(F[3]), Num(F[4]), Num(F[5])}, static_cast<int>(Num(F[6])), TcGround, TcBlocked);
			Near(LineNo, "findFlankSpot", S ? N(S->X) + "|" + N(S->Z) : None, F[7]);
		}
		else if (T == "LV")
		{
			const FLob L = LobVelocity({Num(F[1]), Num(F[2]), Num(F[3])}, {Num(F[4]), Num(F[5]), Num(F[6])});
			Near(LineNo, "lobVelocity", N(L.Vx) + "|" + N(L.Vy) + "|" + N(L.Vz) + "|" + N(L.T), F[7]);
		}
		else if (T == "GR") { ++Grenades; G = FGrenade{Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6]), Num(F[7]), 0, false}; }
		else if (T == "GS")
		{
			StepGrenade(G, Num(F[1]), TcGround);
			const std::string Got = N(G.X) + "|" + N(G.Y) + "|" + N(G.Z) + "|" + N(G.Vx) + "|" + N(G.Vy) + "|" + N(G.Vz) + "|" + N(G.Fuse) + "|" + (G.bRest ? "1" : "0");
			Near(LineNo, "stepGrenade", Got, F[2]);
			// resync to the recorded state so a last-bit pow difference cannot grow over the flight
			const auto W = Split(F[2], '|');
			G.X = Num(W[0]); G.Y = Num(W[1]); G.Z = Num(W[2]); G.Vx = Num(W[3]); G.Vy = Num(W[4]); G.Vz = Num(W[5]); G.Fuse = Num(W[6]); G.bRest = W[7] == "1";
		}
		else if (T == "GD") Same(LineNo, "grenadeDamage", N(GrenadeDamage(Num(F[1]), F[2] == "1")), F[3]);
		else if (T == "BE") Same(LineNo, "beepEvery", N(BeepEvery(Num(F[1]))), F[2]);
		else if (T == "TG") Same(LineNo, "throwsGrenades", ThrowsGrenades(F[1]) ? "1" : "0", F[2]);
		else if (T == "RT")
		{
			++Threats;
			FRoundLike R{Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6]), Num(F[7]), Num(F[8]), Num(F[9]), Num(F[10]), Num(F[11])};
			const std::optional<FThreat> Th = RoundThreat(R, Num(F[12]), Num(F[13]), TcGround, Num(F[14]));
			Near(LineNo, "roundThreat", Th ? N(Th->X) + "|" + N(Th->Z) + "|" + N(Th->T) : None, F[15]);
		}
		else if (T == "DD")
		{
			const FPoint D = DiveDirection(Num(F[1]), Num(F[2]), {Num(F[3]), Num(F[4])}, Num(F[5]), Num(F[6]), static_cast<int>(Num(F[7])));
			Same(LineNo, "diveDirection", N(D.X) + "|" + N(D.Z), F[8]);
		}
		else if (T == "RE") Same(LineNo, "reactsInTime", ReactsInTime(Num(F[1]), F[2] == "1", Num(F[3])) ? "1" : "0", F[4]);
		else if (T == "FD")
		{
			const FPoint D = FleeDirection(Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]));
			Near(LineNo, "fleeDirection", N(D.X) + "|" + N(D.Z), F[6]);
		}
		else if (T == "FC")
		{
			std::vector<FCoverCandidate> Cands;
			if (F[6] != None) for (const std::string& K : Split(F[6], ';')) { const auto P = Split(K, ':'); Cands.push_back({Num(P[0]), Num(P[1]), Num(P[2])}); }
			const std::optional<FCoverSpot> C = FindCover(Num(F[1]), Num(F[2]), {Num(F[3]), Num(F[4]), Num(F[5])}, Cands, TcGround, TcBlocked);
			Near(LineNo, "findCover", C ? N(C->X) + "|" + N(C->Z) + "|" + N(C->PeekX) + "|" + N(C->PeekZ) + "|" + N(C->Run) : None, F[7]);
		}
		else if (T == "CP") Same(LineNo, "coverPhase", CoverPhase(Num(F[1]), F[2] == "1", Num(F[3])), F[4]);
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d flank searches, %d grenades, %d round threats, %d checks (%d within float tolerance), %d mismatches\n", Flanks, Grenades, Threats, Checks, Fuzzy, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
