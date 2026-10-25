// Golden test for the C++ vehicle rules: replays vehicle-handling.ts, vehicle-surface.ts, vehicle-condition.ts and
// progression.ts rewardVehicle results recorded from the web build (tools/gen-vehicle-golden.ts). Handling states
// compare numbers to 1e-9 relative (stepVehicle uses exp); everything else exactly.
#include "Core/WFJsCompat.h"
#include "Core/WFVehicleCore.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::vehicle;

namespace
{
	const std::string None = "~";

	std::vector<std::string> Split(const std::string& S, char Sep)
	{
		std::vector<std::string> Out;
		std::string Cur;
		for (char C : S)
		{
			if (C == Sep) { Out.push_back(Cur); Cur.clear(); }
			else Cur += C;
		}
		Out.push_back(Cur);
		return Out;
	}
	std::vector<std::string> SplitNonEmpty(const std::string& S, char Sep) { return S.empty() ? std::vector<std::string>{} : Split(S, Sep); }

	double Num(const std::string& S)
	{
		double V = 0;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		if (R.ec != std::errc() || R.ptr != S.data() + S.size()) throw std::runtime_error("bad number: " + S);
		return V;
	}
	std::string N(double V) { return js::NumberToString(V); }
	std::string B(bool V) { return V ? "1" : "0"; }

	FCondition ParseCond(const std::string& S)
	{
		const auto F = Split(S, '|');
		return {Num(F.at(0)), Num(F.at(1)), Num(F.at(2)), Num(F.at(3))};
	}
	std::string CondText(const FCondition& C) { return N(C.Body) + "|" + N(C.Engine) + "|" + N(C.Tires) + "|" + N(C.Suspension); }

	std::map<std::string, double> ParseLedger(const std::string& S)
	{
		std::map<std::string, double> Out;
		for (const std::string& E : SplitNonEmpty(S, ','))
		{
			const size_t Eq = E.rfind('=');
			Out[E.substr(0, Eq)] = Num(E.substr(Eq + 1));
		}
		return Out;
	}
	std::string LedgerText(const std::map<std::string, double>& L)
	{
		std::string Out;
		for (const auto& [K, V] : L) { if (!Out.empty()) Out += ","; Out += K + "=" + N(V); }
		return Out;
	}

	std::string Join(const std::vector<std::string>& V)
	{
		std::string Out;
		for (const std::string& S : V) { if (!Out.empty()) Out += ","; Out += S; }
		return Out;
	}

	size_t Checked = 0, Failures = 0, Fuzzy = 0;
	std::string CaseName;

	bool FuzzyFields(const std::string& Want, const std::string& Got)
	{
		const auto A = Split(Want, '|'), Bv = Split(Got, '|');
		if (A.size() != Bv.size()) return false;
		for (size_t I = 0; I < A.size(); ++I)
		{
			if (A[I] == Bv[I]) continue;
			double X = 0, Y = 0;
			const auto Rx = std::from_chars(A[I].data(), A[I].data() + A[I].size(), X);
			const auto Ry = std::from_chars(Bv[I].data(), Bv[I].data() + Bv[I].size(), Y);
			if (Rx.ec != std::errc() || Ry.ec != std::errc()) return false;
			if (std::fabs(X - Y) > 1e-9 * std::max(1.0, std::max(std::fabs(X), std::fabs(Y)))) return false;
		}
		return true;
	}

	void Expect(const std::string& What, const std::string& Want, const std::string& Got, size_t Line, bool bFuzzy = false)
	{
		++Checked;
		if (Want == Got) return;
		if (bFuzzy && FuzzyFields(Want, Got)) { ++Fuzzy; return; }
		if (++Failures <= 6) std::fprintf(stderr, "MISMATCH %s in %s (line %zu)\n  want %s\n  got  %s\n", What.c_str(), CaseName.c_str(), Line, Want.c_str(), Got.c_str());
	}

	std::string StateText(const FStepResult& R)
	{
		return N(R.Speed) + "|" + N(R.Yaw) + "|" + N(R.Y) + "|" + N(R.Vy) + "|" + B(R.bAirborne) + "|" + N(R.Slip) + "|" + N(R.Roll) + "|" + N(R.Pitch) + "|" + B(R.bLanded) + "|" + B(R.bHardLanding) + "|" + B(R.bBlocked) + "|" + B(R.bSkidding);
	}
}

int main(int Argc, char** Argv)
{
	const char* Path = Argc > 1 ? Argv[1] : "vehicle_golden.txt";
	std::ifstream In(Path);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Path); return 2; }

	std::string Id, Domain, Line;
	FState St;
	size_t LineNo = 0, Steps = 0;
	bool bNewRunCheck = true;

	while (std::getline(In, Line))
	{
		++LineNo;
		if (Line.empty()) continue;
		const std::vector<std::string> F = Split(Line, '\t');
		const std::string& K = F[0];
		if (K == "V") { Id = F.at(1); Domain = F.at(2); CaseName = Id; St = FState{}; bNewRunCheck = true; }
		else if (K == "KIND") Expect("kind", F.at(1), KindFor(Id, Domain), LineNo);
		else if (K == "CAM")
		{
			double D = 0, H = 0;
			VehicleCamera(HandlingFor(Id, Domain), D, H);
			Expect("camera", F.at(1), N(D) + "|" + N(H), LineNo);
		}
		else if (K == "ST")
		{
			const auto I = Split(F.at(1), '|'), E = Split(F.at(2), '|'), W = Split(F.at(5), '|');
			FInput Input{Num(I.at(0)), Num(I.at(1)), Num(I.at(2)), Num(I.at(3)), Num(I.at(4)), I.at(5) == "1", I.at(6) == "1"};
			FEnv Env{Num(E.at(0)), Num(E.at(1)), Num(E.at(2)), Num(E.at(3)), E.at(4) == "1"};
			// the recorder starts each run from its own state: take it from the first step's inputs when the speed jumps
			(void)bNewRunCheck;
			const FStepResult R = StepVehicle(HandlingFor(Id, Domain), St, Input, Env, Num(F.at(3)), Num(F.at(4)));
			Expect("stepVehicle", F.at(5), StateText(R), LineNo, true);
			// continue from the recorded state so float noise never compounds
			St.Speed = Num(W.at(0)); St.Yaw = Num(W.at(1)); St.Y = Num(W.at(2)); St.Vy = Num(W.at(3)); St.bAirborne = W.at(4) == "1";
			St.Slip = Num(W.at(5)); St.Roll = Num(W.at(6)); St.Pitch = Num(W.at(7));
			++Steps;
		}
		else if (K == "RUN")
		{
			const auto S = Split(F.at(1), '|');
			St = FState{Num(S.at(0)), Num(S.at(1)), Num(S.at(2)), Num(S.at(3)), S.at(4) == "1", Num(S.at(5)), Num(S.at(6)), Num(S.at(7))};
		}
		else if (K == "EX")
		{
			const FExitCheck E = CanExitVehicle(HandlingFor(Id, Domain), St, F.at(1) == "1");
			Expect("canExit", F.at(2), E.bOk ? "ok" : E.Reason, LineNo);
		}
		else if (K == "SF") Expect("surfaceAt", F.at(4), SurfaceAt(F.at(1), Num(F.at(2)), Num(F.at(3))), LineNo);
		else if (K == "SG") Expect("surfaceGrip", F.at(3), N(SurfaceGrip(F.at(1), Num(F.at(2)))), LineNo);
		else if (K == "IM") Expect("impact", F.at(4), CondText(ImpactVehicle(ParseCond(F.at(1)), Num(F.at(2)), F.at(3))), LineNo);
		else if (K == "FX")
		{
			const FConditionEffects X = ConditionEffects(ParseCond(F.at(1)));
			Expect("effects", F.at(2), N(X.Speed) + "|" + N(X.Acceleration) + "|" + N(X.Grip) + "|" + N(X.Stability) + "|" + B(X.bDisabled), LineNo);
		}
		else if (K == "RP") { const FCondition C = ParseCond(F.at(1)); Expect("repair price", F.at(2), N(RepairPrice(C)) + "|" + N(RepairCost(C)), LineNo); }
		else if (K == "RV") Expect("recover", F.at(4), CondText(RecoverVehicle(ParseCond(F.at(1)), F.at(2) == "1", F.at(3) == "1")), LineNo);
		else if (K == "RR")
		{
			FGarage G;
			G.Conditions[F.at(3)] = ParseCond(F.at(2));
			std::map<std::string, double> Ledger = ParseLedger(F.at(1));
			std::string Msg;
			const bool bOk = RepairVehicle(G, Ledger, F.at(3), Num(F.at(4)), Msg);
			Expect("repairVehicle", F.at(5), B(bOk) + "|" + Msg + "|" + LedgerText(Ledger) + "|" + CondText(G.Conditions[F.at(3)]), LineNo);
		}
		else if (K == "TS")
		{
			const auto T = Split(F.at(1), '|');
			const std::optional<double> Gear = T.at(3) == None ? std::nullopt : std::optional<double>(Num(T.at(3)));
			Expect("topSpeed", F.at(2), N(TopSpeedFor(Num(T.at(0)), Num(T.at(1)), Num(T.at(2)), Gear, Num(T.at(4)), Num(T.at(5)))), LineNo);
		}
		else if (K == "RW")
		{
			const auto Bf = Split(F.at(1), '|');
			FGarage G;
			G.Owned = SplitNonEmpty(Bf.at(0), ',');
			G.Loadout = SplitNonEmpty(Bf.at(1), ',');
			if (Bf.at(2) != None) G.Selected = Bf.at(2);
			G = RewardVehicle(G, F.at(2));
			Expect("rewardVehicle", F.at(3), Join(G.Owned) + "|" + Join(G.Loadout) + "|" + G.Selected.value_or(None), LineNo);
		}
		else throw std::runtime_error("unknown line kind: " + K);
	}
	std::printf("%zu handling steps, %zu checks (%zu within float tolerance), %zu mismatches\n", Steps, Checked, Fuzzy, Failures);
	return Failures == 0 && Steps > 0 ? 0 : 1;
}
