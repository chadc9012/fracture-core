// World Fracture — the three Wastelands activities:
//   - Defend the Vault Gates (Sub-Terra Legion defense contract): three raider waves converge on the Sub-Terra Apex gate; raiders near
//     the gate wear its integrity down; clear all three waves before it breaks. Pays Legion trust and, once, the Vectal monoblade.
//   - Rust Run (rally time trial): drive the checkpoint loop; gold / silver / bronze by time. Gold awards the Sun-Cutter.
//   - The Mash-Pit (derby): a vehicle-only arena round; wreck as many raider buggies as you can in 75 s. Gold awards the Aegis Broadsword.
//
// Port of the web build's authoritative rules:
//   wasteland-activities.ts  sites, rallyLength / rallyTargets / rallyMedal, derbyMedal, startVault / stepVault, startRally /
//                            stepRally, startDerby / stepDerby, legionRank, payMedals, resolveVault / resolveRally / resolveDerby,
//                            mergeRecords
//   wasteland-runtime.ts     stepWasteRuntime (starting on the pads, re-arming, spawning the tagged raiders, the HUD and the emits)
//   foundries.ts             grantBlade;  story.ts  applyEffects (trust, once-keyed), trustOf
// Positions are rules metres in the web world (x, z). The payout itself (progression.ts rewardMission) is passed in, so the Unreal
// side uses the ported wf::missionreward::RewardMission. Golden-tested (Tests/WastelandCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <functional>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::wasteland
{
	struct FSite { double X = 0, Z = 0, Radius = 0; };
	struct FPoint { double X = 0, Z = 0; };
	/** where the web world puts the Wastelands (regions.ts), so a level can lay the sites out around its own centre */
	inline constexpr FPoint RegionCentre{-300, 180};
	inline constexpr FSite VaultGate{-222, 196, 9};
	inline constexpr FSite Arena{-458, 192, 24};
	inline constexpr FPoint RallyStart{-324, 293};
	WORLDFRACTURECORE_API const std::vector<FPoint>& RallyCheckpoints();
	inline constexpr double RallyReach = 10;
	inline const std::string RallyId = "rust-run", RallyName = "Rust Run", DerbyId = "mash-pit";

	WORLDFRACTURECORE_API double RallyLength();
	struct FMedalTargets { double Gold = 0, Silver = 0, Bronze = 0; };
	WORLDFRACTURECORE_API FMedalTargets RallyTargets();
	/** GOLD | SILVER | BRONZE, or "" for none */
	WORLDFRACTURECORE_API std::string RallyMedal(double Seconds);
	inline constexpr FMedalTargets DerbyTargets{14, 10, 6};
	WORLDFRACTURECORE_API std::string DerbyMedal(double Wrecks);

	// ---- vault defense ----
	struct FWave { int Size = 0, Elites = 0; };
	WORLDFRACTURECORE_API const std::vector<FWave>& VaultWaves();
	inline constexpr double GateMax = 100, GateDpsPerRaider = 0.7, GateThreatRadius = 16, VaultBreak = 8, VaultLeash = 120;
	struct FVaultRun
	{
		std::string Id;
		std::string Phase = "BREAK"; // WAVE | BREAK | WON | FAILED
		int Wave = 0;
		double Gate = GateMax, Timer = 3;
		bool bSpawned = false;
		std::optional<std::string> Reason;
	};
	/** the run id is vault-<now in base 36>: NowMs should be a whole number of milliseconds */
	WORLDFRACTURECORE_API FVaultRun StartVault(double NowMs);
	struct FVaultInput { double Dt = 0; int TagAlive = 0, NearGate = 0; double PlayerDist = 0; bool bPlayerAlive = true; };
	struct FVaultStep { FVaultRun Run; std::optional<FWave> SpawnWave; std::string Outcome; /* WON | FAILED | "" */ };
	WORLDFRACTURECORE_API FVaultStep StepVault(const FVaultRun& Run, const FVaultInput& In);

	// ---- rally ----
	inline constexpr double RallyIdleLimit = 75;
	struct FRallyRun { std::string Id; std::string Phase = "RUNNING"; /* RUNNING | FINISHED | ABANDONED */ int Next = 0; double Time = 0, SinceCheckpoint = 0; std::optional<std::string> Reason; };
	WORLDFRACTURECORE_API FRallyRun StartRally(double NowMs);
	struct FRallyOutcome { bool bFinished = false; double Time = 0; };
	struct FRallyStep { FRallyRun Run; std::optional<int> Checkpoint; std::optional<FRallyOutcome> Outcome; };
	WORLDFRACTURECORE_API FRallyStep StepRally(const FRallyRun& Run, double Dt, double X, double Z, bool bInVehicle);

	// ---- derby ----
	inline constexpr double DerbySeconds = 75;
	inline constexpr int DerbyWave = 4, DerbyMaxAlive = 6;
	struct FDerbyRun { std::string Id; std::string Phase = "RUNNING"; /* RUNNING | DONE */ double Time = DerbySeconds; double Wrecks = 0; std::optional<std::string> Reason; };
	WORLDFRACTURECORE_API FDerbyRun StartDerby(double NowMs);
	struct FDerbyStep { FDerbyRun Run; int Spawn = 0; std::optional<double> Outcome; /* wrecks */ };
	/** Kills = player kills this step (any weapon or ram) */
	WORLDFRACTURECORE_API FDerbyStep StepDerby(const FDerbyRun& Run, double Dt, bool bInArena, bool bInVehicle, double Kills, int TagAlive);

	// ---- saved results ----
	inline const std::string Legion = "subterra-legion";
	inline constexpr double TrustMax = 100;
	WORLDFRACTURECORE_API double TrustOf(const FProgression& P, const std::string& Who);
	/** story.ts applyEffects with one trust effect: applied once per key (the once:<key> flag) */
	WORLDFRACTURECORE_API void AddTrustOnce(FProgression& P, const std::string& Who, double Amount, const std::string& OnceKey);
	WORLDFRACTURECORE_API std::string LegionRank(const FProgression& P);
	/** foundries.ts grantBlade: the blade:<id> claim, equipped if nothing was */
	WORLDFRACTURECORE_API bool GrantBlade(FProgression& P, const std::string& BladeId);

	/** progression.ts rewardMission(p, missionId, materials, now) */
	using FRewardFn = std::function<FProgression(const FProgression&, const std::string& MissionId, const std::vector<std::pair<std::string, double>>& Materials, double NowMs)>;
	struct FResolved { FProgression Progression; std::string Message; std::string Medal; };
	WORLDFRACTURECORE_API FResolved ResolveVault(const FRewardFn& Reward, const FProgression& P, const std::string& RunId, double Gate, const std::optional<std::string>& Reason, const std::string& Outcome, double NowMs);
	WORLDFRACTURECORE_API FResolved ResolveRally(const FRewardFn& Reward, const FProgression& P, const std::string& RunId, double Time, double NowMs);
	WORLDFRACTURECORE_API FResolved ResolveDerby(const FRewardFn& Reward, const FProgression& P, const std::string& RunId, double Wrecks, double NowMs);
	/** best wins: the rally time is lower-is-better, every other record higher-is-better */
	WORLDFRACTURECORE_API std::map<std::string, double> MergeRecords(const std::map<std::string, double>& A, const std::map<std::string, double>& B);

	// ---- runtime (wasteland-runtime.ts) ----
	/** what the runtime needs from the live world */
	struct FWorld
	{
		/** tagged raiders alive (when Near is set: within R of X, Z) */
		std::function<int(const std::string& Tag, const std::optional<FSite>& Near)> TagCount;
		std::function<void(const std::string& Text)> Alert;
		/** make room for N more raiders */
		std::function<void(int N, double Px, double Pz)> FreeSlots;
		/** sim.ts spawnEventSquad: Size raiders (Elites of them elite) tagged Tag around X, Z within Spread; Kind -1 = the region's
		 *  trooper, 2 = the Rust-Runner Buggy. Returns how many spawned. */
		std::function<int(const std::string& Tag, double X, double Z, int Size, int Elites, double Spread, int Kind)> SpawnSquad;
		/** the tagged raiders leave (no payout) */
		std::function<void(const std::string& Tag)> Despawn;
		double Kills = 0; // the player's kill counter
		double Hp = 1;
	};
	struct FRearm { bool bVault = true, bRally = true, bDerby = true; };
	struct FRuntime
	{
		std::optional<FVaultRun> Vault;
		std::optional<FRallyRun> Rally;
		std::optional<FDerbyRun> Derby;
		double KillsSeen = 0;
		FRearm Rearm;
		double DoneHold = 0;
		std::optional<std::string> Last;
	};
	inline FRuntime CreateRuntime(double Kills) { FRuntime R; R.KillsSeen = Kills; return R; }
	struct FEmit
	{
		std::string Type; // VAULT | RALLY | DERBY
		std::string RunId;
		std::string Outcome; // VAULT: WON | FAILED
		double Gate = 0;     // VAULT
		std::optional<std::string> Reason; // VAULT
		double Time = 0;     // RALLY
		double Wrecks = 0;   // DERBY
	};
	struct FHud
	{
		std::string Kind; // VAULT | RALLY | DERBY
		std::string Title;
		std::vector<std::string> Lines;
		std::optional<double> Progress;
		std::optional<FPoint> Target;
	};
	struct FRuntimeStep { std::vector<FEmit> Emits; std::optional<FHud> Hud; };
	struct FRuntimeInput { double Dt = 0, NowMs = 0, Px = 0, Pz = 0; bool bInVehicle = false, bBlocked = false; };
	WORLDFRACTURECORE_API FRuntimeStep StepRuntime(FRuntime& Rt, FWorld& World, const FRuntimeInput& In);

	/** Apply an emit to the save (GameCanvas: the resolve* reducers). */
	WORLDFRACTURECORE_API FResolved ResolveEmit(const FRewardFn& Reward, const FProgression& P, const FEmit& E, double NowMs);
}
