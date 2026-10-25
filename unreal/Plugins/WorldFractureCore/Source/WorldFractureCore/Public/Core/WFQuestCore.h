// World Fracture — quest engine core.
//
// A line-for-line port of the web build's src/game/quests.ts (gameTick, reconcileQuests,
// completeQuest, updateWorldState, unlockWorld, finishActiveQuest). Plain standard C++ with no
// Unreal types, so the same file compiles in the engine and in the standalone golden test
// (Tests/QuestCoreTest.cpp), which replays thousands of states recorded from the TypeScript engine.
//
// Unreal code reaches it through UWFQuestSubsystem, which fills a Catalog from the Quests DataTable
// and keeps a Progression on the game instance.
#pragma once

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::quest
{
	enum class EObjectiveType
	{
		EnterWorld,
		Kills,
		Survive,
		MissionComplete,
		DungeonCleared,
		BossDefeated,
		HeatLevel,
		LockdownTier,
		HackComplete,
	};

	/** "ENTER_WORLD" -> EnterWorld etc. (the web build's spelling, as exported). Returns false if unknown. */
	bool ParseObjectiveType(const std::string& Text, EObjectiveType& Out);

	struct FObjective
	{
		EObjectiveType Type = EObjectiveType::Kills;
		std::string Label;
		std::optional<std::string> Key;
		double Amount = 0;
	};

	struct FQuest
	{
		std::string Id;
		std::string Title;
		std::string World;
		std::string Line;
		std::vector<FObjective> Objectives;
		double RewardShards = 0;
		std::map<std::string, double> RewardMaterials;
		std::optional<std::string> UnlocksWorld;
		std::optional<std::string> NextQuestId;
		double Corruption = 0;
	};

	enum class EEventType
	{
		EnterWorld,
		Kill,
		Survived,
		MissionComplete,
		DungeonCleared,
		BossDefeated,
		HeatLevel,
		LockdownTier,
		HackComplete,
	};

	/** One world event. Only the fields its type uses are read (World for EnterWorld/Kill/Survived, Id for
	 *  mission/dungeon/boss ids and the lockdown tier, Number for survived seconds and heat level). */
	struct FEvent
	{
		EEventType Type = EEventType::Kill;
		std::string World;
		std::string Id;
		double Number = 0;

		static FEvent EnterWorld(std::string W) { return {EEventType::EnterWorld, std::move(W), {}, 0}; }
		static FEvent Kill(std::string W) { return {EEventType::Kill, std::move(W), {}, 0}; }
		static FEvent Survived(std::string W, double Seconds) { return {EEventType::Survived, std::move(W), {}, Seconds}; }
		static FEvent MissionComplete(std::string MissionId) { return {EEventType::MissionComplete, {}, std::move(MissionId), 0}; }
		static FEvent DungeonCleared(std::string DungeonId) { return {EEventType::DungeonCleared, {}, std::move(DungeonId), 0}; }
		static FEvent BossDefeated(std::string EncounterId) { return {EEventType::BossDefeated, {}, std::move(EncounterId), 0}; }
		static FEvent HeatLevel(double Level) { return {EEventType::HeatLevel, {}, {}, Level}; }
		static FEvent LockdownTier(std::string Tier) { return {EEventType::LockdownTier, {}, std::move(Tier), 0}; }
		static FEvent HackComplete() { return {EEventType::HackComplete, {}, {}, 0}; }
	};

	/** The quest-relevant slice of PlayerProgression. Lists keep insertion order, as in the web build. */
	struct FProgression
	{
		std::optional<std::string> ActiveQuestId;
		std::vector<std::string> CompletedMissions;
		std::map<std::string, std::vector<double>> QuestObjectiveProgress;
		std::vector<std::string> UnlockedWorlds;
		std::map<std::string, bool> WorldFlags;
		std::string CurrentWorld;
		double CorruptionLevel = 0;
		double FractureShards = 0;
		std::map<std::string, double> Materials;
		std::map<std::string, double> DungeonClears;

		bool operator==(const FProgression& Other) const;
	};

	class FCatalog
	{
	public:
		void Add(FQuest Quest);
		const FQuest* Find(const std::string& Id) const;
		size_t Num() const { return Quests.size(); }

	private:
		std::map<std::string, FQuest> Quests;
	};

	// Tuning shared with the web build (quests.ts).
	inline constexpr double CorruptionPerKill = 0.1;
	inline constexpr double CorruptionPerBoss = 5;
	inline constexpr double WastelandCorruptionThreshold = 45;
	inline constexpr const char* FirstQuestId = "fd-01";

	const FQuest* ActiveQuest(const FCatalog& Catalog, const FProgression& P);
	double ObjectiveDelta(const FObjective& Objective, const FEvent& Event);
	bool ObjectiveAlreadyDone(const FProgression& P, const FObjective& Objective);
	FProgression UnlockWorld(FProgression P, const std::string& World);
	FProgression UpdateWorldState(FProgression P, const FEvent& Event);
	FProgression ReconcileQuests(const FCatalog& Catalog, FProgression P);

	/** The single loop: progress the active quest off this event; on completion reward it, advance the chain and
	 *  unlock its world; then reconcile against persisted completions and roll world state forward. */
	FProgression GameTick(const FCatalog& Catalog, FProgression P, const FEvent& Event);

	/** Dev fast-track: completes the active quest's objectives through the normal path. */
	FProgression FinishActiveQuest(const FCatalog& Catalog, FProgression P);

	/** Stable text form used by the golden test (and handy in logs). */
	std::string ToCanonicalString(const FProgression& P);
}
