#pragma once

#include "CoreMinimal.h"
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
	const FString& GetRegionName() const { return RegionName; }

private:
	void EnsurePlayableWorld();
	bool LoadRoster();
	void SpawnTrooper();
	void LoadScenarios();

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
	TArray<FWFTroop> Roster;
	TArray<TWeakObjectPtr<AWFEnemy>> Squad;
	float SpawnTimer = 1.0f;
};
