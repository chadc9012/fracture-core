#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "WFSaveGame.generated.h"

/** One save slot: the progression as JSON in the web build's field names (WFProgressionJson). */
UCLASS()
class WORLDFRACTURECORE_API UWFSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY() int32 Version = 1;
	UPROPERTY() FString ProgressionJson;
	UPROPERTY() FDateTime SavedAt;
};
