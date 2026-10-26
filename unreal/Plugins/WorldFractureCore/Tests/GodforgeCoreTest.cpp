// Golden test for the C++ Godforge, secrets, foundries and on-foot weapon heat: replays tools/gen-godforge-golden.ts, recorded from
// the web build's real godforge.ts, secrets.ts, foundries.ts and sim.ts fireBullet / fireLauncher. Every forge action's result,
// message or error, and the whole save after it must match.
#include "Core/WFFoundryCore.h"
#include "Core/WFGodforgeCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::godforge;

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
	std::string List(const std::vector<std::string>& Xs) { return Xs.empty() ? None : Join(Xs, ","); }
	std::string Kv(const std::map<std::string, double>& M)
	{
		std::string S;
		for (const auto& [K, V] : M) { if (!S.empty()) S += ","; S += K + "=" + N(V); }
		return S.empty() ? None : S;
	}
	std::vector<std::string> ParseList(const std::string& S, char Sep = ',') { return S == None ? std::vector<std::string>{} : Split(S, Sep); }
	std::map<std::string, double> ParseKv(const std::string& S)
	{
		std::map<std::string, double> M;
		for (const std::string& E : ParseList(S)) { const size_t Eq = E.find('='); M[E.substr(0, Eq)] = Num(E.substr(Eq + 1)); }
		return M;
	}
	std::string Item(const FGearItem& I)
	{
		std::string G = None;
		if (I.Godforge) G = I.Godforge->Tier + "+" + (I.Godforge->Runes.empty() ? None : Join(I.Godforge->Runes, ".")) + "+" + N(I.Godforge->Kills) + "+" + B(I.Godforge->bAwakened);
		return I.Id + "^" + I.Name + "^" + I.Slot + "^" + N(I.Power) + "^" + N(I.Level) + "^" + I.Element + "^" + I.Source + "^" + I.Rarity.value_or(None) + "^" + G;
	}
	std::string Ps(const FProgression& P)
	{
		std::vector<std::string> Inv, Nem;
		for (const FGearItem& I : P.Inventory) Inv.push_back(Item(I));
		for (const FProgression::FNemesis& X : P.Nemeses) Nem.push_back(X.Id + ":" + X.Status);
		return List(P.EarnedRewards) + "|" + Kv(P.Materials) + "|" + N(P.FractureShards) + "|" + (Inv.empty() ? None : Join(Inv, ";")) + "|"
			+ (Nem.empty() ? None : Join(Nem, ",")) + "|" + List(P.Story.Collectibles) + "|" + Kv(P.NexLedger);
	}
	FProgression ParseP(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FProgression P;
		P.EarnedRewards = ParseList(F[0]);
		P.Materials = ParseKv(F[1]);
		P.FractureShards = Num(F[2]);
		for (const std::string& E : ParseList(F[3], ';'))
		{
			const std::vector<std::string> X = Split(E, '^');
			FGearItem I;
			I.Id = X[0]; I.Name = X[1]; I.Slot = X[2]; I.Power = Num(X[3]); I.Level = Num(X[4]); I.Element = X[5]; I.Source = X[6];
			if (X[7] != None) I.Rarity = X[7];
			if (X[8] != None)
			{
				const std::vector<std::string> G = Split(X[8], '+');
				I.Godforge = FGearItem::FGodforge{G[0], ParseList(G[1], '.'), Num(G[2]), G[3] == "1"};
			}
			P.Inventory.push_back(I);
		}
		for (const std::string& E : ParseList(F[4])) { const size_t C = E.find(':'); P.Nemeses.push_back({E.substr(0, C), E.substr(C + 1)}); }
		P.Story.Collectibles = ParseList(F[5]);
		P.NexLedger = ParseKv(F[6]);
		return P;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: GodforgeCoreTest <godforge_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	std::map<std::string, FRegionCircle> Regions;
	auto RegionOf = [&](const std::string& Id) -> std::optional<FRegionCircle> { const auto It = Regions.find(Id); if (It == Regions.end()) return std::nullopt; return It->second; };
	FProgression P;
	FForgeResult Pending;
	bool bPending = false;
	int Foundries = 0, Pulls = 0, Actions = 0, Queries = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "SITE") Same(LineNo, "places", N(HollowCrownX) + " " + N(HollowCrownZ) + " " + N(HollowCrownRadius) + " " + N(VaelX) + " " + N(VaelZ), F[1] + " " + F[2] + " " + F[3] + " " + F[4] + " " + F[5]);
		else if (T == "REG") Regions[F[1]] = {Num(F[2]), Num(F[3]), Num(F[4])};
		else if (T == "SP")
		{
			const FSecret* S = nullptr;
			for (const FSecret& X : Secrets()) if (X.Id == F[1]) S = &X;
			if (!S) { Same(LineNo, "secret", "missing", F[1]); continue; }
			const FRegionCircle At = SecretPoint(*S, *RegionOf(S->RegionId));
			Same(LineNo, "secretPoint", N(At.X) + " " + N(At.Z), F[2] + " " + F[3]);
		}
		else if (T == "FO") { ++Foundries; Same(LineNo, "foundryOf", O(foundry::FoundryOfName(F[1], F[2])), F[3]); }
		else if (T == "FR")
		{
			const foundry::FFootRules R = foundry::FootRules(F[1] == None ? "" : F[1], F[2] == "1");
			Same(LineNo, "foot rules", N(R.HeatMult) + "|" + N(R.RecoilMult) + "|" + N(R.HipMult), F[3]);
		}
		else if (T == "FB" || T == "FL")
		{
			++Pulls;
			vweapons::FHeat H{Num(F[1]), F[2] == "1"};
			bool bTipped = false;
			std::string Got;
			// fire first: the operands of + are evaluated in no fixed order
			if (T == "FB") { const int Fired = foundry::FireFootBullets(H, Num(F[3]), Num(F[4]), static_cast<int>(Num(F[5])), bTipped); Got = N(Fired); }
			else { const bool bFired = foundry::FireFootLauncher(H, Num(F[3]), Num(F[4]), bTipped); Got = B(bFired); }
			Got += " " + N(H.Heat) + " " + B(H.bOverheated);
			const size_t K = T == "FB" ? 6 : 5;
			Same(LineNo, T == "FB" ? "fireBullet" : "fireLauncher", Got, F[K] + " " + F[K + 1] + " " + F[K + 2]);
		}
		else if (T == "P") { P = ParseP(F[1]); Same(LineNo, "save round trip", Ps(P), F[1]); }
		else if (T == "FG") { Pending = ForgeRelic(P, F[1], Num(F[2])); bPending = true; }
		else if (T == "SO") { Pending = SocketRune(P, F[1], F[2]); bPending = true; }
		else if (T == "RR") { Pending = RemoveRune(P, F[1], F[2]); bPending = true; }
		else if (T == "AS") { Pending = AscendRelic(P, F[1]); bPending = true; }
		else if (T == "RK") { Pending = RecordRelicKills(P, F[1], Num(F[2])); bPending = true; }
		else if (T == "CD") { Pending = CollectRuneDust(P); bPending = true; }
		else if (T == "CH") { Pending = ClaimHeart(P); bPending = true; }
		else if (T == "CS")
		{
			FSecretContext Ctx;
			Ctx.bNight = F[2] == "1"; Ctx.bStorm = F[3] == "1"; Ctx.bNemesisSlain = F[4] == "1"; Ctx.bPledged = F[5] == "1";
			Pending = ClaimSecret(P, F[1], Ctx); bPending = true;
		}
		else if (T == "R")
		{
			if (!bPending) { Same(LineNo, "result", "no action", "action"); continue; }
			++Actions;
			bPending = false;
			Same(LineNo, "ok", B(Pending.bOk), F[1]);
			Same(LineNo, Pending.bOk ? "message" : "error", O(Pending.bOk ? Pending.Message : Pending.Error), F[2]);
			if (Pending.bOk) P = Pending.Progression;
			Same(LineNo, "save", Ps(P), F[3]);
		}
		else if (T == "Q")
		{
			++Queries;
			const double X = Num(F[1]), Z = Num(F[2]);
			FSecretContext Ctx;
			Ctx.bNight = F[3] == "1"; Ctx.bStorm = F[4] == "1"; Ctx.bNemesisSlain = F[5] == "1"; Ctx.bPledged = F[6] == "1";
			std::vector<std::string> Unlocked;
			for (const FRune& R : Runes()) if (RuneUnlocked(P, R.Id)) Unlocked.push_back(R.Id);
			const std::optional<FSensed> Sensed = SenseSecret(X, Z, Ctx, P.EarnedRewards, RegionOf);
			std::vector<std::string> Relics;
			for (const FGearItem& Item : P.Inventory)
			{
				if (!Item.Godforge) continue;
				const FRuneCombat R = RuneCombat(&*Item.Godforge);
				Relics.push_back(Item.Id + ":" + (R.Bursts.empty() ? None : Join(R.Bursts, ".")) + ":" + B(R.bDevour) + B(R.bRift) + B(R.bWard) + B(R.bReap) + B(R.bAwakened) + ":" + RelicElement(Item.Godforge->Runes));
			}
			const std::string Got = ForgeStage(P) + "|" + N(MarksFound(P)) + "|" + B(GuardianDue(P, X, Z)) + "|" + B(VaelNear(P, X, Z)) + "|" + (Unlocked.empty() ? None : Join(Unlocked, "."))
				+ "|" + (Sensed ? Sensed->Secret->Id + ":" + N(Sensed->Dist) + ":" + B(Sensed->bOpen) : None) + "|" + (Relics.empty() ? None : Join(Relics, ";"));
			Same(LineNo, "query", Got, F[7]);
		}
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d foundry names, %d trigger pulls, %d forge actions, %d queries, %d checks, %d mismatches\n", Foundries, Pulls, Actions, Queries, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
