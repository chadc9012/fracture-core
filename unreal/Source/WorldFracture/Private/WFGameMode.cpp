#include "WFGameMode.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/StaticMesh.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFCharacter.h"
#include "WFDataFiles.h"
#include "WFEnemy.h"
#include "WFHUD.h"
#include "WFProgressionSubsystem.h"
#include "WFQuestSubsystem.h"

AWFGameMode::AWFGameMode()
{
	DefaultPawnClass = AWFCharacter::StaticClass();
	HUDClass = AWFHUD::StaticClass();
	PrimaryActorTick.bCanEverTick = true;
}

void AWFGameMode::StartPlay()
{
	Super::StartPlay();
	EnsurePlayableWorld();
	if (!LoadRoster()) UE_LOG(LogTemp, Error, TEXT("No roster for region %s; no enemies will spawn."), *RegionId);
	if (UWFQuestSubsystem* Quests = GetGameInstance()->GetSubsystem<UWFQuestSubsystem>()) Quests->ReportEnterWorld(RegionId);
}

void AWFGameMode::EnsurePlayableWorld()
{
	UWorld* World = GetWorld();
	if (!World) return;

	if (!TActorIterator<ADirectionalLight>(World))
	{
		ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(FVector(0, 0, 2000), FRotator(-40.f, 35.f, 0.f));
		if (Sun && Sun->GetLightComponent())
		{
			Sun->GetLightComponent()->SetMobility(EComponentMobility::Movable);
			Sun->GetLightComponent()->SetIntensity(6.f);
		}
	}
	if (!TActorIterator<ASkyLight>(World))
		if (ASkyLight* Sky = World->SpawnActor<ASkyLight>(FVector(0, 0, 1000), FRotator::ZeroRotator))
		{
			Sky->GetLightComponent()->SetMobility(EComponentMobility::Movable);
			Sky->GetLightComponent()->SetIntensity(1.f);
			Sky->GetLightComponent()->bRealTimeCapture = true;
		}

	// A floor under the player if the level has nothing to stand on.
	APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
	const FVector Probe = Player ? Player->GetActorLocation() : FVector::ZeroVector;
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(WFFloorProbe), false, Player);
	if (!World->LineTraceSingleByChannel(Hit, Probe + FVector(0, 0, 500), Probe - FVector(0, 0, 100000), ECC_Visibility, Params))
	{
		AStaticMeshActor* Floor = World->SpawnActor<AStaticMeshActor>(FVector(Probe.X, Probe.Y, 0.f), FRotator::ZeroRotator);
		UStaticMesh* Plane = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Plane.Plane"));
		if (Floor && Plane)
		{
			Floor->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
			Floor->GetStaticMeshComponent()->SetStaticMesh(Plane);
			Floor->SetActorScale3D(FVector(400.f, 400.f, 1.f)); // 400 m square
			if (Player) Player->SetActorLocation(FVector(Probe.X, Probe.Y, 200.f));
		}
	}
}

bool AWFGameMode::LoadRoster()
{
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	RegionId = Progression ? WFData::ToF(Progression->Get().CurrentWorld) : TEXT("veridan");

	FString Error;
	TArray<TSharedPtr<FJsonObject>> Rows;
	if (WFData::LoadRows(TEXT("Regions"), Rows, Error))
		for (const TSharedPtr<FJsonObject>& Row : Rows)
			if (WFData::Str(Row, TEXT("Id")) == RegionId)
			{
				RegionName = WFData::Str(Row, TEXT("DisplayName"));
				RegionDifficulty = WFData::Num(Row, TEXT("Difficulty"));
			}

	Roster.Reset();
	if (!WFData::LoadRows(TEXT("RegionalEncounters"), Rows, Error)) return false;
	for (const TSharedPtr<FJsonObject>& Row : Rows)
	{
		if (WFData::Str(Row, TEXT("RegionId")) != RegionId) continue;
		TArray<TSharedPtr<FJsonValue>> Troops;
		if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(Row, TEXT("TroopsJson"))), Troops)) continue;
		for (const TSharedPtr<FJsonValue>& Troop : Troops)
			if (const TSharedPtr<FJsonObject> T = Troop->AsObject())
				Roster.Add({WFData::Str(T, TEXT("name")), WFData::Str(T, TEXT("drop"))});
	}
	return !Roster.IsEmpty();
}

void AWFGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Squad.RemoveAll([](const TWeakObjectPtr<AWFEnemy>& E) { return !E.IsValid() || E->IsDead(); });
	SpawnTimer -= DeltaSeconds;
	if (SpawnTimer <= 0 && Squad.Num() < SquadSize && !Roster.IsEmpty())
	{
		SpawnTimer = SpawnInterval;
		SpawnTrooper();
	}
}

void AWFGameMode::SpawnTrooper()
{
	UWorld* World = GetWorld();
	APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!World || !Player) return;

	// A ring 25-45 m out, dropped onto the ground.
	const float Angle = FMath::FRandRange(0.f, 2.f * PI);
	const float Distance = FMath::FRandRange(2500.f, 4500.f);
	const FVector Around = Player->GetActorLocation() + FVector(FMath::Cos(Angle) * Distance, FMath::Sin(Angle) * Distance, 0.f);
	FHitResult Ground;
	if (!World->LineTraceSingleByChannel(Ground, Around + FVector(0, 0, 5000), Around - FVector(0, 0, 20000), ECC_Visibility)) return;

	const FWFTroop& Troop = Roster[FMath::RandRange(0, Roster.Num() - 1)];
	const bool bElite = FMath::FRand() < EliteChance;
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	// sim.ts spawnMachine: ((elite ? 7 : 3) + round(difficulty * 0.8)) * challenge enemyHp
	const double MaxHealth = ((bElite ? 7.0 : 3.0) + FMath::RoundHalfFromZero(RegionDifficulty * 0.8)) * (Progression ? Progression->GetChallengeEnemyHealthScale() : 1.0);

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
	const FTransform At(FRotator::ZeroRotator, Ground.ImpactPoint + FVector(0, 0, 120));
	if (AWFEnemy* Enemy = World->SpawnActorDeferred<AWFEnemy>(AWFEnemy::StaticClass(), At, nullptr, nullptr, Params.SpawnCollisionHandlingOverride))
	{
		Enemy->Configure(Troop.Name, RegionId, Troop.Drop, bElite, false, MaxHealth);
		Enemy->FinishSpawning(At);
		Squad.Add(Enemy);
	}
}
