#pragma once

#include "CoreMinimal.h"
#include "Core/WFProgression.h"
#include "Core/WFArmorCore.h"
#include "Core/WFMissionRewardCore.h"
#include "Core/WFRewardCore.h"
#include "Core/WFVehicleCore.h"
#include "Core/WFWastelandCore.h"
#include "Core/WFGodforgeCore.h"
#include "Core/WFNemesisCore.h"
#include "Core/WFHitCore.h"
#include "Core/WFStrikeCore.h"
#include "Core/WFStuntCore.h"
#include "Core/WFStashCore.h"

#include <functional>
#include "Subsystems/GameInstanceSubsystem.h"
#include "WFProgressionSubsystem.generated.h"

UENUM(BlueprintType)
enum class EWFDefeatOutcome : uint8
{
	Ignored,     // still alive, or already dead
	Shattered,   // a decoy: no kill
	RivalScored, // a Killbox rival: counts for the match only
	Unpaid,      // killed by the world, not the player
	Paid,
};

/** What a defeated enemy is, for the reward rules (sim.ts Machine fields that decide the payout). */
USTRUCT(BlueprintType)
struct WORLDFRACTURECORE_API FWFEnemyRewardInfo
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bBoss = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bElite = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bEmergencyQuest = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bMission = false;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bDecoy = false;
	/** Region id the enemy belongs to (veridan, wastelands, ...): picks the armor set and labels weapon drops. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Zone = TEXT("veridan");
	/** Material it drops (Machine.drop), e.g. sporeFiber, scrapMetal, magmaCore. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString DropMaterial = TEXT("scrapMetal");
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Profile = TEXT("Raider");
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Rival;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Living;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString Nemesis;
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString ScenarioId;
	/** Run id minted when the scenario boss was summoned (MintScenarioRun); a run pays its signature loot once. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") FString ScenarioRun;
	/** The player's hits on it: a scenario kill pays only after 5 (scenario-loot.ts PARTICIPATION_HITS). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") int32 PlayerHits = 0;
	/** Seconds from summon to kill, negative when unknown (Vyrak's "Wings of the Ancient" challenge). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") double FightSeconds = -1;
	/** Player deaths during the fight, negative when unknown (Vyrak's "Unbroken Covenant" challenge). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") int32 FightDeaths = -1;
	/** True when the world killed it (safe-zone field, turrets) and the player had not hurt it recently. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Reward") bool bKilledByWorld = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FWFLevelUp, int32, NewLevel);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FWFLootGained, const FString&, ItemName, const FString&, Rarity);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FWFProgressionChanged);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FWFMissionPaid, const FString&, MissionId, double, Factor, bool, bFirstClear);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FWFScenarioClaimed, const FString&, ScenarioId, bool, bPaid);

/**
 * The save and the reward pipeline. Owns the one wf::FProgression every system reads (quests included), pays kills
 * through the ported sim.ts / claimDrops / grantXP rules, and saves to a slot as JSON.
 */
UCLASS()
class WORLDFRACTURECORE_API UWFProgressionSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Fresh progression: first quest, starting worlds and shards from UWFCoreSettings, level 1. Not saved until SaveGame. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Progression") void NewGame();
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Progression") bool SaveGame();
	/** Loads the slot if it exists. False (and progression unchanged) when there is no save or it cannot be read. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Progression") bool LoadGame();

	/** Pays a defeated enemy (sim.ts defeatMachine), then claims its drops and XP into the save, and tells the quest chain. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Rewards") EWFDefeatOutcome ReportEnemyDefeated(const FWFEnemyRewardInfo& Enemy);

	/** The Operator class (TITAN, HUNTER, WARLOCK): scenario journal, covenant bond and class rewards are kept per class. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Progression") bool SetIdentityClass(const FString& ClassId);
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") FString GetIdentityClass() const { return State.IdentityClass ? FString(UTF8_TO_TCHAR(State.IdentityClass->c_str())) : FString(); }

	/** Pays a finished story mission once (persistence.ts applyMissionCompletion): XP, materials, loot box, first-clear
	 *  weapon and campaign exotic, armor collection piece, NEX, then fires its quest event. False when already completed. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Rewards") bool CompleteMission(const FString& MissionId);
	/** Any mission or side contract payout (progression.ts rewardMission), with the materials it pays before scaling. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Rewards") void RewardMission(const FString& MissionId, const TMap<FString, double>& Materials);
	/** NEX balance: max(0, sum of the ledger) (nex.ts nexBalance). */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetNexBalance() const;

	/** A run id for a newly summoned Unique Scenario boss, in the web build's format (sim.ts summonScenario). */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Rewards") FString MintScenarioRun(const FString& ScenarioId);
	/** Counts a player death (sim.deaths); scenario fights measure deaths from the count at summon. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Rewards") void RecordPlayerDeath() { ++PlayerDeaths; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Rewards") int32 GetPlayerDeaths() const { return PlayerDeaths; }
	/** Encounter journal: has this class cleared the scenario (enc-done:<class>:<id>)? */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Rewards") bool HasClearedScenario(const FString& ScenarioId) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Rewards") bool IsBondedToVyrak() const { return wf::scenario::IsBonded(State, State.IdentityClass); }
	/** Unique Scenarios in a region (UniqueScenarios table), in table order. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Rewards") TArray<FString> GetScenariosInRegion(const FString& RegionId) const;

	/** Titan, Hunter and Warlock each have their own level, XP, Nex, shards and materials (operator-pockets.ts); one line each */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") FString DescribeOperators() const;
	/** activity-payouts.ts claimBossBounty for the operator being played: a scenario boss's first kill, then a daily
	 *  repeat, in Nex. Returns the Nex paid (0 when today's is already taken); bFirst says which. */
	double ClaimBossBounty(const FString& ScenarioId, bool& bFirst);
	/** A Wastelands activity ended (wasteland-runtime.ts emit): wasteland-activities.ts resolveVault / resolveRally / resolveDerby
	 *  pay it once per run (rewardMission side-* payout, medal tiers once ever, the monoblades, Legion trust). Returns the line to show. */
	FString ResolveWasteland(const wf::wasteland::FEmit& Emit);
	/** A Godforge or secrets action (wf::godforge ForgeRelic, SocketRune, AscendRelic, ClaimHeart, ClaimSecret...): kept when it
	 *  succeeds; returns Vael's line or why it was refused. */
	FString ApplyForge(const std::function<wf::godforge::FForgeResult(const wf::FProgression&)>& Action, bool& bOk);
	/** armor-sets.ts equipPiece: the item goes into its own slot */
	bool EquipItem(const FString& ItemId);
	/** weapon-meta.ts operatorPower: the equipped gear's average power plus 4 a level (to 50) */
	double GetOperatorPower() const { return wf::hit::OperatorPower(wf::hit::EquippedGearPowers(State), State.Level); }
	/** nemesis.ts applyPlayerDeath / applyNemesisKill: returns the line to announce ("" = nothing) */
	FString ApplyPlayerDeath(const wf::nemesis::FKiller& Killer, const FString& RegionName);
	FString ApplyNemesisKill(const FString& NemesisId);
	/** strikes.ts claimStrikeClear for the operator being played: tier Nex once per strike, tier and day; shards, discovery XP, the
	 *  signature gear and the tier clear. Returns the Nex paid (0 when nothing was claimed: locked tier or today's already taken). */
	double ClaimStrike(const FString& StrikeId, const FString& TierId, bool& bClaimed, bool& bFirst);
	/** world-boss.ts payWorldBoss: 2,500 Nex and the materials once per raid; false when this raid already paid */
	bool PayWorldBoss(const FString& RaidId);
	/** stunts.ts payStunts: 1 Nex per 50 stunt points into today's stunts:<day> line, up to 600 a day; returns the Nex paid */
	double PayStunts(double Points);
	/** stash.ts useStim: spend a Heal Stim / Armor Stim / Ruin Stone for a timed buff stack (max 3); false when none or at 3 */
	bool UseConsumable(const FString& Id);
	/** stash.ts buffEffect now: +resist, +health a second, x damage */
	wf::stash::FBuffEffect GetBuffEffect() const { return wf::stash::BuffEffect(Buffs, NowMs()); }
	const wf::stash::FBuffs& GetBuffs() const { return Buffs; }
	/** a stash action (wf::stash CraftStim, CraftRuinStone, SellDuplicate, Dismantle, UpgradeWithParts, ToVault...): kept and
	 *  saved when it returns true */
	bool ApplyStash(const std::function<bool(wf::FProgression&)>& Action);
	/** the time in ms since the epoch, UTC (Date.now()): strikes and raids run on the real clock */
	static double NowMs();
	/** the weapon item worn in the gear slot this weapon fires from (armor GearSlotForWeapon), or null */
	const wf::FGearItem* GetEquippedWeaponItem(const FString& WeaponId, const FString& Kind, bool bInVehicle) const;
	/** Sub-Terra Legion standing (Outsider ... Iron Vanguard) and its trust points */
	FString GetLegionRank() const { return UTF8_TO_TCHAR(wf::wasteland::LegionRank(State).c_str()); }
	double GetLegionTrust() const { return wf::wasteland::TrustOf(State, wf::wasteland::Legion); }
	/** best results (records): the Rust Run time in s, the Mash-Pit wrecks; negative when none */
	double GetRecord(const FString& Id) const { const auto It = State.Records.find(TCHAR_TO_UTF8(*Id)); return It == State.Records.end() ? -1 : It->second; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") int32 GetLevel() const { return static_cast<int32>(State.Level); }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetXp() const { return State.Xp; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetXpToNextLevel() const { return State.Level * wf::reward::XpPerLevel; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetMaterial(const FString& Material) const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") int32 GetInventoryCount() const { return static_cast<int32>(State.Inventory.size()); }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetSessionCredits() const { return Tally.Credits; }
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") int32 GetSessionKills() const { return static_cast<int32>(Tally.Kills); }
	/** sim.ts combatHeat, kept by the game mode: kills scale XP by it (xp.ts comboMultiplier, enemy level) */
	void SetCombatHeat(double Heat) { Tally.CombatHeat = Heat; }
	/** this session's kills (all, elite, boss, Killbox rivals) as sim.ts counts them */
	const wf::reward::FSimTally& GetTally() const { return Tally; }
	/** Difficulty reward factor (map-activities.ts CHALLENGES): 1 / 1.25 / 1.5. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetChallengeRewardScale() const;
	/** Difficulty enemy health factor: 1 / 1.4 / 1.8. */
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") double GetChallengeEnemyHealthScale() const;
	UFUNCTION(BlueprintPure, Category = "World Fracture|Progression") FString DescribeLoot() const;

	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Progression") FWFLevelUp OnLevelUp;
	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Progression") FWFLootGained OnLootGained;
	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Progression") FWFProgressionChanged OnProgressionChanged;
	/** A scenario kill was claimed: Paid says whether the run paid its signature loot (participation, first claim). */
	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Rewards") FWFScenarioClaimed OnScenarioClaimed;
	/** A mission paid out: its id, the reward factor and whether it was the first clear. */
	UPROPERTY(BlueprintAssignable, Category = "World Fracture|Rewards") FWFMissionPaid OnMissionPaid;

	const wf::FProgression& Get() const { return State; }
	/** Vehicle ownership, garage loadout, selection and wear (saved with the progression). */
	const wf::FGarage& GetGarage() const { return Garage; }
	wf::FGarage& MutableGarage() { return Garage; }
	/** Pays Nex to repair a vehicle (vehicle-condition.ts repairVehicle). Returns the message to show. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Vehicles") FString RepairVehicle(const FString& VehicleId);
	/** Grants a vehicle (progression.ts rewardVehicle): owned, in the 3-slot garage loadout, selected. */
	UFUNCTION(BlueprintCallable, Category = "World Fracture|Vehicles") void RewardVehicle(const FString& VehicleId);
	/** For other core systems (quests, missions) that change the save; call NotifyChanged after. */
	wf::FProgression& Mutable() { return State; }
	void NotifyChanged() { OnProgressionChanged.Broadcast(); }
	const wf::reward::FCatalog& GetRewardCatalog() const { return Catalog; }
	/** what the worn armor does (armor-attributes.ts loadoutEffects: set bonuses, perks, attributes, flexibility) */
	wf::armor::FEffects GetArmorEffects() const { return wf::armor::LoadoutEffects(ArmorCatalog, State.Inventory, State.EquippedGear); }
	/** the equipped item's gear power for a weapon (inventory.ts weaponDamageMultiplier; vehicle guns use the vehicle slot) */
	double GetGearPower(const FString& WeaponId, const FString& Kind, bool bInVehicle) const { return wf::armor::GearPower(State.Inventory, State.EquippedGear, TCHAR_TO_UTF8(*WeaponId), TCHAR_TO_UTF8(*Kind), bInVehicle); }

	static const FString SlotName;

private:
	/** the stim and Ruin Stone buffs running (client-input.ts activeBuffs: this session only, never saved) */
	wf::stash::FBuffs Buffs;

	bool LoadRewardCatalog(FString& OutError);

	wf::FProgression State;
	wf::FGarage Garage;
	wf::reward::FCatalog Catalog;
	wf::missionreward::FCatalog MissionCatalog;
	wf::armor::FCatalog ArmorCatalog;
	void AfterMissionPayout(size_t InventoryBefore);
	wf::reward::FSimTally Tally;
	int32 PlayerDeaths = 0;
	int32 NextRunSerial = 0;
	TMap<FString, FString> ScenarioRegions; // scenario id -> region id, table order kept in ScenarioOrder
	TArray<FString> ScenarioOrder;
};
