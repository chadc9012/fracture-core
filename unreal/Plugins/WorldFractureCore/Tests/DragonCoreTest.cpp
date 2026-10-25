// Golden test for the C++ Dragonite / Vyrak trust / riding rules: replays states recorded from the web build's real
// dragonite.ts, dragonite-cast.ts and vyrak-trust.ts (tools/gen-dragon-golden.ts).
//
// Everything compares exactly except the flight model, which calls sin/cos: V8 and the C runtime may differ in the
// last bit there, so flight numbers compare to 1e-9 relative.
#include "Core/WFDragonCore.h"
#include "Core/WFJsCompat.h"
#include "Core/WFScenarioCore.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::dragon;

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

	double Num(const std::string& S)
	{
		if (S == "NaN") return std::numeric_limits<double>::quiet_NaN();
		if (S == "Infinity") return std::numeric_limits<double>::infinity();
		if (S == "-Infinity") return -std::numeric_limits<double>::infinity();
		double V = 0;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		if (R.ec != std::errc() || R.ptr != S.data() + S.size()) throw std::runtime_error("bad number: " + S);
		return V;
	}

	std::optional<std::string> Opt(const std::string& S) { return S == None ? std::nullopt : std::optional<std::string>(S); }
	std::optional<std::string> OptEmpty(const std::string& S) { return S.empty() ? std::nullopt : std::optional<std::string>(S); }
	std::string N(double V) { return js::NumberToString(V); }

	FGearItem ParseGear(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		if (F.size() != 10) throw std::runtime_error("bad gear: " + S);
		FGearItem G;
		G.Id = F[0]; G.Name = F[1]; G.Slot = F[2]; G.Power = Num(F[3]); G.Level = Num(F[4]); G.Element = F[5]; G.Source = F[6];
		G.SetId = OptEmpty(F[7]); G.Rarity = OptEmpty(F[8]); G.Perk = OptEmpty(F[9]);
		return G;
	}

	std::string GearText(const FGearItem& G)
	{
		return G.Id + "|" + G.Name + "|" + G.Slot + "|" + N(G.Power) + "|" + N(G.Level) + "|" + G.Element + "|" + G.Source + "|" + G.SetId.value_or("") + "|" + G.Rarity.value_or("") + "|" + G.Perk.value_or("");
	}

	std::string StatsText(const FStats& S)
	{
		std::string Out;
		for (const auto& [K, V] : S) { if (!Out.empty()) Out += ","; Out += K + ":" + N(V); }
		return Out;
	}

	std::vector<std::string> Slots(const std::string& S) { return S == None ? std::vector<std::string>{} : Split(S, ','); }

	const FRideContext Contexts[] = {
		{std::nullopt, false, false, false}, {std::string("solara"), false, false, false}, {std::string("nexus"), false, false, false}, {std::string("neon"), false, false, false},
		{std::string("solara"), true, false, false}, {std::string("solara"), false, true, false}, {std::string("solara"), false, false, true},
	};

	std::string Describe(const FProgression& P, const std::optional<std::string>& Class)
	{
		std::string Out = "earned=[";
		for (size_t I = 0; I < P.EarnedRewards.size(); ++I) { if (I) Out += ","; Out += P.EarnedRewards[I]; }
		const auto D = P.Materials.find("dragonite");
		Out += "];dragonite=" + N(D == P.Materials.end() ? 0 : D->second) + ";inventory=[";
		for (size_t I = 0; I < P.Inventory.size(); ++I) { if (I) Out += ";"; Out += GearText(P.Inventory[I]); }
		const FTrust T = TrustOf(P, Class);
		Out += "];trust=" + N(T.Challenge) + "/" + N(T.Encounter) + "/" + N(T.Ruin) + "/" + N(T.Puzzle) + "/" + N(T.Protect) + "/" + N(T.Total);
		Out += ";stage=" + std::to_string(TrustStage(P, Class)) + ";ride=";
		for (size_t I = 0; I < std::size(Contexts); ++I)
		{
			if (I) Out += "|";
			const FRideCheck R = CanRide(P, Class, Contexts[I]);
			Out += R.bOk ? "ok" : R.Reason.value_or("");
		}
		Out += ";levels=";
		if (Class)
			for (size_t I = 0; I < 7; ++I) { if (I) Out += ","; Out += std::string(AbilityIds[I]) + "=" + std::to_string(UpgradeLevel(P, *Class, AbilityIds[I])); }
		else Out += None;
		Out += ";appearance=" + (Class ? std::to_string(AppearanceStage(wf::scenario::ClearCount(P, *Class))) : None);
		Out += ";stats=";
		for (size_t I = 0; I < 7; ++I)
		{
			if (I) Out += ";";
			Out += std::string(AbilityIds[I]) + "{" + StatsText(StatsFor(P, Class.value_or("null"), AbilityIds[I])) + "}";
		}
		return Out;
	}

	std::string WyrmText(const FWyrm& W)
	{
		return std::string(WyrmStateName(W.State)) + "/" + N(W.T) + "/" + N(W.Left) + "/" + N(W.StrafesLeft) + "/" + (W.Target ? N(*W.Target) : None) + "/" + N(W.Cooldown) + "/" + (W.bFinished ? "1" : "0");
	}

	size_t Checked = 0, Failures = 0;
	std::string CaseName;

	void Expect(const std::string& What, const std::string& Want, const std::string& Got, size_t Line)
	{
		++Checked;
		if (Want == Got) return;
		if (++Failures <= 6) std::fprintf(stderr, "MISMATCH %s in %s (line %zu)\n  want %s\n  got  %s\n", What.c_str(), CaseName.c_str(), Line, Want.c_str(), Got.c_str());
	}

	bool Close(double A, double B) { return A == B || (std::isnan(A) && std::isnan(B)) || std::fabs(A - B) <= 1e-9 * std::max(1.0, std::max(std::fabs(A), std::fabs(B))); }
}

int main(int Argc, char** Argv)
{
	const char* Path = Argc > 1 ? Argv[1] : "dragon_golden.txt";
	std::ifstream In(Path);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Path); return 2; }

	FProgression P;
	std::optional<std::string> Class;
	FWyrm Wyrm;
	FStats WyrmStats;
	FFlight Flight;
	std::optional<FUpgradeResult> Upgrade;
	std::optional<FClaimResult> Claim;
	std::string Line;
	size_t LineNo = 0, Steps = 0, ExactFlights = 0;
	double WorstFlight = 0;

	while (std::getline(In, Line))
	{
		++LineNo;
		if (Line.empty()) continue;
		const std::vector<std::string> F = Split(Line, '\t');
		const std::string& K = F[0];
		if (K == "C") { CaseName = F.at(1); Class = Opt(F.at(2)); P = FProgression{}; P.Inventory.clear(); P.Materials.clear(); P.EarnedRewards.clear(); }
		else if (K == "K") P.EarnedRewards.push_back(F.at(1));
		else if (K == "PM") P.Materials[F.at(1)] = Num(F.at(2));
		else if (K == "PI") P.Inventory.push_back(ParseGear(F.at(1)));
		else if (K == "PE") P.EquippedGear[F.at(1)] = F.at(2);
		else if (K == "U") { Upgrade = UpgradeDragonite(P, Class, F.at(1)); P = Upgrade->Progression; }
		else if (K == "RU") { Expect("upgrade", F.at(1), Upgrade && Upgrade->Error ? *Upgrade->Error : None, LineNo); Upgrade.reset(); }
		else if (K == "T") P = RecordTrust(std::move(P), Class, F.at(1), F.at(2));
		else if (K == "AB") { Claim = ClaimAncientBond(P, Class); P = Claim->Progression; }
		else if (K == "EC") { Claim = ClaimEternalCovenant(P, Class); P = Claim->Progression; }
		else if (K == "RC")
		{
			Expect("claim", F.at(1) + "|" + F.at(2), std::string(Claim && Claim->bOk ? "1" : "0") + "|" + (Claim && Claim->Reason ? *Claim->Reason : None), LineNo);
			Claim.reset();
		}
		else if (K == "S") { Expect("state", F.at(1), Describe(P, Class), LineNo); ++Steps; }
		else if (K == "DS")
		{
			const FStats S = DragoniteStats(F.at(1), Num(F.at(2)), ArmorBonus(Slots(F.at(3)), Opt(F.at(4))));
			Expect("dragoniteStats", F.at(5), StatsText(S), LineNo);
		}
		else if (K == "CR") Expect("cappedResist", F.at(3), N(CappedResist(Num(F.at(1)), Num(F.at(2)))), LineNo);
		else if (K == "W") { Wyrm = FWyrm{}; WyrmStats = DragoniteStats("wyrmcall", Num(F.at(1)), ArmorBonus(Slots(F.at(2)))); CaseName = "wyrm line " + std::to_string(LineNo); }
		else if (K == "WS")
		{
			const bool bOk = SummonWyrm(Wyrm, WyrmStats);
			Expect("summonWyrm", F.at(1) + "|" + F.at(2), std::string(bOk ? "1" : "0") + "|" + WyrmText(Wyrm), LineNo);
		}
		else if (K == "WT")
		{
			std::vector<FWyrmTarget> Targets;
			if (F.at(2) != None)
				for (const std::string& T : Split(F.at(2), ','))
				{
					const std::vector<std::string> X = Split(T, ':');
					Targets.push_back({Num(X.at(0)), Num(X.at(1)), X.at(2) == "1", X.at(3) == "1"});
				}
			const std::optional<FWyrmAction> A = StepWyrm(Wyrm, Num(F.at(1)), Targets, WyrmStats);
			Expect("stepWyrm", F.at(3) + "|" + F.at(4), (A ? A->Kind + ":" + N(A->Target) : None) + "|" + WyrmText(Wyrm), LineNo);
		}
		else if (K == "F") { Flight = CreateFlight(Num(F.at(1)), Num(F.at(2)), Num(F.at(3)), Num(F.at(4))); CaseName = "flight line " + std::to_string(LineNo); }
		else if (K == "FT")
		{
			bool bCalled = false;
			const double Ground = F.at(5) == None ? 0 : Num(F.at(5));
			Flight = StepFlight(Flight, Num(F.at(1)), Num(F.at(2)), Num(F.at(3)), Num(F.at(4)), [&](double, double) { bCalled = true; return Ground; });
			Expect("groundAt called", F.at(5) == None ? "no" : "yes", bCalled ? "yes" : "no", LineNo);
			const std::vector<std::string> Want = Split(F.at(6), ',');
			const double Got[] = {Flight.X, Flight.Y, Flight.Z, Flight.Yaw, Flight.Pitch, Flight.Bank, Flight.Speed};
			bool bOk = Want.size() == 7, bExact = true;
			for (size_t I = 0; bOk && I < 7; ++I)
			{
				const double W = Num(Want[I]);
				if (!Close(W, Got[I])) bOk = false;
				if (W != Got[I]) { bExact = false; WorstFlight = std::max(WorstFlight, std::fabs(W - Got[I])); }
			}
			if (bExact) ++ExactFlights;
			std::string GotText;
			for (size_t I = 0; I < 7; ++I) { if (I) GotText += ","; GotText += N(Got[I]); }
			Expect("stepFlight", bOk ? "ok" : F.at(6), bOk ? "ok" : GotText, LineNo);
		}
		else throw std::runtime_error("unknown line kind: " + K);
	}

	std::printf("%zu progression states, %zu checks, %zu mismatches (%zu flight steps bit-exact, worst flight difference %g)\n",
		Steps, Checked, Failures, ExactFlights, WorstFlight);
	return Failures == 0 && Steps > 0 ? 0 : 1;
}
