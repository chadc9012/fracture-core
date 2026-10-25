#include "WFRaceSubsystem.h"

#include "Engine/GameInstance.h"
#include "WFDataFiles.h"
#include "WFProgressionSubsystem.h"
#include "WFRaceData.h"
#include "WorldFractureCoreModule.h"

#include <cmath>

using WFData::ToF;
using WFData::ToStd;

namespace
{
	double RaceNowMs() { return std::floor((FDateTime::UtcNow() - FDateTime(1970, 1, 1)).GetTotalMilliseconds()); }
	FString RaceClock(double Seconds)
	{
		const int32 Tenths = FMath::RoundToInt32(Seconds * 10);
		return FString::Printf(TEXT("%d:%02d.%d"), Tenths / 600, (Tenths / 10) % 60, Tenths % 10);
	}
}

void UWFRaceSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency<UWFProgressionSubsystem>();
	Super::Initialize(Collection);
	FString Error;
	if (!WFRaceData::Load(Races, Activities, Error)) UE_LOG(LogWorldFracture, Warning, TEXT("World Fracture racing: %s"), *Error);
	else UE_LOG(LogWorldFracture, Log, TEXT("World Fracture racing: %d courses, %d championships"), static_cast<int32>(Races.Races.size()), static_cast<int32>(Races.Championships.size()));
}

UWFProgressionSubsystem* UWFRaceSubsystem::Progression() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>() : nullptr;
}

const wf::race::FRaceDef* UWFRaceSubsystem::ActiveDef() const
{
	return Active ? Races.Find(Active->Id) : nullptr;
}

FString UWFRaceSubsystem::StartRace(const FString& RaceId, const FString& Difficulty, double OffsetXMeters, double OffsetZMeters)
{
	UWFProgressionSubsystem* P = Progression();
	if (!P) return TEXT("No save loaded");
	if (Active) return TEXT("Already in a race (AbandonRace to give up)");
	const std::string Id = ToStd(RaceId);
	const wf::race::FRaceDef* Def = Races.Find(Id);
	const auto Act = Activities.find(Id);
	if (!Def || Act == Activities.end()) return FString::Printf(TEXT("Unknown race %s (ListRaces)"), *RaceId);
	if (Def->bHidden && !wf::race::HiddenUnlocked(P->Get(), *Def)) return TEXT("Hidden course: find its markers first");
	const std::string Diff = Difficulty.IsEmpty() ? std::string("standard") : ToStd(Difficulty.ToLower());
	if (Diff != "standard" && Diff != "advanced" && Diff != "legendary") return TEXT("Difficulty is standard, advanced or legendary");
	if (const std::optional<std::string> Locked = wf::race::DifficultyLocked(P->Get(), Id, Diff)) return ToF(*Locked);
	wf::activity::FActivityRun Run;
	std::string Error;
	const double Now = RaceNowMs();
	if (!wf::activity::StartActivity(Races, P->Mutable(), Act->second, Now, Diff, Run, Error)) return ToF(Error);
	Run.Race = wf::race::NewRaceRun(*Def, Diff, Now);
	Active = std::move(Run);
	OffX = OffsetXMeters;
	OffZ = OffsetZMeters;
	LastSummary.Reset();
	P->NotifyChanged();
	return FString();
}

void UWFRaceSubsystem::AbandonRace()
{
	if (!Active) return;
	LastSummary = {FString::Printf(TEXT("%s abandoned"), *ToF(ActiveDef() ? ActiveDef()->Name : Active->Id))};
	Active.reset();
	++FinishedCount;
}

bool UWFRaceSubsystem::Tick(double WorldX, double WorldZ, std::optional<double> WorldY, double Dt, const std::string& Mode, bool bVehicleDisabled)
{
	if (!Active || !Active->Race) return false;
	const wf::race::FRaceDef* Def = ActiveDef();
	if (!Def) { Active.reset(); return false; }
	wf::race::FTick T;
	T.X = WorldX - OffX;
	T.Z = WorldZ - OffZ;
	T.Y = WorldY;
	T.Dt = Dt;
	T.Now = RaceNowMs();
	T.Mode = Mode;
	T.bVehicleDisabled = bVehicleDisabled;
	wf::race::FRun& R = *Active->Race;
	wf::race::TickRace(*Def, R, T);
	// activities.ts hooks.race: a finished run completes the activity only when its result is valid
	if (R.Phase == "finished") { Active->Status = R.Result && R.Result->bValid ? "complete" : "failed"; if (Active->Status == "failed") R.FailReason = std::string("Invalid finish"); }
	else if (R.Phase == "failed") Active->Status = "failed";
	if (Active->Status != "active") Finish();
	return true;
}

bool UWFRaceSubsystem::TakeRecovery(double& OutWorldX, double& OutWorldZ)
{
	if (!Active || !Active->Race || !Active->Race->Recover) return false;
	OutWorldX = Active->Race->Recover->X + OffX;
	OutWorldZ = Active->Race->Recover->Z + OffZ;
	Active->Race->Recover.reset();
	return true;
}

void UWFRaceSubsystem::Finish()
{
	wf::activity::FActivityRun Run = std::move(*Active);
	Active.reset();
	++FinishedCount;
	LastSummary.Reset();
	const wf::race::FRaceDef* Def = Races.Find(Run.Id);
	const FString Name = Def ? ToF(Def->Name) : ToF(Run.Id);
	if (Run.Status != "complete")
	{
		LastSummary.Add(FString::Printf(TEXT("%s failed: %s"), *Name, Run.Race && Run.Race->FailReason ? *ToF(*Run.Race->FailReason) : TEXT("Failed")));
		return;
	}
	UWFProgressionSubsystem* P = Progression();
	const auto Act = Activities.find(Run.Id);
	if (!P || Act == Activities.end()) return;
	// GameCanvas.tsx onActivityChange: completeActivity pays, then applyRaceResult adds placement Nex and the records
	const double Now = RaceNowMs();
	wf::activity::FPayout Pay;
	std::string Error;
	if (!wf::activity::CompleteActivity(P->Mutable(), Act->second, Run, Now, false, Pay, Error))
	{
		LastSummary.Add(FString::Printf(TEXT("%s: %s"), *Name, *ToF(Error)));
		return;
	}
	const wf::race::FResult& Res = *Run.Race->Result;
	LastSummary.Add(FString::Printf(TEXT("%s - %s  P%d/%d  %s%s"), *Name, *ToF(Res.Difficulty), Res.Place, Res.Field, *RaceClock(Res.Time),
		Res.Penalties > 0 ? *FString::Printf(TEXT(" (+%.1fs penalties)"), Res.Penalties) : TEXT("")));
	FString Mats;
	for (const auto& M : Pay.Materials) Mats += FString::Printf(TEXT("  +%g %s"), M.second, *ToF(M.first));
	LastSummary.Add(FString::Printf(TEXT("+%g Nex  +%g XP  +%g rep%s%s"), Pay.Nex, Pay.Xp, Pay.Rep, *Mats, Pay.bBonus ? TEXT("  (challenge bonus)") : TEXT("")));
	wf::race::FRaceReward Reward;
	if (wf::race::ApplyRaceResult(Races, P->Mutable(), Run.Id, Act->second.Rewards.Nex, Run.StartedAt, *Run.Race, Reward, Error))
	{
		FString Line = Reward.Medal ? FString::Printf(TEXT("%s medal%s"), *ToF(*Reward.Medal).ToUpper(), Reward.bNewMedal ? TEXT(" (new)") : TEXT("")) : FString(TEXT("No medal"));
		if (Reward.NexBonus > 0) Line += FString::Printf(TEXT("  +%g Nex placing"), Reward.NexBonus);
		if (Reward.bPersonalBest) Line += TEXT("  PERSONAL BEST");
		LastSummary.Add(Line);
		if (Reward.ChampionshipPoints) LastSummary.Add(FString::Printf(TEXT("Championship +%g pts%s"), *Reward.ChampionshipPoints, Reward.bChampionshipDone ? TEXT(" - championship won") : TEXT("")));
		if (Reward.RankUp) LastSummary.Add(FString::Printf(TEXT("Racing rank up: %s"), *ToF(*Reward.RankUp)));
		for (const std::string& Rival : Reward.RivalsFirstBeaten) LastSummary.Add(FString::Printf(TEXT("First win over %s"), *ToF(Rival)));
	}
	P->NotifyChanged();
}

FString UWFRaceSubsystem::GetRankName() const
{
	const UWFProgressionSubsystem* P = Progression();
	return P ? FString(wf::race::Ranks[FMath::Clamp(wf::race::RankIndex(Races, P->Get()), 0, 4)]) : FString();
}

double UWFRaceSubsystem::GetRacingScore() const
{
	const UWFProgressionSubsystem* P = Progression();
	return P ? wf::race::RacingScore(Races, P->Get()) : 0;
}

TArray<FString> UWFRaceSubsystem::DescribeRaces() const
{
	TArray<FString> Out;
	const UWFProgressionSubsystem* P = Progression();
	if (!P) return Out;
	const double Now = RaceNowMs();
	for (const wf::race::FRaceDef& R : Races.Races)
	{
		if (R.bHidden && !wf::race::HiddenUnlocked(P->Get(), R)) continue;
		const auto Act = Activities.find(R.Id);
		FString State = TEXT("?");
		if (Act != Activities.end())
		{
			const wf::activity::FState S = wf::activity::ActivityState(Races, P->Get(), Act->second, Now);
			State = S.bAvailable ? FString::Printf(TEXT("%g left"), S.AttemptsLeft) : ToF(S.Reason.value_or("locked"));
		}
		const std::optional<std::string> Medal = wf::race::BestMedal(P->Get(), R.Id, "standard");
		Out.Add(FString::Printf(TEXT("%-18s %-28s %-7s %-9s rank %d  %s%s"), *ToF(R.Id), *ToF(R.Name), *ToF(R.Mode), *ToF(R.Area), R.Rank, *State,
			Medal ? *FString::Printf(TEXT("  [%s]"), *ToF(*Medal)) : TEXT("")));
	}
	return Out;
}

double UWFRaceSubsystem::GetSpeedFactor() const
{
	const wf::race::FRun* R = ActiveRun();
	return R && R->Phase == "running" ? wf::race::RaceSpeedFactor(R->Impact) : 1.0;
}
