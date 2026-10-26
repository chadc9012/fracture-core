#include "WFEnemy.h"

#include "Engine/GameInstance.h"

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
#include "WFDataFiles.h"
#include "WFGameMode.h"
#include "WFProgressionSubsystem.h"
#include "WFVehicle.h"
#include "Core/WFArmsCore.h"

namespace
{
	// enemy-tuning.ts ENEMY_TUNING (daytime; night bonuses not modelled yet)
	constexpr double SpeedBase = 6.5;      // m/s
	constexpr double SpeedElite = 1.1;
	constexpr double RangedRange = 40;     // m
	constexpr double MeleeRange = 2.5;     // m
	constexpr double MeleeCooldownS = 1.4;
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
	BossRules.bBoss = bInBoss;
	BossRules.Profile = WFData::ToStd(InProfile);
	BossRules.MaxHp = BossRules.Hp = InMaxHealth;
}

void AWFEnemy::SyncRules()
{
	const FVector L = GetActorLocation() / CmPerM; // rules plane: x = Unreal X, z = Unreal Y (metres)
	BossRules.X = L.X;
	BossRules.Z = L.Y;
	BossRules.Hp = Health;
	BossRules.MaxHp = MaxHealth;
	BossRules.Cool = StunLeft;
	BossRules.bAlive = !IsDead();
}

void AWFEnemy::ApplyRules()
{
	const FVector L = GetActorLocation();
	const FVector Target(BossRules.X * CmPerM, BossRules.Z * CmPerM, L.Z);
	if (FVector::Dist2D(Target, L) > 1.0) // a pounce or lunge moved it: land on the ground there
	{
		FHitResult Ground;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(WFBossLand), false, this);
		const bool bGround = GetWorld()->LineTraceSingleByChannel(Ground, Target + FVector(0, 0, 5000), Target - FVector(0, 0, 20000), ECC_Visibility, Params);
		SetActorLocation(bGround ? Ground.ImpactPoint + FVector(0, 0, GetCapsuleComponent()->GetScaledCapsuleHalfHeight()) : Target, false, nullptr, ETeleportType::TeleportPhysics);
	}
	Health = BossRules.Hp; // truce floors and resets
	StunLeft = BossRules.Cool;
}

void AWFEnemy::Depart()
{
	Health = 0;
	ScenarioId.Empty();
	Destroy();
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
	const double Scale = ScaleOverride > 0 ? ScaleOverride : bBoss ? 1.8 : bElite ? 1.25 : 1.0;
	SetActorScale3D(FVector(Scale));
	GetCharacterMovement()->MaxWalkSpeed = static_cast<float>(SpeedBase * (bElite ? SpeedElite : 1.0) * CmPerM);
	RangedCooldown = 1.5; // sim.ts spawnMachine cool
}

void AWFEnemy::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (IsDead()) return;
	SincePlayerHit += DeltaSeconds;
	if (bDecoy) return; // False Saints never fight
	if (bBoss)
	{
		// sim.ts: every boss decays poise and escalates through three phases; a phase change opens the weak point
		BossRules.Hp = Health;
		BossRules.MaxHp = MaxHealth;
		if (const std::optional<int> Changed = wf::encounter::StepRegionalPhase(BossRules, DeltaSeconds, GetWorld()->GetTimeSeconds()))
			if (AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>()) Mode->OnBossPhase(this, *Changed);
		const wf::encounter::FPhaseTuning& T = wf::encounter::TuningFor(BossRules.RegionalPhase);
		PhaseSpeedMult = T.SpeedMult;
		PhaseDamageMult = T.DamageMult;
		PhaseCooldownMult = T.CooldownMult;
	}
	// vehicle gadgets (vehicle-gadgets.ts): caltrops and EMP mines slow it to SnareMult until SnareUntil
	const double Snare = GetWorld()->GetTimeSeconds() < SnareUntil ? SnareMult : 1.0;
	GetCharacterMovement()->MaxWalkSpeed = static_cast<float>(SpeedBase * (bElite ? SpeedElite : 1.0) * CmPerM * PhaseSpeedMult * Snare);
	// knockback (sim.ts: m.x += kx / mass x dt, kx *= e^-3dt; bosses are BOSS_KNOCK_MASS heavy)
	if (FMath::Abs(KnockX) + FMath::Abs(KnockZ) > 0.01)
	{
		const wf::vweapons::FVec Step = wf::arms::StepKnock(KnockX, KnockZ, DeltaSeconds, bBoss);
		AddActorWorldOffset(FVector(Step.X * CmPerM, Step.Z * CmPerM, 0), true);
	}
	if (StunLeft > 0) { StunLeft -= DeltaSeconds; return; }
	// the target is the Operator, or the vehicle they are driving
	APawn* Target = UGameplayStatics::GetPlayerPawn(this, 0);
	AWFCharacter* Operator = Cast<AWFCharacter>(Target);
	if (const AWFVehicle* Car = Cast<AWFVehicle>(Target)) Operator = Car->GetDriver();
	if (!Target || !Operator) return;
	TickPerception(Operator, Target, DeltaSeconds);
}

void AWFEnemy::TickPerception(AWFCharacter* Operator, APawn* Target, float DeltaSeconds)
{
	const double Dt = DeltaSeconds;
	const double Now = GetWorld()->GetTimeSeconds();
	AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>();
	AWFVehicle* Car = Cast<AWFVehicle>(Target);
	const FVector Me = GetActorLocation() / CmPerM, It = Target->GetActorLocation() / CmPerM;
	const FVector ToPlayer = Target->GetActorLocation() - GetActorLocation();
	const double Distance = ToPlayer.Size2D() / CmPerM;
	if (!bAiReady) { Ai = wf::perception::CreateAi(Me.X, Me.Y, Health); bAiReady = true; }

	// line of sight, eye to chest, refreshed every 0.25 s inside 160 m (sim.ts LOS_REFRESH)
	if (Distance < wf::perception::LosRange && Now - LosAt > 0.25)
	{
		LosAt = Now;
		FHitResult Hit;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(WFEnemySight), false, this);
		Params.AddIgnoredActor(Target);
		Params.AddIgnoredActor(Operator);
		const FVector Eye = GetActorLocation() + FVector(0, 0, 155.0 * GetActorScale3D().Z - GetCapsuleComponent()->GetScaledCapsuleHalfHeight());
		bLosClear = !GetWorld()->LineTraceSingleByChannel(Hit, Eye, Target->GetActorLocation() + FVector(0, 0, 40), ECC_Visibility, Params);
	}

	wf::perception::FPerceiveInput In;
	In.Hp = Health;
	In.X = Me.X; In.Z = Me.Y;
	In.Rot = UE_DOUBLE_HALF_PI - FMath::DegreesToRadians(static_cast<double>(GetActorRotation().Yaw)); // rules yaw = pi/2 - Unreal yaw
	In.Px = It.X; In.Pz = It.Y;
	In.bElite = bElite; In.bBoss = bBoss;
	In.StealthMult = Operator->GetStealthMult(); // Phase Veil: seen at 15%
	In.Aggro = wf::perception::AggroRadius(0, bElite, 1, 1);
	In.PlayerHp = Operator->GetHealth();
	In.PlayerNoise = Mode ? Mode->GetPlayerNoise() : 0;
	In.CombatHeat = Mode ? Mode->GetCombatHeat() : 0;
	In.bLineClear = bLosClear;
	const wf::perception::FPerceiveResult R = wf::perception::PerceiveStep(Ai, In, Dt);
	const bool bAlert = R.State == "ALERT";
	HiddenFor = !bLosClear && Distance < wf::perception::LosRange ? HiddenFor + Dt : 0;
	const bool bScripted = bBoss && Mode && Mode->HasEncounter(ScenarioId);

	// enemy-evasion.ts: dive out of an incoming rocket's blast (one reaction roll per threat), then a short burst away
	if (Now < DiveUntil)
	{
		const double P = (Now - DiveStart) / FMath::Max(1e-6, DiveUntil - DiveStart), Ease = 1 - P * 0.6;
		AddActorWorldOffset(DiveVelocity * Ease * Dt * CmPerM, true);
		SetActorRotation(FRotator(0.f, FVector(ToPlayer.X, ToPlayer.Y, 0).Rotation().Yaw, 0.f));
		RangedCooldown = FMath::Max(RangedCooldown, 0.35);
		Windup = -1;
		return;
	}
	if (!bBoss && !bScripted && !bDecoy && Distance < 90 && Now >= DiveCool && Mode)
	{
		const double Feet = Me.Z - GetCapsuleComponent()->GetScaledCapsuleHalfHeight() / CmPerM;
		for (const wf::tactics::FRoundLike& Round : Mode->GetPlayerRounds())
		{
			const std::optional<wf::tactics::FThreat> Th = wf::tactics::RoundThreat(Round, Me.X, Me.Y, [Feet](double, double) { return Feet; }, 1.5 * GetActorScale3D().X);
			if (!Th) continue;
			DiveCool = Now + wf::tactics::FDive::Cooldown;
			if (!wf::tactics::ReactsInTime(Th->T, bElite, FMath::FRand())) break; // a miss waits out the cooldown
			const wf::tactics::FPoint D = wf::tactics::DiveDirection(Me.X, Me.Y, {Th->X, Th->Z}, Round.Dx, Round.Dz, GetUniqueID() % 2 ? 1 : -1);
			DiveVelocity = FVector(D.X, D.Z, 0) * wf::tactics::FDive::Speed;
			DiveStart = Now;
			DiveUntil = Now + wf::tactics::FDive::Seconds;
			Windup = -1;
			return;
		}
	}

	// a wounded trooper breaks line of fire to a retreat point (pickCover; real cover behind obstacles is not ported)
	if (bAlert && Ai.CoverTime <= 0 && wf::perception::ShouldTakeCover(Health / FMath::Max(1.0, MaxHealth), Ai.CoverTime, bBoss) && Distance < 45 && R.bDamaged)
	{
		const wf::perception::FPoint C = wf::perception::PickCover(Me.X, Me.Y, It.X, It.Y, GetUniqueID() % 2 ? 1 : -1);
		Ai.CoverX = C.X; Ai.CoverZ = C.Z; Ai.CoverTime = 3.5;
	}
	Ai.CoverTime -= Dt;

	auto MoveTo = [this, &Me](double X, double Z, float Pace) {
		const FVector Dir(X - Me.X, Z - Me.Y, 0);
		if (Dir.Size2D() > 0.01) { AddMovementInput(Dir.GetSafeNormal(), Pace); SetActorRotation(FRotator(0.f, Dir.Rotation().Yaw, 0.f)); }
	};
	const FVector Flat = FVector(ToPlayer.X, ToPlayer.Y, 0).GetSafeNormal();
	if (bAlert && Ai.CoverTime > 1.2)
	{
		// sprinting to the retreat point: no shooting while relocating
		if (FVector::Dist2D(Me, FVector(Ai.CoverX, Ai.CoverZ, 0)) > 1.5) MoveTo(Ai.CoverX, Ai.CoverZ, 1.f);
		else SetActorRotation(FRotator(0.f, Flat.Rotation().Yaw, 0.f));
		RangedCooldown = FMath::Max(RangedCooldown, 0.4);
		Windup = -1;
		return;
	}
	if (bAlert)
	{
		const int32 Index = static_cast<int32>(GetUniqueID() % 1024);
		const std::string Role = wf::tactics::SquadRole(Index, bElite, bBoss);
		// the player has gone to ground: lob a grenade over the cover at where they were last seen (one squad grenade at a time)
		if (!bScripted && Mode && wf::tactics::ThrowsGrenades(WFData::ToStd(Kind)) && HiddenFor >= wf::tactics::GrenadeAfter && Distance >= wf::tactics::FGrenadeTuning::MinRange
			&& Distance <= wf::tactics::FGrenadeTuning::MaxRange && Now >= GrenadeAt && Windup < 0 && Mode->CanThrowGrenade())
		{
			const FVector Guess = It + FVector((FMath::FRand() - 0.5) * 3, (FMath::FRand() - 0.5) * 3, 0);
			Mode->ThrowGrenade(GetActorLocation() / CmPerM + FVector(0, 0, 0.9 * GetActorScale3D().Z), Guess);
			GrenadeAt = Now + wf::tactics::FGrenadeTuning::OwnCooldown;
			RangedCooldown = FMath::Max(RangedCooldown, 0.9);
			SetActorRotation(FRotator(0.f, Flat.Rotation().Yaw, 0.f));
			return;
		}
		// ...and a couple of troopers swing round the side to find a line on them
		if (!bFlanking && !bScripted && !bBoss && Role != "LEADER" && HiddenFor >= wf::tactics::FlankAfter && Mode && Mode->CountFlankers() < wf::tactics::MaxFlankers)
		{
			UWorld* World = GetWorld();
			const AActor* Self = this;
			const auto Ground = [World](double X, double Z) {
				FHitResult G;
				const FVector At(X * CmPerM, Z * CmPerM, 0);
				return World->LineTraceSingleByChannel(G, At + FVector(0, 0, 20000), At - FVector(0, 0, 50000), ECC_WorldStatic) ? G.ImpactPoint.Z / CmPerM : 0.0;
			};
			const auto Blocked = [World, Self, Target](const wf::tactics::FPoint3& From, const wf::tactics::FPoint3& To) {
				FHitResult H;
				FCollisionQueryParams Q(SCENE_QUERY_STAT(WFFlank), false, Self);
				Q.AddIgnoredActor(Target);
				return World->LineTraceSingleByChannel(H, FVector(From.X, From.Z, From.Y) * CmPerM, FVector(To.X, To.Z, To.Y) * CmPerM, ECC_Visibility, Q);
			};
			if (const std::optional<wf::tactics::FPoint> Spot = wf::tactics::FindFlankSpot(Me.X, Me.Y, {It.X, It.Z, It.Y}, GetUniqueID() % 2 ? 1 : -1, Ground, Blocked))
			{
				bFlanking = true; Flank = *Spot; FlankUntil = Now + wf::tactics::FlankGiveUp;
			}
		}
		if (bFlanking && (Now > FlankUntil || bLosClear || FVector::Dist2D(Me, FVector(Flank.X, Flank.Z, 0)) < 1.5)) bFlanking = false;
		if (bFlanking)
		{
			MoveTo(Flank.X, Flank.Z, 1.f); // running the flank, guns up
			if (bLosClear) { SetActorRotation(FRotator(0.f, Flat.Rotation().Yaw, 0.f)); TryAttack(Operator, Car, Distance, DeltaSeconds); }
			return;
		}
		// squad role and threat drive positioning (enemy-intelligence.ts squadMove), not a straight chase
		const wf::tactics::FMove M = wf::tactics::SquadMove(Role, Distance, Operator->GetHealth() / AWFCharacter::MaxHealth, Mode ? Mode->GetCombatHeat() : 0, Now + Index,
			Operator->GetSquadArchetype(), Operator->IsReflecting(), Operator->GetBranchPosture());
		const FVector Side(-Flat.Y, Flat.X, 0); // rules (-nz, nx) on Unreal (X, Y)
		const FVector Wish = Flat * M.Forward + Side * M.Strafe;
		if (Wish.Size2D() > 0.01) AddMovementInput(Wish.GetSafeNormal2D(), static_cast<float>(FMath::Min(1.0, Wish.Size2D())));
		SetActorRotation(FRotator(0.f, Flat.Rotation().Yaw, 0.f));
		// an authored encounter boss attacks only through its encounter (AWFGameMode::TickEncounters)
		if (bScripted) return;
		TryAttack(Operator, Car, Distance, DeltaSeconds);
		return;
	}
	bFlanking = false;
	Windup = -1;
	if (R.State == "SUSPICIOUS" || R.State == "SEARCH")
	{
		// investigate the last known position, cautiously; sweep around once there
		if (FVector::Dist2D(Me, FVector(Ai.LastX, Ai.LastZ, 0)) > 3) MoveTo(Ai.LastX, Ai.LastZ, R.State == "SEARCH" ? 0.7f : 0.45f);
		else SetActorRotation(GetActorRotation() + FRotator(0.f, static_cast<float>(FMath::RadiansToDegrees(-Dt * 1.6)), 0.f));
		return;
	}
	// patrol between waypoints around the spawn anchor, at 5 m/s
	if (FVector::Dist2D(Me, FVector(Ai.WpX, Ai.WpZ, 0)) < 2.5)
	{
		Ai.Timer -= Dt;
		SetActorRotation(GetActorRotation() + FRotator(0.f, static_cast<float>(FMath::RadiansToDegrees(-Dt * 0.6)), 0.f));
		if (Ai.Timer <= 0)
		{
			const double A = FMath::FRand() * UE_DOUBLE_TWO_PI, Rad = 10 + FMath::FRand() * 22;
			Ai.WpX = Ai.HomeX + std::cos(A) * Rad; Ai.WpZ = Ai.HomeZ + std::sin(A) * Rad; Ai.Timer = 1.5 + FMath::FRand() * 2;
		}
	}
	else MoveTo(Ai.WpX, Ai.WpZ, static_cast<float>(5.0 / (SpeedBase * (bElite ? SpeedElite : 1.0))));
}

void AWFEnemy::TryAttack(AWFCharacter* Operator, AWFVehicle* Car, double Distance, float DeltaSeconds)
{
	// a hit on a driving Operator also wears the vehicle (Scene.tsx: impactVehicle by the hp lost + 2)
	auto Hurt = [Operator, Car, this](double Damage) {
		const double Before = Operator->GetHealth();
		Operator->ApplyHit(Damage, Profile);
		if (Car && Operator->GetHealth() < Before) Car->TakeEnemyFire(Before - Operator->GetHealth());
	};
	MeleeCooldown = FMath::Max(0.0, MeleeCooldown - DeltaSeconds);
	if (Distance <= MeleeRange && MeleeCooldown <= 0)
	{
		Hurt(Tier(7, 12, 17) * PhaseDamageMult);
		MeleeCooldown = MeleeCooldownS * PhaseCooldownMult;
		if (AWFGameMode* HeatMode = GetWorld()->GetAuthGameMode<AWFGameMode>()) HeatMode->AddCombatHeat(wf::city::FHeatGain::EnemyMelee);
		return;
	}
	if (Distance > RangedRange) { Windup = -1; return; }

	if (Windup >= 0)
	{
		Windup -= DeltaSeconds;
		if (Windup > 0) return;
		Windup = -1;
		RangedCooldown = wf::perception::RangedCooldownFor(bBoss, bElite) * PhaseCooldownMult;
		// the shot resolves against the line it travels: cover takes it, flares spoof it, otherwise range and speed decide
		APawn* Target = Car ? static_cast<APawn*>(Car) : static_cast<APawn*>(Operator);
		const FVector From = GetActorLocation() + FVector(0, 0, 60);
		const FVector To = Target->GetActorLocation() + FVector(0, 0, 40);
		FHitResult Hit;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(WFEnemyShot), false, this);
		Params.AddIgnoredActor(Operator);
		const bool bBlocked = GetWorld()->LineTraceSingleByChannel(Hit, From, To, ECC_Visibility, Params) && Hit.GetActor() != Target;
		DrawDebugLine(GetWorld(), From, bBlocked ? Hit.ImpactPoint : To, FColor(255, 70, 50), false, 0.08f, 0, 1.f);
		const bool bSpoofed = Car && Car->IsSpoofed(GetWorld()->GetTimeSeconds());
		const double Chance = wf::perception::EnemyHitChance(Distance, wf::perception::RangedRange, Car ? FMath::Abs(Car->GetState().Speed) : Operator->GetVelocity().Size2D() / CmPerM); // a car moves without a movement component
		if (!bBlocked && !bSpoofed && FMath::FRand() < Chance) Hurt(Tier(2, 4, 6) * PhaseDamageMult);
		return;
	}
	RangedCooldown -= DeltaSeconds;
	if (RangedCooldown <= 0) Windup = wf::perception::WindupFor(bBoss, bElite); // telegraph, then shoot
}

double AWFEnemy::TakeHitLeaving(double Damage, AActor* DamageInstigator, const FString& Element, double Floor)
{
	HitFloor = Floor; // TakeHit applies it before its death check
	const double Dealt = TakeHit(Damage, DamageInstigator, Element);
	HitFloor = 0;
	return Dealt;
}

double AWFEnemy::TakeHit(double Damage, AActor* DamageInstigator, const FString& Element)
{
	if (IsDead()) return 0;
	const double Now = GetWorld()->GetTimeSeconds();
	if (VulnUntil > Now) Damage *= VulnMult; // sim.ts applyMachineDamageMods: Weaken / Marked / Roar vulnerability
	const AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>();
	if (bBoss && Mode)
	{
		// sim.ts applyMachineDamageMods: poise windows, scenario immunity outside them, gimmicks, participation hits
		SyncRules();
		double Distance = 0;
		if (const APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0)) Distance = FVector::Dist2D(Player->GetActorLocation(), GetActorLocation()) / CmPerM;
		Damage = wf::encounter::ApplyBossDamage(Mode->GetEncounterCatalog(), BossRules, Damage, WFData::ToStd(Element), Distance, Now);
	}
	Health -= Damage;
	if (HitFloor > 0 && Health < HitFloor) Health = FMath::Min(HitFloor, Health + Damage); // TakeHitLeaving
	if (Cast<AWFCharacter>(DamageInstigator)) SincePlayerHit = 0;
	if (Health > 0) return Damage;
	if (bBoss && Mode && !bDecoy)
	{
		// sim.ts defeatMachine: an encounter boss cannot die before its finale window opens
		BossRules.Hp = Health;
		const double Floor = wf::encounter::EncounterHpFloor(Mode->GetEncounterCatalog(), BossRules, Now);
		if (Floor > 0) { Health = Floor; return Damage; }
	}
	Die();
	return Damage;
}

void AWFEnemy::MoveToGround(double XMetres, double YMetres)
{
	const FVector Target(XMetres * CmPerM, YMetres * CmPerM, GetActorLocation().Z);
	FHitResult Ground;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(WFKnockback), false, this);
	const bool bGround = GetWorld()->LineTraceSingleByChannel(Ground, Target + FVector(0, 0, 5000), Target - FVector(0, 0, 20000), ECC_Visibility, Params);
	SetActorLocation(bGround ? Ground.ImpactPoint + FVector(0, 0, GetCapsuleComponent()->GetScaledCapsuleHalfHeight()) : Target, false, nullptr, ETeleportType::TeleportPhysics);
}

void AWFEnemy::ConfigureScenario(const FString& InScenarioId)
{
	ScenarioId = InScenarioId;
	BossRules.ScenarioId = WFData::ToStd(InScenarioId);
	BossRules.PlayerHits = 0;
	SummonedAt = GetWorld() ? GetWorld()->GetTimeSeconds() : 0;
	if (UWFProgressionSubsystem* Progression = GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>() : nullptr)
	{
		ScenarioRun = Progression->MintScenarioRun(InScenarioId);
		DeathsAtSummon = Progression->GetPlayerDeaths();
	}
}

void AWFEnemy::Die()
{
	Health = 0;
	SetActorEnableCollision(false);
	GetCharacterMovement()->DisableMovement();
	SetActorRotation(GetActorRotation() + FRotator(0.f, 0.f, 80.f)); // topple
	SetLifeSpan(3.f);
	AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>();
	if (bDecoy) // a False Saint: no kill, credit, loot or progress
	{
		if (Mode) Mode->OnDecoyShattered(this);
		return;
	}
	if (bBoss && Mode && Mode->HasEncounter(ScenarioId)) Mode->OnEncounterBossDefeated(this);
	if (SummonId > 0 && Mode) Mode->OnSummonDefeated(this);

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
		Info.PlayerHits = static_cast<int32>(BossRules.PlayerHits);
		Info.FightSeconds = GetWorld()->GetTimeSeconds() - SummonedAt;
		Info.FightDeaths = Progression->GetPlayerDeaths() - DeathsAtSummon;
	}
	Progression->ReportEnemyDefeated(Info);
}
