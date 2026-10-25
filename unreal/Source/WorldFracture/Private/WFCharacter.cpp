#include "WFCharacter.h"

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
	// the web build's default Dragonite keys (bindings.ts): 8 9 0 - = \ ;  in dragonite.ts order
	const FKey DragoniteKeys[7] = {EKeys::Eight, EKeys::Nine, EKeys::Zero, EKeys::Hyphen, EKeys::Equals, EKeys::Backslash, EKeys::Semicolon};
	for (const FKey& Key : DragoniteKeys)
	{
		UInputAction* A = Make(EInputActionValueType::Boolean);
		Mapping->MapKey(A, Key);
		DragoniteActions.Add(A);
	}
	Mapping->MapKey(RideAction, EKeys::V);
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
	Super::PawnClientRestart();
	BuildInput();
	AddMappingContext();
}

void AWFCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	BuildInput();
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
	for (int32 I = 0; I < DragoniteActions.Num(); ++I)
	{
		const FString Id = UTF8_TO_TCHAR(wf::dragon::AbilityIds[I]);
		Input->BindActionValueLambda(DragoniteActions[I], ETriggerEvent::Started, [this, Id](const FInputActionValue&) { CastAbility(Id); });
	}
	Input->BindAction(RideAction, ETriggerEvent::Started, this, &AWFCharacter::ToggleRide);
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
			return Enemies[static_cast<int32>(I)]->ReceiveHit(Dmg, Player, WFData::ToF(Element)); // applies it; a kill pays as the player's
		}
		void Defeat(std::vector<wf::dragoncast::FMachine>& Machines, size_t I) override
		{
			const AWFEnemy* E = Enemies[static_cast<int32>(I)];
			Machines[I].bAlive = !E->IsDead(); // the enemy already died (or held an encounter hp floor) in ReceiveHit
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
	double RulesYaw(float UnrealYawDegrees) { return HALF_PI - FMath::DegreesToRadians(static_cast<double>(UnrealYawDegrees)); }
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
	const FLinearColor Violet(0.7f, 0.4f, 1.f), Warn(1.f, 0.55f, 0.3f);
	if (!World.Alerts.IsEmpty()) for (const FString& A : World.Alerts) Notify(A, Violet);
	else Notify(WFData::ToF(R.Text), R.bOk ? Violet : Warn);
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
	Dragon->EnergyPool() = wf::dragoncast::RegenEnergy(Dragon->EnergyPool(), DeltaSeconds);
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
		Notify(FString::Printf(TEXT("Vyrak trust %d / 100 - %s"), FMath::RoundToInt(Dragon->GetTrust()), *Dragon->GetTrustStageName()), FLinearColor(0.7f, 0.4f, 1.f));
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
	TickWeapon(DeltaSeconds);
	TickDragon(DeltaSeconds);
	if (bRiding) TickRide(DeltaSeconds);
	else GetCharacterMovement()->MaxWalkSpeed = static_cast<float>((bSprinting ? SprintSpeed : WalkSpeed) * HazardSpeedMult);

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
			if (AWFEnemy* Enemy = Cast<AWFEnemy>(Hit.GetActor())) Enemy->ReceiveHit(W->Damage * WFWeapons::BaseBulletDamage, this, W->Element);
	}

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
	Damage *= 1 - wf::dragon::CappedResist(0, DragonhideResist); // Dragonhide (armor resistance not modelled yet)
	Health = FMath::Max(0.0, Health - Damage);
	SinceDamage = 0;
	LastDamageSource = Source;
	if (Health <= 0)
	{
		if (UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()) Progression->RecordPlayerDeath();
		if (AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>()) Mode->OnPlayerDied(); // encounter bosses reset
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
