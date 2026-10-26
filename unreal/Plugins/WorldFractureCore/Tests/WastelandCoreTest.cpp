// Golden test for the C++ Wastelands activities: replays tools/gen-wasteland-golden.ts, recorded from the web build's real
// wasteland-activities.ts and wasteland-runtime.ts. The three state machines, the medals, every resolved save (with rewardMission
// replaced by the same trace stub on both sides) and the runtime against a fake world (alerts, spawns, HUD, emits, state) must match.
#include "Core/WFWastelandCore.h"
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
using namespace wf::wasteland;

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
	std::string O(const std::optional<std::string>& V) { return V ? *V : None; }
	std::string O(const std::string& V) { return V.empty() ? None : V; }
	int Checks = 0, Mismatches = 0;
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	/** V8's cos / sin can differ from the C library's in the last bit */
	void Near(int Line, const char* What, double Got, const std::string& Want)
	{
		++Checks;
		const double W = Num(Want);
		if (std::fabs(Got - W) > 1e-9 * std::max(1.0, std::fabs(W)) && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, N(Got).c_str(), Want.c_str());
	}

	std::string Vs(const FVaultRun& R) { return R.Id + "|" + R.Phase + "|" + N(R.Wave) + "|" + N(R.Gate) + "|" + N(R.Timer) + "|" + B(R.bSpawned) + "|" + O(R.Reason); }
	std::string Rs(const FRallyRun& R) { return R.Id + "|" + R.Phase + "|" + N(R.Next) + "|" + N(R.Time) + "|" + N(R.SinceCheckpoint) + "|" + O(R.Reason); }
	std::string Ds(const FDerbyRun& R) { return R.Id + "|" + R.Phase + "|" + N(R.Time) + "|" + N(R.Wrecks) + "|" + O(R.Reason); }
	std::string Kv(const std::map<std::string, double>& M)
	{
		std::string S;
		for (const auto& [K, V] : M) { if (!S.empty()) S += ","; S += K + "=" + N(V); }
		return S.empty() ? None : S;
	}
	std::string List(const std::vector<std::string>& Xs)
	{
		std::string S;
		for (const std::string& X : Xs) { if (!S.empty()) S += ","; S += X; }
		return S.empty() ? None : S;
	}
	std::string Ps(const FProgression& P) { return List(P.EarnedRewards) + "|" + Kv(P.Materials) + "|" + Kv(P.Records) + "|" + Kv(P.Story.Trust) + "|" + List(P.Story.Flags) + "|" + O(P.Blade); }
	std::vector<std::string> ParseList(const std::string& S) { return S == None ? std::vector<std::string>{} : Split(S, ','); }
	std::map<std::string, double> ParseKv(const std::string& S)
	{
		std::map<std::string, double> M;
		for (const std::string& E : ParseList(S)) { const size_t Eq = E.find('='); M[E.substr(0, Eq)] = Num(E.substr(Eq + 1)); }
		return M;
	}
	FProgression ParseP(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FProgression P;
		P.EarnedRewards = ParseList(F[0]); P.Materials = ParseKv(F[1]); P.Records = ParseKv(F[2]); P.Story.Trust = ParseKv(F[3]); P.Story.Flags = ParseList(F[4]);
		if (F[5] != None) P.Blade = F[5];
		return P;
	}
	/** the shim's rewardMission: the trace claim rm:<id>:<now> and the materials */
	FProgression WlReward(const FProgression& In, const std::string& Id, const std::vector<std::pair<std::string, double>>& Mats, double Now)
	{
		FProgression P = In;
		for (const auto& [K, V] : Mats) P.Materials[K] = (P.Materials.count(K) ? P.Materials[K] : 0) + V;
		P.EarnedRewards.push_back("rm:" + Id + ":" + N(Now));
		return P;
	}

	struct FMachine { bool bAlive = false; std::string Living; double X = 0, Z = 0; };
	std::string Hud(const std::optional<FHud>& H)
	{
		if (!H) return None;
		std::string L;
		for (const std::string& X : H->Lines) { if (!L.empty()) L += "/"; L += X; }
		return H->Kind + "|" + H->Title + "|" + L + "|" + (H->Progress ? N(*H->Progress) : None) + "|" + (H->Target ? N(H->Target->X) : None) + "|" + (H->Target ? N(H->Target->Z) : None);
	}
	std::string Em(const std::vector<FEmit>& Es)
	{
		std::string S;
		for (const FEmit& E : Es)
		{
			if (!S.empty()) S += ";";
			if (E.Type == "VAULT") S += "VAULT:" + E.RunId + ":" + E.Outcome + ":" + N(E.Gate) + ":" + O(E.Reason);
			else if (E.Type == "RALLY") S += "RALLY:" + E.RunId + ":" + N(E.Time);
			else S += "DERBY:" + E.RunId + ":" + N(E.Wrecks);
		}
		return S.empty() ? None : S;
	}
	std::string Rts(const FRuntime& R)
	{
		return (R.Vault ? Vs(*R.Vault) : None) + "#" + (R.Rally ? Rs(*R.Rally) : None) + "#" + (R.Derby ? Ds(*R.Derby) : None) + "#" + N(R.KillsSeen) + "#"
			+ B(R.Rearm.bVault) + B(R.Rearm.bRally) + B(R.Rearm.bDerby) + "#" + N(R.DoneHold) + "#" + O(R.Last);
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: WastelandCoreTest <wasteland_golden.txt>\n"); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FVaultRun V; FRallyRun R; FDerbyRun D;
	FProgression P;
	std::vector<FMachine> Pool;
	double Kills = 0, Hp = 10;
	FRuntime Rt;
	int Machines = 0, Resolves = 0, Frames = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const int LineNo = static_cast<int>(I) + 1;
		const std::string& T = F[0];
		if (T == "SITE")
		{
			Same(LineNo, "gate", N(VaultGate.X) + "," + N(VaultGate.Z) + "," + N(VaultGate.Radius), F[1]);
			Same(LineNo, "arena", N(Arena.X) + "," + N(Arena.Z) + "," + N(Arena.Radius), F[2]);
			Same(LineNo, "start", N(RallyStart.X) + "," + N(RallyStart.Z), F[3]);
			std::string Cps;
			for (const FPoint& C : RallyCheckpoints()) { if (!Cps.empty()) Cps += ";"; Cps += N(C.X) + "," + N(C.Z); }
			Same(LineNo, "checkpoints", Cps, F[4]);
		}
		else if (T == "LEN") { const FMedalTargets M = RallyTargets(); Same(LineNo, "rallyLength", N(RallyLength()), F[1]); Same(LineNo, "rallyTargets", N(M.Gold) + "|" + N(M.Silver) + "|" + N(M.Bronze), F[2]); }
		else if (T == "RM") Same(LineNo, "rallyMedal", O(RallyMedal(Num(F[1]))), F[2]);
		else if (T == "DM") Same(LineNo, "derbyMedal", O(DerbyMedal(Num(F[1]))), F[2]);
		else if (T == "TF") Same(LineNo, "toFixed", js::ToFixed(Num(F[1]), static_cast<int>(Num(F[2]))), F[3]);
		else if (T == "VST") { V = StartVault(Num(F[1])); Same(LineNo, "startVault", Vs(V), F[2]); }
		else if (T == "VS")
		{
			++Machines;
			FVaultInput VIn;
			VIn.Dt = Num(F[1]); VIn.TagAlive = static_cast<int>(Num(F[2])); VIn.NearGate = static_cast<int>(Num(F[3])); VIn.PlayerDist = Num(F[4]); VIn.bPlayerAlive = F[5] == "1";
			const FVaultStep S = StepVault(V, VIn);
			Same(LineNo, "vault", Vs(S.Run), F[6]);
			Same(LineNo, "vault spawn", S.SpawnWave ? N(S.SpawnWave->Size) + "," + N(S.SpawnWave->Elites) : None, F[7]);
			Same(LineNo, "vault outcome", O(S.Outcome), F[8]);
			V = S.Run;
		}
		else if (T == "RST") { R = StartRally(Num(F[1])); Same(LineNo, "startRally", Rs(R), F[2]); }
		else if (T == "RS")
		{
			++Machines;
			const FRallyStep S = StepRally(R, Num(F[1]), Num(F[2]), Num(F[3]), F[4] == "1");
			Same(LineNo, "rally", Rs(S.Run), F[5]);
			Same(LineNo, "rally checkpoint", S.Checkpoint ? N(*S.Checkpoint) : None, F[6]);
			Same(LineNo, "rally outcome", S.Outcome ? B(S.Outcome->bFinished) + "," + N(S.Outcome->Time) : None, F[7]);
			R = S.Run;
		}
		else if (T == "DST") { D = StartDerby(Num(F[1])); Same(LineNo, "startDerby", Ds(D), F[2]); }
		else if (T == "DS")
		{
			++Machines;
			const FDerbyStep S = StepDerby(D, Num(F[1]), F[2] == "1", F[3] == "1", Num(F[4]), static_cast<int>(Num(F[5])));
			Same(LineNo, "derby", Ds(S.Run), F[6]);
			Same(LineNo, "derby spawn", N(S.Spawn), F[7]);
			Same(LineNo, "derby outcome", S.Outcome ? N(*S.Outcome) : None, F[8]);
			D = S.Run;
		}
		else if (T == "P") { P = ParseP(F[1]); Same(LineNo, "progression round trip", Ps(P), F[1]); }
		else if (T == "RV" || T == "RR" || T == "RD")
		{
			++Resolves;
			FResolved Res;
			size_t K = 0;
			if (T == "RV") { Res = ResolveVault(WlReward, P, F[1], Num(F[2]), F[3] == None ? std::nullopt : std::optional<std::string>(F[3]), F[4], Num(F[5])); K = 6; }
			else if (T == "RR") { Res = ResolveRally(WlReward, P, F[1], Num(F[2]), Num(F[3])); K = 4; }
			else { Res = ResolveDerby(WlReward, P, F[1], Num(F[2]), Num(F[3])); K = 4; }
			Same(LineNo, "message", O(Res.Message), F[K]);
			Same(LineNo, "medal", O(Res.Medal), F[K + 1]);
			Same(LineNo, "save", Ps(Res.Progression), F[K + 2]);
			P = Res.Progression;
		}
		else if (T == "MR") Same(LineNo, "mergeRecords", Kv(MergeRecords(ParseKv(F[1]), ParseKv(F[2]))), F[3]);
		else if (T == "WC")
		{
			Kills = Num(F[1]); Hp = 10;
			Pool.assign(static_cast<size_t>(Num(F[2])), FMachine{F[3] == "1", "", -300, 180});
			Rt = CreateRuntime(Kills);
		}
		else if (T == "K") { Pool[static_cast<size_t>(Num(F[1]))].bAlive = false; ++Kills; }
		else if (T == "KX") ++Kills;
		else if (T == "MV") { FMachine& M = Pool[static_cast<size_t>(Num(F[1]))]; M.X = Num(F[2]); M.Z = Num(F[3]); }
		else if (T == "HP") Hp = Num(F[1]);
		else if (T == "WS")
		{
			++Frames;
			std::deque<std::pair<int, std::vector<std::string>>> Events;
			size_t J = I + 1;
			for (; J < Lines.size() && Lines[J].rfind("E\t", 0) == 0; ++J) Events.push_back({static_cast<int>(J) + 1, Split(Lines[J], '\t')});
			auto Next = [&](const char* Kind) -> std::pair<int, std::vector<std::string>>
			{
				if (Events.empty() || Events.front().second[1] != Kind) { Same(LineNo, "event", Kind, Events.empty() ? "(none)" : Events.front().second[1]); return {LineNo, {}}; }
				auto E = Events.front(); Events.pop_front(); return E;
			};
			FWorld W;
			W.Kills = Kills; W.Hp = Hp;
			W.TagCount = [&](const std::string& Tag, const std::optional<FSite>& Near) {
				int C = 0;
				for (const FMachine& M : Pool) if (M.bAlive && M.Living == Tag && (!Near || js::Hypot(M.X - Near->X, M.Z - Near->Z) <= Near->Radius)) ++C;
				return C;
			};
			W.Alert = [&](const std::string& Text) { const auto E = Next("alert"); if (!E.second.empty()) Same(E.first, "alert", Text, E.second[2]); };
			W.FreeSlots = [&](int Count, double Px, double Pz) { const auto E = Next("free"); if (!E.second.empty()) Same(E.first, "freeSlots", N(Count) + " " + N(Px) + " " + N(Pz), E.second[2] + " " + E.second[3] + " " + E.second[4]); };
			W.SpawnSquad = [&](const std::string& Tag, double X, double Z, int Size, int Elites, double Spread, int Kind) {
				const auto E = Next("spawn");
				if (E.second.empty()) return 0;
				const std::vector<std::string>& G = E.second;
				Same(E.first, "spawn", Tag + " " + N(Size) + " " + N(Elites) + " " + N(Spread) + " " + N(Kind), G[2] + " " + G[5] + " " + G[6] + " " + G[7] + " " + G[8]);
				Near(E.first, "spawn x", X, G[3]);
				Near(E.first, "spawn z", Z, G[4]);
				const double Rx = Num(G[3]), Rz = Num(G[4]); // place them where the web build did
				int Got = 0;
				for (int K = 0; K < Size; ++K)
				{
					FMachine* M = nullptr;
					for (FMachine& Q : Pool) if (!Q.bAlive) { M = &Q; break; }
					if (!M) break;
					M->bAlive = true; M->Living = Tag;
					M->X = Rx + ((K % 3) - 1) * Spread * 0.5; M->Z = Rz + (K / 3 - 1) * Spread * 0.5;
					++Got;
				}
				Same(E.first, "spawned", N(Got), G[9]);
				return Got;
			};
			W.Despawn = [&](const std::string& Tag) { for (FMachine& M : Pool) if (M.bAlive && M.Living == Tag) { M.bAlive = false; M.Living.clear(); } };
			FRuntimeInput RIn;
			RIn.Dt = Num(F[1]); RIn.NowMs = Num(F[2]); RIn.Px = Num(F[3]); RIn.Pz = Num(F[4]); RIn.bInVehicle = F[5] == "1"; RIn.bBlocked = F[6] == "1";
			const FRuntimeStep S = StepRuntime(Rt, W, RIn);
			if (!Events.empty()) Same(Events.front().first, "unconsumed event", "(none)", Events.front().second[1]);
			if (J >= Lines.size()) { Same(LineNo, "WR", "missing", "present"); break; }
			const std::vector<std::string> G = Split(Lines[J], '\t');
			Same(static_cast<int>(J) + 1, "emits", Em(S.Emits), G[1]);
			Same(static_cast<int>(J) + 1, "hud", Hud(S.Hud), G[2]);
			Same(static_cast<int>(J) + 1, "runtime", Rts(Rt), G[3]);
			I = J;
		}
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d machine steps, %d resolves, %d runtime frames, %d checks, %d mismatches\n", Machines, Resolves, Frames, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
