#include "WFHousingSubsystem.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/GameInstance.h"
#include "WFDataFiles.h"
#include "WFProgressionSubsystem.h"
#include "WorldFractureCoreModule.h"

using WFData::ToF;
using WFData::ToStd;

namespace
{
	std::vector<std::string> HouseStrings(const TSharedPtr<FJsonObject>& Row, const TCHAR* Field)
	{
		std::vector<std::string> Out;
		const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
		if (Row->TryGetArrayField(Field, A)) for (const auto& V : *A) Out.push_back(ToStd(V->AsString()));
		return Out;
	}
}

void UWFHousingSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency<UWFProgressionSubsystem>();
	Super::Initialize(Collection);
	FString Error;
	TArray<TSharedPtr<FJsonObject>> Rows;
	if (WFData::LoadRows(TEXT("Homes"), Rows, Error))
		for (const auto& R : Rows)
		{
			wf::housing::FHome H;
			H.Id = ToStd(WFData::Str(R, TEXT("Id"))); H.Name = ToStd(WFData::Str(R, TEXT("DisplayName"))); H.Kind = ToStd(WFData::Str(R, TEXT("Kind")));
			H.District = ToStd(WFData::Str(R, TEXT("District"))); H.RegionId = ToStd(WFData::Str(R, TEXT("RegionId"))); H.Garage = ToStd(WFData::Str(R, TEXT("Garage")));
			H.Blurb = ToStd(WFData::Str(R, TEXT("Blurb"))); H.Price = WFData::Num(R, TEXT("Price")); H.Rooms = HouseStrings(R, TEXT("Rooms"));
			Housing.Homes.push_back(H);
		}
	if (WFData::LoadRows(TEXT("Decor"), Rows, Error))
		for (const auto& R : Rows)
			Housing.Decor.push_back({ToStd(WFData::Str(R, TEXT("Id"))), ToStd(WFData::Str(R, TEXT("DisplayName"))), ToStd(WFData::Str(R, TEXT("Slot"))), WFData::Num(R, TEXT("Price")), HouseStrings(R, TEXT("Rooms"))});
	if (WFData::LoadRows(TEXT("Residences"), Rows, Error))
		for (const auto& R : Rows)
		{
			wf::housing::FDeed D;
			D.Id = ToStd(WFData::Str(R, TEXT("Id"))); D.Name = ToStd(WFData::Str(R, TEXT("DisplayName"))); D.Address = ToStd(WFData::Str(R, TEXT("Address")));
			D.Kind = ToStd(WFData::Str(R, TEXT("Kind"))); D.Style = ToStd(WFData::Str(R, TEXT("Style"))); D.City = ToStd(WFData::Str(R, TEXT("City")));
			D.District = ToStd(WFData::Str(R, TEXT("District"))); D.Blurb = ToStd(WFData::Str(R, TEXT("Blurb")));
			D.Price = WFData::Num(R, TEXT("Price")); D.Bays = WFData::Num(R, TEXT("Bays")); D.X = WFData::Num(R, TEXT("X")); D.Z = WFData::Num(R, TEXT("Z"));
			Housing.Deeds.push_back(D);
		}
	if (WFData::LoadRows(TEXT("Fleet"), Rows, Error))
		for (const auto& R : Rows)
		{
			const std::string Id = ToStd(WFData::Str(R, TEXT("Id")));
			Housing.FleetIds.push_back(Id);
			FleetNames[Id] = ToStd(WFData::Str(R, TEXT("DisplayName")));
		}
	UE_LOG(LogWorldFracture, Log, TEXT("World Fracture housing: %d homes, %d residences, %d decor items"), static_cast<int32>(Housing.Homes.size()), static_cast<int32>(Housing.Deeds.size()), static_cast<int32>(Housing.Decor.size()));
}

UWFProgressionSubsystem* UWFHousingSubsystem::Progression() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>() : nullptr;
}

std::string UWFHousingSubsystem::BuildName(const std::string& Id) const
{
	const auto It = FleetNames.find(Id);
	return It == FleetNames.end() ? Id : It->second;
}

FString UWFHousingSubsystem::Done(const wf::housing::FResult& R)
{
	if (R.bOk) if (UWFProgressionSubsystem* P = Progression()) P->NotifyChanged();
	return ToF(R.Message);
}

FString UWFHousingSubsystem::BuyProperty(const FString& Id)
{
	UWFProgressionSubsystem* P = Progression();
	if (!P) return FString();
	wf::housing::NormalizeHousing(Housing, P->Mutable().Housing); // housing.ts normalizeHousing, as the web build does on load
	const std::string S = ToStd(Id);
	return Done(Housing.Deed(S) ? wf::housing::BuyDeed(Housing, P->Mutable(), S) : wf::housing::BuyHome(Housing, P->Mutable(), S));
}

FString UWFHousingSubsystem::BuyDecor(const FString& Id)
{
	UWFProgressionSubsystem* P = Progression();
	return P ? Done(wf::housing::BuyDecor(Housing, P->Mutable(), ToStd(Id))) : FString();
}

FString UWFHousingSubsystem::PlaceDecor(const FString& HomeId, int32 RoomIndex, const FString& Slot, const FString& DecorId)
{
	UWFProgressionSubsystem* P = Progression();
	if (!P) return FString();
	wf::housing::NormalizeHousing(Housing, P->Mutable().Housing);
	return Done(wf::housing::PlaceDecor(Housing, P->Mutable(), ToStd(HomeId), RoomIndex, ToStd(Slot.ToLower()), DecorId.IsEmpty() ? std::nullopt : std::optional<std::string>(ToStd(DecorId))));
}

FString UWFHousingSubsystem::Park(const FString& BuildId, const FString& ResidenceId)
{
	UWFProgressionSubsystem* P = Progression();
	return P ? Done(wf::housing::ParkVehicle(Housing, P->Mutable(), ToStd(BuildId), ToStd(ResidenceId), BuildName(ToStd(BuildId)))) : FString();
}

FString UWFHousingSubsystem::Unpark(const FString& BuildId)
{
	UWFProgressionSubsystem* P = Progression();
	return P ? Done(wf::housing::UnparkVehicle(Housing, P->Mutable(), ToStd(BuildId), BuildName(ToStd(BuildId)))) : FString();
}

TArray<FString> UWFHousingSubsystem::Describe() const
{
	TArray<FString> Out;
	const UWFProgressionSubsystem* P = Progression();
	if (!P) return Out;
	const wf::FProgression& S = P->Get();
	for (const auto& H : Housing.Homes)
	{
		FString Rooms;
		for (size_t I = 0; I < H.Rooms.size(); ++I)
		{
			Rooms += FString::Printf(TEXT(" %d:%s"), static_cast<int32>(I), *ToF(H.Rooms[I]));
			const auto Placed = S.Housing.Placed.find(H.Id);
			if (Placed != S.Housing.Placed.end())
				for (const auto& [Key, Decor] : Placed->second) if (Key.rfind(std::to_string(I) + ":", 0) == 0) Rooms += FString::Printf(TEXT("[%s]"), *ToF(Decor));
		}
		Out.Add(FString::Printf(TEXT("HOME  %-20s %-26s %-16s %8s Nex%s%s  rooms:%s"), *ToF(H.Id), *ToF(H.Name), *ToF(H.Kind), *FString::Printf(TEXT("%g"), H.Price),
			wf::housing::OwnsHome(S, H.Id) ? TEXT(" [owned]") : TEXT(""), S.Housing.Home == std::optional<std::string>(H.Id) ? TEXT(" [home]") : TEXT(""), *Rooms));
	}
	for (const auto& D : Housing.Deeds)
	{
		FString Parked;
		for (const std::string& V : wf::housing::ParkedIn(Housing, S, D.Id)) Parked += FString::Printf(TEXT(" %s"), *ToF(V));
		Out.Add(FString::Printf(TEXT("RES   %-14s %-22s %-18s %-10s %8s Nex  %g bays%s%s"), *ToF(D.Id), *ToF(D.Address), *ToF(D.Style), *ToF(D.City), *FString::Printf(TEXT("%g"), D.Price), D.Bays,
			wf::housing::OwnsHome(S, D.Id) ? TEXT(" [owned]") : TEXT(""), Parked.IsEmpty() ? TEXT("") : *FString::Printf(TEXT("  parked:%s"), *Parked)));
	}
	for (const auto& D : Housing.Decor)
		Out.Add(FString::Printf(TEXT("DECOR %-18s %-24s %-10s %6g Nex%s"), *ToF(D.Id), *ToF(D.Name), *ToF(D.Slot), D.Price, wf::housing::OwnsDecor(S, D.Id) ? TEXT(" [owned]") : TEXT("")));
	return Out;
}
