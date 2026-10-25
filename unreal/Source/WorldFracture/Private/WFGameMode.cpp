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
#include "WFEncounterData.h"
#include "DrawDebugHelpers.h"
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
	FString EncounterError;
	if (!WFEncounterData::LoadCatalog(EncounterCatalog, EncounterError))
		UE_LOG(LogTemp, Error, TEXT("Boss encounters failed to load (%s); scenario bosses fight as plain bosses."), *EncounterError);
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
	TickEncounters(DeltaSeconds);
	Squad.RemoveAll([](const TWeakObjectPtr<AWFEnemy>& E) { return !E.IsValid() || E->IsDead(); });
	SpawnTimer -= DeltaSeconds;
	if (SpawnTimer <= 0 && Squad.Num() < SquadSize && !Roster.IsEmpty())
	{
		SpawnTimer = SpawnInterval;
		SpawnTrooper();
	}
}

// --- boss encounters --------------------------------------------------------------------------------------------------

namespace
{
	constexpr double EncCmPerM = 100.0;
	const FLinearColor EncWarn(1.f, 0.55f, 0.3f), EncCyan(0.45f, 0.9f, 1.f), EncGold(1.f, 0.82f, 0.35f);
}

bool AWFGameMode::HasEncounter(const FString& ScenarioId) const
{
	return !ScenarioId.IsEmpty() && EncounterCatalog.Find(WFData::ToStd(ScenarioId)) != nullptr;
}

TArray<AWFEnemy*> AWFGameMode::EncounterBosses() const
{
	TArray<AWFEnemy*> Out;
	for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It)
		if (!It->IsDead() && It->IsBoss() && !It->IsDecoy() && HasEncounter(It->GetScenarioId())) Out.Add(*It);
	return Out;
}

void AWFGameMode::Toast(const FString& Text, const FLinearColor& Color) const
{
	if (const APlayerController* PC = GetWorld()->GetFirstPlayerController())
		if (AWFHUD* Hud = PC->GetHUD<AWFHUD>()) Hud->Toast(Text, Color);
}

void AWFGameMode::TickEncounters(float DeltaSeconds)
{
	AWFCharacter* Player = Cast<AWFCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
	if (!Player) return;
	const double Now = GetWorld()->GetTimeSeconds();
	TArray<AWFEnemy*> Bosses = EncounterBosses();
	std::vector<wf::encounter::FBoss*> Rules;
	for (AWFEnemy* B : Bosses) { B->SyncRules(); Rules.push_back(&B->Rules()); }
	const FVector P = Player->GetActorLocation() / EncCmPerM;
	wf::encounter::StepEncounters(EncounterCatalog, Rules, Arena, DeltaSeconds, P.X, P.Y, Now);
	for (AWFEnemy* B : Bosses)
	{
		if (!B->Rules().bAlive) { B->Depart(); continue; } // Vaelith withdraws after the truce
		B->ApplyRules();
	}
	SyncDecoys();
	ShowEncounterEvents();
	DrawZones();
	Player->SetHazardSpeedMult(Arena.HazardSpeedMult);
	// player hits last: one may kill the player, which resets the encounter
	const std::vector<wf::encounter::FPlayerHit> Hits = std::move(Arena.Hits);
	Arena.Hits.clear();
	for (const wf::encounter::FPlayerHit& H : Hits) Player->ApplyHit(H.Damage, WFData::ToF(H.Label));
}

void AWFGameMode::SyncDecoys()
{
	TSet<int64> Live;
	for (const wf::encounter::FDecoy& D : Arena.Decoys)
	{
		const int64 Id = static_cast<int64>(D.Id);
		Live.Add(Id);
		if (DecoyActors.Contains(Id) && DecoyActors[Id].IsValid()) continue;
		const FVector Around(D.X * EncCmPerM, D.Z * EncCmPerM, 0);
		FHitResult Ground;
		const FVector At = GetWorld()->LineTraceSingleByChannel(Ground, Around + FVector(0, 0, 5000), Around - FVector(0, 0, 20000), ECC_Visibility) ? Ground.ImpactPoint + FVector(0, 0, 150) : Around;
		const FTransform Spawn(FRotator::ZeroRotator, At);
		if (AWFEnemy* Copy = GetWorld()->SpawnActorDeferred<AWFEnemy>(AWFEnemy::StaticClass(), Spawn, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn))
		{
			Copy->Configure(TEXT("False Saint"), RegionId, TEXT("dataShards"), true, false, 2.0); // encounter-sim.ts spawnDecoys: hp 2
			Copy->ConfigureDecoy(D.Id);
			Copy->FinishSpawning(Spawn);
			DecoyActors.Add(Id, Copy);
		}
	}
	for (auto It = DecoyActors.CreateIterator(); It; ++It)
		if (!Live.Contains(It.Key()))
		{
			if (It.Value().IsValid() && !It.Value()->IsDead()) It.Value()->Destroy();
			It.RemoveCurrent();
		}
}

void AWFGameMode::ShowEncounterEvents()
{
	for (const wf::encounter::FEvent& E : Arena.Events)
	{
		if (E.Id <= SeenEventId) continue;
		SeenEventId = E.Id;
		const FString Text = WFData::ToF(E.Text);
		if (E.Kind == "TELL") Toast(Text, EncWarn);
		else if (E.Kind == "PHASE" || E.Kind == "TRUCE" || E.Kind == "RESET" || E.Kind == "DEPART" || E.Kind == "DECOY_SHATTER") Toast(Text, EncCyan);
		else if (E.Kind == "FINALE" || E.Kind == "VICTORY") Toast(Text, EncGold);
		else if (E.Kind == "IMPACT" && E.Hit && *E.Hit) Toast(FString::Printf(TEXT("%s hit you"), *Text), EncWarn);
	}
}

void AWFGameMode::DrawZones() const
{
	const double Now = GetWorld()->GetTimeSeconds();
	for (const wf::encounter::FZone& Z : Arena.Zones)
	{
		const FVector C(Z.X * EncCmPerM, Z.Z * EncCmPerM, 0);
		FHitResult Ground;
		const FVector At = GetWorld()->LineTraceSingleByChannel(Ground, C + FVector(0, 0, 5000), C - FVector(0, 0, 20000), ECC_Visibility) ? Ground.ImpactPoint + FVector(0, 0, 8) : C;
		// amber while arming (the readable warning), red once dangerous, pale blue for slowing ice / mist
		const FColor Color = Now < Z.ArmAt ? FColor(255, 170, 40) : Z.Kind == "SLOW" ? FColor(150, 210, 255) : FColor(255, 40, 30);
		DrawDebugCircle(GetWorld(), At, static_cast<float>(Z.Radius * EncCmPerM), 48, Color, false, -1.f, 0, 6.f, FVector(0, 1, 0), FVector(1, 0, 0), false);
	}
}

void AWFGameMode::OnPlayerDied()
{
	TArray<AWFEnemy*> Bosses = EncounterBosses();
	std::vector<wf::encounter::FBoss*> Rules;
	for (AWFEnemy* B : Bosses) { B->SyncRules(); Rules.push_back(&B->Rules()); }
	wf::encounter::ResetEncounters(EncounterCatalog, Rules, Arena, GetWorld()->GetTimeSeconds());
	for (AWFEnemy* B : Bosses) B->ApplyRules();
	SyncDecoys();
	ShowEncounterEvents();
}

void AWFGameMode::OnEncounterBossDefeated(AWFEnemy* Boss)
{
	Boss->SyncRules();
	wf::encounter::EndEncounter(EncounterCatalog, Boss->Rules(), Arena, GetWorld()->GetTimeSeconds());
	SyncDecoys();
	ShowEncounterEvents();
}

void AWFGameMode::OnDecoyShattered(AWFEnemy* Decoy)
{
	TArray<AWFEnemy*> Bosses = EncounterBosses();
	std::vector<wf::encounter::FBoss*> Rules;
	for (AWFEnemy* B : Bosses) Rules.push_back(&B->Rules());
	DecoyActors.Remove(static_cast<int64>(Decoy->GetDecoyId()));
	wf::encounter::OnDecoyShattered(EncounterCatalog, Rules, Arena, Decoy->GetDecoyId(), GetWorld()->GetTimeSeconds());
	ShowEncounterEvents();
}

void AWFGameMode::OnBossPhase(AWFEnemy* Boss, int32 Phase)
{
	if (HasEncounter(Boss->GetScenarioId())) return; // authored encounters announce their own phases
	const wf::encounter::FPhaseTuning& T = wf::encounter::TuningFor(Phase);
	Toast(FString::Printf(TEXT("%s - %s: %s"), *Boss->GetProfile(), UTF8_TO_TCHAR(T.Label), UTF8_TO_TCHAR(T.Telegraph)), EncWarn);
}

bool AWFGameMode::GetBossHud(FString& OutName, double& OutHpFraction, FString& OutPhase, FString& OutWindup, double& OutWindupProgress) const
{
	const APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
	const AWFEnemy* Best = nullptr;
	double BestDist = 1e18;
	for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It)
	{
		if (It->IsDead() || !It->IsBoss() || It->IsDecoy()) continue;
		const double D = Player ? FVector::Dist(Player->GetActorLocation(), It->GetActorLocation()) : 0;
		if (D < BestDist) { BestDist = D; Best = *It; }
	}
	if (!Best || BestDist > 150 * EncCmPerM) return false;
	OutName = Best->GetProfile();
	OutHpFraction = Best->GetMaxHealth() > 0 ? Best->GetHealth() / Best->GetMaxHealth() : 0;
	OutPhase.Empty();
	const wf::encounter::FBoss& R = Best->Rules();
	if (const wf::encounter::FEncounterDef* Def = R.ScenarioId ? EncounterCatalog.Find(*R.ScenarioId) : nullptr; Def && R.Encounter)
		OutPhase = WFData::ToF(Def->Phases[static_cast<size_t>(R.Encounter->Phase)].Name);
	else OutPhase = UTF8_TO_TCHAR(wf::encounter::TuningFor(R.RegionalPhase).Label);
	std::string Label;
	OutWindupProgress = 0;
	OutWindup = wf::encounter::WindupHud(EncounterCatalog, R, Label, OutWindupProgress) ? WFData::ToF(Label) : FString();
	return true;
}

void AWFGameMode::LoadScenarios()
{
	Scenarios.Reset();
	TArray<TSharedPtr<FJsonObject>> Rows;
	FString Error;
	if (!WFData::LoadRows(TEXT("UniqueScenarios"), Rows, Error)) return;
	for (const TSharedPtr<FJsonObject>& Row : Rows)
		Scenarios.Add({WFData::Str(Row, TEXT("Id")), WFData::Str(Row, TEXT("BossName")), WFData::Str(Row, TEXT("RegionId")), WFData::Str(Row, TEXT("Drop"))});
}

FString AWFGameMode::SummonNextScenario()
{
	if (Scenarios.IsEmpty()) LoadScenarios();
	TArray<const FScenarioBoss*> Here;
	for (const FScenarioBoss& S : Scenarios) if (S.RegionId == RegionId) Here.Add(&S);
	if (Here.IsEmpty()) for (const FScenarioBoss& S : Scenarios) Here.Add(&S);
	if (Here.IsEmpty()) return FString();
	const FScenarioBoss* Pick = Here[NextScenario++ % Here.Num()];
	SpawnScenarioBoss(Pick->Id);
	return Pick->Id;
}

void AWFGameMode::SpawnScenarioBoss(const FString& ScenarioId)
{
	if (Scenarios.IsEmpty()) LoadScenarios();
	const FScenarioBoss* Found = Scenarios.FindByPredicate([&ScenarioId](const FScenarioBoss& S) { return S.Id == ScenarioId; });
	UWorld* World = GetWorld();
	APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Found || !World || !Player) return;

	const FVector Ahead = Player->GetActorLocation() + Player->GetActorForwardVector() * 3000.f;
	FHitResult Ground;
	const FVector At = World->LineTraceSingleByChannel(Ground, Ahead + FVector(0, 0, 5000), Ahead - FVector(0, 0, 20000), ECC_Visibility) ? Ground.ImpactPoint + FVector(0, 0, 150) : Ahead;
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	// sim.ts summonScenario: hp 34 x challenge enemyHp, elite boss of the scenario's region. Its gimmick (poise windows,
	// phases) is not ported yet, so it fights as a plain boss.
	const double MaxHealth = 34.0 * (Progression ? Progression->GetChallengeEnemyHealthScale() : 1.0);
	const FTransform Spawn(FRotator::ZeroRotator, At);
	if (AWFEnemy* Boss = World->SpawnActorDeferred<AWFEnemy>(AWFEnemy::StaticClass(), Spawn, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn))
	{
		Boss->Configure(Found->BossName, Found->RegionId, Found->Drop, true, true, MaxHealth);
		Boss->FinishSpawning(Spawn);
		Boss->ConfigureScenario(Found->Id);
		if (HasEncounter(Found->Id)) Toast(FString::Printf(TEXT("%s - read the tells, survive, punish the opening"), *Found->BossName), EncWarn);
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
