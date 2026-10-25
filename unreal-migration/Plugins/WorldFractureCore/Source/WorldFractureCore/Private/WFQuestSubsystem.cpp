#include "WFQuestSubsystem.h"

#include "Data/WFDataTableRows.h"
#include "Dom/JsonObject.h"
#include "Engine/DataTable.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFCoreSettings.h"
#include "WorldFractureCoreModule.h"

#include <algorithm>

namespace
{
	std::string ToStd(const FString& S) { return std::string(TCHAR_TO_UTF8(*S)); }
	FString ToF(const std::string& S) { return FString(UTF8_TO_TCHAR(S.c_str())); }

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
	Super::Initialize(Collection);
	ResetProgression();

	const UWFCoreSettings* Settings = GetDefault<UWFCoreSettings>();
	if (Settings->QuestTable.IsNull())
	{
		UE_LOG(LogWorldFracture, Warning, TEXT("No quest table set in Project Settings > Game > World Fracture; quests are inactive until LoadQuestTable is called."));
		return;
	}
	FString Error;
	if (!LoadQuestTable(Settings->QuestTable.LoadSynchronous(), Error))
		UE_LOG(LogWorldFracture, Error, TEXT("Quest table failed to load: %s"), *Error);
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

void UWFQuestSubsystem::ResetProgression()
{
	const UWFCoreSettings* Settings = GetDefault<UWFCoreSettings>();
	wf::quest::FProgression Fresh;
	Fresh.ActiveQuestId = std::string(wf::quest::FirstQuestId);
	for (const FString& World : Settings->StartingUnlockedWorlds) Fresh.UnlockedWorlds.push_back(ToStd(World));
	Fresh.CurrentWorld = ToStd(Settings->StartingWorld);
	Fresh.FractureShards = Settings->StartingShards;
	State = std::move(Fresh);
}

void UWFQuestSubsystem::SetProgression(const wf::quest::FProgression& Saved)
{
	State = wf::quest::ReconcileQuests(Catalog, Saved);
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
	Commit(wf::quest::FinishActiveQuest(Catalog, State));
}

void UWFQuestSubsystem::Apply(const wf::quest::FEvent& Event)
{
	Commit(wf::quest::GameTick(Catalog, State, Event));
}

void UWFQuestSubsystem::Commit(wf::quest::FProgression Next)
{
	const wf::quest::FProgression Before = State;
	State = std::move(Next);

	for (const std::string& Id : State.CompletedMissions)
		if (!Contains(Before.CompletedMissions, Id) && Catalog.Find(Id)) OnQuestCompleted.Broadcast(ToF(Id));
	for (const std::string& World : State.UnlockedWorlds)
		if (!Contains(Before.UnlockedWorlds, World)) OnWorldUnlocked.Broadcast(ToF(World));
	if (State.ActiveQuestId != Before.ActiveQuestId) OnActiveQuestChanged.Broadcast(GetActiveQuestId());
}

FString UWFQuestSubsystem::GetActiveQuestId() const
{
	return State.ActiveQuestId ? ToF(*State.ActiveQuestId) : FString();
}

FString UWFQuestSubsystem::GetActiveQuestTitle() const
{
	const wf::quest::FQuest* Quest = wf::quest::ActiveQuest(Catalog, State);
	return Quest ? ToF(Quest->Title) : FString();
}

FString UWFQuestSubsystem::GetActiveQuestLine() const
{
	const wf::quest::FQuest* Quest = wf::quest::ActiveQuest(Catalog, State);
	return Quest ? ToF(Quest->Line) : FString();
}

TArray<FWFObjectiveView> UWFQuestSubsystem::GetActiveObjectives() const
{
	TArray<FWFObjectiveView> Out;
	const wf::quest::FQuest* Quest = wf::quest::ActiveQuest(Catalog, State);
	if (!Quest) return Out;
	const auto Found = State.QuestObjectiveProgress.find(Quest->Id);
	for (size_t I = 0; I < Quest->Objectives.size(); ++I)
	{
		FWFObjectiveView View;
		View.Label = ToF(Quest->Objectives[I].Label);
		View.Amount = Quest->Objectives[I].Amount;
		View.Progress = Found != State.QuestObjectiveProgress.end() && I < Found->second.size() ? Found->second[I] : 0.0;
		View.bComplete = View.Progress >= View.Amount;
		Out.Add(View);
	}
	return Out;
}

bool UWFQuestSubsystem::IsQuestComplete(const FString& QuestId) const { return Contains(State.CompletedMissions, ToStd(QuestId)); }
bool UWFQuestSubsystem::IsWorldUnlocked(const FString& World) const { return Contains(State.UnlockedWorlds, ToStd(World)); }
FString UWFQuestSubsystem::GetCurrentWorld() const { return ToF(State.CurrentWorld); }
FString UWFQuestSubsystem::DescribeState() const { return ToF(wf::quest::ToCanonicalString(State)); }
