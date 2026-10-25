#pragma once

#include "CoreMinimal.h"
#include "Core/WFProgression.h"
#include "Core/WFRewardCore.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "WFProgressionSubsystem.generated.h"

UENUM(BlueprintType)
enum class EWFDefeatOutcome : uint8
{
	Ignored,     // still alive, or already dead
	Shattered,   // a decoy: no kill
	RivalScored, // a Killbox rival: counts for the match only
	Unpaid,      // killed by the world, not the player
	Paid,
};

/** What a defeated enemy is, for the reward rules (sim.ts Machine fields that decide the payout). */
USTRUCT(BlueprintType)
struct WORLDFRACTURECORE_API FWFEnemyRewardInfo
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bBoss = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bElite = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bEmergencyQuest = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bMission = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bDecoy = false;
	/** Region id the enemy belongs to (veridan, wastelands, ...): picks the armor set and labels weapon drops. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Zone = TEXT("veridan");
	/** Material it drops (Machine.drop), e.g. sporeFiber, scrapMetal, magmaCore. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString DropMaterial = TEXT("scrapMetal");
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Profile = TEXT("Raider");
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Rival;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Living;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Nemesis;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString ScenarioId;
	/** Run id minted when the scenario boss was summoned (MintScenarioRun); a run pays its signature loot once. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString ScenarioRun;
	/** The player's hits on it: a scenario kill pays only after 5 (scenario-loot.ts PARTICIPATION_HITS). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") int32 PlayerHits = 0;
	/** Seconds from summon to kill, negative when unknown (Vyrak's "Wings of the Ancient" challenge). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") double FightSeconds = -1;
	/** Player deaths during the fight, negative when unknown (Vyrak's "Unbroken Covenant" challenge). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") int32 FightDeaths = -1;
	/** True when the world killed it (safe-zone field, turrets) and the player had not hurt it recently. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bKilledByWorld = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FWFLevelUp, int32, NewLevel);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FWFLootGained, const FString&, ItemName, const FString&, Rarity);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FWFProgressionChanged);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FWFScenarioClaimed, const FString&, ScenarioId, bool, bPaid);

/**
 * The save and the reward pipeline. Owns the one wf::FProgression every system reads (quests included), pays kills
 * through the ported sim.ts / claimDrops / grantXP rules, and saves to a slot as JSON.
 */
UCLASS()
class WORLDFRACTURECORE_API UWFProgressionSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Fresh progression: first quest, starting worlds and shards from UWFCoreSettings, level 1. Not saved until SaveGame. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Progression") void NewGame();
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Progression") bool SaveGame();
	/** Loads the slot if it exists. False (and progression unchanged) when there is no save or it cannot be read. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Progression") bool LoadGame();

	/** Pays a defeated enemy (sim.ts defeatMachine), then claims its drops and XP into the save, and tells the quest chain. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Rewards") EWFDefeatOutcome ReportEnemyDefeated(const FWFEnemyRewardInfo& Enemy);

	/** The Operator class (TITAN, HUNTER, WARLOCK): scenario journal, covenant bond and class rewards are kept per class. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Progression") bool SetIdentityClass(const FString& ClassId);
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") FString GetIdentityClass() const { return State.IdentityClass ? FString(UTF8_TO_TCHAR(State.IdentityClass->c_str())) : FString(); }

	/** A run id for a newly summoned Unique Scenario boss, in the web build's format (sim.ts summonScenario). */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Rewards") FString MintScenarioRun(const FString& ScenarioId);
	/** Counts a player death (sim.deaths); scenario fights measure deaths from the count at summon. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Rewards") void RecordPlayerDeath() { ++PlayerDeaths; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Rewards") int32 GetPlayerDeaths() const { return PlayerDeaths; }
	/** Encounter journal: has this class cleared the scenario (enc-done:<class>:<id>)? */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Rewards") bool HasClearedScenario(const FString& ScenarioId) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Rewards") bool IsBondedToVyrak() const { return wf::scenario::IsBonded(State, State.IdentityClass); }
	/** Unique Scenarios in a region (UniqueScenarios table), in table order. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Rewards") TArray<FString> GetScenariosInRegion(const FString& RegionId) const;

	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") int32 GetLevel() const { return static_cast<int32>(State.Level); }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetXp() const { return State.Xp; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetXpToNextLevel() const { return State.Level * wf::reward::XpPerLevel; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetMaterial(const FString& Material) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") int32 GetInventoryCount() const { return static_cast<int32>(State.Inventory.size()); }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetSessionCredits() const { return Tally.Credits; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") int32 GetSessionKills() const { return static_cast<int32>(Tally.Kills); }
	/** Difficulty reward factor (map-activities.ts CHALLENGES): 1 / 1.25 / 1.5. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetChallengeRewardScale() const;
	/** Difficulty enemy health factor: 1 / 1.4 / 1.8. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetChallengeEnemyHealthScale() const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") FString DescribeLoot() const;

	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Progression") FWFLevelUp OnLevelUp;
	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Progression") FWFLootGained OnLootGained;
	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Progression") FWFProgressionChanged OnProgressionChanged;
	/** A scenario kill was claimed: Paid says whether the run paid its signature loot (participation, first claim). */
	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Rewards") FWFScenarioClaimed OnScenarioClaimed;

	const wf::FProgression& Get() const { return State; }
	/** For other core systems (quests, missions) that change the save; call NotifyChanged after. */
	wf::FProgression& Mutable() { return State; }
	void NotifyChanged() { OnProgressionChanged.Broadcast(); }
	const wf::reward::FCatalog& GetRewardCatalog() const { return Catalog; }

	static const FString SlotName;

private:
	bool LoadRewardCatalog(FString& OutError);

	wf::FProgression State;
	wf::reward::FCatalog Catalog;
	wf::reward::FSimTally Tally;
	int32 PlayerDeaths = 0;
	int32 NextRunSerial = 0;
	TMap<FString, FString> ScenarioRegions; // scenario id -> region id, table order kept in ScenarioOrder
	TArray<FString> ScenarioOrder;
};
