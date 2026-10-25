#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "WFWeapons.h"
#include "WFCharacter.generated.h"

class UCameraComponent;
class UInputAction;
class UInputMappingContext;
class UStaticMeshComponent;
struct FInputActionValue;

/**
 * The player Operator, first person (the web build's default camera). Guns fire hitscan rounds with the exported
 * weapon tuning (fire rate, burst, spread, recoil, magazine, reload); health and regeneration follow health.ts.
 * Input is built in code, so the project needs no input assets: WASD move, mouse look, Space/C jump, Shift sprint,
 * LMB fire, RMB aim, R/G reload, 1-5 or mouse wheel weapons, F5 save, F9 finish the active quest (development).
 */
UCLASS()
class WORLDFRACTURE_API AWFCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AWFCharacter();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void PawnClientRestart() override;

	/** Damage from an enemy (sim.ts hurtPlayer without armor or abilities yet). */
	void ApplyHit(double Damage, const FString& Source);

	// HUD reads
	double GetHealth() const { return Health; }
	const FWFWeaponStats* GetWeapon() const { return Weapons.IsValidIndex(WeaponIndex) ? &Weapons[WeaponIndex] : nullptr; }
	int32 GetAmmoInMag() const { return Ammo.IsValidIndex(WeaponIndex) ? Ammo[WeaponIndex] : 0; }
	int32 GetAmmoReserve() const { return Reserve.IsValidIndex(WeaponIndex) ? Reserve[WeaponIndex] : 0; }
	bool IsReloading() const { return ReloadLeft > 0; }
	const FString& GetLastDamageSource() const { return LastDamageSource; }

	// health.ts
	static constexpr double MaxHealth = 100;
	static constexpr double RegenDelay = 5;
	static constexpr double RegenRate = 8;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Camera") TObjectPtr<UCameraComponent> Camera;
	UPROPERTY(VisibleAnywhere, Category = "Weapon") TObjectPtr<UStaticMeshComponent> GunMesh;

private:
	void BuildInput();
	void AddMappingContext() const;

	void Move(const FInputActionValue& Value);
	void Look(const FInputActionValue& Value);
	void FireStarted(const FInputActionValue& Value) { bFireHeld = true; }
	void FireStopped(const FInputActionValue& Value) { bFireHeld = false; }
	void AimStarted(const FInputActionValue& Value) { bAiming = true; }
	void AimStopped(const FInputActionValue& Value) { bAiming = false; }
	void SprintStarted(const FInputActionValue& Value);
	void SprintStopped(const FInputActionValue& Value);
	void ReloadPressed(const FInputActionValue& Value) { StartReload(); }
	void NextWeapon(const FInputActionValue& Value);
	void SelectWeapon(int32 Index);
	void SaveGamePressed(const FInputActionValue& Value);
	void DevFinishQuest(const FInputActionValue& Value);

	void TickWeapon(float DeltaSeconds);
	void FireRound();
	void StartReload();
	void Respawn();

	UPROPERTY() TObjectPtr<UInputMappingContext> Mapping;
	UPROPERTY() TObjectPtr<UInputAction> MoveAction;
	UPROPERTY() TObjectPtr<UInputAction> LookAction;
	UPROPERTY() TObjectPtr<UInputAction> JumpAction;
	UPROPERTY() TObjectPtr<UInputAction> FireAction;
	UPROPERTY() TObjectPtr<UInputAction> AimAction;
	UPROPERTY() TObjectPtr<UInputAction> SprintAction;
	UPROPERTY() TObjectPtr<UInputAction> ReloadAction;
	UPROPERTY() TObjectPtr<UInputAction> NextWeaponAction;
	UPROPERTY() TArray<TObjectPtr<UInputAction>> SlotActions;
	UPROPERTY() TObjectPtr<UInputAction> SaveAction;
	UPROPERTY() TObjectPtr<UInputAction> DevQuestAction;

	TArray<FWFWeaponStats> Weapons;
	TArray<int32> Ammo;
	TArray<int32> Reserve;
	int32 WeaponIndex = 0;
	double Cooldown = 0;     // until the next trigger pull
	int32 BurstLeft = 0;
	double BurstTimer = 0;
	double ReloadLeft = 0;
	bool bFireHeld = false;
	bool bAiming = false;

	double Health = MaxHealth;
	double SinceDamage = 100;
	FString LastDamageSource;
	FVector SpawnLocation = FVector::ZeroVector;
};
