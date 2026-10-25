#include "WFQuestSubsystem.h"

#include "Data/WFDataTableRows.h"
#include "Dom/JsonObject.h"
#include "Engine/DataTable.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Engine/GameInstance.h"
#include "WFCoreSettings.h"
#include "WFDataFiles.h"
#include "WFProgressionSubsystem.h"
#include "WorldFractureCoreModule.h"

#include <algorithm>

using WFData::ToF;
using WFData::ToStd;

namespace
{
	bool Contains(const std::vector<std::string>& List, const std::string& Value)
	{
		return std::find(List.begin(), List.end(), Value) != List.end();
	}

	/** Parses one exported quest row (objectives and rewards arrive as JSON text) into the core's shape. */
	bool ToCoreQuest(const FQuestsRow& Row, wf::quest::FQuest& Out, FString& OutError)
	{
		Out = {};
		Out.Id = ToStd(Row.Id);
		Out.Title = ToStd(Row.Title);
		Out.World = ToStd(Row.World);
		Out.Line = ToStd(Row.Line);
		Out.RewardShards = Row.RewardShards;
		Out.Corruption = Row.Corruption;
		if (!Row.UnlocksWorld.IsEmpty()) Out.UnlocksWorld = ToStd(Row.UnlocksWorld);
		if (!Row.NextQuestId.IsEmpty()) Out.NextQuestId = ToStd(Row.NextQuestId);

		TArray<TSharedPtr<FJsonValue>> Objectives;
		if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Row.ObjectivesJson), Objectives))
		{
			OutError = FString::Printf(TEXT("%s: ObjectivesJson is not a JSON array"), *Row.Id);
			return false;
		}
		for (const TSharedPtr<FJsonValue>& Value : Objectives)
		{
			const TSharedPtr<FJsonObject> Object = Value.IsValid() ? Value->AsObject() : nullptr;
			FString Type, Label, Key;
			double Amount = 0;
			if (!Object.IsValid() || !Object->TryGetStringField(TEXT("type"), Type) || !Object->TryGetNumberField(TEXT("amount"), Amount))
			{
				OutError = FString::Printf(TEXT("%s: objective without type/amount"), *Row.Id);
				return false;
			}
			wf::quest::FObjective Objective;
			if (!wf::quest::ParseObjectiveType(ToStd(Type), Objective.Type))
			{
				OutError = FString::Printf(TEXT("%s: unknown objective type %s"), *Row.Id, *Type);
				return false;
			}
			Object->TryGetStringField(TEXT("label"), Label);
			Objective.Label = ToStd(Label);
			if (Object->TryGetStringField(TEXT("key"), Key)) Objective.Key = ToStd(Key);
			Objective.Amount = Amount;
			Out.Objectives.push_back(Objective);
		}

		TSharedPtr<FJsonObject> Materials;
		if (!Row.RewardMaterialsJson.IsEmpty())
		{
			if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Row.RewardMaterialsJson), Materials) || !Materials.IsValid())
			{
				OutError = FString::Printf(TEXT("%s: RewardMaterialsJson is not a JSON object"), *Row.Id);
				return false;
			}
			for (const auto& Pair : Materials->Values) Out.RewardMaterials[ToStd(Pair.Key)] = Pair.Value->AsNumber();
		}
		return true;
	}
}

void UWFQuestSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency<UWFProgressionSubsystem>();
	Super::Initialize(Collection);

	FString Error;
	const UWFCoreSettings* Settings = GetDefault<UWFCoreSettings>();
	const bool bLoaded = !Settings->QuestTable.IsNull() ? LoadQuestTable(Settings->QuestTable.LoadSynchronous(), Error) : LoadQuestJson(Error);
	if (!bLoaded) UE_LOG(LogWorldFracture, Error, TEXT("Quests failed to load: %s"), *Error);
	ReconcileAfterLoad();
}

bool UWFQuestSubsystem::LoadQuestJson(FString& OutError)
{
	TArray<TSharedPtr<FJsonObject>> Rows;
	if (!WFData::LoadRows(TEXT("Quests"), Rows, OutError)) return false;
	wf::quest::FCatalog Next;
	for (const TSharedPtr<FJsonObject>& Row : Rows)
	{
		FQuestsRow Parsed;
		Parsed.Id = WFData::Str(Row, TEXT("Id"));
		Parsed.Title = WFData::Str(Row, TEXT("Title"));
		Parsed.World = WFData::Str(Row, TEXT("World"));
		Parsed.Line = WFData::Str(Row, TEXT("Line"));
		Parsed.ObjectivesJson = WFData::Str(Row, TEXT("ObjectivesJson"));
		Parsed.RewardShards = static_cast<int32>(WFData::Num(Row, TEXT("RewardShards")));
		Parsed.RewardMaterialsJson = WFData::Str(Row, TEXT("RewardMaterialsJson"));
		Parsed.UnlocksWorld = WFData::Str(Row, TEXT("UnlocksWorld"));
		Parsed.NextQuestId = WFData::Str(Row, TEXT("NextQuestId"));
		Parsed.Corruption = WFData::Num(Row, TEXT("Corruption"));
		wf::quest::FQuest Quest;
		if (!ToCoreQuest(Parsed, Quest, OutError)) return false;
		Next.Add(std::move(Quest));
	}
	Catalog = std::move(Next);
	UE_LOG(LogWorldFracture, Log, TEXT("Loaded %d quests from %s"), Rows.Num(), *WFData::TablePath(TEXT("Quests")));
	return true;
}

bool UWFQuestSubsystem::LoadQuestTable(UDataTable* Table, FString& OutError)
{
	if (!Table) { OutError = TEXT("no table"); return false; }
	if (Table->GetRowStruct() != FQuestsRow::StaticStruct())
	{
		OutError = FString::Printf(TEXT("%s does not use the FQuestsRow struct"), *Table->GetName());
		return false;
	}
	TArray<FQuestsRow*> Rows;
	Table->GetAllRows<FQuestsRow>(TEXT("UWFQuestSubsystem::LoadQuestTable"), Rows);

	wf::quest::FCatalog Next;
	for (const FQuestsRow* Row : Rows)
	{
		wf::quest::FQuest Quest;
		if (!ToCoreQuest(*Row, Quest, OutError)) return false;
		Next.Add(std::move(Quest));
	}
	Catalog = std::move(Next);
	UE_LOG(LogWorldFracture, Log, TEXT("Loaded %d quests from %s"), Rows.Num(), *Table->GetName());
	return true;
}

const wf::FProgression& UWFQuestSubsystem::St() const
{
	return GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()->Get();
}

wf::FProgression& UWFQuestSubsystem::MutableSt()
{
	return GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()->Mutable();
}

void UWFQuestSubsystem::ReconcileAfterLoad()
{
	MutableSt() = wf::quest::ReconcileQuests(Catalog, St());
}

void UWFQuestSubsystem::ReportEnterWorld(const FString& World) { Apply(wf::quest::FEvent::EnterWorld(ToStd(World))); }
void UWFQuestSubsystem::ReportKill(const FString& World) { Apply(wf::quest::FEvent::Kill(ToStd(World))); }
void UWFQuestSubsystem::ReportSurvived(const FString& World, double Seconds) { Apply(wf::quest::FEvent::Survived(ToStd(World), Seconds)); }
void UWFQuestSubsystem::ReportMissionComplete(const FString& MissionId) { Apply(wf::quest::FEvent::MissionComplete(ToStd(MissionId))); }
void UWFQuestSubsystem::ReportDungeonCleared(const FString& DungeonId) { Apply(wf::quest::FEvent::DungeonCleared(ToStd(DungeonId))); }
void UWFQuestSubsystem::ReportBossDefeated(const FString& EncounterId) { Apply(wf::quest::FEvent::BossDefeated(ToStd(EncounterId))); }
void UWFQuestSubsystem::ReportHeatLevel(int32 Level) { Apply(wf::quest::FEvent::HeatLevel(Level)); }
void UWFQuestSubsystem::ReportLockdownTier(const FString& Tier) { Apply(wf::quest::FEvent::LockdownTier(ToStd(Tier))); }
void UWFQuestSubsystem::ReportHackComplete() { Apply(wf::quest::FEvent::HackComplete()); }

void UWFQuestSubsystem::DevFinishActiveQuest()
{
	Commit(wf::quest::FinishActiveQuest(Catalog, St()));
}

void UWFQuestSubsystem::Apply(const wf::quest::FEvent& Event)
{
	Commit(wf::quest::GameTick(Catalog, St(), Event));
}

void UWFQuestSubsystem::Commit(wf::quest::FProgression Next)
{
	const wf::FProgression Before = St();
	MutableSt() = std::move(Next);
	const wf::FProgression& After = St();

	for (const std::string& Id : After.CompletedMissions)
		if (!Contains(Before.CompletedMissions, Id) && Catalog.Find(Id)) OnQuestCompleted.Broadcast(ToF(Id));
	for (const std::string& World : After.UnlockedWorlds)
		if (!Contains(Before.UnlockedWorlds, World)) OnWorldUnlocked.Broadcast(ToF(World));
	if (After.ActiveQuestId != Before.ActiveQuestId) OnActiveQuestChanged.Broadcast(GetActiveQuestId());
	GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()->NotifyChanged();
}

FString UWFQuestSubsystem::GetActiveQuestId() const
{
	return St().ActiveQuestId ? ToF(*St().ActiveQuestId) : FString();
}

FString UWFQuestSubsystem::GetActiveQuestTitle() const
{
	const wf::quest::FQuest* Quest = wf::quest::ActiveQuest(Catalog, St());
	return Quest ? ToF(Quest->Title) : FString();
}

FString UWFQuestSubsystem::GetActiveQuestLine() const
{
	const wf::quest::FQuest* Quest = wf::quest::ActiveQuest(Catalog, St());
	return Quest ? ToF(Quest->Line) : FString();
}

TArray<FWFObjectiveView> UWFQuestSubsystem::GetActiveObjectives() const
{
	TArray<FWFObjectiveView> Out;
	const wf::quest::FQuest* Quest = wf::quest::ActiveQuest(Catalog, St());
	if (!Quest) return Out;
	const wf::FProgression& P = St();
	const auto Found = P.QuestObjectiveProgress.find(Quest->Id);
	for (size_t I = 0; I < Quest->Objectives.size(); ++I)
	{
		FWFObjectiveView View;
		View.Label = ToF(Quest->Objectives[I].Label);
		View.Amount = Quest->Objectives[I].Amount;
		View.Progress = Found != P.QuestObjectiveProgress.end() && I < Found->second.size() ? Found->second[I] : 0.0;
		View.bComplete = View.Progress >= View.Amount;
		Out.Add(View);
	}
	return Out;
}

bool UWFQuestSubsystem::IsQuestComplete(const FString& QuestId) const { return Contains(St().CompletedMissions, ToStd(QuestId)); }
bool UWFQuestSubsystem::IsWorldUnlocked(const FString& World) const { return Contains(St().UnlockedWorlds, ToStd(World)); }
FString UWFQuestSubsystem::GetCurrentWorld() const { return ToF(St().CurrentWorld); }
FString UWFQuestSubsystem::DescribeState() const { return ToF(wf::quest::ToCanonicalString(St())); }
