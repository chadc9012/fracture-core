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
	InDriver->SetInVehicle(true);
	InDriver->SetActorHiddenInGame(true);
	InDriver->SetActorEnableCollision(false);
	InDriver->AttachToActor(this, FAttachmentTransformRules::KeepWorldTransform);
	PC->Possess(this);
	Notify(FString::Printf(TEXT("%s - W/S drive, A/D steer, Space handbrake, Shift boost%s, E exit"), *Def.Name, Profile->Mode == "AIR" ? TEXT(", C/Z climb") : Profile->Kind == "SUB" ? TEXT(", C/Z surface / dive") : TEXT("")), FLinearColor(0.45f, 0.9f, 1.f));
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
	if (!Driver.IsValid() || !World) return; // parked
	const double Dt = FMath::Min(static_cast<double>(DeltaSeconds), 0.1);
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
}
