// Golden test for the C++ city systems: replays tools/gen-city-golden.ts, recorded from the web build's real heat.ts,
// stealth.ts, chase-ai.ts, quest-signals.ts and createSim turret layout.
#include "Core/WFCityCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::city;

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
	int Checks = 0, Mismatches = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	std::vector<FRegionCircle> Regions()
	{
		// the safe and starter regions of the Regions DataTable (world.ts REGIONS, scaled); everything else has no turrets
		return {
			{"nexus", "safe", 48, -228, 26},
			{"veridan", "starter", 432, -60, 204},
		};
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: CityCoreTest <city_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	std::vector<FTurret> Turrets = MakeTurrets(Regions(), nullptr);
	size_t TurretIndex = 0;
	std::vector<FSensor> Sensors = NexusSensors(Turrets);
	size_t SensorIndex = 0;
	FQuestSignals Sig;
	int Snapshots = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "HM") Same(LineNo, "stepHeatMeter", N(StepHeatMeter(Num(F[1]), Num(F[2]), Num(F[3]))), F[4]);
		else if (T == "HS") { const FHeatStatus S = HeatStatus(Num(F[1])); Same(LineNo, "heatStatus", std::to_string(S.Level) + "|" + S.Label + "|" + S.Response, F[2]); }
		else if (T == "VD")
		{
			const FDamageEffect E = VehicleDamageStage(Num(F[1]));
			Same(LineNo, "vehicleDamageStage", std::string(E.Stage) + "|" + N(E.SpeedMult) + "|" + N(E.HandlingMult) + "|" + (E.bWeaponsDisabled ? "1" : "0"), F[2]);
		}
		else if (T == "FF") Same(LineNo, "shouldForceFootTransition", ShouldForceFootTransition(F[1], F[2] == "1") ? "1" : "0", F[3]);
		else if (T == "VC") Same(LineNo, "inVisionCone", InVisionCone(FSensor{Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4])}, Num(F[5]), Num(F[6])) ? "1" : "0", F[7]);
		else if (T == "DM") Same(LineNo, "stepDetectionMeter", N(StepDetectionMeter(Num(F[1]), Num(F[2]), F[3] == "1", F[4] == "1")), F[5]);
		else if (T == "DS") Same(LineNo, "detectionStateFor", DetectionStateFor(Num(F[1])), F[2]);
		else if (T == "LS") { const FLockdownStatus L = LockdownStatus(Num(F[1])); Same(LineNo, "lockdownStatus", L.Tier + "|" + L.Label + "|" + L.Response, F[2]); }
		else if (T == "HK") Same(LineNo, "stepHackProgress", N(StepHackProgress(Num(F[1]), Num(F[2]), F[3])), F[4]);
		else if (T == "TU")
		{
			const std::string Got = TurretIndex < Turrets.size() ? N(Turrets[TurretIndex].X) + "\t" + N(Turrets[TurretIndex].Z) + "\t" + Turrets[TurretIndex].Zone + "\t" + N(Turrets[TurretIndex].Rot) + "\t" + N(Turrets[TurretIndex].Range) : "missing";
			++TurretIndex;
			Same(LineNo, "turret", Got, F[1] + "\t" + F[2] + "\t" + F[3] + "\t" + F[4] + "\t" + F[5]);
		}
		else if (T == "NS")
		{
			const std::string Got = SensorIndex < Sensors.size() ? N(Sensors[SensorIndex].X) + "\t" + N(Sensors[SensorIndex].Z) + "\t" + N(Sensors[SensorIndex].Rot) + "\t" + N(Sensors[SensorIndex].Range) : "missing";
			++SensorIndex;
			Same(LineNo, "sensor", Got, F[1] + "\t" + F[2] + "\t" + F[3] + "\t" + F[4]);
		}
		else if (T == "QC") Sig = FQuestSignals{};
		else if (T == "QH")
		{
			++Snapshots;
			FQuestHud H;
			H.RegionId = F[1] == None ? "" : F[1];
			H.HeatLevel = static_cast<int>(Num(F[2]));
			H.LockdownTier = F[3];
			H.HackProgress = Num(F[4]);
			H.bDiving = F[5] == "1";
			H.Kills = Num(F[6]);
			H.Hp = Num(F[7]);
			std::string Got;
			for (const FSignalEvent& E : QuestEventsFromHud(Sig, H, Num(F[8])))
			{
				if (!Got.empty()) Got += ",";
				if (E.Type == "ENTER_WORLD" || E.Type == "KILL") Got += E.Type + ":" + E.World;
				else if (E.Type == "HEAT_LEVEL") Got += "HEAT_LEVEL:" + N(E.Number);
				else if (E.Type == "LOCKDOWN_TIER") Got += "LOCKDOWN_TIER:" + E.Tier;
				else if (E.Type == "SURVIVED") Got += "SURVIVED:" + E.World + ":" + N(E.Number);
				else Got += E.Type;
			}
			Same(LineNo, "questEventsFromHud", Got.empty() ? None : Got, F[9]);
		}
		else Same(LineNo, "line", T, "known");
	}
	Same(0, "turret count", std::to_string(Turrets.size()), std::to_string(TurretIndex));
	std::printf("%d quest snapshots, %zu turrets, %d checks, %d mismatches\n", Snapshots, Turrets.size(), Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
