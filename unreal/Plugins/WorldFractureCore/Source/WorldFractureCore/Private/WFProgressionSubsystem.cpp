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
	Catalog = std::move(Next);
	UE_LOG(LogWorldFracture, Log, TEXT("Reward catalog: %d armor sets, %d/%d weapons in the enemy/boss pools"),
		static_cast<int32>(Catalog.Sets.size()), static_cast<int32>(Catalog.EnemyPool.size()), static_cast<int32>(Catalog.BossPool.size()));
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

	static FWFRandom Random; // one stream for the session: re-seeding per kill would repeat rolls within a clock tick
	const wf::reward::EDefeatResult Result = wf::reward::DefeatMachine(Catalog, M, Enemy.bKilledByWorld ? wf::reward::ECredit::World : wf::reward::ECredit::Player, Tally, Random);
	if (Result == wf::reward::EDefeatResult::NotPorted)
		UE_LOG(LogWorldFracture, Warning, TEXT("%s is a Unique Scenario boss; its rewards are not ported yet, nothing was paid."), *Enemy.Profile);
	if (Result != wf::reward::EDefeatResult::Paid) return static_cast<EWFDefeatOutcome>(Result);

	// The web build drains sim.drops into claimDrops and sim.xpEvents into grantXP every frame (Scene/GameCanvas);
	// a defeat here drains straight away.
	const size_t InventoryBefore = State.Inventory.size();
	State = wf::reward::ClaimDrops(Catalog, std::move(State), Tally.Drops);
	for (size_t I = InventoryBefore; I < State.Inventory.size(); ++I)
		OnLootGained.Broadcast(ToF(State.Inventory[I].Name), ToF(State.Inventory[I].Rarity.value_or("")));
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
