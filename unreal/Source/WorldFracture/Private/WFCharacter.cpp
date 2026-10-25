#include "WFCharacter.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "DrawDebugHelpers.h"
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

	GetCharacterMovement()->MaxWalkSpeed = WalkSpeed;
	GetCharacterMovement()->JumpZVelocity = 520.f;
	GetCharacterMovement()->AirControl = 0.35f;
	bUseControllerRotationYaw = true;
}

void AWFCharacter::BeginPlay()
{
	Super::BeginPlay();
	SpawnLocation = GetActorLocation();
	if (UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"))) GunMesh->SetStaticMesh(Cube);

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
	for (int32 I = 0; I < SlotActions.Num(); ++I)
		Input->BindActionValueLambda(SlotActions[I], ETriggerEvent::Started, [this, I](const FInputActionValue&) { SelectWeapon(I); });
}

void AWFCharacter::Move(const FInputActionValue& Value)
{
	const FVector2D Axis = Value.Get<FVector2D>();
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

void AWFCharacter::SprintStarted(const FInputActionValue& Value) { GetCharacterMovement()->MaxWalkSpeed = SprintSpeed; }
void AWFCharacter::SprintStopped(const FInputActionValue& Value) { GetCharacterMovement()->MaxWalkSpeed = WalkSpeed; }

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

// --- Weapons ------------------------------------------------------------------------------------------------------------

void AWFCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	TickWeapon(DeltaSeconds);

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
			if (AWFEnemy* Enemy = Cast<AWFEnemy>(Hit.GetActor())) Enemy->ReceiveHit(W->Damage * WFWeapons::BaseBulletDamage, this);
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
	Health = FMath::Max(0.0, Health - Damage);
	SinceDamage = 0;
	LastDamageSource = Source;
	if (Health <= 0)
	{
		if (UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()) Progression->RecordPlayerDeath();
		Respawn();
	}
}

void AWFCharacter::Respawn()
{
	SetActorLocation(SpawnLocation, false, nullptr, ETeleportType::TeleportPhysics);
	GetCharacterMovement()->Velocity = FVector::ZeroVector;
	Health = MaxHealth;
	SinceDamage = 100;
	for (int32 I = 0; I < Weapons.Num(); ++I) Ammo[I] = Weapons[I].Mag;
}
