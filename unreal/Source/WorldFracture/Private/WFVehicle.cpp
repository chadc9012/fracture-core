#include "WFVehicle.h"

#include "Engine/GameInstance.h"

#include "Camera/CameraComponent.h"
#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/LocalPlayer.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "WFCharacter.h"
#include "WFDataFiles.h"
#include "WFGameMode.h"
#include "WFHUD.h"
#include "WFProgressionSubsystem.h"
#include "WFRaceSubsystem.h"
#include "WFEnemy.h"
#include "WFWeapons.h"
#include "DrawDebugHelpers.h"
#include "EngineUtils.h"

#include <cmath>

namespace
{
	constexpr double VehCmPerM = 100.0;
}

namespace WFVehicles
{
	TArray<FWFVehicleDef> Load(FString& OutError)
	{
		TArray<FWFVehicleDef> Out;
		TArray<TSharedPtr<FJsonObject>> Rows;
		if (!WFData::LoadRows(TEXT("Vehicles"), Rows, OutError)) return Out;
		for (const TSharedPtr<FJsonObject>& Row : Rows)
		{
			FWFVehicleDef D;
			D.Id = WFData::Str(Row, TEXT("Id"));
			D.Name = WFData::Str(Row, TEXT("DisplayName"));
			D.Domain = WFData::Str(Row, TEXT("Domain"));
			D.Role = WFData::Str(Row, TEXT("Role"));
			D.Speed = WFData::Num(Row, TEXT("Speed"), 1);
			D.Hull = WFData::Num(Row, TEXT("Hull"), 1);
			D.Handling = WFData::Num(Row, TEXT("Handling"), 1);
			D.Ram = WFData::Num(Row, TEXT("Ram"), 1);
			D.CollisionRadius = WFData::Num(Row, TEXT("CollisionRadius"), 3);
			D.TerrainGrip = WFData::Num(Row, TEXT("TerrainGrip"), 1);
			D.Seats = static_cast<int32>(WFData::Num(Row, TEXT("Seats"), 1));
			bool bStarter = false;
			Row->TryGetBoolField(TEXT("Starter"), bStarter);
			D.bStarter = bStarter;
			Out.Add(D);
		}
		if (Out.IsEmpty()) OutError = TEXT("Vehicles.json has no rows");
		return Out;
	}

	const FWFVehicleDef* Find(const TArray<FWFVehicleDef>& Defs, const FString& Id)
	{
		return Defs.FindByPredicate([&Id](const FWFVehicleDef& D) { return D.Id == Id; });
	}
}

AWFVehicle::AWFVehicle()
{
	PrimaryActorTick.bCanEverTick = true;
	Box = CreateDefaultSubobject<UBoxComponent>(TEXT("Box"));
	Box->SetBoxExtent(FVector(300.f, 140.f, 80.f));
	Box->SetCollisionProfileName(TEXT("Pawn"));
	RootComponent = Box;

	Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
	Body->SetupAttachment(Box);
	Body->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	Arm = CreateDefaultSubobject<USpringArmComponent>(TEXT("Arm"));
	Arm->SetupAttachment(Box);
	Arm->bUsePawnControlRotation = false;
	Arm->bEnableCameraLag = true;
	Arm->CameraLagSpeed = 6.f;
	Arm->bEnableCameraRotationLag = true;
	Arm->CameraRotationLagSpeed = 5.f;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Arm);
	AutoPossessAI = EAutoPossessAI::Disabled;
}

void AWFVehicle::Configure(const FWFVehicleDef& InDef, const wf::vehicle::FCondition& InCondition)
{
	Def = InDef;
	Condition = InCondition;
	Profile = &wf::vehicle::HandlingFor(WFData::ToStd(Def.Id), WFData::ToStd(Def.Domain));
	Armament = wf::vweapons::ArmamentFor(WFData::ToStd(Def.Id), Profile->Kind); // no fleet builds in the prototype garage
	const float R = static_cast<float>(Def.CollisionRadius * VehCmPerM);
	Box->SetBoxExtent(FVector(R, R * 0.45f, 80.f));
	double Distance = 14, Height = 5;
	wf::vehicle::VehicleCamera(*Profile, Distance, Height); // vehicle-handling.ts vehicleCamera: aircraft high and far, boats low
	Arm->TargetArmLength = static_cast<float>(Distance * VehCmPerM);
	Arm->SocketOffset = FVector(0, 0, Height * VehCmPerM);
}

void AWFVehicle::BeginPlay()
{
	Super::BeginPlay();
	if (UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"))) Body->SetStaticMesh(Cube);
	const FVector Extent = Box->GetUnscaledBoxExtent();
	Body->SetRelativeScale3D(Extent / 50.f); // the cube is 100 cm
	if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")))
	{
		UMaterialInstanceDynamic* Paint = UMaterialInstanceDynamic::Create(Base, this);
		const bool bAir = Profile->Mode == "AIR", bWater = Profile->Mode == "WATER";
		Paint->SetVectorParameterValue(TEXT("Color"), bAir ? FLinearColor(0.25f, 0.3f, 0.38f) : bWater ? FLinearColor(0.15f, 0.3f, 0.32f) : FLinearColor(0.32f, 0.27f, 0.2f));
		Body->SetMaterial(0, Paint);
	}
	const FRotator R = GetActorRotation();
	State.Yaw = UE_DOUBLE_HALF_PI - FMath::DegreesToRadians(static_cast<double>(R.Yaw)); // rules yaw: forward (sin, cos) on (X, Y)
	State.Y = GetActorLocation().Z / VehCmPerM;
}

void AWFVehicle::Notify(const FString& Text, const FLinearColor& Color) const
{
	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
		if (AWFHUD* Hud = PC->GetHUD<AWFHUD>()) Hud->Toast(Text, Color);
}

void AWFVehicle::Enter(AWFCharacter* InDriver)
{
	APlayerController* PC = InDriver ? Cast<APlayerController>(InDriver->GetController()) : nullptr;
	if (!PC) return;
	Driver = InDriver;
	Gunner = InDriver;
	InDriver->SetInVehicle(true);
	InDriver->SetActorHiddenInGame(true);
	InDriver->SetActorEnableCollision(false);
	InDriver->AttachToActor(this, FAttachmentTransformRules::KeepWorldTransform);
	PC->Possess(this);
	Notify(FString::Printf(TEXT("%s - W/S drive, A/D steer, Space handbrake, Shift boost%s, E exit"), *Def.Name, Profile->Mode == "AIR" ? TEXT(", C/Z climb") : Profile->Kind == "SUB" ? TEXT(", C/Z surface / dive") : TEXT("")), FLinearColor(0.45f, 0.9f, 1.f));
	if (Armament.Primary || Armament.Secondary || Armament.SecondaryGun)
	{
		const FString Rmb = Armament.SecondaryGun ? WFData::ToF(Armament.SecondaryGun->Name) : Armament.Secondary ? WFData::ToF(Armament.Secondary->Name) : FString();
		Notify(FString::Printf(TEXT("LMB %s%s%s - mouse aims"), Armament.Primary ? *WFData::ToF(Armament.Primary->Name) : TEXT("-"), Rmb.IsEmpty() ? TEXT("") : TEXT("   RMB "), *Rmb), FLinearColor(1.f, 0.82f, 0.35f));
	}
}

void AWFVehicle::BuildInput()
{
	Mapping = NewObject<UInputMappingContext>(this);
	auto Make = [this](EInputActionValueType Type) { UInputAction* A = NewObject<UInputAction>(this); A->ValueType = Type; return A; };
	ThrottleAction = Make(EInputActionValueType::Boolean);
	BrakeAction = Make(EInputActionValueType::Boolean);
	SteerAction = Make(EInputActionValueType::Axis1D);
	AscendAction = Make(EInputActionValueType::Boolean);
	DescendAction = Make(EInputActionValueType::Boolean);
	HandbrakeAction = Make(EInputActionValueType::Boolean);
	BoostAction = Make(EInputActionValueType::Boolean);
	ExitAction = Make(EInputActionValueType::Boolean);
	FireAction = Make(EInputActionValueType::Boolean);
	SecondaryAction = Make(EInputActionValueType::Boolean);
	LookAction = Make(EInputActionValueType::Axis2D);
	Mapping->MapKey(ThrottleAction, EKeys::W);
	Mapping->MapKey(BrakeAction, EKeys::S);
	Mapping->MapKey(SteerAction, EKeys::A); // steer = left - right (vehicle-handling.ts)
	FEnhancedActionKeyMapping& Right = Mapping->MapKey(SteerAction, EKeys::D);
	Right.Modifiers.Add(NewObject<UInputModifierNegate>(this));
	Mapping->MapKey(AscendAction, EKeys::C);
	Mapping->MapKey(DescendAction, EKeys::Z);
	Mapping->MapKey(HandbrakeAction, EKeys::SpaceBar);
	Mapping->MapKey(BoostAction, EKeys::LeftShift);
	Mapping->MapKey(ExitAction, EKeys::E);
	Mapping->MapKey(FireAction, EKeys::LeftMouseButton);
	Mapping->MapKey(SecondaryAction, EKeys::RightMouseButton);
	Mapping->MapKey(LookAction, EKeys::Mouse2D);
}

void AWFVehicle::PawnClientRestart()
{
	if (!Mapping) BuildInput(); // once: the input component binds these same action objects on every possess
	Super::PawnClientRestart();
	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
		if (UEnhancedInputLocalPlayerSubsystem* Sub = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			Sub->ClearAllMappings();
			Sub->AddMappingContext(Mapping, 0);
		}
}

void AWFVehicle::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	if (!Mapping) BuildInput();
	UEnhancedInputComponent* In = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!In) return;
	auto Hold = [this, In](UInputAction* A, double wf::vehicle::FInput::*Field) {
		In->BindActionValueLambda(A, ETriggerEvent::Triggered, [this, Field](const FInputActionValue&) { Input.*Field = 1; });
		In->BindActionValueLambda(A, ETriggerEvent::Completed, [this, Field](const FInputActionValue&) { Input.*Field = 0; });
	};
	Hold(ThrottleAction, &wf::vehicle::FInput::Throttle);
	Hold(BrakeAction, &wf::vehicle::FInput::Brake);
	Hold(AscendAction, &wf::vehicle::FInput::Ascend);
	Hold(DescendAction, &wf::vehicle::FInput::Descend);
	In->BindActionValueLambda(SteerAction, ETriggerEvent::Triggered, [this](const FInputActionValue& V) { Input.Steer = FMath::Clamp(static_cast<double>(V.Get<float>()), -1.0, 1.0); });
	In->BindActionValueLambda(SteerAction, ETriggerEvent::Completed, [this](const FInputActionValue&) { Input.Steer = 0; });
	In->BindActionValueLambda(HandbrakeAction, ETriggerEvent::Triggered, [this](const FInputActionValue&) { Input.bHandbrake = true; });
	In->BindActionValueLambda(HandbrakeAction, ETriggerEvent::Completed, [this](const FInputActionValue&) { Input.bHandbrake = false; });
	In->BindActionValueLambda(BoostAction, ETriggerEvent::Triggered, [this](const FInputActionValue&) { Input.bBoost = true; });
	In->BindActionValueLambda(BoostAction, ETriggerEvent::Completed, [this](const FInputActionValue&) { Input.bBoost = false; });
	In->BindAction(ExitAction, ETriggerEvent::Started, this, &AWFVehicle::Exit);
	In->BindActionValueLambda(FireAction, ETriggerEvent::Triggered, [this](const FInputActionValue&) { bTrigger = true; });
	In->BindActionValueLambda(FireAction, ETriggerEvent::Completed, [this](const FInputActionValue&) { bTrigger = false; });
	In->BindActionValueLambda(SecondaryAction, ETriggerEvent::Triggered, [this](const FInputActionValue&) { bSecondaryTrigger = true; });
	In->BindActionValueLambda(SecondaryAction, ETriggerEvent::Completed, [this](const FInputActionValue&) { bSecondaryTrigger = false; });
	In->BindActionValueLambda(LookAction, ETriggerEvent::Triggered, [this](const FInputActionValue& V) {
		const FVector2D L = V.Get<FVector2D>();
		// rules yaw turns the other way from Unreal yaw: mouse right lowers it
		AimYaw = FMath::UnwindRadians(AimYaw - L.X * 0.0035);
		AimPitch = FMath::Clamp(AimPitch + L.Y * 0.0035, -0.6, 0.8);
	});
}

void AWFVehicle::Exit(const FInputActionValue& Value)
{
	AWFCharacter* D = Driver.Get();
	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!D || !PC) return;
	const bool bDeepWater = Profile->Mode == "WATER";
	const wf::vehicle::FExitCheck Check = wf::vehicle::CanExitVehicle(*Profile, State, bDeepWater && GetActorLocation().Z / VehCmPerM < WaterLevelMeters + 2);
	if (!Check.bOk) { Notify(WFData::ToF(Check.Reason), FLinearColor(1.f, 0.55f, 0.3f)); return; }
	Input = {};
	bTrigger = bSecondaryTrigger = false;
	D->DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
	D->SetActorLocation(GetActorLocation() - GetActorRightVector() * (Box->GetUnscaledBoxExtent().Y + 120.f) + FVector(0, 0, 60), false, nullptr, ETeleportType::TeleportPhysics);
	D->SetActorHiddenInGame(false);
	D->SetActorEnableCollision(true);
	D->SetInVehicle(false);
	PC->Possess(D);
	Driver.Reset();
	if (UWFProgressionSubsystem* P = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()) P->MutableGarage().Conditions[WFData::ToStd(Def.Id)] = Condition;
}

void AWFVehicle::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	UWorld* World = GetWorld();
	const double Dt = FMath::Min(static_cast<double>(DeltaSeconds), 0.1);
	if (World) TickProjectiles(Dt); // rounds already fired keep flying after the driver gets out
	if (wf::vweapons::CoolHeat(Heat, Dt)) Notify(TEXT("Weapon cooled - ready"), FLinearColor(0.45f, 0.9f, 1.f));
	if (!Driver.IsValid() || !World) return; // parked
	const FVector Loc = GetActorLocation();

	// ground under the vehicle
	FHitResult Ground;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(WFVehicleGround), false, this);
	Params.AddIgnoredActor(Driver.Get());
	const bool bGround = World->LineTraceSingleByChannel(Ground, Loc + FVector(0, 0, 3000), Loc - FVector(0, 0, 50000), ECC_Visibility, Params);
	const double FloorM = bGround ? Ground.ImpactPoint.Z / VehCmPerM : Loc.Z / VehCmPerM - wf::vehicle::RideHeight;
	const double Nz = bGround ? FMath::Max(0.05, static_cast<double>(Ground.ImpactNormal.Z)) : 1.0;
	const double Slope = FMath::Sqrt(FMath::Max(0.0, 1 - Nz * Nz)) / Nz;
	const double Water = WaterLevelMeters;

	const AWFGameMode* Mode = World->GetAuthGameMode<AWFGameMode>();
	const FString Region = Mode ? Mode->GetRegionId() : FString();
	const double BiomeGrip = Mode ? Mode->GetRegionSpeed() : 0.9;
	const wf::vehicle::FConditionEffects Fx = wf::vehicle::ConditionEffects(Condition);
	wf::vehicle::FEnv Env;
	Env.Grip = wf::vehicle::EnvGrip(wf::vehicle::SurfaceGrip(wf::vehicle::SurfaceAt(WFData::ToStd(Region), FloorM, Water), Slope), Fx, Def.Handling);
	Env.Slope = Slope;
	Env.Floor = FloorM;
	Env.Water = Water;
	Env.bOverWater = FloorM < Water - 0.3;
	// Scene.tsx raceSlow: a track obstacle hit costs top speed for a moment (racing.ts raceSpeedFactor)
	const UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	const double RaceSlow = Racing ? Racing->GetSpeedFactor() : 1.0;
	const double Top = wf::vehicle::TopSpeedFor(BiomeGrip, 1, Def.Speed, std::nullopt, Fx.Speed, RaceSlow);

	wf::vehicle::FInput In = Input;
	if (Fx.bDisabled) { In.Throttle = 0; In.bBoost = false; } // a wrecked engine stops it (vehicle-condition.ts disabled)
	const wf::vehicle::FStepResult R = wf::vehicle::StepVehicle(*Profile, State, In, Env, Top, Dt);
	State = R;
	if (R.bLanded && R.bHardLanding) { Condition = wf::vehicle::ImpactVehicle(Condition, 14); Notify(TEXT("Hard landing"), FLinearColor(1.f, 0.55f, 0.3f)); }
	if (R.bSkidding && World->GetTimeSeconds() - SkidNoticeAt > 4) SkidNoticeAt = World->GetTimeSeconds();

	// move: rules forward is (sin yaw, cos yaw) on (Unreal X, Unreal Y)
	const FVector Step(std::sin(State.Yaw) * State.Speed * Dt * VehCmPerM, std::cos(State.Yaw) * State.Speed * Dt * VehCmPerM, 0);
	FVector Next = Loc + Step;
	Next.Z = State.Y * VehCmPerM;
	if (Profile->Mode == "WATER")
	{
		FHitResult Ahead;
		const bool bAhead = World->LineTraceSingleByChannel(Ahead, Next + FVector(0, 0, 3000), Next - FVector(0, 0, 50000), ECC_Visibility, Params);
		if (bAhead && Ahead.ImpactPoint.Z / VehCmPerM > Water - 0.3) { Next = FVector(Loc.X, Loc.Y, Next.Z); State.Speed *= 0.2; } // never drives up the shore
	}
	FHitResult Hit;
	SetActorLocation(Next, true, &Hit, ETeleportType::None);
	if (Hit.bBlockingHit && FMath::Abs(State.Speed) > 3)
	{
		// a crash: most of the speed is lost and the vehicle wears (vehicle-condition.ts impactVehicle)
		const double Lost = FMath::Abs(State.Speed) * 0.7;
		State.Speed *= 0.3;
		Condition = wf::vehicle::ImpactVehicle(Condition, Lost);
		Notify(FString::Printf(TEXT("Impact - body %d%%  engine %d%%"), FMath::RoundToInt32(Condition.Body), FMath::RoundToInt32(Condition.Engine)), FLinearColor(1.f, 0.55f, 0.3f));
	}
	SetActorRotation(FRotator(static_cast<float>(FMath::RadiansToDegrees(State.Pitch)), static_cast<float>(90.0 - FMath::RadiansToDegrees(State.Yaw)), static_cast<float>(FMath::RadiansToDegrees(-State.Roll))));
	if (UWFProgressionSubsystem* P = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()) P->MutableGarage().Conditions[WFData::ToStd(Def.Id)] = Condition;
	Arm->SetRelativeRotation(FRotator(FMath::RadiansToDegrees(AimPitch), -FMath::RadiansToDegrees(AimYaw), 0.0)); // the camera looks where the turret aims
	TickWeapons(Dt);
}

// --- weapons (vehicle-weapons.ts, ordnance.ts, sim.ts fireBullet / fireOrdnance) ---------------------------------------

namespace
{
	/** rules metres (x, y up, z) to Unreal centimetres: rules (x, z) are Unreal (X, Y) */
	FVector VehToUe(const wf::vweapons::FVec& V) { return FVector(V.X * VehCmPerM, V.Z * VehCmPerM, V.Y * VehCmPerM); }
	wf::vweapons::FVec VehToRules(const FVector& V) { return {V.X / VehCmPerM, V.Z / VehCmPerM, V.Y / VehCmPerM}; }
}

double AWFVehicle::GroundMeters(double X, double Z, double FallbackM) const
{
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(WFVehicleRoundGround), false, this);
	if (Gunner.IsValid()) Params.AddIgnoredActor(Gunner.Get());
	const FVector At(X * VehCmPerM, Z * VehCmPerM, FallbackM * VehCmPerM);
	if (GetWorld()->LineTraceSingleByChannel(Hit, At + FVector(0, 0, 20000), At - FVector(0, 0, 50000), ECC_WorldStatic, Params)) return Hit.ImpactPoint.Z / VehCmPerM;
	return -1e9; // no ground below: never a ground burst
}

wf::vweapons::FPose AWFVehicle::WeaponPose() const
{
	// muzzle offsets are measured from the vehicle's ground-level origin (Scene.tsx pose y = eye - 1.9)
	const FVector L = GetActorLocation();
	return {L.X / VehCmPerM, L.Z / VehCmPerM - Box->GetUnscaledBoxExtent().Z / VehCmPerM, L.Y / VehCmPerM, State.Yaw, State.Pitch, State.Roll};
}

void AWFVehicle::TickWeapons(double Dt)
{
	using namespace wf::vweapons;
	const bool bBlocked = Heat.bOverheated || AreWeaponsDisabled(); // Scene.tsx: !sim.overheated && !weaponsDisabled
	const std::vector<FShot> Shots = StepFire(Armament, Fire, bTrigger, bSecondaryTrigger, Dt, 1.0, bBlocked);
	if (Shots.empty()) return;
	const FPose Pose = WeaponPose();
	const bool bAir = Profile->Mode == "AIR";
	const FVec Carry = VehicleVelocity(State.Yaw, State.Speed, bAir || Profile->Mode == "WATER" ? State.Vy : 0);
	const double CamYaw = State.Yaw + AimYaw, CamPitch = AimPitch;
	// lock candidates (sim.machines): live enemies, in rules metres
	std::vector<FCandidate> Cands;
	TArray<AWFEnemy*> Enemies;
	for (TActorIterator<AWFEnemy> It(GetWorld()); It; ++It)
	{
		const FVector P = It->GetActorLocation();
		Cands.push_back({P.X / VehCmPerM, P.Y / VehCmPerM, !It->IsDead()});
		Enemies.Add(*It);
	}
	auto Launch = [&](const FOrdnanceDef& D, const FVec& From, double Yaw, double Pitch, double Damage, double Knock) {
		if (Heat.bOverheated) return false; // fireOrdnance refuses while venting
		if (AddHeat(Heat, OrdnanceHeat(D))) Notify(TEXT("WEAPON OVERHEAT - venting"), FLinearColor(1.f, 0.3f, 0.25f));
		FLiveRound R;
		R.Round = LaunchOrdnance(D, From, Yaw, Pitch, Damage, FMath::Max(0.0, State.Speed), Knock, Cands);
		if (R.Round.Target >= 0) R.Target = Enemies[R.Round.Target];
		Rounds.Add(R);
		return true;
	};
	for (const FShot& Shot : Shots)
	{
		const FVec Muzzle = VehiclePoint(Pose, Shot.Muzzle);
		if (Shot.Slot == "ORDNANCE")
		{
			const FOrdnanceMount& Sec = *Armament.Secondary;
			const FOrdnanceDef* D = OrdnanceById(Sec.Ordnance);
			const FAim A = AimFor(Sec.Mount, Pose, CamYaw, CamPitch, 0.25, Muzzle, 0);
			if (D && Launch(*D, Muzzle, A.Yaw + (FMath::FRand() - 0.5) * 0.02, A.Pitch + (FMath::FRand() - 0.5) * 0.02, Sec.Damage * WFWeapons::BaseBulletDamage, 2))
				DrawDebugSphere(GetWorld(), VehToUe(Muzzle), 60.f, 8, FColor(255, 180, 80), false, 0.08f);
			continue;
		}
		const FGun& G = Shot.Slot == "PRIMARY" ? *Armament.Primary : *Armament.SecondaryGun;
		const FAim A = AimFor(G.Mount, Pose, CamYaw, CamPitch, G.PitchAssist, Muzzle, G.Converge);
		const double Jy = (FMath::FRand() - 0.5) * 2 * G.Spread, Jp = (FMath::FRand() - 0.5) * 2 * G.Spread;
		const double Dmg = G.Damage * WFWeapons::BaseBulletDamage;
		if (G.Shell) { Launch(CannonShell(G), Muzzle, A.Yaw + Jy, A.Pitch + Jp, Dmg, G.Knock); continue; } // a cannon shell is ordnance
		if (Heat.bOverheated) continue; // fireBullet refuses while venting
		if (AddHeat(Heat, BulletHeat(G.Heat))) Notify(TEXT("WEAPON OVERHEAT - venting"), FLinearColor(1.f, 0.3f, 0.25f));
		Bullets.Add(MakeBullet(Muzzle, A.Yaw + Jy, A.Pitch + Jp, G.Speed, Carry, Dmg, G.Knock));
	}
}

void AWFVehicle::TickProjectiles(double Dt)
{
	using namespace wf::vweapons;
	UWorld* World = GetWorld();
	FCollisionQueryParams Params(SCENE_QUERY_STAT(WFVehicleRounds), false, this);
	if (Gunner.IsValid()) Params.AddIgnoredActor(Gunner.Get());
	AActor* Shooter = Gunner.IsValid() ? static_cast<AActor*>(Gunner.Get()) : this;
	// bullets: straight lines at muzzle + inherited velocity, a reach of 1.4 s (more for fast guns)
	for (int32 I = Bullets.Num() - 1; I >= 0; --I)
	{
		FBullet& B = Bullets[I];
		const FVector From = VehToUe(B.Pos);
		B.Pos = {B.Pos.X + B.Vel.X * Dt, B.Pos.Y + B.Vel.Y * Dt, B.Pos.Z + B.Vel.Z * Dt};
		B.Life -= Dt;
		const FVector To = VehToUe(B.Pos);
		FHitResult Hit;
		if (World->LineTraceSingleByChannel(Hit, From, To, ECC_Visibility, Params))
		{
			if (AWFEnemy* Enemy = Cast<AWFEnemy>(Hit.GetActor())) Enemy->TakeHit(B.Damage, Shooter);
			DrawDebugLine(World, From, Hit.ImpactPoint, FColor(255, 220, 140), false, 0.f, 0, 3.f);
			Bullets.RemoveAtSwap(I);
			continue;
		}
		DrawDebugLine(World, From, To, FColor(255, 220, 140), false, 0.f, 0, 2.f);
		if (B.Life <= 0) Bullets.RemoveAtSwap(I);
	}
	// rockets, missiles, torpedoes and shells (ordnance.ts stepRound + sim.ts's body and machine proximity checks)
	for (int32 I = Rounds.Num() - 1; I >= 0; --I)
	{
		FLiveRound& L = Rounds[I];
		FRound& R = L.Round;
		std::optional<FVec> Target;
		if (const AWFEnemy* T = Cast<AWFEnemy>(L.Target.Get()))
			if (!T->IsDead()) { const FVec P = VehToRules(T->GetActorLocation()); Target = FVec{P.X, P.Y + 0.1, P.Z}; } // actor origin is mid-body (sim: feet + 1 m)
		const FVector From(R.X * VehCmPerM, R.Z * VehCmPerM, R.Y * VehCmPerM);
		std::optional<FBurst> Burst = StepRound(R, Dt, Target, [this, &R](double X, double Z) { return GroundMeters(X, Z, R.Y); });
		const FVector To(R.X * VehCmPerM, R.Z * VehCmPerM, R.Y * VehCmPerM);
		FHitResult Hit;
		if (!Burst && World->LineTraceSingleByChannel(Hit, From, To, ECC_Visibility, Params))
		{
			const FVec P = VehToRules(Hit.ImpactPoint);
			R.bAlive = false;
			Burst = FBurst{P.X, P.Y, P.Z, R.Def.SplashRadius, R.Def.Damage, "PROXIMITY"};
		}
		if (!Burst && R.bAlive && R.Y - GroundMeters(R.X, R.Z, R.Y) < 8)
			for (TActorIterator<AWFEnemy> It(World); It; ++It)
			{
				const FVector P = It->GetActorLocation() / VehCmPerM;
				if (!It->IsDead() && FMath::Sqrt(FMath::Square(P.X - R.X) + FMath::Square(P.Y - R.Z)) < 2.6) { R.bAlive = false; Burst = FBurst{R.X, R.Y, R.Z, R.Def.SplashRadius, R.Def.Damage, "PROXIMITY"}; break; }
			}
		DrawDebugLine(World, From, To, FColor(255, 140, 60), false, 0.f, 0, 6.f);
		if (Burst) { Detonate(*Burst); Rounds.RemoveAtSwap(I); }
		else if (!R.bAlive) Rounds.RemoveAtSwap(I);
	}
}

void AWFVehicle::Detonate(const wf::vweapons::FBurst& Burst)
{
	// sim.ts detonateRound: splash falls off linearly from the centre to the radius, measured to the body's edge (1.5 m)
	UWorld* World = GetWorld();
	AActor* Shooter = Gunner.IsValid() ? static_cast<AActor*>(Gunner.Get()) : this;
	TArray<AWFEnemy*> InRange;
	for (TActorIterator<AWFEnemy> It(World); It; ++It) if (!It->IsDead()) InRange.Add(*It);
	for (AWFEnemy* E : InRange)
	{
		const FVector P = E->GetActorLocation() / VehCmPerM;
		const double Planar = FMath::Sqrt(FMath::Square(P.X - Burst.X) + FMath::Square(P.Y - Burst.Z));
		const double Damage = wf::vweapons::SplashDamage(Burst, FMath::Max(0.0, Planar - 1.5));
		if (Damage > 0) E->TakeHit(Damage, Shooter);
	}
	DrawDebugSphere(World, FVector(Burst.X * VehCmPerM, Burst.Z * VehCmPerM, Burst.Y * VehCmPerM), static_cast<float>(Burst.Radius * VehCmPerM), 16, FColor(255, 120, 40), false, 0.4f, 0, 4.f);
}
