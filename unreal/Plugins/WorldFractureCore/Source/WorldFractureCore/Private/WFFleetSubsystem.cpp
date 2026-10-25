#include "WFFleetSubsystem.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/GameInstance.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFDataFiles.h"
#include "WFProgressionSubsystem.h"
#include "WorldFractureCoreModule.h"

#include <algorithm>

using WFData::ToF;
using WFData::ToStd;

namespace
{
	wf::fleet::FCost FleetCost(const TSharedPtr<FJsonObject>& O)
	{
		wf::fleet::FCost C;
		if (O.IsValid()) for (const auto& Pair : O->Values) C.push_back({ToStd(Pair.Key), Pair.Value->AsNumber()}); // insertion order, as the web build iterates
		return C;
	}
	TSharedPtr<FJsonObject> FleetObject(const FString& Text)
	{
		TSharedPtr<FJsonObject> O;
		if (!Text.IsEmpty()) FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), O);
		return O;
	}
	std::vector<std::string> FleetStrings(const TSharedPtr<FJsonObject>& Row, const TCHAR* Field)
	{
		std::vector<std::string> Out;
		const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
		if (Row->TryGetArrayField(Field, A)) for (const auto& V : *A) Out.push_back(ToStd(V->AsString()));
		return Out;
	}
}

void UWFFleetSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency<UWFProgressionSubsystem>();
	Super::Initialize(Collection);
	FString Error;
	TArray<TSharedPtr<FJsonObject>> Rows;
	if (WFData::LoadRows(TEXT("Garages"), Rows, Error))
		for (const auto& R : Rows)
			Fleet.Garages.push_back({ToStd(WFData::Str(R, TEXT("Id"))), ToStd(WFData::Str(R, TEXT("DisplayName"))), ToStd(WFData::Str(R, TEXT("Region"))), WFData::Num(R, TEXT("X")), WFData::Num(R, TEXT("Z")),
				WFData::Num(R, TEXT("DeckY")) != 0, FleetCost(FleetObject(WFData::Str(R, TEXT("CostJson"))))});
	if (WFData::LoadRows(TEXT("Fleet"), Rows, Error))
		for (const auto& R : Rows)
		{
			wf::fleet::FEntry E;
			E.Id = ToStd(WFData::Str(R, TEXT("Id"))); E.Name = ToStd(WFData::Str(R, TEXT("DisplayName"))); E.Category = ToStd(WFData::Str(R, TEXT("Category")));
			E.Base = ToStd(WFData::Str(R, TEXT("Base"))); E.Garage = ToStd(WFData::Str(R, TEXT("Garage"))); E.Ability = ToStd(WFData::Str(R, TEXT("Ability")));
			E.Cost = FleetCost(FleetObject(WFData::Str(R, TEXT("CostJson"))));
			E.Hardpoints = FleetStrings(R, TEXT("Hardpoints"));
			E.Paints = FleetStrings(R, TEXT("Paints"));
			E.NexPrice = WFData::Num(R, TEXT("NexPrice"));
			TArray<TSharedPtr<FJsonValue>> Nodes;
			FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(R, TEXT("NodesJson"))), Nodes);
			for (const auto& V : Nodes)
			{
				const TSharedPtr<FJsonObject> N = V->AsObject();
				if (!N.IsValid()) continue;
				const TSharedPtr<FJsonObject>* Cost = nullptr;
				E.Nodes.push_back({ToStd(N->GetStringField(TEXT("id"))), ToStd(N->GetStringField(TEXT("name"))), ToStd(N->GetStringField(TEXT("text"))), ToStd(N->GetStringField(TEXT("stat"))),
					N->GetNumberField(TEXT("perLevel")), N->GetNumberField(TEXT("maxLevel")), N->TryGetObjectField(TEXT("cost"), Cost) && Cost ? FleetCost(*Cost) : wf::fleet::FCost{}});
			}
			Fleet.Fleet.push_back(E);
		}
	if (Fleet.Fleet.empty()) UE_LOG(LogWorldFracture, Warning, TEXT("World Fracture fleet: %s"), *Error);
	else UE_LOG(LogWorldFracture, Log, TEXT("World Fracture fleet: %d builds, %d garage bases"), static_cast<int32>(Fleet.Fleet.size()), static_cast<int32>(Fleet.Garages.size()));
}

UWFProgressionSubsystem* UWFFleetSubsystem::Progression() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>() : nullptr;
}

FString UWFFleetSubsystem::Done(const wf::fleet::FResult& R)
{
	if (R.bOk) if (UWFProgressionSubsystem* P = Progression()) P->NotifyChanged();
	return ToF(R.Message);
}

FString UWFFleetSubsystem::BuyGarage(const FString& Id)
{
	UWFProgressionSubsystem* P = Progression();
	return P ? Done(wf::fleet::BuyGarage(Fleet, P->Mutable(), ToStd(Id))) : FString();
}
FString UWFFleetSubsystem::BuyBuild(const FString& Id)
{
	UWFProgressionSubsystem* P = Progression();
	return P ? Done(wf::fleet::BuyFleetVehicle(Fleet, P->Mutable(), P->MutableGarage(), ToStd(Id))) : FString();
}
FString UWFFleetSubsystem::SetActive(const FString& Id)
{
	UWFProgressionSubsystem* P = Progression();
	return P ? Done(wf::fleet::SetActiveFleet(Fleet, P->Mutable(), P->MutableGarage(), ToStd(Id))) : FString();
}
FString UWFFleetSubsystem::Tune(const FString& Id, const FString& Node)
{
	UWFProgressionSubsystem* P = Progression();
	return P ? Done(wf::fleet::TuneNode(Fleet, P->Mutable(), ToStd(Id), ToStd(Node))) : FString();
}
FString UWFFleetSubsystem::Paint(const FString& Id, const FString& PaintName)
{
	UWFProgressionSubsystem* P = Progression();
	return P ? Done(wf::fleet::SetPaint(Fleet, P->Mutable(), ToStd(Id), ToStd(PaintName))) : FString();
}
FString UWFFleetSubsystem::Cosmetic(const FString& Id, const FString& Key, const FString& Value)
{
	UWFProgressionSubsystem* P = Progression();
	return P ? Done(wf::fleet::SetCosmetic(Fleet, P->Mutable(), ToStd(Id), ToStd(Key.ToLower()), ToStd(Value.ToLower()))) : FString();
}

std::string UWFFleetSubsystem::BuildFor(const std::string& Chassis) const
{
	const UWFProgressionSubsystem* P = Progression();
	if (!P || !P->Get().Fleet.Active) return std::string();
	const wf::fleet::FEntry* E = Fleet.Find(*P->Get().Fleet.Active);
	return E && E->Base == Chassis ? E->Id : std::string();
}

TArray<FString> UWFFleetSubsystem::DescribeFleet() const
{
	TArray<FString> Out;
	const UWFProgressionSubsystem* P = Progression();
	if (!P) return Out;
	const auto& F = P->Get().Fleet;
	auto CostText = [](const wf::fleet::FCost& C) { FString S; for (const auto& [K, V] : C) S += FString::Printf(TEXT("%s%g %s"), S.IsEmpty() ? TEXT("") : TEXT(", "), V, *ToF(K)); return S; };
	for (const auto& G : Fleet.Garages)
		Out.Add(FString::Printf(TEXT("BASE  %-8s %-28s %-22s %s%s"), *ToF(G.Id), *ToF(G.Name), *ToF(G.Region), *CostText(G.Cost), std::find(F.Garages.begin(), F.Garages.end(), G.Id) != F.Garages.end() ? TEXT("   [owned]") : TEXT("")));
	for (const auto& E : Fleet.Fleet)
	{
		const bool bOwned = std::find(F.Owned.begin(), F.Owned.end(), E.Id) != F.Owned.end();
		FString Nodes;
		for (const auto& N : E.Nodes)
		{
			const auto T = F.Tuning.find(E.Id);
			const double L = T == F.Tuning.end() || !T->second.count(N.Id) ? 0 : T->second.at(N.Id);
			Nodes += FString::Printf(TEXT(" %s %g/%g"), *ToF(N.Id), L, N.MaxLevel);
		}
		Out.Add(FString::Printf(TEXT("BUILD %-22s %-26s %-8s on %-18s at %-8s %s + %s Nex%s%s  nodes:%s"), *ToF(E.Id), *ToF(E.Name), *ToF(E.Category), *ToF(E.Base), *ToF(E.Garage), *CostText(E.Cost),
			*ToF(wf::fleet::FormatInt(E.NexPrice)), bOwned ? TEXT("   [owned]") : TEXT(""), F.Active == std::optional<std::string>(E.Id) ? TEXT(" [active]") : TEXT(""), *Nodes));
	}
	return Out;
}
