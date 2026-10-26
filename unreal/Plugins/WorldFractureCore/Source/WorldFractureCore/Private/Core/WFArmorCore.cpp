#include "Core/WFArmorCore.h"

#include <algorithm>
#include <set>

namespace wf::armor
{
	namespace
	{
		// armor-attributes.ts WEIGHTS key order: wornArmor walks the slots in this order (helmet, chest, gauntlets, legs, classItem)
		const char* const AmAttrSlots[5] = {"helmet", "chest", "gauntlets", "legs", "classItem"};
		// armor-sets.ts SET_SLOTS order: perks walk the slots in this order
		const char* const AmSetSlots[5] = {"helmet", "gauntlets", "chest", "legs", "classItem"};

		bool AmIsArmorSlot(const std::string& Slot) { for (const char* S : AmAttrSlots) if (Slot == S) return true; return false; }
		FAttributes AmWeights(const std::string& Slot)
		{
			if (Slot == "helmet") return {0.6, 0.1, 0.3};
			if (Slot == "chest") return {0.1, 0.1, 0.8};
			if (Slot == "gauntlets") return {0.2, 0.6, 0.2};
			if (Slot == "legs") return {0.1, 0.7, 0.2};
			if (Slot == "classItem") return {0.4, 0.3, 0.3};
			return {0, 0, 0};
		}
		FAttributes AmTilt(const std::string& SetId)
		{
			if (SetId == "verdant-warden") return {1.1, 1, 1.1};
			if (SetId == "mire-stalker") return {1, 1.25, 0.85};
			if (SetId == "cinder-vanguard") return {1, 0.9, 1.2};
			if (SetId == "frostwrought-aegis") return {0.9, 0.8, 1.4};
			if (SetId == "scrapborn-raider") return {1, 1.15, 1};
			if (SetId == "dune-seeker") return {1.1, 1.3, 0.75};
			if (SetId == "hollow-star") return {1.2, 1.1, 1.2};
			return {1, 1, 1};
		}
		double AmSoft(double X) { return X <= SoftCap ? X : SoftCap + (X - SoftCap) * SoftCapFalloff; }
		const FGearItem* AmFind(const FInventory& Inv, const std::string& Id)
		{
			for (const FGearItem& I : Inv) if (I.Id == Id) return &I;
			return nullptr;
		}
		const FGearItem* AmEquippedIn(const FInventory& Inv, const FEquipped& Eq, const std::string& Slot)
		{
			const auto It = Eq.find(Slot);
			return It == Eq.end() ? nullptr : AmFind(Inv, It->second);
		}
		std::vector<const FGearItem*> AmWornArmor(const FInventory& Inv, const FEquipped& Eq)
		{
			std::vector<const FGearItem*> Out;
			for (const char* Slot : AmAttrSlots)
				if (const FGearItem* I = AmEquippedIn(Inv, Eq, Slot); I && AmIsArmorSlot(I->Slot)) Out.push_back(I);
			return Out;
		}
		bool AmSetKnown(const FCatalog& C, const std::string& Id)
		{
			return std::any_of(C.Sets.begin(), C.Sets.end(), [&](const FSetDef& S) { return S.Id == Id; });
		}
	}

	void FEffects::AddScaled(const FEffects& O, double K)
	{
		Resist += O.Resist * K; WeaponDamage += O.WeaponDamage * K; MoveSpeed += O.MoveSpeed * K;
		Regen += O.Regen * K; SlideBoost += O.SlideBoost * K; AbilityRecharge += O.AbilityRecharge * K;
	}

	std::vector<FSetStatus> SetStatuses(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq)
	{
		std::set<std::string> Worn;
		for (const auto& [Slot, Id] : Eq) Worn.insert(Id);
		std::vector<FSetStatus> Out;
		for (const FSetDef& Set : C.Sets)
		{
			FSetStatus S;
			S.SetId = Set.Id;
			double Sum = 0;
			for (const FGearItem& I : Inv)
			{
				if (!I.SetId || *I.SetId != Set.Id) continue;
				++S.Owned;
				if (Worn.count(I.Id)) { ++S.Equipped; Sum += I.Level; }
			}
			S.AverageLevel = S.Equipped ? Sum / S.Equipped : 1;
			Out.push_back(S);
		}
		return Out;
	}

	FEffects ArmorEffects(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq)
	{
		FEffects Total;
		const std::vector<FSetStatus> Statuses = SetStatuses(C, Inv, Eq);
		for (size_t I = 0; I < Statuses.size(); ++I)
		{
			const FSetStatus& S = Statuses[I];
			if (S.Equipped < 2) continue;
			const double Scale = 1 + BonusPerLevel * (std::min(ArmorLevelMax, S.AverageLevel) - 1);
			Total.AddScaled(C.Sets[I].Two, Scale);
			if (S.Equipped >= 4) Total.AddScaled(C.Sets[I].Four, Scale);
		}
		Total.Resist = std::min(MaxResist, Total.Resist);
		return Total;
	}

	FEffects PerkEffects(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq)
	{
		FEffects Total;
		for (const char* Slot : AmSetSlots)
		{
			const FGearItem* I = AmEquippedIn(Inv, Eq, Slot);
			if (!I || !I->SetId || !AmSetKnown(C, *I->SetId)) continue;
			const auto Set = C.Perks.find(*I->SetId);
			if (Set == C.Perks.end()) continue;
			const auto Perk = Set->second.find(I->Slot);
			if (Perk == Set->second.end()) continue;
			Total.AddScaled(Perk->second, 1 + BonusPerLevel * (std::min(ArmorLevelMax, std::max(1.0, I->Level)) - 1));
		}
		return Total;
	}

	FAttributes PieceAttributes(const FGearItem& Item)
	{
		if (!AmIsArmorSlot(Item.Slot)) return {};
		const FAttributes W = AmWeights(Item.Slot);
		const FAttributes T = Item.SetId ? AmTilt(*Item.SetId) : FAttributes{1, 1, 1};
		const double Base = Item.Power / 10;
		return {Base * W.Intellect * T.Intellect, Base * W.Mobility * T.Mobility, Base * W.Defense * T.Defense};
	}

	FLoadoutAttributes LoadoutAttributes(const FInventory& Inv, const FEquipped& Eq)
	{
		FLoadoutAttributes Out;
		const std::vector<const FGearItem*> Worn = AmWornArmor(Inv, Eq);
		for (const FGearItem* I : Worn)
		{
			const FAttributes A = PieceAttributes(*I);
			Out.Raw.Intellect += A.Intellect; Out.Raw.Mobility += A.Mobility; Out.Raw.Defense += A.Defense;
		}
		// trade-offs act on the raw totals, then the soft cap flattens whatever is left
		const double Mobility = Out.Raw.Mobility - std::max(0.0, Out.Raw.Defense - TradeoffFloor) * 0.3;
		const double Defense = Out.Raw.Defense - std::max(0.0, Out.Raw.Intellect - TradeoffFloor) * 0.25;
		Out.Effective = {AmSoft(Out.Raw.Intellect), AmSoft(std::max(0.0, Mobility)), AmSoft(std::max(0.0, Defense))};
		Out.Worn = static_cast<int>(Worn.size());
		return Out;
	}

	bool HasFlexibility(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq)
	{
		const std::vector<const FGearItem*> Worn = AmWornArmor(Inv, Eq);
		if (Worn.size() < 4) return false;
		for (const FSetStatus& S : SetStatuses(C, Inv, Eq)) if (S.Equipped >= 2) return false;
		std::set<std::string> Sources;
		for (const FGearItem* I : Worn) Sources.insert(I->SetId ? *I->SetId : I->Source);
		return Sources.size() >= 3;
	}

	FEffects AttributeEffects(const FAttributes& A)
	{
		FEffects E;
		E.AbilityRecharge = (A.Intellect / 100) * 0.6;
		E.MoveSpeed = (A.Mobility / 100) * 0.3;
		E.SlideBoost = (A.Mobility / 100) * 0.4;
		E.Resist = (A.Defense / 100) * 0.5;
		return E;
	}

	FEffects LoadoutEffects(const FCatalog& C, const FInventory& Inv, const FEquipped& Eq)
	{
		FEffects Total = ArmorEffects(C, Inv, Eq);
		Total.AddScaled(AttributeEffects(LoadoutAttributes(Inv, Eq).Effective), 1);
		Total.AddScaled(PerkEffects(C, Inv, Eq), 1);
		if (HasFlexibility(C, Inv, Eq)) { Total.Resist += 0.03; Total.MoveSpeed += 0.03; Total.AbilityRecharge += 0.05; }
		Total.Resist = std::min(MaxResist, Total.Resist);
		return Total;
	}

	double WeaponDamageMultiplier(double Power) { return std::min(1.7, 1 + std::max(0.0, Power - 100) / 500); }

	std::string GearSlotForWeapon(const std::string& WeaponId, const std::string& Kind, bool bInVehicle)
	{
		if (bInVehicle) return "vehicle";
		if (WeaponId == "HEAVY" || Kind == "launcher") return "heavy";
		if (WeaponId == "PULSE") return "secondary";
		return "primary";
	}

	double GearPower(const FInventory& Inv, const FEquipped& Eq, const std::string& WeaponId, const std::string& Kind, bool bInVehicle)
	{
		const FGearItem* I = AmEquippedIn(Inv, Eq, GearSlotForWeapon(WeaponId, Kind, bInVehicle));
		return I ? WeaponDamageMultiplier(I->Power) : 1;
	}
}
