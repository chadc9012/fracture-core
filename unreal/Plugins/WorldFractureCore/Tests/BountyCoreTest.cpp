// Golden test for the C++ activity bounties: replays tools/gen-bounty-golden.ts, recorded from the web build's real
// activity-payouts.ts. Every payout, key and the whole ledger after each step must match.
#include "Core/WFBountyCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::bounty;

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
	std::string Led(const FLedger& L)
	{
		std::string S;
		for (const auto& [K, V] : L) { if (!S.empty()) S += ","; S += K + "=" + N(V); }
		return S.empty() ? None : S;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: BountyCoreTest <bounty_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FLedger L;
	int Ledgers = 0, Payouts = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "DAY") Same(LineNo, "dayOf", DayOf(Num(F[1])), F[2]);
		else if (T == "C") { ++Ledgers; L.clear(); }
		else if (T == "SEED") L[F[1]] = Num(F[2]);
		else if (T == "PF")
		{
			++Payouts;
			const std::optional<FPayout> P = PayoutFor(L, F[1], F[2], Num(F[3]), Num(F[4]), F[5] == None ? "" : F[5]);
			Same(LineNo, "payoutFor", P ? P->Key + "|" + N(P->Nex) + "|" + (P->bFirst ? "1" : "0") : None, F[6]);
		}
		else if (T == "PI")
		{
			++Payouts;
			const FPayout P = PayInto(L, F[1], F[2], Num(F[3]), Num(F[4]), F[5] == None ? "" : F[5]);
			Same(LineNo, "payInto", N(P.Nex) + "|" + (P.bFirst ? "1" : "0"), F[6]);
		}
		else if (T == "TG") Same(LineNo, "tagLegacyPayouts", TagLegacyPayouts(L, F[1]) ? "1" : "0", F[2]);
		else if (T == "FL") Same(LineNo, "payFlat", PayFlat(L, F[1], Num(F[2])) ? "1" : "0", F[3]);
		else if (T == "L") Same(LineNo, "ledger", Led(L), F[1]);
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d ledgers, %d payouts, %d checks, %d mismatches\n", Ledgers, Payouts, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
