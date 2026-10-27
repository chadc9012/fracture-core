#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Core/WFAbilityCore.h"
#include "Core/WFStashCore.h"
#include "Core/WFDragonCore.h"
#include "Core/WFArmsCore.h"
#include "Core/WFArmorCore.h"
#include "Core/WFTacticsCore.h"
#include "Core/WFMoveCore.h"
#include "Core/WFGodforgeCore.h"
#include "Core/WFNemesisCore.h"
#include "Core/WFHitCore.h"
#include "WFWeapons.h"
#include "WFCharacter.generated.h"

class AWFEnemy;
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

	/**
	 * The Enhanced Input action behind an on-screen touch button (WFHUD): Fire, Aim, Jump, Sprint, Reload, Crouch, Interact,
	 * Hack, NextWeapon, Ability1-3, Ride. Touch buttons inject into these same actions, so touch, gamepad and keyboard all
	 * run the same bindings. Null for an unknown name or before input is built.
	 */
	class UInputAction* GetTouchAction(FName Id) const;

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
	/** region-hazards.ts / hazard-zones.ts: the region's and the zone's pull on movement (speed, gravity, a drift in m/s) */
	void SetRegionHazard(double SpeedMul, double GravityMul, double PullX, double PullZ) { RegionSpeedMul = SpeedMul; RegionGravityMul = GravityMul; RegionPullX = PullX; RegionPullZ = PullZ; }
	/** Scene.tsx hazard damage: a chip that never takes the last point of health, unless it would, then a 5-point hit */
	void ApplyHazardDamage(double DamagePerSec, double Dt, const FString& Cause);
	bool IsHackHeld() const { return bHackHeld; }
	/** STAND | CROUCH | PRONE (movement.ts): enemies hit a crouched or prone Operator less often */
	const std::string& GetStance() const { return MoveKit.Stance; }
	/** the web build's foot units per Unreal metre/second: its walk is 14, this Operator's is 4.5 m/s */
	static constexpr double FootRatio = 4.5 / wf::move::BaseFootSpeed;
	/** the worn armor's effects (vehicle guns read the driver's weapon damage) */
	const wf::armor::FEffects& GetArmorEffects() const { return ArmorFx; }
	/** Scene.tsx: the build's synergy archetype and active shield reflect steer enemy squads (enemy-intelligence.ts) */
	std::string GetSquadArchetype() const;
	bool IsReflecting() const { return Live.ShieldReflect > 0; }
	std::string GetBranchPosture() const;
	/** launcher rounds in flight, for enemies to dodge (enemy-evasion.ts) */
	void AppendRounds(std::vector<wf::tactics::FRoundLike>& Out) const;
	/** Getting into / out of a vehicle: the Operator stops simulating (no falling, firing or regen ticks) while carried. */
	void SetInVehicle(bool bIn);
	bool IsInVehicle() const { return bInVehicle; }
	double GetRideSpeed() const { return Flight.Speed; }

	// Console commands for the dragon progression (no menu yet)
	/** UpgradeDragonite dragonfire|wyrmwing|dragonhide|wyrmcall|roar|scalebreaker|skyfall */
	UFUNCTION(Exec) void UpgradeDragonite(const FString& Ability);
	/** EquipBlade vectal|aegis-broadsword|sun-cutter|none: the monoblade the Fracture Blade swings (foundries.ts; must be owned) */
	UFUNCTION(Exec) void EquipBlade(const FString& BladeId);
	/** Equip <item id>: wear or wield an owned item in its own slot (armor-sets.ts equipPiece), e.g. a forged relic */
	UFUNCTION(Exec) void Equip(const FString& ItemId);
	/** a kill credited to the Operator (sim.ts defeatMachine): the Reap rune heals 6, the relic in hand counts it toward
	 *  awakening, and a Black Armory weapon's nanites hop to the nearest hostile within 10 m (never chaining) */
	void OnEnemyKilled(AWFEnemy* Victim);
	/** sim.ts lastHitBy: the enemy that landed the latest hit (the killing blow's source can become a nemesis) */
	void SetLastHitBy(const wf::nemesis::FKiller& Killer) { LastEnemyHit = Killer; }
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
	/** the equipped weapon's foundry and the relic in hand's runes (Scene.tsx runeKey: the Devour count restarts when it changes) */
	void RefreshRelic();
	FString Foundry;
	FString RelicKey, RelicId;
	wf::godforge::FRuneCombat RuneFx;
	int32 DevourHits = 0;
	bool bNaniteChain = false;
	std::optional<wf::nemesis::FKiller> LastEnemyHit;
	/** the equipped weapon item's element, evolution and perk (sim.equippedElement / equippedEvolution / equippedPerk) */
	FString EquippedElement = TEXT("KINETIC"), EquippedEvolution, EquippedPerk;
	wf::hit::FCharge EvoCharge;
	std::vector<wf::hit::FCharge> RuneCharges; // one per burst rune on the relic in hand
	wf::hit::FNullCharge NullCharge;
	wf::hit::FMaw Maw;
	double HitEventId = 0;
	/** one landed bullet: everything sim.ts does after the damage (statuses, bursts, perks, reaction) */
	void AfterBulletHit(AWFEnemy* Victim, double Dealt, const FString& WeaponElement, const FVector& From);
	/** weapon-evolution.ts / godforge.ts abilityBurst: share the hit with the nearest others, apply the element, stun */
	void AbilityBurst(AWFEnemy* Victim, double Dealt, const FString& Ability);
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
	/** UseConsumable healStim | armorStim | ruinStone (keys 6 / 7 / J): a timed buff stack, at most 3 (stash.ts useStim) */
	UFUNCTION(Exec) void UseConsumable(const FString& Id);
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
	/** movement.ts / parkour.ts: stance, slides, air jumps, the Warlock glide, vault lunges and chains, camera and FOV */
	void TickMovementKit(float DeltaSeconds);
	void JumpPressed();
	void JumpReleased();
	std::string MoveClass() const;
	wf::move::FMoveState MoveKit;
	bool bJumpHeld = false, bCrouchHeld = false, bSlideKeyWas = false;
	int32 ChainCount = 0;
	double LastVaultAt = -10;
	float BaseFov = 90.f;
	/** Scene.tsx sword block: one swing of the combo (arc, monoblade damage and reach, finisher shockwave, deflect) */
	void SwingBlade(const FWFWeaponStats& W, int32 Step);
	/** sim.ts fireLauncher: a launcher round (guided launchers lock the nearest enemy in their cone) */
	void FireLauncherRound(const FWFWeaponStats& W, double RecoilMult);
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
	UPROPERTY() TArray<TObjectPtr<UInputAction>> ConsumableActions;
	/** the running stim / Ruin Stone buffs (stash.ts buffEffect), read each tick */
	wf::stash::FBuffEffect BuffFx;
	UPROPERTY() TObjectPtr<UInputAction> InteractAction;
	UPROPERTY() TObjectPtr<UInputAction> CallVehicleAction;
	UPROPERTY() TObjectPtr<UInputAction> HackAction;
	UPROPERTY() TObjectPtr<UInputAction> CrouchAction; // held: crouch, or slide out of a sprint
	UPROPERTY() TObjectPtr<UInputAction> ProneAction;  // toggle
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
	double RegionSpeedMul = 1, RegionGravityMul = 1, RegionPullX = 0, RegionPullZ = 0;
	wf::dragon::FFlight Flight;
	FVector2D RideInput = FVector2D::ZeroVector; // A/D turn, W/S throttle, gathered from Move each frame

	TArray<FWFWeaponStats> Weapons;
	TArray<FWFWeaponStats> BaseWeapons; // the loadout's own guns, before the equipped items' classes
	TMap<FString, FString> CatalogClasses; // weapon-catalog.ts name -> class
	/** weapon-classes.ts arsenalFor: the Auto Rifle's and Heavy Cannon's slots fire as the equipped item's class */
	void RefreshArsenal();
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
