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
	void SyncDecoys();
	void ShowEncounterEvents();
	void DrawZones() const;
	TArray<AWFEnemy*> EncounterBosses() const;
	void Toast(const FString& Text, const FLinearColor& Color) const;

	wf::encounter::FCatalog EncounterCatalog;
	wf::encounter::FArena Arena;
	double SeenEventId = 0;
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
