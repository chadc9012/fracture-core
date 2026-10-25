#include "WFEncounterData.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFDataFiles.h"

using WFData::ToStd;

namespace
{
	std::optional<double> EncOptNum(const TSharedPtr<FJsonObject>& O, const TCHAR* Field)
	{
		double V = 0;
		if (O.IsValid() && O->TryGetNumberField(Field, V)) return V;
		return std::nullopt;
	}

	std::optional<wf::encounter::FZoneSpec> EncZone(const TSharedPtr<FJsonObject>& O, const TCHAR* Field)
	{
		const TSharedPtr<FJsonObject>* Z = nullptr;
		if (!O.IsValid() || !O->TryGetObjectField(Field, Z) || !Z || !Z->IsValid()) return std::nullopt;
		wf::encounter::FZoneSpec S;
		S.Kind = ToStd(WFData::Str(*Z, TEXT("kind")));
		S.Radius = WFData::Num(*Z, TEXT("radius"));
		S.Dps = WFData::Num(*Z, TEXT("dps"));
		S.Slow = WFData::Num(*Z, TEXT("slow"), 1.0);
		S.Count = WFData::Num(*Z, TEXT("count"));
		S.Arm = WFData::Num(*Z, TEXT("arm"));
		S.Life = WFData::Num(*Z, TEXT("life"));
		S.Place = ToStd(WFData::Str(*Z, TEXT("place")));
		S.RingRadius = EncOptNum(*Z, TEXT("ringRadius"));
		S.OrbitSpeed = EncOptNum(*Z, TEXT("orbitSpeed"));
		S.Name = ToStd(WFData::Str(*Z, TEXT("name")));
		return S;
	}

	TSharedPtr<FJsonValue> EncParse(const FString& Text)
	{
		TSharedPtr<FJsonValue> V;
		if (Text.IsEmpty() || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), V)) return nullptr;
		return V;
	}
}

namespace WFEncounterData
{
	bool LoadCatalog(wf::encounter::FCatalog& Out, FString& OutError)
	{
		wf::encounter::FCatalog C;
		TArray<TSharedPtr<FJsonObject>> Rows;
		if (!WFData::LoadRows(TEXT("ScenarioEncounters"), Rows, OutError)) return false;
		for (const TSharedPtr<FJsonObject>& Row : Rows)
		{
			wf::encounter::FEncounterDef Def;
			Def.ScenarioId = ToStd(WFData::Str(Row, TEXT("ScenarioId")));
			Def.Victory = ToStd(WFData::Str(Row, TEXT("Victory")));
			if (const TSharedPtr<FJsonValue> Attacks = EncParse(WFData::Str(Row, TEXT("AttacksJson"))); Attacks.IsValid() && Attacks->AsObject().IsValid())
				for (const auto& Pair : Attacks->AsObject()->Values)
				{
					const TSharedPtr<FJsonObject> A = Pair.Value->AsObject();
					if (!A.IsValid()) continue;
					wf::encounter::FAttackDef Atk;
					Atk.Id = ToStd(WFData::Str(A, TEXT("id")));
					Atk.Kind = ToStd(WFData::Str(A, TEXT("kind")));
					Atk.Label = ToStd(WFData::Str(A, TEXT("label")));
					Atk.Tell = ToStd(WFData::Str(A, TEXT("tell")));
					Atk.TellTime = WFData::Num(A, TEXT("tellTime"));
					Atk.Damage = WFData::Num(A, TEXT("damage"));
					Atk.MinRange = WFData::Num(A, TEXT("minRange"));
					Atk.MaxRange = WFData::Num(A, TEXT("maxRange"));
					Atk.Radius = EncOptNum(A, TEXT("radius"));
					Atk.Width = EncOptNum(A, TEXT("width"));
					Atk.Arc = EncOptNum(A, TEXT("arc"));
					Atk.Reach = EncOptNum(A, TEXT("reach"));
					Atk.Decoys = EncOptNum(A, TEXT("decoys"));
					Atk.Zones = EncZone(A, TEXT("zones"));
					const TArray<TSharedPtr<FJsonValue>>* Summon = nullptr;
					if (A->TryGetArrayField(TEXT("summon"), Summon))
						for (const TSharedPtr<FJsonValue>& G : *Summon)
						{
							const TSharedPtr<FJsonObject> GO = G->AsObject();
							if (!GO.IsValid()) continue;
							bool bElite = false;
							GO->TryGetBoolField(TEXT("elite"), bElite);
							Atk.Summon.push_back(wf::encounter::FSummonGroup{ToStd(WFData::Str(GO, TEXT("profile"))), ToStd(WFData::Str(GO, TEXT("kind"))), WFData::Num(GO, TEXT("count")), WFData::Num(GO, TEXT("hp")), WFData::Num(GO, TEXT("scale"), 1.0), bElite});
						}
					Atk.Recovery = WFData::Num(A, TEXT("recovery"));
					Atk.Window = WFData::Num(A, TEXT("window"));
					Def.Attacks[Atk.Id] = Atk;
				}
			if (const TSharedPtr<FJsonValue> Phases = EncParse(WFData::Str(Row, TEXT("PhasesJson"))); Phases.IsValid())
			{
				const TArray<TSharedPtr<FJsonValue>>* List = nullptr;
				if (Phases->TryGetArray(List))
					for (const TSharedPtr<FJsonValue>& V : *List)
					{
						const TSharedPtr<FJsonObject> P = V->AsObject();
						if (!P.IsValid()) continue;
						wf::encounter::FPhaseDef Ph;
						Ph.Id = ToStd(WFData::Str(P, TEXT("id")));
						Ph.Name = ToStd(WFData::Str(P, TEXT("name")));
						Ph.Below = WFData::Num(P, TEXT("below"), 1.0);
						Ph.Nova = ToStd(WFData::Str(P, TEXT("nova")));
						Ph.Gap = WFData::Num(P, TEXT("gap"));
						const TArray<TSharedPtr<FJsonValue>>* Attacks = nullptr;
						if (P->TryGetArrayField(TEXT("attacks"), Attacks))
							for (const TSharedPtr<FJsonValue>& A : *Attacks) Ph.Attacks.push_back(ToStd(A->AsString()));
						Ph.Arena = EncZone(P, TEXT("arena"));
						const TSharedPtr<FJsonObject>* Fin = nullptr;
						if (P->TryGetObjectField(TEXT("finale"), Fin) && Fin && Fin->IsValid())
							Ph.Finale = wf::encounter::FFinale{ToStd(WFData::Str(*Fin, TEXT("attack"))), WFData::Num(*Fin, TEXT("window")), WFData::Num(*Fin, TEXT("floorHp")), ToStd(WFData::Str(*Fin, TEXT("nova")))};
						Def.Phases.push_back(Ph);
					}
			}
			if (const TSharedPtr<FJsonValue> Truce = EncParse(WFData::Str(Row, TEXT("TruceJson"))); Truce.IsValid() && Truce->AsObject().IsValid())
				Def.Truce = wf::encounter::FTruce{WFData::Num(Truce->AsObject(), TEXT("below")), WFData::Num(Truce->AsObject(), TEXT("floorFrac")), ToStd(WFData::Str(Truce->AsObject(), TEXT("nova")))};
			if (!Def.ScenarioId.empty() && !Def.Phases.empty()) C.Encounters[Def.ScenarioId] = Def;
		}
		if (!WFData::LoadRows(TEXT("UniqueScenarios"), Rows, OutError)) return false;
		for (const TSharedPtr<FJsonObject>& Row : Rows)
			C.Scenarios[ToStd(WFData::Str(Row, TEXT("Id")))] = wf::encounter::FScenarioRule{WFData::Num(Row, TEXT("OutsideWindowMult"), 1.0), ToStd(WFData::Str(Row, TEXT("Gimmick")))};
		Out = std::move(C);
		return true;
	}
}
