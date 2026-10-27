#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WFStuntPark.generated.h"

class UInstancedStaticMeshComponent;
class UTextRenderComponent;

/**
 * The Wastelands Stunt Park (stunt-park.ts): a dirt yard south of the Wastelands hub with a row of steel ramps to launch off.
 * Each ramp is a solid deck with a ramp at each end (district-decks.ts): the Kicker, the Tabletop, the Mega Launch, three Whoops
 * humps and the two Gap Jump decks. The ramp faces carry collision, so the vehicle's ground trace rides up them and stunts.ts
 * launches it off the lip. AWFGameMode places one in the Wastelands, laid out through its Wastelands anchor.
 */
UCLASS()
class WORLDFRACTURE_API AWFStuntPark : public AActor
{
	GENERATED_BODY()

public:
	AWFStuntPark();

	/** one ramp: its centre on the ground (cm), the run-up direction's yaw (deg), and stunt-park.ts's size (m) */
	void AddRamp(const FVector& GroundCentreCm, double YawDeg, double Length, double Ramp, double Width, double Height, const FString& Label);
	/** fence posts round the yard: centre on the ground (cm), the yard's yaw (deg), its length and width (m); Ground gives the
	 *  ground height (cm) under a point */
	void AddFence(const FVector& CentreCm, double YawDeg, double Length, double Width, const TFunctionRef<double(double, double)>& Ground);

private:
	UPROPERTY() TObjectPtr<UInstancedStaticMeshComponent> Steel;
	UPROPERTY() TObjectPtr<UInstancedStaticMeshComponent> Posts;
	/** a slab whose top face runs from (A along, A up) to (B along, B up) in the ramp's frame (m) */
	void Slab(const FVector& Origin, const FRotator& Facing, double A0, double H0, double A1, double H1, double Width);
};
