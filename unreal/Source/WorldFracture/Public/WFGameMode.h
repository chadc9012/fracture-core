#pragma once

#include "CoreMinimal.h"
#include "Core/WFCityCore.h"
#include "Core/WFTacticsCore.h"
#include "Core/WFEncounterCore.h"
#include "Core/WFWastelandCore.h"
#include "Core/WFGodforgeCore.h"
#include "Core/WFEnvironmentCore.h"
#include "Core/WFNemesisCore.h"
#include "Core/WFVehicleWeaponsCore.h"
#include "GameFramework/GameModeBase.h"
#include "WFGameMode.generated.h"

class AWFEnemy;
class AWFNexusCity;
class AWFTerrain;
class AWFWorldBuildings;

/** A trooper of the current region's roster (DataTables/RegionalEncounters.json, from encounters.ts). */
struct FWFTroop
{
	FString Name;
	FString Drop;
};

/**
 * Sets up a playable session: the Operator pawn, the HUD, a floor and lights if the level has none, and a squad of
 * the current region's troopers that refills as they fall. Region, roster, difficulty and drops come from the
 * exported tables, so kills pay the same materials as in the web build.
 */
UCLASS()
class WORLDFRACTURE_API AWFGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AWFGameMode();

	virtual void StartPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	/** Troopers kept alive near the player. */
	UPROPERTY(EditAnywhere, Category = "World Fracture") int32 SquadSize = 6;
	/** Chance a new trooper is an elite. A tuning value of this prototype spawner, not a web-build number. */
	UPROPERTY(EditAnywhere, Category = "World Fracture") float EliteChance = 0.15f;
	UPROPERTY(EditAnywhere, Category = "World Fracture") float SpawnInterval = 2.0f;

	const FString& GetRegionId() const { return RegionId; }

	/** Nexus City (AWFNexusCity, built from DataTables/NexusCity.json): it always stands at the Nexus region's coordinates. */
	AWFNexusCity* GetNexusCity() const { return NexusCity.Get(); }
	/** The ground (AWFTerrain, the web build's heightmap); null if DataTables/Terrain.bin is missing. */
	AWFTerrain* GetTerrain() const { return Terrain.Get(); }
	/** GoNexus: walks you into Nexus City now (the hub's spawn pad, at night), whatever region the save is in. */
	UFUNCTION(Exec) void GoNexus();

	/** Summons a Unique Scenario boss ~30 m in front of the player (console: SpawnScenarioBoss dark-knight). */
	UFUNCTION(Exec) void SpawnScenarioBoss(const FString& ScenarioId);
	/** Summons the next Unique Scenario of the current region (all regions when it has none). Returns its id. */
	FString SummonNextScenario();

	// ---- racing (ported racing.ts / activities.ts, UWFRaceSubsystem) ----
	/** StartRace nc-circuit [standard|advanced|legendary]: lays the course out with its start line just ahead of the player. */
	UFUNCTION(Exec) void StartRace(const FString& RaceId, const FString& Difficulty);
	UFUNCTION(Exec) void AbandonRace();
	/** Prints the courses (id, name, mode, area, rank gate, attempts, best medal) to the log and the screen. */
	UFUNCTION(Exec) void ListRaces();

	// ---- merchants (ported regional-shops.ts, UWFShopSubsystem) ----
	/** Prints the 21 shops (id, kind, place, currency, and why one is closed to you). */
	UFUNCTION(Exec) void ListShops();
	/** Shop <id>: opens a shop's counter; its stock shows on screen. */
	UFUNCTION(Exec) void Shop(const FString& ShopId);
	UFUNCTION(Exec) void CloseShop();
	/** Buy <n>: buys offer n of the open shop. */
	UFUNCTION(Exec) void Buy(int32 OfferIndex);
	/** Service <itemId> [THERMAL|CRYO|ARC|BIO]: upgrade (gunsmith, armorsmith, vehicle shop) or infuse (mod shop). */
	UFUNCTION(Exec) void Service(const FString& ItemId, const FString& Element);
	/** Prints the inventory with item ids, levels and power. */
	UFUNCTION(Exec) void Inventory();
	/** ShopHour <0-24>: sets the world clock (the shops, the sun, night-only secrets all read it); kept for old habits */
	UFUNCTION(Exec) void ShopHour(float Hour);
	/** Clock <0-24> [speed]: sets the world clock; speed multiplies its pace (1 = the web build's 0.008 days a second) */
	UFUNCTION(Exec) void Clock(float Hour, float Speed);

	// ---- the fleet (ported fleet.ts, UWFFleetSubsystem) ----
	/** Prints the four garage bases and the 21 fleet builds with costs, ownership and tuning. */
	UFUNCTION(Exec) void Fleet();
	UFUNCTION(Exec) void BuyGarage(const FString& GarageId);
	/** BuyFleet <build>: at its home base, for materials and Nex; it becomes your active vehicle (T calls it). */
	UFUNCTION(Exec) void BuyFleet(const FString& BuildId);
	UFUNCTION(Exec) void FleetActive(const FString& BuildId);
	UFUNCTION(Exec) void Tune(const FString& BuildId, const FString& NodeId);
	/** Paint <build> "<paint name>" */
	UFUNCTION(Exec) void Paint(const FString& BuildId, const FString& PaintName);
	/** Cosmetic <build> wheels|body|spoiler|armor|glow <value> */
	UFUNCTION(Exec) void Cosmetic(const FString& BuildId, const FString& Key, const FString& Value);

	// ---- housing (ported housing.ts / residence-deeds.ts, UWFHousingSubsystem) ----
	/** Prints the homes, residences and decor with prices, ownership, placed decor and parked vehicles. */
	UFUNCTION(Exec) void Homes();
	/** each operator's own level, XP, Nex, shards and materials */
	UFUNCTION(Exec) void Operators();
	/** BuyHome <id>: a listed home (grid-loft, aegis-penthouse...) or a city residence (nexus-home-3...), for Nex. */
	UFUNCTION(Exec) void BuyHome(const FString& Id);
	UFUNCTION(Exec) void BuyDecor(const FString& DecorId);
	/** PlaceDecor <home> <room#> <slot> [decor]: no decor clears the slot. */
	UFUNCTION(Exec) void PlaceDecor(const FString& HomeId, int32 Room, const FString& Slot, const FString& DecorId);
	/** Park <build> <residence>: parks an owned fleet build in an owned residence's garage. */
	UFUNCTION(Exec) void Park(const FString& BuildId, const FString& ResidenceId);
	UFUNCTION(Exec) void Unpark(const FString& BuildId);

	// ---- boss encounters (ported encounter-sim.ts) ----
	const wf::encounter::FCatalog& GetEncounterCatalog() const { return EncounterCatalog; }
	bool HasEncounter(const FString& ScenarioId) const;
	/** The player died: encounter bosses reset to full health and phase 0 (encounter-sim.ts resetEncounters). */
	void OnPlayerDied();
	void OnEncounterBossDefeated(AWFEnemy* Boss);
	void OnDecoyShattered(AWFEnemy* Decoy);
	/** a called-in trooper was killed (it pays like any enemy; the fight just stops counting it) */
	void OnSummonDefeated(AWFEnemy* Summon);
	void OnBossPhase(AWFEnemy* Boss, int32 Phase);
	/** HUD: the nearest live encounter boss, its hp fraction, encounter phase, and the attack being wound up (if any). */
	bool GetBossHud(FString& OutName, double& OutHpFraction, FString& OutPhase, FString& OutWindup, double& OutWindupProgress) const;
	const FString& GetRegionName() const { return RegionName; }

	// ---- city systems (ported sim.ts combatHeat, heat.ts, stealth.ts, quest-signals.ts) ----
	/** Shots, blasts, crashes, rams and melee raise combat heat (wf::city::FHeatGain); it decays 6 per second. */
	void AddCombatHeat(double Amount) { CombatHeat += Amount; }
	/** sim.ts playerNoise: gunfire is loud (1), fading 1.5 per second; enemies hear it (enemy-perception.ts) */
	void NotePlayerGunfire() { PlayerNoise = 1; }
	double GetPlayerNoise() const { return PlayerNoise; }
	double GetCombatHeat() const { return CombatHeat; }
	/** the 0-100 Neon City heat meter behind the 1-5 heat level */
	double GetHeatMeter() const { return HeatMeter; }
	/** Nexus City: the surveillance detection meter (0-100) and the hack in progress (0-100, H held) */
	double GetDetectionMeter() const { return DetectionMeter; }
	double GetHackProgress() const { return HackProgress; }
	bool IsHacking() const { return bHacking; }
	bool IsInNexus() const { return RegionId == TEXT("nexus"); }

	// ---- squad tactics (ported enemy-tactics.ts / enemy-evasion.ts) ----
	/** every player round in flight (launchers on foot, vehicle ordnance), refreshed each frame */
	const std::vector<wf::tactics::FRoundLike>& GetPlayerRounds() const { return PlayerRounds; }
	/** one squad grenade alive at a time, with a squad cooldown */
	bool CanThrowGrenade() const;
	/** lob a grenade from From to Target (rules metres: X, Y on the ground plane = Unreal X, Y; Z up) */
	void ThrowGrenade(const FVector& FromM, const FVector& TargetM);
	int32 CountFlankers() const;
	// ---- the Wastelands activities (ported wasteland-activities.ts / wasteland-runtime.ts) ----
	/** Lays the Vault Gate, the Rust Run course and the Mash-Pit out around the player, in the web build's layout around the
	 *  Wastelands centre (the web world is not ported). Runs on its own when the session starts in the Wastelands. */
	UFUNCTION(Exec) void WastelandHere();
	/** Prints where the three activities are from you, your records and your Sub-Terra Legion standing. */
	UFUNCTION(Exec) void Wasteland();
	/** the activity panel (title, lines, progress) while one runs, or its result for a few seconds after */
	const std::optional<wf::wasteland::FHud>& GetWastelandHud() const { return WasteHud; }

	// ---- the world clock, weather and hazards (ported world.ts, weather-cycle.ts, environment.ts) ----
	double GetDayClock() const { return DayClock; }
	const wf::env::FEnvironment& GetEnvironment() const { return Env; }
	const FString& GetHazardWarning() const { return HazardWarning; }
	bool IsSheltered() const;

	// ---- nemeses (ported nemesis.ts, living-runtime.ts ambushes) ----
	/** the enemy that landed your killing blow: it is promoted to a nemesis or ranks up */
	void OnPlayerKilledBy(const wf::nemesis::FKiller& Killer);
	/** a nemesis machine died (killed = by the player): it is slain, or a Survivor crawls away */
	void OnNemesisDown(const FString& NemesisId, bool bKilled);
	/** Prints your nemeses: id, name, rank, traits, region, status. */
	UFUNCTION(Exec) void Nemeses();
	/** HuntNemesis <id>: it comes for you in its region after 4 s (the web build's map drop to its activity) */
	UFUNCTION(Exec) void HuntNemesis(const FString& NemesisId);
	/** HUD: the nemesis on the field (name, rank, traits, weak element, hp), if one is */
	bool GetNemesisHud(FString& OutLine) const;

	// ---- weapon heat (sim.ts weaponHeat): one gauge for the Operator's guns and every vehicle gun ----
	wf::vweapons::FHeat& GetWeaponHeat() { return WeaponHeat; }
	const wf::vweapons::FHeat& GetWeaponHeat() const { return WeaponHeat; }

	// ---- the Godforge and the Living Secret World (ported godforge.ts / secrets.ts) ----
	/** Prints the forge stage, the Forgewright's Marks, your relics, the runes you can bind and the rune dust owed. */
	UFUNCTION(Exec) void Godforge();
	/** at Vael: ForgeRelic eclipse-devourer | crownfire | stillwater */
	UFUNCTION(Exec) void ForgeRelic(const FString& DesignId);
	/** at Vael: SocketRune <relic item id> STORM|EMBER|FROST|BLOOM|SUN|DEVOUR|RIFT|WARD|REAP */
	UFUNCTION(Exec) void SocketRune(const FString& ItemId, const FString& Rune);
	UFUNCTION(Exec) void RemoveRune(const FString& ItemId, const FString& Rune);
	UFUNCTION(Exec) void AscendRelic(const FString& ItemId);
	UFUNCTION(Exec) void CollectDust();
	/** the Furnace Guardian fell to the player: the Heart of the Hollow Crown and two forge catalysts, once */
	void OnGuardianSlain();
	/** NOVA's hum for the HUD: distance to the nearest unfound secret (negative = none near), its name in reach, why it is locked */
	void GetSecretHud(double& OutDist, FString& OutName, FString& OutLocked) const { OutDist = SecretDist; OutName = SecretName; OutLocked = SecretLocked; }

	/** The region's ground speed rating (regions.ts speed): scales vehicle top speed. */
	double GetRegionSpeed() const { return RegionSpeed; }

private:
	void EnsurePlayableWorld();
	/** the current region's data and trooper roster; Override picks a region instead of the save's current world */
	bool LoadRoster(const FString& Override = FString());
	void SpawnNexusCity();
	void SpawnTerrain();
	/** Neon City, the walk-in homes and garages, the reclaimed city, airports and seaports (AWFWorldBuildings) */
	void SpawnWorldBuildings();
	/** the player at their region's centre, on the land */
	void PlaceInRegion();
	/** the player on the hub's spawn pad, facing the plaza */
	void PlaceAtNexus();
	void SpawnTrooper();
	void LoadScenarios();
	void TickEncounters(float DeltaSeconds);
	void TickCity(float DeltaSeconds);
	void TickGrenades(float DeltaSeconds);
	void TickWasteland(float DeltaSeconds);
	void TickGodforge(float DeltaSeconds);
	void TickEnvironment(float DeltaSeconds);
	void TickNemesis(float DeltaSeconds);
	/** the forge's console commands answer only at Vael (godforge.ts vaelNear), as the web build's forge window opens only there */
	bool AtVael();
	void ForgeAction(const std::function<wf::godforge::FForgeResult(const wf::FProgression&)>& Action);
	/** this level's centre stands for the current region's centre (the web world is not ported) */
	FVector RegionToWorld(double X, double Z, double BaseZ) const;
	FVector2D WorldToRegion(const FVector& L) const;
	void DrawWasteland() const;
	/** sim.ts spawnEventSquad: Size wastelands troopers tagged Tag in a ring around rules point (X, Z); Kind -1 = by index */
	int32 SpawnActivitySquad(const FString& Tag, double X, double Z, int32 Size, int32 Elites, double Ring, int32 Kind);
	/** rules metres in the web world <-> this level, through the anchor WastelandHere set */
	FVector WasteToWorld(double X, double Z, double BaseZ) const;
	FVector2D WorldToWaste(const FVector& L) const;
	void DrawTurrets() const;
	void TickRace(float DeltaSeconds);
	void DrawRace() const;
	double GroundZ(double XCm, double YCm, double FallbackCm) const;
	void SyncDecoys();
	/** encounter-sim.ts spawnSummons: a real enemy for every called-in trooper; dismissed ones leave without paying */
	void SyncSummons();
	void ShowEncounterEvents();
	void DrawZones() const;
	TArray<AWFEnemy*> EncounterBosses() const;
	void Toast(const FString& Text, const FLinearColor& Color) const;

	wf::encounter::FCatalog EncounterCatalog;
	wf::encounter::FArena Arena;
	double SeenEventId = 0;
	FString RaceNotice;
	int32 SeenRaceFinishes = 0;
	TMap<int64, TWeakObjectPtr<AWFEnemy>> DecoyActors; // decoy id -> actor
	TMap<int64, TWeakObjectPtr<AWFEnemy>> SummonActors; // summon id -> actor

	double CombatHeat = 0, HeatMeter = 0, DetectionMeter = 0, HackProgress = 0, PlayerNoise = 0;
	bool bHacking = false;
	std::vector<wf::city::FTurret> Turrets; // the safe-zone perimeter turrets (createSim layout)
	wf::city::FQuestSignals QuestSignals;
	std::vector<wf::tactics::FRoundLike> PlayerRounds;
	std::vector<wf::tactics::FGrenade> Grenades;
	double GrenadeCool = 0, NextGrenadeId = 1;
	int32 NextSquadIndex = 0;
	TMap<FString, FString> FactionByRegion; // RegionFactions: region -> faction kind
	TMap<FString, double> PendingSurvive; // survive seconds per world, sent to the quests about once a second
	wf::wasteland::FRuntime WasteRt;
	std::optional<wf::wasteland::FHud> WasteHud;
	bool bWasteActive = false, bWasteAutoPlaced = false;
	FVector2D WasteAnchorCm = FVector2D::ZeroVector; // where the Wastelands centre sits in this level
	TArray<FWFTroop> WasteRoster;
	wf::vweapons::FHeat WeaponHeat;
	double NemInRegion = 0, NemLastAmbush = -1e9, NemClock = 0;
	FString SummonedNemesis, NemSummonDone;
	TMap<FString, FString> RegionNames; // region id -> display name (the nemesis grudge names where it beat you)
	double DayClock = wf::env::ClockStart; // 08:38, as the web build starts
	double ClockSpeed = 1;
	wf::env::FEnvironment Env;
	wf::env::FEnvState EnvState;
	FString HazardWarning, RegionKind;
	TWeakObjectPtr<class ADirectionalLight> SunLight;
	bool bRegionAnchored = false;
	FVector2D RegionAnchorCm = FVector2D::ZeroVector;
	wf::godforge::FRegionCircle RegionCircle;
	TMap<FString, wf::godforge::FRegionCircle> RegionCircles;
	TSet<FString> SecretsReached; // living-runtime.ts rt.reached: a secret claims once per session
	double SecretDist = -1;
	FString SecretName, SecretLocked;
	bool bGuardianOut = false; // living-runtime.ts guardianOut: the Furnace Guardian woke this visit

	struct FScenarioBoss
	{
		FString Id;
		FString BossName;
		FString RegionId;
		FString Drop;
	};
	TArray<FScenarioBoss> Scenarios;
	int32 NextScenario = 0;

	TWeakObjectPtr<AWFNexusCity> NexusCity;
	TWeakObjectPtr<AWFTerrain> Terrain;
	TWeakObjectPtr<AWFWorldBuildings> WorldBuildings;
	FString RegionId;
	FString RegionName;
	double RegionDifficulty = 0;
	double RegionSpeed = 0.9;
	TArray<FWFTroop> Roster;
	TArray<TWeakObjectPtr<AWFEnemy>> Squad;
	float SpawnTimer = 1.0f;
};
