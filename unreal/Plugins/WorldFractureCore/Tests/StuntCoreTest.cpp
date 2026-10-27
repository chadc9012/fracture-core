// Golden test for the C++ off-road air, stunt scoring and Stunt Park: replays tools/gen-stunt-golden.ts, recorded from the web
// build's real stunts.ts and stunt-park.ts. Each flight frame starts from the web build's own state before it; the ground's eased
// vertical speed rides on Math.exp, so flight states compare to 1e-9 and everything else exactly.
#include "Core/WFStuntCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::stunt;

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
	int Checks = 0, Mismatches = 0, Near = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	/** every number to 1e-9 (relative above 1), everything else exactly */
	void SameNumbers(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		auto Tokens = [](const std::string& X) { std::vector<std::string> Out; std::string Cur; for (char C : X) { if (C == '|' || C == ',' || C == ';') { Out.push_back(Cur); Out.push_back(std::string(1, C)); Cur.clear(); } else Cur += C; } Out.push_back(Cur); return Out; };
		const std::vector<std::string> G = Tokens(Got), W = Tokens(Want);
		bool bOk = G.size() == W.size(), bLoose = false;
		for (size_t I = 0; bOk && I < G.size(); ++I)
		{
			if (G[I] == W[I]) continue;
			double A = 0, Bv = 0;
			const auto Ra = std::from_chars(G[I].data(), G[I].data() + G[I].size(), A), Rb = std::from_chars(W[I].data(), W[I].data() + W[I].size(), Bv);
			if (Ra.ec == std::errc() && Rb.ec == std::errc() && std::fabs(A - Bv) <= 1e-9 * std::max(1.0, std::fabs(Bv))) { bLoose = true; continue; }
			bOk = false;
		}
		if (bLoose && bOk) ++Near;
		if (!bOk && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	std::string AirText(const FAir& A) { return N(A.Y) + "," + N(A.Vy) + "," + B(A.bAirborne) + "," + N(A.LastStand) + "," + N(A.Pitch) + "," + N(A.Roll) + "," + N(A.SpinYaw) + "," + N(A.AirTime); }
	FAir ParseAir(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, ',');
		FAir A;
		A.Y = Num(F[0]); A.Vy = Num(F[1]); A.bAirborne = F[2] == "1"; A.LastStand = Num(F[3]); A.Pitch = Num(F[4]); A.Roll = Num(F[5]); A.SpinYaw = Num(F[6]); A.AirTime = Num(F[7]);
		return A;
	}
	std::string LandText(const std::optional<FLanding>& L)
	{
		return L ? N(L->AirTime) + "," + N(L->Pitch) + "," + N(L->Roll) + "," + N(L->SpinYaw) + "," + N(L->Impact) + "," + B(L->bClean) : None;
	}
	FLanding ParseLand(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, ',');
		return {Num(F[0]), Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4]), F[5] == "1"};
	}
	std::string RunText(const FRun& R)
	{
		return N(R.Combo) + "," + N(R.ComboUntil) + "," + N(R.Total) + "," + N(R.Best) + "," + N(R.SlideTime) + "," + (R.Last ? R.Last->Label + ";" + N(R.Last->Points) + ";" + N(R.Last->At) + ";" + B(R.Last->bWipeout) : None);
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
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: StuntCoreTest <stunt_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FRun Run;
	int Frames = 0, Landings = 0, Scored = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "AF")
		{
			++Frames;
			FAir A = ParseAir(F[1]);
			Same(LineNo, "air round trip", AirText(A), F[1]);
			const FAirInput Input{Num(F[4]), Num(F[5]), Num(F[6]), F[7] == "1"};
			const std::optional<FLanding> L = StepAir(A, Num(F[3]), Input, Num(F[2]));
			if (L) ++Landings;
			SameNumbers(LineNo, "stepAir", AirText(A) + "|" + LandText(L), F[8]);
		}
		else if (T == "WR") SameNumbers(LineNo, "wrap", N(Wrap(Num(F[1]))), F[2]);
		else if (T == "LT")
		{
			std::string S;
			for (const FTrick& X : LandingTricks(ParseLand(F[1]))) { if (!S.empty()) S += ","; S += X.Name + ";" + N(X.Points); }
			Same(LineNo, "landingTricks", S.empty() ? None : S, F[2]);
		}
		else if (T == "R") { Run = FRun{}; Same(LineNo, "freshRun", RunText(Run), F[1]); }
		else if (T == "SL") { ++Scored; const double P = ScoreLanding(Run, ParseLand(F[1]), Num(F[2])); Same(LineNo, "scoreLanding", N(P) + "|" + RunText(Run), F[3]); }
		else if (T == "PS") { ++Scored; const double P = StepPowerslide(Run, Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4])); Same(LineNo, "stepPowerslide", N(P) + "|" + RunText(Run), F[5]); }
		else if (T == "CM") Same(LineNo, "comboMult", N(ComboMult(Num(F[1]))), F[2]);
		else if (T == "SN") Same(LineNo, "stuntNex", N(StuntNex(Num(F[1]), Num(F[2]))), F[3]);
		else if (T == "PY") { std::map<std::string, double> L = ParseKv(F[1]); PayStunts(L, F[2], Num(F[3])); Same(LineNo, "payStunts", Kv(L), F[4]); }
		else if (T == "PK") { const FPark& P = StuntPark(); Same(LineNo, "park", N(P.X) + "," + N(P.Z) + "," + N(P.DirX) + "," + N(P.DirZ) + "," + N(P.Length) + "," + N(P.Width), F[1]); }
		else if (T == "RP")
		{
			const std::vector<std::string> Id = Split(F[1], ',');
			const FRamp* R = nullptr;
			for (const FRamp& X : Ramps()) if (X.Id == Id[0]) R = &X;
			if (!R) { Same(LineNo, "ramp", "missing", Id[0]); continue; }
			Same(LineNo, "ramp data", R->Id + "," + N(R->Along) + "," + N(R->Across) + "," + N(R->Length) + "," + N(R->Ramp) + "," + N(R->Width) + "," + N(R->Height) + "," + R->Label, F[1]);
			const FPoint C = RampCentre(*R);
			const FDeck D = RampDeck(*R, Num(F[2]));
			std::string Prof;
			for (const auto& [U, H] : RampProfile(*R)) { if (!Prof.empty()) Prof += ","; Prof += N(U) + ":" + N(H); }
			Same(LineNo, "ramp", N(C.X) + "," + N(C.Z) + "|" + D.Id + "," + N(D.X) + "," + N(D.Z) + "," + N(D.DirX) + "," + N(D.DirZ) + "," + N(D.Length) + "," + N(D.Width) + "," + N(D.Top) + "," + N(D.Base) + "," + N(D.Ramp) + "|" + Prof, F[3]);
		}
		else if (T == "IN") Same(LineNo, "inStuntPark", B(InStuntPark(Num(F[1]), Num(F[2]), Num(F[3]))), F[4]);
		else Same(LineNo, "line", T, "known");
	}
	if (Ramps().size() != 8) Same(0, "ramp count", N(static_cast<double>(Ramps().size())), "8");
	std::printf("%d flight frames (%d landings), %d scored events, %d checks (%d within float tolerance), %d mismatches\n", Frames, Landings, Scored, Checks, Near, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
