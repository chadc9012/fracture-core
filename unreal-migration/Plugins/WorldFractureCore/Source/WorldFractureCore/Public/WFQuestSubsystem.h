#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/WFQuestCore.h"
#include "WFQuestSubsystem.generated.h"

class UDataTable;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FWFQuestCompleted, const FString&, QuestId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FWFActiveQuestChanged, const FString&, NewQuestId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FWFWorldUnlocked, const FString&, World);

/** One objective of the active quest, for the HUD's objective list. */
USTRUCT(BlueprintType)
struct WORLDFRACTURECORE_API FWFObjectiveView
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Quest") FString Label;
	UPROPERTY(BlueprintReadOnly, Category = "Quest") double Progress = 0.0;
	UPROPERTY(BlueprintReadOnly, Category = "Quest") double Amount = 0.0;
	UPROPERTY(BlueprintReadOnly, Category = "Quest") bool bComplete = false;
};

/**
 * The Fracture Descent quest chain, owned by the game instance. Gameplay reports world events (kills, missions,
 * bosses, entering a region...) and this advances the active quest, pays rewards, unlocks worlds and raises
 * world corruption exactly as the web build does — the rules live in wf::quest (Core/WFQuestCore.h), which is
 * golden-tested against the TypeScript engine.
 *
 * Loads the quest table from Project Settings > Game > World Fracture on startup, or call LoadQuestTable.
 */
UCLASS()
class WORLDFRACTURECORE_API UWFQuestSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Replaces the quest catalog with the rows of a Quests DataTable (row struct FQuestsRow). False + reason on bad data. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests")
	bool LoadQuestTable(UDataTable* Table, FString& OutError);

	/** A fresh save: first quest active, starting worlds unlocked (see UWFCoreSettings). */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests")
	void ResetProgression();

	// --- World events. Call these from gameplay; each runs one game tick. ---
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Events") void ReportEnterWorld(const FString& World);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Events") void ReportKill(const FString& World);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Events") void ReportSurvived(const FString& World, double Seconds);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Events") void ReportMissionComplete(const FString& MissionId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Events") void ReportDungeonCleared(const FString& DungeonId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Events") void ReportBossDefeated(const FString& EncounterId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Events") void ReportHeatLevel(int32 Level);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Events") void ReportLockdownTier(const FString& Tier);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Events") void ReportHackComplete();

	/** Development fast-track: completes the active quest through the normal reward path. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Quests|Development")
	void DevFinishActiveQuest();

	// --- Reading state, for the HUD and saves. ---
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") FString GetActiveQuestId() const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") FString GetActiveQuestTitle() const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") FString GetActiveQuestLine() const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") TArray<FWFObjectiveView> GetActiveObjectives() const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") bool IsQuestComplete(const FString& QuestId) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") bool IsWorldUnlocked(const FString& World) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") double GetCorruptionLevel() const { return State.CorruptionLevel; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") double GetFractureShards() const { return State.FractureShards; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") FString GetCurrentWorld() const;
	/** The whole quest state as one line of text, for logs and debugging. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Quests") FString DescribeState() const;

	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Quests") FWFQuestCompleted OnQuestCompleted;
	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Quests") FWFActiveQuestChanged OnActiveQuestChanged;
	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Quests") FWFWorldUnlocked OnWorldUnlocked;

	const wf::quest::FProgression& GetProgression() const { return State; }
	/** Restores a saved progression (from a SaveGame), then reconciles it like the web build does on load. */
	void SetProgression(const wf::quest::FProgression& Saved);

private:
	void Apply(const wf::quest::FEvent& Event);
	/** Swaps in the new state and fires delegates for whatever changed. */
	void Commit(wf::quest::FProgression Next);

	wf::quest::FCatalog Catalog;
	wf::quest::FProgression State;
};
