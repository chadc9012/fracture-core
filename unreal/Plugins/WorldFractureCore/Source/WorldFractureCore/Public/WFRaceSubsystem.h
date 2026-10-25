#pragma once

#include "CoreMinimal.h"
#include "Core/WFRaceCore.h"
#include "Subsystems/GameInstanceSubsystem.h"

#include <map>
#include <optional>
#include <string>

#include "WFRaceSubsystem.generated.h"

class UWFProgressionSubsystem;

/**
 * Racing on the ported racing.ts / activities.ts rules: the 68 courses, attempts and cooldowns, the run itself (staging,
 * countdown, checkpoints, gates, shortcuts, recovery, penalties, rivals), and the payout and records on a valid finish
 * (activities.ts completeActivity, then racing.ts applyRaceResult, in the web build's order).
 *
 * Positions are in course metres. The web build's world is not ported, so the host places a course by an offset
 * (course = world metres - offset) and keeps the course's own layout and orientation.
 */
UCLASS()
class WORLDFRACTURECORE_API UWFRaceSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Spends an attempt and starts a race. Difficulty standard | advanced | legendary. Returns "" or why not. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Racing") FString StartRace(const FString& RaceId, const FString& Difficulty, double OffsetXMeters, double OffsetZMeters);
	/** Gives up the current run (the attempt stays spent, as in the web build). */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Racing") void AbandonRace();
	UFUNCTION(BlueprintPure, Category = "World Fracture|Racing") bool IsRacing() const { return Active.has_value(); }
	/** Racing rank name (Rookie .. Legend) and the score behind it. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Racing") FString GetRankName() const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Racing") double GetRacingScore() const;
	/** One line per course: id, name, mode, availability, best medal. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Racing") TArray<FString> DescribeRaces() const;
	/** Vehicle top-speed factor while running (track obstacle hits slow the car for a moment), else 1. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Racing") double GetSpeedFactor() const;

	/**
	 * One frame of the run at a world position (metres). Mode foot | vehicle | dive. Returns true while a run is active.
	 * When the run ends, the result (or failure) is applied and kept in GetLastSummary until the next race.
	 */
	bool Tick(double WorldX, double WorldZ, std::optional<double> WorldY, double Dt, const std::string& Mode, bool bVehicleDisabled);
	/** Takes the pending off-course recovery point (world metres), if the rules asked for one. */
	bool TakeRecovery(double& OutWorldX, double& OutWorldZ);

	const wf::race::FCatalog& Catalog() const { return Races; }
	const wf::race::FRaceDef* ActiveDef() const;
	const wf::race::FRun* ActiveRun() const { return Active && Active->Race ? &*Active->Race : nullptr; }
	double OffsetX() const { return OffX; }
	double OffsetZ() const { return OffZ; }
	/** Lines describing the last finished or failed race (place, time, medal, payout, records). */
	const TArray<FString>& GetLastSummary() const { return LastSummary; }
	/** Bumped whenever a run ends, so hosts can show the summary once. */
	int32 GetFinishedCount() const { return FinishedCount; }

private:
	UWFProgressionSubsystem* Progression() const;
	void Finish();

	wf::race::FCatalog Races;
	std::map<std::string, wf::activity::FActivityDef> Activities;
	std::optional<wf::activity::FActivityRun> Active;
	double OffX = 0, OffZ = 0;
	TArray<FString> LastSummary;
	int32 FinishedCount = 0;
};
