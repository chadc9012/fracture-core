#include "WFProgressionSubsystem.h"

#include "Engine/GameInstance.h"
#include "Kismet/GameplayStatics.h"
#include "Math/RandomStream.h"
#include "Misc/Guid.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFCoreSettings.h"
#include "WFDataFiles.h"
#include "WFProgressionJson.h"
#include "WFQuestSubsystem.h"
#include "WFSaveGame.h"
#include "WorldFractureCoreModule.h"

#include <algorithm>
#include <cmath>

using WFData::ToF;
using WFData::ToStd;

const FString UWFProgressionSubsystem::SlotName = TEXT("WorldFracture_Slot0");

namespace
{
	/** The game's random numbers: one uniform draw per roll, and a short unique text for weapon-drop ids. */
	class FWFRandom final : public wf::reward::IRandom
	{
	public:
		FWFRandom() : Stream(static_cast<int32>(FDateTime::UtcNow().GetTicks() & 0x7fffffff)) {}
		double Uniform() override { return static_cast<double>(Stream.GetFraction()); }
		std::string UniqueSuffix() override { return ToStd(FGuid::NewGuid().ToString(EGuidFormats::Digits).Left(6).ToLower()); }

	private:
		FRandomStream Stream;
	};

	double UtcNowMs() { return std::floor((FDateTime::UtcNow() - FDateTime(1970, 1, 1)).GetTotalMilliseconds()); }

	std::optional<std::string> NonEmpty(const FString& S) { return S.IsEmpty() ? std::nullopt : std::optional<std::string>(ToStd(S)); }
}

void UWFProgressionSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	FString Error;
	if (!LoadRewardCatalog(Error))
		UE_LOG(LogWorldFracture, Error, TEXT("Reward catalog failed to load (%s); kills still pay credits and materials but drop no gear."), *Error);
	NewGame();
	if (LoadGame()) UE_LOG(LogWorldFracture, Log, TEXT("Loaded save %s: level %d"), *SlotName, GetLevel());
}

bool UWFProgressionSubsystem::LoadRewardCatalog(FString& OutError)
{
	wf::reward::FCatalog Next;
	TArray<TSharedPtr<FJsonObject>> Rows;
	if (!WFData::LoadRows(TEXT("ArmorSets"), Rows, OutError)) return false;
	for (const TSharedPtr<FJsonObject>& Row : Rows)
	{
		wf::reward::FArmorSet Set;
		Set.Id = ToStd(WFData::Str(Row, TEXT("Id")));
		Set.Name = ToStd(WFData::Str(Row, TEXT("DisplayName")));
		Set.RegionId = ToStd(WFData::Str(Row, TEXT("RegionId")));
		Set.Element = ToStd(WFData::Str(Row, TEXT("Element")));
		TSharedPtr<FJsonObject> Pieces;
		if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(Row, TEXT("PiecesJson"))), Pieces) && Pieces.IsValid())
			for (const auto& Pair : Pieces->Values) Set.Pieces[ToStd(Pair.Key)] = ToStd(Pair.Value->AsString());
		Next.Sets.push_back(Set);
	}

	if (!WFData::LoadRows(TEXT("WeaponLootPools"), Rows, OutError)) return false;
	Rows.Sort([](const TSharedPtr<FJsonObject>& A, const TSharedPtr<FJsonObject>& B) { return WFData::Num(A, TEXT("Order")) < WFData::Num(B, TEXT("Order")); });
	for (const TSharedPtr<FJsonObject>& Row : Rows)
	{
		wf::reward::FWeaponTemplate W{ToStd(WFData::Str(Row, TEXT("WeaponId"))), ToStd(WFData::Str(Row, TEXT("DisplayName"))), ToStd(WFData::Str(Row, TEXT("Slot"))), ToStd(WFData::Str(Row, TEXT("Element")))};
		(WFData::Str(Row, TEXT("Pool")) == TEXT("boss") ? Next.BossPool : Next.EnemyPool).push_back(W);
	}
	// Unique Scenarios: reward credits and regions (unique-scenarios.ts), signature loot (scenario-loot.ts), covenant abilities (dragon-covenant.ts)
	ScenarioRegions.Reset();
	ScenarioOrder.Reset();
	if (!WFData::LoadRows(TEXT("UniqueScenarios"), Rows, OutError)) return false;
	for (const TSharedPtr<FJsonObject>& Row : Rows)
	{
		const FString Id = WFData::Str(Row, TEXT("Id"));
		Next.Scenarios.RewardCredits[ToStd(Id)] = WFData::Num(Row, TEXT("RewardCredits"));
		ScenarioRegions.Add(Id, WFData::Str(Row, TEXT("RegionId")));
		ScenarioOrder.Add(Id);
	}
	if (!WFData::LoadRows(TEXT("ScenarioLoot"), Rows, OutError)) return false;
	for (const TSharedPtr<FJsonObject>& Row : Rows)
	{
		wf::scenario::FLootEntry& Entry = Next.Scenarios.Loot[ToStd(WFData::Str(Row, TEXT("Name")))];
		TArray<TSharedPtr<FJsonValue>> Items;
		if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(Row, TEXT("GuaranteedJson"))), Items))
			for (const TSharedPtr<FJsonValue>& V : Items)
				if (V.IsValid() && V->AsObject().IsValid()) Entry.Guaranteed.push_back(WFProgressionJson::GearFromJson(V->AsObject()));
		Items.Reset();
		if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(Row, TEXT("ChanceJson"))), Items))
			for (const TSharedPtr<FJsonValue>& V : Items)
			{
				const TSharedPtr<FJsonObject> O = V.IsValid() ? V->AsObject() : nullptr;
				const TSharedPtr<FJsonObject>* Item = nullptr;
				if (O.IsValid() && O->TryGetObjectField(TEXT("item"), Item) && Item && Item->IsValid())
					Entry.Chance.push_back({WFProgressionJson::GearFromJson(*Item), WFData::Num(O, TEXT("chance"))});
			}
	}
	if (!WFData::LoadRows(TEXT("CovenantAbilities"), Rows, OutError)) return false;
	for (const TSharedPtr<FJsonObject>& Row : Rows)
		Next.Scenarios.CovenantAbility[ToStd(WFData::Str(Row, TEXT("Name")))] = ToStd(WFData::Str(Row, TEXT("Id")));

	// Mission payouts: completion weapons, story missions with their exotic and quest event, armor collections
	wf::missionreward::FCatalog Missions;
	if (!WFData::LoadRows(TEXT("CompletionWeapons"), Rows, OutError)) return false;
	Rows.Sort([](const TSharedPtr<FJsonObject>& A, const TSharedPtr<FJsonObject>& B) { return WFData::Num(A, TEXT("Order")) < WFData::Num(B, TEXT("Order")); });
	for (const TSharedPtr<FJsonObject>& Row : Rows)
		Missions.CompletionPool.push_back({ToStd(WFData::Str(Row, TEXT("WeaponId"))), ToStd(WFData::Str(Row, TEXT("DisplayName"))), ToStd(WFData::Str(Row, TEXT("Slot"))), ToStd(WFData::Str(Row, TEXT("Element")))});
	if (!WFData::LoadRows(TEXT("MissionPayouts"), Rows, OutError)) return false;
	Rows.Sort([](const TSharedPtr<FJsonObject>& A, const TSharedPtr<FJsonObject>& B) { return WFData::Num(A, TEXT("CampaignOrder")) < WFData::Num(B, TEXT("CampaignOrder")); });
	for (const TSharedPtr<FJsonObject>& Row : Rows)
	{
		const std::string Id = ToStd(WFData::Str(Row, TEXT("Id")));
		Missions.StoryMissions.push_back(Id);
		if (WFData::Num(Row, TEXT("CampaignOrder"), -1) >= 0) Missions.Campaign.push_back(Id);
		if (!WFData::Str(Row, TEXT("ExoticWeaponId")).IsEmpty())
			Missions.CampaignExotics[Id] = {ToStd(WFData::Str(Row, TEXT("ExoticWeaponId"))), ToStd(WFData::Str(Row, TEXT("ExoticName"))), ToStd(WFData::Str(Row, TEXT("ExoticSlot"))),
				ToStd(WFData::Str(Row, TEXT("ExoticElement"))), ToStd(WFData::Str(Row, TEXT("ExoticSource")))};
		if (!WFData::Str(Row, TEXT("EventType")).IsEmpty())
		{
			wf::missionreward::FCompletion Done;
			Done.EventType = ToStd(WFData::Str(Row, TEXT("EventType")));
			Done.EventId = ToStd(WFData::Str(Row, TEXT("EventId")));
			TSharedPtr<FJsonObject> Mats;
			if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(WFData::Str(Row, TEXT("Materials"))), Mats) && Mats.IsValid())
				for (const auto& Pair : Mats->Values) Done.Materials[ToStd(Pair.Key)] = Pair.Value->AsNumber();
			Missions.Completions[Id] = Done;
		}
	}
	if (!WFData::LoadRows(TEXT("ArmorSets"), Rows, OutError)) return false;
	for (const TSharedPtr<FJsonObject>& Row : Rows) // table order is ARMOR_SETS order; collections are the rows with a family
	{
		if (WFData::Str(Row, TEXT("Family")).IsEmpty()) continue;
		wf::missionreward::FCollection Col;
		Col.SetId = ToStd(WFData::Str(Row, TEXT("Id")));
		const TArray<TSharedPtr<FJsonValue>>* Sources = nullptr;
		if (Row->TryGetArrayField(TEXT("Sources"), Sources))
			for (const TSharedPtr<FJsonValue>& V : *Sources) Col.Sources.push_back(ToStd(V->AsString()));
		Missions.Collections.push_back(Col);
	}
	MissionCatalog = std::move(Missions);

	Catalog = std::move(Next);
	UE_LOG(LogWorldFracture, Log, TEXT("Reward catalog: %d armor sets, %d/%d weapons in the enemy/boss pools, %d unique scenarios, %d loot tables"),
		static_cast<int32>(Catalog.Sets.size()), static_cast<int32>(Catalog.EnemyPool.size()), static_cast<int32>(Catalog.BossPool.size()),
		static_cast<int32>(Catalog.Scenarios.RewardCredits.size()), static_cast<int32>(Catalog.Scenarios.Loot.size()));
	return true;
}

void UWFProgressionSubsystem::NewGame()
{
	const UWFCoreSettings* Settings = GetDefault<UWFCoreSettings>();
	wf::FProgression Fresh;
	Fresh.ActiveQuestId = std::string(wf::quest::FirstQuestId);
	for (const FString& World : Settings->StartingUnlockedWorlds) Fresh.UnlockedWorlds.push_back(ToStd(World));
	Fresh.CurrentWorld = ToStd(Settings->StartingWorld);
	Fresh.FractureShards = Settings->StartingShards;
	// inventory.ts STARTER_GEAR, worn (STARTER_SLOTS)
	const wf::FGearItem Starter[] = {
		{"vanguard-mk4", "Vanguard MK-IV", "primary", 135, 1, "KINETIC", "Starting loadout", std::nullopt, std::nullopt},
		{"scrap-slugger", "Scrap-Slugger", "secondary", 90, 1, "KINETIC", "Starting loadout", std::nullopt, std::nullopt},
		{"field-helmet", "Field Helmet", "helmet", 75, 1, "KINETIC", "Starting loadout", std::nullopt, std::nullopt},
		{"field-chest", "Field Chestplate", "chest", 90, 1, "KINETIC", "Starting loadout", std::nullopt, std::nullopt},
		{"field-legs", "Field Greaves", "legs", 70, 1, "KINETIC", "Starting loadout", std::nullopt, std::nullopt},
	};
	for (const wf::FGearItem& Item : Starter)
	{
		Fresh.Inventory.push_back(Item);
		Fresh.EquippedGear[Item.Slot] = Item.Id;
	}
	State = std::move(Fresh);
	Tally = {};
	NotifyChanged();
}

bool UWFProgressionSubsystem::SaveGame()
{
	UWFSaveGame* Save = Cast<UWFSaveGame>(UGameplayStatics::CreateSaveGameObject(UWFSaveGame::StaticClass()));
	if (!Save) return false;
	Save->ProgressionJson = WFProgressionJson::ToJson(State);
	Save->SavedAt = FDateTime::UtcNow();
	return UGameplayStatics::SaveGameToSlot(Save, SlotName, 0);
}

bool UWFProgressionSubsystem::LoadGame()
{
	if (!UGameplayStatics::DoesSaveGameExist(SlotName, 0)) return false;
	const UWFSaveGame* Save = Cast<UWFSaveGame>(UGameplayStatics::LoadGameFromSlot(SlotName, 0));
	if (!Save) return false;
	wf::FProgression Loaded = State;
	FString Error;
	if (!WFProgressionJson::FromJson(Save->ProgressionJson, Loaded, Error))
	{
		UE_LOG(LogWorldFracture, Error, TEXT("Save %s unreadable: %s"), *SlotName, *Error);
		return false;
	}
	State = std::move(Loaded);
	NotifyChanged();
	return true;
}

EWFDefeatOutcome UWFProgressionSubsystem::ReportEnemyDefeated(const FWFEnemyRewardInfo& Enemy)
{
	wf::reward::FMachine M;
	M.bAlive = true;
	M.Hp = 0;
	M.bBoss = Enemy.bBoss;
	M.bElite = Enemy.bElite;
	M.bDecoy = Enemy.bDecoy;
	M.bMission = Enemy.bMission;
	M.bEmergencyQuest = Enemy.bEmergencyQuest;
	M.Zone = ToStd(Enemy.Zone);
	M.DropMaterial = ToStd(Enemy.DropMaterial);
	M.Profile = ToStd(Enemy.Profile);
	M.Rival = NonEmpty(Enemy.Rival);
	M.Living = NonEmpty(Enemy.Living);
	M.Nemesis = NonEmpty(Enemy.Nemesis);
	M.ScenarioId = NonEmpty(Enemy.ScenarioId);
	M.ScenarioRun = NonEmpty(Enemy.ScenarioRun);
	M.PlayerHits = Enemy.PlayerHits;
	if (Enemy.FightSeconds >= 0) M.Elapsed = Enemy.FightSeconds;
	if (Enemy.FightDeaths >= 0) M.Deaths = Enemy.FightDeaths;

	static FWFRandom Random; // one stream for the session: re-seeding per kill would repeat rolls within a clock tick
	const wf::reward::EDefeatResult Result = wf::reward::DefeatMachine(Catalog, M, Enemy.bKilledByWorld ? wf::reward::ECredit::World : wf::reward::ECredit::Player, Tally, Random);
	if (Result != wf::reward::EDefeatResult::Paid) return static_cast<EWFDefeatOutcome>(Result);

	// The web build drains sim.drops into claimDrops and sim.xpEvents into grantXP every frame (Scene/GameCanvas);
	// a defeat here drains straight away.
	const size_t InventoryBefore = State.Inventory.size();
	std::vector<std::pair<std::string, std::string>> Claims; // scenario id, its run's reward key
	for (const wf::reward::FDrop& Drop : Tally.Drops)
		if (Drop.ScenarioClaim) Claims.emplace_back(Drop.ScenarioClaim->ScenarioId, "scenario-run:" + Drop.ScenarioClaim->RunId);
	const std::vector<std::string> EarnedBefore = State.EarnedRewards;
	State = wf::reward::ClaimDrops(Catalog, std::move(State), Tally.Drops, UtcNowMs());
	for (size_t I = InventoryBefore; I < State.Inventory.size(); ++I)
		OnLootGained.Broadcast(ToF(State.Inventory[I].Name), ToF(State.Inventory[I].Rarity.value_or("")));
	for (const auto& [ScenarioId, Key] : Claims)
	{
		const bool bPaid = std::find(EarnedBefore.begin(), EarnedBefore.end(), Key) == EarnedBefore.end()
			&& std::find(State.EarnedRewards.begin(), State.EarnedRewards.end(), Key) != State.EarnedRewards.end();
		OnScenarioClaimed.Broadcast(ToF(ScenarioId), bPaid);
	}
	Tally.Drops.clear();

	const double Scale = GetChallengeRewardScale();
	for (const wf::reward::FXpEvent& Xp : Tally.XpEvents)
	{
		wf::reward::FGrantXpResult Grant = wf::reward::GrantXP(std::move(State), Xp.Type, Xp.EnemyLevel, Xp.CombatHeat, std::nullopt, Scale);
		State = std::move(Grant.Progression);
		if (Grant.bLeveledUp) OnLevelUp.Broadcast(static_cast<int32>(Grant.NewLevel));
	}
	Tally.XpEvents.clear();

	if (UWFQuestSubsystem* Quests = GetGameInstance()->GetSubsystem<UWFQuestSubsystem>()) Quests->ReportKill(Enemy.Zone);
	NotifyChanged();
	return EWFDefeatOutcome::Paid;
}

bool UWFProgressionSubsystem::SetIdentityClass(const FString& ClassId)
{
	if (ClassId != TEXT("TITAN") && ClassId != TEXT("HUNTER") && ClassId != TEXT("WARLOCK")) return false;
	State.IdentityClass = ToStd(ClassId);
	NotifyChanged();
	return true;
}

void UWFProgressionSubsystem::AfterMissionPayout(size_t InventoryBefore)
{
	for (size_t I = InventoryBefore; I < State.Inventory.size(); ++I)
		OnLootGained.Broadcast(ToF(State.Inventory[I].Name), ToF(State.Inventory[I].Rarity.value_or("")));
	if (State.LastMissionReward)
		OnMissionPaid.Broadcast(ToF(State.LastMissionReward->MissionId), State.LastMissionReward->Factor, State.LastMissionReward->bFirstClear);
	NotifyChanged();
}

bool UWFProgressionSubsystem::CompleteMission(const FString& MissionId)
{
	const size_t InventoryBefore = State.Inventory.size();
	const double LevelBefore = State.Level;
	wf::missionreward::FCompletionResult R = wf::missionreward::ApplyMissionCompletion(Catalog, MissionCatalog, std::move(State), ToStd(MissionId), UtcNowMs());
	State = std::move(R.Progression);
	if (!R.bPaid) return false;
	if (State.Level > LevelBefore) OnLevelUp.Broadcast(static_cast<int32>(State.Level));
	AfterMissionPayout(InventoryBefore);
	// then the quest tick, as applyMissionCompletion does: gameTick(rewardMission(...), event)
	if (UWFQuestSubsystem* Quests = GetGameInstance()->GetSubsystem<UWFQuestSubsystem>())
	{
		if (R.QuestEvent->EventType == "BOSS_DEFEATED") Quests->ReportBossDefeated(ToF(R.QuestEvent->EventId));
		else Quests->ReportMissionComplete(ToF(R.QuestEvent->EventId));
	}
	return true;
}

void UWFProgressionSubsystem::RewardMission(const FString& MissionId, const TMap<FString, double>& Materials)
{
	std::map<std::string, double> Mats;
	for (const auto& Pair : Materials) Mats[ToStd(Pair.Key)] = Pair.Value;
	const size_t InventoryBefore = State.Inventory.size();
	const double LevelBefore = State.Level;
	State = wf::missionreward::RewardMission(Catalog, MissionCatalog, std::move(State), ToStd(MissionId), Mats, UtcNowMs());
	if (State.Level > LevelBefore) OnLevelUp.Broadcast(static_cast<int32>(State.Level));
	AfterMissionPayout(InventoryBefore);
}

double UWFProgressionSubsystem::GetNexBalance() const
{
	double Sum = 0;
	for (const auto& [Key, Amount] : State.NexLedger) Sum += Amount;
	return FMath::Max(0.0, Sum);
}

FString UWFProgressionSubsystem::MintScenarioRun(const FString& ScenarioId)
{
	// sim.ts: `${id}-${Date.now().toString(36)}-${hitId.toString(36)}-${random base36}`
	const int64 NowMs = static_cast<int64>((FDateTime::UtcNow() - FDateTime(1970, 1, 1)).GetTotalMilliseconds());
	auto Base36 = [](int64 V) { FString Out; do { const int32 D = static_cast<int32>(V % 36); Out.InsertAt(0, static_cast<TCHAR>(D < 10 ? TEXT('0') + D : TEXT('a') + D - 10)); V /= 36; } while (V > 0); return Out; };
	return FString::Printf(TEXT("%s-%s-%s-%s"), *ScenarioId, *Base36(NowMs), *Base36(NextRunSerial++), *FGuid::NewGuid().ToString(EGuidFormats::Digits).Left(6).ToLower());
}

bool UWFProgressionSubsystem::HasClearedScenario(const FString& ScenarioId) const
{
	if (!State.IdentityClass) return false;
	const std::string Key = "enc-done:" + *State.IdentityClass + ":" + ToStd(ScenarioId);
	return std::find(State.EarnedRewards.begin(), State.EarnedRewards.end(), Key) != State.EarnedRewards.end();
}

TArray<FString> UWFProgressionSubsystem::GetScenariosInRegion(const FString& RegionId) const
{
	TArray<FString> Out;
	for (const FString& Id : ScenarioOrder)
		if (const FString* Region = ScenarioRegions.Find(Id); Region && *Region == RegionId) Out.Add(Id);
	return Out;
}

double UWFProgressionSubsystem::GetMaterial(const FString& Material) const
{
	const auto Found = State.Materials.find(ToStd(Material));
	return Found == State.Materials.end() ? 0.0 : Found->second;
}

double UWFProgressionSubsystem::GetChallengeRewardScale() const
{
	return State.Challenge == "VERY_HARD" ? 1.5 : State.Challenge == "HARD" ? 1.25 : 1.0;
}

double UWFProgressionSubsystem::GetChallengeEnemyHealthScale() const
{
	return State.Challenge == "VERY_HARD" ? 1.8 : State.Challenge == "HARD" ? 1.4 : 1.0;
}

FString UWFProgressionSubsystem::DescribeLoot() const
{
	return ToF(wf::reward::DescribeLoot(State));
}
