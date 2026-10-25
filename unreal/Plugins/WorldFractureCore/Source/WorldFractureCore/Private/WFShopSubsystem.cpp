#include "WFShopSubsystem.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/GameInstance.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFDataFiles.h"
#include "WFProgressionSubsystem.h"
#include "WorldFractureCoreModule.h"

#include <cmath>

using WFData::ToF;
using WFData::ToStd;

namespace
{
	double ShopNowMs() { return std::floor((FDateTime::UtcNow() - FDateTime(1970, 1, 1)).GetTotalMilliseconds()); }
	TSharedPtr<FJsonObject> ShopJsonObject(const FString& Text)
	{
		TSharedPtr<FJsonObject> O;
		if (!Text.IsEmpty()) FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), O);
		return O;
	}
	bool ShopLoad(wf::shop::FCatalog& C, FString& Error)
	{
		TArray<TSharedPtr<FJsonObject>> Rows;
		if (!WFData::LoadRows(TEXT("WeaponManifest"), Rows, Error)) return false;
		for (const auto& R : Rows) C.Weapons.push_back({ToStd(WFData::Str(R, TEXT("Id"))), ToStd(WFData::Str(R, TEXT("DisplayName"))), ToStd(WFData::Str(R, TEXT("Tier"))), ToStd(WFData::Str(R, TEXT("Archetype"))), ToStd(WFData::Str(R, TEXT("Element")))});
		if (!WFData::LoadRows(TEXT("ArmorManifest"), Rows, Error)) return false;
		for (const auto& R : Rows) C.Armors.push_back({ToStd(WFData::Str(R, TEXT("Id"))), ToStd(WFData::Str(R, TEXT("DisplayName"))), ToStd(WFData::Str(R, TEXT("Tier"))), ToStd(WFData::Str(R, TEXT("Slot"))), ToStd(WFData::Str(R, TEXT("ClassId")))});
		if (!WFData::LoadRows(TEXT("WeaponCatalog"), Rows, Error)) return false;
		for (const auto& R : Rows)
		{
			wf::shop::FCatalogWeapon W;
			static_cast<wf::shop::FWeapon&>(W) = {ToStd(WFData::Str(R, TEXT("Id"))), ToStd(WFData::Str(R, TEXT("DisplayName"))), ToStd(WFData::Str(R, TEXT("Tier"))), ToStd(WFData::Str(R, TEXT("Archetype"))), ToStd(WFData::Str(R, TEXT("Element")))};
			W.Rarity = ToStd(WFData::Str(R, TEXT("Rarity"))); W.Via = ToStd(WFData::Str(R, TEXT("Via"))); W.Cls = ToStd(WFData::Str(R, TEXT("Cls")));
			C.Named.push_back(W);
		}
		// the armor collections are the ArmorSets rows with a family (armor-collections.ts COLLECTIONS order)
		if (!WFData::LoadRows(TEXT("ArmorSets"), Rows, Error)) return false;
		for (const auto& R : Rows)
		{
			wf::shop::FCollection Co;
			Co.Family = ToStd(WFData::Str(R, TEXT("Family")));
			if (Co.Family.empty()) continue;
			Co.Id = ToStd(WFData::Str(R, TEXT("Id"))); Co.Name = ToStd(WFData::Str(R, TEXT("DisplayName")));
			Co.VendorTier = static_cast<int>(WFData::Num(R, TEXT("VendorTier")));
			const TArray<TSharedPtr<FJsonValue>>* Sources = nullptr;
			if (R->TryGetArrayField(TEXT("Sources"), Sources)) for (const auto& V : *Sources) Co.Sources.push_back(ToStd(V->AsString()));
			if (const TSharedPtr<FJsonObject> Pieces = ShopJsonObject(WFData::Str(R, TEXT("PiecesJson")))) for (const auto& P : Pieces->Values) Co.Pieces[ToStd(P.Key)] = ToStd(P.Value->AsString());
			if (const TSharedPtr<FJsonObject> Two = ShopJsonObject(WFData::Str(R, TEXT("TwoJson")))) Co.TwoName = ToStd(Two->GetStringField(TEXT("name")));
			if (const TSharedPtr<FJsonObject> Four = ShopJsonObject(WFData::Str(R, TEXT("FourJson")))) Co.FourName = ToStd(Four->GetStringField(TEXT("name")));
			C.Collections.push_back(Co);
		}
		if (!WFData::LoadRows(TEXT("RegionalShops"), Rows, Error)) return false;
		for (const auto& R : Rows)
		{
			wf::shop::FShop S;
			S.Id = ToStd(WFData::Str(R, TEXT("Id"))); S.Name = ToStd(WFData::Str(R, TEXT("DisplayName"))); S.Kind = ToStd(WFData::Str(R, TEXT("Kind")));
			S.Place = ToStd(WFData::Str(R, TEXT("Place"))); S.Currency = ToStd(WFData::Str(R, TEXT("Currency")));
			S.X = WFData::Num(R, TEXT("X")); S.Z = WFData::Num(R, TEXT("Z")); S.PriceMult = WFData::Num(R, TEXT("PriceMult"), 1); S.MinLevel = WFData::Num(R, TEXT("MinLevel"), 1);
			S.VendorTier = static_cast<int>(WFData::Num(R, TEXT("VendorTier")));
			if (const TSharedPtr<FJsonObject> Req = ShopJsonObject(WFData::Str(R, TEXT("RequiresJson"))))
			{
				S.RequiresMission = ToStd(Req->GetStringField(TEXT("missionId")));
				S.RequiresLabel = ToStd(Req->GetStringField(TEXT("label")));
			}
			const FString Standing = WFData::Str(R, TEXT("MinStanding"));
			if (!Standing.IsEmpty()) S.MinStanding = ToStd(Standing);
			S.Faction = ToStd(WFData::Str(R, TEXT("Faction"))); S.District = ToStd(WFData::Str(R, TEXT("District"))); S.DistrictName = ToStd(WFData::Str(R, TEXT("DistrictName")));
			C.Shops.push_back(S);
		}
		return true;
	}
}

void UWFShopSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency<UWFProgressionSubsystem>();
	Super::Initialize(Collection);
	FString Error;
	if (!ShopLoad(Shops, Error)) UE_LOG(LogWorldFracture, Warning, TEXT("World Fracture shops: %s"), *Error);
	else UE_LOG(LogWorldFracture, Log, TEXT("World Fracture shops: %d shops, %d manifest weapons, %d collections"), static_cast<int32>(Shops.Shops.size()), static_cast<int32>(Shops.Weapons.size()), static_cast<int32>(Shops.Collections.size()));
}

UWFProgressionSubsystem* UWFShopSubsystem::Progression() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>() : nullptr;
}

const wf::shop::FShop* UWFShopSubsystem::GetOpenShop() const { return Open.IsEmpty() ? nullptr : Shops.Find(ToStd(Open)); }

FString UWFShopSubsystem::OpenShop(const FString& ShopId)
{
	for (const wf::shop::FShop& S : Shops.Shops)
		if (ToF(S.Id).Equals(ShopId, ESearchCase::IgnoreCase) || ToF(S.Name).Equals(ShopId, ESearchCase::IgnoreCase)) { Open = ToF(S.Id); return FString(); }
	return FString::Printf(TEXT("Unknown shop %s (ListShops)"), *ShopId);
}

std::vector<wf::shop::FOffer> UWFShopSubsystem::GetOffers() const
{
	const wf::shop::FShop* S = GetOpenShop();
	const UWFProgressionSubsystem* P = Progression();
	if (!S || !P) return {};
	const double Now = ShopNowMs();
	return wf::shop::ShopOffers(Shops, *S, wf::shop::Today(Now), wf::shop::ShopPriceMult(*S, P->Get(), Now));
}

FString UWFShopSubsystem::GetLock() const
{
	const wf::shop::FShop* S = GetOpenShop();
	const UWFProgressionSubsystem* P = Progression();
	if (!S || !P) return FString();
	const std::optional<std::string> Lock = wf::shop::ShopLock(*S, P->Get(), ShopNowMs(), WorldHour);
	return Lock ? ToF(*Lock) : FString();
}

double UWFShopSubsystem::GetCurrencyBalance() const
{
	const wf::shop::FShop* S = GetOpenShop();
	const UWFProgressionSubsystem* P = Progression();
	if (!S || !P) return 0;
	const auto It = P->Get().Materials.find(S->Currency);
	return It == P->Get().Materials.end() ? 0 : It->second;
}

FString UWFShopSubsystem::Buy(int32 OfferIndex)
{
	const wf::shop::FShop* S = GetOpenShop();
	UWFProgressionSubsystem* P = Progression();
	if (!S || !P) return TEXT("No shop open (Shop <id>)");
	const std::vector<wf::shop::FOffer> Offers = GetOffers();
	if (OfferIndex < 0 || OfferIndex >= static_cast<int32>(Offers.size())) return TEXT("No such offer");
	const wf::shop::FResult R = wf::shop::BuyOffer(P->GetRewardCatalog(), P->Mutable(), *S, Offers[static_cast<size_t>(OfferIndex)], ShopNowMs(), WorldHour, FMath::FRand());
	if (R.bOk) P->NotifyChanged();
	return ToF(R.Message);
}

FString UWFShopSubsystem::Service(const FString& ItemId, const FString& Element)
{
	const wf::shop::FShop* S = GetOpenShop();
	UWFProgressionSubsystem* P = Progression();
	if (!S || !P) return TEXT("No shop open (Shop <id>)");
	const std::optional<std::string> El = Element.IsEmpty() ? std::nullopt : std::optional<std::string>(ToStd(Element.ToUpper()));
	const wf::shop::FResult R = wf::shop::ServiceGear(P->Mutable(), *S, ToStd(ItemId), El, ShopNowMs(), WorldHour);
	if (R.bOk) P->NotifyChanged();
	return ToF(R.Message);
}

TArray<FString> UWFShopSubsystem::DescribeShops() const
{
	TArray<FString> Out;
	const UWFProgressionSubsystem* P = Progression();
	const double Now = ShopNowMs();
	for (const wf::shop::FShop& S : Shops.Shops)
	{
		const std::optional<std::string> Lock = P ? wf::shop::ShopLock(S, P->Get(), Now, WorldHour) : std::nullopt;
		Out.Add(FString::Printf(TEXT("%-20s %-26s %-12s %-28s %-16s %s"), *ToF(S.Id), *ToF(S.Name), *ToF(S.Kind), *ToF(S.Place), *ToF(S.Currency), Lock ? *ToF(*Lock) : TEXT("open")));
	}
	return Out;
}
