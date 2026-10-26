#pragma once

#include "CoreMinimal.h"
#include "Core/WFShopCore.h"
#include "Subsystems/GameInstanceSubsystem.h"

#include <optional>
#include <vector>

#include "WFShopSubsystem.generated.h"

class UWFProgressionSubsystem;

/**
 * The regional merchants on the ported regional-shops.ts / living-world.ts rules: the 21 shops, today's stock at today's
 * prices, the gates (level, story, hours, faction standing, fallen districts), buying, and gear services (upgrades,
 * infusions). Opening a shop picks it; Buy and Service act on the open one.
 */
UCLASS()
class WORLDFRACTURECORE_API UWFShopSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Opens a shop by id (or display name). Returns "" or why not (unknown id). The stock shows whatever the gate says. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Shops") FString OpenShop(const FString& ShopId);
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Shops") void CloseShop() { Open.Reset(); }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Shops") bool IsShopOpen() const { return !Open.IsEmpty(); }
	/** Buys the open shop's offer (index into GetOffers). Returns the message to show. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Shops") FString Buy(int32 OfferIndex);
	/** Upgrade (gunsmith / armorsmith / vehicle shops) or infuse (mod shops, Element THERMAL|CRYO|ARC|BIO) an inventory item. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Shops") FString Service(const FString& ItemId, const FString& Element);
	/** One line per shop: name, kind, place, currency, and why it is closed to you (if it is). */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Shops") TArray<FString> DescribeShops() const;
	/** The world clock hour for shop hours (shop-hours.ts); negative = unset, every shop open. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Shops") void SetWorldHour(float Hour) { WorldHour = Hour < 0 ? std::nullopt : std::optional<double>(Hour); }
	/** the world clock (ShopHour), if one was set */
	std::optional<double> GetWorldHour() const { return WorldHour; }

	const wf::shop::FShop* GetOpenShop() const;
	/** Today's stock of the open shop at today's prices (standing, secured district). */
	std::vector<wf::shop::FOffer> GetOffers() const;
	/** Why the open shop won't trade right now, or "". */
	FString GetLock() const;
	double GetCurrencyBalance() const;
	const wf::shop::FCatalog& Catalog() const { return Shops; }

private:
	UWFProgressionSubsystem* Progression() const;
	wf::shop::FCatalog Shops;
	FString Open;
	std::optional<double> WorldHour;
};
