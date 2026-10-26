#include "WFGameMode.h"

#include "Engine/GameInstance.h"
#include "GameFramework/PlayerController.h"
#include "Dom/JsonValue.h"

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
#include "WFRaceSubsystem.h"
#include "WFShopSubsystem.h"
#include "WFFleetSubsystem.h"
#include "WFHousingSubsystem.h"
#include "WFVehicle.h"

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
	// entering the region, kills, survive time, heat and the Nexus hack reach the quests through TickCity (quest-signals.ts)

	// sim.ts createSim: the safe-zone perimeter turrets (each starts with a random cooldown)
	std::vector<wf::city::FRegionCircle> Circles;
	FString RegionsError;
	TArray<TSharedPtr<FJsonObject>> RegionRows;
	if (WFData::LoadRows(TEXT("Regions"), RegionRows, RegionsError))
		for (const TSharedPtr<FJsonObject>& R : RegionRows)
			Circles.push_back({WFData::ToStd(WFData::Str(R, TEXT("Id"))), WFData::ToStd(WFData::Str(R, TEXT("Kind"))), WFData::Num(R, TEXT("X")), WFData::Num(R, TEXT("Z")), WFData::Num(R, TEXT("Radius"))});
	Turrets = wf::city::MakeTurrets(Circles, []() { return static_cast<double>(FMath::FRand()); });
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
			Sky->GetLightComponent()->MarkRenderStateDirty(); // the component is already registered
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
				RegionSpeed = WFData::Num(Row, TEXT("Speed"), 0.9);
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
	TickRace(DeltaSeconds);
	TickCity(DeltaSeconds);
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

void AWFGameMode::TickCity(float DeltaSeconds)
{
	const double Dt = FMath::Min(static_cast<double>(DeltaSeconds), 0.25);
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	AWFCharacter* Player = Cast<AWFCharacter>(Pawn);
	if (const AWFVehicle* Car = Cast<AWFVehicle>(Pawn)) Player = Car->GetDriver();
	if (!Pawn) return;
	const FVector P = Pawn->GetActorLocation() / EncCmPerM;

	// perimeter turrets: track the nearest hostile in range and shoot it (2 damage, knocked outward); kills pay nothing
	TArray<AWFEnemy*> Enemies;
	std::vector<wf::city::FTurretTarget> Targets;
	for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It)
	{
		if (It->IsDead() || It->IsDecoy()) continue;
		Enemies.Add(*It);
		const FVector E = It->GetActorLocation() / EncCmPerM;
		Targets.push_back({E.X, E.Y, true, false});
	}
	for (wf::city::FTurret& T : Turrets)
		if (const std::optional<wf::city::FTurretShot> Shot = wf::city::StepTurret(T, Targets, Dt))
		{
			AWFEnemy* E = Enemies[Shot->Target];
			E->LaunchCharacter(FVector(Shot->KnockX, Shot->KnockZ, 0) * EncCmPerM, true, false);
			if (E->TakeHit(Shot->Damage, nullptr) > 0 && E->IsDead()) Toast(TEXT("Safe-zone turret destroyed an ambusher"), EncCyan);
		}
	DrawTurrets();

	// combat heat and the heat meter (Scene.tsx: stepHeatMeter off sim.combatHeat)
	CombatHeat = wf::city::DecayCombatHeat(CombatHeat, Dt);
	PlayerNoise = FMath::Max(0.0, PlayerNoise - Dt * 1.5);
	HeatMeter = wf::city::StepHeatMeter(HeatMeter, CombatHeat, Dt);
	if (UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()) Progression->SetCombatHeat(CombatHeat);

	// Nexus City surveillance: the turrets double as vision-cone sensors; H held on foot hacks
	const bool bNexus = IsInNexus();
	const bool bSeen = bNexus && wf::city::AnySensorSees(wf::city::NexusSensors(Turrets), P.X, P.Y);
	bHacking = bNexus && Player && Pawn == Player && Player->IsHackHeld();
	DetectionMeter = bNexus ? wf::city::StepDetectionMeter(DetectionMeter, Dt, bSeen, bHacking) : FMath::Max(0.0, DetectionMeter - Dt * 30);
	if (bHacking) HackProgress = wf::city::StepHackProgress(HackProgress, Dt, wf::city::DetectionStateFor(DetectionMeter));

	// the quest bridge: one HUD snapshot per frame
	UWFQuestSubsystem* Quests = GetGameInstance()->GetSubsystem<UWFQuestSubsystem>();
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Quests || !Progression) return;
	wf::city::FQuestHud Hud;
	Hud.RegionId = WFData::ToStd(RegionId);
	Hud.HeatLevel = wf::city::HeatLevelFor(HeatMeter);
	Hud.LockdownTier = wf::city::LockdownStatus(bNexus ? DetectionMeter : 0).Tier;
	Hud.HackProgress = HackProgress;
	Hud.bDiving = false; // the prototype has no diving
	Hud.Kills = Progression->GetSessionKills();
	Hud.Hp = Player ? Player->GetHealth() : 100;
	for (const wf::city::FSignalEvent& E : wf::city::QuestEventsFromHud(QuestSignals, Hud, Dt))
	{
		if (E.Type == "ENTER_WORLD") Quests->ReportEnterWorld(WFData::ToF(E.World));
		else if (E.Type == "KILL") Quests->ReportKill(WFData::ToF(E.World));
		else if (E.Type == "SURVIVED") Quests->ReportSurvived(WFData::ToF(E.World), E.Number);
		else if (E.Type == "HEAT_LEVEL") { Quests->ReportHeatLevel(static_cast<int32>(E.Number)); Toast(FString::Printf(TEXT("HEAT %d - %s"), static_cast<int32>(E.Number), UTF8_TO_TCHAR(wf::city::HeatStatus(HeatMeter).Response)), EncWarn); }
		else if (E.Type == "LOCKDOWN_TIER") { Quests->ReportLockdownTier(WFData::ToF(E.Tier)); if (bNexus) Toast(UTF8_TO_TCHAR(wf::city::LockdownStatus(DetectionMeter).Response), EncWarn); }
		else if (E.Type == "HACK_COMPLETE") { Quests->ReportHackComplete(); Toast(TEXT("Hack complete"), EncCyan); }
	}
}

void AWFGameMode::DrawTurrets() const
{
	for (const wf::city::FTurret& T : Turrets)
	{
		const FVector At(T.X * EncCmPerM, T.Z * EncCmPerM, GroundZ(T.X * EncCmPerM, T.Z * EncCmPerM, 0) + 250);
		DrawDebugBox(GetWorld(), At, FVector(60, 60, 120), T.Flash > 0 ? FColor(255, 230, 120) : FColor(90, 200, 255), false, -1.f, 0, 4.f);
		// the sensor cone: rules yaw rot is atan2(dx, dz) on (Unreal X, Unreal Y)
		const FVector Dir(std::sin(T.Rot), std::cos(T.Rot), 0);
		if (T.Zone == "nexus") DrawDebugCone(GetWorld(), At, Dir, static_cast<float>(T.Range * 0.75 * EncCmPerM), static_cast<float>(wf::city::VisionHalfAngle), 0.05f, 12, FColor(255, 80, 60, 120), false, -1.f, 0, 1.f);
	}
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
	if (const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()) Arena.EnemyHpScale = Progression->GetChallengeEnemyHealthScale();
	wf::encounter::StepEncounters(EncounterCatalog, Rules, Arena, DeltaSeconds, P.X, P.Y, Now);
	for (AWFEnemy* B : Bosses)
	{
		if (!B->Rules().bAlive) { B->Depart(); continue; } // Vaelith withdraws after the truce
		B->ApplyRules();
	}
	SyncDecoys();
	SyncSummons();
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

void AWFGameMode::SyncSummons()
{
	TSet<int64> Live;
	for (const wf::encounter::FSummon& S : Arena.Summons)
	{
		const int64 Id = static_cast<int64>(S.Id);
		Live.Add(Id);
		if (SummonActors.Contains(Id)) continue;
		const FVector Around(S.X * EncCmPerM, S.Z * EncCmPerM, 0);
		FHitResult Ground;
		const FVector At = GetWorld()->LineTraceSingleByChannel(Ground, Around + FVector(0, 0, 5000), Around - FVector(0, 0, 20000), ECC_Visibility) ? Ground.ImpactPoint + FVector(0, 0, 150) : Around;
		const FTransform Spawn(FRotator::ZeroRotator, At, FVector(S.Scale));
		if (AWFEnemy* Trooper = GetWorld()->SpawnActorDeferred<AWFEnemy>(AWFEnemy::StaticClass(), Spawn, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn))
		{
			Trooper->Configure(WFData::ToF(S.Profile), RegionId, TEXT("dataShards"), S.bElite, false, S.Hp); // hp already x challenge
			Trooper->ConfigureSummon(S.Id);
			Trooper->FinishSpawning(Spawn);
			SummonActors.Add(Id, Trooper);
		}
	}
	// the fight ended or reset: called-in troops leave with the boss, paying nothing
	for (auto It = SummonActors.CreateIterator(); It; ++It)
		if (!Live.Contains(It.Key()))
		{
			if (It.Value().IsValid() && !It.Value()->IsDead()) It.Value()->Destroy();
			It.RemoveCurrent();
		}
}

void AWFGameMode::OnSummonDefeated(AWFEnemy* Summon)
{
	SummonActors.Remove(static_cast<int64>(Summon->GetSummonId()));
	wf::encounter::OnSummonDefeated(Arena, Summon->GetSummonId());
}

void AWFGameMode::ShowEncounterEvents()
{
	for (const wf::encounter::FEvent& E : Arena.Events)
	{
		if (E.Id <= SeenEventId) continue;
		SeenEventId = E.Id;
		const FString Text = WFData::ToF(E.Text);
		if (E.Kind == "TELL") Toast(Text, EncWarn);
		else if (E.Kind == "SUMMON") Toast(FString::Printf(TEXT("%s joins the fight"), *Text), EncWarn);
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
	SyncSummons();
	ShowEncounterEvents();
}

void AWFGameMode::OnEncounterBossDefeated(AWFEnemy* Boss)
{
	Boss->SyncRules();
	wf::encounter::EndEncounter(EncounterCatalog, Boss->Rules(), Arena, GetWorld()->GetTimeSeconds());
	SyncDecoys();
	SyncSummons();
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
	// sim.ts summonScenario: hp boss-poise.ts BOSS_HP.scenario x challenge enemyHp, elite boss of the scenario's region; its encounter rules (poise
	// windows, phases, gimmicks) run in TickEncounters.
	const double MaxHealth = wf::encounter::BossHpScenario * (Progression ? Progression->GetChallengeEnemyHealthScale() : 1.0);
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
	const float Angle = FMath::FRandRange(0.f, 2.f * UE_PI);
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

// --- racing -----------------------------------------------------------------------------------------------------------

namespace
{
	constexpr double RaceCmPerM = 100.0;
	const FLinearColor RaceCyan(0.45f, 0.9f, 1.f), RaceGold(1.f, 0.82f, 0.35f), RaceWarn(1.f, 0.55f, 0.3f);
}

double AWFGameMode::GroundZ(double XCm, double YCm, double FallbackCm) const
{
	FHitResult Hit;
	const UWorld* World = GetWorld();
	FCollisionQueryParams Params(SCENE_QUERY_STAT(WFRaceGround), false);
	Params.AddIgnoredActor(UGameplayStatics::GetPlayerPawn(this, 0));
	if (World && World->LineTraceSingleByChannel(Hit, FVector(XCm, YCm, FallbackCm + 20000), FVector(XCm, YCm, FallbackCm - 50000), ECC_Visibility, Params))
		return Hit.ImpactPoint.Z;
	return FallbackCm;
}

void AWFGameMode::StartRace(const FString& RaceId, const FString& Difficulty)
{
	UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Racing || !Player) return;
	const wf::race::FRaceDef* Def = Racing->Catalog().Find(WFData::ToStd(RaceId));
	if (!Def) { Toast(FString::Printf(TEXT("Unknown race %s - ListRaces shows them"), *RaceId), RaceWarn); return; }
	if (Def->Mode == "dive") { Toast(TEXT("Dive courses need water - the prototype map has none"), RaceWarn); return; }
	// the web world is not ported: keep the course's own layout and put its start line 12 m ahead of the player
	const FVector Ahead = (Player->GetActorLocation() + Player->GetActorForwardVector() * 1200.f) / RaceCmPerM;
	const FString Error = Racing->StartRace(RaceId, Difficulty, Ahead.X - Def->Points[0].X, Ahead.Y - Def->Points[0].Z);
	if (!Error.IsEmpty()) { Toast(Error, RaceWarn); return; }
	RaceNotice.Reset();
	SeenRaceFinishes = Racing->GetFinishedCount();
	Toast(FString::Printf(TEXT("%s - %s course, %d checkpoints. Get to the start line%s"), *WFData::ToF(Def->Name), *WFData::ToF(Def->Mode),
		static_cast<int32>(Def->Points.size()) - 1, Def->Mode == "vehicle" ? TEXT(" in a vehicle (T calls one, E boards)") : TEXT("")), RaceGold);
}

void AWFGameMode::AbandonRace()
{
	if (UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>()) Racing->AbandonRace();
}

void AWFGameMode::ListRaces()
{
	const UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	if (!Racing) return;
	const TArray<FString> Lines = Racing->DescribeRaces();
	UE_LOG(LogTemp, Display, TEXT("Racing rank %s (score %g), %d courses:"), *Racing->GetRankName(), Racing->GetRacingScore(), Lines.Num());
	for (const FString& L : Lines) UE_LOG(LogTemp, Display, TEXT("  %s"), *L);
	Toast(FString::Printf(TEXT("%d courses listed in the output log - StartRace <id> [difficulty]"), Lines.Num()), RaceCyan);
}

void AWFGameMode::TickRace(float DeltaSeconds)
{
	UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Racing || !Pawn) return;
	if (Racing->IsRacing())
	{
		const AWFVehicle* Vehicle = Cast<AWFVehicle>(Pawn);
		const bool bDisabled = Vehicle && wf::vehicle::ConditionEffects(Vehicle->GetCondition()).bDisabled;
		const FVector P = Pawn->GetActorLocation() / RaceCmPerM;
		// Scene.tsx stepActivity: mode from whether the Operator is driving; no diving in the prototype
		Racing->Tick(P.X, P.Y, P.Z, DeltaSeconds, Vehicle ? "vehicle" : "foot", bDisabled);
		double RX = 0, RZ = 0;
		if (Racing->TakeRecovery(RX, RZ))
		{
			const double Z = GroundZ(RX * RaceCmPerM, RZ * RaceCmPerM, Pawn->GetActorLocation().Z) + (Vehicle ? 120.0 : 100.0);
			const FVector At(RX * RaceCmPerM, RZ * RaceCmPerM, Z);
			if (AWFVehicle* Car = Cast<AWFVehicle>(Pawn)) Car->Recover(At);
			else Pawn->SetActorLocation(At, false, nullptr, ETeleportType::TeleportPhysics);
		}
		if (const wf::race::FRun* Run = Racing->ActiveRun())
		{
			const FString Notice = Run->Notice ? WFData::ToF(*Run->Notice) : FString();
			if (Notice != RaceNotice && !Notice.IsEmpty()) Toast(Notice, RaceWarn);
			RaceNotice = Notice;
		}
		DrawRace();
	}
	if (Racing->GetFinishedCount() != SeenRaceFinishes)
	{
		SeenRaceFinishes = Racing->GetFinishedCount();
		for (const FString& L : Racing->GetLastSummary()) Toast(L, RaceGold);
	}
}

void AWFGameMode::DrawRace() const
{
	const UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	const wf::race::FRaceDef* Def = Racing ? Racing->ActiveDef() : nullptr;
	const wf::race::FRun* Run = Racing ? Racing->ActiveRun() : nullptr;
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	UWorld* World = GetWorld();
	if (!Def || !Run || !Pawn || !World) return;
	const double Base = Pawn->GetActorLocation().Z;
	auto At = [&](double X, double Z) { const double WX = (X + Racing->OffsetX()) * RaceCmPerM, WY = (Z + Racing->OffsetZ()) * RaceCmPerM; return FVector(WX, WY, GroundZ(WX, WY, Base)); };
	const bool bStaging = Run->Phase == "staging" || Run->Phase == "countdown";
	const int32 Last = static_cast<int32>(Def->Points.size()) - 1;
	const float Radius = static_cast<float>((bStaging ? wf::race::StartRadius : wf::race::CheckpointRadius(Def->Mode)) * RaceCmPerM);
	// the gate to make, and a faint one after it
	const int32 Target = bStaging ? 0 : FMath::Clamp(Run->Next, 0, Last);
	for (int32 I = Target; I <= FMath::Min(Target + 1, Last); ++I)
	{
		const wf::race::FPoint& Pt = Def->Points[I];
		const bool bShut = Pt.WindowPeriod && !wf::race::WindowOpen(Pt, Run->Time);
		const FColor C = I == Target ? (bShut ? FColor(255, 70, 60) : I == Last ? FColor(255, 210, 90) : FColor(110, 230, 255)) : FColor(60, 110, 140);
		const FVector G = At(Pt.X, Pt.Z);
		DrawDebugCylinder(World, G, G + FVector(0, 0, 600), I == Target ? Radius : static_cast<float>(wf::race::CheckpointRadius(Def->Mode) * RaceCmPerM), 32, C, false, -1.f, 0, I == Target ? 8.f : 3.f);
	}
	// shortcuts available from this gate
	for (const wf::race::FShortcut& S : Def->Shortcuts)
		if (!bStaging && S.At == Run->Next) { const FVector G = At(S.ViaX, S.ViaZ); DrawDebugCylinder(World, G, G + FVector(0, 0, 400), static_cast<float>(wf::race::CheckpointRadius(Def->Mode) * RaceCmPerM), 24, FColor(190, 120, 255), false, -1.f, 0, 4.f); }
	// track obstacles on the current leg
	for (const wf::race::FObstacle& O : Def->Obstacles)
		if (O.Segment == Run->Next) { const FVector G = At(O.X, O.Z); DrawDebugBox(World, G + FVector(0, 0, 100), FVector(O.Radius * 70, O.Radius * 70, 100), FColor(255, 120, 40), false, -1.f, 0, 6.f); }
	// rivals on their deterministic pace (racing.ts rivalPositions)
	if (Run->Phase == "running")
		for (const wf::race::FRivalPos& R : wf::race::RivalPositions(*Def, Run->Difficulty, Run->Time))
			DrawDebugSphere(World, At(R.X, R.Z) + FVector(0, 0, 120), 90.f, 10, FColor(255, 90, 160), false, -1.f, 0, 4.f);
}

// --- merchants ----------------------------------------------------------------------------------------------------------

void AWFGameMode::ListShops()
{
	const UWFShopSubsystem* Shops = GetGameInstance()->GetSubsystem<UWFShopSubsystem>();
	if (!Shops) return;
	const TArray<FString> Lines = Shops->DescribeShops();
	for (const FString& L : Lines) UE_LOG(LogTemp, Display, TEXT("  %s"), *L);
	Toast(FString::Printf(TEXT("%d shops listed in the output log - Shop <id> opens one"), Lines.Num()), FLinearColor(0.45f, 0.9f, 1.f));
}

void AWFGameMode::Shop(const FString& ShopId)
{
	UWFShopSubsystem* Shops = GetGameInstance()->GetSubsystem<UWFShopSubsystem>();
	if (!Shops) return;
	const FString Error = Shops->OpenShop(ShopId);
	if (!Error.IsEmpty()) Toast(Error, FLinearColor(1.f, 0.55f, 0.3f));
}

void AWFGameMode::CloseShop()
{
	if (UWFShopSubsystem* Shops = GetGameInstance()->GetSubsystem<UWFShopSubsystem>()) Shops->CloseShop();
}

void AWFGameMode::Buy(int32 OfferIndex)
{
	if (UWFShopSubsystem* Shops = GetGameInstance()->GetSubsystem<UWFShopSubsystem>()) Toast(Shops->Buy(OfferIndex), FLinearColor(1.f, 0.82f, 0.35f));
}

void AWFGameMode::Service(const FString& ItemId, const FString& Element)
{
	if (UWFShopSubsystem* Shops = GetGameInstance()->GetSubsystem<UWFShopSubsystem>()) Toast(Shops->Service(ItemId, Element), FLinearColor(1.f, 0.82f, 0.35f));
}

void AWFGameMode::Inventory()
{
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Progression) return;
	for (const wf::FGearItem& G : Progression->Get().Inventory)
		UE_LOG(LogTemp, Display, TEXT("  %-34s %-28s %-10s lv %2d  power %3d  %s"), *WFData::ToF(G.Id), *WFData::ToF(G.Name), *WFData::ToF(G.Slot), FMath::RoundToInt32(G.Level), FMath::RoundToInt32(G.Power), *WFData::ToF(G.Element));
	Toast(FString::Printf(TEXT("%d items listed in the output log"), static_cast<int32>(Progression->Get().Inventory.size())), FLinearColor(0.45f, 0.9f, 1.f));
}

void AWFGameMode::ShopHour(float Hour)
{
	if (UWFShopSubsystem* Shops = GetGameInstance()->GetSubsystem<UWFShopSubsystem>()) Shops->SetWorldHour(Hour);
}

// --- the fleet -----------------------------------------------------------------------------------------------------------

namespace
{
	const FLinearColor FleetGold(1.f, 0.82f, 0.35f);
}

void AWFGameMode::Fleet()
{
	const UWFFleetSubsystem* F = GetGameInstance()->GetSubsystem<UWFFleetSubsystem>();
	if (!F) return;
	const TArray<FString> Lines = F->DescribeFleet();
	for (const FString& L : Lines) UE_LOG(LogTemp, Display, TEXT("  %s"), *L);
	Toast(TEXT("Garage bases and fleet builds listed in the output log"), FLinearColor(0.45f, 0.9f, 1.f));
}
void AWFGameMode::BuyGarage(const FString& Id) { if (UWFFleetSubsystem* F = GetGameInstance()->GetSubsystem<UWFFleetSubsystem>()) Toast(F->BuyGarage(Id), FleetGold); }
void AWFGameMode::BuyFleet(const FString& Id) { if (UWFFleetSubsystem* F = GetGameInstance()->GetSubsystem<UWFFleetSubsystem>()) Toast(F->BuyBuild(Id), FleetGold); }
void AWFGameMode::FleetActive(const FString& Id) { if (UWFFleetSubsystem* F = GetGameInstance()->GetSubsystem<UWFFleetSubsystem>()) Toast(F->SetActive(Id), FleetGold); }
void AWFGameMode::Tune(const FString& Id, const FString& Node) { if (UWFFleetSubsystem* F = GetGameInstance()->GetSubsystem<UWFFleetSubsystem>()) Toast(F->Tune(Id, Node), FleetGold); }
void AWFGameMode::Paint(const FString& Id, const FString& PaintName) { if (UWFFleetSubsystem* F = GetGameInstance()->GetSubsystem<UWFFleetSubsystem>()) Toast(F->Paint(Id, PaintName), FleetGold); }
void AWFGameMode::Cosmetic(const FString& Id, const FString& Key, const FString& Value) { if (UWFFleetSubsystem* F = GetGameInstance()->GetSubsystem<UWFFleetSubsystem>()) Toast(F->Cosmetic(Id, Key, Value), FleetGold); }

// --- housing ---------------------------------------------------------------------------------------------------------

void AWFGameMode::Operators()
{
	const UWFProgressionSubsystem* P = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!P) return;
	TArray<FString> Rows;
	P->DescribeOperators().ParseIntoArrayLines(Rows);
	for (const FString& L : Rows) UE_LOG(LogTemp, Display, TEXT("  %s"), *L);
	Toast(TEXT("Each operator's level and money listed in the output log"), FLinearColor(0.45f, 0.9f, 1.f));
}
void AWFGameMode::Homes()
{
	const UWFHousingSubsystem* H = GetGameInstance()->GetSubsystem<UWFHousingSubsystem>();
	if (!H) return;
	for (const FString& L : H->Describe()) UE_LOG(LogTemp, Display, TEXT("  %s"), *L);
	Toast(TEXT("Homes, residences and decor listed in the output log"), FLinearColor(0.45f, 0.9f, 1.f));
}
void AWFGameMode::BuyHome(const FString& Id) { if (UWFHousingSubsystem* H = GetGameInstance()->GetSubsystem<UWFHousingSubsystem>()) Toast(H->BuyProperty(Id), FleetGold); }
void AWFGameMode::BuyDecor(const FString& Id) { if (UWFHousingSubsystem* H = GetGameInstance()->GetSubsystem<UWFHousingSubsystem>()) Toast(H->BuyDecor(Id), FleetGold); }
void AWFGameMode::PlaceDecor(const FString& Home, int32 Room, const FString& Slot, const FString& Decor) { if (UWFHousingSubsystem* H = GetGameInstance()->GetSubsystem<UWFHousingSubsystem>()) Toast(H->PlaceDecor(Home, Room, Slot, Decor), FleetGold); }
void AWFGameMode::Park(const FString& Build, const FString& Residence) { if (UWFHousingSubsystem* H = GetGameInstance()->GetSubsystem<UWFHousingSubsystem>()) Toast(H->Park(Build, Residence), FleetGold); }
void AWFGameMode::Unpark(const FString& Build) { if (UWFHousingSubsystem* H = GetGameInstance()->GetSubsystem<UWFHousingSubsystem>()) Toast(H->Unpark(Build), FleetGold); }
