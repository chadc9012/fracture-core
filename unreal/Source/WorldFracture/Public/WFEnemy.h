#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "WFEnemy.generated.h"

class UStaticMeshComponent;
class AWFCharacter;

/**
 * A regional trooper. Numbers come from the web build: health from sim.ts spawnMachine ((3 or 7 elite) + region
 * difficulty x0.8, x challenge), aggro radius, speed, wind-up and cooldowns from enemy-tuning.ts, damage from
 * sim.ts (ranged 2/4/6, melee 7/12/17 by tier). Its death pays through UWFProgressionSubsystem::ReportEnemyDefeated.
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

	void ReceiveHit(double Damage, AActor* Instigator);
	bool IsDead() const { return Health <= 0; }
	const FString& GetProfile() const { return Profile; }

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
	FString ScenarioRun;
	int32 PlayerHits = 0;
	double SummonedAt = 0;        // world seconds
	int32 DeathsAtSummon = 0;
};
