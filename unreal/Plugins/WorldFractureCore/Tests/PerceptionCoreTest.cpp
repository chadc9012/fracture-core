// Golden test for the C++ enemy perception: replays tools/gen-perception-golden.ts, recorded from the web build's real
// enemy-perception.ts, enemy-tuning.ts and line-of-sight.ts enemyHitChance.
#include "Core/WFPerceptionCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::perception;

namespace
{
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
	int Checks = 0, Mismatches = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	FStimulus Stim(const std::vector<std::string>& F)
	{
		FStimulus S;
		S.Distance = Num(F[1]); S.Sight = Num(F[2]); S.Noise = Num(F[3]); S.bDamaged = F[4] == "1"; S.bFacing = F[5] == "1"; S.bInView = F[6] == "1";
		return S;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: PerceptionCoreTest <perception_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FAi Ai;
	int Tracks = 0, Steps = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "SR") Same(LineNo, "sightRange", N(SightRange(Num(F[1]), Num(F[2]), F[3] == "1")), F[4]);
		else if (T == "AG") Same(LineNo, "awarenessGain", N(AwarenessGain(Stim(F))), F[7]);
		else if (T == "AI") { ++Tracks; Ai = CreateAi(Num(F[1]), Num(F[2]), Num(F[3])); }
		else if (T == "ST")
		{
			++Steps;
			const std::string St = StepAwareness(Ai, Stim(F), Num(F[7]), Num(F[8]), Num(F[9]));
			Same(LineNo, "stepAwareness", St + "|" + N(Ai.Awareness) + "|" + N(Ai.LastX) + "|" + N(Ai.LastZ) + "|" + N(Ai.Timer), F[10]);
		}
		else if (T == "TC") Same(LineNo, "shouldTakeCover", ShouldTakeCover(Num(F[1]), Num(F[2]), F[3] == "1") ? "1" : "0", F[4]);
		else if (T == "PC") { const FPoint P = PickCover(Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5])); Same(LineNo, "pickCover", N(P.X) + "|" + N(P.Z), F[6]); }
		else if (T == "HC") Same(LineNo, "enemyHitChance", N(EnemyHitChance(Num(F[1]), Num(F[2]), Num(F[3]), F[4])), F[5]);
		else if (T == "AR") Same(LineNo, "aggroRadius", N(AggroRadius(Num(F[1]), F[2] == "1", Num(F[3]), Num(F[4]))), F[5]);
		else if (T == "TS") Same(LineNo, "trooperSpeed", N(TrooperSpeed(Num(F[1]), F[2] == "1")), F[3]);
		else if (T == "WU") Same(LineNo, "windup|cooldown", N(WindupFor(F[1] == "1", F[2] == "1")) + "|" + N(RangedCooldownFor(F[1] == "1", F[2] == "1")), F[3]);
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d awareness tracks, %d steps, %d checks, %d mismatches\n", Tracks, Steps, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
