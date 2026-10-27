#pragma once

#include "CoreMinimal.h"
#include "Core/WFTacticsCore.h"
#include "Core/WFVehicleCore.h"
#include "Core/WFVehicleWeaponsCore.h"
#include "Core/WFFleetCore.h"
#include "Core/WFStuntCore.h"
#include "GameFramework/Pawn.h"
#include "WFVehicle.generated.h"

class UBoxComponent;
class UCameraComponent;
class UInputAction;
class UInputMappingContext;
class USpringArmComponent;
class UStaticMeshComponent;
class AWFCharacter;
struct FInputActionValue;

/** One of the 14 vehicles (DataTables/Vehicles.json, the web build's vehicles.ts). */
struct FWFVehicleDef
{
	FString Id, Name, Domain, Role;
	double Speed = 1, Hull = 1, Handling = 1, Ram = 1, CollisionRadius = 3, TerrainGrip = 1;
	int32 Seats = 1;
	bool bStarter = false;
};

namespace WFVehicles
{
	TArray<FWFVehicleDef> Load(FString& OutError);
	const FWFVehicleDef* Find(const TArray<FWFVehicleDef>& Defs, const FString& Id);
}

/**
 * A drivable vehicle running the ported vehicle-handling.ts per-type model (racer, off-road, tank, jet, heli, boat, sub):
 * throttle / brake / steer, drift and handbrake, takeoff speed and climb for aircraft, floating and diving for boats and
 * subs, ground grip from vehicle-surface.ts, and wear from vehicle-condition.ts (collisions damage it; a wrecked engine
 * stops it). Controls: W/S throttle and brake, A/D steer, Space handbrake, Shift boost, C/Z climb and descend, E exit.
 *
 * Stand-in body (a block sized by the vehicle's collision radius) until the fleet models are imported. The prototype map
 * has no water, so boats and the sub are beached until a level with water (WaterLevelMeters) is used.
 */
UCLASS()
class WORLDFRACTURE_API AWFVehicle : public APawn
{
	GENERATED_BODY()

public:
	AWFVehicle();

	void Configure(const FWFVehicleDef& InDef, const wf::vehicle::FCondition& InCondition);
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void PawnClientRestart() override;

	/** The action behind a driving touch button (WFHUD): Drive.Fire, Drive.Secondary, Drive.Handbrake, Drive.Boost,
	 * Drive.Ascend, Drive.Descend, Drive.Exit. Null for anything else. */
	class UInputAction* GetTouchAction(FName Id) const;

	/** The character gets in: it is hidden and carried; the controller drives this pawn. */
	void Enter(AWFCharacter* InDriver);
	AWFCharacter* GetDriver() const { return Driver.Get(); }
	/** gets the driver out without the exit checks (a forced bail-out keeps KeepSpeed m/s of momentum) */
	void Dismount(double KeepSpeed);
	/** an enemy shot or blow that reached the driver also wears the vehicle (Scene.tsx: impactVehicle by hp lost + 2) */
	void TakeEnemyFire(double HpLost);
	/** flares are burning: incoming enemy fire misses (vehicle-gadgets.ts spoofed) */
	bool IsSpoofed(double Now) const;
	/** the equipped vehicle item's gear power (inventory.ts weaponDamageMultiplier) */
	double VehGearPower() const;
	/** ordnance in flight, for enemies to dodge (enemy-evasion.ts) */
	void AppendRounds(std::vector<wf::tactics::FRoundLike>& Out) const;
	const FWFVehicleDef& GetDef() const { return Def; }
	const wf::vehicle::FState& GetState() const { return State; }
	const wf::vehicle::FCondition& GetCondition() const { return Condition; }
	const wf::vehicle::FProfile& GetProfile() const { return *Profile; }

	/** Hardpoints (vehicle-weapons.ts armamentFor for this vehicle's handling class) and the shared weapon heat. */
	const wf::vweapons::FArmament& GetArmament() const { return Armament; }
	/** sim.ts weaponHeat: the game mode's one gauge for every gun, on foot or mounted */
	const wf::vweapons::FHeat& GetHeat() const;
	/** Race recovery: puts the vehicle at a point (cm), stopped, facing as it was. */
	void Recover(const FVector& At);
	/** The fleet build being driven (fleet.ts active build on this chassis), its gadget hardpoint, and the gadgets out. */
	const FString& GetBuildId() const { return BuildId; }
	const std::optional<wf::gadget::FGadget>& GetGadget() const { return Gadget; }
	double GetGadgetCooldown() const { return GadgetCool; }
	bool AreWeaponsDisabled() const { return wf::vweapons::WeaponsDisabled(Condition.Body); }

	/** World water surface in metres for boats and the sub (no water in the prototype map). */
	UPROPERTY(EditAnywhere, Category = "World Fracture") float WaterLevelMeters = -100000.f;
	/** Imported fleet models: an extra turn (degrees) if the importer's axes leave them facing sideways or backwards. */
	UPROPERTY(EditAnywhere, Category = "World Fracture") float ImportedModelYawDeg = 0.f;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Vehicle") TObjectPtr<UBoxComponent> Box;
	UPROPERTY(VisibleAnywhere, Category = "Vehicle") TObjectPtr<UStaticMeshComponent> Body;
	UPROPERTY(VisibleAnywhere, Category = "Vehicle") TObjectPtr<USpringArmComponent> Arm;
	UPROPERTY(VisibleAnywhere, Category = "Vehicle") TObjectPtr<UCameraComponent> Camera;

private:
	void BuildInput();
	void Exit(const FInputActionValue& Value);
	void Notify(const FString& Text, const FLinearColor& Color) const;
	// weapons (ported vehicle-weapons.ts / ordnance.ts; rounds fly and hit in TickProjectiles)
	wf::vweapons::FPose WeaponPose() const;
	void TickWeapons(double Dt);
	void TickProjectiles(double Dt);
	void UseGadget(const wf::vweapons::FPose& Pose);
	void TickGadgets(double Dt);
	void GadgetBlast(double X, double Y, double Z, double Radius, double Damage, const FString& Element);
	void Detonate(const wf::vweapons::FBurst& Burst);
	double GroundMeters(double X, double Z, double FallbackM) const;

	FWFVehicleDef Def;
	const wf::vehicle::FProfile* Profile = &wf::vehicle::ProfileFor("OFFROAD");
	wf::vehicle::FState State;
	wf::vehicle::FCondition Condition;
	// off-road air and stunts (stunts.ts; Scene.tsx offroad): ground vehicles leave crests and ramp lips and score their tricks
	wf::stunt::FAir Air;
	wf::stunt::FRun StuntRun;
	bool bAirReady = false;
	/** a scored stunt: the HUD line and the Nex (stunts:<day>, capped) */
	void OnStunt(double Points) const;
	TWeakObjectPtr<AWFCharacter> Driver;
	TWeakObjectPtr<AWFCharacter> Gunner; // the last driver: rounds still in flight pay their kills to them
	double SkidNoticeAt = -10;

	wf::vweapons::FArmament Armament;
	wf::vweapons::FFireState Fire;
	wf::vweapons::FHeat& SharedHeat();
	wf::vweapons::FHeat FallbackHeat; // only without a World Fracture game mode
	bool bTrigger = false, bSecondaryTrigger = false;
	double AimYaw = 0, AimPitch = 0; // camera look relative to the nose (rules radians): turrets follow it
	TArray<wf::vweapons::FBullet> Bullets;
	struct FLiveRound { wf::vweapons::FRound Round; TWeakObjectPtr<AActor> Target; };
	TArray<FLiveRound> Rounds;
	FString BuildId;
	std::optional<wf::gadget::FGadget> Gadget;
	wf::gadget::FState Gadgets;
	double GadgetCool = 0;
	bool bGadgetHeld = false, bFlameLit = false;
	double RamCoolUntil = 0;

	UPROPERTY() TObjectPtr<UInputMappingContext> Mapping;
	UPROPERTY() TObjectPtr<UInputAction> ThrottleAction;
	UPROPERTY() TObjectPtr<UInputAction> BrakeAction;
	UPROPERTY() TObjectPtr<UInputAction> SteerAction;
	UPROPERTY() TObjectPtr<UInputAction> AscendAction;
	UPROPERTY() TObjectPtr<UInputAction> DescendAction;
	UPROPERTY() TObjectPtr<UInputAction> HandbrakeAction;
	UPROPERTY() TObjectPtr<UInputAction> BoostAction;
	UPROPERTY() TObjectPtr<UInputAction> FireAction;
	UPROPERTY() TObjectPtr<UInputAction> SecondaryAction;
	UPROPERTY() TObjectPtr<UInputAction> LookAction;
	UPROPERTY() TObjectPtr<UInputAction> ExitAction;
	/** a stick's forward / back (gamepad left stick, the phone's left on-screen stick): throttle above, brake below */
	UPROPERTY() TObjectPtr<UInputAction> DriveAxisAction;
	wf::vehicle::FInput Input;
};
