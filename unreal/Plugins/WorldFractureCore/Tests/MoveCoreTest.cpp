// Golden test for the C++ movement kit: replays tools/gen-move-golden.ts, recorded from the web build's real movement.ts
// and parkour.ts. After every frame the whole move state must match.
#include "Core/WFMoveCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::move;

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
	std::string St(const FMoveState& S)
	{
		return S.Stance + "|" + (S.bProne ? "1" : "0") + "|" + N(S.StanceDrop) + "|" + N(S.AirJumpsLeft) + "|" + N(S.SlideLeft) + "|" + N(S.SlideCool) + "|" + N(S.SlideDirX) + "|" + N(S.SlideDirZ) + "|" + N(S.SlideSpeed) + "|" + N(S.Drop);
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: MoveCoreTest <move_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FMoveState S;
	std::string Cls, Result;
	int Tracks = 0, Frames = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "MIN") Same(LineNo, "SLIDE_MIN_SPEED", N(SlideMinSpeed), F[1]);
		else if (T == "C") { ++Tracks; S = FMoveState{}; Cls = F[1]; }
		else if (T == "LD") { Land(S, Cls); Result = "~"; }
		else if (T == "AJ") { const double M = AirJump(S, Cls); Result = M < 0 ? "~" : N(M); }
		else if (T == "GV") Result = N(GlideVy(Num(F[1]), Cls, F[2] == "1"));
		else if (T == "SS") Result = StartSlide(S, Num(F[1]), Num(F[2])) ? "1" : "0";
		else if (T == "CS") { CancelSlide(S); Result = "~"; }
		else if (T == "ST") Result = N(StepSlide(S, Num(F[1])));
		else if (T == "RS")
		{
			S.bProne = F[7] == "1"; // the recorder flips the prone toggle itself before resolving
			FStanceInput In;
			In.bCrouchHeld = F[1] == "1"; In.bSprinting = F[2] == "1"; In.bJumping = F[3] == "1"; In.bGrounded = F[4] == "1"; In.bSliding = F[5] == "1"; In.bSwimming = F[6] == "1";
			Result = ResolveStance(S, In);
		}
		else if (T == "SN") { StepStance(S, Num(F[1])); Result = N(CameraDrop(S)); }
		else if (T == "PT") Result = "~";
		else if (T == "R") { ++Frames; Same(LineNo, "result", Result, F[1]); Same(LineNo, "state", St(S), F[2]); }
		else if (T == "FV") Same(LineNo, "movementFov", N(MovementFov(F[1] == "1", F[2] == "1", F[3] == "1", F[4])), F[5]);
		else if (T == "VL") { const FLunge L = VaultLunge(Num(F[1]), Num(F[2])); Same(LineNo, "vaultLunge", N(L.VerticalBoost) + "|" + N(L.ForwardBoost), F[3]); }
		else if (T == "CB") Same(LineNo, "parkourChainBonus", N(ParkourChainBonus(static_cast<int>(Num(F[1])), Num(F[2]))), F[3]);
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d tracks, %d frames, %d checks, %d mismatches\n", Tracks, Frames, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
