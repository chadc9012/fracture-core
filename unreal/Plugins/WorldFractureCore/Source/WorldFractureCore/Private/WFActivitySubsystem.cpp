#include "WFActivitySubsystem.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/GameInstance.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFDataFiles.h"
#include "Core/WFPvpCore.h"
#include "WFProgressionSubsystem.h"
#include "WFRaceSubsystem.h"
#include "WorldFractureCoreModule.h"

#include <algorithm>
#include <cmath>
#include <limits>

using WFData::ToF;
using WFData::ToStd;

namespace
{
	TSharedPtr<FJsonObject> ActObject(const FString& Text)
	{
		TSharedPtr<FJsonObject> O;
		if (!Text.IsEmpty()) FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), O);
		return O;
	}
	wf::activity::FFrac ActFrac(const TSharedPtr<FJsonObject>& O, const TCHAR* Field)
	{
		const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
		if (O.IsValid() && O->TryGetArrayField(Field, A) && A && A->Num() >= 2) return {(*A)[0]->AsNumber(), (*A)[1]->AsNumber()};
		return {};
	}
	wf::activity::FObjective ActObjective(const TSharedPtr<FJsonObject>& O)
	{
		wf::activity::FObjective Ob;
		Ob.Kind = ToStd(WFData::Str(O, TEXT("kind")));
		Ob.Label = ToStd(WFData::Str(O, TEXT("label")));
		Ob.Count = WFData::Num(O, TEXT("count"));
		const FString Tier = WFData::Str(O, TEXT("tier"));
		if (!Tier.IsEmpty()) Ob.Tier = ToStd(Tier);
		const TArray<TSharedPtr<FJsonValue>>* Points = nullptr;
		if (O->TryGetArrayField(TEXT("points"), Points) && Points)
			for (const TSharedPtr<FJsonValue>& P : *Points)
			{
				const TArray<TSharedPtr<FJsonValue>>* Xz = nullptr;
				if (P.IsValid() && P->TryGetArray(Xz) && Xz && Xz->Num() >= 2) Ob.Points.push_back({(*Xz)[0]->AsNumber(), (*Xz)[1]->AsNumber()});
			}
		Ob.TimeLimit = WFData::Num(O, TEXT("timeLimit"));
		Ob.At = ActFrac(O, TEXT("at"));
		Ob.Radius = WFData::Num(O, TEXT("radius"));
		Ob.Seconds = WFData::Num(O, TEXT("seconds"));
		Ob.From = ActFrac(O, TEXT("from"));
		Ob.To = ActFrac(O, TEXT("to"));
		Ob.RaceId = ToStd(WFData::Str(O, TEXT("raceId")));
		Ob.Mode = ToStd(WFData::Str(O, TEXT("mode")));
		Ob.Target = WFData::Num(O, TEXT("target"));
		return Ob;
	}
	FString ActClock(double Seconds)
	{
		const int32 S = FMath::Max(0, FMath::CeilToInt32(Seconds));
		return FString::Printf(TEXT("%d:%02d"), S / 60, S % 60);
	}
}

void UWFActivitySubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency<UWFProgressionSubsystem>();
	Collection.InitializeDependency<UWFRaceSubsystem>();
	Super::Initialize(Collection);
	const UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	TArray<TSharedPtr<FJsonObject>> Rows;
	FString Error;
	if (WFData::LoadRows(TEXT("ActivityAreas"), Rows, Error))
		for (const TSharedPtr<FJsonObject>& Row : Rows)
			AreaList.push_back({ToStd(WFData::Str(Row, TEXT("Id"))), ToStd(WFData::Str(Row, TEXT("DisplayName"))), WFData::Num(Row, TEXT("X")), WFData::Num(Row, TEXT("Z")), WFData::Num(Row, TEXT("Radius"))});
	else UE_LOG(LogWorldFracture, Warning, TEXT("World Fracture activities: %s"), *Error);
	if (!WFData::LoadRows(TEXT("Activities"), Rows, Error)) { UE_LOG(LogWorldFracture, Warning, TEXT("World Fracture activities: %s"), *Error); return; }
	for (const TSharedPtr<FJsonObject>& Row : Rows)
	{
		const std::string Id = ToStd(WFData::Str(Row, TEXT("Id")));
		const std::string Kind = ToStd(WFData::Str(Row, TEXT("Kind")));
		const bool bElite = Id.rfind("el-", 0) == 0;
		if (Id == "vyrak-rematch") continue; // Vyrak stays a unique encounter; only its limits come from here
		// activities.ts featuredFor: the standard board (with the non-hidden races racing.ts appends), less reputation and gates
		if (!bElite)
		{
			const wf::race::FRaceDef* Race = Racing ? Racing->Catalog().Find(Id) : nullptr;
			FeaturedPool.push_back({Id, ToStd(WFData::Str(Row, TEXT("Area"))), WFData::Num(Row, TEXT("MinRep")), (Kind == "race" || Kind == "parkour") && Race && Race->Rank > 0});
		}
		else EliteIds.push_back(Id);
		if (Kind == "race" || Kind == "parkour") continue; // run by UWFRaceSubsystem
		FBoardDef D;
		D.Rules.Id = Id;
		D.Rules.Kind = Kind;
		D.Rules.Faction = ToStd(WFData::Str(Row, TEXT("Faction")));
		D.Rules.Period = ToStd(WFData::Str(Row, TEXT("Period")));
		double Attempts = 0;
		D.Rules.Attempts = Row->TryGetNumberField(TEXT("Attempts"), Attempts) ? Attempts : std::numeric_limits<double>::infinity(); // Infinity exports as null
		D.Rules.CooldownMin = WFData::Num(Row, TEXT("CooldownMin"));
		D.Rules.MinRep = WFData::Num(Row, TEXT("MinRep"));
		if (const TSharedPtr<FJsonObject> C = ActObject(WFData::Str(Row, TEXT("ChallengeJson"))); C.IsValid())
		{
			D.Rules.ChallengeId = ToStd(WFData::Str(C, TEXT("id")));
			D.ChallengeLabel = ToStd(WFData::Str(C, TEXT("label")));
		}
		if (const TSharedPtr<FJsonObject> R = ActObject(WFData::Str(Row, TEXT("RewardsJson"))); R.IsValid())
		{
			D.Rules.Rewards.Nex = WFData::Num(R, TEXT("nex"));
			D.Rules.Rewards.Xp = WFData::Num(R, TEXT("xp"));
			D.Rules.Rewards.Rep = WFData::Num(R, TEXT("rep"));
			D.Rules.Rewards.ShaderChance = WFData::Num(R, TEXT("shaderChance"));
			const TSharedPtr<FJsonObject>* Mats = nullptr;
			if (R->TryGetObjectField(TEXT("materials"), Mats) && Mats && Mats->IsValid())
				for (const auto& M : (*Mats)->Values) D.Rules.Rewards.Materials[ToStd(M.Key)] = M.Value->AsNumber();
		}
		TArray<TSharedPtr<FJsonValue>> Stages;
		FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(Row, TEXT("StagesJson"))), Stages);
		for (const TSharedPtr<FJsonValue>& S : Stages)
			if (const TSharedPtr<FJsonObject> O = S.IsValid() ? S->AsObject() : TSharedPtr<FJsonObject>(); O.IsValid())
			{
				D.Stages.push_back(ActObjective(O));
				if (O->HasField(TEXT("timeLimit"))) D.Rules.TimeLimitSum += D.Stages.back().TimeLimit; // the "fast" challenge
			}
		D.Name = ToStd(WFData::Str(Row, TEXT("DisplayName")));
		D.Brief = ToStd(WFData::Str(Row, TEXT("Brief")));
		D.Area = ToStd(WFData::Str(Row, TEXT("Area")));
		D.Difficulty = static_cast<int>(WFData::Num(Row, TEXT("Difficulty"), 1));
		bool bSub = false;
		D.bSubmerged = Row->TryGetBoolField(TEXT("Submerged"), bSub) && bSub;
		D.bElite = bElite;
		if (!D.Stages.empty()) Board.push_back(std::move(D));
	}
	UE_LOG(LogWorldFracture, Log, TEXT("World Fracture activities: %d on the board, %d areas"), static_cast<int32>(Board.size()), static_cast<int32>(AreaList.size()));
}

UWFProgressionSubsystem* UWFActivitySubsystem::Progression() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>() : nullptr;
}

const UWFActivitySubsystem::FBoardDef* UWFActivitySubsystem::ActiveDef() const
{
	if (!Active) return nullptr;
	for (const FBoardDef& D : Board) if (D.Rules.Id == Active->Id) return &D;
	return nullptr;
}

const wf::activity::FArea* UWFActivitySubsystem::AreaOf(const std::string& Id) const
{
	for (const wf::activity::FArea& A : AreaList) if (A.Id == Id) return &A;
	return nullptr;
}

bool UWFActivitySubsystem::IsFeatured(const std::string& Id, double NowMs) const
{
	const std::vector<std::string> F = wf::activity::FeaturedFor(NowMs, FeaturedPool);
	return std::find(F.begin(), F.end(), Id) != F.end();
}

bool UWFActivitySubsystem::IsWeeklyElite(const std::string& Id, double NowMs) const
{
	const std::vector<std::string> W = wf::activity::WeeklyElitesFor(NowMs, EliteIds);
	return std::find(W.begin(), W.end(), Id) != W.end();
}

TArray<FString> UWFActivitySubsystem::DescribeBoard(const FString& Area) const
{
	TArray<FString> Out;
	const UWFProgressionSubsystem* P = Progression();
	const UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	if (!P || !Racing) return Out;
	const double Now = UWFProgressionSubsystem::NowMs();
	const std::string Want = ToStd(Area.ToLower());
	for (const FBoardDef& D : Board)
	{
		if (!Want.empty() && D.Area != Want) continue;
		if (D.bElite && !IsWeeklyElite(D.Rules.Id, Now)) continue; // only this week's three elite operations are offered
		const wf::activity::FState St = wf::activity::ActivityState(Racing->Catalog(), P->Get(), D.Rules, Now);
		std::string Steps;
		for (const wf::activity::FObjective& O : D.Stages) Steps += (Steps.empty() ? "" : " > ") + O.Label;
		const wf::activity::FArea* A = AreaOf(D.Area);
		FString Lock = St.bAvailable ? FString::Printf(TEXT("%s attempts left"), std::isinf(St.AttemptsLeft) ? TEXT("unlimited") : *FString::Printf(TEXT("%g"), St.AttemptsLeft))
			: FString::Printf(TEXT("LOCKED: %s%s"), *ToF(St.Reason.value_or("unavailable")), St.CooldownLeftMs > 0 ? *FString::Printf(TEXT(" (%s)"), *ActClock(St.CooldownLeftMs / 1000)) : TEXT(""));
		Out.Add(FString::Printf(TEXT("%s  %s%s%s  [%s · %s · difficulty %d]  %s  ·  %g Nex, %g XP  ·  %s"), *ToF(D.Rules.Id), *ToF(D.Name), IsFeatured(D.Rules.Id, Now) ? TEXT(" · FEATURED x1.5") : TEXT(""),
			D.bElite ? TEXT(" · WEEKLY ELITE") : TEXT(""), A ? *ToF(A->Name) : *ToF(D.Area), *ToF(wf::activity::CategoryOf(D.Rules.Kind, D.Rules.Id, D.Area)), D.Difficulty, *ToF(Steps), D.Rules.Rewards.Nex, D.Rules.Rewards.Xp, *Lock));
	}
	return Out;
}

FString UWFActivitySubsystem::Start(const FString& Id)
{
	UWFProgressionSubsystem* P = Progression();
	const UWFRaceSubsystem* Racing = GetGameInstance()->GetSubsystem<UWFRaceSubsystem>();
	if (!P || !Racing) return TEXT("No save loaded");
	if (Active) return TEXT("An activity is already running (ActivityAbandon to give up)");
	if (Racing->IsRacing()) return TEXT("Finish the race first");
	const std::string Want = ToStd(Id);
	const FBoardDef* Def = nullptr;
	for (const FBoardDef& D : Board) if (D.Rules.Id == Want) Def = &D;
	if (!Def) return FString::Printf(TEXT("Unknown activity %s (Activities lists them; races start with StartRace)"), *Id);
	const double Now = UWFProgressionSubsystem::NowMs();
	if (Def->bElite && !IsWeeklyElite(Def->Rules.Id, Now)) return TEXT("Not one of this week's elite operations");
	for (const wf::activity::FObjective& O : Def->Stages)
		if (O.Kind == "pvp" && !wf::pvp::ModeById(O.Mode)) return TEXT("Unknown Killbox mode");
	if (Def->bSubmerged) return TEXT("This one is underwater, and diving is not in this build yet");
	if (!AreaOf(Def->Area)) return TEXT("Its area is not in the data");
	wf::activity::FActivityRun Run;
	std::string Error;
	if (!wf::activity::StartActivity(Racing->Catalog(), P->Mutable(), Def->Rules, Now, std::nullopt, Run, Error)) return ToF(Error);
	wf::activity::BeginObjectives(Run, Def->Stages, Now);
	Active = std::move(Run);
	LastSummary.Reset();
	P->NotifyChanged();
	return FString();
}

void UWFActivitySubsystem::Abandon()
{
	if (!Active) return;
	const FBoardDef* D = ActiveDef();
	LastSummary = {FString::Printf(TEXT("%s abandoned (the attempt stays spent)"), *ToF(D ? D->Name : Active->Id))};
	Active.reset();
	++FinishedCount;
}

std::optional<wf::activity::FTarget> UWFActivitySubsystem::Target() const
{
	const FBoardDef* D = ActiveDef();
	const wf::activity::FArea* A = D ? AreaOf(D->Area) : nullptr;
	if (!D || !A) return std::nullopt;
	return wf::activity::CurrentTarget(D->Stages, *A, *Active);
}

void UWFActivitySubsystem::Tick(const wf::activity::FTick& Facts)
{
	if (!Active) return;
	const FBoardDef* D = ActiveDef();
	const wf::activity::FArea* A = D ? AreaOf(D->Area) : nullptr;
	if (!D || !A) { Active.reset(); return; }
	wf::activity::StepRun(D->Stages, *A, *Active, Facts);
	if (Active->Status != "active") Finish(Facts.NowMs);
}

void UWFActivitySubsystem::Finish(double NowMs)
{
	const FBoardDef* D = ActiveDef();
	UWFProgressionSubsystem* P = Progression();
	LastSummary.Reset();
	if (D && P && Active->Status == "complete")
	{
		const double LevelBefore = P->Get().Level;
		wf::activity::FPayout Pay;
		std::string Error;
		if (wf::activity::CompleteActivity(P->Mutable(), D->Rules, *Active, NowMs, IsFeatured(D->Rules.Id, Active->StartedAt), Pay, Error))
		{
			LastSummary.Add(FString::Printf(TEXT("%s complete: +%g Nex, +%g XP, +%g %s reputation"), *ToF(D->Name), Pay.Nex, Pay.Xp, Pay.Rep, *ToF(D->Rules.Faction)));
			FString Mats;
			for (const auto& [K, V] : Pay.Materials) Mats += FString::Printf(TEXT("%s%g %s"), Mats.IsEmpty() ? TEXT("") : TEXT(", "), V, *ToF(K));
			if (!Mats.IsEmpty()) LastSummary.Add(TEXT("Materials: ") + Mats);
			if (Pay.bBonus) LastSummary.Add(FString::Printf(TEXT("Challenge met: %s (+25%%)"), *ToF(D->ChallengeLabel)));
			if (Pay.bFeatured) LastSummary.Add(TEXT("Featured today (x1.5)"));
			P->NotifyChanged();
			if (P->Get().Level > LevelBefore) P->OnLevelUp.Broadcast(static_cast<int32>(P->Get().Level));
		}
		else LastSummary.Add(FString::Printf(TEXT("%s complete (%s)"), *ToF(D->Name), *ToF(Error)));
	}
	else LastSummary.Add(FString::Printf(TEXT("%s failed: %s"), *ToF(D ? D->Name : Active->Id), *ToF(Active->FailReason.value_or("failed"))));
	Active.reset();
	++FinishedCount;
}

TArray<FString> UWFActivitySubsystem::DescribeRun(double NowMs) const
{
	TArray<FString> Out;
	const FBoardDef* D = ActiveDef();
	if (!D || !Active || static_cast<size_t>(Active->Stage) >= D->Stages.size()) return Out;
	const wf::activity::FObjective& O = D->Stages[static_cast<size_t>(Active->Stage)];
	Out.Add(FString::Printf(TEXT("%s  ·  stage %d/%d"), *ToF(D->Name), Active->Stage + 1, static_cast<int32>(D->Stages.size())));
	FString Line = FString::Printf(TEXT("%s  %g/%g"), *ToF(O.Label), Active->Progress, Active->Need);
	if (O.Kind == "deliver") Line = FString::Printf(TEXT("%s  %s"), *ToF(O.Label), Active->bCarrying ? TEXT("(carrying: take it to the marker)") : TEXT("(pick it up at the marker)"));
	if (O.Kind == "course" || O.Kind == "collect" || O.Kind == "deliver") Line += TEXT("  ·  ") + ActClock(O.TimeLimit - (NowMs - Active->StageStartedAt) / 1000);
	Out.Add(Line);
	if (!D->ChallengeLabel.empty()) Out.Add(TEXT("Challenge: ") + ToF(D->ChallengeLabel));
	return Out;
}
