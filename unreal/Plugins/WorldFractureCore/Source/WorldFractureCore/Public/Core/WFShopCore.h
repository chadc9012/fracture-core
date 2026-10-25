// World Fracture — the regional merchants: 21 walk-up shops across the regions, their daily stock, gates, prices and
// services, and the Living World standing that runs the city shops.
//
// Port of the web build's authoritative rules:
//   regional-shops.ts  shopOffers (daily rotation per shop: manifest weapons and armor, this week's named catalogue weapons,
//                      collection pieces up to the city's tier, black-market pieces, supply / vehicle / exotic material
//                      packs, Tuning Cores at mod shops, one daily deal), shopLock, shopPriceMult, buyOffer, serviceFee,
//                      serviceTargets, serviceGear (gunsmith / armorsmith / vehicle upgrades, mod-shop infusions)
//   weapon-catalog.ts  weeklyCatalogStock (Monday 00:00 UTC weeks)
//   armor-collections.ts vendorSellable
//   shop-hours.ts      city hours (closed 01:00-05:00), black markets at night, everything else always open
//   living-world.ts    reputation (gain - loss, -100..100), tiers HOSTILE..HONORED, adjustRep with rival spill, district
//                      status (STABLE / SECURED for 2 days / FALLEN), livingShopTerms
//   inventory.ts       gearCost, upgradeGear (level caps 10, +15 power), infuseGear;  upgrade-gates.ts upgradeGate
//   vendors.ts         listingToGearItem
// Golden-tested (Tests/ShopCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"
#include "Core/WFRewardCore.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::shop
{
	struct FWeapon { std::string Id, Name, Tier, Archetype, Element; };
	struct FArmor { std::string Id, Name, Tier, Slot, ClassId; };
	struct FCatalogWeapon : FWeapon { std::string Rarity, Via, Cls; };
	struct FCollection
	{
		std::string Id, Name, Family;
		std::vector<std::string> Sources;
		int VendorTier = 0; // 0 = never sold by vendors
		std::map<std::string, std::string> Pieces; // slot -> piece name
		std::string TwoName, FourName;
	};
	struct FShop
	{
		std::string Id, Name, Kind, Place, Currency;
		double X = 0, Z = 0, PriceMult = 1, MinLevel = 1;
		int VendorTier = 0;
		std::optional<std::string> RequiresMission, RequiresLabel, MinStanding;
		std::string Faction, District, DistrictName; // living-world.ts SHOP_FACTION and the district the shop stands in ("" outside the cities)
	};
	struct FCatalog
	{
		std::vector<FWeapon> Weapons;         // equipment.ts WEAPON_MANIFEST order
		std::vector<FArmor> Armors;           // ARMOR_MANIFEST order
		std::vector<FCatalogWeapon> Named;    // weapon-catalog.ts WEAPON_CATALOG order
		std::vector<FCollection> Collections; // armor-collections.ts COLLECTIONS order
		std::vector<FShop> Shops;             // REGIONAL_SHOPS order
		WORLDFRACTURECORE_API const FShop* Find(const std::string& Id) const;
	};

	WORLDFRACTURECORE_API double Today(double NowMs);
	WORLDFRACTURECORE_API std::vector<FCatalogWeapon> WeeklyCatalogStock(const FCatalog& C, const std::string& ShopId, double NowMs, int Count = 3);

	struct FListing { std::string Key, Kind; std::string ItemId, Name, Tier, Element, Archetype, Slot; double Power = 0; }; // Kind weapon | armor
	struct FOffer
	{
		std::string Key, Type, Name, Detail; // Type gear | piece | material
		double Price = 0, MinLevel = 1;
		std::optional<FListing> Listing;
		std::optional<reward::FSetDrop> Drop;
		bool bDeal = false;
		std::string Material;
		double Amount = 0;
	};
	inline constexpr double DailyDealOff = 0.3;
	WORLDFRACTURECORE_API std::vector<FOffer> ShopOffers(const FCatalog& C, const FShop& Shop, double Day, double Mult = 1);

	// ---- Living World ----
	struct FFaction { std::string Id, Name, Rival; };
	WORLDFRACTURECORE_API const FFaction* FactionById(const std::string& Id);
	WORLDFRACTURECORE_API double RepOf(const FProgression::FLiving& L, const std::string& Faction);
	WORLDFRACTURECORE_API std::string RepTier(double Rep);
	WORLDFRACTURECORE_API bool TierAtLeast(const std::string& Tier, const std::string& Min);
	struct FTierRule { bool bTrade = true; double PriceMult = 1; std::string Label; };
	WORLDFRACTURECORE_API FTierRule TierRule(const std::string& Tier);
	WORLDFRACTURECORE_API void AdjustRep(FProgression::FLiving& L, const std::string& Faction, double Amount, bool bSpill = true);
	inline constexpr double SecuredMs = 2 * 86400000.0;
	WORLDFRACTURECORE_API std::string DistrictStatus(const FProgression::FLiving& L, const std::string& District, double NowMs);
	WORLDFRACTURECORE_API void RecordDistrict(FProgression::FLiving& L, const std::string& District, bool bWon, double NowMs);
	struct FTerms { std::optional<std::string> Lock; double PriceMult = 1; };
	WORLDFRACTURECORE_API FTerms LivingShopTerms(const FProgression::FLiving* L, const FShop& Shop, double NowMs);

	// ---- hours ----
	/** Opening window (hours; close < open runs past midnight), or none = always open. */
	WORLDFRACTURECORE_API std::optional<std::pair<double, double>> ShopHours(const FShop& Shop);
	WORLDFRACTURECORE_API bool IsOpenAt(const std::optional<std::pair<double, double>>& Hours, std::optional<double> Hour);
	WORLDFRACTURECORE_API std::optional<std::string> ShopClosedReason(const FShop& Shop, std::optional<double> Hour);

	// ---- trading ----
	/** Why the shop won't trade (level, story, hours, standing, district), or none. Hour: the world clock, none = unset. */
	WORLDFRACTURECORE_API std::optional<std::string> ShopLock(const FShop& Shop, const FProgression& P, double NowMs, std::optional<double> Hour);
	WORLDFRACTURECORE_API double ShopPriceMult(const FShop& Shop, const FProgression& P, double NowMs);
	/** vendors.ts listingToGearItem: the new item's id is <item>-<now base36><one base36 digit from Random01>. */
	WORLDFRACTURECORE_API FGearItem ListingToGearItem(const FListing& L, const std::string& VendorName, double NowMs, double Random01);
	struct FResult { bool bOk = false; std::string Message; };
	WORLDFRACTURECORE_API FResult BuyOffer(const reward::FCatalog& Rewards, FProgression& P, const FShop& Shop, const FOffer& Offer, double NowMs, std::optional<double> Hour, double Random01);

	// ---- gear services (inventory.ts, upgrade-gates.ts) ----
	inline constexpr double GearLevelMax = 10;
	struct FCost { std::string Material; double Amount = 0; };
	WORLDFRACTURECORE_API FCost GearCost(const FGearItem& Item);
	WORLDFRACTURECORE_API std::optional<FCost> UpgradeGate(const FGearItem& Item);
	/** Returns false (unchanged) when capped or short of materials. */
	WORLDFRACTURECORE_API bool UpgradeGear(FProgression& P, const std::string& ItemId);
	WORLDFRACTURECORE_API bool InfuseGear(FProgression& P, const std::string& ItemId, const std::string& Element);
	WORLDFRACTURECORE_API double ServiceFee(const FShop& Shop, const FGearItem& Item);
	WORLDFRACTURECORE_API std::vector<std::string> ServiceTargets(const FShop& Shop, const FProgression& P);
	WORLDFRACTURECORE_API FResult ServiceGear(FProgression& P, const FShop& Shop, const std::string& ItemId, const std::optional<std::string>& Element, double NowMs, std::optional<double> Hour);
}
