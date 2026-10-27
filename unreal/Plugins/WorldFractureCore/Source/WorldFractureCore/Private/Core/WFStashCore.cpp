#include "Core/WFStashCore.h"

#include "Core/WFArmorCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>

namespace wf::stash
{
	namespace
	{
		const std::vector<std::pair<std::string, double>> StashRuinRecipe{{"dataChip", 5}, {"energyToken", 5}, {"relicFragment", 3}};
		double StashHave(const FProgression& P, const std::string& Id) { const auto It = P.Materials.find(Id); return It == P.Materials.end() ? 0 : It->second; }
		bool StashCan(const FProgression& P, const std::vector<std::pair<std::string, double>>& Cost)
		{
			for (const auto& [K, N] : Cost) if (!(StashHave(P, K) >= N)) return false;
			return true;
		}
		void StashPay(FProgression& P, const std::vector<std::pair<std::string, double>>& Cost)
		{
			for (const auto& [K, N] : Cost) P.Materials[K] = StashHave(P, K) - N;
		}
		bool StashEquipped(const FProgression& P, const std::string& Id)
		{
			for (const auto& [Slot, Worn] : P.EquippedGear) if (Worn == Id) return true;
			return false;
		}
		bool StashLocked(const FProgression& P, const FGearItem& Item) { return Item.bFavorite || Item.Source == "Starting loadout" || StashEquipped(P, Item.Id); }
		const FGearItem* StashFind(const FProgression& P, const std::string& Id)
		{
			for (const FGearItem& G : P.Inventory) if (G.Id == Id) return &G;
			return nullptr;
		}
		void StashRemove(FProgression& P, const std::string& Id)
		{
			P.Inventory.erase(std::remove_if(P.Inventory.begin(), P.Inventory.end(), [&](const FGearItem& G) { return G.Id == Id; }), P.Inventory.end());
			P.VaultIds.erase(std::remove(P.VaultIds.begin(), P.VaultIds.end(), Id), P.VaultIds.end());
			P.EarnedRewards.push_back("gone:" + Id);
		}
		double StashLive(const FBuffs& Buffs, const std::string& Id, double NowMs)
		{
			const auto It = Buffs.find(Id);
			return It != Buffs.end() && It->second.Until > NowMs ? std::min(StackCap, It->second.Stacks) : 0;
		}
	}

	const std::vector<FConsumable>& Consumables()
	{
		static const std::vector<FConsumable> All{
			{"armorStim", "Armor Stim", 60, "+10% damage resistance per stack for 60 s", {{"gearParts", 4}, {"energyToken", 2}}},
			{"healStim", "Heal Stim", 30, "+5 health per second per stack for 30 s", {{"dataChip", 2}, {"energyToken", 2}}},
			{"ruinStone", "Ruin Surge", 45, "+15% combat damage per stack for 45 s", StashRuinRecipe},
		};
		return All;
	}
	const FConsumable* ConsumableById(const std::string& Id)
	{
		for (const FConsumable& C : Consumables()) if (C.Id == Id) return &C;
		return nullptr;
	}

	void Grant(FProgression& P, const std::string& Id, double N)
	{
		const double Now = StashHave(P, Id) + N;
		P.Materials[Id] = IsStim(Id) ? std::min(StackCap, Now) : Now;
	}
	bool CraftRuinStone(FProgression& P)
	{
		if (!StashCan(P, StashRuinRecipe)) return false;
		StashPay(P, StashRuinRecipe);
		Grant(P, "ruinStone", 1);
		return true;
	}
	bool CraftStim(FProgression& P, const std::string& StimId)
	{
		const FConsumable* C = IsStim(StimId) ? ConsumableById(StimId) : nullptr;
		if (!C || StashHave(P, StimId) >= StackCap || !StashCan(P, C->Recipe)) return false;
		StashPay(P, C->Recipe);
		Grant(P, StimId, 1);
		return true;
	}

	bool UseStim(FProgression& P, FBuffs& Buffs, const std::string& Id, double NowMs)
	{
		const FConsumable* C = ConsumableById(Id);
		if (!C || StashHave(P, Id) < 1) return false;
		const auto It = Buffs.find(Id);
		const bool bLive = It != Buffs.end() && It->second.Until > NowMs;
		if (bLive && It->second.Stacks >= StackCap) return false;
		const double Stacks = bLive ? std::min(StackCap, It->second.Stacks + 1) : 1;
		P.Materials[Id] = StashHave(P, Id) - 1;
		Buffs[Id] = {Stacks, NowMs + C->Seconds * 1000};
		return true;
	}
	std::vector<std::string> VisibleConsumables(const std::map<std::string, double>& Materials, const FBuffs& Buffs, double NowMs)
	{
		std::vector<std::string> Out{"healStim", "armorStim"};
		const auto M = Materials.find("ruinStone");
		const auto B = Buffs.find("ruinStone");
		if ((M != Materials.end() && M->second >= 1) || (B != Buffs.end() && B->second.Until > NowMs)) Out.push_back("ruinStone");
		return Out;
	}
	FBuffEffect BuffEffect(const FBuffs& Buffs, double NowMs)
	{
		return {0.1 * StashLive(Buffs, "armorStim", NowMs), 5 * StashLive(Buffs, "healStim", NowMs), 1 + RuinSurgePerStack * StashLive(Buffs, "ruinStone", NowMs)};
	}

	bool IsDuplicate(const FProgression& P, const FGearItem& Item)
	{
		for (const FGearItem& G : P.Inventory) if (G.Id != Item.Id && G.Name == Item.Name && G.Slot == Item.Slot) return true;
		return false;
	}
	bool InVault(const FProgression& P, const std::string& Id) { return std::find(P.VaultIds.begin(), P.VaultIds.end(), Id) != P.VaultIds.end(); }
	bool CanSellDuplicate(const FProgression& P, const FGearItem& Item) { return !StashLocked(P, Item) && !InVault(P, Item.Id) && IsDuplicate(P, Item); }
	double SellValue(const FGearItem& Item) { return 10 + js::Round(Item.Power / 10) + Item.Level * 2; }
	double DismantleParts(const FGearItem& Item) { return 2 + Item.Level + (Item.Rarity && !Item.Rarity->empty() ? 4 : 0); }

	bool SellDuplicate(FProgression& P, const std::string& Id)
	{
		const FGearItem* Found = StashFind(P, Id);
		if (!Found || !CanSellDuplicate(P, *Found)) return false;
		const double Value = SellValue(*Found);
		StashRemove(P, Id);
		P.FractureShards += Value;
		return true;
	}
	bool Dismantle(FProgression& P, const std::string& Id)
	{
		const FGearItem* Found = StashFind(P, Id);
		if (!Found || StashLocked(P, *Found)) return false;
		const double Parts = DismantleParts(*Found);
		StashRemove(P, Id);
		Grant(P, "gearParts", Parts);
		return true;
	}
	bool UpgradeWithParts(FProgression& P, const std::string& Id)
	{
		const FGearItem* Found = StashFind(P, Id);
		if (!Found || (Found->SetId && !Found->SetId->empty() && Found->Level >= armor::ArmorLevelMax)) return false;
		const double Cost = PartsCost(*Found);
		if (StashHave(P, "gearParts") < Cost) return false;
		P.Materials["gearParts"] = StashHave(P, "gearParts") - Cost;
		for (FGearItem& G : P.Inventory) if (G.Id == Id) { G.Level += 1; G.Power += 15; }
		return true;
	}
	bool ToVault(FProgression& P, const std::string& Id)
	{
		if (!StashFind(P, Id) || InVault(P, Id) || StashEquipped(P, Id) || static_cast<double>(P.VaultIds.size()) >= VaultCap) return false;
		P.VaultIds.push_back(Id);
		return true;
	}
	void FromVault(FProgression& P, const std::string& Id) { P.VaultIds.erase(std::remove(P.VaultIds.begin(), P.VaultIds.end(), Id), P.VaultIds.end()); }
}
