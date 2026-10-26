#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Core/WFAbilityCore.h"
#include "Core/WFDragonCore.h"
#include "Core/WFArmsCore.h"
#include "Core/WFArmorCore.h"
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
 * LMB fire (or swing the Fracture Blade), RMB aim, R/G reload, 1-5 guns and the mouse wheel through the blade and the four
 * launchers, F5 save, F9 finish the active quest (development).
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
	bool IsBladeOut() const { return Weapons.IsValidIndex(WeaponIndex) && Weapons[WeaponIndex].Kind == TEXT("sword"); }
	int32 GetComboStep() const { return Combo.Step; }
	bool IsReloading() const { return ReloadLeft > 0; }
	const FString& GetLastDamageSource() const { return LastDamageSource; }
	bool IsRiding() const { return bRiding; }
	/** Encounter SLOW zones (frost patches, shroud mist) scale movement speed while the player stands in them. */
	void SetHazardSpeedMult(double Mult) { HazardSpeedMult = Mult; }
	bool IsHackHeld() const { return bHackHeld; }
	/** the worn armor's effects (vehicle guns read the driver's weapon damage) */
	const wf::armor::FEffects& GetArmorEffects() const { return ArmorFx; }
	/** Getting into / out of a vehicle: the Operator stops simulating (no falling, firing or regen ticks) while carried. */
	void SetInVehicle(bool bIn);
	bool IsInVehicle() const { return bInVehicle; }
	double GetRideSpeed() const { return Flight.Speed; }

	// Console commands for the dragon progression (no menu yet)
	/** UpgradeDragonite dragonfire|wyrmwing|dragonhide|wyrmcall|roar|scalebreaker|skyfall */
	UFUNCTION(Exec) void UpgradeDragonite(const FString& Ability);
	/** EquipBlade vectal|aegis-broadsword|sun-cutter|none: the monoblade the Fracture Blade swings (foundries.ts; must be owned) */
	UFUNCTION(Exec) void EquipBlade(const FString& BladeId);
	/** VyrakTrust ruin|puzzle|protect <id> */
	UFUNCTION(Exec) void VyrakTrust(const FString& Kind, const FString& SourceId);
	UFUNCTION(Exec) void AncientBond();
	/** ChooseStarterVehicle scrap-interceptor|wasteland-jeep: the first vehicle (once, as after Mission 01 in the web build). */
	UFUNCTION(Exec) void ChooseStarterVehicle(const FString& VehicleId);
	/** SpawnVehicle <id>: any of the 14 vehicles, for testing (does not grant ownership). */
	UFUNCTION(Exec) void SpawnVehicle(const FString& VehicleId);
	/** RepairVehicle: pays Nex to repair the selected vehicle. */
	UFUNCTION(Exec) void RepairVehicle();
	UFUNCTION(Exec) void EternalCovenant();
	// Class abilities (ported ability-effects.ts): the build and branches are saved, the subclass is per session
	/** Subclass SHIELD_TITAN|BERSERKER_TITAN|BULWARK_TITAN|SHADOW_HUNTER|TRACKER_HUNTER|FRACTURE_RUNNER|CODE_WARLOCK|VOID_WARLOCK|ORACLE_WARLOCK */
	UFUNCTION(Exec) void Subclass(const FString& SubclassId);
	/** EquipAbility <id>: puts an unlocked ability in its slot (the Covenant ones need the Vyrak bond). */
	UFUNCTION(Exec) void EquipAbility(const FString& AbilityId);
	/** AbilityBranch <ability> <branch>: spends a calibration token on an evolution branch. */
	UFUNCTION(Exec) void AbilityBranch(const FString& AbilityId, const FString& BranchId);
	/** ClassBuild: equips the current class's own three abilities (classBuild). */
	UFUNCTION(Exec) void ClassBuild();

	// HUD reads (abilities)
	const wf::ability::FLiveBuild& GetLiveBuild() const { return Live; }
	const FString& GetSubclass() const { return SubclassId; }
	double GetBarrier() const { return BarrierLeft; }
	int32 GetRiftTurretCount() const { return RiftTurrets.Num(); }
	/** Phase Veil: how far enemies see the Operator (operator-abilities.ts veilSightMult). */
	double GetStealthMult() const { return SimMods.StealthMult; }
	/** Key labels of the three slots in this layout (E is the vehicle key here). */
	static const TCHAR* AbilityKey(int32 Slot);

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
	void CycleClass(const FInputActionValue& Value);
	void SummonScenario(const FInputActionValue& Value);
	/** Casts a Dragonite ability through the ported dragonite-cast.ts rules (bond, cooldown and energy checked there). */
	void CastAbility(const FString& Ability);
	/** Casts the class ability in a slot (PRIMARY / TACTICAL / ULTIMATE) through the ported castAbility. */
	void CastClassAbility(const char* Slot);
	void TickAbilities(float DeltaSeconds);
	wf::ability::FBuild SavedBuild() const;
	void CancelAbilities();
	void Interact(const FInputActionValue& Value);
	void CallVehicle(const FInputActionValue& Value);
	class AWFVehicle* SpawnVehicleAhead(const FString& VehicleId);
	void ToggleRide(const FInputActionValue& Value);
	void TickDragon(float DeltaSeconds);
	void TickRide(float DeltaSeconds);
	void Notify(const FString& Text, const FLinearColor& Color) const;

	void TickWeapon(float DeltaSeconds);
	/** Scene.tsx sword block: one swing of the combo (arc, monoblade damage and reach, finisher shockwave, deflect) */
	void SwingBlade(const FWFWeaponStats& W, int32 Step);
	/** sim.ts fireLauncher: a launcher round (guided launchers lock the nearest enemy in their cone) */
	void FireLauncherRound(const FWFWeaponStats& W);
	/** ordnance.ts stepRound for the launcher rounds in flight, then sim.ts detonateRound's splash and shove */
	void TickRounds(double Dt);
	void DetonateRound(const wf::vweapons::FBurst& Burst, double Knock, const FString& Element);
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
	UPROPERTY() TObjectPtr<UInputAction> ClassAction;
	UPROPERTY() TObjectPtr<UInputAction> ScenarioAction;
	UPROPERTY() TObjectPtr<UInputAction> WyrmAction;
	UPROPERTY() TArray<TObjectPtr<UInputAction>> DragoniteActions;
	UPROPERTY() TObjectPtr<UInputAction> InteractAction;
	UPROPERTY() TObjectPtr<UInputAction> CallVehicleAction;
	UPROPERTY() TObjectPtr<UInputAction> HackAction;
	TWeakObjectPtr<class AWFVehicle> CalledVehicle;
	UPROPERTY() TObjectPtr<UInputAction> RideAction;
	UPROPERTY() TArray<TObjectPtr<UInputAction>> ClassAbilityActions; // Q / F / X
	/** Stand-in mount under the Operator while riding, until Vyrak's model is imported. */
	UPROPERTY(VisibleAnywhere, Category = "Dragon") TObjectPtr<UStaticMeshComponent> MountMesh;

	bool bRiding = false;
	// class abilities: the live build (cooldowns, timers, verbs; energy is the pool shared with Dragonite) and its world
	wf::ability::FLiveBuild Live;
	wf::ability::FEventLog AbilityLog;
	wf::ability::FSimMods SimMods;
	FString SubclassId;
	struct FRiftTurretActor { wf::ability::FRiftTurret Rules; };
	TArray<FRiftTurretActor> RiftTurrets;
	struct FVolatileZone { double X = 0, Z = 0, Radius = 0, Dps = 0, Until = 0; };
	TArray<FVolatileZone> VolatileZones;
	double IframesLeft = 0, BarrierLeft = 0, DomeLeft = 0;
	bool bSprinting = false;
	bool bHackHeld = false; // H held: hacking in Nexus City (stealth.ts)
	bool bInVehicle = false;
	double DragonhideResist = 0;
	static constexpr double GlideSinkCmPerSec = 250; // Unreal-side glide feel: the web build only flags gliding
	double HazardSpeedMult = 1;
	wf::dragon::FFlight Flight;
	FVector2D RideInput = FVector2D::ZeroVector; // A/D turn, W/S throttle, gathered from Move each frame

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
	wf::arms::FCombo Combo;
	wf::armor::FEffects ArmorFx; // the worn armor, refreshed twice a second (Scene.tsx armorFx)
	double ArmorRefresh = 0;
	double GearPowerFor(const FWFWeaponStats& W) const;
	double DeflectUntil = 0; // the Sun-Cutter's window: incoming damage halved (hurtPlayer deflectUntil)
	struct FFootRound { wf::vweapons::FRound Round; TWeakObjectPtr<AActor> Target; FString Element; };
	TArray<FFootRound> Rounds;

	double Health = MaxHealth;
	double SinceDamage = 100;
	FString LastDamageSource;
	FVector SpawnLocation = FVector::ZeroVector;
};
