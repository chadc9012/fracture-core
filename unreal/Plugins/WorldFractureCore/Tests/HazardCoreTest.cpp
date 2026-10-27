// Golden test for the C++ region hazards and hazard zones: replays tools/gen-hazard-golden.ts, recorded from the web build's
// real region-hazards.ts, hazard-zones.ts and landmarks.ts. The gravity swings and the quicksand's drift ride on sin / cos, so
// effects compare their numbers to 1e-9; names, warnings and which zone you are in compare exactly.
#include "Core/WFHazardCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::hazard;

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
	int Checks = 0, Mismatches = 0, Near = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	void SameNumbers(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		const std::vector<std::string> G = Split(Got, '|'), W = Split(Want, '|');
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
	std::string He(const FHazardEffect& E)
	{
		return E.Id + "|" + E.Name + "|" + N(E.GravityMul) + "|" + N(E.SpeedMul) + "|" + N(E.DamagePerSec) + "|" + N(E.Exposure) + "|" + N(E.Intensity) + "|" + (E.Warning ? *E.Warning : None);
	}
	FHazardEffect ParseHe(const std::vector<std::string>& F, size_t At)
	{
		FHazardEffect E;
		E.Id = F[At]; E.Name = F[At + 1]; E.GravityMul = Num(F[At + 2]); E.SpeedMul = Num(F[At + 3]); E.DamagePerSec = Num(F[At + 4]); E.Exposure = Num(F[At + 5]); E.Intensity = Num(F[At + 6]);
		if (F[At + 7] != None) E.Warning = F[At + 7];
		return E;
	}
	std::string Ze(const FZoneEffect& E)
	{
		return (E.ZoneId ? *E.ZoneId : None) + "|" + E.Name + "|" + N(E.SpeedMul) + "|" + N(E.GravityMul) + "|" + N(E.DamagePerSec) + "|" + N(E.PullX) + "|" + N(E.PullZ) + "|" + N(E.Intensity) + "|" + (E.Warning ? *E.Warning : None);
	}
	FZoneEffect ParseZe(const std::vector<std::string>& F, size_t At)
	{
		FZoneEffect E;
		if (F[At] != None) E.ZoneId = F[At];
		E.Name = F[At + 1]; E.SpeedMul = Num(F[At + 2]); E.GravityMul = Num(F[At + 3]); E.DamagePerSec = Num(F[At + 4]); E.PullX = Num(F[At + 5]); E.PullZ = Num(F[At + 6]); E.Intensity = Num(F[At + 7]);
		if (F[At + 8] != None) E.Warning = F[At + 8];
		return E;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: HazardCoreTest <hazard_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	std::vector<FRegionCircle> Regions;
	std::map<std::string, FRegionCircle> ById;
	const FRegionLookup Lookup = [&ById](const std::string& Id) -> std::optional<FRegionCircle> { const auto It = ById.find(Id); return It == ById.end() ? std::nullopt : std::optional<FRegionCircle>(It->second); };
	int Steps = 0, Probes = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "RG") { const FRegionCircle R{F[1], Num(F[2]), Num(F[3]), Num(F[4])}; Regions.push_back(R); ById[R.Id] = R; }
		else if (T == "ZN")
		{
			std::string S;
			for (const FZone& Z : HazardZones()) { if (!S.empty()) S += ";"; S += Z.Id + "^" + Z.Kind + "^" + Z.Name + "^" + Z.LandmarkId + "^" + N(Z.Radius) + "^" + Z.Hint; }
			Same(LineNo, "zones", S, F[1]);
		}
		else if (T == "LM")
		{
			const std::optional<FPoint> P = LandmarkPoint(F[1], Lookup);
			Same(LineNo, "landmark", P ? N(P->X) + "|" + N(P->Z) : None, F[2]);
		}
		else if (T == "RH")
		{
			const FHazardDef& D = RegionHazard(F[1] == None ? "" : F[1]);
			Same(LineNo, "region hazard", D.Id + "|" + D.Name + "|" + D.Hint, F[2]);
		}
		else if (T == "HA")
		{
			++Steps;
			const FHazardInput Hi{F[1] == None ? "" : F[1], Num(F[2]), Num(F[3]), F[4] == "1", Num(F[5])};
			SameNumbers(LineNo, "hazardAt", He(HazardAt(Hi)), F[6]);
		}
		else if (T == "ZA")
		{
			++Probes;
			SameNumbers(LineNo, "zoneAt", Ze(ZoneAt(Num(F[1]), Num(F[2]), Num(F[3]), F[4] == "1", Lookup)), F[5]);
		}
		else if (T == "CB")
		{
			const std::vector<std::string> Rf = Split(F[1], '|'), Zf = Split(F[2], '|');
			Same(LineNo, "combineHazard", He(CombineHazard(ParseHe(Rf, 0), ParseZe(Zf, 0))), F[3]);
		}
		else if (T == "RI") { const std::string Id = RegionIdAt(Num(F[1]), Num(F[2]), Regions); Same(LineNo, "regionIdAt", Id.empty() ? None : Id, F[3]); }
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d hazard steps, %d zone probes, %d checks (%d within float tolerance), %d mismatches\n", Steps, Probes, Checks, Near, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
