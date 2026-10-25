// Golden test for the C++ operator pockets: replays tools/gen-operator-golden.ts, recorded from the web build's real
// operator-pockets.ts and xp.ts. After every operation the played operator, its live pocket, all three stored pockets
// and the whole Nex ledger must match exactly.
#include "Core/WFOperatorCore.h"
#include "Core/WFJsCompat.h"
#include "Core/WFRewardCore.h"
#include "Core/WFVehicleCore.h"

#include <algorithm>
#include <charconv>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;

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
	int Checks = 0, Mismatches = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	std::string MapText(const std::map<std::string, double>& M)
	{
		std::string S;
		for (const auto& [K, V] : M) { if (!S.empty()) S += ","; S += K + "=" + N(V); }
		return S.empty() ? None : S;
	}
	std::string PocketText(const FProgression::FOperatorPocket& K)
	{
		return N(K.Level) + "/" + N(K.Xp) + "/" + N(K.Nex) + "/" + N(K.FractureShards) + "/" + MapText(K.Materials);
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: OperatorCoreTest <operator_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FProgression P;
	int Cases = 0, Ops = 0, Switches = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "C")
		{
			++Cases;
			P = FProgression{};
			P.FractureShards = 120; // DEFAULT_PROGRESSION
			P.PocketClass = F[1];
			if (Num(F[2]) > 0) P.NexLedger["seed:grant"] = Num(F[2]);
		}
		else if (T == "OP")
		{
			++Ops;
			const std::string& Op = F[1];
			if (Op == "xp") P = reward::GrantXP(P, F[2], Num(F[3]), std::nullopt, std::nullopt, Num(F[4])).Progression;
			else if (Op == "earn") P.NexLedger[F[2]] = Num(F[3]);
			else if (Op == "spend") vehicle::SpendNex(P.NexLedger, F[2], Num(F[3]));
			else if (Op == "mat") { double& M = P.Materials[F[2]]; M = std::max(0.0, M + Num(F[3])); }
			else if (Op == "shards") P.FractureShards = std::max(0.0, P.FractureShards + Num(F[2]));
			else if (Op == "switch") { if (operators::SwitchOperator(P, F[2] == "NONE" ? std::string() : F[2])) ++Switches; }
			else Same(LineNo, "op", Op, "known");
		}
		else if (T == "S")
		{
			std::string Stored;
			for (const char* Cls : { "TITAN", "HUNTER", "WARLOCK" }) { if (!Stored.empty()) Stored += "|"; Stored += PocketText(P.Operators.at(Cls)); }
			Same(LineNo, "played", P.PocketClass, F[1]);
			Same(LineNo, "live", PocketText(operators::LivePocket(P)), F[2]);
			Same(LineNo, "stored", Stored, F[3]);
			Same(LineNo, "ledger", MapText(P.NexLedger), F[4]);
		}
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d cases, %d operations, %d switches, %d checks, %d mismatches\n", Cases, Ops, Switches, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
