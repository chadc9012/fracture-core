#pragma once

#include "CoreMinimal.h"
#include "Core/WFMissionCore.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "WFMissionSubsystem.generated.h"

UENUM(BlueprintType)
enum class EWFMissionEvent : uint8 { Start, Anchor, Arrived, Clear, Hack, Hold, Ack, Decided };

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FWFMissionStateChanged, const FString&, MissionId, const FString&, NewState, const FString&, NovaLine);

/**
 * Runs the scripted story missions (wf::mission, golden-tested against src/game/missions/*). Gameplay sends the same
 * world events the web build's Scene and overlays send: START, ANCHOR (with the mission site), ARRIVED at the target,
 * CLEAR of a wave, HACK / HOLD progress, ACK of the completion card, DECIDED at the Core Node.
 *
 * When a mission reaches WORLD_UPDATE it reports MISSION_COMPLETE to the quest chain. Not ported yet: the mission
 * payout (missions/persistence.ts COMPLETION + progression.ts rewardMission) and saving runs mid-mission.
 */
UCLASS()
class WORLDFRACTURECORE_API UWFMissionSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Starts (or restarts) a mission run at IDLE and sends START. False for an unknown id. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Missions") bool StartMission(const FString& MissionId);
	/** One world event for a running mission. X/Z: ANCHOR position (Unreal units are converted to the web build's metres by the caller). */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Missions") void SendEvent(const FString& MissionId, EWFMissionEvent Event, double Progress = 0, double X = 0, double Z = 0, const FString& FromState = TEXT(""));
	/** The allegiance chosen in the Core Node reveal (controllers / breakers / resonants). */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Missions") void SetFaction(const FString& Faction);
	/** World sites the Descent Protocol steps through (thalassia-sectors.ts airlockSite / ringWaypoint / reactorSite). */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Missions") void SetDescentSites(FVector2D Airlock, FVector2D Ring, FVector2D Reactor);

	UFUNCTION(BlueprintPure, Category = "World Fracture|Missions") FString GetState(const FString& MissionId) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Missions") FString GetObjective(const FString& MissionId) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Missions") FString GetNovaLine(const FString& MissionId) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Missions") bool HasTarget(const FString& MissionId) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Missions") FVector2D GetTarget(const FString& MissionId) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Missions") TArray<FString> GetRunningMissions() const;

	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Missions") FWFMissionStateChanged OnMissionStateChanged;

private:
	wf::mission::FLines Lines;
	wf::mission::FContext Context;
	TMap<FString, FString> Objectives; // "mission/STATE" -> objective text
	std::map<std::string, wf::mission::FRun> Runs;
};
