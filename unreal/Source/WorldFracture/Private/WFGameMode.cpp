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
#include "WFNexusCity.h"
#include "WFAtmosphere.h"
#include "WFTerrain.h"
#include "WFWorldBuildings.h"
#include "WFProgressionSubsystem.h"
#include "WFQuestSubsystem.h"
#include "WFRaceSubsystem.h"
#include "WFShopSubsystem.h"
#include "WFFleetSubsystem.h"
#include "WFHousingSubsystem.h"
#include "WFVehicle.h"
#include "Core/WFJsCompat.h"
#include "Core/WFStrikeCore.h"
#include "Core/WFStuntCore.h"
#include "Core/WFHazardCore.h"
#include "Core/WFStashCore.h"
#include "Core/WFPvpCore.h"
#include "WFStuntPark.h"
#include "WFActivitySubsystem.h"

#include <algorithm>

AWFGameMode::AWFGameMode()
{
	DefaultPawnClass = AWFCharacter::StaticClass();
	HUDClass = AWFHUD::StaticClass();
	PrimaryActorTick.bCanEverTick = true;
}

void AWFGameMode::StartPlay()
{
	Super::StartPlay();
	const bool bRoster = LoadRoster();
	SpawnTerrain();
	SpawnNexusCity();
	SpawnWorldBuildings(); // after the city: it levels the ground the buildings near it stand on
	// the player starts in their region: Nexus on the hub's spawn pad, anywhere else at the region's centre on the land
	if (IsInNexus()) PlaceAtNexus();
	else PlaceInRegion();
	if (Terrain.IsValid())
		if (const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0)) Terrain->BuildAround(Pawn->GetActorLocation(), 300); // ground under them now
	EnsurePlayableWorld();
	if (IsInNexus() && NexusCity.IsValid()) NexusCity->ApplyNightLook();
	if (!bRoster) UE_LOG(LogTemp, Error, TEXT("No roster for region %s; no enemies will spawn."), *RegionId);
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
		{
			RegionNames.Add(WFData::Str(R, TEXT("Id")), WFData::Str(R, TEXT("DisplayName")));
			RegionDifficulties.Add(WFData::Str(R, TEXT("Id")), WFData::Num(R, TEXT("Difficulty")));
			RegionKinds.Add(WFData::Str(R, TEXT("Id")), WFData::Str(R, TEXT("Kind")));
			RegionCircles.Add(WFData::Str(R, TEXT("Id")), wf::godforge::FRegionCircle{WFData::Num(R, TEXT("X")), WFData::Num(R, TEXT("Z")), WFData::Num(R, TEXT("Radius"))});
		}
	if (const wf::godforge::FRegionCircle* Mine = RegionCircles.Find(RegionId)) RegionCircle = *Mine;
	if (RegionRows.Num())
		for (const TSharedPtr<FJsonObject>& R : RegionRows)
			Circles.push_back({WFData::ToStd(WFData::Str(R, TEXT("Id"))), WFData::ToStd(WFData::Str(R, TEXT("Kind"))), WFData::Num(R, TEXT("X")), WFData::Num(R, TEXT("Z")), WFData::Num(R, TEXT("Radius"))});
	Turrets = wf::city::MakeTurrets(Circles, []() { return static_cast<double>(FMath::FRand()); });
}

void AWFGameMode::EnsurePlayableWorld()
{
	UWorld* World = GetWorld();
	if (!World) return;

	if (TActorIterator<ADirectionalLight> Existing(World); Existing)
	{
		SunLight = *Existing; // the clock turns the level's own sun, which must be movable for that
		if (Existing->GetLightComponent()) Existing->GetLightComponent()->SetMobility(EComponentMobility::Movable);
	}
	else
	{
		ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(FVector(0, 0, 2000), FRotator(-40.f, 35.f, 0.f));
		if (Sun && Sun->GetLightComponent())
		{
			Sun->GetLightComponent()->SetMobility(EComponentMobility::Movable);
			Sun->GetLightComponent()->SetIntensity(6.f);
		}
		SunLight = Sun;
	}
	if (!TActorIterator<ASkyLight>(World))
		if (ASkyLight* Sky = World->SpawnActor<ASkyLight>(FVector(0, 0, 1000), FRotator::ZeroRotator))
		{
			Sky->GetLightComponent()->SetMobility(EComponentMobility::Movable);
			Sky->GetLightComponent()->SetIntensity(1.f);
			Sky->GetLightComponent()->bRealTimeCapture = true;
			Sky->GetLightComponent()->MarkRenderStateDirty(); // the component is already registered
		}

	// the realistic sky and air: Sky Atmosphere, volumetric clouds, height fog and the camera grade; it takes over the
	// sun (as the atmosphere's sun light) and the sky light (captured live from that sky)
	if (!Atmosphere.IsValid() && !TActorIterator<AWFAtmosphere>(World))
		if (AWFAtmosphere* Air = World->SpawnActor<AWFAtmosphere>(FVector::ZeroVector, FRotator::ZeroRotator))
		{
			ASkyLight* SkyActor = nullptr;
			for (TActorIterator<ASkyLight> It(World); It; ++It) { SkyActor = *It; break; }
			ADirectionalLight* Sun = SunLight.Get();
			Air->Bind(Sun ? Cast<UDirectionalLightComponent>(Sun->GetLightComponent()) : nullptr, SkyActor ? SkyActor->GetLightComponent() : nullptr);
			Atmosphere = Air;
		}

	// A floor under the player if the level has nothing to stand on (never with the terrain: it is the ground, and a
	// plane at Z = 0 would sit under the land or in the sea)
	if (Terrain.IsValid()) return;
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

void AWFGameMode::SpawnTerrain()
{
	if (Terrain.IsValid() || !GetWorld()) return;
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AWFTerrain* Ground = GetWorld()->SpawnActor<AWFTerrain>(AWFTerrain::StaticClass(), FTransform::Identity, Params);
	if (Ground && Ground->Load())
	{
		Terrain = Ground;
		// the level's own template floor would poke through the land (the terrain is the ground now)
		for (TActorIterator<AStaticMeshActor> It(GetWorld()); It; ++It)
		{
			const UStaticMeshComponent* Mesh = It->GetStaticMeshComponent();
			const FString Name = Mesh && Mesh->GetStaticMesh() ? Mesh->GetStaticMesh()->GetName() : FString();
			if (Name.Contains(TEXT("Floor")) || Name.Contains(TEXT("Template")))
			{
				It->SetActorHiddenInGame(true);
				It->SetActorEnableCollision(false);
			}
		}
	}
	else if (Ground) Ground->Destroy();
}

void AWFGameMode::SpawnNexusCity()
{
	if (NexusCity.IsValid() || !GetWorld()) return;
	// deferred: the city has to know whether it stands on the terrain before it builds (at BeginPlay)
	AWFNexusCity* City = GetWorld()->SpawnActorDeferred<AWFNexusCity>(AWFNexusCity::StaticClass(), FTransform::Identity, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
	if (!City) return;
	City->bOnTerrain = Terrain.IsValid();
	City->FinishSpawning(FTransform::Identity);
	if (!City->IsBuilt()) { City->Destroy(); return; }
	NexusCity = City;
	// level the land under the city to its hub ground, blending back to the hills past its edge
	if (Terrain.IsValid())
	{
		const FVector Hub = City->GetHubCentre() / 100.0;
		Terrain->SetFlatPad(Hub.X, Hub.Y, City->GetDatum(), City->GetCityRadius() + 15, City->GetCityRadius() + 50);
	}
}

void AWFGameMode::SpawnWorldBuildings()
{
	if (WorldBuildings.IsValid() || !GetWorld()) return;
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AWFWorldBuildings* Built = GetWorld()->SpawnActor<AWFWorldBuildings>(AWFWorldBuildings::StaticClass(), FTransform::Identity, Params);
	if (Built && Built->Build(Terrain.Get())) WorldBuildings = Built;
	else if (Built) Built->Destroy();
}

void AWFGameMode::PlaceInRegion()
{
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Pawn || !Terrain.IsValid()) return; // no terrain: keep the level's own start
	FString Error;
	TArray<TSharedPtr<FJsonObject>> Rows;
	if (!WFData::LoadRows(TEXT("Regions"), Rows, Error)) return;
	for (const TSharedPtr<FJsonObject>& Row : Rows)
	{
		if (WFData::Str(Row, TEXT("Id")) != RegionId) continue;
		const double X = WFData::Num(Row, TEXT("X")), Z = WFData::Num(Row, TEXT("Z"));
		const double Ground = FMath::Max(Terrain->HeightAt(X, Z), Terrain->GetWaterLevel());
		Pawn->SetActorLocation(FVector(X * 100.0, Z * 100.0, Ground * 100.0 + 200.0), false, nullptr, ETeleportType::TeleportPhysics);
		return;
	}
}

void AWFGameMode::PlaceAtNexus()
{
	if (!NexusCity.IsValid()) return;
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Pawn) return;
	Pawn->SetActorLocation(NexusCity->GetSpawnLocation(), false, nullptr, ETeleportType::TeleportPhysics);
	if (AController* Controller = Pawn->GetController()) Controller->SetControlRotation(NexusCity->GetSpawnRotation());
}

void AWFGameMode::GoNexus()
{
	if (!NexusCity.IsValid()) SpawnNexusCity();
	if (!NexusCity.IsValid()) { Toast(TEXT("Nexus City could not be built (DataTables/NexusCity.json missing)"), FLinearColor(1.f, 0.55f, 0.3f)); return; }
	for (const TWeakObjectPtr<AWFEnemy>& E : Squad) if (E.IsValid()) E->Destroy(); // the old region's troopers don't follow you in
	Squad.Reset();
	LoadRoster(TEXT("nexus"));
	PlaceAtNexus();
	if (Terrain.IsValid()) Terrain->BuildAround(NexusCity->GetSpawnLocation(), 300);
	NexusCity->ApplyNightLook();
	Toast(TEXT("Nexus City"), FLinearColor(0.45f, 0.9f, 1.f));
}

bool AWFGameMode::LoadRoster(const FString& Override)
{
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	RegionId = !Override.IsEmpty() ? Override : Progression ? WFData::ToF(Progression->Get().CurrentWorld) : TEXT("veridan");
	{
		// sim.ts factionOf: the region's trooper kind (who carries grenades)
		FString FactionError;
		TArray<TSharedPtr<FJsonObject>> FactionRows;
		if (WFData::LoadRows(TEXT("RegionFactions"), FactionRows, FactionError))
			for (const TSharedPtr<FJsonObject>& Row : FactionRows) FactionByRegion.Add(WFData::Str(Row, TEXT("Region")), WFData::Str(Row, TEXT("Faction")));
	}

	FString Error;
	TArray<TSharedPtr<FJsonObject>> Rows;
	if (WFData::LoadRows(TEXT("Regions"), Rows, Error))
		for (const TSharedPtr<FJsonObject>& Row : Rows)
			if (WFData::Str(Row, TEXT("Id")) == RegionId)
			{
				RegionName = WFData::Str(Row, TEXT("DisplayName"));
				RegionDifficulty = WFData::Num(Row, TEXT("Difficulty"));
				RegionSpeed = WFData::Num(Row, TEXT("Speed"), 0.9);
				RegionKind = WFData::Str(Row, TEXT("Kind"));
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
	TickGrenades(DeltaSeconds);
	TickWasteland(DeltaSeconds);
	TickEnvironment(DeltaSeconds);
	TickNemesis(DeltaSeconds);
	TickGodforge(DeltaSeconds);
	TickWorldBoss(DeltaSeconds);
	TickRegionHazard(DeltaSeconds);
	TickActivity(DeltaSeconds);
	// sim.ts: weapon cooling; venting from an overheat is slower than a normal cooldown
	if (wf::vweapons::CoolHeat(WeaponHeat, FMath::Min(static_cast<double>(DeltaSeconds), 0.25))) Toast(TEXT("Weapon cooled - ready"), FLinearColor(0.45f, 0.9f, 1.f));
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
			if (!IsValid(E) || E->IsDead()) continue;
			E->AddKnock(Shot->KnockX, Shot->KnockZ); // the shared knock model (bosses are heavy)
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
	// survive time is summed and sent once a second: each report copies and re-broadcasts the whole save
	for (auto It = PendingSurvive.CreateIterator(); It; ++It)
		if (It.Value() >= 1.0 || It.Key() != RegionId) { Quests->ReportSurvived(It.Key(), It.Value()); It.RemoveCurrent(); }
	Hud.Hp = Player ? Player->GetHealth() : 100;
	for (const wf::city::FSignalEvent& E : wf::city::QuestEventsFromHud(QuestSignals, Hud, Dt))
	{
		if (E.Type == "ENTER_WORLD") Quests->ReportEnterWorld(WFData::ToF(E.World));
		else if (E.Type == "KILL") Quests->ReportKill(WFData::ToF(E.World));
		else if (E.Type == "SURVIVED") PendingSurvive.FindOrAdd(WFData::ToF(E.World)) += E.Number;
		else if (E.Type == "HEAT_LEVEL") { Quests->ReportHeatLevel(static_cast<int32>(E.Number)); Toast(FString::Printf(TEXT("HEAT %d - %s"), static_cast<int32>(E.Number), UTF8_TO_TCHAR(wf::city::HeatStatus(HeatMeter).Response)), EncWarn); }
		else if (E.Type == "LOCKDOWN_TIER") { Quests->ReportLockdownTier(WFData::ToF(E.Tier)); if (bNexus) Toast(UTF8_TO_TCHAR(wf::city::LockdownStatus(DetectionMeter).Response), EncWarn); }
		else if (E.Type == "HACK_COMPLETE") { Quests->ReportHackComplete(); Toast(TEXT("Hack complete"), EncCyan); }
	}
}

bool AWFGameMode::CanThrowGrenade() const
{
	return static_cast<int32>(Grenades.size()) < wf::tactics::FGrenadeTuning::MaxLive && GrenadeCool <= 0;
}

void AWFGameMode::ThrowGrenade(const FVector& FromM, const FVector& TargetM)
{
	// rules points are (x, y up, z): Unreal (X, Z, Y)
	FHitResult Floor;
	const FVector Over(TargetM.X * EncCmPerM, TargetM.Y * EncCmPerM, 0);
	const double TargetGround = GetWorld()->LineTraceSingleByObjectType(Floor, Over + FVector(0, 0, 500000), Over - FVector(0, 0, 500000), FCollisionObjectQueryParams(ECC_WorldStatic)) ? Floor.ImpactPoint.Z / EncCmPerM : TargetM.Z - 1;
	const wf::tactics::FLob V = wf::tactics::LobVelocity({FromM.X, FromM.Z, FromM.Y}, {TargetM.X, TargetGround, TargetM.Y});
	wf::tactics::FGrenade G;
	G.X = FromM.X; G.Y = FromM.Z; G.Z = FromM.Y; G.Vx = V.Vx; G.Vy = V.Vy; G.Vz = V.Vz; G.Fuse = wf::tactics::FGrenadeTuning::Fuse; G.Id = NextGrenadeId++;
	Grenades.push_back(G);
	GrenadeCool = wf::tactics::FGrenadeTuning::SquadCooldown;
	if (const APawn* P = UGameplayStatics::GetPlayerPawn(this, 0))
		if (FVector::Dist2D(P->GetActorLocation() / EncCmPerM, FromM) < 26) Toast(TEXT("GRENADE - move!"), EncWarn);
}

int32 AWFGameMode::CountFlankers() const
{
	int32 N = 0;
	for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It) if (!It->IsDead() && It->IsFlanking()) ++N;
	return N;
}

void AWFGameMode::TickGrenades(float DeltaSeconds)
{
	const double Dt = FMath::Min(static_cast<double>(DeltaSeconds), 0.1);
	GrenadeCool = FMath::Max(0.0, GrenadeCool - Dt);
	// the player's rounds in flight, for enemies to dodge
	PlayerRounds.clear();
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	AWFCharacter* Player = Cast<AWFCharacter>(Pawn);
	AWFVehicle* Car = Cast<AWFVehicle>(Pawn);
	if (Car) { Car->AppendRounds(PlayerRounds); Player = Car->GetDriver(); }
	if (Player) Player->AppendRounds(PlayerRounds);
	if (Grenades.empty()) return;
	// static geometry only (a grenade rests on the ground, not on a trooper's head), from well above any terrain
	UWorld* World = GetWorld();
	const auto Ground = [World](double X, double Z) {
		FHitResult Hit;
		const FVector At(X * EncCmPerM, Z * EncCmPerM, 0);
		return World->LineTraceSingleByObjectType(Hit, At + FVector(0, 0, 500000), At - FVector(0, 0, 500000), FCollisionObjectQueryParams(ECC_WorldStatic)) ? Hit.ImpactPoint.Z / EncCmPerM : -1e9;
	};
	for (size_t I = Grenades.size(); I-- > 0;)
	{
		wf::tactics::FGrenade& G = Grenades[I];
		wf::tactics::StepGrenade(G, Dt, Ground);
		const FVector At(G.X * EncCmPerM, G.Z * EncCmPerM, G.Y * EncCmPerM);
		// telegraph: a danger ring the size of the blast and the grenade itself
		DrawDebugCircle(GetWorld(), At + FVector(0, 0, 5), static_cast<float>(wf::tactics::FGrenadeTuning::Radius * EncCmPerM), 32, FColor(255, 60, 40), false, -1.f, 0, 4.f, FVector(0, 1, 0), FVector(1, 0, 0), false);
		DrawDebugSphere(GetWorld(), At, 15.f, 8, FColor(255, 200, 60), false, -1.f);
		if (G.Fuse > 0) continue;
		// the blast: falloff to the edge, softened when cover stands between it and the player's chest
		if (Pawn && Player)
		{
			const FVector Chest = Pawn->GetActorLocation() + FVector(0, 0, 40);
			const double Dist = FVector::Dist(Chest, At) / EncCmPerM;
			FHitResult H;
			FCollisionQueryParams Q(SCENE_QUERY_STAT(WFGrenade), false, Pawn);
			Q.AddIgnoredActor(Player);
			const bool bCovered = GetWorld()->LineTraceSingleByObjectType(H, At + FVector(0, 0, 40), Chest, FCollisionObjectQueryParams(ECC_WorldStatic), Q); // walls cover, troopers don't
			const double Dmg = wf::tactics::GrenadeDamage(Dist, bCovered);
			if (Dmg > 0)
			{
				const double Before = Player->GetHealth();
				Player->ApplyHit(Dmg, TEXT("grenade"));
				if (Car && Player->GetHealth() < Before) Car->TakeEnemyFire(Before - Player->GetHealth());
			}
		}
		AddCombatHeat(wf::city::FHeatGain::Grenade);
		DrawDebugSphere(GetWorld(), At, static_cast<float>(wf::tactics::FGrenadeTuning::Radius * EncCmPerM), 16, FColor(255, 120, 40), false, 0.4f, 0, 4.f);
		Grenades.erase(Grenades.begin() + static_cast<std::ptrdiff_t>(I));
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
	// summon-skills.ts reads where each called-in troop stands
	for (wf::encounter::FSummon& S : Arena.Summons)
		if (const TWeakObjectPtr<AWFEnemy>* A = SummonActors.Find(static_cast<int64>(S.Id)); A && A->IsValid() && !(*A)->IsDead())
		{
			S.X = (*A)->GetActorLocation().X / EncCmPerM; S.Z = (*A)->GetActorLocation().Y / EncCmPerM;
		}
	wf::encounter::StepEncounters(EncounterCatalog, Rules, Arena, DeltaSeconds, P.X, P.Y, Now);
	// sim.ts pinSummons: pinned troops do not walk themselves, so the end-of-frame pin can follow the skill step directly
	wf::encounter::StepSummonPins(Arena, DeltaSeconds, P.X, P.Y);
	for (AWFEnemy* B : Bosses)
	{
		if (!B->Rules().bAlive) { B->Depart(); continue; } // Vaelith withdraws after the truce
		B->ApplyRules();
	}
	SyncDecoys();
	SyncSummons();
	for (const wf::encounter::FSummon& S : Arena.Summons)
		if (const TWeakObjectPtr<AWFEnemy>* A = SummonActors.Find(static_cast<int64>(S.Id)); A && A->IsValid() && !(*A)->IsDead())
		{
			AWFEnemy* Troop = A->Get();
			Troop->SetSkillControl(wf::encounter::IsPinned(S), wf::encounter::HoldsFire(S));
			if (!wf::encounter::IsPinned(S)) continue;
			// rules yaw r faces (sin r, cos r) on (X, Y): Unreal yaw = 90 deg - r
			Troop->SetActorLocation(FVector(S.X * EncCmPerM, S.Z * EncCmPerM, Troop->GetActorLocation().Z), true);
			Troop->SetActorRotation(FRotator(0.f, static_cast<float>(90.0 - FMath::RadiansToDegrees(S.Rot)), 0.f));
		}
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
			Trooper->SetKind(WFData::ToF(S.Kind));
			Trooper->SetSquadIndex(NextSquadIndex++);
			Trooper->ConfigureSummon(S.Id, S.Scale);
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
		// a real kill's VICTORY pays the boss bounty to the operator being played (Scene.tsx BOSS_BOUNTY)
		if (E.Kind == "VICTORY" && !E.ScenarioId.empty())
		{
			if (UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>())
			{
				bool bFirst = false;
				const double Paid = Progression->ClaimBossBounty(WFData::ToF(E.ScenarioId), bFirst);
				if (Paid > 0) Toast(FString::Printf(TEXT("%s paid: NEX %s"), bFirst ? TEXT("Boss bounty") : TEXT("Daily boss bounty"), *FText::AsNumber(static_cast<int64>(Paid)).ToString()), EncGold);
			}
		}
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
		if (const FString* Faction = FactionByRegion.Find(Found->RegionId)) Boss->SetKind(*Faction); // sim.ts factionOf(scenario.regionId)
		Boss->SetSquadIndex(NextSquadIndex++);
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
		if (const FString* Faction = FactionByRegion.Find(RegionId)) Enemy->SetKind(*Faction);
		Enemy->SetSquadIndex(NextSquadIndex++); // sim.ts: the machine index sets the squad role and swing side
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
	if (Terrain.IsValid()) return Terrain->HeightAtCm(XCm, YCm); // beyond the streamed tiles: the heightmap itself
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
	if (Hour < 0) { Toast(TEXT("The shops follow the world clock now: ShopHour / Clock <0-24>"), FLinearColor(1.f, 0.55f, 0.3f)); return; }
	Clock(Hour, static_cast<float>(ClockSpeed));
}

void AWFGameMode::Clock(float Hour, float Speed)
{
	// Scene.tsx debug time(hour): the clock keeps its day count so the season does not jump
	DayClock = FMath::FloorToDouble(DayClock) + FMath::Fmod(FMath::Fmod(static_cast<double>(Hour) / 24, 1.0) + 1.0, 1.0);
	if (Speed > 0) ClockSpeed = Speed;
	Toast(FString::Printf(TEXT("Clock %s (%s), pace x%g"), UTF8_TO_TCHAR(wf::env::ClockLabel(DayClock).c_str()), UTF8_TO_TCHAR(wf::env::PhaseFor(DayClock).c_str()), ClockSpeed), FLinearColor(0.45f, 0.9f, 1.f));
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

// --- the Wastelands activities ----------------------------------------------------------------------------------------

namespace
{
	constexpr double WlCmPerM = 100.0;
	const FLinearColor WlGold(1.f, 0.82f, 0.35f), WlWarn(1.f, 0.55f, 0.3f);
}

FVector AWFGameMode::WasteToWorld(double X, double Z, double BaseZ) const
{
	const double WX = WasteAnchorCm.X + (X - wf::wasteland::RegionCentre.X) * WlCmPerM, WY = WasteAnchorCm.Y + (Z - wf::wasteland::RegionCentre.Z) * WlCmPerM;
	return FVector(WX, WY, GroundZ(WX, WY, BaseZ));
}

FVector2D AWFGameMode::WorldToWaste(const FVector& L) const
{
	return FVector2D((L.X - WasteAnchorCm.X) / WlCmPerM + wf::wasteland::RegionCentre.X, (L.Y - WasteAnchorCm.Y) / WlCmPerM + wf::wasteland::RegionCentre.Z);
}

void AWFGameMode::WastelandHere()
{
	// typed by the player: lay the sites around them (the automatic placement clears this and uses the real coordinates)
	if (bWasteAutoPlaced && bWasteActive) bWasteManual = true;
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Pawn) return;
	if (WasteRt.Vault || WasteRt.Rally || WasteRt.Derby) { Toast(TEXT("Finish the activity first"), WlWarn); return; }
	if (WasteRoster.IsEmpty())
	{
		// encounters.ts troopFor("wastelands", i): Badlands Marauder, Nomad Sniper, Rust-Runner Buggy
		FString Error;
		TArray<TSharedPtr<FJsonObject>> Rows;
		if (WFData::LoadRows(TEXT("RegionalEncounters"), Rows, Error))
			for (const TSharedPtr<FJsonObject>& Row : Rows)
			{
				if (WFData::Str(Row, TEXT("RegionId")) != TEXT("wastelands")) continue;
				TArray<TSharedPtr<FJsonValue>> Troops;
				if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(Row, TEXT("TroopsJson"))), Troops)) continue;
				for (const TSharedPtr<FJsonValue>& Troop : Troops)
					if (const TSharedPtr<FJsonObject> T = Troop->AsObject()) WasteRoster.Add({WFData::Str(T, TEXT("name")), WFData::Str(T, TEXT("drop"))});
			}
		if (WasteRoster.IsEmpty()) UE_LOG(LogTemp, Error, TEXT("No wastelands roster (%s); activity raiders spawn as Hostiles."), *Error);
	}
	// the player stands at the Wastelands centre: the vault gate 78 m east, the Mash-Pit 158 m west, the rally start 113 m north
	// on the real terrain the web world's coordinates are this level's (rules metres x 100), so the sites stand where the web build
	// puts them; on a bare test map they are laid out around the player
	const bool bRealWorld = GetTerrain() && GetTerrain()->IsLoaded() && RegionId == TEXT("wastelands") && !bWasteManual;
	WasteAnchorCm = bRealWorld ? FVector2D(wf::wasteland::RegionCentre.X * 100.0, wf::wasteland::RegionCentre.Z * 100.0) : FVector2D(Pawn->GetActorLocation().X, Pawn->GetActorLocation().Y);
	if (RegionId == TEXT("wastelands")) { RegionAnchorCm = WasteAnchorCm; bRegionAnchored = true; } // the Hollow Crown and the region's secrets move with it
	if (!bWasteActive) { const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>(); WasteRt = wf::wasteland::CreateRuntime(Prog ? Prog->GetSessionKills() : 0); }
	bWasteActive = true;
	SpawnStuntPark();
	Toast(TEXT("Wastelands: Vault Gate (amber), Rust Run start (cyan, in a vehicle), the Mash-Pit (red, in a vehicle), the Stunt Park (ramps, 160 m south). Console: Wasteland"), WlGold);
}

void AWFGameMode::SpawnStuntPark()
{
	UWorld* World = GetWorld();
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!World || !Pawn) return;
	if (StuntParkActor.IsValid()) StuntParkActor->Destroy(); // re-laid with the sites
	const double BaseZ = Pawn->GetActorLocation().Z;
	const wf::stunt::FPark& P = wf::stunt::StuntPark();
	const double Yaw = FMath::RadiansToDegrees(FMath::Atan2(P.DirZ, P.DirX)); // rules (x, z) are Unreal (X, Y)
	const FVector Centre = WasteToWorld(P.X, P.Z, BaseZ);
	AWFStuntPark* NewPark = World->SpawnActor<AWFStuntPark>(AWFStuntPark::StaticClass(), FTransform(Centre));
	if (!NewPark) return;
	for (const wf::stunt::FRamp& R : wf::stunt::Ramps())
	{
		const wf::stunt::FPoint C = wf::stunt::RampCentre(R);
		NewPark->AddRamp(WasteToWorld(C.X, C.Z, BaseZ), Yaw, R.Length, R.Ramp, R.Width, R.Height, UTF8_TO_TCHAR(R.Label.c_str()));
	}
	NewPark->AddFence(Centre, Yaw, P.Length, P.Width, [this, BaseZ](double X, double Y) { return GroundZ(X, Y, BaseZ); });
	StuntParkActor = NewPark;
}

void AWFGameMode::Wasteland()
{
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Pawn || !Prog) return;
	if (!bWasteActive) { Toast(TEXT("No Wastelands sites here - WastelandHere lays them out around you"), WlWarn); return; }
	const FVector2D P = WorldToWaste(Pawn->GetActorLocation());
	auto Dist = [&](double X, double Z) { return FMath::RoundToInt32(wf::js::Hypot(P.X - X, P.Y - Z)); };
	const wf::wasteland::FMedalTargets T = wf::wasteland::RallyTargets();
	const double Rally = Prog->GetRecord(TEXT("rust-run")), Derby = Prog->GetRecord(TEXT("mash-pit"));
	const TArray<FString> Lines = {
		FString::Printf(TEXT("Defend the Vault Gates: %d m away. Sub-Terra Legion: %s (%d trust)"), Dist(wf::wasteland::VaultGate.X, wf::wasteland::VaultGate.Z), *Prog->GetLegionRank(), FMath::RoundToInt32(Prog->GetLegionTrust())),
		FString::Printf(TEXT("Rust Run: start %d m away, in a vehicle. Gold %gs / Silver %gs / Bronze %gs. Best %s"), Dist(wf::wasteland::RallyStart.X, wf::wasteland::RallyStart.Z), T.Gold, T.Silver, T.Bronze, Rally < 0 ? TEXT("none") : *FString::Printf(TEXT("%.1f s"), Rally)),
		FString::Printf(TEXT("The Mash-Pit: %d m away, in a vehicle. Gold %g / Silver %g / Bronze %g wrecks. Best %s"), Dist(wf::wasteland::Arena.X, wf::wasteland::Arena.Z), wf::wasteland::DerbyTargets.Gold, wf::wasteland::DerbyTargets.Silver, wf::wasteland::DerbyTargets.Bronze, Derby < 0 ? TEXT("none") : *FString::Printf(TEXT("%g"), Derby)),
	};
	for (const FString& L : Lines) { UE_LOG(LogTemp, Display, TEXT("%s"), *L); Toast(L, WlGold); }
}

int32 AWFGameMode::SpawnActivitySquad(const FString& Tag, double X, double Z, int32 Size, int32 Elites, double Ring, int32 Kind)
{
	UWorld* World = GetWorld();
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!World || !Pawn) return 0;
	int32 Spawned = 0;
	for (int32 I = 0; I < Size; ++I)
	{
		// sim.ts spawnEventSquad: a ring around the point, elites first, hp (elite 7 : 3.5) x challenge enemyHp
		const double A = (static_cast<double>(I) / Size) * UE_DOUBLE_PI * 2 + FMath::FRand() * 0.4;
		const FVector At = WasteToWorld(X + FMath::Cos(A) * Ring, Z + FMath::Sin(A) * Ring, Pawn->GetActorLocation().Z) + FVector(0, 0, 120);
		const bool bElite = I < Elites;
		const FWFTroop Troop = WasteRoster.IsEmpty() ? FWFTroop{TEXT("Hostile"), TEXT("scrapMetal")} : WasteRoster[FMath::Abs(Kind >= 0 ? Kind : I) % WasteRoster.Num()];
		const double MaxHealth = (bElite ? 7.0 : 3.5) * (Progression ? Progression->GetChallengeEnemyHealthScale() : 1.0);
		const FTransform Xf(FRotator::ZeroRotator, At, FVector(bElite ? 1.4 : 0.95)); // spawnEventSquad: elites stand larger
		if (AWFEnemy* Enemy = World->SpawnActorDeferred<AWFEnemy>(AWFEnemy::StaticClass(), Xf, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn))
		{
			Enemy->Configure(Troop.Name, TEXT("wastelands"), Troop.Drop, bElite, false, MaxHealth);
			if (const FString* Faction = FactionByRegion.Find(TEXT("wastelands"))) Enemy->SetKind(*Faction);
			Enemy->SetActivityTag(Tag);
			Enemy->SetSquadIndex(NextSquadIndex++);
			Enemy->FinishSpawning(Xf);
			++Spawned;
		}
	}
	return Spawned;
}

void AWFGameMode::TickWasteland(float DeltaSeconds)
{
	// a session that starts in the Wastelands gets the three activities around where the Operator first stands
	if (!bWasteActive && !bWasteAutoPlaced && RegionId == TEXT("wastelands") && UGameplayStatics::GetPlayerPawn(this, 0)) { bWasteAutoPlaced = true; WastelandHere(); bWasteManual = false; }
	if (!bWasteActive) return;
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Pawn || !Prog) return;
	AWFVehicle* Car = Cast<AWFVehicle>(Pawn);
	const AWFCharacter* Player = Car ? Car->GetDriver() : Cast<AWFCharacter>(Pawn);
	const FVector2D P = WorldToWaste(Pawn->GetActorLocation());

	wf::wasteland::FWorld W;
	W.Kills = Prog->GetSessionKills();
	W.Hp = Player ? Player->GetHealth() : 1;
	W.TagCount = [this](const std::string& Tag, const std::optional<wf::wasteland::FSite>& Near)
	{
		const FString T = WFData::ToF(Tag);
		int Count = 0;
		for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It)
		{
			if (It->IsDead() || It->GetActivityTag() != T) continue;
			if (Near) { const FVector2D E = WorldToWaste(It->GetActorLocation()); if (wf::js::Hypot(E.X - Near->X, E.Y - Near->Z) > Near->Radius) continue; }
			++Count;
		}
		return Count;
	};
	W.Alert = [this](const std::string& Text) { Toast(UTF8_TO_TCHAR(Text.c_str()), WlGold); };
	// the web build's fixed machine pool has to make room; spawned actors here have no pool, so nothing is freed
	W.FreeSlots = [](int, double, double) {};
	W.SpawnSquad = [this](const std::string& Tag, double X, double Z, int Size, int Elites, double Spread, int Kind) { return SpawnActivitySquad(WFData::ToF(Tag), X, Z, Size, Elites, Spread, Kind); };
	W.Despawn = [this](const std::string& Tag)
	{
		const FString T = WFData::ToF(Tag);
		TArray<AWFEnemy*> Leaving;
		for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It) if (!It->IsDead() && It->GetActivityTag() == T) Leaving.Add(*It);
		for (AWFEnemy* E : Leaving) E->Destroy(); // they leave: no payout
	};

	wf::wasteland::FRuntimeInput In;
	In.Dt = FMath::Min(static_cast<double>(DeltaSeconds), 0.25);
	In.NowMs = FMath::FloorToDouble((FDateTime::UtcNow() - FDateTime(1970, 1, 1)).GetTotalMilliseconds());
	In.Px = P.X; In.Pz = P.Y;
	In.bInVehicle = Car != nullptr;
	const UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	In.bBlocked = (Racing && Racing->IsRacing()) || !EncounterBosses().IsEmpty(); // Scene.tsx: no activity starts over a race or a boss fight
	const wf::wasteland::FRuntimeStep S = wf::wasteland::StepRuntime(WasteRt, W, In);
	for (const wf::wasteland::FEmit& E : S.Emits)
	{
		const FString Msg = Prog->ResolveWasteland(E);
		if (!Msg.IsEmpty()) Toast(Msg, WlGold);
	}
	WasteHud = S.Hud;
	DrawWasteland();
}

// The site markers are debug draws: Shipping builds compile DrawDebug out, so there the HUD panel and toasts carry the activity.
void AWFGameMode::DrawWasteland() const
{
	UWorld* World = GetWorld();
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!World || !Pawn) return;
	const double Base = Pawn->GetActorLocation().Z;
	auto Ring = [&](double X, double Z, double R, const FColor& C, float Height, float Thick)
	{
		const FVector G = WasteToWorld(X, Z, Base);
		DrawDebugCylinder(World, G, G + FVector(0, 0, Height), static_cast<float>(R * WlCmPerM), 40, C, false, -1.f, 0, Thick);
	};
	using namespace wf::wasteland;
	if (WasteRt.Rally)
	{
		const std::vector<FPoint>& Cps = RallyCheckpoints();
		const size_t Next = static_cast<size_t>(WasteRt.Rally->Next);
		for (size_t I = Next; I < Cps.size() && I <= Next + 1; ++I)
			Ring(Cps[I].X, Cps[I].Z, RallyReach, I == Next ? (I + 1 == Cps.size() ? FColor(255, 210, 90) : FColor(110, 230, 255)) : FColor(60, 110, 140), 600.f, I == Next ? 8.f : 3.f);
		return;
	}
	if (WasteRt.Vault) { Ring(VaultGate.X, VaultGate.Z, GateThreatRadius, FColor(255, 90, 60), 150.f, 3.f); Ring(VaultGate.X, VaultGate.Z, VaultGate.Radius, FColor(255, 190, 80), 500.f, 6.f); return; }
	if (WasteRt.Derby) { Ring(wf::wasteland::Arena.X, wf::wasteland::Arena.Z, wf::wasteland::Arena.Radius, FColor(255, 70, 60), 300.f, 8.f); return; }
	// idle: the three start pads (the Mash-Pit starts once you are 4 m inside its ring)
	Ring(VaultGate.X, VaultGate.Z, VaultGate.Radius, FColor(255, 190, 80), 500.f, 5.f);
	Ring(RallyStart.X, RallyStart.Z, RallyReach, FColor(110, 230, 255), 500.f, 5.f);
	Ring(wf::wasteland::Arena.X, wf::wasteland::Arena.Z, wf::wasteland::Arena.Radius, FColor(255, 70, 60), 250.f, 5.f);
}

// --- the Godforge and the Living Secret World ---------------------------------------------------------------------------

namespace
{
	const FLinearColor GfGold(1.f, 0.82f, 0.35f), GfWarn(1.f, 0.55f, 0.3f), GfViolet(0.75f, 0.5f, 1.f);
}

FVector AWFGameMode::RegionToWorld(double X, double Z, double BaseZ) const
{
	const double WX = RegionAnchorCm.X + (X - RegionCircle.X) * 100.0, WY = RegionAnchorCm.Y + (Z - RegionCircle.Z) * 100.0;
	return FVector(WX, WY, GroundZ(WX, WY, BaseZ));
}

FVector2D AWFGameMode::WorldToRegion(const FVector& L) const
{
	return FVector2D((L.X - RegionAnchorCm.X) / 100.0 + RegionCircle.X, (L.Y - RegionAnchorCm.Y) / 100.0 + RegionCircle.Z);
}

void AWFGameMode::TickGodforge(float DeltaSeconds)
{
	(void)DeltaSeconds;
	SecretDist = -1; SecretName.Reset(); SecretLocked.Reset(); // nothing sensed unless this frame senses it
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	UWorld* World = GetWorld();
	if (!Pawn || !Prog || !World) return;
	// the level's centre is the region's centre: anchored where the Operator first stands (WastelandHere moves it in the Wastelands)
	if (!bRegionAnchored)
	{
		// the real terrain uses the web world's coordinates: the region's centre is its own; a bare map puts it where you stand
		const bool bRealWorld = GetTerrain() && GetTerrain()->IsLoaded();
		RegionAnchorCm = bRealWorld ? FVector2D(RegionCircle.X * 100.0, RegionCircle.Z * 100.0) : FVector2D(Pawn->GetActorLocation().X, Pawn->GetActorLocation().Y);
		bRegionAnchored = true;
	}
	const FVector2D P = WorldToRegion(Pawn->GetActorLocation());
	const wf::FProgression& Save = Prog->Get();
	const AWFCharacter* Player = Cast<AWFCharacter>(Pawn);
	if (const AWFVehicle* Car = Cast<AWFVehicle>(Pawn)) Player = Car->GetDriver();
	const bool bAlive = Player && Player->GetHealth() > 0;

	// secrets.ts: NOVA senses the nearest unfound secret; reaching one that answers now claims it (once per session)
	wf::godforge::FSecretContext Ctx;
	Ctx.bNight = wf::env::NightFactor(DayClock) > 0.5;      // Scene.tsx: night > 0.5
	Ctx.bStorm = Env.Weather.State == "STORM";
	Ctx.bNemesisSlain = wf::godforge::NemesesSlain(Save) > 0;
	Ctx.bPledged = Save.Story.Choices.count("living.neon.pledge") > 0;
	auto RegionOf = [this](const std::string& Id) -> std::optional<wf::godforge::FRegionCircle>
	{
		// only the current region's secrets are in this level
		if (WFData::ToF(Id) != RegionId) return std::nullopt;
		return RegionCircle;
	};
	if (bAlive)
		if (const std::optional<wf::godforge::FSensed> Sensed = wf::godforge::SenseSecret(P.X, P.Y, Ctx, Save.EarnedRewards, RegionOf))
		{
			const bool bInReach = Sensed->Dist <= wf::godforge::SecretReach;
			SecretDist = Sensed->Dist;
			if (bInReach) SecretName = WFData::ToF(Sensed->Secret->Name);
			if (bInReach && !Sensed->bOpen) SecretLocked = WFData::ToF(!Sensed->Secret->Locked.empty() ? Sensed->Secret->Locked : wf::godforge::ConditionText(Sensed->Secret->Condition));
			if (Sensed->Dist <= wf::godforge::SecretShimmer)
			{
				const wf::godforge::FRegionCircle At = wf::godforge::SecretPoint(*Sensed->Secret, RegionCircle);
				const FVector G = RegionToWorld(At.X, At.Z, Pawn->GetActorLocation().Z);
				DrawDebugCylinder(World, G, G + FVector(0, 0, 220), static_cast<float>(wf::godforge::SecretReach * 100), 24, Sensed->bOpen ? FColor(150, 220, 255) : FColor(120, 120, 140), false, -1.f, 0, 2.f);
			}
			const FString Key = WFData::ToF(Sensed->Secret->Id);
			if (bInReach && Sensed->bOpen && !SecretsReached.Contains(Key))
			{
				SecretsReached.Add(Key);
				bool bOk = false;
				const std::string Id = Sensed->Secret->Id;
				const FString Msg = Prog->ApplyForge([&](const wf::FProgression& S) { return wf::godforge::ClaimSecret(S, Id, Ctx); }, bOk);
				if (!Msg.IsEmpty()) Toast(Msg, bOk ? GfViolet : GfWarn);
			}
		}

	// weapon-evolution.ts: the region's ruin is found within 40 m (then marked) and evolves a weapon within 6 m
	RuinHint.Reset();
	{
		const wf::FProgression Discovered = wf::hit::DiscoverNearby(Save, P.X, P.Y);
		if (Discovered.EarnedRewards.size() != Save.EarnedRewards.size())
		{
			bool bOk = false;
			Prog->ApplyForge([&Discovered](const wf::FProgression&) { wf::godforge::FForgeResult R; R.bOk = true; R.Progression = Discovered; return R; }, bOk);
			Toast(TEXT("NOVA: an evolution ruin. Bring a level 5 weapon, 2 forge catalysts and the ruin's element"), GfViolet);
		}
		for (const wf::hit::FRuin& Ruin : wf::hit::Ruins())
		{
			if (WFData::ToF(Ruin.RegionId) != RegionId || !wf::hit::IsDiscovered(Prog->Get(), Ruin.Id)) continue;
			const FVector G = RegionToWorld(Ruin.X, Ruin.Z, Pawn->GetActorLocation().Z);
			const bool bSpent = wf::hit::IsEvolved(Prog->Get(), Ruin.Id);
			DrawDebugCylinder(World, G, G + FVector(0, 0, 300), static_cast<float>(wf::hit::RuinReach * 100), 24, bSpent ? FColor(90, 90, 100) : FColor(190, 120, 255), false, -1.f, 0, 3.f);
			if (!bSpent && wf::js::Hypot(P.X - Ruin.X, P.Y - Ruin.Z) <= wf::hit::RuinReach)
			{
				const wf::hit::FAbilityRule* Rule = wf::hit::AbilityRule(Ruin.Ability);
				RuinHint = FString::Printf(TEXT("%s: Evolve <weapon id> grants %s (%s). Needs level %g, %g forge catalysts, %g %s"), UTF8_TO_TCHAR(Ruin.Name.c_str()), Rule ? UTF8_TO_TCHAR(Rule->Name.c_str()) : TEXT(""),
					Rule ? UTF8_TO_TCHAR(Rule->Blurb.c_str()) : TEXT(""), wf::hit::EvolveMinLevel, wf::hit::EvolveCatalysts, wf::hit::EvolveElementAmount, UTF8_TO_TCHAR(Ruin.Material.c_str()));
			}
		}
	}

	// godforge.ts: the Hollow Crown and Vael live in the Wastelands
	if (RegionId != TEXT("wastelands")) return;
	const std::string Stage = wf::godforge::ForgeStage(Save);
	const double Base = Pawn->GetActorLocation().Z;
	if (Stage != "SEALED")
	{
		const FVector Crown = RegionToWorld(wf::godforge::HollowCrownX, wf::godforge::HollowCrownZ, Base);
		DrawDebugCylinder(World, Crown, Crown + FVector(0, 0, 400), static_cast<float>(wf::godforge::HollowCrownRadius * 100), 40, Stage == "DOOR" ? FColor(255, 120, 40) : FColor(255, 210, 90), false, -1.f, 0, 4.f);
	}
	if (Stage == "GUARDIAN_SLAIN")
	{
		const FVector Vael = RegionToWorld(wf::godforge::VaelX, wf::godforge::VaelZ, Base);
		DrawDebugCylinder(World, Vael, Vael + FVector(0, 0, 200), static_cast<float>(wf::godforge::VaelReach * 100), 20, FColor(255, 230, 150), false, -1.f, 0, 3.f);
	}
	// living-runtime.ts: walking into the opened Hollow Crown wakes the Furnace Guardian (once per visit)
	auto GuardianAlive = [this]()
	{
		for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It) if (!It->IsDead() && It->GetActivityTag() == WFData::ToF(wf::godforge::GuardianTag)) return true;
		return false;
	};
	if (wf::godforge::GuardianDue(Save, P.X, P.Y) && !bGuardianOut && bAlive && !GuardianAlive())
	{
		const FVector At = RegionToWorld(wf::godforge::HollowCrownX, wf::godforge::HollowCrownZ + 6, Base) + FVector(0, 0, 250);
		const FTransform Xf(FRotator::ZeroRotator, At, FVector(2.3));
		const double Hp = wf::godforge::GuardianHp * Prog->GetChallengeEnemyHealthScale();
		if (AWFEnemy* Guardian = World->SpawnActorDeferred<AWFEnemy>(AWFEnemy::StaticClass(), Xf, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn))
		{
			// sim.ts summonBoss("ember", ...): an elite boss of Ember Peaks' faction, tagged so its kill pays the Heart
			Guardian->Configure(TEXT("The Furnace Guardian"), TEXT("ember"), TEXT("thermalShards"), true, true, Hp);
			if (const FString* Faction = FactionByRegion.Find(TEXT("ember"))) Guardian->SetKind(*Faction);
			Guardian->SetActivityTag(WFData::ToF(wf::godforge::GuardianTag));
			Guardian->SetSquadIndex(NextSquadIndex++);
			Guardian->FinishSpawning(Xf);
			bGuardianOut = true;
			Toast(TEXT("The Furnace Guardian wakes: \"None pass to the forge unproven.\""), GfWarn);
		}
	}
	if (bGuardianOut && wf::js::Hypot(P.X - wf::godforge::HollowCrownX, P.Y - wf::godforge::HollowCrownZ) > wf::godforge::HollowCrownRadius * 6 && !GuardianAlive()) bGuardianOut = false;
}

void AWFGameMode::OnGuardianSlain()
{
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog) return;
	bool bOk = false;
	const FString Msg = Prog->ApplyForge([](const wf::FProgression& S) { return wf::godforge::ClaimHeart(S); }, bOk);
	if (bOk) Toast(Msg, GfGold);
}

bool AWFGameMode::AtVael()
{
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Pawn || !Prog) return false;
	const FVector2D P = WorldToRegion(Pawn->GetActorLocation());
	if (RegionId == TEXT("wastelands") && wf::godforge::VaelNear(Prog->Get(), P.X, P.Y)) return true;
	const std::string Stage = wf::godforge::ForgeStage(Prog->Get());
	Toast(Stage == "GUARDIAN_SLAIN" ? TEXT("Vael is at the forge in the Hollow Crown (Wastelands): stand by her") : TEXT("The forge is cold. Bring Vael the Heart of the Hollow Crown."), GfWarn);
	return false;
}

void AWFGameMode::ForgeAction(const std::function<wf::godforge::FForgeResult(const wf::FProgression&)>& Action)
{
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog || !AtVael()) return;
	bool bOk = false;
	const FString Msg = Prog->ApplyForge(Action, bOk);
	Toast(Msg, bOk ? GfGold : GfWarn);
}

void AWFGameMode::ForgeRelic(const FString& DesignId)
{
	const std::string D = WFData::ToStd(DesignId);
	const double Now = FMath::FloorToDouble((FDateTime::UtcNow() - FDateTime(1970, 1, 1)).GetTotalMilliseconds());
	ForgeAction([D, Now](const wf::FProgression& S) { return wf::godforge::ForgeRelic(S, D, Now); });
}

void AWFGameMode::SocketRune(const FString& ItemId, const FString& Rune)
{
	const std::string I = WFData::ToStd(ItemId), R = WFData::ToStd(Rune.ToUpper());
	ForgeAction([I, R](const wf::FProgression& S) { return wf::godforge::SocketRune(S, I, R); });
}

void AWFGameMode::RemoveRune(const FString& ItemId, const FString& Rune)
{
	const std::string I = WFData::ToStd(ItemId), R = WFData::ToStd(Rune.ToUpper());
	ForgeAction([I, R](const wf::FProgression& S) { return wf::godforge::RemoveRune(S, I, R); });
}

void AWFGameMode::AscendRelic(const FString& ItemId)
{
	const std::string I = WFData::ToStd(ItemId);
	ForgeAction([I](const wf::FProgression& S) { return wf::godforge::AscendRelic(S, I); });
}

void AWFGameMode::CollectDust()
{
	ForgeAction([](const wf::FProgression& S) { return wf::godforge::CollectRuneDust(S); });
}

void AWFGameMode::Godforge()
{
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog) return;
	const wf::FProgression& S = Prog->Get();
	TArray<FString> Lines;
	const std::string Stage = wf::godforge::ForgeStage(S);
	Lines.Add(FString::Printf(TEXT("Godforge: %s. Forgewright's Marks %d/3 (Frostspire, Ember Peaks, the Wastelands). Slain nemeses %d."), UTF8_TO_TCHAR(Stage.c_str()), wf::godforge::MarksFound(S), wf::godforge::NemesesSlain(S)));
	FString Unlocked;
	for (const wf::godforge::FRune& R : wf::godforge::Runes()) if (wf::godforge::RuneUnlocked(S, R.Id)) Unlocked += (Unlocked.IsEmpty() ? TEXT("") : TEXT(", ")) + WFData::ToF(R.Id);
	Lines.Add(FString::Printf(TEXT("Runes you can bind: %s. Rune dust owed: %g."), Unlocked.IsEmpty() ? TEXT("none") : *Unlocked,
		wf::godforge::RuneDustEarned(S) - static_cast<double>(std::count_if(S.EarnedRewards.begin(), S.EarnedRewards.end(), [](const std::string& K) { return K.rfind("godforge:dust:", 0) == 0; }))));
	for (const wf::FGearItem& I : S.Inventory)
		if (I.Godforge)
		{
			FString Socketed;
			for (const std::string& R : I.Godforge->Runes) Socketed += (Socketed.IsEmpty() ? TEXT("") : TEXT(" ")) + WFData::ToF(R);
			const wf::godforge::FTier* T = wf::godforge::TierById(I.Godforge->Tier);
			Lines.Add(FString::Printf(TEXT("  %s  %s, %s, power %g, %s, kills %g%s"), UTF8_TO_TCHAR(I.Id.c_str()), UTF8_TO_TCHAR(I.Name.c_str()), T ? UTF8_TO_TCHAR(T->Label.c_str()) : TEXT(""), I.Power,
				Socketed.IsEmpty() ? TEXT("no runes") : *Socketed, I.Godforge->Kills, I.Godforge->bAwakened ? TEXT(", awakened") : TEXT("")));
		}
	if (Stage == "GUARDIAN_SLAIN") Lines.Add(TEXT("At Vael: ForgeRelic eclipse-devourer|crownfire|stillwater, SocketRune <id> <rune>, RemoveRune, AscendRelic <id>, CollectDust; Equip <id> to wield a relic"));
	for (const FString& L : Lines) { UE_LOG(LogTemp, Display, TEXT("%s"), *L); Toast(L, GfGold); }
}

// --- the world clock, weather and hazards -------------------------------------------------------------------------------

bool AWFGameMode::IsSheltered() const
{
	// Scene.tsx: an interior, a safe region or the Nexus shield (there are no interiors in this prototype level)
	const FString* Kind = RegionKinds.Find(HereRegion);
	return (Kind && *Kind == TEXT("safe")) || HereRegion == TEXT("nexus");
}

void AWFGameMode::TickEnvironment(float DeltaSeconds)
{
	const double Dt = FMath::Min(static_cast<double>(DeltaSeconds), 0.25);
	DayClock += Dt * wf::env::DayRate * ClockSpeed;
	if (UWFShopSubsystem* Shops = GetGameInstance()->GetSubsystem<UWFShopSubsystem>()) Shops->SetWorldHour(static_cast<float>(wf::env::HourOf(DayClock))); // shop-hours.ts reads the same clock
	const double Night = wf::env::NightFactor(DayClock);
	// world.ts regionAt: on the real terrain the region is wherever you stand (lowest distance / radius inside one); a bare map
	// is the level's own region
	if (const APawn* Here = UGameplayStatics::GetPlayerPawn(this, 0))
	{
		const FString Was = HereRegion;
		if (GetTerrain() && GetTerrain()->IsLoaded())
		{
			const FVector L = Here->GetActorLocation() / 100.0;
			double Best = TNumericLimits<double>::Max();
			HereRegion.Reset();
			for (const TPair<FString, wf::godforge::FRegionCircle>& R : RegionCircles)
			{
				const double D = wf::js::Hypot(L.X - R.Value.X, L.Y - R.Value.Z);
				if (D < R.Value.Radius && D / R.Value.Radius < Best) { Best = D / R.Value.Radius; HereRegion = R.Key; }
			}
		}
		else HereRegion = RegionId;
		if (HereRegion != Was) NemInRegion = 0; // living-runtime.ts: time in a region restarts when you cross into another
	}
	Env = wf::env::EnvironmentAt(WFData::ToStd(HereRegion), DayClock, Night);

	// the sun: up at 06:00, highest at noon, down at 18:00; clouds dim it. Nexus City is always night (AWFNexusCity::ApplyNightLook
	// sets its moonlight): there the clock leaves the sun where the city put it and the atmosphere runs its night.
	const bool bNexusNight = IsInNexus() || HereRegion == TEXT("nexus");
	if (ADirectionalLight* Sun = SunLight.Get())
	{
		const double Elevation = bNexusNight ? -1.0 : wf::env::SunElevation(DayClock);
		if (!bNexusNight)
		{
			const double Pitch = -FMath::RadiansToDegrees(FMath::Asin(FMath::Clamp(Elevation, -1.0, 1.0)));
			const double Yaw = wf::env::HourOf(DayClock) / 24 * 360; // east in the morning, west in the evening
			Sun->SetActorRotation(FRotator(static_cast<float>(Pitch), static_cast<float>(Yaw), 0.f));
		}
		if (AWFAtmosphere* Air = Atmosphere.Get())
			// the atmosphere lights the world physically: it sets the sun's and moon's strength from the angle and the weather
			Air->Update(DeltaSeconds, Elevation, bNexusNight ? 1.0 : Night, Env.Weather.Cloud, Env.Weather.Precipitation, Env.Weather.Visibility, bNexusNight || RegionId == TEXT("neon"));
		else if (!bNexusNight && Sun->GetLightComponent()) // in Nexus, ApplyNightLook's moonlight stands
		{
			Sun->GetLightComponent()->SetIntensity(static_cast<float>(FMath::Max(0.05, 6.0 * FMath::Max(0.0, Elevation + 0.1) * (1 - 0.7 * Env.Weather.Cloud))));
			Sun->GetLightComponent()->SetLightColor(FLinearColor::White); // undo the Nexus moonlight tint once you are out
		}
	}

	// environment.ts stepEnvironment: exposure meters and telegraphed lightning
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	AWFCharacter* Player = Cast<AWFCharacter>(Pawn);
	if (const AWFVehicle* Car = Cast<AWFVehicle>(Pawn)) Player = Car->GetDriver();
	if (!Pawn || !Player) return;
	const FVector P = Pawn->GetActorLocation() / 100.0;
	wf::env::FEnvInput In;
	In.Dt = Dt; In.RegionId = WFData::ToStd(HereRegion); In.Env = Env; In.bSheltered = IsSheltered(); In.Px = P.X; In.Pz = P.Y;
	In.Rand = []() { return static_cast<double>(FMath::FRand()); };
	const wf::env::FEnvOutput Out = wf::env::StepEnvironment(EnvState, In);
	if (Out.Damage > 0) Player->ApplyHit(Out.Damage, UTF8_TO_TCHAR(Out.Cause.c_str()));
	const FString Warning = UTF8_TO_TCHAR(Out.Warning.c_str());
	if (!Warning.IsEmpty() && Warning != HazardWarning) Toast(Warning, FLinearColor(1.f, 0.55f, 0.3f));
	HazardWarning = Warning;
	UWorld* World = GetWorld();
	for (const wf::env::FStrike& S : EnvState.Strikes) // the ground ring telegraphs where it lands
	{
		const FVector G(S.X * 100, S.Z * 100, GroundZ(S.X * 100, S.Z * 100, Pawn->GetActorLocation().Z));
		DrawDebugCylinder(World, G, G + FVector(0, 0, 40), static_cast<float>(S.Radius * 100), 32, FColor(170, 200, 255), false, -1.f, 0, 4.f);
	}
	for (const wf::env::FStrike& S : Out.Detonated)
	{
		// sim.ts applyLightning: machines within radius + their scale take 6, the player within the radius 14
		const FVector G(S.X * 100, S.Z * 100, GroundZ(S.X * 100, S.Z * 100, Pawn->GetActorLocation().Z));
		DrawDebugLine(World, G + FVector(0, 0, 6000), G, FColor(220, 230, 255), false, 0.3f, 0, 12.f);
		TArray<AWFEnemy*> Struck;
		for (TActorIterator<AWFEnemy> It(World); It; ++It)
			if (!It->IsDead() && !It->IsDecoy() && FVector::Dist2D(It->GetActorLocation(), G) / 100.0 <= S.Radius + It->GetActorScale3D().X) Struck.Add(*It);
		for (AWFEnemy* E : Struck) if (IsValid(E) && !E->IsDead()) E->TakeRawDamage(wf::env::StrikeMachineDamage, nullptr); // a flat 6 off health, as sim.ts
		if (wf::js::Hypot(P.X - S.X, P.Y - S.Z) <= S.Radius) Player->ApplyHit(wf::env::StrikePlayerDamage, TEXT("Lightning strike"));
	}
}

// --- nemeses -----------------------------------------------------------------------------------------------------------

namespace
{
	const FLinearColor NmRed(1.f, 0.35f, 0.3f);
}

void AWFGameMode::OnPlayerKilledBy(const wf::nemesis::FKiller& Killer)
{
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog) return;
	const FString* Name = RegionNames.Find(WFData::ToF(Killer.Zone));
	const FString Line = Prog->ApplyPlayerDeath(Killer, Name ? *Name : FString(TEXT("the wastes")));
	if (!Line.IsEmpty()) Toast(Line, NmRed);
}

void AWFGameMode::OnNemesisDown(const FString& NemesisId, bool bKilled)
{
	if (!bKilled) { Toast(TEXT("Your nemesis got away."), NmRed); return; }
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog) return;
	const FString Line = Prog->ApplyNemesisKill(NemesisId);
	if (!Line.IsEmpty()) Toast(Line, FLinearColor(1.f, 0.82f, 0.35f));
	SummonedNemesis.Reset();
}

void AWFGameMode::TickNemesis(float DeltaSeconds)
{
	const double Dt = FMath::Min(static_cast<double>(DeltaSeconds), 0.25);
	NemClock += Dt;
	NemInRegion += Dt; // reset by TickEnvironment when you cross into another region
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	UWorld* World = GetWorld();
	if (!Pawn || !Prog || !World) return;
	const AWFCharacter* Player = Cast<AWFCharacter>(Pawn);
	if (const AWFVehicle* Car = Cast<AWFVehicle>(Pawn)) Player = Car->GetDriver();
	const bool bAlive = Player && Player->GetHealth() > 0;
	// living-runtime.ts: never during a race, a boss fight, or with a nemesis already on the field
	bool bNemesisOut = false;
	for (TActorIterator<AWFEnemy> It(World); It; ++It) if (!It->IsDead() && !It->GetNemesisId().IsEmpty()) { bNemesisOut = true; break; }
	const UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	// a Wastelands activity stands in for the web build's living-director event
	const bool bBusy = (Racing && Racing->IsRacing()) || !EncounterBosses().IsEmpty() || bNemesisOut || WasteRt.Vault || WasteRt.Rally || WasteRt.Derby;
	const std::string Summoned = !SummonedNemesis.IsEmpty() && SummonedNemesis != NemSummonDone ? WFData::ToStd(SummonedNemesis) : std::string();
	const wf::nemesis::FNemesis* Due = bBusy || !bAlive ? nullptr : wf::nemesis::AmbushDue(Prog->Get().Nemeses, WFData::ToStd(HereRegion), NemInRegion, NemClock - NemLastAmbush, Summoned);
	if (!Due) return;
	// sim.ts spawnNemesis: 24 m away, its rank's health (x challenge), size and hit strength; an elite of the region's troops
	const double A = FMath::FRand() * UE_DOUBLE_PI * 2;
	const FVector Around = Pawn->GetActorLocation() + FVector(FMath::Cos(A), FMath::Sin(A), 0) * 2400;
	const wf::nemesis::FStats St = wf::nemesis::NemesisStats(*Due);
	const FVector At(Around.X, Around.Y, GroundZ(Around.X, Around.Y, Pawn->GetActorLocation().Z) + 150);
	const FTransform Xf(FRotator::ZeroRotator, At, FVector(St.Scale));
	const wf::nemesis::FNemesis N = *Due; // the save can change under us once it spawns
	if (AWFEnemy* Enemy = World->SpawnActorDeferred<AWFEnemy>(AWFEnemy::StaticClass(), Xf, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn))
	{
		const FString Drop = Roster.IsEmpty() ? FString(TEXT("scrapMetal")) : Roster[0].Drop; // troopFor(regionId, 0)
		Enemy->Configure(WFData::ToF(N.Name + " " + N.Epithet), WFData::ToF(N.RegionId), Drop, true, false, St.Hp * Prog->GetChallengeEnemyHealthScale());
		if (const FString* Faction = FactionByRegion.Find(WFData::ToF(N.RegionId))) Enemy->SetKind(*Faction);
		Enemy->ConfigureNemesis(WFData::ToF(N.Id), WFData::ToF(wf::nemesis::WeakElement(N)), St.Damage, St.Scale); // its rank's size
		Enemy->SetSquadIndex(NextSquadIndex++);
		Enemy->FinishSpawning(Xf);
		NemLastAmbush = NemClock;
		if (WFData::ToF(N.Id) == SummonedNemesis) NemSummonDone = SummonedNemesis;
		Toast(FString::Printf(TEXT("%s %s: \"%s\""), UTF8_TO_TCHAR(N.Name.c_str()), UTF8_TO_TCHAR(N.Epithet.c_str()), UTF8_TO_TCHAR(N.Grudge.c_str())), NmRed);
	}
}

bool AWFGameMode::GetNemesisHud(FString& OutLine) const
{
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog) return false;
	for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It)
	{
		if (It->IsDead() || It->GetNemesisId().IsEmpty()) continue;
		const std::string Id = WFData::ToStd(It->GetNemesisId());
		for (const wf::nemesis::FNemesis& N : Prog->Get().Nemeses)
			if (N.Id == Id)
			{
				FString Traits;
				for (const std::string& T : N.Traits) if (const wf::nemesis::FTrait* D = wf::nemesis::TraitById(T)) Traits += (Traits.IsEmpty() ? TEXT("") : TEXT(", ")) + WFData::ToF(D->Label);
				OutLine = FString::Printf(TEXT("NEMESIS %s %s  rank %g  %s%s  hp %.1f"), UTF8_TO_TCHAR(N.Name.c_str()), UTF8_TO_TCHAR(N.Epithet.c_str()), N.Rank, *Traits,
					It->GetNemesisWeak().IsEmpty() ? TEXT("") : *FString::Printf(TEXT("  weak to %s"), *It->GetNemesisWeak()), It->GetHealth());
				return true;
			}
	}
	return false;
}

void AWFGameMode::Nemeses()
{
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog) return;
	TArray<FString> Lines;
	for (const wf::nemesis::FNemesis& N : Prog->Get().Nemeses)
	{
		FString Traits;
		for (const std::string& T : N.Traits) if (const wf::nemesis::FTrait* D = wf::nemesis::TraitById(T)) Traits += (Traits.IsEmpty() ? TEXT("") : TEXT(", ")) + WFData::ToF(D->Label + " (" + D->Text + ")");
		const FString* Region = RegionNames.Find(WFData::ToF(N.RegionId));
		Lines.Add(FString::Printf(TEXT("%s  %s %s  rank %g  %s  %s  %s"), UTF8_TO_TCHAR(N.Id.c_str()), UTF8_TO_TCHAR(N.Name.c_str()), UTF8_TO_TCHAR(N.Epithet.c_str()), N.Rank, *Traits,
			Region ? **Region : UTF8_TO_TCHAR(N.RegionId.c_str()), UTF8_TO_TCHAR(N.Status.c_str())));
	}
	if (Lines.IsEmpty()) Lines.Add(TEXT("No nemeses yet. An ordinary trooper or elite that kills you becomes one."));
	for (const FString& L : Lines) { UE_LOG(LogTemp, Display, TEXT("%s"), *L); Toast(L, NmRed); }
}

void AWFGameMode::HuntNemesis(const FString& NemesisId)
{
	SummonedNemesis = NemesisId;
	NemSummonDone.Reset();
	NemInRegion = 0; // ambushDue: a called nemesis comes after 4 s in its region
	Toast(FString::Printf(TEXT("Hunting %s: it comes for you in its own region"), *NemesisId), NmRed);
}

void AWFGameMode::Evolve(const FString& WeaponItemId)
{
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Pawn || !Prog) return;
	const FVector2D P = WorldToRegion(Pawn->GetActorLocation());
	const wf::hit::FRuin* At = nullptr;
	for (const wf::hit::FRuin& Ruin : wf::hit::Ruins())
		if (WFData::ToF(Ruin.RegionId) == RegionId && wf::js::Hypot(P.X - Ruin.X, P.Y - Ruin.Z) <= wf::hit::RuinReach) At = &Ruin;
	if (!At) { Toast(TEXT("Stand at an evolution ruin (each region with one marks it once you have found it)"), GfWarn); return; }
	const std::string Weapon = WFData::ToStd(WeaponItemId);
	const wf::hit::FEvolveCheck Check = wf::hit::CanEvolve(Prog->Get(), *At, Weapon);
	if (!Check.bOk) { Toast(UTF8_TO_TCHAR(Check.Reason.c_str()), GfWarn); return; }
	const std::string RuinId = At->Id;
	bool bOk = false;
	Prog->ApplyForge([&](const wf::FProgression& S) { wf::godforge::FForgeResult R; R.bOk = true; R.Progression = wf::hit::EvolveWeapon(S, RuinId, Weapon); return R; }, bOk);
	const wf::hit::FAbilityRule* Rule = wf::hit::AbilityRule(At->Ability);
	Toast(FString::Printf(TEXT("%s evolved at the %s: +%g power, %s, and %s"), *WeaponItemId, UTF8_TO_TCHAR(At->Name.c_str()), wf::hit::EvolvePowerBonus, UTF8_TO_TCHAR(At->Element.c_str()), Rule ? UTF8_TO_TCHAR(Rule->Name.c_str()) : TEXT("")), GfGold);
}

// --- strikes (OperationsHub.tsx's strike runs on raid-stages.ts / difficulty-ladder.ts / strikes.ts) -------------------

namespace
{
	const FLinearColor StGold(1.f, 0.82f, 0.35f), StCyan(0.45f, 0.9f, 1.f), StWarn(1.f, 0.55f, 0.3f), StRed(1.f, 0.35f, 0.3f);
	FString StF(const std::string& S) { return UTF8_TO_TCHAR(S.c_str()); }
	/** "slagworks" or "strike-slagworks" */
	const wf::strike::FDefinition* StrikeNamed(const FString& Name)
	{
		const std::string Id = WFData::ToStd(Name.ToLower());
		if (const wf::strike::FDefinition* D = wf::strike::FindStrike(Id)) return D;
		return wf::strike::FindStrike("strike-" + Id);
	}
}

void AWFGameMode::Strikes()
{
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog) return;
	const double Now = UWFProgressionSubsystem::NowMs();
	const std::string Ordeal = wf::strike::WeeklyStrike(Now).Id;
	TArray<FString> Lines;
	for (const wf::strike::FDefinition& D : wf::strike::Strikes())
	{
		Lines.Add(FString::Printf(TEXT("%s  %s%s  %s · %s · boss %s"), *StF(D.Id), *StF(D.Name), D.Id == Ordeal ? TEXT("  [WEEKLY ORDEAL]") : TEXT(""), *StF(D.Region), *StF(D.Hazard), *StF(D.Boss)));
		FString Tiers;
		for (const wf::strike::FTier& T : wf::strike::TiersOf("strike"))
		{
			FString What;
			if (!wf::strike::StrikeTierUnlocked(Prog->Get(), T.Id)) What = TEXT("locked");
			else if (const std::optional<wf::strike::FStrikePayout> Pay = wf::strike::StrikePayout(Prog->Get(), D.Id, T.Id, Now)) What = FString::Printf(TEXT("%g Nex%s"), Pay->Nex, Pay->bFirst ? TEXT(" first") : TEXT(""));
			else What = TEXT("paid today");
			Tiers += FString::Printf(TEXT("%s%s %s"), Tiers.IsEmpty() ? TEXT("") : TEXT(" | "), *StF(T.Name), *What);
		}
		Lines.Add(TEXT("    ") + Tiers);
	}
	Lines.Add(TEXT("StrikeStart <id> [standard|hero|legend|master], then StrikeAdvance / StrikeRoute / StrikeLoseLife"));
	for (const FString& L : Lines) { UE_LOG(LogTemp, Display, TEXT("%s"), *L); Toast(L, StCyan); }
}

void AWFGameMode::StrikeStart(const FString& StrikeId, const FString& TierId)
{
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	const wf::strike::FDefinition* Def = StrikeNamed(StrikeId);
	if (!Prog || !Def) { Toast(TEXT("No such strike: Strikes lists them"), StWarn); return; }
	if (StrikeDef && StrikeRun.Status == "ACTIVE") { Toast(TEXT("A strike is already running: StrikeAbandon first"), StWarn); return; }
	const wf::strike::FTier Tier = wf::strike::TierById("strike", WFData::ToStd(TierId.IsEmpty() ? FString(TEXT("standard")) : TierId.ToLower()));
	if (!wf::strike::StrikeTierUnlocked(Prog->Get(), Tier.Id))
	{
		Toast(FString::Printf(TEXT("%s is locked: clear %s first"), *StF(Tier.Name), *StF(wf::strike::TiersOf("strike")[static_cast<size_t>(Tier.Rank - 1)].Name)), StWarn);
		return;
	}
	StrikeDef = wf::strike::ScaleEncounter(*Def, Tier);
	StrikeTierId = StF(Tier.Id);
	StrikeRun = wf::strike::CreateRun(*StrikeDef);
	// the hub's "Launch fireteam": a lone Operator is always ready
	StrikeRun.Status = "ACTIVE";
	StrikeRun.Message = "Entered " + (StrikeDef->Stages.empty() ? StrikeDef->Name : StrikeDef->Stages.front().Name) + ".";
	Toast(FString::Printf(TEXT("%s · power %g+ · %g shared lives · %s"), *StF(StrikeDef->Name), Tier.Power, StrikeDef->MaxLives, *StF(Def->Identity)), StGold);
	Toast(StF(StrikeRun.Message), StCyan);
}

void AWFGameMode::StrikeAdvance()
{
	if (!StrikeDef || StrikeRun.Status != "ACTIVE") { Toast(TEXT("No strike running: StrikeStart <id>"), StWarn); return; }
	const wf::strike::FStage* Stage = static_cast<size_t>(StrikeRun.StageIndex) < StrikeDef->Stages.size() ? &StrikeDef->Stages[static_cast<size_t>(StrikeRun.StageIndex)] : nullptr;
	if (Stage && !Stage->Routes.empty() && !StrikeRun.SelectedRoute)
	{
		FString Routes;
		for (const wf::strike::FRoute& R : Stage->Routes) Routes += FString::Printf(TEXT("  %s (%s: %s)"), *StF(R.Id), *StF(R.Name), *StF(R.Tradeoff));
		Toast(TEXT("Pick a route first: StrikeRoute") + Routes, StWarn);
		return;
	}
	StrikeRun = wf::strike::Advance(*StrikeDef, StrikeRun);
	Toast(StF(StrikeRun.Message), StrikeRun.Status == "WIPED" ? StRed : StCyan);
	if (StrikeRun.Status != "ACTIVE") StrikeEndedAt = GetWorld()->GetTimeSeconds(); // the panel shows the result for a few seconds
	if (StrikeRun.Status == "WIPED") { Toast(TEXT("Fireteam lost: StrikeStart again to retry"), StRed); return; }
	if (StrikeRun.Status != "COMPLETE") return;
	// strikes.ts claimStrikeClear: the payout, shards, discovery XP, the signature gear and the tier clear
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	const wf::strike::FDefinition* Base = wf::strike::FindStrike(StrikeDef->Id);
	bool bClaimed = false, bFirst = false;
	const double Paid = Prog ? Prog->ClaimStrike(StF(StrikeDef->Id), StrikeTierId, bClaimed, bFirst) : 0;
	if (bClaimed)
		Toast(FString::Printf(TEXT("STRIKE CLEAR · +%g Nex%s · +%g shards · %s"), Paid, bFirst ? TEXT(" (first clear)") : TEXT(""), 12.0 * (1 + wf::strike::TierById("strike", WFData::ToStd(StrikeTierId)).Rank), Base ? *StF(Base->Signature.Name) : TEXT("")), StGold);
	else Toast(TEXT("Strike clear · today's payout for this strike and tier is already claimed"), StCyan);
}

void AWFGameMode::StrikeRoute(const FString& RouteId)
{
	if (!StrikeDef || StrikeRun.Status != "ACTIVE") { Toast(TEXT("No strike running"), StWarn); return; }
	StrikeRun = wf::strike::ChooseRoute(StrikeRun, WFData::ToStd(RouteId));
	Toast(StF(StrikeRun.Message), StCyan);
}

void AWFGameMode::StrikeLoseLife()
{
	if (!StrikeDef || StrikeRun.Status != "ACTIVE") { Toast(TEXT("No strike running"), StWarn); return; }
	StrikeRun = wf::strike::LoseLife(*StrikeDef, StrikeRun);
	if (StrikeRun.Status != "ACTIVE") StrikeEndedAt = GetWorld()->GetTimeSeconds();
	Toast(StF(StrikeRun.Message), StrikeRun.Status == "WIPED" ? StRed : StWarn);
}

void AWFGameMode::StrikeAbandon()
{
	if (!StrikeDef) return;
	Toast(FString::Printf(TEXT("%s abandoned"), *StF(StrikeDef->Name)), StWarn);
	StrikeDef.reset();
}

bool AWFGameMode::GetStrikeHud(FString& OutTitle, TArray<FString>& OutLines, double& OutHazard) const
{
	if (!StrikeDef) return false;
	if (StrikeRun.Status != "ACTIVE" && GetWorld() && GetWorld()->GetTimeSeconds() - StrikeEndedAt > 8) return false;
	const wf::strike::FDefinition& D = *StrikeDef;
	OutTitle = StF(D.Name);
	OutLines.Reset();
	const size_t I = static_cast<size_t>(StrikeRun.StageIndex);
	if (StrikeRun.Status == "ACTIVE" && I < D.Stages.size())
	{
		const wf::strike::FStage& S = D.Stages[I];
		OutLines.Add(FString::Printf(TEXT("Stage %d/%d · %s · %s %g/%g"), StrikeRun.StageIndex + 1, static_cast<int32>(D.Stages.size()), *StF(S.Name), *StF(S.Objective), StrikeRun.Progress, S.Target));
		if (!S.BossPhases.empty() && static_cast<size_t>(StrikeRun.BossPhase) < S.BossPhases.size())
			OutLines.Add(TEXT("Counter: ") + StF(S.BossPhases[static_cast<size_t>(StrikeRun.BossPhase)].Counter));
	}
	OutLines.Add(StF(StrikeRun.Message));
	OutLines.Add(FString::Printf(TEXT("%s %g · lives %g · %s"), D.Stages.empty() ? TEXT("HAZARD") : *StF(D.Stages[FMath::Min(I, D.Stages.size() - 1)].HazardLabel), StrikeRun.Hazard, StrikeRun.Lives, *StF(StrikeRun.Status)));
	OutHazard = StrikeRun.Hazard / 100.0;
	return true;
}

// --- World Boss raids (Scene.tsx worldBoss on world-boss.ts) ------------------------------------------------------------

bool AWFGameMode::RaidSiteHere(const wf::worldboss::FRaidSite& Site, FVector& OutAt) const
{
	// the real terrain holds every region at its web-world place; a bare map holds only its own region, around the anchor
	const bool bRealWorld = GetTerrain() && GetTerrain()->IsLoaded();
	const wf::godforge::FRegionCircle* Region = bRealWorld ? RegionCircles.Find(StF(Site.Region)) : (StF(Site.Region) == RegionId && bRegionAnchored ? &RegionCircle : nullptr);
	if (!Region) return false;
	const AWFTerrain* Land = bRealWorld ? GetTerrain() : nullptr;
	const double Water = Land ? Land->GetWaterLevel() : -1e9;
	// on the real terrain a region point (x, z) is at (x, z) x 100 cm
	auto Ground = [Land](double X, double Z) { return Land ? Land->HeightAtCm(X * 100.0, Z * 100.0) / 100.0 : 1e9; }; // no terrain: all dry land
	const wf::worldboss::FPoint P = wf::worldboss::RaidSiteWorld(Site, Region->X, Region->Z, Region->Radius, Ground, Water);
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	OutAt = RegionToWorld(P.X, P.Z, Pawn ? Pawn->GetActorLocation().Z : 0);
	return true;
}

void AWFGameMode::TickWorldBoss(float DeltaSeconds)
{
	WbClock += DeltaSeconds;
	if (WbClock <= 1) return;
	WbClock = 0;
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	UWorld* World = GetWorld();
	if (!Prog || !Pawn || !World) return;
	const double Now = UWFProgressionSubsystem::NowMs();
	const wf::worldboss::FRaid Raid = wf::worldboss::WorldBossAt(Now).Current;
	const FString Tag = StF(wf::worldboss::WorldBossKey(Raid.Id)), Id = StF(Raid.Id);
	WorldBossLine.Reset();
	if (!Raid.bLive) return;
	const FString* SiteRegionName = RegionNames.Find(StF(Raid.Site.Region));
	WorldBossLine = FString::Printf(TEXT("WORLD BOSS · %s · %s (%s) · %g min left"), *StF(Raid.Site.Boss), *StF(Raid.Site.Name), SiteRegionName ? **SiteRegionName : *StF(Raid.Site.Region), FMath::CeilToDouble((Raid.EndsAt - Now) / 60000));
	if (WbAnnounced != Id)
	{
		WbAnnounced = Id;
		Toast(FString::Printf(TEXT("WORLD BOSS · %s rises at %s (%s) · the factions stand together"), *StF(Raid.Site.Boss), *StF(Raid.Site.Name), SiteRegionName ? **SiteRegionName : *StF(Raid.Site.Region)), StGold);
	}
	if (Prog->Get().NexLedger.count(WFData::ToStd(Tag)) || WbWoke == Id) return; // this raid already paid, or its boss is up
	FVector At;
	if (!RaidSiteHere(Raid.Site, At)) return;
	if (FVector::Dist2D(Pawn->GetActorLocation(), At) >= wf::worldboss::WakeRange * 100.0) return;

	// sim.ts summonBoss: the region's boss (encounters.ts), else its unique scenario's boss; x4 health, x1.5 size
	if (RegionBosses.IsEmpty())
	{
		TArray<TSharedPtr<FJsonObject>> Rows;
		FString Error;
		if (WFData::LoadRows(TEXT("RegionalEncounters"), Rows, Error))
			for (const TSharedPtr<FJsonObject>& Row : Rows)
			{
				TSharedPtr<FJsonObject> Boss;
				if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(Row, TEXT("BossJson"))), Boss) && Boss.IsValid())
					RegionBosses.Add(WFData::Str(Row, TEXT("RegionId")), TPair<FString, FString>(WFData::Str(Boss, TEXT("name")), WFData::Str(Boss, TEXT("drop"))));
			}
		if (Scenarios.IsEmpty()) LoadScenarios();
	}
	const FString Region = StF(Raid.Site.Region);
	FString Name, Drop;
	double BaseHp = wf::encounter::BossHpRegional;
	if (const TPair<FString, FString>* B = RegionBosses.Find(Region)) { Name = B->Key; Drop = B->Value; }
	else if (const FScenarioBoss* S = Scenarios.FindByPredicate([&Region](const FScenarioBoss& X) { return X.RegionId == Region; })) { Name = S->BossName; Drop = S->Drop; BaseHp = wf::encounter::BossHpScenario; }
	else return;
	const FTransform Xf(FRotator::ZeroRotator, FVector(At.X, At.Y, GroundZ(At.X, At.Y, Pawn->GetActorLocation().Z) + 200));
	if (AWFEnemy* Boss = World->SpawnActorDeferred<AWFEnemy>(AWFEnemy::StaticClass(), Xf, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn))
	{
		Boss->Configure(StF(Raid.Site.Boss), Region, Drop, true, true, BaseHp * Prog->GetChallengeEnemyHealthScale() * wf::worldboss::HpScale);
		if (const FString* Faction = FactionByRegion.Find(Region)) Boss->SetKind(*Faction);
		Boss->SetScaleOverride(1.8 * 1.5); // a boss's size, half again
		Boss->SetActivityTag(Tag);
		Boss->SetSquadIndex(NextSquadIndex++);
		Boss->FinishSpawning(Xf);
		WbWoke = Id;
		Toast(FString::Printf(TEXT("%s awakens (%s)"), *StF(Raid.Site.Boss), *Name), StRed);
	}
}

void AWFGameMode::OnWorldBossSlain(const FString& Tag)
{
	// Scene.tsx pays the raid that is up now, once
	const wf::worldboss::FRaid Raid = wf::worldboss::WorldBossAt(UWFProgressionSubsystem::NowMs()).Current;
	const FString Id = StF(Raid.Id);
	if (Tag != StF(wf::worldboss::WorldBossKey(Raid.Id)) || WbPaid == Id) return;
	WbPaid = Id;
	Toast(FString::Printf(TEXT("WORLD BOSS DOWN · %s"), *StF(Raid.Site.Boss)), StGold);
	if (UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>(); Prog && Prog->PayWorldBoss(Id))
		Toast(FString::Printf(TEXT("+%g Nex · 1 fracture core · 8 reinforced alloy · 2 forge catalysts"), wf::worldboss::RewardNex), StGold);
}

void AWFGameMode::WorldBoss()
{
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	const double Now = UWFProgressionSubsystem::NowMs();
	const wf::worldboss::FRaids R = wf::worldboss::WorldBossAt(Now);
	Toast(StF(wf::worldboss::WorldBossBanner(Now)), StGold);
	const wf::worldboss::FRaid& Shown = R.Current.bLive ? R.Current : R.Next;
	FVector At;
	if (RaidSiteHere(Shown.Site, At))
	{
		const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
		Toast(FString::Printf(TEXT("%s is %.0f m from you (wakes inside %g m)"), *StF(Shown.Site.Name), Pawn ? FVector::Dist2D(Pawn->GetActorLocation(), At) / 100.0 : 0.0, wf::worldboss::WakeRange), StCyan);
	}
	else Toast(TEXT("That raid site is in another region's level"), StCyan);
	if (Prog && R.Current.bLive && Prog->Get().NexLedger.count(wf::worldboss::WorldBossKey(R.Current.Id))) Toast(TEXT("This raid has already paid you"), StCyan);
}

// --- region hazards and hazard zones (Scene.tsx on region-hazards.ts / hazard-zones.ts) ------------------------------------

void AWFGameMode::TickRegionHazard(float DeltaSeconds)
{
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	UWorld* World = GetWorld();
	if (!Pawn || !World) return;
	AWFCharacter* Player = Cast<AWFCharacter>(Pawn);
	const bool bInVehicle = Cast<AWFVehicle>(Pawn) != nullptr;
	if (const AWFVehicle* Car = Cast<AWFVehicle>(Pawn)) Player = Car->GetDriver();
	if (!Player) return;
	// the web world's place you stand at (this level's region anchor on a bare map); shelter is a vehicle
	const FVector2D Here = WorldToRegion(Pawn->GetActorLocation());
	const double T = World->GetTimeSeconds(), Dt = DeltaSeconds;
	const wf::hazard::FRegionLookup Lookup = [this](const std::string& Id) -> std::optional<wf::hazard::FRegionCircle> {
		const wf::godforge::FRegionCircle* R = RegionCircles.Find(UTF8_TO_TCHAR(Id.c_str()));
		if (!R) return std::nullopt;
		return wf::hazard::FRegionCircle{Id, R->X, R->Z, R->Radius};
	};
	const wf::hazard::FZoneEffect Zone = wf::hazard::ZoneAt(Here.X, Here.Y, T, bInVehicle, Lookup);
	wf::hazard::FHazardInput In;
	In.RegionId = WFData::ToStd(HereRegion);
	In.T = T; In.Dt = Dt; In.bSheltered = bInVehicle; In.Exposure = RegionHazardFx.Exposure;
	const wf::hazard::FHazardEffect Fx = wf::hazard::CombineHazard(wf::hazard::HazardAt(In), Zone);
	if (Fx.Warning && Fx.Warning != RegionHazardFx.Warning) Toast(UTF8_TO_TCHAR(Fx.Warning->c_str()), FLinearColor(1.f, 0.55f, 0.3f));
	RegionHazardFx = Fx;
	Player->SetRegionHazard(Fx.SpeedMul, Fx.GravityMul, Zone.PullX, Zone.PullZ);
	Player->ApplyHazardDamage(Fx.DamagePerSec, Dt, UTF8_TO_TCHAR(Fx.Name.c_str()));
}

// --- the stash (stash.ts) ------------------------------------------------------------------------------------------------

void AWFGameMode::StashAction(const std::function<bool(wf::FProgression&)>& Action, const FString& Done, const FString& Refused)
{
	UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog) return;
	const bool bOk = Prog->ApplyStash(Action);
	Toast(bOk ? Done : Refused, bOk ? FLinearColor(0.45f, 0.9f, 1.f) : FLinearColor(1.f, 0.55f, 0.3f));
}

void AWFGameMode::Stash()
{
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Prog) return;
	const wf::FProgression& P = Prog->Get();
	auto Have = [&P](const char* Id) { const auto It = P.Materials.find(Id); return It == P.Materials.end() ? 0.0 : It->second; };
	TArray<FString> Lines;
	Lines.Add(FString::Printf(TEXT("Heal Stim %g/3 (key 6) · Armor Stim %g/3 (key 7) · Ruin Stone %g (key J) · gear parts %g"), Have("healStim"), Have("armorStim"), Have("ruinStone"), Have("gearParts")));
	Lines.Add(FString::Printf(TEXT("Data chips %g · energy tokens %g · relic fragments %g · fracture shards %g"), Have("dataChip"), Have("energyToken"), Have("relicFragment"), P.FractureShards));
	const double Now = UWFProgressionSubsystem::NowMs();
	for (const auto& [Id, B] : Prog->GetBuffs())
		if (B.Until > Now)
			if (const wf::stash::FConsumable* C = wf::stash::ConsumableById(Id)) Lines.Add(FString::Printf(TEXT("  %s x%g · %.0f s left"), UTF8_TO_TCHAR(C->Name.c_str()), B.Stacks, (B.Until - Now) / 1000.0));
	for (const wf::FGearItem& G : P.Inventory)
		Lines.Add(FString::Printf(TEXT("  %s%s %s  %s  power %g  level %g%s%s"), wf::stash::InVault(P, G.Id) ? TEXT("[V] ") : TEXT(""), UTF8_TO_TCHAR(G.Id.c_str()), UTF8_TO_TCHAR(G.Name.c_str()), UTF8_TO_TCHAR(G.Slot.c_str()), G.Power, G.Level,
			G.bFavorite ? TEXT("  favourite") : TEXT(""), wf::stash::IsDuplicate(P, G) ? *FString::Printf(TEXT("  duplicate (sells %g)"), wf::stash::SellValue(G)) : TEXT("")));
	Lines.Add(TEXT("CraftStim / CraftRuinStone / SellGear / DismantleGear / UpgradeGear / VaultGear / UnvaultGear / FavoriteGear <id>"));
	for (const FString& L : Lines) { UE_LOG(LogTemp, Display, TEXT("%s"), *L); Toast(L, FLinearColor(0.45f, 0.9f, 1.f)); }
}

void AWFGameMode::CraftStim(const FString& StimId)
{
	const std::string Id = WFData::ToStd(StimId);
	StashAction([Id](wf::FProgression& P) { return wf::stash::CraftStim(P, Id); }, FString::Printf(TEXT("Crafted a %s"), *StimId), TEXT("Can't craft that: carrying 3 already, or short of the parts (Stash shows them)"));
}
void AWFGameMode::CraftRuinStone()
{
	StashAction([](wf::FProgression& P) { return wf::stash::CraftRuinStone(P); }, TEXT("Crafted a Ruin Stone"), TEXT("A Ruin Stone takes 5 data chips, 5 energy tokens and 3 relic fragments"));
}
void AWFGameMode::SellGear(const FString& ItemId)
{
	const std::string Id = WFData::ToStd(ItemId);
	StashAction([Id](wf::FProgression& P) { return wf::stash::SellDuplicate(P, Id); }, TEXT("Sold for fracture shards"), TEXT("Only a spare duplicate sells (not worn, favourite, starter or in the vault)"));
}
void AWFGameMode::DismantleGear(const FString& ItemId)
{
	const std::string Id = WFData::ToStd(ItemId);
	StashAction([Id](wf::FProgression& P) { return wf::stash::Dismantle(P, Id); }, TEXT("Dismantled into gear parts"), TEXT("Worn, favourite and starter gear can't be dismantled"));
}
void AWFGameMode::UpgradeGear(const FString& ItemId)
{
	const std::string Id = WFData::ToStd(ItemId);
	StashAction([Id](wf::FProgression& P) { return wf::stash::UpgradeWithParts(P, Id); }, TEXT("Upgraded: +1 level, +15 power"), TEXT("Not enough gear parts (3 a level), or the armor is at its level cap"));
}
void AWFGameMode::VaultGear(const FString& ItemId)
{
	const std::string Id = WFData::ToStd(ItemId);
	StashAction([Id](wf::FProgression& P) { return wf::stash::ToVault(P, Id); }, TEXT("Moved to the vault"), TEXT("Worn gear stays out, and the vault holds 150"));
}
void AWFGameMode::UnvaultGear(const FString& ItemId)
{
	const std::string Id = WFData::ToStd(ItemId);
	StashAction([Id](wf::FProgression& P) { const bool bWas = wf::stash::InVault(P, Id); wf::stash::FromVault(P, Id); return bWas; }, TEXT("Back in your inventory"), TEXT("That piece is not in the vault"));
}
void AWFGameMode::FavoriteGear(const FString& ItemId)
{
	const std::string Id = WFData::ToStd(ItemId);
	StashAction([Id](wf::FProgression& P) { for (wf::FGearItem& G : P.Inventory) if (G.Id == Id) { G.bFavorite = !G.bFavorite; return true; } return false; }, TEXT("Favourite toggled"), TEXT("No such item"));
}

// --- the activity board (Scene.tsx stepActivity on activities.ts) ------------------------------------------------------

void AWFGameMode::Activities(const FString& Area)
{
	const UWFActivitySubsystem* Board = GetGameInstance()->GetSubsystem<UWFActivitySubsystem>();
	if (!Board) return;
	TArray<FString> Lines = Board->DescribeBoard(Area);
	if (Lines.IsEmpty()) Lines.Add(TEXT("Nothing on the board there. Areas: veridan ember frostspire wastelands swamps solara nexus neon neon-underground neon-core"));
	Lines.Add(TEXT("ActivityStart <id> · ActivityAbandon · races: ListRaces / StartRace"));
	for (const FString& L : Lines) { UE_LOG(LogTemp, Display, TEXT("%s"), *L); Toast(L, FLinearColor(0.45f, 0.9f, 1.f)); }
}

void AWFGameMode::ActivityStart(const FString& ActivityId)
{
	UWFActivitySubsystem* Board = GetGameInstance()->GetSubsystem<UWFActivitySubsystem>();
	if (!Board) return;
	const FString Error = Board->Start(ActivityId);
	if (!Error.IsEmpty()) { Toast(Error, FLinearColor(1.f, 0.55f, 0.3f)); return; }
	if (const UWFActivitySubsystem::FBoardDef* D = Board->ActiveDef()) Toast(FString::Printf(TEXT("%s: %s"), UTF8_TO_TCHAR(D->Name.c_str()), UTF8_TO_TCHAR(D->Brief.c_str())), FLinearColor(1.f, 0.82f, 0.35f));
}

void AWFGameMode::ActivityAbandon()
{
	if (UWFActivitySubsystem* Board = GetGameInstance()->GetSubsystem<UWFActivitySubsystem>()) Board->Abandon();
}

void AWFGameMode::TickActivity(float DeltaSeconds)
{
	UWFActivitySubsystem* Board = GetGameInstance()->GetSubsystem<UWFActivitySubsystem>();
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Board || !Prog || !Pawn) return;
	if (Board->IsRunning())
	{
		// activities.ts Tick: where you stand in the web world, the session's kills by tier, health and deaths
		const AWFCharacter* Player = Cast<AWFCharacter>(Pawn);
		if (const AWFVehicle* Car = Cast<AWFVehicle>(Pawn)) Player = Car->GetDriver();
		const FVector2D Here = WorldToRegion(Pawn->GetActorLocation());
		const wf::reward::FSimTally& T = Prog->GetTally();
		wf::activity::FTick Facts;
		Facts.X = Here.X; Facts.Z = Here.Y; Facts.Dt = DeltaSeconds; Facts.NowMs = UWFProgressionSubsystem::NowMs();
		Facts.Kills = T.Kills; Facts.Elites = T.EliteKills; Facts.Bosses = T.BossKills; Facts.RivalKills = T.RivalKills;
		Facts.Hp = Player ? Player->GetHealth() : 100;
		Facts.Deaths = Prog->GetPlayerDeaths();
		// the Killbox stage in progress fields its rivals and keeps its match here (Scene.tsx crucible / pvp)
		const UWFActivitySubsystem::FBoardDef* Def = Board->ActiveDef();
		const wf::activity::FActivityRun* Run = Board->ActiveRun();
		const wf::activity::FObjective* Stage = Def && Run && static_cast<size_t>(Run->Stage) < Def->Stages.size() ? &Def->Stages[static_cast<size_t>(Run->Stage)] : nullptr;
		if (Stage && (Stage->Kind == "crucible" || Stage->Kind == "pvp")) Facts.Pvp = TickKillbox(DeltaSeconds, Stage->Kind, Stage->Mode, Def->Area);
		else if (Killbox || CrucibleField) { ClearRivals(); Killbox.reset(); CrucibleField.reset(); ArenaWeb.reset(); }
		Board->Tick(Facts);
		// the marker: a ring where the objective is (debug draw: compiled out of Shipping, where the HUD distance guides you)
		if (const std::optional<wf::activity::FTarget> Tg = Board->Target())
		{
			const FVector At = RegionToWorld(Tg->X, Tg->Z, Pawn->GetActorLocation().Z);
			DrawDebugCylinder(GetWorld(), At, At + FVector(0, 0, 1200), wf::activity::CheckpointRadius * 100.0, 24, FColor(255, 200, 60), false, -1.f, 0, 6.f);
		}
	}
	else if (Killbox || CrucibleField) { ClearRivals(); Killbox.reset(); CrucibleField.reset(); ArenaWeb.reset(); } // the match ended or was abandoned
	if (Board->GetFinishedCount() != ActivitySeen)
	{
		ActivitySeen = Board->GetFinishedCount();
		for (const FString& L : Board->GetLastSummary()) Toast(L, FLinearColor(1.f, 0.82f, 0.35f));
	}
}

// --- the Killbox (crucible.ts / pvp.ts against AI rival operators) -------------------------------------------------------

namespace
{
	const FLinearColor KbRed(1.f, 0.35f, 0.3f);
	FString KbTag(int32 Slot) { return FString::Printf(TEXT("crucible:%d"), Slot); }
}

void AWFGameMode::ClearRivals()
{
	// crucible.ts clearRivals: rivals leave the field without awarding anything
	for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It) if (!It->IsDead() && It->IsRival()) It->Destroy();
}

int32 AWFGameMode::SpawnRival(int32 Slot, const FString& Class, const FVector& Centre, double RingM, double Angle)
{
	UWorld* World = GetWorld();
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!World || !Pawn) return 0;
	const double X = Centre.X + FMath::Cos(Angle) * RingM * 100.0, Y = Centre.Y + FMath::Sin(Angle) * RingM * 100.0;
	const FTransform Xf(FRotator::ZeroRotator, FVector(X, Y, GroundZ(X, Y, Pawn->GetActorLocation().Z) + 150));
	AWFEnemy* Rival = World->SpawnActorDeferred<AWFEnemy>(AWFEnemy::StaticClass(), Xf, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn);
	if (!Rival) return 0;
	// crucible.ts: hp RIVAL_HP, a Vanguard-kind operator body, Rival <GOLIATH | NYX | CIPHER>, no drop
	Rival->Configure(TEXT("Rival ") + WFData::ToF(wf::pvp::RivalLabel(WFData::ToStd(Class))), TEXT("wastelands"), TEXT("scrapMetal"), false, false, wf::pvp::RivalHp);
	Rival->SetKind(TEXT("VANGUARD"));
	Rival->SetRival(Class);
	Rival->SetActivityTag(KbTag(Slot));
	Rival->SetSquadIndex(NextSquadIndex++);
	Rival->FinishSpawning(Xf);
	return 1;
}

std::optional<wf::activity::FPvpTick> AWFGameMode::TickKillbox(float DeltaSeconds, const std::string& StageKind, const std::string& Mode, const std::string& AreaId)
{
	const UWFActivitySubsystem* Board = GetGameInstance()->GetSubsystem<UWFActivitySubsystem>();
	const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	const wf::activity::FArea* Area = Board ? Board->AreaOf(AreaId) : nullptr;
	if (!Prog || !Pawn || !Area) return std::nullopt;
	const double Dt = DeltaSeconds;
	const wf::activity::FFrac ArenaF = wf::activity::PointWorld(*Area, wf::activity::ArenaPoint);
	auto SlotAlive = [this](int Slot) { for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It) if (!It->IsDead() && It->IsRival() && It->GetActivityTag() == KbTag(Slot)) return true; return false; };
	auto Rand = []() { return static_cast<double>(FMath::FRand()); };
	AWFCharacter* Player = Cast<AWFCharacter>(Pawn);
	if (const AWFVehicle* Car = Cast<AWFVehicle>(Pawn)) Player = Car->GetDriver();
	const FString PlayerClass = UTF8_TO_TCHAR(Prog->Get().PocketClass.c_str()); // the operator being played (Scene.tsx playerClass)

	if (StageKind == "crucible")
	{
		if (!CrucibleField || CrucibleField->Mode != Mode) { ClearRivals(); CrucibleField = wf::pvp::NewCrucible(Mode); }
		ArenaWeb = FVector2D(ArenaF.X, ArenaF.Z);
		const FVector Centre = RegionToWorld(ArenaF.X, ArenaF.Z, Pawn->GetActorLocation().Z);
		const wf::pvp::FFieldWorld W{SlotAlive, []() { return true; }, Rand};
		for (const wf::pvp::FSpawn& S : wf::pvp::StepRivals(*CrucibleField, WFData::ToStd(PlayerClass), Dt, W))
			SpawnRival(S.Slot, WFData::ToF(S.Class), Centre, wf::pvp::ArenaRadius * 0.8, S.Angle);
		return std::nullopt; // the duel / skirmish scores from the rival kills and deaths in the tick
	}

	const wf::pvp::FMode* M = wf::pvp::ModeById(Mode);
	if (!M) return std::nullopt;
	const wf::reward::FSimTally& T = Prog->GetTally();
	if (!Killbox || Killbox->St.Mode != Mode)
	{
		ClearRivals();
		FKillbox K;
		K.St = wf::pvp::NewPvp(Mode, static_cast<uint32_t>((static_cast<int64_t>(UWFProgressionSubsystem::NowMs()) & 0xffff) + 1));
		K.Kills = T.RivalKills; K.Deaths = Prog->GetPlayerDeaths();
		K.Field.Mode = "skirmish";
		const wf::activity::FFrac C = M->Kind == "royale" ? wf::activity::FFrac{Area->X, Area->Z} : ArenaF;
		K.Centre = FVector2D(C.X, C.Z);
		Killbox = K;
		Toast(FString::Printf(TEXT("%s · %s"), UTF8_TO_TCHAR(M->Name.c_str()), UTF8_TO_TCHAR(M->Brief.c_str())), KbRed);
	}
	FKillbox& K = *Killbox;
	ArenaWeb.reset();
	if (M->Kind != "royale") ArenaWeb = K.Centre;
	// your squadmates are not in this build: team points come from your own eliminations (and the off-field fight)
	const double Kills = T.RivalKills - K.Kills;
	const bool bDied = Prog->GetPlayerDeaths() > K.Deaths;
	K.Kills = T.RivalKills; K.Deaths = Prog->GetPlayerDeaths();
	const FVector2D Here = WorldToRegion(Pawn->GetActorLocation());
	int32 OnField = 0;
	for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It) if (!It->IsDead() && It->IsRival()) ++OnField;
	wf::pvp::StepPvp(K.St, {Dt, Kills, bDied, Here.X - K.Centre.X, Here.Y - K.Centre.Y, static_cast<double>(OnField)});
	if (K.St.Round != K.Round) { ClearRivals(); wf::pvp::ResetField(K.Field); K.Round = K.St.Round; }
	// the royale field follows you; the arena modes spawn round the arena edge
	const std::vector<std::string> Lineup = wf::pvp::RivalSquad(wf::pvp::FieldSize(K.St), static_cast<int>(K.St.Round));
	for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It)
		if (!It->IsDead() && It->IsRival() && FCString::Atoi(*It->GetActivityTag().Mid(9)) >= static_cast<int32>(Lineup.size())) It->Destroy(); // a royale lobby thinning out
	const FVector FieldAt = M->Kind == "royale" ? Pawn->GetActorLocation() : RegionToWorld(K.Centre.X, K.Centre.Y, Pawn->GetActorLocation().Z);
	const wf::pvp::FFieldWorld W{SlotAlive, []() { return true; }, Rand};
	for (const wf::pvp::FSpawn& S : wf::pvp::StepField(K.Field, Lineup, wf::pvp::Respawns(K.St), Dt, W))
		SpawnRival(S.Slot, WFData::ToF(S.Class), FieldAt, M->Kind == "royale" ? 42 : wf::pvp::ArenaRadius * 0.8, S.Angle);
	if (M->Kind == "royale" && Player)
		if (const double Burn = wf::pvp::StormDamage(K.St, wf::js::Hypot(Here.X - K.Centre.X, Here.Y - K.Centre.Y)); Burn > 0)
			Player->ApplyHit(Burn * Dt, TEXT("The closing fracture"));
	return wf::activity::FPvpTick{K.St.Us, K.St.Them, K.St.Result, K.St.Reason, wf::pvp::PvpLine(K.St)};
}

bool AWFGameMode::KillboxRespawn(const FVector& DiedAt, FVector& OutAt) const
{
	if (!ArenaWeb) return false;
	const FVector2D Fell = WorldToRegion(DiedAt);
	const double Side = Fell.X - ArenaWeb->X;
	const double X = ArenaWeb->X - (Side > 0 ? 1.0 : Side < 0 ? -1.0 : 1.0) * wf::pvp::ArenaRadius * 0.7;
	OutAt = RegionToWorld(X, ArenaWeb->Y, DiedAt.Z) + FVector(0, 0, 120);
	return true;
}
