#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WFLivingNpc.generated.h"

class UStaticMeshComponent;
class UTextRenderComponent;

/**
 * A person you can talk to in Nexus City or Neon City (living-npcs.ts): a simple body in their faction's colour with a
 * name plate. AWFGameMode places them, walks them between their post and their night rest spot (npc-routine.ts), and runs
 * the talk panel (E nearby, or Talk / TalkDo).
 */
UCLASS()
class WORLDFRACTURE_API AWFLivingNpc : public AActor
{
	GENERATED_BODY()

public:
	AWFLivingNpc();
	virtual void Tick(float DeltaSeconds) override;

	void Setup(const FString& InId, const FString& Name, const FString& Title, const FLinearColor& Color);
	const FString& GetNpcId() const { return NpcId; }
	/** where to stand now (cm); the body walks there */
	void SetGoal(const FVector& Goal) { GoalCm = Goal; bHasGoal = true; }

private:
	UPROPERTY() TObjectPtr<USceneComponent> Root;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Body;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Head;
	UPROPERTY() TObjectPtr<UTextRenderComponent> Plate;
	FString NpcId;
	FVector GoalCm = FVector::ZeroVector;
	bool bHasGoal = false;
};
