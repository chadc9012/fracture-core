// World Fracture — kill rewards, drop claiming and XP.
//
// Port of the web build's authoritative reward path:
//   sim.ts defeatMachine          -> DefeatMachine   (credits, material drop, set/weapon drop rolls, XP event)
//   armor-sets.ts rollSetDrop / grantSetPiece / makeSetPiece
//   weapon-loot.ts rollWeaponLoot
//   inventory.ts claimDrops / collectDrop, balance.ts playerPowerScore / rewardPacing
//   xp.ts grantXP
// Golden-tested against those functions (Tests/RewardCoreTest.cpp), with both engines fed the same random numbers.
//
// Not ported yet (DefeatMachine reports them instead of guessing): Unique Scenario claims (scenario-loot.ts, the
// encounter journal and Vyrak's covenant in claimDrops), encounter finale hp floors, Black Armory nanite bursts and
// the Reap rune heal. Gore and alert text are presentation and stay out of the rules.
#pragma once

#include "Core/WFProgression.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace wf::reward
{
	/** A weapon a kill can drop (an entry of the web build's ENEMY_POOL / BOSS_POOL, slot and element already mapped). */
	struct FWeaponTemplate
	{
		std::string Id;
		std::string Name;
		std::string Slot;
		std::string Element;
	};

	struct FArmorSet
	{
		std::string Id;
		std::string Name;
		std::string RegionId;
		std::string Element;
		std::map<std::string, std::string> Pieces; // slot -> piece name
	};

	/** The data the rules read. Order matters: weapon picks index into the pools. */
	struct FCatalog
	{
		std::vector<FWeaponTemplate> EnemyPool;
		std::vector<FWeaponTemplate> BossPool;
		std::vector<FArmorSet> Sets;
	};

	// Tuning (armor-sets.ts, weapon-loot.ts, sim.ts, xp.ts).
	inline constexpr double ArmorLevelMax = 10;
	inline constexpr double SetPowerPerLevel = 15;
	inline constexpr double XpPerLevel = 400;
	extern const char* const SetSlots[5]; // helmet, gauntlets, chest, legs, classItem

	enum class ETier { Normal, Elite, Boss };
	enum class ECredit { Player, World };

	struct FSetDrop
	{
		std::string SetId;
		std::string Slot;
	};

	/** One entry of sim.drops. */
	struct FDrop
	{
		double Id = 0;
		std::string Material;
		double Amount = 0;
		std::string Enemy;
		std::optional<FGearItem> WeaponDrop;
		std::optional<FSetDrop> SetDrop;
	};

	struct FXpEvent
	{
		std::string Type; // KILL | ELITE_KILL | BOSS_KILL | MISSION | OBJECTIVE | DISCOVERY
		double EnemyLevel = 1;
		double CombatHeat = 0;
	};

	/** The reward-relevant state of one enemy (sim.ts Machine). */
	struct FMachine
	{
		bool bAlive = true;
		double Hp = 0;
		bool bBoss = false;
		bool bElite = false;
		bool bDecoy = false;            // a False Saint: shatters, pays nothing
		bool bMission = false;
		bool bEmergencyQuest = false;   // Machine.eq: +400 credits when it falls
		std::string Zone;               // region id
		std::string DropMaterial;       // Machine.drop
		std::string Profile;            // display name, recorded on the drop
		std::optional<std::string> Rival;    // Killbox rival class
		std::optional<std::string> Living;   // Living World event tag
		std::optional<std::string> Nemesis;  // nemesis id
		std::optional<std::string> ScenarioId;
	};

	/** Random numbers in the order defeatMachine draws them; the suffix only makes weapon-drop ids unique. */
	class IRandom
	{
	public:
		virtual ~IRandom() = default;
		virtual double Uniform() = 0;               // [0, 1)
		virtual std::string UniqueSuffix() = 0;     // short id text
	};

	/** The sim counters a defeat changes (sim.ts WorldSim). */
	struct FSimTally
	{
		double Kills = 0;
		double BossKills = 0;
		double EliteKills = 0;
		double RivalKills = 0;
		double Credits = 0;
		double NextDropId = 0;
		std::map<std::string, double> Materials;
		std::map<std::string, double> LivingKills;
		std::vector<std::pair<std::string, bool>> NemesisEvents; // id, killed by the player
		std::vector<FDrop> Drops;
		std::vector<FXpEvent> XpEvents;
		double CombatHeat = 0;
	};

	enum class EDefeatResult
	{
		Ignored,         // still alive or already dead
		Shattered,       // decoy: no kill
		RivalScored,     // Killbox rival: counts for the match only
		Unpaid,          // killed by the world (safe-zone field, turrets): no reward
		Paid,
		NotPorted,       // a Unique Scenario boss: its claim path is not ported yet; nothing was changed
	};

	/** sim.ts defeatMachine's reward half. Marks the machine dead and pays into the tally exactly as the web build does. */
	EDefeatResult DefeatMachine(const FCatalog& Catalog, FMachine& M, ECredit Credit, FSimTally& Sim, IRandom& Random);

	std::optional<FSetDrop> RollSetDrop(const FCatalog& Catalog, const std::string& RegionId, ETier Tier, double Roll);
	std::optional<FGearItem> RollWeaponLoot(const FCatalog& Catalog, ETier Tier, const std::string& Zone, double Roll, const std::string& UniqueSuffix);
	std::optional<FGearItem> MakeSetPiece(const FCatalog& Catalog, const std::string& SetId, const std::string& Slot, double Level = 1);
	/** A new piece joins the inventory; a duplicate levels the owned piece up to the cap. */
	FProgression GrantSetPiece(const FCatalog& Catalog, FProgression P, const FSetDrop& Drop);

	double PlayerPowerScore(const FProgression& P);
	double RewardPacing(double Power);

	/** inventory.ts claimDrops. Drops carrying a scenario claim are not accepted here (see header note). */
	FProgression ClaimDrops(const FCatalog& Catalog, FProgression P, const std::vector<FDrop>& Drops);

	struct FGrantXpResult
	{
		FProgression Progression;
		double Gained = 0;
		bool bLeveledUp = false;
		double NewLevel = 1;
		std::vector<std::string> NovaUnlocked;
	};
	double BaseXpFor(const std::string& Type, double EnemyLevel);
	/** xp.ts grantXP. Scale is the difficulty challenge's reward factor (map-activities.ts CHALLENGES). */
	FGrantXpResult GrantXP(FProgression P, const std::string& Type, std::optional<double> EnemyLevel, std::optional<double> CombatHeat, std::optional<std::string> RareEvent, double Scale);

	/** Stable text for tests and logs. */
	std::string DescribeGear(const FGearItem& G);
	std::string DescribeLoot(const FProgression& P);
	std::string DescribeTally(const FSimTally& S);
}
