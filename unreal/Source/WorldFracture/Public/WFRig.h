#pragma once

#include "CoreMinimal.h"
#include "Components/SkeletalMeshComponent.h"
#include "WFRig.generated.h"

class UAnimSequence;

/**
 * A rigged character from the web build (public/models/enemies, npcs): the Meshy/Mixamo-rigged GLBs that
 * unreal/tools/setup_assets.py imports to /Game/WF/Characters/<model>/<model> with their clips as <model>_idle,
 * <model>_walk, <model>_run. Wear() sizes it to a real height, stands its feet on a given height and turns it to face the
 * owner's +X (worked out from the foot and toe bones, so it doesn't depend on how the importer oriented the file). Drive()
 * picks idle / walk / run from ground speed, like the web build's enemy-anim.ts. No animation blueprint: single-node
 * playback, so nothing has to be authored in the editor.
 */
UCLASS()
class WORLDFRACTURE_API UWFRig : public USkeletalMeshComponent
{
	GENERATED_BODY()

public:
	UWFRig();

	/** false (and the owner keeps its stand-in) when the model hasn't been imported */
	bool Wear(const FString& Model, float HeightCm, float FeetZ);
	/** ground speed in cm/s */
	void Drive(float SpeedCmS);
	bool IsWorn() const { return bWorn; }

	/** a new rig on Owner under Parent; null if the model is missing (nothing is left behind) */
	static UWFRig* Attach(AActor* Owner, USceneComponent* Parent, const FString& Model, float HeightCm, float FeetZ);

private:
	UPROPERTY() TObjectPtr<UAnimSequence> Idle;
	UPROPERTY() TObjectPtr<UAnimSequence> Walk;
	UPROPERTY() TObjectPtr<UAnimSequence> Run;
	int32 Playing = -1;
	bool bWorn = false;
	/** the clips are authored at about these speeds (cm/s): play rate follows the real speed around them */
	float WalkPace = 140.f, RunPace = 420.f;
};
