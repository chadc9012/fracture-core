#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "WFCoreSettings.generated.h"

class UDataTable;

/** Project Settings > Game > World Fracture. Points the core systems at their imported DataTables. */
UCLASS(Config = Game, DefaultConfig, meta = (DisplayName = "World Fracture"))
class WORLDFRACTURECORE_API UWFCoreSettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	UWFCoreSettings();

	/** The Quests table imported from unreal-migration/DataTables/Quests.json (row struct FQuestsRow). */
	UPROPERTY(Config, EditAnywhere, Category = "Quests", meta = (RequiredAssetDataTags = "RowStructure=/Script/WorldFractureCore.QuestsRow"))
	TSoftObjectPtr<UDataTable> QuestTable;

	/** Worlds unlocked on a new save. Matches the web build's STARTING_UNLOCKED_WORLDS. */
	UPROPERTY(Config, EditAnywhere, Category = "Quests")
	TArray<FString> StartingUnlockedWorlds;

	/** Region a new save starts in. */
	UPROPERTY(Config, EditAnywhere, Category = "Quests")
	FString StartingWorld = TEXT("veridan");

	/** Fracture Shards on a new save (web build default: 120). */
	UPROPERTY(Config, EditAnywhere, Category = "Quests")
	double StartingShards = 120.0;
};
