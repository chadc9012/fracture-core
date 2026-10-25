#include "WFMissionSubsystem.h"

#include "Engine/GameInstance.h"
#include "WFDataFiles.h"
#include "WFProgressionSubsystem.h"
#include "WFQuestSubsystem.h"
#include "WorldFractureCoreModule.h"

using WFData::ToF;
using WFData::ToStd;

void UWFMissionSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency<UWFQuestSubsystem>();
	Super::Initialize(Collection);

	FString Error;
	TArray<TSharedPtr<FJsonObject>> Rows;
	if (WFData::LoadRows(TEXT("MissionLines"), Rows, Error))
		for (const TSharedPtr<FJsonObject>& Row : Rows)
			Lines.Add(ToStd(WFData::Str(Row, TEXT("Mission"))), ToStd(WFData::Str(Row, TEXT("Field"))), ToStd(WFData::Str(Row, TEXT("Key"))), ToStd(WFData::Str(Row, TEXT("Text"))));
	else UE_LOG(LogWorldFracture, Error, TEXT("Mission lines failed to load: %s"), *Error);

	if (WFData::LoadRows(TEXT("MissionObjectives"), Rows, Error))
		for (const TSharedPtr<FJsonObject>& Row : Rows)
			Objectives.Add(WFData::Str(Row, TEXT("Mission")) + TEXT("/") + WFData::Str(Row, TEXT("State")), WFData::Str(Row, TEXT("Objective")));
	else UE_LOG(LogWorldFracture, Error, TEXT("Mission objectives failed to load: %s"), *Error);
	UE_LOG(LogWorldFracture, Log, TEXT("Missions: %d lines, %d objectives"), static_cast<int32>(Lines.Num()), Objectives.Num());
}

bool UWFMissionSubsystem::StartMission(const FString& MissionId)
{
	const std::string Id = ToStd(MissionId);
	if (!wf::mission::IsKnown(Id)) return false;
	Runs[Id] = wf::mission::Initial(Id);
	SendEvent(MissionId, EWFMissionEvent::Start);
	return true;
}

void UWFMissionSubsystem::SendEvent(const FString& MissionId, EWFMissionEvent Event, double Progress, double X, double Z, const FString& FromState)
{
	const auto Found = Runs.find(ToStd(MissionId));
	if (Found == Runs.end()) return;
	wf::mission::FEvent E;
	E.Type = static_cast<wf::mission::EEvent>(Event);
	E.Progress = Progress;
	E.X = X;
	E.Z = Z;
	if (!FromState.IsEmpty()) E.From = ToStd(FromState);

	const std::string Before = Found->second.State;
	Found->second = wf::mission::Advance(Lines, Context, Found->second, E);
	const wf::mission::FRun& Run = Found->second;
	if (Run.State == Before) return;
	OnMissionStateChanged.Broadcast(MissionId, ToF(Run.State), ToF(Run.Nova.empty() ? Run.Line : Run.Nova));
	if (Run.State == "WORLD_UPDATE" || (Run.Id == "awakening" && Run.State == "COMPLETE"))
		// pays once and fires the mission's quest event (persistence.ts applyMissionCompletion)
		if (UWFProgressionSubsystem* Progression = GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>()) Progression->CompleteMission(MissionId);
}

void UWFMissionSubsystem::SetFaction(const FString& Faction)
{
	Context.Faction = Faction.IsEmpty() ? std::nullopt : std::optional<std::string>(ToStd(Faction));
}

void UWFMissionSubsystem::SetDescentSites(FVector2D Airlock, FVector2D Ring, FVector2D Reactor)
{
	Context.Airlock = {Airlock.X, Airlock.Y};
	Context.Ring = {Ring.X, Ring.Y};
	Context.Reactor = {Reactor.X, Reactor.Y};
}

FString UWFMissionSubsystem::GetState(const FString& MissionId) const
{
	const auto Found = Runs.find(ToStd(MissionId));
	return Found == Runs.end() ? FString() : ToF(Found->second.State);
}

FString UWFMissionSubsystem::GetObjective(const FString& MissionId) const
{
	const FString* Text = Objectives.Find(MissionId + TEXT("/") + GetState(MissionId));
	return Text ? *Text : FString();
}

FString UWFMissionSubsystem::GetNovaLine(const FString& MissionId) const
{
	const auto Found = Runs.find(ToStd(MissionId));
	if (Found == Runs.end()) return FString();
	return ToF(Found->second.Nova.empty() ? Found->second.Line : Found->second.Nova);
}

bool UWFMissionSubsystem::HasTarget(const FString& MissionId) const
{
	const auto Found = Runs.find(ToStd(MissionId));
	return Found != Runs.end() && Found->second.Target.has_value();
}

FVector2D UWFMissionSubsystem::GetTarget(const FString& MissionId) const
{
	const auto Found = Runs.find(ToStd(MissionId));
	if (Found == Runs.end() || !Found->second.Target) return FVector2D::ZeroVector;
	return FVector2D(Found->second.Target->X, Found->second.Target->Z);
}

TArray<FString> UWFMissionSubsystem::GetRunningMissions() const
{
	TArray<FString> Out;
	for (const auto& [Id, Run] : Runs)
		if (Run.State != "IDLE" && Run.State != "WORLD_UPDATE") Out.Add(ToF(Id));
	return Out;
}
