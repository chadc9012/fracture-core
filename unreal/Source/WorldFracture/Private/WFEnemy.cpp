#include "WFEnemy.h"

#include "Engine/GameInstance.h"

#include "AIController.h"
#include "Components/CapsuleComponent.h"
#include "Components/PrimitiveComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/OverlapResult.h"
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
	// weapon-elements.ts: a burn ticks straight off health (regular enemies only); a chill slows
	const double NowE = GetWorld()->GetTimeSeconds();
	if (const double Burn = wf::hit::BurnDamage(&Statuses, NowE, DeltaSeconds); Burn > 0 && !bBoss) { TakeRawDamage(Burn, nullptr); if (IsDead()) return; }
	GetCharacterMovement()->MaxWalkSpeed = bSkillPinned ? 0.f : static_cast<float>(SpeedBase * (bElite ? SpeedElite : 1.0) * CmPerM * PhaseSpeedMult * Snare * wf::hit::StatusSpeedMult(&Statuses, NowE));
	// knockback (sim.ts: m.x += kx / mass x dt, kx *= e^-3dt; bosses are BOSS_KNOCK_MASS heavy)
	if (FMath::Abs(KnockX) + FMath::Abs(KnockZ) > 0.01)
	{
		const wf::vweapons::FVec Step = wf::arms::StepKnock(KnockX, KnockZ, DeltaSeconds, bBoss);
		AddActorWorldOffset(FVector(Step.X * CmPerM, Step.Z * CmPerM, 0), true);
	}
	if (StunLeft > 0) { StunLeft -= DeltaSeconds; return; }
	if (bSkillHoldsFire) return; // its strike or orb is stepped by the encounter rules (AWFGameMode::TickEncounters)
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
	MeleeCooldown = FMath::Max(0.0, MeleeCooldown - Dt); // runs every frame, whatever the trooper is doing
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
			const wf::tactics::FPoint D = wf::tactics::DiveDirection(Me.X, Me.Y, {Th->X, Th->Z}, Round.Dx, Round.Dz, SquadIndex % 2 ? 1 : -1);
			DiveVelocity = FVector(D.X, D.Z, 0) * wf::tactics::FDive::Speed;
			DiveStart = Now;
			DiveUntil = Now + wf::tactics::FDive::Seconds;
			Windup = -1;
			return;
		}
	}

	// sight tests for cover, from the player's eye (rules points (x, y up, z) are Unreal (X, Z, Y))
	UWorld* SightWorld = GetWorld();
	const AActor* SightSelf = this;
	const auto CoverGround = [SightWorld](double X, double Z) {
		FHitResult G;
		const FVector At(X * CmPerM, Z * CmPerM, 0);
		return SightWorld->LineTraceSingleByObjectType(G, At + FVector(0, 0, 20000), At - FVector(0, 0, 50000), FCollisionObjectQueryParams(ECC_WorldStatic)) ? G.ImpactPoint.Z / CmPerM : 0.0;
	};
	const auto CoverBlocked = [SightWorld, SightSelf, Target, Operator](const wf::tactics::FPoint3& From, const wf::tactics::FPoint3& To) {
		FHitResult H;
		FCollisionQueryParams Q(SCENE_QUERY_STAT(WFCover), false, SightSelf);
		Q.AddIgnoredActor(Target);
		Q.AddIgnoredActor(Operator);
		return SightWorld->LineTraceSingleByChannel(H, FVector(From.X, From.Z, From.Y) * CmPerM, FVector(To.X, To.Z, To.Y) * CmPerM, ECC_Visibility, Q);
	};
	// the player's eye: feet + 1.6 m (sim.ts playerEye); the pawn origin is mid-capsule
	const double PlayerFeet = It.Z - (Cast<ACharacter>(Target) ? Cast<ACharacter>(Target)->GetCapsuleComponent()->GetScaledCapsuleHalfHeight() / CmPerM : 0.0);
	const wf::tactics::FPoint3 Eye{It.X, PlayerFeet + 1.6, It.Y};
	// a wounded trooper takes cover: real cover first (enemy-cover.ts findCover), else a retreat point (pickCover)
	if (bAlert && Ai.CoverTime <= 0 && wf::perception::ShouldTakeCover(Health / FMath::Max(1.0, MaxHealth), Ai.CoverTime, bBoss) && Distance < 45 && R.bDamaged)
	{
		if (const std::optional<wf::tactics::FCoverSpot> Real = wf::tactics::FindCover(Me.X, Me.Y, Eye, CoverCandidates(), CoverGround, CoverBlocked))
		{
			Ai.CoverX = Real->X; Ai.CoverZ = Real->Z; PeekX = Real->PeekX; PeekZ = Real->PeekZ; bRealCover = true;
			ProgressBest = 1e9; ProgressAt = Now;
			HideLeft = wf::tactics::HideSeconds; Ai.CoverTime = wf::tactics::CoverHold; Windup = -1;
		}
		else
		{
			const wf::perception::FPoint C = wf::perception::PickCover(Me.X, Me.Y, It.X, It.Y, SquadIndex % 2 ? 1 : -1);
			Ai.CoverX = C.X; Ai.CoverZ = C.Z; Ai.CoverTime = 3.5; bRealCover = false;
		}
	}
	Ai.CoverTime -= Dt;
	if (Ai.CoverTime <= 0) bRealCover = false;
	// the player walked round the cover: it no longer hides anything, break off and fight
	if (bRealCover && HideLeft > 0 && Windup < 0 && FVector::Dist2D(Me, FVector(Ai.CoverX, Ai.CoverZ, 0)) < 0.6
		&& !CoverBlocked(Eye, {Me.X, CoverGround(Me.X, Me.Y) + wf::tactics::CoverChest, Me.Y})) { Ai.CoverTime = 0; bRealCover = false; }

	auto MoveTo = [this, &Me](double X, double Z, float Pace) {
		const FVector Dir(X - Me.X, Z - Me.Y, 0);
		if (Dir.Size2D() > 0.01) { AddMovementInput(Dir.GetSafeNormal(), Pace); SetActorRotation(FRotator(0.f, Dir.Rotation().Yaw, 0.f)); }
	};
	const FVector Flat = FVector(ToPlayer.X, ToPlayer.Y, 0).GetSafeNormal();
	if (bAlert && Ai.CoverTime > 0 && bRealCover)
	{
		// fighting from real cover: run there, then hide, lean out to fire, duck back
		const bool bAtCover = FVector::Dist2D(Me, FVector(Ai.CoverX, Ai.CoverZ, 0)) < 1.5 || FVector::Dist2D(Me, FVector(PeekX, PeekZ, 0)) < 1.2;
		const std::string Phase = bAtCover ? wf::tactics::CoverPhase(HideLeft, Windup >= 0, RangedCooldown) : "RUN";
		const double Tx = Phase == "PEEK" ? PeekX : Ai.CoverX, Tz = Phase == "PEEK" ? PeekZ : Ai.CoverZ;
		const double Cd = FVector::Dist2D(Me, FVector(Tx, Tz, 0));
		// no pathing: a run that stops closing on the cover (an obstacle in the way) gives the cover up after 2 s
		if (Phase == "RUN" && MadeNoProgress(Cd, Now)) { Ai.CoverTime = 0; bRealCover = false; return; }
		if (Cd > 0.4) MoveTo(Tx, Tz, Phase == "RUN" ? 1.f : 0.8f);
		if (Phase != "RUN") SetActorRotation(FRotator(0.f, Flat.Rotation().Yaw, 0.f));
		if (Phase == "HIDE") { HideLeft = FMath::Max(0.0, HideLeft - Dt); RangedCooldown -= Dt; Windup = -1; }
		else if (Phase == "PEEK" && Cd < 0.6 && !bScripted)
		{
			const bool bWasAiming = Windup >= 0;
			TryAttack(Operator, Car, Distance, DeltaSeconds);
			if (bWasAiming && Windup < 0) HideLeft = wf::tactics::HideSeconds; // from cover: duck back after the shot
		}
		else if (Phase == "RUN") { RangedCooldown = FMath::Max(RangedCooldown, 0.4); Windup = -1; }
		return;
	}
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
		const int32 Index = SquadIndex;
		const std::string SquadRoleName = wf::tactics::SquadRole(Index, bElite, bBoss);
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
		if (!bFlanking && !bScripted && !bBoss && SquadRoleName != "LEADER" && HiddenFor >= wf::tactics::FlankAfter && Mode && Mode->CountFlankers() < wf::tactics::MaxFlankers)
		{
			UWorld* World = GetWorld();
			const AActor* Self = this;
			const auto Ground = [World](double X, double Z) {
				FHitResult G;
				const FVector At(X * CmPerM, Z * CmPerM, 0);
				return World->LineTraceSingleByObjectType(G, At + FVector(0, 0, 20000), At - FVector(0, 0, 50000), FCollisionObjectQueryParams(ECC_WorldStatic)) ? G.ImpactPoint.Z / CmPerM : 0.0;
			};
			const auto Blocked = [World, Self, Target](const wf::tactics::FPoint3& From, const wf::tactics::FPoint3& To) {
				FHitResult H;
				FCollisionQueryParams Q(SCENE_QUERY_STAT(WFFlank), false, Self);
				Q.AddIgnoredActor(Target);
				return World->LineTraceSingleByChannel(H, FVector(From.X, From.Z, From.Y) * CmPerM, FVector(To.X, To.Z, To.Y) * CmPerM, ECC_Visibility, Q);
			};
			if (const std::optional<wf::tactics::FPoint> Spot = wf::tactics::FindFlankSpot(Me.X, Me.Y, Eye, SquadIndex % 2 ? 1 : -1, Ground, Blocked))
			{
				bFlanking = true; Flank = *Spot; FlankUntil = Now + wf::tactics::FlankGiveUp;
				ProgressBest = 1e9; ProgressAt = Now;
			}
		}
		if (bFlanking && (Now > FlankUntil || bLosClear || FVector::Dist2D(Me, FVector(Flank.X, Flank.Z, 0)) < 1.5)) bFlanking = false;
		// no pathing: a flank that stops closing on its spot (blocked by the level) is given up after 2 s
		if (bFlanking && MadeNoProgress(FVector::Dist2D(Me, FVector(Flank.X, Flank.Z, 0)), Now)) bFlanking = false;
		if (bFlanking)
		{
			MoveTo(Flank.X, Flank.Z, 1.f); // running the flank, guns up (it ends the moment there is a line of fire)
			RangedCooldown -= Dt;
			return;
		}
		// squad role and threat drive positioning (enemy-intelligence.ts squadMove), not a straight chase
		const wf::tactics::FMove M = wf::tactics::SquadMove(SquadRoleName, Distance, Operator->GetHealth() / AWFCharacter::MaxHealth, Mode ? Mode->GetCombatHeat() : 0, Now + Index,
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

bool AWFEnemy::MadeNoProgress(double DistanceToGoal, double Now)
{
	if (DistanceToGoal < ProgressBest - 0.3) { ProgressBest = DistanceToGoal; ProgressAt = Now; return false; }
	return Now - ProgressAt > 2;
}

void AWFEnemy::TryAttack(AWFCharacter* Operator, AWFVehicle* Car, double Distance, float DeltaSeconds)
{
	// a hit on a driving Operator also wears the vehicle (Scene.tsx: impactVehicle by the hp lost + 2)
	auto Hurt = [Operator, Car, this](double Damage) {
		const double Before = Operator->GetHealth();
		// sim.ts: the hit records who landed it (a killing blow can promote it to a nemesis), a nemesis hits harder
		Operator->SetLastHitBy({WFData::ToStd(Profile), WFData::ToStd(Zone), bElite, bBoss, WFData::ToStd(NemesisId)});
		Operator->ApplyHit(Damage * NemesisDamage, Profile);
		if (Car && Operator->GetHealth() < Before) Car->TakeEnemyFire(Before - Operator->GetHealth());
	};
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
		// a car moves without a movement component; the Operator's speed and stance are in the web build's foot units
		const double Chance = wf::perception::EnemyHitChance(Distance, wf::perception::RangedRange, Car ? FMath::Abs(Car->GetState().Speed) : Operator->GetVelocity().Size2D() / CmPerM / AWFCharacter::FootRatio, Car ? std::string("STAND") : Operator->GetStance());
		if (!bBlocked && !bSpoofed && FMath::FRand() < Chance) Hurt(Tier(2, 4, 6) * PhaseDamageMult);
		return;
	}
	RangedCooldown -= DeltaSeconds;
	if (RangedCooldown <= 0) Windup = wf::perception::WindupFor(bBoss, bElite); // telegraph, then shoot
}

std::vector<wf::tactics::FCoverCandidate> AWFEnemy::CoverCandidates() const
{
	// chest-high, body-wide static geometry (rocks, wrecks, walls, crates) within the search radius; huge floors are not cover
	std::vector<wf::tactics::FCoverCandidate> Out;
	TArray<FOverlapResult> Hits;
	FCollisionQueryParams Q(SCENE_QUERY_STAT(WFCoverSearch), false, this);
	const float Radius = static_cast<float>((wf::tactics::CoverSearch + 6) * CmPerM);
	if (!GetWorld()->OverlapMultiByObjectType(Hits, GetActorLocation(), FQuat::Identity, FCollisionObjectQueryParams(ECC_WorldStatic), FCollisionShape::MakeSphere(Radius), Q)) return Out;
	TSet<TPair<const UPrimitiveComponent*, int32>> Seen;
	for (const FOverlapResult& H : Hits)
	{
		const UPrimitiveComponent* C = H.GetComponent();
		if (!C) continue;
		if (C->GetClass()->GetName().Contains(TEXT("Landscape"))) continue; // the terrain is ground, not cover
		const UInstancedStaticMeshComponent* Ism = Cast<UInstancedStaticMeshComponent>(C);
		const int32 Item = Ism ? H.ItemIndex : INDEX_NONE;
		if (Seen.Contains(TPair<const UPrimitiveComponent*, int32>(C, Item))) continue;
		Seen.Add(TPair<const UPrimitiveComponent*, int32>(C, Item));
		FBoxSphereBounds B = C->Bounds;
		if (Ism) // a cluster's bounds span every instance: use the instance that was hit
		{
			FTransform Xf;
			if (Item == INDEX_NONE || !Ism->GetStaticMesh() || !Ism->GetInstanceTransform(Item, Xf, true)) continue;
			B = Ism->GetStaticMesh()->GetBounds().TransformBy(Xf);
		}
		const double Half = FMath::Max(B.BoxExtent.X, B.BoxExtent.Y) / CmPerM;
		if (Half < 0.5 || Half > 12) continue; // a post, or the ground itself
		const double Top = (B.Origin.Z + B.BoxExtent.Z) / CmPerM;
		const double Floor = (B.Origin.Z - B.BoxExtent.Z) / CmPerM; // its own base
		if (Top - Floor < wf::tactics::CoverChest + 0.1) continue; // a kerb, not cover
		Out.push_back({B.Origin.X / CmPerM, B.Origin.Y / CmPerM, Half});
	}
	return Out;
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
	// weapon-meta.ts: the Operator's power against this enemy's (its region's difficulty), on every source of player damage
	if (Cast<AWFCharacter>(DamageInstigator))
		if (const UWFProgressionSubsystem* Prog = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>())
		{
			const AWFGameMode* PowerMode = GetWorld()->GetAuthGameMode<AWFGameMode>();
			// sim.ts machineDamageMods: the Ruin Surge (consumableDamageMult) first, then the power scale
			Damage *= Prog->GetBuffEffect().DamageMult * wf::hit::PowerScale(Prog->GetOperatorPower() - wf::hit::EnemyPower(PowerMode ? PowerMode->DifficultyOf(Zone) : 0, bElite, bBoss));
		}
	if (VulnUntil > Now) Damage *= VulnMult; // sim.ts applyMachineDamageMods: Weaken / Marked / Roar vulnerability
	if (!NemesisWeak.IsEmpty() && Element == NemesisWeak) Damage *= 2; // nemesis.ts: a scarred nemesis takes double from its weak element
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
	Info.Rival = RivalClass;
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
	if (!RivalClass.IsEmpty()) return; // sim.ts: a Killbox rival only scores the match (no kill hooks, loot or nemesis)
	if (!NemesisId.IsEmpty() && Mode) Mode->OnNemesisDown(NemesisId, !Info.bKilledByWorld); // sim.ts nemesisEvents
	if (Info.bKilledByWorld) return;
	// the Operator's kill hooks (runes, relic mastery, nanites) and the Furnace Guardian's Heart
	APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	AWFCharacter* Operator = Cast<AWFCharacter>(Pawn);
	if (const AWFVehicle* Car = Cast<AWFVehicle>(Pawn)) Operator = Car->GetDriver();
	if (Operator) Operator->OnEnemyKilled(this);
	if (Mode && ActivityTag == UTF8_TO_TCHAR(wf::godforge::GuardianTag.c_str())) Mode->OnGuardianSlain();
	if (Mode && ActivityTag.StartsWith(TEXT("worldboss:"))) Mode->OnWorldBossSlain(ActivityTag); // sim.ts livingKills (player credit)
}

void AWFEnemy::ApplyWeaponElement(const FString& Element)
{
	if (IsDead() || Element.IsEmpty() || Element == TEXT("KINETIC")) return;
	const double Now = GetWorld()->GetTimeSeconds();
	const wf::hit::FElementEffect Fx = wf::hit::ApplyElementHit(Statuses, WFData::ToStd(Element), Now, bBoss);
	if (Fx.Stun > 0) StunMachine(Fx.Stun);
	if (Fx.Vuln)
	{
		const wf::hit::FVuln V = wf::hit::MergeVuln({VulnMult, VulnUntil}, *Fx.Vuln, Now);
		VulnMult = V.Mult; VulnUntil = V.Until;
	}
}

bool AWFEnemy::IsChilled() const { return wf::hit::IsChilled(Statuses, GetWorld()->GetTimeSeconds()); }

void AWFEnemy::StunMachine(double Seconds)
{
	// m.cool: a boss's is its encounter stun (capped), a trooper's is its attack cooldown
	if (bBoss) StunLeft = FMath::Max(StunLeft, FMath::Min(Seconds, wf::hit::BossStunCap));
	else { RangedCooldown = FMath::Max(RangedCooldown, Seconds); MeleeCooldown = FMath::Max(MeleeCooldown, Seconds); }
}

void AWFEnemy::ReactToHit(double Damage, const FString& Part, double Dx, double Dz)
{
	if (bDecoy || IsDead()) return;
	const double Now = GetWorld()->GetTimeSeconds();
	const std::optional<wf::hit::FReaction> Prev = Reaction;
	Reaction = wf::hit::ReactTo(Reaction, Damage, MaxHealth > 0 ? MaxHealth : (bElite ? 7 : 3.5), bElite, bBoss, Now, Dx, Dz, WFData::ToStd(Part));
	const bool bChanged = Reaction.has_value() != Prev.has_value() || (Reaction && Prev && (Reaction->Start != Prev->Start || Reaction->Kind != Prev->Kind));
	if (bChanged && wf::hit::IsStaggeredNow(Reaction, Now))
	{
		if (Windup >= 0) Windup = FMath::Max(Windup, wf::perception::WindupFor(bBoss, bElite)); // the shot is delayed, the telegraph stays readable
		StunMachine(Reaction->Until - Now + 0.25);
	}
}

void AWFEnemy::TakeRawDamage(double Damage, AActor* DamageInstigator)
{
	if (IsDead() || Damage <= 0) return;
	Health -= Damage;
	if (Cast<AWFCharacter>(DamageInstigator)) SincePlayerHit = 0;
	if (Health <= 0)
	{
		if (bBoss && !bDecoy)
			if (const AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>())
			{
				BossRules.Hp = Health;
				const double Floor = wf::encounter::EncounterHpFloor(Mode->GetEncounterCatalog(), BossRules, GetWorld()->GetTimeSeconds());
				if (Floor > 0) { Health = Floor; return; }
			}
		Die();
	}
}
