// Golden test for the C++ world clock, weather, seasons and hazards: replays tools/gen-environment-golden.ts, recorded from the
// web build's real world.ts, weather-cycle.ts and environment.ts. Wind (sin / cos) compares to 1e-9; everything else exactly.
#include "Core/WFEnvironmentCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <deque>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::env;

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
	/** a '|' list where the listed fields may differ in the last bits (V8's sin / cos) */
	void SameNear(int Line, const char* What, const std::string& Got, const std::string& Want, std::initializer_list<size_t> Loose)
	{
		++Checks;
		const std::vector<std::string> G = Split(Got, '|'), W = Split(Want, '|');
		bool bOk = G.size() == W.size();
		for (size_t I = 0; bOk && I < G.size(); ++I)
		{
			if (G[I] == W[I]) continue;
			bool bLoose = false;
			for (size_t L : Loose) bLoose |= L == I;
			if (bLoose && std::fabs(Num(G[I]) - Num(W[I])) <= 1e-9 * std::max(1.0, std::fabs(Num(W[I])))) { ++Near; continue; }
			bOk = false;
		}
		if (!bOk && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	/** every number in the text to 1e-9 (relative above 1), everything else exactly: the meters and strike points ride on sin / cos */
	void SameNumbers(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		auto Tokens = [](const std::string& X) { std::vector<std::string> Out; std::string Cur; for (char C : X) { if (C == '|' || C == ':' || C == ';' || C == ',') { Out.push_back(Cur); Out.push_back(std::string(1, C)); Cur.clear(); } else Cur += C; } Out.push_back(Cur); return Out; };
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
	std::string Wx(const FWeather& W) { return W.State + "|" + N(W.Precipitation) + "|" + N(W.Cloud) + "|" + N(W.Visibility) + "|" + N(W.WindX) + "|" + N(W.WindZ) + "|" + W.Label; }
	std::string St(const FEnvState& S)
	{
		std::string K, F;
		for (const FStrike& X : S.Strikes) { if (!K.empty()) K += ";"; K += N(X.Id) + ":" + N(X.X) + ":" + N(X.Z) + ":" + N(X.Radius) + ":" + N(X.Warn); }
		for (const FFlash& X : S.Flashes) { if (!F.empty()) F += ";"; F += N(X.X) + ":" + N(X.Z) + ":" + N(X.T); }
		return N(S.Heat) + "|" + N(S.Cold) + "|" + N(S.Toxic) + "|" + (K.empty() ? None : K) + "|" + (F.empty() ? None : F) + "|" + N(S.NextStrike) + "|" + N(S.NextId);
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: EnvironmentCoreTest <environment_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FEnvState S;
	std::string Region;
	int Clocks = 0, Samples = 0, Steps = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "CL")
		{
			++Clocks;
			const double Tm = Num(F[1]);
			SameNear(LineNo, "clock", N(HourOf(Tm)) + "|" + N(SunElevation(Tm)) + "|" + PhaseFor(Tm) + "|" + ClockLabel(Tm) + "|" + N(NightFactor(Tm)),
				F[2] + "|" + F[3] + "|" + F[4] + "|" + F[5] + "|" + F[6], {1, 4});
		}
		else if (T == "WX")
		{
			++Samples;
			const std::string R = F[1] == None ? "" : F[1];
			const FWeather W = SampleWeather(R, Num(F[2]));
			SameNear(LineNo, "weather", Wx(W) + "|" + WeatherName(W, R.empty() ? "wastelands" : R), F[3] + "|" + F[4], {4, 5});
		}
		else if (T == "EA")
		{
			++Samples;
			const std::string R = F[1] == None ? "" : F[1];
			const FEnvironment E = EnvironmentAt(R, Num(F[2]), Num(F[3]));
			SameNear(LineNo, "environment", E.Season + "|" + N(E.SeasonProgress) + "|" + Wx(E.Weather) + "|" + N(E.Thermal) + "|" + N(E.TempC) + "|" + B(E.bShielded) + "|" + E.Summary, F[4], {6, 7});
		}
		else if (T == "H") { S = FEnvState{}; Region = F[1]; }
		else if (T == "HS")
		{
			++Steps;
			std::deque<double> Draws;
			if (F[6] != None) for (const std::string& D : Split(F[6], ',')) Draws.push_back(Num(D));
			FEnvInput EIn;
			EIn.Dt = Num(F[1]); EIn.RegionId = Region;
			const double Tm = Num(F[2]);
			EIn.Env = EnvironmentAt(Region, Tm, NightFactor(Tm));
			EIn.bSheltered = F[3] == "1"; EIn.Px = Num(F[4]); EIn.Pz = Num(F[5]);
			EIn.Rand = [&]() { if (Draws.empty()) { Same(LineNo, "rand", "extra draw", "none"); return 0.0; } const double V = Draws.front(); Draws.pop_front(); return V; };
			const FEnvOutput O = StepEnvironment(S, EIn);
			if (!Draws.empty()) Same(LineNo, "rand", "unused draws", "all used");
			std::string Det;
			for (const FStrike& X : O.Detonated) { if (!Det.empty()) Det += ","; Det += N(X.Id); }
			SameNumbers(LineNo, "hazard state", St(S), F[7]);
			SameNumbers(LineNo, "hazard out", N(O.Damage) + "|" + (O.Cause.empty() ? None : O.Cause) + "|" + (O.Warning.empty() ? None : O.Warning) + "|" + (Det.empty() ? None : Det), F[8] + "|" + F[9] + "|" + F[10] + "|" + F[11]);
		}
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d clock times, %d weather / environment samples, %d hazard steps, %d checks (%d within float tolerance), %d mismatches\n", Clocks, Samples, Steps, Checks, Near, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
