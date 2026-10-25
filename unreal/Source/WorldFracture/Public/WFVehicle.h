#pragma once

#include "CoreMinimal.h"
#include "Core/WFVehicleCore.h"
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

	/** The character gets in: it is hidden and carried; the controller drives this pawn. */
	void Enter(AWFCharacter* InDriver);
	const FWFVehicleDef& GetDef() const { return Def; }
	const wf::vehicle::FState& GetState() const { return State; }
	const wf::vehicle::FCondition& GetCondition() const { return Condition; }
	const wf::vehicle::FProfile& GetProfile() const { return *Profile; }

	/** World water surface in metres for boats and the sub (no water in the prototype map). */
	UPROPERTY(EditAnywhere, Category = "World Fracture") float WaterLevelMeters = -100000.f;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Vehicle") TObjectPtr<UBoxComponent> Box;
	UPROPERTY(VisibleAnywhere, Category = "Vehicle") TObjectPtr<UStaticMeshComponent> Body;
	UPROPERTY(VisibleAnywhere, Category = "Vehicle") TObjectPtr<USpringArmComponent> Arm;
	UPROPERTY(VisibleAnywhere, Category = "Vehicle") TObjectPtr<UCameraComponent> Camera;

private:
	void BuildInput();
	void Exit(const FInputActionValue& Value);
	void Notify(const FString& Text, const FLinearColor& Color) const;

	FWFVehicleDef Def;
	const wf::vehicle::FProfile* Profile = &wf::vehicle::ProfileFor("OFFROAD");
	wf::vehicle::FState State;
	wf::vehicle::FCondition Condition;
	TWeakObjectPtr<AWFCharacter> Driver;
	double SkidNoticeAt = -10;

	UPROPERTY() TObjectPtr<UInputMappingContext> Mapping;
	UPROPERTY() TObjectPtr<UInputAction> ThrottleAction;
	UPROPERTY() TObjectPtr<UInputAction> BrakeAction;
	UPROPERTY() TObjectPtr<UInputAction> SteerAction;
	UPROPERTY() TObjectPtr<UInputAction> AscendAction;
	UPROPERTY() TObjectPtr<UInputAction> DescendAction;
	UPROPERTY() TObjectPtr<UInputAction> HandbrakeAction;
	UPROPERTY() TObjectPtr<UInputAction> BoostAction;
	UPROPERTY() TObjectPtr<UInputAction> ExitAction;
	wf::vehicle::FInput Input;
};
