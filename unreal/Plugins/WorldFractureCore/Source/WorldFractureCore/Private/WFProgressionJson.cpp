#include "WFProgressionJson.h"

#include "Core/WFAbilityCore.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "WFDataFiles.h"

using WFData::ToF;
using WFData::ToStd;

namespace
{
	TArray<TSharedPtr<FJsonValue>> StringArray(const std::vector<std::string>& Items)
	{
		TArray<TSharedPtr<FJsonValue>> Out;
		for (const std::string& Item : Items) Out.Add(MakeShared<FJsonValueString>(ToF(Item)));
		return Out;
	}

	TSharedRef<FJsonObject> NumberObject(const std::map<std::string, double>& Items)
	{
		TSharedRef<FJsonObject> Out = MakeShared<FJsonObject>();
		for (const auto& [Key, Value] : Items) Out->SetNumberField(ToF(Key), Value);
		return Out;
	}

	void OptionalString(const TSharedRef<FJsonObject>& O, const TCHAR* Field, const std::optional<std::string>& Value)
	{
		if (Value) O->SetStringField(Field, ToF(*Value));
		else O->SetField(Field, MakeShared<FJsonValueNull>());
	}

	std::vector<std::string> ReadStrings(const TSharedPtr<FJsonObject>& O, const TCHAR* Field)
	{
		std::vector<std::string> Out;
		const TArray<TSharedPtr<FJsonValue>>* Values = nullptr;
		if (O->TryGetArrayField(Field, Values))
			for (const TSharedPtr<FJsonValue>& V : *Values)
			{
				FString S;
				if (V.IsValid() && V->TryGetString(S)) Out.push_back(ToStd(S));
			}
		return Out;
	}

	std::map<std::string, double> ReadNumbers(const TSharedPtr<FJsonObject>& O, const TCHAR* Field)
	{
		std::map<std::string, double> Out;
		const TSharedPtr<FJsonObject>* Object = nullptr;
		if (O->TryGetObjectField(Field, Object) && Object && Object->IsValid())
			for (const auto& Pair : (*Object)->Values)
			{
				double Number = 0;
				if (Pair.Value.IsValid() && Pair.Value->TryGetNumber(Number)) Out[ToStd(Pair.Key)] = Number;
			}
		return Out;
	}

	std::optional<std::string> ReadOptionalString(const TSharedPtr<FJsonObject>& O, const TCHAR* Field)
	{
		FString S;
		if (O->TryGetStringField(Field, S)) return ToStd(S);
		return std::nullopt;
	}
}

namespace WFProgressionJson
{
	wf::FGearItem GearFromJson(const TSharedPtr<FJsonObject>& Item)
	{
		wf::FGearItem G;
		if (!Item.IsValid()) return G;
		G.Id = ToStd(WFData::Str(Item, TEXT("id")));
		G.Name = ToStd(WFData::Str(Item, TEXT("name")));
		G.Slot = ToStd(WFData::Str(Item, TEXT("slot")));
		G.Power = WFData::Num(Item, TEXT("power"));
		G.Level = WFData::Num(Item, TEXT("level"), 1.0);
		G.Element = ToStd(WFData::Str(Item, TEXT("element")));
		G.Source = ToStd(WFData::Str(Item, TEXT("source")));
		G.SetId = ReadOptionalString(Item, TEXT("setId"));
		G.Rarity = ReadOptionalString(Item, TEXT("rarity"));
		G.Perk = ReadOptionalString(Item, TEXT("perk"));
		return G;
	}

	TSharedRef<FJsonObject> GearToJson(const wf::FGearItem& G)
	{
		TSharedRef<FJsonObject> Item = MakeShared<FJsonObject>();
		Item->SetStringField(TEXT("id"), ToF(G.Id));
		Item->SetStringField(TEXT("name"), ToF(G.Name));
		Item->SetStringField(TEXT("slot"), ToF(G.Slot));
		Item->SetNumberField(TEXT("power"), G.Power);
		Item->SetNumberField(TEXT("level"), G.Level);
		Item->SetStringField(TEXT("element"), ToF(G.Element));
		Item->SetStringField(TEXT("source"), ToF(G.Source));
		if (G.SetId) Item->SetStringField(TEXT("setId"), ToF(*G.SetId));
		if (G.Rarity) Item->SetStringField(TEXT("rarity"), ToF(*G.Rarity));
		if (G.Perk) Item->SetStringField(TEXT("perk"), ToF(*G.Perk));
		return Item;
	}

	FString ToJson(const wf::FProgression& P, const wf::FGarage* Garage)
	{
		TSharedRef<FJsonObject> O = MakeShared<FJsonObject>();
		OptionalString(O, TEXT("activeQuestId"), P.ActiveQuestId);
		O->SetArrayField(TEXT("completedMissions"), StringArray(P.CompletedMissions));
		TSharedRef<FJsonObject> Progress = MakeShared<FJsonObject>();
		for (const auto& [Quest, Values] : P.QuestObjectiveProgress)
		{
			TArray<TSharedPtr<FJsonValue>> Array;
			for (const double V : Values) Array.Add(MakeShared<FJsonValueNumber>(V));
			Progress->SetArrayField(ToF(Quest), Array);
		}
		O->SetObjectField(TEXT("questObjectiveProgress"), Progress);
		O->SetArrayField(TEXT("unlockedWorlds"), StringArray(P.UnlockedWorlds));
		TSharedRef<FJsonObject> Flags = MakeShared<FJsonObject>();
		for (const auto& [World, Flag] : P.WorldFlags) Flags->SetBoolField(ToF(World), Flag);
		O->SetObjectField(TEXT("worldFlags"), Flags);
		O->SetStringField(TEXT("currentWorld"), ToF(P.CurrentWorld));
		O->SetNumberField(TEXT("corruptionLevel"), P.CorruptionLevel);
		O->SetNumberField(TEXT("fractureShards"), P.FractureShards);
		O->SetObjectField(TEXT("materials"), NumberObject(P.Materials));
		O->SetObjectField(TEXT("dungeonClears"), NumberObject(P.DungeonClears));

		TArray<TSharedPtr<FJsonValue>> Inventory;
		for (const wf::FGearItem& G : P.Inventory) Inventory.Add(MakeShared<FJsonValueObject>(GearToJson(G)));
		O->SetArrayField(TEXT("inventory"), Inventory);
		TSharedRef<FJsonObject> Equipped = MakeShared<FJsonObject>();
		for (const auto& [Slot, Id] : P.EquippedGear) Equipped->SetStringField(ToF(Slot), ToF(Id));
		O->SetObjectField(TEXT("equippedGear"), Equipped);

		O->SetNumberField(TEXT("level"), P.Level);
		O->SetNumberField(TEXT("xp"), P.Xp);
		O->SetNumberField(TEXT("calibrationTokens"), P.CalibrationTokens);
		O->SetNumberField(TEXT("novaLevel"), P.NovaLevel);
		O->SetArrayField(TEXT("novaUnlocks"), StringArray(P.NovaUnlocks));
		OptionalString(O, TEXT("identityClass"), P.IdentityClass);
		O->SetStringField(TEXT("challenge"), ToF(P.Challenge));
		O->SetArrayField(TEXT("earnedRewards"), StringArray(P.EarnedRewards));
		O->SetArrayField(TEXT("unlockedAbilities"), StringArray(P.UnlockedAbilities));
		TSharedRef<FJsonObject> Build = MakeShared<FJsonObject>();
		Build->SetStringField(TEXT("mode"), ToF(P.ActiveBuildMode));
		TSharedRef<FJsonObject> BuildSlots = MakeShared<FJsonObject>();
		for (const auto& [Slot, Id] : P.ActiveBuildSlots) BuildSlots->SetStringField(ToF(Slot), ToF(Id));
		Build->SetObjectField(TEXT("slots"), BuildSlots);
		O->SetObjectField(TEXT("activeBuild"), Build);
		TSharedRef<FJsonObject> Branches = MakeShared<FJsonObject>();
		for (const auto& [Id, Branch] : P.AbilityBranches) Branches->SetStringField(ToF(Id), ToF(Branch));
		O->SetObjectField(TEXT("abilityBranches"), Branches);
		TSharedRef<FJsonObject> Runs = MakeShared<FJsonObject>();
		for (const auto& [Key, Run] : P.MissionRuns)
		{
			TSharedRef<FJsonObject> R = MakeShared<FJsonObject>();
			R->SetStringField(TEXT("day"), ToF(Run.Day));
			R->SetNumberField(TEXT("count"), Run.Count);
			if (Run.Last) R->SetNumberField(TEXT("last"), *Run.Last);
			Runs->SetObjectField(ToF(Key), R);
		}
		O->SetObjectField(TEXT("missionRuns"), Runs);
		O->SetObjectField(TEXT("nexLedger"), NumberObject(P.NexLedger));
		if (Garage)
		{
			O->SetArrayField(TEXT("ownedVehicles"), StringArray(Garage->Owned));
			O->SetArrayField(TEXT("garageLoadout"), StringArray(Garage->Loadout));
			OptionalString(O, TEXT("selectedVehicle"), Garage->Selected);
			TSharedRef<FJsonObject> Conditions = MakeShared<FJsonObject>();
			for (const auto& [Id, C] : Garage->Conditions)
			{
				TSharedRef<FJsonObject> Co = MakeShared<FJsonObject>();
				Co->SetNumberField(TEXT("body"), C.Body);
				Co->SetNumberField(TEXT("engine"), C.Engine);
				Co->SetNumberField(TEXT("tires"), C.Tires);
				Co->SetNumberField(TEXT("suspension"), C.Suspension);
				Conditions->SetObjectField(ToF(Id), Co);
			}
			O->SetObjectField(TEXT("vehicleConditions"), Conditions);
		}
		if (P.LastMissionReward)
		{
			const wf::FProgression::FMissionReward& L = *P.LastMissionReward;
			TSharedRef<FJsonObject> R = MakeShared<FJsonObject>();
			R->SetStringField(TEXT("missionId"), ToF(L.MissionId));
			R->SetNumberField(TEXT("factor"), L.Factor);
			R->SetBoolField(TEXT("firstClear"), L.bFirstClear);
			R->SetNumberField(TEXT("xp"), L.Xp);
			R->SetObjectField(TEXT("materials"), NumberObject(L.Materials));
			TSharedRef<FJsonObject> Box = MakeShared<FJsonObject>();
			Box->SetStringField(TEXT("rarity"), ToF(L.BoxRarity));
			Box->SetObjectField(TEXT("materials"), NumberObject(L.BoxMaterials));
			R->SetObjectField(TEXT("box"), Box);
			O->SetObjectField(TEXT("lastMissionReward"), R);
		}

		FString Out;
		const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Out);
		FJsonSerializer::Serialize(O, Writer);
		return Out;
	}

	bool FromJson(const FString& Json, wf::FProgression& Out, FString& OutError, wf::FGarage* OutGarage)
	{
		TSharedPtr<FJsonObject> O;
		if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Json), O) || !O.IsValid())
		{
			OutError = TEXT("save is not a JSON object");
			return false;
		}
		wf::FProgression P = Out; // start from the caller's defaults
		P.ActiveQuestId = ReadOptionalString(O, TEXT("activeQuestId"));
		P.CompletedMissions = ReadStrings(O, TEXT("completedMissions"));
		P.QuestObjectiveProgress.clear();
		const TSharedPtr<FJsonObject>* Progress = nullptr;
		if (O->TryGetObjectField(TEXT("questObjectiveProgress"), Progress) && Progress && Progress->IsValid())
			for (const auto& Pair : (*Progress)->Values)
			{
				std::vector<double> Values;
				const TArray<TSharedPtr<FJsonValue>>* Array = nullptr;
				if (Pair.Value.IsValid() && Pair.Value->TryGetArray(Array))
					for (const TSharedPtr<FJsonValue>& V : *Array) Values.push_back(V.IsValid() ? V->AsNumber() : 0.0);
				P.QuestObjectiveProgress[ToStd(Pair.Key)] = Values;
			}
		if (O->HasField(TEXT("unlockedWorlds"))) P.UnlockedWorlds = ReadStrings(O, TEXT("unlockedWorlds"));
		P.WorldFlags.clear();
		const TSharedPtr<FJsonObject>* Flags = nullptr;
		if (O->TryGetObjectField(TEXT("worldFlags"), Flags) && Flags && Flags->IsValid())
			for (const auto& Pair : (*Flags)->Values)
			{
				bool Flag = false;
				if (Pair.Value.IsValid() && Pair.Value->TryGetBool(Flag)) P.WorldFlags[ToStd(Pair.Key)] = Flag;
			}
		if (std::optional<std::string> World = ReadOptionalString(O, TEXT("currentWorld"))) P.CurrentWorld = *World;
		O->TryGetNumberField(TEXT("corruptionLevel"), P.CorruptionLevel);
		O->TryGetNumberField(TEXT("fractureShards"), P.FractureShards);
		P.Materials = ReadNumbers(O, TEXT("materials"));
		P.DungeonClears = ReadNumbers(O, TEXT("dungeonClears"));

		P.Inventory.clear();
		const TArray<TSharedPtr<FJsonValue>>* Inventory = nullptr;
		if (O->TryGetArrayField(TEXT("inventory"), Inventory))
			for (const TSharedPtr<FJsonValue>& V : *Inventory)
			{
				const TSharedPtr<FJsonObject> Item = V.IsValid() ? V->AsObject() : nullptr;
				if (!Item.IsValid()) continue;
				wf::FGearItem G = GearFromJson(Item);
				if (G.Id.empty()) continue;
				P.Inventory.push_back(G);
			}
		P.EquippedGear.clear();
		const TSharedPtr<FJsonObject>* Equipped = nullptr;
		if (O->TryGetObjectField(TEXT("equippedGear"), Equipped) && Equipped && Equipped->IsValid())
			for (const auto& Pair : (*Equipped)->Values)
			{
				FString Id;
				if (Pair.Value.IsValid() && Pair.Value->TryGetString(Id) && !Id.IsEmpty()) P.EquippedGear[ToStd(Pair.Key)] = ToStd(Id);
			}

		O->TryGetNumberField(TEXT("level"), P.Level);
		O->TryGetNumberField(TEXT("xp"), P.Xp);
		O->TryGetNumberField(TEXT("calibrationTokens"), P.CalibrationTokens);
		O->TryGetNumberField(TEXT("novaLevel"), P.NovaLevel);
		P.NovaUnlocks = ReadStrings(O, TEXT("novaUnlocks"));
		P.IdentityClass = ReadOptionalString(O, TEXT("identityClass"));
		if (std::optional<std::string> Challenge = ReadOptionalString(O, TEXT("challenge"))) P.Challenge = *Challenge;
		P.EarnedRewards = ReadStrings(O, TEXT("earnedRewards"));
		P.UnlockedAbilities = ReadStrings(O, TEXT("unlockedAbilities"));
		// progression.ts load: activeBuild through migrateBuild (legacy ability ids), abilityBranches through migrateBranches
		{
			const TSharedPtr<FJsonObject>* Build = nullptr;
			const TSharedPtr<FJsonObject>* BuildSlots = nullptr;
			if (O->TryGetObjectField(TEXT("activeBuild"), Build) && Build && Build->IsValid() && (*Build)->TryGetObjectField(TEXT("slots"), BuildSlots) && BuildSlots && BuildSlots->IsValid())
			{
				wf::ability::FBuild B;
				FString Mode;
				if ((*Build)->TryGetStringField(TEXT("mode"), Mode)) B.Mode = ToStd(Mode);
				for (const char* Slot : wf::ability::Slots)
				{
					FString Id;
					B.Slots[Slot] = (*BuildSlots)->TryGetStringField(UTF8_TO_TCHAR(Slot), Id) ? ToStd(Id) : std::string();
				}
				B = wf::ability::MigrateBuild(B);
				P.ActiveBuildMode = B.Mode;
				P.ActiveBuildSlots = B.Slots;
			}
			const TSharedPtr<FJsonObject>* Branches = nullptr;
			P.AbilityBranches.clear();
			if (O->TryGetObjectField(TEXT("abilityBranches"), Branches) && Branches && Branches->IsValid())
			{
				std::map<std::string, std::string> Raw;
				for (const auto& Pair : (*Branches)->Values)
				{
					FString Pick;
					if (Pair.Value.IsValid() && Pair.Value->TryGetString(Pick)) Raw[ToStd(Pair.Key)] = ToStd(Pick);
				}
				P.AbilityBranches = wf::ability::MigrateBranches(Raw);
			}
		}
		P.MissionRuns.clear();
		const TSharedPtr<FJsonObject>* Runs = nullptr;
		if (O->TryGetObjectField(TEXT("missionRuns"), Runs) && Runs && Runs->IsValid())
			for (const auto& Pair : (*Runs)->Values)
			{
				const TSharedPtr<FJsonObject> R = Pair.Value.IsValid() ? Pair.Value->AsObject() : nullptr;
				if (!R.IsValid()) continue;
				wf::FProgression::FRunRecord Run;
				Run.Day = ToStd(WFData::Str(R, TEXT("day")));
				Run.Count = WFData::Num(R, TEXT("count"));
				double Last = 0;
				if (R->TryGetNumberField(TEXT("last"), Last)) Run.Last = Last;
				P.MissionRuns[ToStd(Pair.Key)] = Run;
			}
		P.NexLedger = ReadNumbers(O, TEXT("nexLedger"));
		if (OutGarage)
		{
			wf::FGarage G;
			G.Owned = ReadStrings(O, TEXT("ownedVehicles"));
			G.Loadout = ReadStrings(O, TEXT("garageLoadout"));
			G.Selected = ReadOptionalString(O, TEXT("selectedVehicle"));
			const TSharedPtr<FJsonObject>* Conditions = nullptr;
			if (O->TryGetObjectField(TEXT("vehicleConditions"), Conditions) && Conditions && Conditions->IsValid())
				for (const auto& Pair : (*Conditions)->Values)
				{
					const TSharedPtr<FJsonObject> Co = Pair.Value.IsValid() ? Pair.Value->AsObject() : nullptr;
					if (!Co.IsValid()) continue;
					G.Conditions[ToStd(Pair.Key)] = wf::vehicle::NormalizeCondition({WFData::Num(Co, TEXT("body")), WFData::Num(Co, TEXT("engine")), WFData::Num(Co, TEXT("tires")), WFData::Num(Co, TEXT("suspension"))});
				}
			*OutGarage = std::move(G);
		}
		P.LastMissionReward.reset();
		const TSharedPtr<FJsonObject>* Last = nullptr;
		if (O->TryGetObjectField(TEXT("lastMissionReward"), Last) && Last && Last->IsValid())
		{
			wf::FProgression::FMissionReward L;
			L.MissionId = ToStd(WFData::Str(*Last, TEXT("missionId")));
			L.Factor = WFData::Num(*Last, TEXT("factor"), 1.0);
			(*Last)->TryGetBoolField(TEXT("firstClear"), L.bFirstClear);
			L.Xp = WFData::Num(*Last, TEXT("xp"));
			L.Materials = ReadNumbers(*Last, TEXT("materials"));
			const TSharedPtr<FJsonObject>* Box = nullptr;
			if ((*Last)->TryGetObjectField(TEXT("box"), Box) && Box && Box->IsValid())
			{
				L.BoxRarity = ToStd(WFData::Str(*Box, TEXT("rarity")));
				L.BoxMaterials = ReadNumbers(*Box, TEXT("materials"));
			}
			P.LastMissionReward = L;
		}
		Out = std::move(P);
		return true;
	}
}
