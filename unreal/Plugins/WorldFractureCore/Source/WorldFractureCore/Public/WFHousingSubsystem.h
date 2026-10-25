#pragma once

#include "CoreMinimal.h"
#include "Core/WFHousingCore.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "WFHousingSubsystem.generated.h"

class UWFProgressionSubsystem;

/**
 * Homes on the ported housing.ts / residence-deeds.ts rules: the seven listed homes and the twelve city residences (one
 * time Nex purchases kept in the ledger), decor bought once and placed in any room of any owned home, and fleet builds
 * parked in an owned residence's garage bays.
 */
UCLASS()
class WORLDFRACTURECORE_API UWFHousingSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** A listed home or a city residence (by id). */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Housing") FString BuyProperty(const FString& Id);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Housing") FString BuyDecor(const FString& DecorId);
	/** Empty DecorId clears the slot. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Housing") FString PlaceDecor(const FString& HomeId, int32 RoomIndex, const FString& Slot, const FString& DecorId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Housing") FString Park(const FString& BuildId, const FString& ResidenceId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Housing") FString Unpark(const FString& BuildId);
	/** Every property and decor item with price, ownership, rooms, placed decor and parked vehicles. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Housing") TArray<FString> Describe() const;

	const wf::housing::FCatalog& Catalog() const { return Housing; }

private:
	UWFProgressionSubsystem* Progression() const;
	FString Done(const wf::housing::FResult& R);
	std::string BuildName(const std::string& Id) const;
	wf::housing::FCatalog Housing;
	std::map<std::string, std::string> FleetNames;
};
