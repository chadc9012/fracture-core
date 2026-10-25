#pragma once

#include "CoreMinimal.h"
#include "Core/WFDragonCore.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "WFDragonSubsystem.generated.h"

class UWFProgressionSubsystem;

/** An enemy the Wyrm can see this frame. Id must stay the same for the same enemy across frames. */
USTRUCT(BlueprintType)
struct WORLDFRACTURECORE_API FWFWyrmTarget
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wyrm") int32 Id = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wyrm") double DistanceMeters = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wyrm") bool bBoss = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wyrm") bool bWindingUp = false;
};

/** What the Wyrm does this frame. Kind is empty when it does nothing. */
USTRUCT(BlueprintType)
struct WORLDFRACTURECORE_API FWFWyrmAction
{
	GENERATED_BODY()
	/** strafe | breath | finisher (damage) or interrupt (stun 1.5 s). */
	UPROPERTY(BlueprintReadOnly, Category = "Wyrm") FString Kind;
	UPROPERTY(BlueprintReadOnly, Category = "Wyrm") int32 TargetId = 0;
	/** Damage to apply: wyrmcall damage, x1.5 for breath, x3 for the finisher, 0 for an interrupt (dragonite-cast.ts). */
	UPROPERTY(BlueprintReadOnly, Category = "Wyrm") double Damage = 0;
};

/**
 * Dragonite and Vyrak for the current Operator class (ported dragonite.ts / vyrak-trust.ts rules, state in the save's
 * earnedRewards and materials): ability upgrades and numbers, trust and its stages, the Ancient Bond (riding) and Eternal
 * Covenant ceremonies, the riding gate, and the Wyrmcall ally's state machine.
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

	/** Casts Wyrmcall: bond and cooldown checked (energy is not modelled in Unreal yet). Returns the HUD text. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Dragon") FString CastWyrmcall(bool& bOutOk);
	/** Advances cooldowns and the Wyrm. Call every frame with the enemies within 40 m. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Dragon") FWFWyrmAction TickDragon(float DeltaSeconds, const TArray<FWFWyrmTarget>& Targets, bool& bOutWithdrew);
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") FString GetWyrmState() const { return FString(wf::dragon::WyrmStateName(Wyrm.State)); }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Dragon") float GetWyrmcallCooldown() const { return static_cast<float>(WyrmcallCooldown); }

private:
	const wf::FProgression& St() const;
	std::optional<std::string> OperatorClass() const;
	UWFProgressionSubsystem* Progression() const;

	wf::dragon::FWyrm Wyrm;
	double WyrmcallCooldown = 0; // cast cooldown (dragonite-cast.ts rt.cd.wyrmcall)
};
