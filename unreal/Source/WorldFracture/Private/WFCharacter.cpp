#include "WFCharacter.h"

#include <algorithm>

#include "Engine/GameInstance.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "DrawDebugHelpers.h"
#include "EngineUtils.h"
#include <limits>
#include "Engine/LocalPlayer.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "WFEnemy.h"
#include "WFVehicle.h"
#include "WFGameMode.h"
#include "WFHUD.h"
#include "WFDataFiles.h"
#include "WFDragonSubsystem.h"
#include "WFProgressionSubsystem.h"
#include "WFQuestSubsystem.h"

namespace
{
	constexpr float WalkSpeed = 450.f;
	constexpr float SprintSpeed = 720.f;
	constexpr float WeaponRange = 20000.f; // 200 m
}

AWFCharacter::AWFCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	GetCapsuleComponent()->InitCapsuleSize(40.f, 92.5f); // 1.85 m Operator (operators.ts OPERATOR_HEIGHT)

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(GetCapsuleComponent());
	Camera->SetRelativeLocation(FVector(0.f, 0.f, 72.f));
	Camera->bUsePawnControlRotation = true;
	Camera->SetFieldOfView(90.f);

	// Stand-in gun until the authored weapon models are imported.
	GunMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Gun"));
	GunMesh->SetupAttachment(Camera);
	GunMesh->SetRelativeLocation(FVector(45.f, 18.f, -20.f));
	GunMesh->SetRelativeScale3D(FVector(0.45f, 0.06f, 0.08f));
	GunMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	GunMesh->CastShadow = false;

	MountMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mount"));
	MountMesh->SetupAttachment(GetCapsuleComponent());
	MountMesh->SetRelativeLocation(FVector(0.f, 0.f, -150.f));
	MountMesh->SetRelativeScale3D(FVector(6.f, 2.2f, 1.2f));
	MountMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	MountMesh->SetVisibility(false);

	GetCharacterMovement()->MaxWalkSpeed = WalkSpeed;
	GetCharacterMovement()->JumpZVelocity = 520.f;
	GetCharacterMovement()->AirControl = 0.35f;
	bUseControllerRotationYaw = true;
}

void AWFCharacter::BeginPlay()
{
	Super::BeginPlay();
	SpawnLocation = GetActorLocation();
	if (UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube")))
	{
		GunMesh->SetStaticMesh(Cube);
		MountMesh->SetStaticMesh(Cube);
	}

	FString Error;
	Weapons = WFWeapons::LoadGuns(Error);
	if (Weapons.IsEmpty()) UE_LOG(LogTemp, Error, TEXT("No weapons: %s"), *Error);
	for (const FWFWeaponStats& W : Weapons)
	{
		Ammo.Add(W.Mag);
		Reserve.Add(W.Reserve);
	}
	AddMappingContext();
	if (const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>())
	{
		const std::vector<std::string> Subs = wf::ability::SubclassesOf(WFData::ToStd(Progression->GetIdentityClass()));
		SubclassId = Subs.empty() ? FString() : WFData::ToF(Subs[0]);
		Live = wf::ability::CreateLiveBuild(SavedBuild(), Progression->Get().AbilityBranches);
	}
}

// --- Input, built in code -------------------------------------------------------------------------------------------

void AWFCharacter::BuildInput()
{
	if (Mapping) return;
	Mapping = NewObject<UInputMappingContext>(this);
	auto Make = [this](EInputActionValueType Type) {
		UInputAction* Action = NewObject<UInputAction>(this);
		Action->ValueType = Type;
		return Action;
	};
	MoveAction = Make(EInputActionValueType::Axis2D);
	LookAction = Make(EInputActionValueType::Axis2D);
	JumpAction = Make(EInputActionValueType::Boolean);
	FireAction = Make(EInputActionValueType::Boolean);
	AimAction = Make(EInputActionValueType::Boolean);
	SprintAction = Make(EInputActionValueType::Boolean);
	ReloadAction = Make(EInputActionValueType::Boolean);
	NextWeaponAction = Make(EInputActionValueType::Axis1D);
	SaveAction = Make(EInputActionValueType::Boolean);
	DevQuestAction = Make(EInputActionValueType::Boolean);
	ClassAction = Make(EInputActionValueType::Boolean);
	ScenarioAction = Make(EInputActionValueType::Boolean);
	WyrmAction = Make(EInputActionValueType::Boolean);
	InteractAction = Make(EInputActionValueType::Boolean);
	CallVehicleAction = Make(EInputActionValueType::Boolean);
	RideAction = Make(EInputActionValueType::Boolean);

	// WASD -> 2D move: W/S on Y (swizzled), A/D on X, negated where needed.
	auto MapMove = [this](const FKey& Key, bool bSwizzle, bool bNegate) {
		FEnhancedActionKeyMapping& M = Mapping->MapKey(MoveAction, Key);
		if (bSwizzle) M.Modifiers.Add(NewObject<UInputModifierSwizzleAxis>(this));
		if (bNegate) M.Modifiers.Add(NewObject<UInputModifierNegate>(this));
	};
	MapMove(EKeys::W, true, false);
	MapMove(EKeys::S, true, true);
	MapMove(EKeys::D, false, false);
	MapMove(EKeys::A, false, true);

	Mapping->MapKey(LookAction, EKeys::Mouse2D);
	Mapping->MapKey(JumpAction, EKeys::SpaceBar);
	Mapping->MapKey(JumpAction, EKeys::C);
	Mapping->MapKey(FireAction, EKeys::LeftMouseButton);
	Mapping->MapKey(AimAction, EKeys::RightMouseButton);
	Mapping->MapKey(SprintAction, EKeys::LeftShift);
	Mapping->MapKey(ReloadAction, EKeys::R);
	Mapping->MapKey(ReloadAction, EKeys::G);
	Mapping->MapKey(NextWeaponAction, EKeys::MouseWheelAxis);
	Mapping->MapKey(SaveAction, EKeys::F5);
	Mapping->MapKey(DevQuestAction, EKeys::F9);
	Mapping->MapKey(ClassAction, EKeys::F6);
	Mapping->MapKey(ScenarioAction, EKeys::F8);
	Mapping->MapKey(WyrmAction, EKeys::F7);
	Mapping->MapKey(InteractAction, EKeys::E);
	Mapping->MapKey(CallVehicleAction, EKeys::T);
	// the web build's default Dragonite keys (bindings.ts): 8 9 0 - = \ ;  in dragonite.ts order
	const FKey DragoniteKeys[7] = {EKeys::Eight, EKeys::Nine, EKeys::Zero, EKeys::Hyphen, EKeys::Equals, EKeys::Backslash, EKeys::Semicolon};
	for (const FKey& Key : DragoniteKeys)
	{
		UInputAction* A = Make(EInputActionValueType::Boolean);
		Mapping->MapKey(A, Key);
		DragoniteActions.Add(A);
	}
	Mapping->MapKey(RideAction, EKeys::V);
	// class abilities: the web build's Q / E / R, moved to Q / F / X here (E is the vehicle key, R reloads)
	const FKey AbilityKeys[3] = {EKeys::Q, EKeys::F, EKeys::X};
	for (const FKey& Key : AbilityKeys)
	{
		UInputAction* A = Make(EInputActionValueType::Boolean);
		Mapping->MapKey(A, Key);
		ClassAbilityActions.Add(A);
	}
	const FKey SlotKeys[] = {EKeys::One, EKeys::Two, EKeys::Three, EKeys::Four, EKeys::Five};
	for (const FKey& Key : SlotKeys)
	{
		UInputAction* Slot = Make(EInputActionValueType::Boolean);
		Mapping->MapKey(Slot, Key);
		SlotActions.Add(Slot);
	}
}

void AWFCharacter::AddMappingContext() const
{
	const APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC || !Mapping) return;
	if (UEnhancedInputLocalPlayerSubsystem* Input = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		if (!Input->HasMappingContext(Mapping)) Input->AddMappingContext(Mapping, 0);
}

void AWFCharacter::PawnClientRestart()
{
	if (!Mapping) BuildInput(); // once: the input component binds these same action objects on every possess
	Super::PawnClientRestart();
	AddMappingContext();
}

void AWFCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	if (!Mapping) BuildInput(); // the mapping context must hold the very actions bound below
	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!Input)
	{
		UE_LOG(LogTemp, Error, TEXT("World Fracture needs Enhanced Input (Config/DefaultInput.ini)."));
		return;
	}
	Input->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AWFCharacter::Move);
	Input->BindAction(LookAction, ETriggerEvent::Triggered, this, &AWFCharacter::Look);
	Input->BindAction(JumpAction, ETriggerEvent::Started, this, &ACharacter::Jump);
	Input->BindAction(JumpAction, ETriggerEvent::Completed, this, &ACharacter::StopJumping);
	Input->BindAction(FireAction, ETriggerEvent::Started, this, &AWFCharacter::FireStarted);
	Input->BindAction(FireAction, ETriggerEvent::Completed, this, &AWFCharacter::FireStopped);
	Input->BindAction(AimAction, ETriggerEvent::Started, this, &AWFCharacter::AimStarted);
	Input->BindAction(AimAction, ETriggerEvent::Completed, this, &AWFCharacter::AimStopped);
	Input->BindAction(SprintAction, ETriggerEvent::Started, this, &AWFCharacter::SprintStarted);
	Input->BindAction(SprintAction, ETriggerEvent::Completed, this, &AWFCharacter::SprintStopped);
	Input->BindAction(ReloadAction, ETriggerEvent::Started, this, &AWFCharacter::ReloadPressed);
	Input->BindAction(NextWeaponAction, ETriggerEvent::Triggered, this, &AWFCharacter::NextWeapon);
	Input->BindAction(SaveAction, ETriggerEvent::Started, this, &AWFCharacter::SaveGamePressed);
	Input->BindAction(DevQuestAction, ETriggerEvent::Started, this, &AWFCharacter::DevFinishQuest);
	Input->BindAction(ClassAction, ETriggerEvent::Started, this, &AWFCharacter::CycleClass);
	Input->BindAction(ScenarioAction, ETriggerEvent::Started, this, &AWFCharacter::SummonScenario);
	Input->BindActionValueLambda(WyrmAction, ETriggerEvent::Started, [this](const FInputActionValue&) { CastAbility(TEXT("wyrmcall")); });
	Input->BindAction(InteractAction, ETriggerEvent::Started, this, &AWFCharacter::Interact);
	Input->BindAction(CallVehicleAction, ETriggerEvent::Started, this, &AWFCharacter::CallVehicle);
	for (int32 I = 0; I < DragoniteActions.Num(); ++I)
	{
		const FString Id = UTF8_TO_TCHAR(wf::dragon::AbilityIds[I]);
		Input->BindActionValueLambda(DragoniteActions[I], ETriggerEvent::Started, [this, Id](const FInputActionValue&) { CastAbility(Id); });
	}
	Input->BindAction(RideAction, ETriggerEvent::Started, this, &AWFCharacter::ToggleRide);
	for (int32 I = 0; I < ClassAbilityActions.Num(); ++I)
		Input->BindActionValueLambda(ClassAbilityActions[I], ETriggerEvent::Started, [this, I](const FInputActionValue&) { CastClassAbility(wf::ability::Slots[I]); });
	for (int32 I = 0; I < SlotActions.Num(); ++I)
		Input->BindActionValueLambda(SlotActions[I], ETriggerEvent::Started, [this, I](const FInputActionValue&) { SelectWeapon(I); });
}

void AWFCharacter::Move(const FInputActionValue& Value)
{
	const FVector2D Axis = Value.Get<FVector2D>();
	if (bRiding) { RideInput = Axis; return; } // the flight model steers while mounted
	const FRotator Yaw(0.f, GetControlRotation().Yaw, 0.f);
	AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::X), static_cast<float>(Axis.Y));
	AddMovementInput(FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y), static_cast<float>(Axis.X));
}

void AWFCharacter::Look(const FInputActionValue& Value)
{
	const FVector2D Axis = Value.Get<FVector2D>();
	AddControllerYawInput(static_cast<float>(Axis.X));
	AddControllerPitchInput(static_cast<float>(-Axis.Y));
}

void AWFCharacter::SprintStarted(const FInputActionValue& Value) { bSprinting = true; }
void AWFCharacter::SprintStopped(const FInputActionValue& Value) { bSprinting = false; }

void AWFCharacter::NextWeapon(const FInputActionValue& Value)
{
	if (Weapons.IsEmpty()) return;
	const float Step = Value.Get<float>();
	if (FMath::IsNearlyZero(Step)) return;
	SelectWeapon((WeaponIndex + (Step > 0 ? 1 : Weapons.Num() - 1)) % Weapons.Num());
}

void AWFCharacter::SelectWeapon(int32 Index)
{
	if (!Weapons.IsValidIndex(Index) || Index == WeaponIndex) return;
	WeaponIndex = Index;
	ReloadLeft = 0;
	BurstLeft = 0;
	Cooldown = FMath::Max(Cooldown, 0.25); // swap time
}

void AWFCharacter::SaveGamePressed(const FInputActionValue& Value)
{
	if (UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>())
		UE_LOG(LogTemp, Log, TEXT("Save %s"), Progression->SaveGame() ? TEXT("written") : TEXT("FAILED"));
}

void AWFCharacter::DevFinishQuest(const FInputActionValue& Value)
{
	if (UWFQuestSubsystem* Quests = GetGameInstance()->GetSubsystem<UWFQuestSubsystem>()) Quests->DevFinishActiveQuest();
}

void AWFCharacter::CycleClass(const FInputActionValue& Value)
{
	UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Progression) return;
	const FString Current = Progression->GetIdentityClass();
	const FString Next = Current == TEXT("TITAN") ? TEXT("HUNTER") : Current == TEXT("HUNTER") ? TEXT("WARLOCK") : TEXT("TITAN");
	Progression->SetIdentityClass(Next);
	const std::vector<std::string> Subs = wf::ability::SubclassesOf(WFData::ToStd(Next));
	SubclassId = Subs.empty() ? FString() : WFData::ToF(Subs[0]); // a new class deploys as its first subclass
	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
		if (AWFHUD* Hud = PC->GetHUD<AWFHUD>()) Hud->Toast(FString::Printf(TEXT("Operator class - %s"), *Next), FLinearColor(0.45f, 0.9f, 1.f));
}

void AWFCharacter::SummonScenario(const FInputActionValue& Value)
{
	AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>();
	const FString Id = Mode ? Mode->SummonNextScenario() : FString();
	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
		if (AWFHUD* Hud = PC->GetHUD<AWFHUD>()) Hud->Toast(Id.IsEmpty() ? TEXT("No Unique Scenario to summon") : FString::Printf(TEXT("Unique Scenario summoned - %s"), *Id), FLinearColor(1.f, 0.55f, 0.3f));
}

// --- Dragon: Wyrmcall and riding -------------------------------------------------------------------------------------

namespace
{
	constexpr double CmPerMeter = 100.0;
}

void AWFCharacter::Notify(const FString& Text, const FLinearColor& Color) const
{
	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
		if (AWFHUD* Hud = PC->GetHUD<AWFHUD>()) Hud->Toast(Text, Color);
}

namespace
{
	/** The world as dragonite-cast.ts sees it: every live enemy, by slot. Hits go through the enemy's own damage rules. */
	class FDragonWorld final : public wf::dragoncast::IWorld
	{
	public:
		TArray<AWFEnemy*> Enemies;
		AWFCharacter* Player = nullptr;
		TArray<FString> Alerts;
		double DamageMods(std::vector<wf::dragoncast::FMachine>& Machines, size_t I, double Dmg, const std::string& Element, double X, double Z) override
		{
			(void)Machines; (void)X; (void)Z;
			return Enemies[static_cast<int32>(I)]->TakeHit(Dmg, Player, WFData::ToF(Element)); // applies it; a kill pays as the player's
		}
		void Defeat(std::vector<wf::dragoncast::FMachine>& Machines, size_t I) override
		{
			const AWFEnemy* E = Enemies[static_cast<int32>(I)];
			Machines[I].bAlive = !E->IsDead(); // the enemy already died (or held an encounter hp floor) in TakeHit
			Machines[I].Hp = E->GetHealth();
		}
		void Alert(const std::string& Text) override { Alerts.Add(WFData::ToF(Text)); }

		std::vector<wf::dragoncast::FMachine> Gather(UWorld* World)
		{
			std::vector<wf::dragoncast::FMachine> Out;
			for (TActorIterator<AWFEnemy> It(World); It; ++It)
			{
				if (It->IsDead()) continue;
				const FVector L = It->GetActorLocation() / CmPerMeter;
				wf::dragoncast::FMachine M;
				M.X = L.X; M.Z = L.Y; M.Hp = It->GetHealth(); M.bBoss = It->IsBoss(); M.Aim = It->GetAim();
				M.Cool = It->GetStun(); M.VulnUntil = It->GetVulnUntil(); M.VulnMult = It->GetVulnMult();
				Enemies.Add(*It);
				Out.push_back(M);
			}
			return Out;
		}

		/** Knockback, cancelled wind-ups, stuns and vulnerability back onto the enemies. */
		void WriteBack(const std::vector<wf::dragoncast::FMachine>& Before, const std::vector<wf::dragoncast::FMachine>& After)
		{
			for (int32 I = 0; I < Enemies.Num(); ++I)
			{
				AWFEnemy* E = Enemies[I];
				const auto& B = Before[static_cast<size_t>(I)];
				const auto& A = After[static_cast<size_t>(I)];
				if (!IsValid(E) || E->IsDead()) continue;
				if (FMath::Abs(A.X - B.X) + FMath::Abs(A.Z - B.Z) > 0.001) E->MoveToGround(A.X, A.Z);
				if (B.Aim > 0 && A.Aim <= 0) E->CancelWindup();
				if (A.Cool != B.Cool) E->SetStun(A.Cool);
				if (A.VulnUntil != B.VulnUntil || A.VulnMult != B.VulnMult) E->SetVulnerable(A.VulnUntil, A.VulnMult);
			}
		}
	};

	/** Rules yaw: forward is (sin yaw, cos yaw) on the (Unreal X, Unreal Y) plane, so yaw = 90 degrees - Unreal yaw. */
	double RulesYaw(float UnrealYawDegrees) { return UE_DOUBLE_HALF_PI - FMath::DegreesToRadians(static_cast<double>(UnrealYawDegrees)); }
}

void AWFCharacter::CastAbility(const FString& Ability)
{
	UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>();
	if (!Dragon) return;
	FDragonWorld World;
	World.Player = this;
	std::vector<wf::dragoncast::FMachine> Machines = World.Gather(GetWorld());
	const std::vector<wf::dragoncast::FMachine> Before = Machines;
	const FVector L = GetActorLocation() / CmPerMeter;
	const bool bGrounded = !GetCharacterMovement()->IsFalling();
	const wf::dragoncast::FCastOutcome R = wf::dragoncast::CastDragonite(Dragon->Runtime(), World, Machines, Dragon->EnergyPool(), WFData::ToStd(Ability),
		wf::dragoncast::FPose{L.X, L.Y, RulesYaw(GetControlRotation().Yaw)}, bGrounded, Dragon->MakeContext(), GetWorld()->GetTimeSeconds());
	World.WriteBack(Before, Machines);
	if (R.bOk)
	{
		if (R.LaunchVy) LaunchCharacter(FVector(0, 0, *R.LaunchVy * CmPerMeter), false, true); // Wyrmwing launch
		else if (Ability == TEXT("wyrmwing")) LaunchCharacter(GetActorForwardVector() * 18 * CmPerMeter, true, false); // air dash
	}
	const FLinearColor Violet(0.7f, 0.4f, 1.f), WarnColor(1.f, 0.55f, 0.3f);
	if (!World.Alerts.IsEmpty()) for (const FString& A : World.Alerts) Notify(A, Violet);
	else Notify(WFData::ToF(R.Text), R.bOk ? Violet : WarnColor);
}

void AWFCharacter::TickDragon(float DeltaSeconds)
{
	UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>();
	if (!Dragon) return;
	FDragonWorld World;
	World.Player = this;
	std::vector<wf::dragoncast::FMachine> Machines = World.Gather(GetWorld());
	const std::vector<wf::dragoncast::FMachine> Before = Machines;
	const FVector L = GetActorLocation() / CmPerMeter;
	const wf::dragoncast::FStepResult R = wf::dragoncast::StepDragonite(Dragon->Runtime(), World, Machines, DeltaSeconds, wf::dragoncast::FPose{L.X, L.Y, 0}, Dragon->MakeContext());
	World.WriteBack(Before, Machines);
	// energy refills in TickAbilities (live-build.ts tickLiveBuild): one pool for class and Dragonite abilities
	DragonhideResist = R.Resist;
	// Wyrmwing glide: a slow, controlled descent while it lasts (the web build's gliding flag)
	if (R.bGliding && GetCharacterMovement()->IsFalling() && GetCharacterMovement()->Velocity.Z < -GlideSinkCmPerSec)
		GetCharacterMovement()->Velocity.Z = -GlideSinkCmPerSec;
	for (const FString& A : World.Alerts) Notify(A, FLinearColor(0.7f, 0.4f, 1.f));
}

void AWFCharacter::ToggleRide(const FInputActionValue& Value)
{
	if (bRiding)
	{
		bRiding = false;
		MountMesh->SetVisibility(false);
		GetCharacterMovement()->SetMovementMode(MOVE_Falling);
		Notify(TEXT("Dismounted"), FLinearColor(0.7f, 0.4f, 1.f));
		return;
	}
	UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>();
	const AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>();
	FString Reason;
	if (!Dragon || !Dragon->CanRide(Mode ? Mode->GetRegionId() : FString(), false, false, false, Reason))
	{
		Notify(Reason.IsEmpty() ? TEXT("Vyrak cannot carry you here") : Reason, FLinearColor(1.f, 0.55f, 0.3f));
		return;
	}
	// flight space is metres with y up; Unreal (X, Y, Z) = flight (z, x, y), so flight yaw is Unreal yaw in radians
	const FVector L = GetActorLocation() / CmPerMeter;
	Flight = wf::dragon::CreateFlight(L.Y, L.Z + 6, L.X, FMath::DegreesToRadians(GetControlRotation().Yaw));
	bRiding = true;
	RideInput = FVector2D::ZeroVector;
	MountMesh->SetVisibility(true);
	GetCharacterMovement()->SetMovementMode(MOVE_Flying);
	GetCharacterMovement()->Velocity = FVector::ZeroVector;
	Notify(TEXT("VYRAK - riding (W/S throttle, A/D turn, mouse pitch, V dismount)"), FLinearColor(0.7f, 0.4f, 1.f));
}

void AWFCharacter::TickRide(float DeltaSeconds)
{
	UWorld* World = GetWorld();
	// the camera's pitch is the climb/dive command; up to 45 degrees is full input
	const float CamPitch = FRotator::NormalizeAxis(GetControlRotation().Pitch);
	const double PitchIn = FMath::Clamp(CamPitch / 45.0, -1.0, 1.0);
	auto GroundAt = [World, this](double FX, double FZ) {
		FHitResult Hit;
		const FVector At(FZ * CmPerMeter, FX * CmPerMeter, 0);
		FCollisionQueryParams Params(SCENE_QUERY_STAT(WFRideGround), false, this);
		if (World && World->LineTraceSingleByChannel(Hit, At + FVector(0, 0, 100000), At - FVector(0, 0, 100000), ECC_Visibility, Params)) return Hit.ImpactPoint.Z / CmPerMeter;
		return std::numeric_limits<double>::quiet_NaN();
	};
	Flight = wf::dragon::StepFlight(Flight, PitchIn, RideInput.X, RideInput.Y, DeltaSeconds, GroundAt);
	RideInput = FVector2D::ZeroVector;
	SetActorLocation(FVector(Flight.Z, Flight.X, Flight.Y) * CmPerMeter, false, nullptr, ETeleportType::TeleportPhysics);
	if (AController* C = GetController())
	{
		FRotator R = C->GetControlRotation();
		R.Yaw = static_cast<float>(FMath::RadiansToDegrees(Flight.Yaw));
		C->SetControlRotation(R);
	}
	MountMesh->SetRelativeRotation(FRotator(0.f, 0.f, static_cast<float>(FMath::RadiansToDegrees(Flight.Bank)) * -1.f));
}

// --- Vehicles ---------------------------------------------------------------------------------------------------------

namespace
{
	const TArray<FWFVehicleDef>& VehicleDefs()
	{
		static TArray<FWFVehicleDef> Defs;
		if (Defs.IsEmpty())
		{
			FString Error;
			Defs = WFVehicles::Load(Error);
			if (Defs.IsEmpty()) UE_LOG(LogTemp, Error, TEXT("No vehicles: %s"), *Error);
		}
		return Defs;
	}
}

AWFVehicle* AWFCharacter::SpawnVehicleAhead(const FString& VehicleId)
{
	const FWFVehicleDef* Def = WFVehicles::Find(VehicleDefs(), VehicleId);
	if (!Def) { Notify(FString::Printf(TEXT("Unknown vehicle %s"), *VehicleId), FLinearColor(1.f, 0.55f, 0.3f)); return nullptr; }
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	wf::vehicle::FCondition Condition;
	if (Progression)
		if (const auto Found = Progression->GetGarage().Conditions.find(WFData::ToStd(VehicleId)); Found != Progression->GetGarage().Conditions.end()) Condition = Found->second;
	const FRotator Yaw(0.f, GetControlRotation().Yaw, 0.f);
	const FVector Around = GetActorLocation() + Yaw.Vector() * static_cast<float>((Def->CollisionRadius + 5) * CmPerMeter);
	FHitResult Ground;
	const FVector At = GetWorld()->LineTraceSingleByChannel(Ground, Around + FVector(0, 0, 5000), Around - FVector(0, 0, 20000), ECC_Visibility)
		? Ground.ImpactPoint + FVector(0, 0, wf::vehicle::RideHeight * CmPerMeter) : Around;
	const FTransform Spawn(Yaw, At);
	AWFVehicle* V = GetWorld()->SpawnActorDeferred<AWFVehicle>(AWFVehicle::StaticClass(), Spawn, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn);
	if (!V) return nullptr;
	V->Configure(*Def, Condition);
	V->FinishSpawning(Spawn);
	Notify(FString::Printf(TEXT("%s delivered - press E to get in"), *Def->Name), FLinearColor(0.45f, 0.9f, 1.f));
	return V;
}

void AWFCharacter::CallVehicle(const FInputActionValue& Value)
{
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Progression || !Progression->GetGarage().Selected)
	{
		Notify(TEXT("No vehicle yet - choose one: ChooseStarterVehicle scrap-interceptor | wasteland-jeep (console ~)"), FLinearColor(1.f, 0.55f, 0.3f));
		return;
	}
	if (CalledVehicle.IsValid()) CalledVehicle->Destroy(); // one called vehicle at a time
	CalledVehicle = SpawnVehicleAhead(WFData::ToF(*Progression->GetGarage().Selected));
}

void AWFCharacter::Interact(const FInputActionValue& Value)
{
	AWFVehicle* Best = nullptr;
	double BestDist = 1e18;
	for (TActorIterator<AWFVehicle> It(GetWorld()); It; ++It)
	{
		const double D = FVector::Dist2D(It->GetActorLocation(), GetActorLocation()) / CmPerMeter;
		if (D < It->GetDef().CollisionRadius + 4 && D < BestDist) { BestDist = D; Best = *It; }
	}
	if (Best) Best->Enter(this);
}

void AWFCharacter::ChooseStarterVehicle(const FString& VehicleId)
{
	UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	const FWFVehicleDef* Def = WFVehicles::Find(VehicleDefs(), VehicleId);
	if (!Progression || !Def || !Def->bStarter) { Notify(TEXT("Choose a starter: scrap-interceptor or wasteland-jeep"), FLinearColor(1.f, 0.55f, 0.3f)); return; }
	if (!Progression->GetGarage().Owned.empty()) { Notify(TEXT("Your first vehicle is already chosen"), FLinearColor(1.f, 0.55f, 0.3f)); return; }
	Progression->RewardVehicle(VehicleId);
	Notify(FString::Printf(TEXT("%s is yours - press T to call it"), *Def->Name), FLinearColor(1.f, 0.82f, 0.35f));
}

void AWFCharacter::SpawnVehicle(const FString& VehicleId) { SpawnVehicleAhead(VehicleId); }

void AWFCharacter::RepairVehicle()
{
	UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Progression || !Progression->GetGarage().Selected) return;
	Notify(Progression->RepairVehicle(WFData::ToF(*Progression->GetGarage().Selected)), FLinearColor(0.45f, 0.9f, 1.f));
}

void AWFCharacter::SetInVehicle(bool bIn)
{
	bInVehicle = bIn;
	bFireHeld = false;
	bAiming = false;
	bSprinting = false;
	if (bIn) GetCharacterMovement()->DisableMovement();
	else GetCharacterMovement()->SetMovementMode(MOVE_Walking);
}

void AWFCharacter::UpgradeDragonite(const FString& Ability)
{
	if (UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>())
	{
		const FString Error = Dragon->UpgradeAbility(Ability);
		Notify(Error.IsEmpty() ? FString::Printf(TEXT("%s upgraded to %d"), *Ability, Dragon->GetUpgradeLevel(Ability)) : Error, Error.IsEmpty() ? FLinearColor(0.7f, 0.4f, 1.f) : FLinearColor(1.f, 0.55f, 0.3f));
	}
}

void AWFCharacter::VyrakTrust(const FString& Kind, const FString& SourceId)
{
	if (UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>())
	{
		Dragon->RecordTrust(Kind, SourceId);
		Notify(FString::Printf(TEXT("Vyrak trust %d / 100 - %s"), FMath::RoundToInt32(Dragon->GetTrust()), *Dragon->GetTrustStageName()), FLinearColor(0.7f, 0.4f, 1.f));
	}
}

void AWFCharacter::AncientBond()
{
	if (UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>())
	{
		FString Reason;
		const bool bOk = Dragon->ClaimAncientBond(Reason);
		Notify(bOk ? TEXT("THE ANCIENT BOND - Vyrak will carry you (V)") : Reason, bOk ? FLinearColor(1.f, 0.82f, 0.35f) : FLinearColor(1.f, 0.55f, 0.3f));
	}
}

void AWFCharacter::EternalCovenant()
{
	if (UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>())
	{
		const bool bOk = Dragon->ClaimEternalCovenant();
		Notify(bOk ? TEXT("THE ETERNAL COVENANT") : TEXT("Needs the Ancient Bond and all three Vyrak challenges"), bOk ? FLinearColor(1.f, 0.82f, 0.35f) : FLinearColor(1.f, 0.55f, 0.3f));
	}
}

// --- Weapons ------------------------------------------------------------------------------------------------------------

void AWFCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	TickAbilities(DeltaSeconds); // cooldowns, energy, turrets and zones keep running while driving
	if (bInVehicle) return; // carried by a vehicle: hidden, not simulating
	TickWeapon(DeltaSeconds);
	TickDragon(DeltaSeconds);
	if (bRiding) TickRide(DeltaSeconds);
	else // Scene.tsx walk speed: Rift Dash x1.4, Siege Mode x0.8 (operator-abilities.ts siegeMoveMult)
		GetCharacterMovement()->MaxWalkSpeed = static_cast<float>((bSprinting ? SprintSpeed : WalkSpeed) * HazardSpeedMult * (Live.DashTime > 0 ? 1.4 : 1.0) * wf::ability::SiegeMoveMult(Live.SiegeTime));

	// health.ts stepHealth: after RegenDelay seconds without damage, recover RegenRate per second.
	SinceDamage += DeltaSeconds;
	if (Health > 0 && Health < MaxHealth && SinceDamage >= RegenDelay) Health = FMath::Min(MaxHealth, Health + RegenRate * DeltaSeconds);
	if (GetActorLocation().Z < -50000.f) Respawn(); // fell out of the world
}

void AWFCharacter::TickWeapon(float DeltaSeconds)
{
	const FWFWeaponStats* W = GetWeapon();
	if (!W) return;
	Cooldown = FMath::Max(0.0, Cooldown - DeltaSeconds);

	if (ReloadLeft > 0)
	{
		ReloadLeft -= DeltaSeconds;
		if (ReloadLeft <= 0)
		{
			const int32 Take = FMath::Min(W->Mag - Ammo[WeaponIndex], Reserve[WeaponIndex]);
			Ammo[WeaponIndex] += Take;
			Reserve[WeaponIndex] -= Take;
			ReloadLeft = 0;
		}
		return;
	}

	if (BurstLeft > 0)
	{
		BurstTimer -= DeltaSeconds;
		if (BurstTimer <= 0 && Ammo[WeaponIndex] > 0)
		{
			FireRound();
			--BurstLeft;
			BurstTimer = W->BurstGap;
		}
		if (Ammo[WeaponIndex] <= 0) BurstLeft = 0;
		return;
	}

	if (Ammo[WeaponIndex] <= 0)
	{
		StartReload(); // the web build reloads an empty magazine on its own
		return;
	}
	if (bFireHeld && Cooldown <= 0)
	{
		Cooldown = W->FireRate;
		FireRound();
		BurstLeft = W->Burst - 1;
		BurstTimer = W->BurstGap;
		if (W->Id == TEXT("SIDEARM") || W->Id == TEXT("SHOTGUN") || W->Id == TEXT("HEAVY")) bFireHeld = false; // semi-automatic
	}
}

void AWFCharacter::FireRound()
{
	const FWFWeaponStats* W = GetWeapon();
	UWorld* World = GetWorld();
	if (!W || !World || Ammo[WeaponIndex] <= 0) return;
	--Ammo[WeaponIndex];

	const FVector Start = Camera->GetComponentLocation();
	const FVector Aim = GetControlRotation().Vector();
	const double Spread = W->Spread * (bAiming ? W->AdsSpread : 1.0);
	FCollisionQueryParams Params(SCENE_QUERY_STAT(WFWeapon), false, this);

	for (int32 P = 0; P < W->Pellets; ++P)
	{
		const FVector Dir = FMath::VRandCone(Aim, static_cast<float>(Spread));
		const FVector End = Start + Dir * WeaponRange;
		FHitResult Hit;
		const bool bHit = World->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);
		DrawDebugLine(World, Start + Dir * 60.f, bHit ? Hit.ImpactPoint : End, FColor(255, 214, 120), false, 0.05f, 0, 1.2f);
		if (bHit)
			if (AWFEnemy* Enemy = Cast<AWFEnemy>(Hit.GetActor())) Enemy->TakeHit(W->Damage * WFWeapons::BaseBulletDamage * SimMods.VerbDamageMult, this, W->Element); // Rage / Siege (syncSimFromLive)
	}
	if (Live.VeilTime > wf::ability::VeilBreakTime) Live.VeilTime = wf::ability::VeilBreakTime; // firing breaks Phase Veil

	// recoil: pitch kick in radians (weapons.ts), applied to the view
	if (AController* C = GetController())
	{
		FRotator R = C->GetControlRotation();
		R.Pitch += static_cast<float>(FMath::RadiansToDegrees(W->Recoil));
		C->SetControlRotation(R);
	}
}

void AWFCharacter::StartReload()
{
	const FWFWeaponStats* W = GetWeapon();
	if (!W || ReloadLeft > 0 || Ammo[WeaponIndex] >= W->Mag || Reserve[WeaponIndex] <= 0) return;
	ReloadLeft = W->Reload;
	BurstLeft = 0;
}

// --- Health ---------------------------------------------------------------------------------------------------------------

void AWFCharacter::ApplyHit(double Damage, const FString& Source)
{
	if (Health <= 0) return;
	if (IframesLeft > 0 || BarrierLeft > 0) return; // sim.ts hurtPlayer: Rift Dash i-frames and Bastion barriers absorb the hit
	Damage *= SimMods.VerbIncomingMult; // Overshield (syncSimFromLive)
	Damage *= 1 - wf::dragon::CappedResist(0, DragonhideResist); // Dragonhide (armor resistance not modelled yet)
	Health = FMath::Max(0.0, Health - Damage);
	SinceDamage = 0;
	LastDamageSource = Source;
	if (Health <= 0)
	{
		if (UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()) Progression->RecordPlayerDeath();
		if (AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>()) Mode->OnPlayerDied(); // encounter bosses reset
		CancelAbilities(); // ability-effects.ts cancelAbilities: nothing in flight survives into the next life
		Respawn();
	}
}

void AWFCharacter::Respawn()
{
	if (bRiding)
	{
		bRiding = false;
		MountMesh->SetVisibility(false);
		GetCharacterMovement()->SetMovementMode(MOVE_Walking);
	}
	SetActorLocation(SpawnLocation, false, nullptr, ETeleportType::TeleportPhysics);
	GetCharacterMovement()->Velocity = FVector::ZeroVector;
	Health = MaxHealth;
	SinceDamage = 100;
	for (int32 I = 0; I < Weapons.Num(); ++I) Ammo[I] = Weapons[I].Mag;
}

// --- Class abilities (ported ability-effects.ts / live-build.ts) ----------------------------------------------------

namespace
{
	/** The world as ability-effects.ts sees it: the enemies (through FDragonWorld's slots), obstacles, and the Operator's
	 *  own defences, turrets and zones, which the character keeps. */
	class FAbilityWorld final : public wf::ability::IWorld
	{
	public:
		FDragonWorld Bodies;
		UWorld* World = nullptr;
		AActor* Self = nullptr;
		double NowS = 0, GroundZ = 0;
		double Iframes_ = 0, Barrier_ = 0, Dome_ = 0;
		bool bNoise = false, bCleared = false;
		struct FSpawn { bool bTurret = false; double X = 0, Z = 0, Radius = 0, Dps = 0, Duration = 0; };
		TArray<FSpawn> Spawns;
		double Now() const override { return NowS; }
		double DamageMods(std::vector<wf::ability::FMachine>& Machines, size_t I, double Dmg, const std::string& Element, double X, double Z) override { return Bodies.DamageMods(Machines, I, Dmg, Element, X, Z); }
		void Defeat(std::vector<wf::ability::FMachine>& Machines, size_t I) override { Bodies.Defeat(Machines, I); }
		void Alert(const std::string& Text) override { Bodies.Alert(Text); }
		bool Blocked(double X, double Z) const override
		{
			// obstacles.ts: a solid body within ~1 m of the ground point at the Operator's height
			// probe 50 cm above the capsule centre so the floor itself never counts; only world geometry (not pawns) blocks
			FCollisionQueryParams Params(SCENE_QUERY_STAT(WFAbilityDash), false, Self);
			return World->OverlapAnyTestByObjectType(FVector(X * CmPerMeter, Z * CmPerMeter, GroundZ + 50.0), FQuat::Identity, FCollisionObjectQueryParams(ECC_WorldStatic), FCollisionShape::MakeSphere(100.f), Params);
		}
		void BossPoise(std::vector<wf::ability::FMachine>&, size_t I, double Amount) override
		{
			AWFEnemy* E = Bodies.Enemies[static_cast<int32>(I)];
			double Mult = 1;
			if (IsValid(E) && E->IsBoss()) E->Rules().Poise = wf::encounter::HitPoise(E->Rules().Poise, Amount, NowS, Mult); // boss-poise.ts hitPoise
		}
		void SpawnVolatileZone(double X, double Z, double Radius, double Dps, double Duration) override { Spawns.Add({false, X, Z, Radius, Dps, Duration}); }
		void PlaceRiftTurret(double X, double Z, double Duration) override { Spawns.Add({true, X, Z, 0, 0, Duration}); }
		void Iframes(double S) override { Iframes_ = FMath::Max(Iframes_, S); }
		void Barrier(double S) override { Barrier_ = FMath::Max(Barrier_, S); }
		void Dome(double S) override { Dome_ = FMath::Max(Dome_, S); }
		void Noise() override { bNoise = true; }
		void ClearDefences() override { bCleared = true; }
	};
}

const TCHAR* AWFCharacter::AbilityKey(int32 Slot)
{
	static const TCHAR* const Keys[3] = {TEXT("Q"), TEXT("F"), TEXT("X")};
	return Keys[FMath::Clamp(Slot, 0, 2)];
}

wf::ability::FBuild AWFCharacter::SavedBuild() const
{
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Progression) return wf::ability::DefaultBuild();
	return {Progression->Get().ActiveBuildMode, Progression->Get().ActiveBuildSlots};
}

void AWFCharacter::CastClassAbility(const char* Slot)
{
	UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>();
	FAbilityWorld World;
	World.World = GetWorld();
	World.Self = this;
	World.NowS = GetWorld()->GetTimeSeconds();
	World.GroundZ = GetActorLocation().Z;
	World.Iframes_ = IframesLeft; World.Barrier_ = BarrierLeft; World.Dome_ = DomeLeft;
	World.Bodies.Player = this;
	std::vector<wf::ability::FMachine> Machines = World.Bodies.Gather(GetWorld());
	const std::vector<wf::ability::FMachine> Before = Machines;
	const FVector L = GetActorLocation() / CmPerMeter;
	if (Dragon) Live.Energy = Dragon->EnergyPool();
	wf::ability::FCastContext Ctx;
	Ctx.Environment = "war"; // region kinds (war / safe / fracture) are not ported; the prototype map is a war zone
	Ctx.SubclassId = WFData::ToStd(SubclassId);
	Ctx.bInVehicle = bInVehicle;
	const wf::ability::FCastResult R = wf::ability::CastAbility(World, Machines, Live, AbilityLog, Slot, {L.X, L.Y, RulesYaw(GetControlRotation().Yaw)}, Ctx);
	World.Bodies.WriteBack(Before, Machines);
	if (Dragon) Dragon->EnergyPool() = Live.Energy;
	IframesLeft = World.Iframes_; BarrierLeft = World.Barrier_; DomeLeft = World.Dome_;
	for (const FAbilityWorld::FSpawn& S : World.Spawns)
	{
		if (S.bTurret)
		{
			// operator-abilities.ts deployRiftTurret: at most two, the oldest goes
			std::vector<wf::ability::FRiftTurret> List;
			for (const FRiftTurretActor& T : RiftTurrets) List.push_back(T.Rules);
			List = wf::ability::DeployRiftTurret(List, S.X, S.Z, World.NowS, S.Duration);
			RiftTurrets.Reset();
			for (const wf::ability::FRiftTurret& T : List) RiftTurrets.Add({T});
		}
		else VolatileZones.Add({S.X, S.Z, S.Radius, S.Dps, World.NowS + S.Duration});
	}
	if (R.bOk && (R.Pose.X != L.X || R.Pose.Z != L.Y))
	{
		// Rift Dash / Wyrm Dash / Shadow Strike move the Operator; Shadow Strike also turns them to face the target
		TeleportTo(FVector(R.Pose.X * CmPerMeter, R.Pose.Z * CmPerMeter, GetActorLocation().Z), GetActorRotation(), false, true);
		if (AController* C = GetController())
			if (R.Pose.Yaw != RulesYaw(GetControlRotation().Yaw)) { FRotator Rot = C->GetControlRotation(); Rot.Yaw = static_cast<float>(90.0 - FMath::RadiansToDegrees(R.Pose.Yaw)); C->SetControlRotation(Rot); }
	}
	const FLinearColor AbilityCyan(0.45f, 0.9f, 1.f), AbilityWarn(1.f, 0.55f, 0.3f);
	if (!R.bOk) Notify(WFData::ToF(R.Text), AbilityWarn);
	else for (const FString& A : World.Bodies.Alerts) Notify(A, AbilityCyan);
}

void AWFCharacter::TickAbilities(float DeltaSeconds)
{
	UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>();
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (Progression) Live = wf::ability::RebindLiveBuild(Live, SavedBuild(), Progression->Get().AbilityBranches); // a no-op unless the build changed
	if (Dragon) Live.Energy = Dragon->EnergyPool();
	wf::ability::TickLiveBuild(Live, DeltaSeconds, 0); // armor INTELLECT recharge is not modelled yet
	if (Dragon) Dragon->EnergyPool() = Live.Energy;
	SimMods = wf::ability::SyncSimFromLive(Live);
	IframesLeft = FMath::Max(0.0, IframesLeft - DeltaSeconds);
	BarrierLeft = FMath::Max(0.0, BarrierLeft - DeltaSeconds);
	DomeLeft = FMath::Max(0.0, DomeLeft - DeltaSeconds);

	const double Now = GetWorld()->GetTimeSeconds();
	FDragonWorld Bodies;
	Bodies.Player = this;
	std::vector<wf::ability::FMachine> Machines = Bodies.Gather(GetWorld());
	const std::vector<wf::ability::FMachine> Before = Machines;
	const FVector L = GetActorLocation() / CmPerMeter;
	wf::ability::HoldDisabledField(Machines, Live, {L.X, L.Y, 0}); // Disruption Pulse keeps ordinary enemies from firing
	Bodies.WriteBack(Before, Machines);

	// Rift Turrets (sim.ts): each fires 1 damage every 0.45 s at the nearest enemy within 34 m
	RiftTurrets.RemoveAll([Now](const FRiftTurretActor& T) { return T.Rules.Until <= Now; });
	for (FRiftTurretActor& T : RiftTurrets)
	{
		const int32 Hit = wf::ability::StepRiftTurret(T.Rules, Machines, DeltaSeconds);
		const FVector At(T.Rules.X * CmPerMeter, T.Rules.Z * CmPerMeter, GetActorLocation().Z - 60);
		DrawDebugCylinder(GetWorld(), At, At + FVector(0, 0, 140), 35.f, 12, FColor(120, 200, 255), false, -1.f, 0, 3.f);
		if (Hit >= 0 && Bodies.Enemies.IsValidIndex(Hit))
		{
			AWFEnemy* E = Bodies.Enemies[Hit];
			DrawDebugLine(GetWorld(), At + FVector(0, 0, 120), E->GetActorLocation(), FColor(120, 200, 255), false, 0.08f, 0, 2.f);
			E->TakeHit(wf::ability::RiftTurretDamage, this);
			if (E->IsDead()) Notify(TEXT("Rift Turret neutralized a hostile"), FLinearColor(0.45f, 0.9f, 1.f));
		}
	}
	// Volatile zones (Void Tech's Corrosion Field): damage per second to every enemy inside
	VolatileZones.RemoveAll([Now](const FVolatileZone& Z) { return Z.Until <= Now; });
	for (const FVolatileZone& Z : VolatileZones)
	{
		DrawDebugCircle(GetWorld(), FVector(Z.X * CmPerMeter, Z.Z * CmPerMeter, GetActorLocation().Z - 80), static_cast<float>(Z.Radius * CmPerMeter), 32, FColor(170, 90, 255), false, -1.f, 0, 3.f, FVector(1, 0, 0), FVector(0, 1, 0), false);
		for (AWFEnemy* E : Bodies.Enemies)
			if (IsValid(E) && !E->IsDead() && FVector::Dist2D(E->GetActorLocation() / CmPerMeter, FVector(Z.X, Z.Z, 0)) <= Z.Radius) E->TakeHit(Z.Dps * DeltaSeconds, this);
	}
	if (BarrierLeft > 0) DrawDebugSphere(GetWorld(), GetActorLocation(), 500.f, 16, FColor(255, 200, 90), false, -1.f, 0, 2.f);
}

void AWFCharacter::CancelAbilities()
{
	FAbilityWorld World;
	World.World = GetWorld();
	World.Self = this;
	World.NowS = GetWorld()->GetTimeSeconds();
	const FVector L = GetActorLocation() / CmPerMeter;
	Live = wf::ability::CancelAbilities(World, Live, AbilityLog, {L.X, L.Y, 0});
	if (UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>()) Dragon->EnergyPool() = Live.Energy; // a fresh life starts full
	IframesLeft = BarrierLeft = DomeLeft = 0;
	RiftTurrets.Reset();
	VolatileZones.Reset();
}

void AWFCharacter::Subclass(const FString& InSubclassId)
{
	const UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	const std::vector<std::string> Subs = wf::ability::SubclassesOf(Progression ? WFData::ToStd(Progression->GetIdentityClass()) : std::string());
	const std::string Id = WFData::ToStd(InSubclassId.ToUpper());
	if (std::find(Subs.begin(), Subs.end(), Id) == Subs.end()) { Notify(TEXT("Not a subclass of this Operator class (F6 switches class)"), FLinearColor(1.f, 0.55f, 0.3f)); return; }
	SubclassId = WFData::ToF(Id);
	Notify(FString::Printf(TEXT("Subclass - %s"), *SubclassId), FLinearColor(0.45f, 0.9f, 1.f));
}

void AWFCharacter::EquipAbility(const FString& AbilityId)
{
	UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Progression) return;
	std::string Error;
	if (!wf::ability::EquipAbility(Progression->Mutable(), WFData::ToStd(AbilityId), Error)) { Notify(WFData::ToF(Error), FLinearColor(1.f, 0.55f, 0.3f)); return; }
	Progression->NotifyChanged();
	Notify(FString::Printf(TEXT("%s equipped"), *WFData::ToF(wf::ability::NodeById(WFData::ToStd(AbilityId)).Name)), FLinearColor(0.45f, 0.9f, 1.f));
}

void AWFCharacter::AbilityBranch(const FString& AbilityId, const FString& BranchId)
{
	UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Progression) return;
	const wf::ability::FNode& Node = wf::ability::NodeById(WFData::ToStd(AbilityId));
	if (Node.Id != WFData::ToStd(AbilityId) || std::find(Node.Branches.begin(), Node.Branches.end(), WFData::ToStd(BranchId)) == Node.Branches.end())
	{
		Notify(TEXT("Unknown ability or branch"), FLinearColor(1.f, 0.55f, 0.3f));
		return;
	}
	if (!wf::ability::SelectAbilityBranch(Progression->Mutable(), Node.Id, WFData::ToStd(BranchId))) { Notify(TEXT("Needs a calibration token"), FLinearColor(1.f, 0.55f, 0.3f)); return; }
	Progression->NotifyChanged();
	Notify(FString::Printf(TEXT("%s - %s (%s)"), *WFData::ToF(Node.Name), *BranchId, *WFData::ToF(wf::ability::BranchTier(Node.Id, WFData::ToStd(BranchId)))), FLinearColor(0.45f, 0.9f, 1.f));
}

void AWFCharacter::ClassBuild()
{
	UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>();
	if (!Progression) return;
	const wf::ability::FBuild B = wf::ability::ClassBuild(WFData::ToStd(Progression->GetIdentityClass()));
	Progression->Mutable().ActiveBuildMode = B.Mode;
	Progression->Mutable().ActiveBuildSlots = B.Slots;
	Progression->NotifyChanged();
}
