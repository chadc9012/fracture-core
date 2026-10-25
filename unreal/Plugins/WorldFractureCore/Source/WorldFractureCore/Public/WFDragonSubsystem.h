#pragma once

#include "CoreMinimal.h"
#include "Core/WFDragonCore.h"
#include "Core/WFDragoniteCastCore.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "WFDragonSubsystem.generated.h"

class UWFProgressionSubsystem;

/**
 * Dragonite and Vyrak for the current Operator class (ported dragonite.ts / vyrak-trust.ts rules, state in the save's
 * earnedRewards and materials): ability upgrades and numbers, trust and its stages, the Ancient Bond (riding) and Eternal
 * Covenant ceremonies, the riding gate, and the cast runtime (cooldowns, energy, Dragonhide, Skyfall's dive, the Wyrm)
 * that AWFCharacter drives through the ported dragonite-cast.ts rules.
 */
UCLASS()
class WORLDFRACTURECORE_API UWFDragonSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") bool IsBonded() const;
	/** Spends Dragonite (3 / 6 / 10 / 15) on the next upgrade of an ability. Returns "" on success, else why not. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Dragon") FString UpgradeAbility(const FString& Ability);
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") int32 GetUpgradeLevel(const FString& Ability) const;
	/** One number of an ability (cooldown, energy, damage, range, duration, ...) for this class's upgrades and worn armor. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") double GetAbilityStat(const FString& Ability, const FString& Stat) const;

	/** Records a one-time trust source: Kind ruin | puzzle | protect. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Dragon") void RecordTrust(const FString& Kind, const FString& SourceId);
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") double GetTrust() const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") int32 GetTrustStage() const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") FString GetTrustStageName() const;
	/** The Ancient Bond ceremony (full trust): unlocks riding and grants the Wingmantle. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Dragon") bool ClaimAncientBond(FString& OutReason);
	/** The Eternal Covenant (after the Ancient Bond, all three challenges): grants the Eternal Crest. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Dragon") bool ClaimEternalCovenant();
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") bool CanRide(const FString& RegionId, bool bInDungeon, bool bInStoryMission, bool bIndoors, FString& OutReason) const;

	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") FString GetWyrmState() const { return FString(wf::dragon::WyrmStateName(CastRuntime.Wyrm.State)); }
	/** Seconds left on an ability's cooldown. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") float GetCooldown(const FString& Ability) const;
	/** Ability energy, 0..100: Dragonite casts spend it, it refills 9 per second (live-build.ts). */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") float GetEnergy() const { return static_cast<float>(Energy); }

	/** The cast runtime and energy pool the character's casts run on. */
	wf::dragoncast::FRuntime& Runtime() { return CastRuntime; }
	double& EnergyPool() { return Energy; }
	/** Rules context: this save's earned keys, gear and class. Valid until the save changes. */
	wf::dragoncast::FContext MakeContext() const;

private:
	const wf::FProgression& St() const;
	std::optional<std::string> OperatorClass() const;
	UWFProgressionSubsystem* Progression() const;

	wf::dragoncast::FRuntime CastRuntime;
	double Energy = wf::dragoncast::EnergyMax;
};
