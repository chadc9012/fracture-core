#pragma once

#include "CoreMinimal.h"
#include "Core/WFEncounterCore.h"
#include "GameFramework/Character.h"
#include "WFEnemy.generated.h"

class UStaticMeshComponent;
class AWFCharacter;

/**
 * A regional trooper. Numbers come from the web build: health from sim.ts spawnMachine ((3 or 7 elite) + region
 * difficulty x0.8, x challenge), aggro radius, speed, wind-up and cooldowns from enemy-tuning.ts, damage from
 * sim.ts (ranged 2/4/6, melee 7/12/17 by tier). Its death pays through UWFProgressionSubsystem::ReportEnemyDefeated.
 *
 * Bosses take damage through the ported boss rules (poise, weak point, stagger, Unique Scenario gimmicks and
 * outside-window immunity, the finale hp floor) and escalate through the three regional phases. A boss with an
 * authored encounter does not shoot or melee on its own: AWFGameMode runs its encounter (tells, attacks, zones).
 *
 * Simplified for now: no perception states, cover, line-of-sight cache or hit-chance model (enemy-perception.ts,
 * enemy-cover.ts, line-of-sight.ts) — a ranged shot hits if the line to the player is clear, with a fixed 40% chance.
 */
UCLASS()
class WORLDFRACTURE_API AWFEnemy : public ACharacter
{
	GENERATED_BODY()

public:
	AWFEnemy();

	/** Called by the spawner before the enemy enters play. */
	void Configure(const FString& InProfile, const FString& InZone, const FString& InDropMaterial, bool bInElite, bool bInBoss, double InMaxHealth);
	/** Makes this a Unique Scenario boss: mints its run id and starts the fight clock and death count (sim.ts summonScenario). */
	void ConfigureScenario(const FString& InScenarioId);
	const FString& GetScenarioId() const { return ScenarioId; }

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	/** Element is the hit's damage element (KINETIC, THERMAL, CRYO, ARC, BIO): scenario gimmicks read it. */
	/** Returns the damage the hit really dealt (after vulnerability and the boss rules). */
	double ReceiveHit(double Damage, AActor* Instigator, const FString& Element = TEXT("KINETIC"));
	// Dragonite casts (ported dragonite-cast.ts) read and change these
	double GetAim() const { return Windup >= 0 ? 1.0 : 0.0; }
	void CancelWindup() { Windup = -1; }
	double GetStun() const { return StunLeft; }
	void SetStun(double Seconds) { StunLeft = Seconds; }
	double GetVulnUntil() const { return VulnUntil; }
	double GetVulnMult() const { return VulnMult; }
	/** Weaken / Marked / Roar: hits are multiplied by Mult until world time Until (sim.ts vulnUntil / vulnMult). */
	void SetVulnerable(double Until, double Mult) { VulnUntil = Until; VulnMult = Mult; }
	/** Knockback: moves the enemy to a ground-plane point (metres), landing on the ground. */
	void MoveToGround(double XMetres, double YMetres);
	/** A False Saint (Hollow Saint decoy): never attacks, pays nothing, and reports its shattering to the encounter. */
	void ConfigureDecoy(double InDecoyId) { bDecoy = true; DecoyId = InDecoyId; }
	bool IsDecoy() const { return bDecoy; }
	double GetDecoyId() const { return DecoyId; }
	double GetHealth() const { return Health; }
	double GetMaxHealth() const { return MaxHealth; }
	/** The boss as the encounter rules see it. SyncRules copies the actor's state in; ApplyRules writes the rules' results back. */
	wf::encounter::FBoss& Rules() { return BossRules; }
	const wf::encounter::FBoss& Rules() const { return BossRules; }
	void SyncRules();
	void ApplyRules();
	/** The boss left without dying (Vaelith's truce): no kill, no reward. */
	void Depart();
	bool IsDead() const { return Health <= 0; }
	const FString& GetProfile() const { return Profile; }
	bool IsBoss() const { return bBoss; }
	/** Telegraphing a shot (the Wyrm interrupts these first). */
	bool IsWindingUp() const { return Windup >= 0; }
	/** Cancels the wind-up and stuns (Wyrm interrupt, sim.ts stunMachine). */
	void Interrupt(double Seconds) { Windup = -1; StunLeft = FMath::Max(StunLeft, Seconds); }

	/** Fixed for the simplified ranged model (see class comment). */
	static constexpr double RangedHitChance = 0.4;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Body") TObjectPtr<UStaticMeshComponent> Body;
	UPROPERTY(VisibleAnywhere, Category = "Body") TObjectPtr<UStaticMeshComponent> Head;

private:
	void Die();
	void TryAttack(AWFCharacter* Player, double Distance, float DeltaSeconds);
	double Tier(double Regular, double Elite, double Boss) const { return bBoss ? Boss : bElite ? Elite : Regular; }

	FString Profile = TEXT("Raider");
	FString Zone = TEXT("veridan");
	FString DropMaterial = TEXT("scrapMetal");
	bool bElite = false;
	bool bBoss = false;
	double MaxHealth = 3;
	double Health = 3;
	bool bAggro = false;
	double RangedCooldown = 1.5;
	double Windup = -1;      // counting down while telegraphing a shot
	double MeleeCooldown = 0;
	double SincePlayerHit = 1000; // seconds since the player last damaged it (sim.ts kill-credit window)
	FString ScenarioId;
	double StunLeft = 0;
	double VulnUntil = 0, VulnMult = 1;
	bool bDecoy = false;
	double DecoyId = 0;
	wf::encounter::FBoss BossRules;
	double PhaseSpeedMult = 1, PhaseDamageMult = 1, PhaseCooldownMult = 1; // regional boss phase tuning
	FString ScenarioRun;
	double SummonedAt = 0;        // world seconds
	int32 DeathsAtSummon = 0;
};
