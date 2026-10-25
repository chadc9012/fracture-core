#pragma once

#include "CoreMinimal.h"
#include "Core/WFEncounterCore.h"
#include "GameFramework/GameModeBase.h"
#include "WFGameMode.generated.h"

class AWFEnemy;

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
	/** ShopHour <0-24>: the world clock the shop hours use (-1 = unset, all open). */
	UFUNCTION(Exec) void ShopHour(float Hour);

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
	void OnBossPhase(AWFEnemy* Boss, int32 Phase);
	/** HUD: the nearest live encounter boss, its hp fraction, encounter phase, and the attack being wound up (if any). */
	bool GetBossHud(FString& OutName, double& OutHpFraction, FString& OutPhase, FString& OutWindup, double& OutWindupProgress) const;
	const FString& GetRegionName() const { return RegionName; }
	/** The region's ground speed rating (regions.ts speed): scales vehicle top speed. */
	double GetRegionSpeed() const { return RegionSpeed; }

private:
	void EnsurePlayableWorld();
	bool LoadRoster();
	void SpawnTrooper();
	void LoadScenarios();
	void TickEncounters(float DeltaSeconds);
	void TickRace(float DeltaSeconds);
	void DrawRace() const;
	double GroundZ(double XCm, double YCm, double FallbackCm) const;
	void SyncDecoys();
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

	struct FScenarioBoss
	{
		FString Id;
		FString BossName;
		FString RegionId;
		FString Drop;
	};
	TArray<FScenarioBoss> Scenarios;
	int32 NextScenario = 0;

	FString RegionId;
	FString RegionName;
	double RegionDifficulty = 0;
	double RegionSpeed = 0.9;
	TArray<FWFTroop> Roster;
	TArray<TWeakObjectPtr<AWFEnemy>> Squad;
	float SpawnTimer = 1.0f;
};
