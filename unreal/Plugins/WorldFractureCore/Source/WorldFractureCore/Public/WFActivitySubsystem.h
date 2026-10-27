#pragma once

#include "CoreMinimal.h"
#include "Core/WFActivityCore.h"
#include "Core/WFRaceCore.h"
#include "Subsystems/GameInstanceSubsystem.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

#include "WFActivitySubsystem.generated.h"

class UWFProgressionSubsystem;

/**
 * The activity board on the ported activities.ts rules (DataTables/Activities.json, ActivityAreas.json): side missions,
 * bounties, contracts, regional events and the weekly elite operations, run objective by objective (wf::activity::StepRun)
 * from what the game measures (kills by tier, deaths, health, where you stand). Starting spends an attempt (never refunded);
 * a finished run pays once (completeActivity: Nex, XP, reputation, materials, the challenge and featured bonuses) and starts
 * the cooldown. Races run through UWFRaceSubsystem; Killbox matches need the rival operators.
 *
 * Positions are the web world's metres (x, z).
 */
UCLASS()
class WORLDFRACTURECORE_API UWFActivitySubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** a board activity: its rules, its objectives and what the board shows */
	struct FBoardDef
	{
		wf::activity::FActivityDef Rules;
		std::string Name, Brief, Area, ChallengeLabel;
		int Difficulty = 1;
		bool bSubmerged = false, bElite = false;
		std::vector<wf::activity::FObjective> Stages;
	};

	/** One line per activity: id, name, area, category, featured / weekly, objectives, reward, and why it is locked. Area "" = all. */
	TArray<FString> DescribeBoard(const FString& Area) const;
	/** Spends an attempt and starts the activity; returns "" or why not. */
	FString Start(const FString& Id);
	/** Gives up (the attempt stays spent). */
	void Abandon();
	bool IsRunning() const { return Active.has_value(); }
	/** One tick of facts; when the run ends it is paid (or reported failed) and kept in GetLastSummary. */
	void Tick(const wf::activity::FTick& Facts);

	const FBoardDef* ActiveDef() const;
	const wf::activity::FActivityRun* ActiveRun() const { return Active ? &*Active : nullptr; }
	const wf::activity::FArea* AreaOf(const std::string& Id) const;
	/** where to head now (web world metres) */
	std::optional<wf::activity::FTarget> Target() const;
	/** the HUD: the activity, its stage, the objective's progress, and the time left on a timed stage */
	TArray<FString> DescribeRun(double NowMs) const;
	const TArray<FString>& GetLastSummary() const { return LastSummary; }
	int32 GetFinishedCount() const { return FinishedCount; }
	const std::vector<wf::activity::FArea>& Areas() const { return AreaList; }

private:
	UWFProgressionSubsystem* Progression() const;
	void Finish(double NowMs);
	bool IsFeatured(const std::string& Id, double NowMs) const;
	bool IsWeeklyElite(const std::string& Id, double NowMs) const;

	std::vector<FBoardDef> Board;
	std::vector<wf::activity::FBoardEntry> FeaturedPool;
	std::vector<std::string> EliteIds;
	std::vector<wf::activity::FArea> AreaList;
	std::optional<wf::activity::FActivityRun> Active;
	TArray<FString> LastSummary;
	int32 FinishedCount = 0;
};
