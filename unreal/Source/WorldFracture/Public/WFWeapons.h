#pragma once

#include "CoreMinimal.h"

/** One gun's feel, straight from DataTables/Weapons.json (the web build's weapons.ts WEAPONS). */
struct FWFWeaponStats
{
	FString Id;
	FString Name;
	FString Kind;          // gun | sword | launcher
	double Damage = 1;     // multiplier on base bullet damage
	double FireRate = 0.2; // seconds between trigger pulls
	int32 Burst = 1;       // shots per pull
	double BurstGap = 0;   // seconds between burst shots
	double Spread = 0.03;  // radians, hip fire
	double AdsSpread = 0.4;
	double Recoil = 0.01;  // radians of pitch kick per shot
	int32 Mag = 30;
	int32 Reserve = 120;
	double Reload = 1.6;   // seconds
	int32 Pellets = 1;
	FString Element = TEXT("KINETIC"); // damage element (boss gimmicks read it); weapons without one are kinetic
};

namespace WFWeapons
{
	/** Base damage of one round before the weapon's multiplier (sim.mods.bulletDamage's resting value in Scene.tsx). */
	inline constexpr double BaseBulletDamage = 1.2;
	/** Weapons the first-person loop can fire today: guns (hitscan). Swords and launchers are listed but not wired yet. */
	TArray<FWFWeaponStats> LoadGuns(FString& OutError);
}
