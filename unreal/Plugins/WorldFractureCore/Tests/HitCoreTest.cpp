// Golden test for the C++ hit rules: replays tools/gen-hit-golden.ts, recorded from the web build's real weapon-elements.ts,
// weapon-meta.ts, weapon-evolution.ts, null-disruption.ts, maw-collapse.ts and enemy-reactions.ts.
#include "Core/WFHitCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <limits>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::hit;

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
		if (S == "Infinity") return std::numeric_limits<double>::infinity();
		if (S == "-Infinity") return -std::numeric_limits<double>::infinity();
		if (S == "NaN") return std::numeric_limits<double>::quiet_NaN();
		double V = 0;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		if (R.ec != std::errc() || R.ptr != S.data() + S.size()) throw std::runtime_error("bad number: " + S);
		return V;
	}
	std::string N(double V) { return js::NumberToString(V); }
	std::string B(bool V) { return V ? "1" : "0"; }
	std::string O(const std::string& V) { return V.empty() ? None : V; }
	int Checks = 0, Mismatches = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	std::string Join(const std::vector<std::string>& Xs, const char* Sep)
	{
		std::string S;
		for (const std::string& X : Xs) { if (!S.empty()) S += Sep; S += X; }
		return S;
	}
	std::string Cls(const std::string& S) { return S == None ? "" : S; }
	std::string Gi(const FGearItem& G) { return G.Id + "^" + G.Slot + "^" + N(G.Power) + "^" + N(G.Level) + "^" + G.Element + "^" + (G.Evolution ? G.Evolution->RuinId + "+" + G.Evolution->Ability : None); }
	std::string Ps(const FProgression& P)
	{
		std::vector<std::string> Inv;
		for (const FGearItem& G : P.Inventory) Inv.push_back(Gi(G));
		std::string Mats;
		for (const auto& [K, V] : P.Materials) { if (!Mats.empty()) Mats += ","; Mats += K + "=" + N(V); }
		return (Inv.empty() ? None : Join(Inv, ";")) + "|" + (P.EarnedRewards.empty() ? None : Join(P.EarnedRewards, ",")) + "|" + (Mats.empty() ? None : Mats);
	}
	FProgression ParseP(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FProgression P;
		if (F[0] != None)
			for (const std::string& E : Split(F[0], ';'))
			{
				const std::vector<std::string> X = Split(E, '^');
				FGearItem G;
				G.Id = X[0]; G.Slot = X[1]; G.Power = Num(X[2]); G.Level = Num(X[3]); G.Element = X[4];
				if (X[5] != None) { const size_t Plus = X[5].find('+'); G.Evolution = FGearItem::FEvolution{X[5].substr(0, Plus), X[5].substr(Plus + 1)}; }
				P.Inventory.push_back(G);
			}
		if (F[1] != None) P.EarnedRewards = Split(F[1], ',');
		if (F[2] != None) for (const std::string& E : Split(F[2], ',')) { const size_t Eq = E.find('='); P.Materials[E.substr(0, Eq)] = Num(E.substr(Eq + 1)); }
		return P;
	}
	std::string Rs(const std::optional<FReaction>& R) { return R ? R->Kind + "|" + N(R->Until) + "|" + N(R->Start) + "|" + N(R->Dx) + "|" + N(R->Dz) + "|" + N(R->K) + "|" + R->Part : None; }
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: HitCoreTest <hit_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FStatuses St;
	FVuln Vuln;
	std::optional<FReaction> React;
	FProgression P;
	FNullCharge Null;
	FMaw Maw;
	int Cases = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		++Cases;
		if (T == "SE") { St = FStatuses{}; Vuln = FVuln{1, 0}; }
		else if (T == "EH")
		{
			const double Now = Num(F[2]);
			const FElementEffect Fx = ApplyElementHit(St, F[1], Now, F[3] == "1");
			if (Fx.Vuln) Vuln = MergeVuln(Vuln, *Fx.Vuln, Now);
			const double Dt = Num(F[10]);
			Same(LineNo, "element hit", O(Fx.Status) + " " + N(Fx.Stun) + " " + (Fx.Vuln ? N(Fx.Vuln->Mult) + ":" + N(Fx.Vuln->Until) : None) + " " + N(St.BurnUntil) + "|" + N(St.ChillUntil) + "|" + N(St.ShockReadyAt)
				+ " " + N(Vuln.Mult) + ":" + N(Vuln.Until) + " " + N(StatusSpeedMult(&St, Now + Dt)) + " " + N(BurnDamage(&St, Now + Dt, Dt)),
				F[4] + " " + F[5] + " " + F[6] + " " + F[7] + " " + F[8] + " " + F[9] + " " + F[11]);
		}
		else if (T == "WM")
		{
			const double D = Num(F[3]);
			Same(LineNo, "weapon meta", N(RangeFalloff(F[1], D)) + " " + N(PrecisionFor(F[1], Cls(F[2]))) + " " + N(HitMultiplier(F[1], D, F[4] == "1", Cls(F[2]))), F[5] + " " + F[6] + " " + F[7]);
		}
		else if (T == "PW")
		{
			std::vector<double> Powers;
			if (F[1] != None) for (const std::string& X : Split(F[1], ',')) Powers.push_back(Num(X));
			const double Op = OperatorPower(Powers, Num(F[2])), Ep = EnemyPower(Num(F[3]), F[4] == "1", F[5] == "1");
			Same(LineNo, "power", N(Op) + " " + N(Ep) + " " + N(PowerScale(Op - Ep)), F[6] + " " + F[7] + " " + F[8]);
		}
		else if (T == "PS") Same(LineNo, "powerScale", N(PowerScale(Num(F[1]))), F[2]);
		else if (T == "HP") Same(LineNo, "hitPart", HitPart(Num(F[1]), Num(F[2]), Num(F[3])), F[4]);
		else if (T == "RT") React.reset();
		else if (T == "RE")
		{
			const double Now = Num(F[5]);
			React = ReactTo(React, Num(F[1]), Num(F[2]), F[3] == "1", F[4] == "1", Now, Num(F[6]), Num(F[7]), Cls(F[8]));
			Same(LineNo, "reactTo", Rs(React) + " " + B(IsStaggeredNow(React, Now + 0.1)), F[9] + " " + F[10]);
		}
		else if (T == "RU")
		{
			const FRuin* R = RuinById(F[1]);
			Same(LineNo, "ruin", R ? R->Name + "|" + R->RegionId + "|" + R->Element + "|" + R->Ability + "|" + R->Material + "|" + R->Blurb + "|" + N(R->X) + "|" + N(R->Z) : "missing",
				F[2] + "|" + F[3] + "|" + F[4] + "|" + F[5] + "|" + F[6] + "|" + F[7] + "|" + F[8] + "|" + F[9]);
		}
		else if (T == "AE") Same(LineNo, "ability element", RuinElementOf(F[1]) + " " + N(EvolutionDamageMult(F[1], true)) + " " + N(EvolutionDamageMult(F[1], false)), F[2] + " " + F[3] + " " + F[4]);
		else if (T == "EV")
		{
			FCharge C;
			std::vector<std::string> Seq;
			for (int K = 0; K < 20; ++K) { const bool bBurst = RegisterEvolutionHit(C, F[1]); Seq.push_back(B(bBurst) + N(C.Hits)); }
			Same(LineNo, "evolution hits", Join(Seq, ","), F[2]);
		}
		else if (T == "BT")
		{
			std::vector<FPoint> Others;
			if (F[4] != None) for (const std::string& X : Split(F[4], ';')) { const std::vector<std::string> Xz = Split(X, ':'); Others.push_back({Num(Xz[0]), Num(Xz[1])}); }
			std::vector<std::string> Got;
			for (size_t K : BurstTargets({Num(F[2]), Num(F[3])}, Others, F[1])) Got.push_back(N(static_cast<double>(K))); // indexOf: object identity
			Same(LineNo, "burstTargets", Got.empty() ? None : Join(Got, ","), F[5]);
		}
		else if (T == "P") { P = ParseP(F[1]); Same(LineNo, "save round trip", Ps(P), F[1]); }
		else if (T == "DN") { P = DiscoverNearby(P, Num(F[1]), Num(F[2])); Same(LineNo, "discoverNearby", Ps(P), F[3]); }
		else if (T == "CE")
		{
			const FRuin* R = RuinById(F[1]);
			const FEvolveCheck C = CanEvolve(P, *R, F[2]);
			P = EvolveWeapon(P, F[1], F[2]);
			Same(LineNo, "evolve", B(C.bOk) + ":" + O(C.Reason) + " " + Ps(P), F[3] + " " + F[4]);
		}
		else if (T == "NC") Null = FNullCharge{};
		else if (T == "NH")
		{
			const bool bPulse = RegisterNullHit(Null, Num(F[1]), F[2] == "1", Num(F[3]));
			Same(LineNo, "null hit", B(bPulse) + " " + N(Null.Charge) + "|" + N(Null.LastTimedAt) + "|" + N(Null.CooldownUntil) + "|" + N(Null.LastEventId), F[4] + " " + F[5]);
		}
		else if (T == "MC") Maw = FMaw{};
		else if (T == "MR") { Maw = ResetMaw(Maw); Same(LineNo, "resetMaw", N(Maw.Hunger) + "|" + N(Maw.LastHitAt) + "|" + N(Maw.CooldownUntil) + "|" + N(Maw.LastEventId), F[1]); }
		else if (T == "MH")
		{
			const bool bCollapse = RegisterMawHit(Maw, Num(F[1]), Num(F[2]));
			Same(LineNo, "maw hit", B(bCollapse) + " " + N(Maw.Hunger) + "|" + N(Maw.LastHitAt) + "|" + N(Maw.CooldownUntil) + "|" + N(Maw.LastEventId), F[3] + " " + F[4]);
		}
		else if (T == "ME")
		{
			const std::optional<FMawEffect> E = MawEffect(Num(F[1]), Num(F[2]), Num(F[3]));
			Same(LineNo, "mawEffect", E ? N(E->PullX) + "|" + N(E->PullZ) + "|" + N(E->Damage) : None, F[4]);
		}
		else { --Cases; Same(LineNo, "line", T, "known"); }
	}
	std::printf("%d cases, %d checks, %d mismatches\n", Cases, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
