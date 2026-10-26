#include "Core/WFWastelandCore.h"

#include "Core/WFArmsCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>

namespace wf::wasteland
{
	namespace
	{
		std::string WlN(double V) { return js::NumberToString(V); }
		bool WlHas(const std::vector<std::string>& Xs, const std::string& X) { return std::find(Xs.begin(), Xs.end(), X) != Xs.end(); }
		std::string WlLower(std::string S) { for (char& C : S) C = static_cast<char>(C >= 'A' && C <= 'Z' ? C - 'A' + 'a' : C); return S; }
		std::string WlBladeName(const std::string& Id)
		{
			for (const arms::FBlade& B : arms::Blades()) if (B.Id == Id) return B.Name;
			return Id;
		}
		using FMats = std::vector<std::pair<std::string, double>>;
		/** MEDAL_PAY, in the web build's key order (the reward line lists them in that order) */
		const FMats& WlMedalPay(const std::string& Medal)
		{
			static const FMats Gold{{"tuningCore", 2}, {"vehicleParts", 8}}, Silver{{"tuningCore", 1}, {"vehicleParts", 5}}, Bronze{{"vehicleParts", 4}, {"fuel", 6}};
			return Medal == "GOLD" ? Gold : Medal == "SILVER" ? Silver : Bronze;
		}
		std::string WlMatText(const FMats& M)
		{
			std::string S;
			for (const auto& [K, V] : M) { if (!S.empty()) S += ", "; S += "+" + WlN(V) + " " + K; }
			return S;
		}
		std::string WlJoin(const std::vector<std::string>& Xs, const char* Sep)
		{
			std::string S;
			for (const std::string& X : Xs) { if (!S.empty()) S += Sep; S += X; }
			return S;
		}

		/** pay each medal tier (and the ones below it) once, ever */
		std::vector<std::string> WlPayMedals(FProgression& P, const std::string& Activity, const std::string& Medal)
		{
			std::vector<std::string> Lines;
			if (Medal.empty()) return Lines;
			static const char* const Order[3] = {"BRONZE", "SILVER", "GOLD"};
			for (const char* Tier : Order)
			{
				const std::string M = Tier;
				const std::string Key = "medal:" + Activity + ":" + M;
				if (!WlHas(P.EarnedRewards, Key))
				{
					const FMats& Pay = WlMedalPay(M);
					for (const auto& [K, V] : Pay) P.Materials[K] = (P.Materials.count(K) ? P.Materials[K] : 0) + V;
					P.EarnedRewards.push_back(Key);
					Lines.push_back(WlLower(M) + " medal: " + WlMatText(Pay));
					if (M == "GOLD")
					{
						// foundries.ts: gold medals award a monoblade
						const std::string Blade = Activity == RallyId ? "sun-cutter" : Activity == DerbyId ? "aegis-broadsword" : "";
						if (!Blade.empty() && GrantBlade(P, Blade)) Lines.push_back("you earned the " + WlBladeName(Blade));
					}
				}
				if (Medal == M) break;
			}
			return Lines;
		}
		int WlCeil(double V) { return static_cast<int>(std::ceil(V)); }
	}

	const std::vector<FPoint>& RallyCheckpoints()
	{
		// authored offsets from the Wastelands centre
		static const std::vector<FPoint> Points = []()
		{
			const double Off[10][2] = {{26, 99}, {92, 79}, {110, 12}, {63, -38}, {5, -39}, {-111, -38}, {-125, 12}, {-111, 62}, {-74, 99}, {-24, 113}};
			std::vector<FPoint> Out;
			for (const auto& O : Off) Out.push_back({RegionCentre.X + O[0], RegionCentre.Z + O[1]});
			return Out;
		}();
		return Points;
	}

	double RallyLength()
	{
		double Len = 0;
		FPoint Prev = RallyStart;
		for (const FPoint& C : RallyCheckpoints()) { Len += js::Hypot(C.X - Prev.X, C.Z - Prev.Z); Prev = C; }
		return Len;
	}

	FMedalTargets RallyTargets()
	{
		const double L = RallyLength();
		return {js::Round(L / 32), js::Round(L / 24), js::Round(L / 16)};
	}

	std::string RallyMedal(double Seconds)
	{
		const FMedalTargets T = RallyTargets();
		return Seconds <= T.Gold ? "GOLD" : Seconds <= T.Silver ? "SILVER" : Seconds <= T.Bronze ? "BRONZE" : "";
	}

	std::string DerbyMedal(double Wrecks)
	{
		return Wrecks >= DerbyTargets.Gold ? "GOLD" : Wrecks >= DerbyTargets.Silver ? "SILVER" : Wrecks >= DerbyTargets.Bronze ? "BRONZE" : "";
	}

	const std::vector<FWave>& VaultWaves()
	{
		static const std::vector<FWave> Waves{{5, 0}, {7, 1}, {9, 2}};
		return Waves;
	}

	FVaultRun StartVault(double NowMs)
	{
		FVaultRun R;
		R.Id = "vault-" + js::ToBase36(NowMs);
		return R;
	}

	FVaultStep StepVault(const FVaultRun& Run, const FVaultInput& In)
	{
		FVaultStep Out;
		Out.Run = Run;
		if (Run.Phase == "WON" || Run.Phase == "FAILED") return Out;
		auto Fail = [&](const char* Reason) { Out.Run.Phase = "FAILED"; Out.Run.Reason = Reason; Out.Outcome = "FAILED"; return Out; };
		if (!In.bPlayerAlive) return Fail("You went down. The raiders breached the gate.");
		if (In.PlayerDist > VaultLeash) return Fail("You abandoned the gate.");
		if (Run.Phase == "BREAK")
		{
			const double Timer = Run.Timer - In.Dt;
			if (Timer > 0) { Out.Run.Timer = Timer; return Out; }
			const FWave W = VaultWaves()[static_cast<size_t>(Run.Wave)];
			Out.Run.Phase = "WAVE"; Out.Run.Wave = Run.Wave + 1; Out.Run.Timer = 0; Out.Run.bSpawned = true;
			Out.SpawnWave = W;
			return Out;
		}
		// WAVE
		const double Gate = std::max(0.0, Run.Gate - In.NearGate * GateDpsPerRaider * In.Dt);
		if (Gate <= 0) return Fail("The vault gate was breached.");
		Out.Run.Gate = Gate;
		if (In.TagAlive == 0)
		{
			if (Run.Wave >= static_cast<int>(VaultWaves().size())) { Out.Run.Phase = "WON"; Out.Outcome = "WON"; return Out; }
			Out.Run.Phase = "BREAK"; Out.Run.Timer = VaultBreak; Out.Run.bSpawned = false;
		}
		return Out;
	}

	FRallyRun StartRally(double NowMs)
	{
		FRallyRun R;
		R.Id = "rally-" + js::ToBase36(NowMs);
		return R;
	}

	FRallyStep StepRally(const FRallyRun& Run, double Dt, double X, double Z, bool bInVehicle)
	{
		FRallyStep Out;
		Out.Run = Run;
		if (Run.Phase != "RUNNING") return Out;
		if (!bInVehicle) { Out.Run.Phase = "ABANDONED"; Out.Run.Reason = "You left your vehicle."; Out.Outcome = FRallyOutcome{false, Run.Time}; return Out; }
		const double Time = Run.Time + Dt, Since = Run.SinceCheckpoint + Dt;
		Out.Run.Time = Time;
		if (Since > RallyIdleLimit) { Out.Run.Phase = "ABANDONED"; Out.Run.Reason = "Too long without a checkpoint."; Out.Outcome = FRallyOutcome{false, Time}; return Out; }
		const FPoint& Cp = RallyCheckpoints()[static_cast<size_t>(Run.Next)];
		if (js::Hypot(X - Cp.X, Z - Cp.Z) <= RallyReach)
		{
			const int Next = Run.Next + 1;
			Out.Checkpoint = Run.Next;
			Out.Run.Next = Next;
			if (Next >= static_cast<int>(RallyCheckpoints().size())) { Out.Run.Phase = "FINISHED"; Out.Outcome = FRallyOutcome{true, Time}; return Out; }
			Out.Run.SinceCheckpoint = 0;
			return Out;
		}
		Out.Run.SinceCheckpoint = Since;
		return Out;
	}

	FDerbyRun StartDerby(double NowMs)
	{
		FDerbyRun R;
		R.Id = "derby-" + js::ToBase36(NowMs);
		return R;
	}

	FDerbyStep StepDerby(const FDerbyRun& Run, double Dt, bool bInArena, bool bInVehicle, double Kills, int TagAlive)
	{
		FDerbyStep Out;
		Out.Run = Run;
		if (Run.Phase != "RUNNING") return Out;
		const double Wrecks = Run.Wrecks + (bInArena && bInVehicle ? Kills : 0);
		const double Time = Run.Time - Dt;
		Out.Run.Wrecks = Wrecks;
		if (!bInArena || !bInVehicle || Time <= 0)
		{
			Out.Run.Reason = Time <= 0 ? "Time." : !bInArena ? "You left the pit." : "You left your vehicle.";
			Out.Run.Time = std::max(0.0, Time);
			Out.Run.Phase = "DONE";
			Out.Outcome = Wrecks;
			return Out;
		}
		Out.Run.Time = Time;
		Out.Spawn = TagAlive < DerbyMaxAlive - DerbyWave + 1 ? DerbyWave : 0;
		return Out;
	}

	double TrustOf(const FProgression& P, const std::string& Who)
	{
		const auto It = P.Story.Trust.find(Who);
		return It == P.Story.Trust.end() ? 0 : It->second;
	}

	void AddTrustOnce(FProgression& P, const std::string& Who, double Amount, const std::string& OnceKey)
	{
		const std::string Mark = "once:" + OnceKey;
		if (WlHas(P.Story.Flags, Mark)) return;
		P.Story.Trust[Who] = std::min(TrustMax, std::max(0.0, TrustOf(P, Who) + Amount));
		P.Story.Flags.push_back(Mark);
	}

	std::string LegionRank(const FProgression& P)
	{
		static const std::vector<std::pair<double, const char*>> Ranks{{0, "Outsider"}, {10, "Gate Hand"}, {30, "Legion Mercenary"}, {60, "Vault Warden"}, {90, "Iron Vanguard"}};
		const double T = TrustOf(P, Legion);
		for (auto It = Ranks.rbegin(); It != Ranks.rend(); ++It) if (T >= It->first) return It->second;
		return Ranks.front().second;
	}

	bool GrantBlade(FProgression& P, const std::string& BladeId)
	{
		const std::string Key = arms::BladeKey(BladeId);
		if (WlHas(P.EarnedRewards, Key)) return false;
		P.EarnedRewards.push_back(Key);
		if (!P.Blade) P.Blade = BladeId;
		return true;
	}

	FResolved ResolveVault(const FRewardFn& Reward, const FProgression& P, const std::string& RunId, double Gate, const std::optional<std::string>& Reason, const std::string& Outcome, double NowMs)
	{
		const std::string Key = "vault-run:" + RunId;
		if (WlHas(P.EarnedRewards, Key)) return {P, "", ""};
		FProgression Next = P;
		Next.EarnedRewards.push_back(Key);
		if (Outcome == "FAILED") return {Next, Reason.value_or("The vault gate was breached.") + " The Legion will hold the inner doors; try again.", ""};
		Next = Reward(Next, "side-vault-defense", {{"reinforcedAlloy", 6}, {"scrapMetal", 20}}, NowMs);
		const bool bBlade = GrantBlade(Next, "vectal"); // foundries.ts: the Legion's Hakke monoblade, once
		// Legion standing: +10 per defended run, +5 more for a nearly untouched gate (once per run id)
		const double Bonus = Gate >= 80 ? 5 : 0;
		AddTrustOnce(Next, Legion, 10 + Bonus, "vault:" + RunId);
		std::string Msg = "Vault gates held (" + WlN(js::Round(Gate)) + "% integrity). Sub-Terra Legion: " + LegionRank(Next);
		if (Bonus != 0) Msg += " \xC2\xB7 clean defense bonus";
		if (bBlade) Msg += " \xC2\xB7 the Legion hands you the " + WlBladeName("vectal");
		return {Next, Msg, ""};
	}

	FResolved ResolveRally(const FRewardFn& Reward, const FProgression& P, const std::string& RunId, double Time, double NowMs)
	{
		const std::string Key = "rally-run:" + RunId;
		if (WlHas(P.EarnedRewards, Key)) return {P, "", ""};
		const std::string Medal = RallyMedal(Time);
		const auto Prev = P.Records.find(RallyId);
		const bool bHadPrev = Prev != P.Records.end();
		const double PrevTime = bHadPrev ? Prev->second : 0;
		FProgression Next = P;
		Next.Records[RallyId] = bHadPrev ? std::min(PrevTime, Time) : Time;
		Next.EarnedRewards.push_back(Key);
		if (!Medal.empty()) Next = Reward(Next, "side-rally-" + RallyId, {{"fuel", 6}}, NowMs);
		const std::vector<std::string> Lines = WlPayMedals(Next, RallyId, Medal);
		std::string Msg = RallyName + ": " + js::ToFixed(Time, 1) + " s" + (!bHadPrev || Time < PrevTime ? " \xC2\xB7 new best" : "");
		Msg += Medal.empty() ? std::string(" \xC2\xB7 no medal") : " \xC2\xB7 " + WlLower(Medal);
		if (!Lines.empty()) Msg += " \xC2\xB7 " + WlJoin(Lines, " \xC2\xB7 ");
		return {Next, Msg, Medal};
	}

	FResolved ResolveDerby(const FRewardFn& Reward, const FProgression& P, const std::string& RunId, double Wrecks, double NowMs)
	{
		const std::string Key = "derby-run:" + RunId;
		if (WlHas(P.EarnedRewards, Key)) return {P, "", ""};
		const std::string Medal = DerbyMedal(Wrecks);
		const auto Prev = P.Records.find(DerbyId);
		FProgression Next = P;
		Next.Records[DerbyId] = std::max(Prev == P.Records.end() ? 0.0 : Prev->second, Wrecks);
		Next.EarnedRewards.push_back(Key);
		if (!Medal.empty()) Next = Reward(Next, "side-derby-mash-pit", {{"scrapMetal", 15}, {"vehicleParts", 2}}, NowMs);
		const std::vector<std::string> Lines = WlPayMedals(Next, DerbyId, Medal);
		std::string Msg = "Mash-Pit: " + WlN(Wrecks) + " wrecks";
		Msg += Medal.empty() ? std::string(" \xC2\xB7 no medal") : " \xC2\xB7 " + WlLower(Medal);
		if (!Lines.empty()) Msg += " \xC2\xB7 " + WlJoin(Lines, " \xC2\xB7 ");
		return {Next, Msg, Medal};
	}

	std::map<std::string, double> MergeRecords(const std::map<std::string, double>& A, const std::map<std::string, double>& B)
	{
		std::map<std::string, double> Out = A;
		for (const auto& [K, V] : B)
		{
			const auto It = Out.find(K);
			if (It == Out.end()) Out[K] = V;
			else It->second = K == RallyId ? std::min(It->second, V) : std::max(It->second, V);
		}
		return Out;
	}

	FResolved ResolveEmit(const FRewardFn& Reward, const FProgression& P, const FEmit& E, double NowMs)
	{
		if (E.Type == "VAULT") return ResolveVault(Reward, P, E.RunId, E.Gate, E.Reason, E.Outcome, NowMs);
		if (E.Type == "RALLY") return ResolveRally(Reward, P, E.RunId, E.Time, NowMs);
		return ResolveDerby(Reward, P, E.RunId, E.Wrecks, NowMs);
	}

	FRuntimeStep StepRuntime(FRuntime& Rt, FWorld& World, const FRuntimeInput& In)
	{
		FRuntimeStep Out;
		const bool bAlive = World.Hp > 0;
		const double Kills = std::max(0.0, World.Kills - Rt.KillsSeen);
		Rt.KillsSeen = World.Kills;
		const double DGate = js::Hypot(In.Px - VaultGate.X, In.Pz - VaultGate.Z);
		const double DStart = js::Hypot(In.Px - RallyStart.X, In.Pz - RallyStart.Z);
		const double DArena = js::Hypot(In.Px - Arena.X, In.Pz - Arena.Z);
		// re-arm a start only once the player has stepped off it after the activity ended (the Rust Run finishes on its own start gate)
		if (DGate > VaultGate.Radius + 6) Rt.Rearm.bVault = true;
		if (DStart > RallyReach + 8) Rt.Rearm.bRally = true;
		if (DArena > Arena.Radius + 4) Rt.Rearm.bDerby = true;
		const bool bBusy = Rt.Vault || Rt.Rally || Rt.Derby;

		if (!bBusy && !In.bBlocked && bAlive)
		{
			if (Rt.Rearm.bVault && DGate <= VaultGate.Radius)
			{
				Rt.Vault = StartVault(In.NowMs); Rt.Rearm.bVault = false;
				World.Alert("Defense contract \xC2\xB7 Sub-Terra Perimeter: hold the vault gate against three raider waves");
			}
			else if (Rt.Rearm.bRally && In.bInVehicle && DStart <= RallyReach)
			{
				Rt.Rally = StartRally(In.NowMs); Rt.Rearm.bRally = false;
				const FMedalTargets T = RallyTargets();
				World.Alert("Rust Run: go! Gold " + WlN(T.Gold) + "s \xC2\xB7 Silver " + WlN(T.Silver) + "s \xC2\xB7 Bronze " + WlN(T.Bronze) + "s");
			}
			else if (Rt.Rearm.bDerby && In.bInVehicle && DArena <= Arena.Radius - 4)
			{
				Rt.Derby = StartDerby(In.NowMs); Rt.Rearm.bDerby = false;
				World.Alert("The Mash-Pit: wreck every buggy you can. Leave the pit or your vehicle and the round ends");
			}
		}

		const int NWaves = static_cast<int>(VaultWaves().size());
		const int NCps = static_cast<int>(RallyCheckpoints().size());
		if (Rt.Vault)
		{
			const std::string Tag = "vault:" + Rt.Vault->Id;
			FVaultInput VIn;
			VIn.Dt = In.Dt; VIn.TagAlive = World.TagCount(Tag, std::nullopt);
			VIn.NearGate = World.TagCount(Tag, FSite{VaultGate.X, VaultGate.Z, GateThreatRadius});
			VIn.PlayerDist = DGate; VIn.bPlayerAlive = bAlive;
			const FVaultStep S = StepVault(*Rt.Vault, VIn);
			Rt.Vault = S.Run;
			if (S.SpawnWave)
			{
				const double A = std::fmod(In.NowMs / 997, 3.141592653589793 * 2); // waves come from a different side each time
				World.FreeSlots(S.SpawnWave->Size, In.Px, In.Pz); // a full machine pool once turned a wave into an instant "clear"
				const int N = World.SpawnSquad(Tag, VaultGate.X + std::cos(A) * 48, VaultGate.Z + std::sin(A) * 48, S.SpawnWave->Size, S.SpawnWave->Elites, 9, -1);
				if (N == 0) { FVaultRun Retry = S.Run; Retry.Phase = "BREAK"; Retry.Wave = S.Run.Wave - 1; Retry.Timer = 1; Retry.bSpawned = false; Rt.Vault = Retry; } // try again in a second
				World.Alert("Wave " + WlN(S.Run.Wave) + "/" + WlN(NWaves) + " inbound");
			}
			if (!S.Outcome.empty())
			{
				if (S.Outcome == "FAILED") World.Despawn(Tag);
				FEmit E; E.Type = "VAULT"; E.RunId = S.Run.Id; E.Outcome = S.Outcome; E.Gate = S.Run.Gate; E.Reason = S.Run.Reason;
				Out.Emits.push_back(E);
				Rt.Vault.reset(); Rt.Rearm.bVault = false;
				Rt.Last = S.Outcome == "WON" ? std::string("Vault gates held") : S.Run.Reason.value_or("The gate fell");
				Rt.DoneHold = 6;
			}
			else
			{
				FHud H; H.Kind = "VAULT"; H.Title = "Defend the Vault Gates";
				H.Lines.push_back(S.Run.Phase == "BREAK"
					? (S.Run.Wave == 0 ? "Raiders incoming \xC2\xB7 " + WlN(WlCeil(S.Run.Timer)) + " s" : "Wave " + WlN(S.Run.Wave) + " cleared \xC2\xB7 next in " + WlN(WlCeil(S.Run.Timer)) + " s")
					: "Wave " + WlN(S.Run.Wave) + "/" + WlN(NWaves) + " \xC2\xB7 raiders " + WlN(World.TagCount(Tag, std::nullopt)));
				H.Lines.push_back("Gate integrity " + WlN(js::Round(S.Run.Gate)) + "%");
				H.Progress = S.Run.Gate / 100; H.Target = FPoint{VaultGate.X, VaultGate.Z};
				Out.Hud = H;
			}
		}
		else if (Rt.Rally)
		{
			const FRallyStep S = StepRally(*Rt.Rally, In.Dt, In.Px, In.Pz, In.bInVehicle);
			Rt.Rally = S.Run;
			if (S.Checkpoint && !S.Outcome) World.Alert("Checkpoint " + WlN(*S.Checkpoint + 1) + "/" + WlN(NCps) + " \xC2\xB7 " + js::ToFixed(S.Run.Time, 1) + " s");
			if (S.Outcome)
			{
				if (S.Outcome->bFinished) { FEmit E; E.Type = "RALLY"; E.RunId = S.Run.Id; E.Time = S.Outcome->Time; Out.Emits.push_back(E); }
				Rt.Last = S.Outcome->bFinished ? "Finished in " + js::ToFixed(S.Outcome->Time, 1) + " s" : S.Run.Reason.value_or("Run abandoned");
				Rt.Rally.reset(); Rt.Rearm.bRally = false; Rt.DoneHold = 6;
			}
			else
			{
				const FPoint& Cp = RallyCheckpoints()[static_cast<size_t>(S.Run.Next)];
				const FMedalTargets T = RallyTargets();
				FHud H; H.Kind = "RALLY"; H.Title = RallyName;
				H.Lines.push_back(js::ToFixed(S.Run.Time, 1) + " s \xC2\xB7 checkpoint " + WlN(S.Run.Next + 1) + "/" + WlN(NCps));
				H.Lines.push_back("Gold " + WlN(T.Gold) + " \xC2\xB7 Silver " + WlN(T.Silver) + " \xC2\xB7 Bronze " + WlN(T.Bronze));
				H.Progress = static_cast<double>(S.Run.Next) / NCps; H.Target = Cp;
				Out.Hud = H;
			}
		}
		else if (Rt.Derby)
		{
			const std::string Tag = "derby:" + Rt.Derby->Id;
			const FDerbyStep S = StepDerby(*Rt.Derby, In.Dt, DArena <= Arena.Radius, In.bInVehicle, Kills, World.TagCount(Tag, std::nullopt));
			Rt.Derby = S.Run;
			if (S.Spawn) { World.FreeSlots(S.Spawn, In.Px, In.Pz); World.SpawnSquad(Tag, Arena.X, Arena.Z, S.Spawn, 0, Arena.Radius - 6, 2 /* Rust-Runner Buggy */); }
			if (S.Outcome)
			{
				World.Despawn(Tag);
				FEmit E; E.Type = "DERBY"; E.RunId = S.Run.Id; E.Wrecks = *S.Outcome; Out.Emits.push_back(E);
				std::string Last = S.Run.Reason.value_or("") + " " + WlN(*S.Outcome) + " wrecks";
				if (!Last.empty() && Last.front() == ' ') Last.erase(Last.begin()); // .trim(): only the empty-reason space can lead
				Rt.Last = Last;
				Rt.Derby.reset(); Rt.Rearm.bDerby = false; Rt.DoneHold = 6;
			}
			else
			{
				FHud H; H.Kind = "DERBY"; H.Title = "The Mash-Pit";
				H.Lines.push_back(WlN(S.Run.Wrecks) + " wrecks \xC2\xB7 " + WlN(WlCeil(S.Run.Time)) + " s left");
				H.Lines.push_back("Gold " + WlN(DerbyTargets.Gold) + " \xC2\xB7 Silver " + WlN(DerbyTargets.Silver) + " \xC2\xB7 Bronze " + WlN(DerbyTargets.Bronze));
				H.Progress = S.Run.Time / 75; H.Target = FPoint{Arena.X, Arena.Z};
				Out.Hud = H;
			}
		}
		if (!Out.Hud && Rt.DoneHold > 0 && Rt.Last)
		{
			Rt.DoneHold -= In.Dt;
			FHud H; H.Kind = "VAULT"; H.Title = "Activity over"; H.Lines.push_back(*Rt.Last);
			Out.Hud = H;
		}
		return Out;
	}
}
