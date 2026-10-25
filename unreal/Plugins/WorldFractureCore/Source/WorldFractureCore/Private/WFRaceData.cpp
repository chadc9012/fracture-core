#include "WFRaceData.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFDataFiles.h"

using WFData::ToStd;

namespace
{
	TArray<TSharedPtr<FJsonValue>> RaceArray(const FString& Text)
	{
		TArray<TSharedPtr<FJsonValue>> Out;
		if (!Text.IsEmpty()) FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Out);
		return Out;
	}
	std::optional<double> RaceOptNum(const TSharedPtr<FJsonObject>& O, const TCHAR* Field)
	{
		double V = 0;
		if (O.IsValid() && O->TryGetNumberField(Field, V)) return V;
		return std::nullopt;
	}
}

namespace WFRaceData
{
	bool Load(wf::race::FCatalog& OutRaces, std::map<std::string, wf::activity::FActivityDef>& OutActivities, FString& OutError)
	{
		wf::race::FCatalog C;
		std::map<std::string, wf::activity::FActivityDef> Acts;
		TArray<TSharedPtr<FJsonObject>> Rows;
		if (!WFData::LoadRows(TEXT("RaceCourses"), Rows, OutError)) return false;
		for (const TSharedPtr<FJsonObject>& Row : Rows)
		{
			wf::race::FRaceDef R;
			R.Id = ToStd(WFData::Str(Row, TEXT("Id")));
			R.Area = ToStd(WFData::Str(Row, TEXT("Area")));
			R.Name = ToStd(WFData::Str(Row, TEXT("DisplayName")));
			R.Type = ToStd(WFData::Str(Row, TEXT("Type")));
			R.Mode = ToStd(WFData::Str(Row, TEXT("Mode")));
			R.Par = WFData::Num(Row, TEXT("Par"), 60);
			R.Rivals = static_cast<int>(WFData::Num(Row, TEXT("Rivals"), 5));
			R.Rank = static_cast<int>(WFData::Num(Row, TEXT("Rank")));
			R.Laps = static_cast<int>(WFData::Num(Row, TEXT("Laps"), 1));
			R.HiddenNeed = static_cast<int>(WFData::Num(Row, TEXT("HiddenNeed")));
			for (const TSharedPtr<FJsonValue>& V : RaceArray(WFData::Str(Row, TEXT("HiddenMarkers")))) R.HiddenMarkers.push_back(ToStd(V->AsString()));
			R.bHidden = !R.HiddenMarkers.empty();
			for (const TSharedPtr<FJsonValue>& V : RaceArray(WFData::Str(Row, TEXT("PointsJson"))))
			{
				const TSharedPtr<FJsonObject> O = V->AsObject();
				if (!O.IsValid()) continue;
				R.Points.push_back({WFData::Num(O, TEXT("x")), WFData::Num(O, TEXT("z")), RaceOptNum(O, TEXT("depth")), RaceOptNum(O, TEXT("period")), RaceOptNum(O, TEXT("open"))});
			}
			for (const TSharedPtr<FJsonValue>& V : RaceArray(WFData::Str(Row, TEXT("ShortcutsJson"))))
			{
				const TSharedPtr<FJsonObject> O = V->AsObject();
				if (O.IsValid()) R.Shortcuts.push_back({static_cast<int>(WFData::Num(O, TEXT("at"))), WFData::Num(O, TEXT("x")), WFData::Num(O, TEXT("z")), static_cast<int>(WFData::Num(O, TEXT("skipTo")))});
			}
			for (const TSharedPtr<FJsonValue>& V : RaceArray(WFData::Str(Row, TEXT("ObstaclesJson"))))
			{
				const TSharedPtr<FJsonObject> O = V->AsObject();
				if (O.IsValid()) R.Obstacles.push_back({ToStd(WFData::Str(O, TEXT("id"))), WFData::Num(O, TEXT("x")), WFData::Num(O, TEXT("z")), WFData::Num(O, TEXT("radius"), 2.8), static_cast<int>(WFData::Num(O, TEXT("segment")))});
			}
			if (R.Points.size() < 2) continue;

			wf::activity::FActivityDef A;
			A.Id = R.Id;
			A.Kind = ToStd(WFData::Str(Row, TEXT("ActivityKind")));
			A.Faction = ToStd(WFData::Str(Row, TEXT("Faction")));
			A.Attempts = WFData::Num(Row, TEXT("Attempts"), 3);
			A.CooldownMin = WFData::Num(Row, TEXT("CooldownMin"), 20);
			const FString Challenge = WFData::Str(Row, TEXT("Challenge"));
			if (!Challenge.IsEmpty()) A.ChallengeId = ToStd(Challenge);
			A.TimeLimitSum = WFData::Num(Row, TEXT("TimeLimitSum"));
			A.Rewards.Nex = WFData::Num(Row, TEXT("RewardNex"));
			A.Rewards.Xp = WFData::Num(Row, TEXT("RewardXp"));
			A.Rewards.Rep = WFData::Num(Row, TEXT("RewardRep"));
			A.Rewards.ShaderChance = WFData::Num(Row, TEXT("ShaderChance"));
			TSharedPtr<FJsonObject> Mats;
			if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(Row, TEXT("RewardMaterials"))), Mats) && Mats.IsValid())
				for (const auto& Pair : Mats->Values) A.Rewards.Materials[ToStd(Pair.Key)] = Pair.Value->AsNumber();
			A.RaceRankGate = R.Rank;
			Acts[R.Id] = A;
			C.Races.push_back(std::move(R));
		}
		if (!WFData::LoadRows(TEXT("Championships"), Rows, OutError)) return false;
		for (const TSharedPtr<FJsonObject>& Row : Rows)
		{
			wf::race::FChampionship Ch;
			Ch.Id = ToStd(WFData::Str(Row, TEXT("Id")));
			Ch.Area = ToStd(WFData::Str(Row, TEXT("Area")));
			Ch.Name = ToStd(WFData::Str(Row, TEXT("DisplayName")));
			Ch.Rank = static_cast<int>(WFData::Num(Row, TEXT("Rank")));
			const TArray<TSharedPtr<FJsonValue>>* Rounds = nullptr;
			if (Row->TryGetArrayField(TEXT("Rounds"), Rounds))
				for (const TSharedPtr<FJsonValue>& V : *Rounds) Ch.Rounds.push_back(ToStd(V->AsString()));
			C.Championships.push_back(Ch);
		}
		OutRaces = std::move(C);
		OutActivities = std::move(Acts);
		return true;
	}
}
