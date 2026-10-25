// World Fracture — quest engine core. Port of src/game/quests.ts; see WFQuestCore.h.
#include "Core/WFQuestCore.h"

#include <algorithm>
#include <charconv>
#include <limits>
#include <string>

namespace wf::quest
{
	namespace
	{
		bool Contains(const std::vector<std::string>& List, const std::string& Value)
		{
			return std::find(List.begin(), List.end(), Value) != List.end();
		}

		/** JavaScript's Number(string): whitespace-trimmed, empty -> 0, junk -> NaN. */
		double JsNumber(const std::string& Text)
		{
			const size_t Begin = Text.find_first_not_of(" \t\n\r");
			if (Begin == std::string::npos) return 0;
			const size_t End = Text.find_last_not_of(" \t\n\r");
			const std::string Trimmed = Text.substr(Begin, End - Begin + 1);
			double Value = 0;
			const auto Result = std::from_chars(Trimmed.data(), Trimmed.data() + Trimmed.size(), Value);
			if (Result.ec != std::errc() || Result.ptr != Trimmed.data() + Trimmed.size()) return std::numeric_limits<double>::quiet_NaN();
			return Value;
		}

		/** The quest's stored progress, or zeros when it has none yet (quests.ts `prior`). */
		std::vector<double> PriorProgress(const FProgression& P, const FQuest& Quest)
		{
			const auto Found = P.QuestObjectiveProgress.find(Quest.Id);
			if (Found != P.QuestObjectiveProgress.end()) return Found->second;
			return std::vector<double>(Quest.Objectives.size(), 0.0);
		}

		double At(const std::vector<double>& Values, size_t Index)
		{
			return Index < Values.size() ? Values[Index] : 0.0;
		}

		bool AllObjectivesMet(const FQuest& Quest, const std::vector<double>& Progress)
		{
			for (size_t I = 0; I < Quest.Objectives.size(); ++I)
				if (!(At(Progress, I) >= Quest.Objectives[I].Amount)) return false;
			return true;
		}

		bool ProgressChanged(const std::vector<double>& Updated, const std::vector<double>& Prior)
		{
			for (size_t I = 0; I < Updated.size(); ++I)
				if (Updated[I] != At(Prior, I)) return true;
			return false;
		}

		FProgression CompleteQuest(FProgression P, const FQuest& Quest)
		{
			if (Contains(P.CompletedMissions, Quest.Id)) return P;
			P.CompletedMissions.push_back(Quest.Id);
			P.FractureShards += Quest.RewardShards;
			for (const auto& [Material, Amount] : Quest.RewardMaterials) P.Materials[Material] += Amount;
			P.CorruptionLevel = std::min(100.0, P.CorruptionLevel + Quest.Corruption);
			P.ActiveQuestId = Quest.NextQuestId;
			P.CurrentWorld = Quest.World;
			if (Quest.UnlocksWorld) P = UnlockWorld(std::move(P), *Quest.UnlocksWorld);
			return P;
		}

		void AppendNumber(std::string& Out, double Value)
		{
			char Buffer[64];
			const auto Result = std::to_chars(Buffer, Buffer + sizeof(Buffer), Value);
			Out.append(Buffer, Result.ptr);
		}
	}

	bool ParseObjectiveType(const std::string& Text, EObjectiveType& Out)
	{
		static const std::map<std::string, EObjectiveType> Names = {
			{"ENTER_WORLD", EObjectiveType::EnterWorld},
			{"KILLS", EObjectiveType::Kills},
			{"SURVIVE", EObjectiveType::Survive},
			{"MISSION_COMPLETE", EObjectiveType::MissionComplete},
			{"DUNGEON_CLEARED", EObjectiveType::DungeonCleared},
			{"BOSS_DEFEATED", EObjectiveType::BossDefeated},
			{"HEAT_LEVEL", EObjectiveType::HeatLevel},
			{"LOCKDOWN_TIER", EObjectiveType::LockdownTier},
			{"HACK_COMPLETE", EObjectiveType::HackComplete},
		};
		const auto Found = Names.find(Text);
		if (Found == Names.end()) return false;
		Out = Found->second;
		return true;
	}

	void FCatalog::Add(FQuest Quest)
	{
		std::string Id = Quest.Id;
		Quests[Id] = std::move(Quest);
	}

	const FQuest* FCatalog::Find(const std::string& Id) const
	{
		const auto Found = Quests.find(Id);
		return Found == Quests.end() ? nullptr : &Found->second;
	}

	const FQuest* ActiveQuest(const FCatalog& Catalog, const FProgression& P)
	{
		return P.ActiveQuestId ? Catalog.Find(*P.ActiveQuestId) : nullptr;
	}

	double ObjectiveDelta(const FObjective& O, const FEvent& E)
	{
		const std::string Key = O.Key.value_or("");
		const bool HasKey = O.Key.has_value();
		switch (O.Type)
		{
		case EObjectiveType::EnterWorld: return E.Type == EEventType::EnterWorld && HasKey && E.World == Key ? 1 : 0;
		case EObjectiveType::Kills: return E.Type == EEventType::Kill && HasKey && E.World == Key ? 1 : 0;
		case EObjectiveType::Survive: return E.Type == EEventType::Survived && HasKey && E.World == Key ? E.Number : 0;
		case EObjectiveType::MissionComplete: return E.Type == EEventType::MissionComplete && HasKey && E.Id == Key ? O.Amount : 0;
		case EObjectiveType::DungeonCleared: return E.Type == EEventType::DungeonCleared && HasKey && E.Id == Key ? O.Amount : 0;
		case EObjectiveType::BossDefeated: return E.Type == EEventType::BossDefeated && HasKey && E.Id == Key ? O.Amount : 0;
		case EObjectiveType::HeatLevel: return E.Type == EEventType::HeatLevel && E.Number >= (HasKey ? JsNumber(Key) : 0.0) ? O.Amount : 0;
		case EObjectiveType::LockdownTier: return E.Type == EEventType::LockdownTier && HasKey && E.Id == Key ? O.Amount : 0;
		case EObjectiveType::HackComplete: return E.Type == EEventType::HackComplete ? O.Amount : 0;
		}
		return 0;
	}

	bool ObjectiveAlreadyDone(const FProgression& P, const FObjective& O)
	{
		if (!O.Key || O.Key->empty()) return false;
		const std::string& Key = *O.Key;
		switch (O.Type)
		{
		case EObjectiveType::MissionComplete: return Contains(P.CompletedMissions, Key);
		case EObjectiveType::DungeonCleared:
		case EObjectiveType::BossDefeated:
		{
			const auto Clears = P.DungeonClears.find(Key);
			return (Clears != P.DungeonClears.end() && Clears->second > 0) || Contains(P.CompletedMissions, Key);
		}
		default: return false;
		}
	}

	FProgression UnlockWorld(FProgression P, const std::string& World)
	{
		if (Contains(P.UnlockedWorlds, World)) return P;
		P.UnlockedWorlds.push_back(World);
		P.WorldFlags[World] = true;
		return P;
	}

	FProgression UpdateWorldState(FProgression P, const FEvent& E)
	{
		double Corruption = P.CorruptionLevel;
		if (E.Type == EEventType::Kill) Corruption += CorruptionPerKill;
		if (E.Type == EEventType::BossDefeated) Corruption += CorruptionPerBoss;
		P.CorruptionLevel = std::min(100.0, Corruption);
		if (P.CorruptionLevel >= WastelandCorruptionThreshold && !Contains(P.UnlockedWorlds, "wastelands")) P = UnlockWorld(std::move(P), "wastelands");
		return P;
	}

	FProgression ReconcileQuests(const FCatalog& Catalog, FProgression P)
	{
		for (size_t Guard = 0; Guard <= Catalog.Num(); ++Guard)
		{
			const FQuest* Quest = ActiveQuest(Catalog, P);
			if (!Quest) break;
			const std::vector<double> Prior = PriorProgress(P, *Quest);
			std::vector<double> Updated(Quest->Objectives.size());
			for (size_t I = 0; I < Updated.size(); ++I)
				Updated[I] = ObjectiveAlreadyDone(P, Quest->Objectives[I]) ? Quest->Objectives[I].Amount : At(Prior, I);
			if (ProgressChanged(Updated, Prior)) P.QuestObjectiveProgress[Quest->Id] = Updated;
			if (!AllObjectivesMet(*Quest, Updated)) break;
			P = CompleteQuest(std::move(P), *Quest);
		}
		return P;
	}

	FProgression GameTick(const FCatalog& Catalog, FProgression P, const FEvent& E)
	{
		if (const FQuest* Quest = ActiveQuest(Catalog, P))
		{
			const std::vector<double> Prior = PriorProgress(P, *Quest);
			std::vector<double> Updated(Quest->Objectives.size());
			for (size_t I = 0; I < Updated.size(); ++I)
				Updated[I] = std::min(Quest->Objectives[I].Amount, At(Prior, I) + ObjectiveDelta(Quest->Objectives[I], E));
			if (ProgressChanged(Updated, Prior)) P.QuestObjectiveProgress[Quest->Id] = Updated;
			if (AllObjectivesMet(*Quest, Updated)) P = CompleteQuest(std::move(P), *Quest);
		}
		return UpdateWorldState(ReconcileQuests(Catalog, std::move(P)), E);
	}

	FProgression FinishActiveQuest(const FCatalog& Catalog, FProgression P)
	{
		const FQuest* Quest = ActiveQuest(Catalog, P);
		if (!Quest) return P;
		std::vector<double> Full;
		for (const FObjective& O : Quest->Objectives) Full.push_back(O.Amount);
		P.QuestObjectiveProgress[Quest->Id] = Full;
		const std::string Id = Quest->Id;
		return UpdateWorldState(ReconcileQuests(Catalog, CompleteQuest(std::move(P), *Quest)), FEvent::MissionComplete(Id));
	}

	std::string ToCanonicalString(const FProgression& P)
	{
		std::string Out;
		auto List = [&Out](const std::vector<std::string>& Items) {
			Out += '[';
			for (size_t I = 0; I < Items.size(); ++I) { if (I) Out += ','; Out += Items[I]; }
			Out += ']';
		};
		auto NumberMap = [&Out](const std::map<std::string, double>& Items) {
			Out += '{';
			bool First = true;
			for (const auto& [K, V] : Items) { if (!First) Out += ','; First = false; Out += K; Out += ':'; AppendNumber(Out, V); }
			Out += '}';
		};
		Out += "active=";
		Out += P.ActiveQuestId.value_or("null");
		Out += ";completed=";
		List(P.CompletedMissions);
		Out += ";progress={";
		bool First = true;
		for (const auto& [Id, Values] : P.QuestObjectiveProgress)
		{
			if (!First) Out += ',';
			First = false;
			Out += Id;
			Out += ":[";
			for (size_t I = 0; I < Values.size(); ++I) { if (I) Out += ','; AppendNumber(Out, Values[I]); }
			Out += ']';
		}
		Out += "};unlocked=";
		List(P.UnlockedWorlds);
		Out += ";flags={";
		First = true;
		for (const auto& [K, V] : P.WorldFlags) { if (!First) Out += ','; First = false; Out += K; Out += V ? ":true" : ":false"; }
		Out += "};world=";
		Out += P.CurrentWorld;
		Out += ";corruption=";
		AppendNumber(Out, P.CorruptionLevel);
		Out += ";shards=";
		AppendNumber(Out, P.FractureShards);
		Out += ";materials=";
		NumberMap(P.Materials);
		Out += ";dungeon=";
		NumberMap(P.DungeonClears);
		return Out;
	}
}
