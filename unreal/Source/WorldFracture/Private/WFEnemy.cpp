#include "WFEnemy.h"

#include "AIController.h"
#include "Components/CapsuleComponent.h"
#include "DrawDebugHelpers.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "WFCharacter.h"
#include "WFProgressionSubsystem.h"

namespace
{
	// enemy-tuning.ts ENEMY_TUNING (daytime; night bonuses not modelled yet)
	constexpr double AggroBase = 48;       // m
	constexpr double AggroElite = 1.25;
	constexpr double SpeedBase = 6.5;      // m/s
	constexpr double SpeedElite = 1.1;
	constexpr double RangedRange = 40;     // m
	constexpr double MeleeRange = 2.5;     // m
	constexpr double MeleeCooldownS = 1.4;
	constexpr double PreferredRange = 18;  // m: troopers hold off and shoot rather than hug the player
	constexpr double CmPerM = 100.0;
	constexpr double PlayerCreditWindowS = 8; // sim.ts PLAYER_CREDIT_WINDOW_S
}

AWFEnemy::AWFEnemy()
{
	PrimaryActorTick.bCanEverTick = true;
	GetCapsuleComponent()->InitCapsuleSize(45.f, 95.f);

	Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BodyMesh"));
	Body->SetupAttachment(GetCapsuleComponent());
	Body->SetRelativeScale3D(FVector(0.8f, 0.8f, 1.5f));
	Body->SetRelativeLocation(FVector(0.f, 0.f, -20.f));
	Body->SetCollisionProfileName(TEXT("NoCollision"));

	Head = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HeadMesh"));
	Head->SetupAttachment(GetCapsuleComponent());
	Head->SetRelativeScale3D(FVector(0.45f));
	Head->SetRelativeLocation(FVector(0.f, 0.f, 75.f));
	Head->SetCollisionProfileName(TEXT("NoCollision"));

	// weapon traces hit the capsule
	GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	bUseControllerRotationYaw = false;
	GetCharacterMovement()->bOrientRotationToMovement = true;
	AIControllerClass = AAIController::StaticClass();
	AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;
}

void AWFEnemy::Configure(const FString& InProfile, const FString& InZone, const FString& InDropMaterial, bool bInElite, bool bInBoss, double InMaxHealth)
{
	Profile = InProfile;
	Zone = InZone;
	DropMaterial = InDropMaterial;
	bElite = bInElite;
	bBoss = bInBoss;
	MaxHealth = Health = InMaxHealth;
}

void AWFEnemy::BeginPlay()
{
	Super::BeginPlay();
	if (UStaticMesh* Cylinder = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"))) Body->SetStaticMesh(Cylinder);
	if (UStaticMesh* Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"))) Head->SetStaticMesh(Sphere);
	if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")))
	{
		UMaterialInstanceDynamic* Paint = UMaterialInstanceDynamic::Create(Base, this);
		Paint->SetVectorParameterValue(TEXT("Color"), bBoss ? FLinearColor(0.6f, 0.05f, 0.6f) : bElite ? FLinearColor(0.85f, 0.35f, 0.05f) : FLinearColor(0.35f, 0.38f, 0.42f));
		Body->SetMaterial(0, Paint);
		Head->SetMaterial(0, Paint);
	}
	const double Scale = bBoss ? 1.8 : bElite ? 1.25 : 1.0;
	SetActorScale3D(FVector(Scale));
	GetCharacterMovement()->MaxWalkSpeed = static_cast<float>(SpeedBase * (bElite ? SpeedElite : 1.0) * CmPerM);
	RangedCooldown = 1.5; // sim.ts spawnMachine cool
}

void AWFEnemy::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (IsDead()) return;
	SincePlayerHit += DeltaSeconds;
	if (StunLeft > 0) { StunLeft -= DeltaSeconds; return; }
	AWFCharacter* Player = Cast<AWFCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
	if (!Player) return;

	const FVector ToPlayer = Player->GetActorLocation() - GetActorLocation();
	const double Distance = ToPlayer.Size2D() / CmPerM;
	if (!bAggro && Distance <= AggroBase * (bElite ? AggroElite : 1.0)) bAggro = true;
	if (!bAggro) return;

	const FVector Flat = FVector(ToPlayer.X, ToPlayer.Y, 0).GetSafeNormal();
	if (Distance > PreferredRange) AddMovementInput(Flat, 1.f);
	else if (Distance < PreferredRange * 0.5 && Distance > MeleeRange) AddMovementInput(-Flat, 0.5f);
	SetActorRotation(FRotator(0.f, Flat.Rotation().Yaw, 0.f));
	TryAttack(Player, Distance, DeltaSeconds);
}

void AWFEnemy::TryAttack(AWFCharacter* Player, double Distance, float DeltaSeconds)
{
	MeleeCooldown = FMath::Max(0.0, MeleeCooldown - DeltaSeconds);
	if (Distance <= MeleeRange && MeleeCooldown <= 0)
	{
		Player->ApplyHit(Tier(7, 12, 17), Profile);
		MeleeCooldown = MeleeCooldownS;
		return;
	}
	if (Distance > RangedRange) { Windup = -1; return; }

	if (Windup >= 0)
	{
		Windup -= DeltaSeconds;
		if (Windup > 0) return;
		Windup = -1;
		RangedCooldown = Tier(2.6, 1.9, 1.3);
		// a clear line from the muzzle to the player's chest, then a fixed hit chance (simplified; see header)
		const FVector From = GetActorLocation() + FVector(0, 0, 60);
		const FVector To = Player->GetActorLocation() + FVector(0, 0, 40);
		FHitResult Hit;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(WFEnemyShot), false, this);
		const bool bBlocked = GetWorld()->LineTraceSingleByChannel(Hit, From, To, ECC_Visibility, Params) && Hit.GetActor() != Player;
		DrawDebugLine(GetWorld(), From, bBlocked ? Hit.ImpactPoint : To, FColor(255, 70, 50), false, 0.08f, 0, 1.f);
		if (!bBlocked && FMath::FRand() < RangedHitChance) Player->ApplyHit(Tier(2, 4, 6), Profile);
		return;
	}
	RangedCooldown -= DeltaSeconds;
	if (RangedCooldown <= 0) Windup = Tier(0.6, 0.42, 0.25); // telegraph, then shoot
}

void AWFEnemy::ReceiveHit(double Damage, AActor* Instigator)
{
	if (IsDead()) return;
	Health -= Damage;
	bAggro = true;
	if (Cast<AWFCharacter>(Instigator)) { SincePlayerHit = 0; ++PlayerHits; }
	if (Health <= 0) Die();
}

void AWFEnemy::ConfigureScenario(const FString& InScenarioId)
{
	ScenarioId = InScenarioId;
	PlayerHits = 0;
	SummonedAt = GetWorld() ? GetWorld()->GetTimeSeconds() : 0;
	if (UWFProgressionSubsystem* Progression = GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>() : nullptr)
	{
		ScenarioRun = Progression->MintScenarioRun(InScenarioId);
		DeathsAtSummon = Progression->GetPlayerDeaths();
	}
	bAggro = true;
}

void AWFEnemy::Die()
{
	Health = 0;
	SetActorEnableCollision(false);
	GetCharacterMovement()->DisableMovement();
	SetActorRotation(GetActorRotation() + FRotator(0.f, 0.f, 80.f)); // topple
	SetLifeSpan(3.f);

	FWFEnemyRewardInfo Info;
	Info.bBoss = bBoss;
	Info.bElite = bElite;
	Info.Zone = Zone;
	Info.DropMaterial = DropMaterial;
	Info.Profile = Profile;
	Info.bKilledByWorld = SincePlayerHit > PlayerCreditWindowS;
	UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Progression) return;
	if (!ScenarioId.IsEmpty())
	{
		Info.ScenarioId = ScenarioId;
		Info.ScenarioRun = ScenarioRun;
		Info.PlayerHits = PlayerHits;
		Info.FightSeconds = GetWorld()->GetTimeSeconds() - SummonedAt;
		Info.FightDeaths = Progression->GetPlayerDeaths() - DeathsAtSummon;
	}
	Progression->ReportEnemyDefeated(Info);
}
