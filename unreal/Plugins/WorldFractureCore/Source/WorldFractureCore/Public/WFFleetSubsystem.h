#pragma once

#include "CoreMinimal.h"
#include "Core/WFFleetCore.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "WFFleetSubsystem.generated.h"

class UWFProgressionSubsystem;

/**
 * The vehicle fleet on the ported fleet.ts rules: the four garage bases, the 21 named builds (each a tuned, painted
 * version of one of the 14 chassis, bought with materials and Nex at its home base), the active build, tuning nodes,
 * paint and cosmetics. The active build decides which chassis you drive, its tuned stats, its hardpoints and its gadget.
 */
UCLASS()
class WORLDFRACTURECORE_API UWFFleetSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	UFUNCTION(BlueprintCallable, Category = "World Fracture|Fleet") FString BuyGarage(const FString& GarageId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Fleet") FString BuyBuild(const FString& BuildId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Fleet") FString SetActive(const FString& BuildId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Fleet") FString Tune(const FString& BuildId, const FString& NodeId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Fleet") FString Paint(const FString& BuildId, const FString& PaintName);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Fleet") FString Cosmetic(const FString& BuildId, const FString& Key, const FString& Value);
	/** One line per garage base and per build: cost, where it is bought, owned / active, tuning. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Fleet") TArray<FString> DescribeFleet() const;

	/** The active build's id when it is built on this chassis (its hardpoints, gadget and tuning apply), else "". */
	std::string BuildFor(const std::string& ChassisId) const;
	const wf::fleet::FCatalog& Catalog() const { return Fleet; }

private:
	UWFProgressionSubsystem* Progression() const;
	FString Done(const wf::fleet::FResult& R);
	wf::fleet::FCatalog Fleet;
};
