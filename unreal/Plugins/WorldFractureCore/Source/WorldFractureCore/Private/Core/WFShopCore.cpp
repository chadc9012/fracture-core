#include "Core/WFShopCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace wf::shop
{
	namespace
	{
		uint32_t ShToU32(double V) { double M = std::fmod(std::floor(V), 4294967296.0); if (M < 0) M += 4294967296.0; return static_cast<uint32_t>(M); }
		struct FShMulberry
		{
			uint32_t A;
			double operator()()
			{
				A = A + 0x6d2b79f5u;
				uint32_t T = (A ^ (A >> 15)) * (1u | A);
				T = (T + ((T ^ (T >> 7)) * (61u | T))) ^ T;
				return static_cast<double>(T ^ (T >> 14)) / 4294967296.0;
			}
		};
		uint32_t ShDaySeed(const std::string& Id, double Day)
		{
			double H = Day * 2654435761.0;
			for (unsigned char C : Id) H = static_cast<double>(ShToU32(H * 31 + C));
			return ShToU32(H);
		}
		std::string N(double V) { return js::NumberToString(V); }
		const std::string Dot = " · ";

		double ShWeaponLevel(const std::string& T) { return T == "T1" ? 1 : T == "T2" ? 3 : T == "T3" ? 6 : T == "T4" ? 9 : T == "T5" ? 12 : 99; }
		double ShArmorLevel(const std::string& T) { return T == "T1-2" ? 1 : T == "T3-4" ? 5 : T == "T5" ? 10 : 99; }
		double ShWeaponPrice(const std::string& T) { return T == "T1" ? 30 : T == "T2" ? 80 : T == "T3" ? 180 : T == "T4" ? 360 : T == "T5" ? 700 : 0; } // regional-shops.ts WEAPON_PRICE
		double ShArmorPrice(const std::string& T) { return T == "T1-2" ? 25 : T == "T3-4" ? 110 : T == "T5" ? 400 : 0; } // regional-shops.ts ARMOR_PRICE
		double ShWeaponPower(const std::string& T) { return T == "T1" ? 90 : T == "T2" ? 140 : T == "T3" ? 190 : T == "T4" ? 260 : T == "T5" ? 340 : 420; }
		double ShArmorPower(const std::string& T) { return T == "T1-2" ? 90 : T == "T3-4" ? 150 : T == "T5" ? 240 : 340; }
		double ShPiecePrice(int T) { static const double P[6] = {0, 30, 55, 95, 150, 220}; return P[std::clamp(T, 1, 5)]; }
		double ShPieceLevel(int T) { static const double L[6] = {0, 1, 3, 5, 8, 10}; return L[std::clamp(T, 1, 5)]; }
		std::string ShClassLabel(const std::string& C)
		{
			static const std::map<std::string, std::string> L = {{"melee", "Melee"}, {"pistol", "Pistols"}, {"smg", "SMGs"}, {"ar", "Assault rifles"}, {"auto", "Auto rifles"}, {"lmg", "Light machine guns"},
				{"sniper", "Sniper rifles"}, {"fusion", "Fusion rifles"}, {"shotgun", "Shotguns"}, {"crossbow", "Crossbows"}, {"launcher", "Grenade launchers"}, {"special", "Special / energy"}};
			const auto It = L.find(C);
			return It == L.end() ? C : It->second;
		}
		struct FShPack { const char* Material; double Amount, Price; const char* Name; };
		const std::vector<FShPack>& ShSupplies() { static const std::vector<FShPack> V = {{"scrapMetal", 20, 0, "Salvage bundle"}, {"reinforcedAlloy", 6, 30, "Armor patch kit"}, {"microCircuits", 4, 35, "Circuit repair kit"}, {"fuel", 10, 25, "Fuel cells"}}; return V; }
		const std::vector<FShPack>& ShVehicles() { static const std::vector<FShPack> V = {{"vehicleParts", 4, 20, "Chassis parts"}, {"scrapMetal", 30, 15, "Plating scrap"}, {"fuel", 15, 18, "Reserve tanks"}}; return V; }
		const std::vector<FShPack>& ShExotic() { static const std::vector<FShPack> V = {{"relicFragment", 2, 40, "Relic fragments"}, {"runeDust", 3, 35, "Rune dust"}, {"ruinStone", 4, 30, "Ruin stone"}, {"dragonite", 1, 70, "Dragonite shard"}, {"anomalyCarbon", 4, 30, "Anomaly carbon"}}; return V; }

		FOffer ShWeaponOffer(const FShop& Shop, const FWeapon& W, const std::string& Detail, double PriceScale)
		{
			FOffer O;
			O.Key = Shop.Id + "-" + W.Id; O.Type = "gear"; O.Name = W.Name; O.Detail = Detail;
			O.Price = js::Round(ShWeaponPrice(W.Tier) * Shop.PriceMult * PriceScale); O.MinLevel = ShWeaponLevel(W.Tier);
			O.Listing = FListing{O.Key, "weapon", W.Id, W.Name, W.Tier, W.Element, W.Archetype, "", ShWeaponPower(W.Tier)};
			return O;
		}
		FOffer ShMaterialOffer(const FShop& Shop, const FShPack& P, double Price, const std::string& Detail)
		{
			FOffer O;
			O.Key = Shop.Id + "-" + P.Material; O.Type = "material"; O.Name = P.Name; O.Detail = Detail; O.Price = Price; O.MinLevel = 1; O.Material = P.Material; O.Amount = P.Amount;
			return O;
		}
		void ShCollectionOffers(const FShop& Shop, FShMulberry& Rand, const std::vector<const FCollection*>& Pool, int Count, std::vector<FOffer>& Out)
		{
			static const char* const Slots[5] = {"helmet", "gauntlets", "chest", "legs", "classItem"};
			if (Pool.empty()) return;
			for (int I = 0; I < Count; ++I)
			{
				const FCollection& C = *Pool[static_cast<size_t>(std::floor(Rand() * static_cast<double>(Pool.size())))];
				const std::string Slot = Slots[static_cast<int>(std::floor(Rand() * 5))];
				const int Tier = C.VendorTier ? C.VendorTier : 5;
				FOffer O;
				O.Key = Shop.Id + "-" + C.Id + "-" + Slot; O.Type = "piece";
				const auto It = C.Pieces.find(Slot);
				O.Name = It != C.Pieces.end() ? It->second : C.Name + " " + Slot;
				O.Detail = C.Name + Dot + "tier " + std::to_string(Tier) + Dot + C.TwoName + " (2) / " + C.FourName + " (4)";
				O.Price = js::Round(ShPiecePrice(Tier) * Shop.PriceMult); O.MinLevel = ShPieceLevel(Tier);
				O.Drop = reward::FSetDrop{C.Id, Slot};
				Out.push_back(O);
			}
		}
		bool ShHas(const std::vector<std::string>& V, const std::string& S) { return std::find(V.begin(), V.end(), S) != V.end(); }
		std::string ShBase36(double V)
		{
			const char* Digits = "0123456789abcdefghijklmnopqrstuvwxyz";
			uint64_t X = static_cast<uint64_t>(std::max(0.0, std::floor(V)));
			if (!X) return "0";
			std::string Out;
			while (X) { Out.insert(Out.begin(), Digits[X % 36]); X /= 36; }
			return Out;
		}
		double ShNorm(double H) { return std::fmod(std::fmod(H, 24.0) + 24.0, 24.0); }
		std::string ShClock(double H) { const int V = static_cast<int>(std::floor(ShNorm(H))); return (V < 10 ? "0" : "") + std::to_string(V) + ":00"; }
	}

	const FShop* FCatalog::Find(const std::string& Id) const
	{
		for (const FShop& S : Shops) if (S.Id == Id) return &S;
		return nullptr;
	}

	double Today(double NowMs) { return std::floor(NowMs / 86400000.0); }

	std::vector<FCatalogWeapon> WeeklyCatalogStock(const FCatalog& C, const std::string& ShopId, double NowMs, int Count)
	{
		std::vector<FCatalogWeapon> Pool;
		for (const FCatalogWeapon& W : C.Named) if (W.Via == "shop") Pool.push_back(W);
		uint32_t H = 2166136261u;
		for (unsigned char Ch : ShopId) H = (H ^ Ch) * 16777619u;
		const double Week = std::floor((NowMs - 1704067200000.0) / (7 * 86400000.0));
		uint32_t St = H ^ (ShToU32(Week + 1) * 2654435761u);
		for (size_t I = Pool.size() - (Pool.empty() ? 0 : 1); I > 0; --I)
		{
			St = St * 1664525u + 1013904223u;
			const size_t J = St % (I + 1);
			std::swap(Pool[I], Pool[J]);
		}
		Pool.resize(std::min(static_cast<size_t>(std::max(0, Count)), Pool.size()));
		return Pool;
	}

	std::vector<FOffer> ShopOffers(const FCatalog& C, const FShop& ShopIn, double Day, double Mult)
	{
		FShop Shop = ShopIn;
		if (Mult != 1) Shop.PriceMult = Shop.PriceMult * Mult;
		FShMulberry Rand{ShDaySeed(Shop.Id, Day)};
		std::vector<FOffer> Offers;
		const double WeekMs = Day * 86400000.0;
		if (Shop.Kind == "weapons")
		{
			const bool bHeavy = Shop.Id == "solara-heavy";
			std::vector<const FWeapon*> Pool;
			for (const FWeapon& W : C.Weapons) if (W.Tier != "S" && (!bHeavy || W.Archetype == "HEAVY")) Pool.push_back(&W);
			for (int I = 0; I < 6 && !Pool.empty(); ++I)
			{
				const FWeapon& W = *Pool[static_cast<size_t>(std::floor(Rand() * static_cast<double>(Pool.size())))];
				Offers.push_back(ShWeaponOffer(Shop, W, W.Tier + Dot + W.Archetype + Dot + W.Element + Dot + "POWER " + N(ShWeaponPower(W.Tier)), 1));
			}
			for (const FCatalogWeapon& W : WeeklyCatalogStock(C, Shop.Id, WeekMs))
				if (!bHeavy || W.Archetype == "HEAVY")
					Offers.push_back(ShWeaponOffer(Shop, W, "WEEKLY" + Dot + ShClassLabel(W.Cls) + Dot + W.Rarity + Dot + W.Element + Dot + "POWER " + N(ShWeaponPower(W.Tier)), 1.2));
		}
		else if (Shop.Kind == "exotic")
		{
			for (const FShPack& P : ShExotic())
				if (P.Material != Shop.Currency) Offers.push_back(ShMaterialOffer(Shop, P, std::max(1.0, js::Round(P.Price * Shop.PriceMult)), "+" + N(P.Amount) + " " + P.Material));
			for (const FCatalogWeapon& W : WeeklyCatalogStock(C, Shop.Id, WeekMs))
				Offers.push_back(ShWeaponOffer(Shop, W, "WEEKLY" + Dot + ShClassLabel(W.Cls) + Dot + W.Rarity + Dot + W.Element + Dot + "POWER " + N(ShWeaponPower(W.Tier)), 1.25));
		}
		else if ((Shop.Kind == "armor" || Shop.Kind == "armorsmith") && Shop.VendorTier)
		{
			std::vector<const FCollection*> Pool;
			for (const FCollection& Co : C.Collections)
				if (Co.VendorTier && Co.VendorTier <= Shop.VendorTier && Co.Family != "exotic" && !ShHas(Co.Sources, "black-market")) Pool.push_back(&Co);
			ShCollectionOffers(Shop, Rand, Pool, 5, Offers);
		}
		else if (Shop.Kind == "blackmarket")
		{
			std::vector<const FCollection*> Pool;
			for (const FCollection& Co : C.Collections) if (ShHas(Co.Sources, "black-market") && Co.Family != "exotic") Pool.push_back(&Co);
			ShCollectionOffers(Shop, Rand, Pool, 4, Offers);
		}
		if (Shop.Kind == "armor")
		{
			std::vector<const FArmor*> Pool;
			for (const FArmor& A : C.Armors) if (A.Tier != "S") Pool.push_back(&A);
			for (int I = 0; I < 6 && !Pool.empty(); ++I)
			{
				const FArmor& A = *Pool[static_cast<size_t>(std::floor(Rand() * static_cast<double>(Pool.size())))];
				FOffer O;
				O.Key = Shop.Id + "-" + A.Id; O.Type = "gear"; O.Name = A.Name;
				O.Detail = A.Tier + Dot + A.Slot + Dot + A.ClassId + Dot + "POWER " + N(ShArmorPower(A.Tier));
				O.Price = js::Round(ShArmorPrice(A.Tier) * Shop.PriceMult); O.MinLevel = ShArmorLevel(A.Tier);
				O.Listing = FListing{O.Key, "armor", A.Id, A.Name, A.Tier, "", "", A.Slot, ShArmorPower(A.Tier)};
				Offers.push_back(O);
			}
		}
		else if (Shop.Kind == "supplies" || Shop.Kind == "vehicles")
		{
			for (const FShPack& P : Shop.Kind == "supplies" ? ShSupplies() : ShVehicles())
			{
				if (P.Material == Shop.Currency) continue; // never sell the currency for itself
				Offers.push_back(ShMaterialOffer(Shop, P, std::max(1.0, js::Round((P.Price ? P.Price : 20) * Shop.PriceMult)), "+" + N(P.Amount) + " " + P.Material));
			}
		}
		if (Shop.Kind == "mods" && Shop.Currency != "tuningCore")
			Offers.push_back(ShMaterialOffer(Shop, {"tuningCore", 1, 8, "Tuning Core"}, std::max(1.0, js::Round(8 * Shop.PriceMult)), "+1 tuningCore" + Dot + "unlocks armor upgrades from level 4"));
		std::vector<FOffer> Unique;
		for (const FOffer& O : Offers)
			if (std::none_of(Unique.begin(), Unique.end(), [&O](const FOffer& U) { return U.Key == O.Key; })) Unique.push_back(O);
		for (FOffer& O : Unique)
			if (O.Type != "material")
			{
				O.Price = std::max(1.0, js::Round(O.Price * (1 - DailyDealOff)));
				O.Detail = "DAILY DEAL −" + N(DailyDealOff * 100) + "%" + Dot + O.Detail;
				if (O.Type == "piece") O.bDeal = true;
				break;
			}
		return Unique;
	}

	// ---- Living World ----
	const FFaction* FactionById(const std::string& Id)
	{
		static const std::vector<FFaction> F = {{"wardens", "Nexus Wardens", ""}, {"guild", "Arcology Guild", ""}, {"syndicate", "Neon Syndicate", "aegis"}, {"aegis", "Aegis Directorate", "syndicate"}};
		for (const FFaction& X : F) if (X.Id == Id) return &X;
		return nullptr;
	}
	double RepOf(const FProgression::FLiving& L, const std::string& F)
	{
		const auto G = L.Gain.find(F), Lo = L.Loss.find(F);
		return std::max(-100.0, std::min(100.0, (G == L.Gain.end() ? 0 : G->second) - (Lo == L.Loss.end() ? 0 : Lo->second)));
	}
	std::string RepTier(double R)
	{
		if (R <= -40) return "HOSTILE";
		if (R < -10) return "WARY";
		if (R < 20) return "NEUTRAL";
		if (R < 55) return "TRUSTED";
		return "HONORED";
	}
	bool TierAtLeast(const std::string& T, const std::string& Min)
	{
		static const std::vector<std::string> Order = {"HOSTILE", "WARY", "NEUTRAL", "TRUSTED", "HONORED"};
		const auto Ix = [](const std::string& X) { const auto It = std::find(Order.begin(), Order.end(), X); return It == Order.end() ? -1 : static_cast<int>(It - Order.begin()); };
		return Ix(T) >= Ix(Min);
	}
	FTierRule TierRule(const std::string& T)
	{
		if (T == "HOSTILE") return {false, 1.5, "Hostile"};
		if (T == "WARY") return {true, 1.25, "Wary"};
		if (T == "TRUSTED") return {true, 0.9, "Trusted"};
		if (T == "HONORED") return {true, 0.8, "Honored"};
		return {true, 1, "Neutral"};
	}
	void AdjustRep(FProgression::FLiving& L, const std::string& F, double Amount, bool bSpill)
	{
		if (Amount == 0) return;
		auto Bump = [&L](const std::string& Fac, double A) { if (A > 0) L.Gain[Fac] += A; else L.Loss[Fac] += -A; };
		Bump(F, Amount);
		const FFaction* Fa = FactionById(F);
		if (bSpill && Fa && !Fa->Rival.empty() && Amount > 0) Bump(Fa->Rival, -std::ceil(Amount / 2));
	}
	std::string DistrictStatus(const FProgression::FLiving& L, const std::string& Id, double Now)
	{
		const auto It = L.Districts.find(Id);
		if (It == L.Districts.end()) return "STABLE";
		const auto& D = It->second;
		if (D.FallenAt > D.SecuredAt) return "FALLEN";
		if (D.SecuredAt && Now - D.SecuredAt < SecuredMs) return "SECURED";
		return "STABLE";
	}
	void RecordDistrict(FProgression::FLiving& L, const std::string& Id, bool bWon, double Now)
	{
		auto& D = L.Districts[Id];
		if (bWon) D.SecuredAt = std::max(Now, D.FallenAt + 1);
		else D.FallenAt = std::max(Now, D.SecuredAt + 1);
	}
	FTerms LivingShopTerms(const FProgression::FLiving* L, const FShop& Shop, double Now)
	{
		const FFaction* F = Shop.Faction.empty() ? nullptr : FactionById(Shop.Faction);
		if (!F) return {std::nullopt, 1};
		const std::string Tier = L ? RepTier(RepOf(*L, F->Id)) : "NEUTRAL";
		if (Shop.MinStanding && !TierAtLeast(Tier, *Shop.MinStanding))
			return {F->Name + " only trade with " + TierRule(*Shop.MinStanding).Label + " operators (you are " + TierRule(Tier).Label + ")", TierRule(Tier).PriceMult};
		if (!L) return {std::nullopt, 1};
		const std::string Status = Shop.District.empty() ? "STABLE" : DistrictStatus(*L, Shop.District, Now);
		if (!TierRule(Tier).bTrade) return {F->Name + " refuse to trade with you (Hostile)", TierRule(Tier).PriceMult};
		if (Status == "FALLEN") return {Shop.DistrictName + " was overrun. Defend it to reopen trade", 1};
		return {std::nullopt, TierRule(Tier).PriceMult * (Status == "SECURED" ? 0.9 : 1)};
	}

	// ---- hours ----
	std::optional<std::pair<double, double>> ShopHours(const FShop& Shop)
	{
		if (Shop.Kind == "blackmarket") return std::make_pair(18.0, 5.0);
		if (Shop.Id.rfind("nexus-", 0) == 0 || Shop.Id.rfind("neon-", 0) == 0) return std::make_pair(5.0, 25.0);
		return std::nullopt;
	}
	bool IsOpenAt(const std::optional<std::pair<double, double>>& Hours, std::optional<double> Hour)
	{
		if (!Hours || !Hour || !std::isfinite(*Hour)) return true;
		const double H = ShNorm(*Hour), Open = ShNorm(Hours->first), Close = ShNorm(Hours->second);
		if (Open == Close) return true;
		return Open < Close ? H >= Open && H < Close : H >= Open || H < Close;
	}
	std::optional<std::string> ShopClosedReason(const FShop& Shop, std::optional<double> Hour)
	{
		const auto Hours = ShopHours(Shop);
		if (IsOpenAt(Hours, Hour)) return std::nullopt;
		return "Closed" + Dot + "opens " + ShClock(Hours->first);
	}

	// ---- trading ----
	std::optional<std::string> ShopLock(const FShop& Shop, const FProgression& P, double Now, std::optional<double> Hour)
	{
		if (P.Level < Shop.MinLevel) return "Requires level " + N(Shop.MinLevel);
		if (Shop.RequiresMission && !ShHas(P.CompletedMissions, *Shop.RequiresMission)) return Shop.RequiresLabel.value_or(*Shop.RequiresMission);
		if (std::optional<std::string> Closed = ShopClosedReason(Shop, Hour)) return Closed;
		return LivingShopTerms(&P.Living, Shop, Now).Lock;
	}
	double ShopPriceMult(const FShop& Shop, const FProgression& P, double Now) { return LivingShopTerms(&P.Living, Shop, Now).PriceMult; }

	FGearItem ListingToGearItem(const FListing& L, const std::string& VendorName, double NowMs, double Random01)
	{
		FGearItem G;
		G.Id = L.ItemId + "-" + ShBase36(NowMs) + ShBase36(std::floor(Random01 * 36));
		G.Name = L.Name; G.Power = L.Power; G.Level = 1; G.Source = "Purchased · " + VendorName;
		if (L.Kind == "weapon")
		{
			G.Slot = L.Archetype == "HEAVY" ? "heavy" : L.Archetype == "SIDEARM" ? "secondary" : "primary";
			G.Element = L.Element == "PLASMA" ? "ARC" : L.Element == "VOID" ? "BIO" : L.Element;
		}
		else
		{
			G.Slot = L.Slot == "HELM" ? "helmet" : L.Slot == "CHEST" ? "chest" : L.Slot == "ARMS" ? "gauntlets" : L.Slot == "LEGS" ? "legs" : "classItem";
			G.Element = "KINETIC";
		}
		return G;
	}

	FResult BuyOffer(const reward::FCatalog& Rewards, FProgression& P, const FShop& Shop, const FOffer& Offer, double Now, std::optional<double> Hour, double Random01)
	{
		if (std::optional<std::string> Lock = ShopLock(Shop, P, Now, Hour)) return {false, *Lock};
		if (P.Level < Offer.MinLevel) return {false, "Requires level " + N(Offer.MinLevel)};
		const double Have = P.Materials.count(Shop.Currency) ? P.Materials.at(Shop.Currency) : 0;
		if (Have < Offer.Price) return {false, "Not enough " + Shop.Currency};
		FProgression Paid = P;
		Paid.Materials[Shop.Currency] = Have - Offer.Price;
		if (Offer.Type == "piece" && Offer.Drop)
		{
			const std::optional<FGearItem> Item = reward::MakeSetPiece(Rewards, Offer.Drop->SetId, Offer.Drop->Slot);
			if (!Item) return {false, "That piece is unavailable"};
			if (std::any_of(Paid.Inventory.begin(), Paid.Inventory.end(), [&Item](const FGearItem& G) { return G.Id == Item->Id; })) return {false, "You already own that piece"};
			Paid.Inventory.push_back(*Item);
			P = std::move(Paid);
			return {true, Offer.Name + " added to inventory"};
		}
		if (Offer.Type == "gear" && Offer.Listing)
		{
			Paid.Inventory.push_back(ListingToGearItem(*Offer.Listing, Shop.Name, Now, Random01));
			P = std::move(Paid);
			return {true, Offer.Name + " added to inventory"};
		}
		Paid.Materials[Offer.Material] = (Paid.Materials.count(Offer.Material) ? Paid.Materials[Offer.Material] : 0) + Offer.Amount;
		P = std::move(Paid);
		return {true, Offer.Name + " purchased"};
	}

	// ---- services ----
	FCost GearCost(const FGearItem& I)
	{
		const double A = I.Level * 2;
		if (I.Slot == "vehicle") return {"vehicleParts", A};
		if (I.Element == "THERMAL") return {"thermalShards", A};
		if (I.Element == "CRYO") return {"cryoCrystal", A};
		if (I.Element == "BIO") return {"sporeFiber", A};
		return {I.Slot == "primary" || I.Slot == "secondary" || I.Slot == "heavy" ? "scrapMetal" : "reinforcedAlloy", A};
	}
	std::optional<FCost> UpgradeGate(const FGearItem& I)
	{
		if (I.Slot == "vehicle") return std::nullopt;
		const bool bWeapon = I.Slot == "primary" || I.Slot == "secondary" || I.Slot == "heavy";
		if (I.Level >= (bWeapon ? 3 : 4)) return FCost{bWeapon ? "forgeCatalyst" : "tuningCore", 1};
		return std::nullopt;
	}
	bool UpgradeGear(FProgression& P, const std::string& Id)
	{
		const auto It = std::find_if(P.Inventory.begin(), P.Inventory.end(), [&Id](const FGearItem& G) { return G.Id == Id; });
		if (It == P.Inventory.end()) return false;
		if (It->Level >= (It->SetId ? reward::ArmorLevelMax : GearLevelMax)) return false;
		const FCost Cost = GearCost(*It);
		const std::optional<FCost> Gate = UpgradeGate(*It);
		auto Have = [&P](const std::string& M) { const auto F = P.Materials.find(M); return F == P.Materials.end() ? 0.0 : F->second; };
		if (Have(Cost.Material) < Cost.Amount) return false;
		if (Gate && Have(Gate->Material) < Gate->Amount) return false;
		P.Materials[Cost.Material] = Have(Cost.Material) - Cost.Amount;
		if (Gate) P.Materials[Gate->Material] = Have(Gate->Material) - Gate->Amount;
		It->Level += 1;
		It->Power += 15;
		return true;
	}
	bool InfuseGear(FProgression& P, const std::string& Id, const std::string& Element)
	{
		const auto It = std::find_if(P.Inventory.begin(), P.Inventory.end(), [&Id](const FGearItem& G) { return G.Id == Id; });
		if (It == P.Inventory.end() || Element == "KINETIC" || Element == It->Element) return false; // weapon evolutions (which also refuse) are not ported
		const std::string M = Element == "THERMAL" ? "thermalShards" : Element == "CRYO" ? "cryoCrystal" : Element == "BIO" ? "bioCatalyst" : "microCircuits";
		const double Have = P.Materials.count(M) ? P.Materials[M] : 0;
		if (Have < 3) return false;
		P.Materials[M] = Have - 3;
		It->Element = Element;
		return true;
	}
	double ServiceFee(const FShop& Shop, const FGearItem& I) { return std::max(2.0, js::Round(I.Level * 4 * Shop.PriceMult)); }
	std::vector<std::string> ServiceTargets(const FShop& Shop, const FProgression& P)
	{
		std::vector<std::string> Out;
		for (const FGearItem& I : P.Inventory)
		{
			const bool bWeapon = I.Slot == "primary" || I.Slot == "secondary" || I.Slot == "heavy";
			const bool bArmor = I.Slot == "helmet" || I.Slot == "chest" || I.Slot == "gauntlets" || I.Slot == "legs" || I.Slot == "classItem";
			if ((Shop.Kind == "gunsmith" && bWeapon) || (Shop.Kind == "mods" && I.Slot != "vehicle") || (Shop.Kind == "armorsmith" && bArmor) || (Shop.Kind == "vehicles" && I.Slot == "vehicle")) Out.push_back(I.Id);
		}
		return Out;
	}
	FResult ServiceGear(FProgression& P, const FShop& Shop, const std::string& Id, const std::optional<std::string>& Element, double Now, std::optional<double> Hour)
	{
		if (std::optional<std::string> Lock = ShopLock(Shop, P, Now, Hour)) return {false, *Lock};
		const auto It = std::find_if(P.Inventory.begin(), P.Inventory.end(), [&Id](const FGearItem& G) { return G.Id == Id; });
		if (It == P.Inventory.end() || !ShHas(ServiceTargets(Shop, P), Id)) return {false, "This shop can't service that item"};
		const FGearItem Item = *It;
		const double Fee = ServiceFee(Shop, Item);
		const double Have = P.Materials.count(Shop.Currency) ? P.Materials[Shop.Currency] : 0;
		if (Have < Fee) return {false, "Not enough " + Shop.Currency};
		FProgression Paid = P;
		Paid.Materials[Shop.Currency] = Have - Fee;
		const bool bInfuse = Shop.Kind == "mods" && Element.has_value();
		const bool bDone = bInfuse ? InfuseGear(Paid, Id, *Element) : UpgradeGear(Paid, Id);
		if (!bDone)
		{
			if (Shop.Kind == "mods") return {false, "Missing infusion materials"};
			const FCost Cost = GearCost(Item);
			const std::optional<FCost> Gate = UpgradeGate(Item);
			return {false, "Needs " + N(Cost.Amount) + " " + Cost.Material + (Gate ? " + 1 " + Gate->Material : std::string())};
		}
		P = std::move(Paid);
		return {true, Shop.Kind == "mods" ? Item.Name + " infused" : Item.Name + " upgraded to level " + N(Item.Level + 1)};
	}
}
