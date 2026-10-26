#pragma once

#include "CoreMinimal.h"
#include "Core/WFEncounterCore.h"
#include "Core/WFPerceptionCore.h"
#include "GameFramework/Character.h"
#include "WFEnemy.generated.h"

class UStaticMeshComponent;
class AWFCharacter;
class AWFVehicle;

/**
 * A regional trooper. Numbers come from the web build: health from sim.ts spawnMachine ((3 or 7 elite) + region
 * difficulty x0.8, x challenge), aggro radius, speed, wind-up and cooldowns from enemy-tuning.ts, damage from
 * sim.ts (ranged 2/4/6, melee 7/12/17 by tier). Its death pays through UWFProgressionSubsystem::ReportEnemyDefeated.
 *
 * Bosses take damage through the ported boss rules (poise, weak point, stagger, Unique Scenario gimmicks and
 * outside-window immunity, the finale hp floor) and escalate through the three regional phases. A boss with an
 * authored encounter does not shoot or melee on its own: AWFGameMode runs its encounter (tells, attacks, zones).
 *
 * Perception is the ported enemy-perception.ts state machine (patrol, suspicious, alert, search) fed by sight, hearing
 * (gunfire, combat heat) and damage, with sim.ts's line-of-sight refresh; a wounded trooper breaks off to a retreat point
 * (pickCover). Ranged shots land with line-of-sight.ts enemyHitChance and also reach an Operator who is driving:
 * the hit wears the vehicle, and its flares spoof the shot. Not ported: real cover behind obstacles, flanking, grenades,
 * dives out of rounds and squad roles (enemy-cover.ts, enemy-tactics.ts, enemy-evasion.ts, enemy-intelligence.ts).
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
	double TakeHit(double Damage, AActor* DamageInstigator, const FString& Element = TEXT("KINETIC"));
	// Dragonite casts (ported dragonite-cast.ts) read and change these
	double GetAim() const { return Windup >= 0 ? 1.0 : 0.0; }
	void CancelWindup() { Windup = -1; }
	double GetStun() const { return StunLeft; }
	void SetStun(double Seconds) { StunLeft = Seconds; }
	double GetVulnUntil() const { return VulnUntil; }
	double GetVulnMult() const { return VulnMult; }
	/** Weaken / Marked / Roar: hits are multiplied by Mult until world time Until (sim.ts vulnUntil / vulnMult). */
	void SetVulnerable(double Until, double Mult) { VulnUntil = Until; VulnMult = Mult; }
	/** Caltrops / EMP mines: movement is multiplied by Mult until world time Until (sim.ts snareUntil / snareMult). */
	void SetSnare(double Until, double Mult) { SnareUntil = Until; SnareMult = Mult; }
	double GetSnareUntil() const { return SnareUntil; }
	/** Knockback: moves the enemy to a ground-plane point (metres), landing on the ground. */
	void MoveToGround(double XMetres, double YMetres);
	/** A False Saint (Hollow Saint decoy): never attacks, pays nothing, and reports its shattering to the encounter. */
	void ConfigureDecoy(double InDecoyId) { bDecoy = true; DecoyId = InDecoyId; }
	/** a trooper an encounter boss called in (encounter-sim.ts SUMMON) */
	void ConfigureSummon(double InSummonId) { SummonId = InSummonId; }
	double GetSummonId() const { return SummonId; }
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
	bool IsElite() const { return bElite; }
	/** Telegraphing a shot (the Wyrm interrupts these first). */
	bool IsWindingUp() const { return Windup >= 0; }
	/** Cancels the wind-up and stuns (Wyrm interrupt, sim.ts stunMachine). */
	void Interrupt(double Seconds) { Windup = -1; StunLeft = FMath::Max(StunLeft, Seconds); }
	/** knockback velocity in m/s on the ground plane (sim.ts kx / kz): bosses move a fourteenth of it, it decays e^-3t */
	void AddKnock(double Kx, double Kz) { KnockX += Kx; KnockZ += Kz; }
	/** sim.ts enemy.cool = max(cool, s): a sword hit staggers its next attack */
	void Stagger(double Seconds) { RangedCooldown = FMath::Max(RangedCooldown, Seconds); MeleeCooldown = FMath::Max(MeleeCooldown, Seconds); Windup = -1; }

	/** The awareness state this frame: PATROL | SUSPICIOUS | ALERT | SEARCH (HUD threat markers, tests). */
	const std::string& GetAiState() const { return Ai.State; }

protected:
	UPROPERTY(VisibleAnywhere, Category = "Body") TObjectPtr<UStaticMeshComponent> Body;
	UPROPERTY(VisibleAnywhere, Category = "Body") TObjectPtr<UStaticMeshComponent> Head;

private:
	void Die();
	void TryAttack(AWFCharacter* Operator, AWFVehicle* Car, double Distance, float DeltaSeconds);
	/** sim.ts: one machine's awareness, movement and fire for the frame */
	void TickPerception(AWFCharacter* Operator, APawn* Target, float DeltaSeconds);
	double Tier(double Regular, double Elite, double Boss) const { return bBoss ? Boss : bElite ? Elite : Regular; }

	FString Profile = TEXT("Raider");
	FString Zone = TEXT("veridan");
	FString DropMaterial = TEXT("scrapMetal");
	bool bElite = false;
	bool bBoss = false;
	double MaxHealth = 3;
	double Health = 3;
	wf::perception::FAi Ai;
	bool bAiReady = false;
	bool bLosClear = true;
	double LosAt = -1;
	double RangedCooldown = 1.5;
	double Windup = -1;      // counting down while telegraphing a shot
	double MeleeCooldown = 0;
	double SincePlayerHit = 1000; // seconds since the player last damaged it (sim.ts kill-credit window)
	FString ScenarioId;
	double StunLeft = 0;
	double VulnUntil = 0, VulnMult = 1;
	double SnareUntil = 0, SnareMult = 1;
	bool bDecoy = false;
	double DecoyId = 0;
	double SummonId = 0; // 0 = not called in
	double KnockX = 0, KnockZ = 0;
	wf::encounter::FBoss BossRules;
	double PhaseSpeedMult = 1, PhaseDamageMult = 1, PhaseCooldownMult = 1; // regional boss phase tuning
	FString ScenarioRun;
	double SummonedAt = 0;        // world seconds
	int32 DeathsAtSummon = 0;
};
