// World Fracture — what the armor you wear does in a fight: set bonuses (2 and 4 pieces, scaled by the worn pieces'
// level), every piece's own perk, the INTELLECT / MOBILITY / DEFENSE attributes with their soft caps and trade-offs, the
// mixed-gear flexibility bonus, and the equipped weapon's gear power.
//
// Port of the web build's authoritative rules:
//   armor-sets.ts       setStatuses, armorEffects (MAX_RESIST 0.5, BONUS_PER_LEVEL 0.08)
//   armor-perks.ts      perkEffects (ArmorPerks table)
//   armor-attributes.ts pieceAttributes, loadoutAttributes, hasFlexibility, attributeEffects, loadoutEffects
//   inventory.ts        weaponDamageMultiplier (cap 1.7)
//   Scene.tsx           which equipped slot powers which weapon; how the effects are applied (resist in hurtPlayer,
//                       regen, weapon damage, move speed, slide, ability recharge)
// Golden-tested (Tests/ArmorCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <map>
#include <string>
#include <vector>

namespace wf::armor
{
	/** fractions (0.08 = +8%) except Regen, hull points per second */
	struct FEffects
	{
		double Resist = 0, WeaponDamage = 0, MoveSpeed = 0, Regen = 0, SlideBoost = 0, AbilityRecharge = 0;
		void AddScaled(const FEffects& O, double K);
	};
	inline constexpr double MaxResist = 0.5, BonusPerLevel = 0.08, ArmorLevelMax = 10;

	struct FSetDef { std::string Id; FEffects Two, Four; };
	struct FCatalog
	{
		std::vector<FSetDef> Sets;                                  // ARMOR_SETS order (regional sets, then collections)
		std::map<std::string, std::map<std::string, FEffects>> Perks; // set id -> slot -> perk
	};

	using FInventory = std::vector<FGearItem>;
	using FEquipped = std::map<std::string, std::string>; // slot -> item id

	struct FSetStatus { std::string SetId; int Equipped = 0, Owned = 0; double AverageLevel = 1; };
	WORLDFRACTURECORE_API std::vector<FSetStatus> SetStatuses(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq);
	WORLDFRACTURECORE_API FEffects ArmorEffects(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq);
	WORLDFRACTURECORE_API FEffects PerkEffects(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq);

	struct FAttributes { double Intellect = 0, Mobility = 0, Defense = 0; };
	inline constexpr double SoftCap = 40, SoftCapFalloff = 0.5, TradeoffFloor = 35;
	WORLDFRACTURECORE_API FAttributes PieceAttributes(const FGearItem& Item);
	struct FLoadoutAttributes { FAttributes Raw, Effective; int Worn = 0; };
	WORLDFRACTURECORE_API FLoadoutAttributes LoadoutAttributes(const FInventory& Inv, const FEquipped& Eq);
	WORLDFRACTURECORE_API bool HasFlexibility(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq);
	WORLDFRACTURECORE_API FEffects AttributeEffects(const FAttributes& A);
	/** set bonuses + attributes + perks + flexibility, resistance capped at 50% */
	WORLDFRACTURECORE_API FEffects LoadoutEffects(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq);

	/** inventory.ts weaponDamageMultiplier: 1 + (power - 100) / 500, capped at 1.7 */
	WORLDFRACTURECORE_API double WeaponDamageMultiplier(double Power);
	/** Scene.tsx: the gear slot that powers a weapon (vehicle guns use the vehicle slot) */
	WORLDFRACTURECORE_API std::string GearSlotForWeapon(const std::string& WeaponId, const std::string& Kind, bool bInVehicle);
	/** the equipped item's gear power for that weapon, 1 when nothing is equipped there */
	WORLDFRACTURECORE_API double GearPower(const FInventory& Inv, const FEquipped& Eq, const std::string& WeaponId, const std::string& Kind, bool bInVehicle);
}
