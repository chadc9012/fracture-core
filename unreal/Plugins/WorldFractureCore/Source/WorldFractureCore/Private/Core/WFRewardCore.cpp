// World Fracture — kill rewards, drop claiming and XP. Port of sim.ts / inventory.ts / armor-sets.ts / weapon-loot.ts /
// balance.ts / xp.ts; see WFRewardCore.h. Arithmetic keeps the web build's operation order so results match bit for bit.
#include "Core/WFRewardCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <utility>

namespace wf::reward
{
	const char* const SetSlots[5] = {"helmet", "gauntlets", "chest", "legs", "classItem"};

	namespace
	{
		double SetDropChance(ETier Tier)
		{
			switch (Tier)
			{
			case ETier::Normal: return 0.03;
			case ETier::Elite: return 0.12;
			case ETier::Boss: return 0.6;
			}
			return 0;
		}

		double WeaponDropChance(ETier Tier)
		{
			switch (Tier)
			{
			case ETier::Normal: return 0.02;
			case ETier::Elite: return 0.08;
			case ETier::Boss: return 0.35;
			}
			return 0;
		}

		double WeaponSourcePower(ETier Tier)
		{
			switch (Tier)
			{
			case ETier::Normal: return 140;
			case ETier::Elite: return 190;
			case ETier::Boss: return 260;
			}
			return 0;
		}

		double SetBasePower(const std::string& Slot)
		{
			if (Slot == "helmet") return 95;
			if (Slot == "gauntlets") return 90;
			if (Slot == "chest") return 110;
			if (Slot == "legs") return 95;
			if (Slot == "classItem") return 85;
			return 0;
		}

		const FArmorSet* SetForRegion(const FCatalog& C, const std::string& RegionId)
		{
			for (const FArmorSet& S : C.Sets)
				if (!S.RegionId.empty() && S.RegionId == RegionId) return &S;
			return nullptr;
		}

		const FArmorSet* SetById(const FCatalog& C, const std::string& Id)
		{
			for (const FArmorSet& S : C.Sets)
				if (S.Id == Id) return &S;
			return nullptr;
		}

		std::string SetPieceId(const std::string& SetId, const std::string& Slot) { return "set-" + SetId + "-" + Slot; }

		bool HasItem(const FProgression& P, const std::string& Id)
		{
			return std::any_of(P.Inventory.begin(), P.Inventory.end(), [&Id](const FGearItem& G) { return G.Id == Id; });
		}

		/** balance.ts lerpCurve: piecewise-linear through control points, clamped at the ends. */
		double LerpCurve(double X, const std::vector<std::pair<double, double>>& Points)
		{
			if (X <= Points.front().first) return Points.front().second;
			if (X >= Points.back().first) return Points.back().second;
			for (size_t I = 0; I + 1 < Points.size(); ++I)
			{
				const auto [X0, Y0] = Points[I];
				const auto [X1, Y1] = Points[I + 1];
				if (X >= X0 && X <= X1) return Y0 + ((Y1 - Y0) * (X - X0)) / (X1 - X0);
			}
			return Points.back().second;
		}

		ETier TierOf(const FMachine& M) { return M.bBoss ? ETier::Boss : M.bElite ? ETier::Elite : ETier::Normal; }

		std::string N(double V) { return js::NumberToString(V); }
	}

	std::optional<FSetDrop> RollSetDrop(const FCatalog& Catalog, const std::string& RegionId, ETier Tier, double Roll)
	{
		const FArmorSet* Set = SetForRegion(Catalog, RegionId);
		const double Chance = SetDropChance(Tier);
		if (!Set || !(Roll >= 0) || Roll >= Chance) return std::nullopt;
		const size_t Index = std::min<size_t>(4, static_cast<size_t>(std::floor((Roll / Chance) * 5)));
		return FSetDrop{Set->Id, SetSlots[Index]};
	}

	std::optional<FGearItem> RollWeaponLoot(const FCatalog& Catalog, ETier Tier, const std::string& Zone, double Roll, const std::string& UniqueSuffix)
	{
		const double Chance = WeaponDropChance(Tier);
		if (!(Roll >= 0) || Roll >= Chance) return std::nullopt;
		const std::vector<FWeaponTemplate>& Pool = Tier == ETier::Boss ? Catalog.BossPool : Catalog.EnemyPool;
		if (Pool.empty()) return std::nullopt;
		const FWeaponTemplate& Pick = Pool[js::Fnv1a(Zone + "|" + js::NumberToString(Roll)) % Pool.size()];
		FGearItem Item;
		Item.Id = "drop-" + Pick.Id + "-" + UniqueSuffix;
		Item.Name = Pick.Name;
		Item.Slot = Pick.Slot;
		Item.Power = WeaponSourcePower(Tier);
		Item.Level = 1;
		Item.Element = Pick.Element;
		Item.Source = std::string(Tier == ETier::Boss ? "Boss" : Tier == ETier::Elite ? "Elite" : "Enemy") + " drop \xC2\xB7 " + Zone;
		return Item;
	}

	std::optional<FGearItem> MakeSetPiece(const FCatalog& Catalog, const std::string& SetId, const std::string& Slot, double Level)
	{
		const FArmorSet* Set = SetById(Catalog, SetId);
		if (!Set) return std::nullopt;
		const double Lv = std::max(1.0, std::min(ArmorLevelMax, js::Round(Level)));
		FGearItem Item;
		Item.Id = SetPieceId(SetId, Slot);
		const auto Piece = Set->Pieces.find(Slot);
		Item.Name = Piece == Set->Pieces.end() ? std::string() : Piece->second;
		Item.Slot = Slot;
		Item.Power = SetBasePower(Slot) + SetPowerPerLevel * (Lv - 1);
		Item.Level = Lv;
		Item.Element = Set->Element;
		Item.Source = Set->Name + " set";
		Item.SetId = SetId;
		return Item;
	}

	FProgression GrantSetPiece(const FCatalog& Catalog, FProgression P, const FSetDrop& Drop)
	{
		const std::string Id = SetPieceId(Drop.SetId, Drop.Slot);
		const auto Owned = std::find_if(P.Inventory.begin(), P.Inventory.end(), [&Id](const FGearItem& G) { return G.Id == Id; });
		if (Owned == P.Inventory.end())
		{
			if (std::optional<FGearItem> Item = MakeSetPiece(Catalog, Drop.SetId, Drop.Slot)) P.Inventory.push_back(*Item);
			return P;
		}
		if (Owned->Level >= ArmorLevelMax) return P;
		Owned->Level += 1;
		Owned->Power += SetPowerPerLevel;
		return P;
	}

	EDefeatResult DefeatMachine(const FCatalog& Catalog, FMachine& M, ECredit Credit, FSimTally& Sim, IRandom& Random)
	{
		if (!M.bAlive || M.Hp > 0) return EDefeatResult::Ignored;
		if (M.bDecoy)
		{
			M.bAlive = false;
			M.Living.reset();
			M.bDecoy = false;
			return EDefeatResult::Shattered;
		}
		M.bAlive = false;

		if (M.Rival)
		{
			M.Rival.reset();
			M.Living.reset();
			if (Credit == ECredit::Player) Sim.RivalKills += 1;
			return EDefeatResult::RivalScored;
		}
		if (M.Nemesis)
		{
			Sim.NemesisEvents.emplace_back(*M.Nemesis, Credit == ECredit::Player);
			M.Nemesis.reset();
		}
		const std::optional<std::string> LivingTag = M.Living;
		if (M.Living)
		{
			if (Credit == ECredit::Player) Sim.LivingKills[*M.Living] += 1;
			M.Living.reset();
		}
		// a Living World boss that dies to the world pays nobody, unlike catalog bosses
		if (Credit == ECredit::World && !M.bEmergencyQuest && !M.ScenarioId && (!M.bBoss || LivingTag)) return EDefeatResult::Unpaid;

		Sim.Kills += 1;
		if (M.bBoss) Sim.BossKills += 1;
		else if (M.bElite) Sim.EliteKills += 1;
		Sim.Credits += M.bBoss ? 250 : M.bElite ? 75 : 45;

		const std::string Material = M.DropMaterial;
		const double Amount = M.bBoss ? 3 : M.bElite ? 2 : 1;
		Sim.Materials[Material] += Amount;

		const ETier Tier = TierOf(M);
		const std::optional<FSetDrop> SetDrop = RollSetDrop(Catalog, M.Zone, Tier, Random.Uniform());
		// a Unique Scenario kill carries its claim: chance rolls drawn now, participation from the player's own hits
		std::optional<scenario::FClaim> Claim;
		const auto Loot = M.ScenarioId ? Catalog.Scenarios.Loot.find(*M.ScenarioId) : Catalog.Scenarios.Loot.end();
		if (Loot != Catalog.Scenarios.Loot.end() && M.ScenarioRun && !M.ScenarioRun->empty())
		{
			Claim = scenario::FClaim{};
			Claim->ScenarioId = *M.ScenarioId;
			Claim->RunId = *M.ScenarioRun;
			Claim->bParticipated = M.PlayerHits >= scenario::ParticipationHits;
			for (size_t I = 0; I < Loot->second.Chance.size(); ++I) Claim->Rolls.push_back(Random.Uniform());
			Claim->Elapsed = M.Elapsed;
			Claim->Deaths = M.Deaths;
		}
		const double DropId = Sim.NextDropId;
		Sim.NextDropId += 1;
		const double WeaponRoll = Random.Uniform(); // drawn before the suffix, as the web build evaluates its arguments
		const std::string Suffix = Random.UniqueSuffix();
		const std::optional<FGearItem> WeaponDrop = RollWeaponLoot(Catalog, Tier, M.Zone, WeaponRoll, N(DropId) + "-" + Suffix);

		FDrop Drop;
		Drop.Id = DropId;
		Drop.Material = Material;
		Drop.Amount = Amount;
		Drop.Enemy = M.Profile;
		Drop.WeaponDrop = WeaponDrop;
		Drop.SetDrop = SetDrop;
		Drop.ScenarioClaim = Claim;
		Sim.Drops.push_back(Drop);

		FXpEvent Xp;
		Xp.Type = M.bBoss ? "BOSS_KILL" : M.bElite ? "ELITE_KILL" : "KILL";
		Xp.EnemyLevel = 1 + std::floor(Sim.CombatHeat / 25);
		Xp.CombatHeat = Sim.CombatHeat;
		Sim.XpEvents.push_back(Xp);

		if (M.bEmergencyQuest) Sim.Credits += 400;
		if (M.ScenarioId)
		{
			const auto Credits = Catalog.Scenarios.RewardCredits.find(*M.ScenarioId);
			if (Credits != Catalog.Scenarios.RewardCredits.end()) Sim.Credits += Credits->second;
		}
		return EDefeatResult::Paid;
	}

	double PlayerPowerScore(const FProgression& P)
	{
		std::vector<std::string> Equipped;
		for (const auto& [Slot, Id] : P.EquippedGear)
			if (!Id.empty()) Equipped.push_back(Id);
		double Sum = 0;
		size_t Count = 0;
		for (const FGearItem& G : P.Inventory)
			if (std::find(Equipped.begin(), Equipped.end(), G.Id) != Equipped.end()) { Sum += G.Power; ++Count; }
		const double AvgPower = Count ? Sum / static_cast<double>(Count) : 90;
		double Clears = 0;
		for (const auto& [Id, Times] : P.DungeonClears) Clears += Times;
		const double ClearScore = Clears * 6;
		const double MissionScore = static_cast<double>(P.CompletedMissions.size()) * 4;
		return std::max(0.0, AvgPower * 0.6 + ClearScore + MissionScore);
	}

	double RewardPacing(double Power)
	{
		return LerpCurve(Power, {{0, 1.35}, {150, 1}, {300, 0.75}});
	}

	FProgression ClaimDrops(const FCatalog& Catalog, FProgression P, const std::vector<FDrop>& Drops, double NowMs)
	{
		static const std::vector<std::string> RelicMaterials = {"magmaCore", "zeroCore", "abyssCore", "aegisCore", "anomalyCore", "vehicleParts", "fractureCore"};
		const double Pacing = RewardPacing(PlayerPowerScore(P));
		for (const FDrop& Drop : Drops)
		{
			if (Drop.SetDrop) P = GrantSetPiece(Catalog, std::move(P), *Drop.SetDrop);
			if (Drop.WeaponDrop && !HasItem(P, Drop.WeaponDrop->Id)) P.Inventory.push_back(*Drop.WeaponDrop);
			if (Drop.ScenarioClaim) P = scenario::ClaimScenario(Catalog.Scenarios, std::move(P), *Drop.ScenarioClaim, NowMs);
			P.Materials[Drop.Material] += std::max(1.0, js::Round(Drop.Amount * Pacing));
			P.Materials["energyToken"] += 1;
			if (Drop.Amount >= 3) P.Materials["relicFragment"] += 1;
			if (std::find(RelicMaterials.begin(), RelicMaterials.end(), Drop.Material) != RelicMaterials.end() && Drop.Amount >= 3)
			{
				const std::string Id = "boss-" + Drop.Material;
				if (!HasItem(P, Id))
				{
					FGearItem Relic;
					Relic.Id = Id;
					Relic.Name = Drop.Enemy + " Relic";
					Relic.Slot = Drop.Material == "vehicleParts" ? "vehicle" : Drop.Material == "aegisCore" ? "chest"
						: Drop.Material == "anomalyCore" || Drop.Material == "fractureCore" ? "classItem" : "heavy";
					Relic.Power = 260;
					Relic.Level = 1;
					Relic.Element = Drop.Material == "magmaCore" ? "THERMAL" : Drop.Material == "zeroCore" ? "CRYO" : "ARC";
					Relic.Source = Drop.Enemy;
					P.Inventory.push_back(Relic);
				}
			}
		}
		return P;
	}

	double BaseXpFor(const std::string& Type, double EnemyLevel)
	{
		if (Type == "KILL") return std::min(100.0, std::max(10.0, EnemyLevel * 10));
		if (Type == "ELITE_KILL") return 200;
		if (Type == "BOSS_KILL") return 1000;
		if (Type == "MISSION") return 800;
		if (Type == "OBJECTIVE") return 150;
		if (Type == "DISCOVERY") return 100;
		return 0;
	}

	FGrantXpResult GrantXP(FProgression P, const std::string& Type, std::optional<double> EnemyLevel, std::optional<double> CombatHeat, std::optional<std::string> RareEvent, double Scale)
	{
		const double TypeMultiplier = Type == "MISSION" ? 1.5 : Type == "DISCOVERY" ? 1.2 : 1;
		double Amount = BaseXpFor(Type, EnemyLevel.value_or(1)) * TypeMultiplier * Scale;
		if (CombatHeat) Amount *= 1 + std::min(2.0, std::max(0.0, *CombatHeat) / 40);
		if (RareEvent && *RareEvent == "CORRUPTION_ZONE_CLEAR") Amount *= 3;
		Amount = js::Round(Amount);

		FGrantXpResult R;
		double Xp = P.Xp + Amount;
		double Level = P.Level;
		while (Xp >= Level * XpPerLevel)
		{
			Xp -= Level * XpPerLevel;
			Level += 1;
			P.CalibrationTokens += 1;
			R.bLeveledUp = true;
		}
		P.Xp = Xp;
		P.Level = Level;
		P.NovaLevel = P.NovaLevel + Amount * 0.01;
		static const std::pair<double, const char*> NovaThresholds[] = {{10, "CORRUPTION_CONTROL"}, {25, "REALITY_SHIFT"}};
		for (const auto& [NovaLevel, Ability] : NovaThresholds)
			if (P.NovaLevel >= NovaLevel && std::find(P.NovaUnlocks.begin(), P.NovaUnlocks.end(), Ability) == P.NovaUnlocks.end())
			{
				P.NovaUnlocks.emplace_back(Ability);
				R.NovaUnlocked.emplace_back(Ability);
			}
		R.Gained = Amount;
		R.NewLevel = Level;
		R.Progression = std::move(P);
		return R;
	}

	std::string DescribeGear(const FGearItem& G)
	{
		return G.Id + "|" + G.Name + "|" + G.Slot + "|" + N(G.Power) + "|" + N(G.Level) + "|" + G.Element + "|" + G.Source + "|" + G.SetId.value_or("") + "|" + G.Rarity.value_or("") + "|" + G.Perk.value_or("");
	}

	namespace
	{
		std::string NumberMap(const std::map<std::string, double>& Items)
		{
			std::string Out = "{";
			bool First = true;
			for (const auto& [K, V] : Items) { if (!First) Out += ","; First = false; Out += K + ":" + N(V); }
			return Out + "}";
		}
	}

	std::string DescribeLoot(const FProgression& P)
	{
		std::string Out = "inventory=[";
		for (size_t I = 0; I < P.Inventory.size(); ++I) { if (I) Out += ";"; Out += DescribeGear(P.Inventory[I]); }
		Out += "];equipped={";
		bool First = true;
		for (const auto& [Slot, Id] : P.EquippedGear) { if (!First) Out += ","; First = false; Out += Slot + ":" + Id; }
		Out += "};materials=" + NumberMap(P.Materials);
		Out += ";xp=" + N(P.Xp) + ";level=" + N(P.Level) + ";tokens=" + N(P.CalibrationTokens) + ";nova=" + N(P.NovaLevel) + ";novaUnlocks=[";
		for (size_t I = 0; I < P.NovaUnlocks.size(); ++I) { if (I) Out += ","; Out += P.NovaUnlocks[I]; }
		Out += "];shards=" + N(P.FractureShards) + ";earned=[";
		for (size_t I = 0; I < P.EarnedRewards.size(); ++I) { if (I) Out += ","; Out += P.EarnedRewards[I]; }
		Out += "];abilities=[";
		for (size_t I = 0; I < P.UnlockedAbilities.size(); ++I) { if (I) Out += ","; Out += P.UnlockedAbilities[I]; }
		Out += "];runs={";
		bool FirstRun = true;
		for (const auto& [Key, R] : P.MissionRuns)
		{
			if (!FirstRun) Out += ",";
			FirstRun = false;
			Out += Key + ":" + R.Day + "/" + N(R.Count) + "/" + (R.Last ? N(*R.Last) : std::string("~"));
		}
		return Out + "}";
	}

	std::string DescribeTally(const FSimTally& S)
	{
		std::string Out = "kills=" + N(S.Kills) + ";boss=" + N(S.BossKills) + ";elite=" + N(S.EliteKills) + ";rival=" + N(S.RivalKills)
			+ ";credits=" + N(S.Credits) + ";nextDrop=" + N(S.NextDropId) + ";materials=" + NumberMap(S.Materials) + ";living=" + NumberMap(S.LivingKills) + ";nemesis=[";
		for (size_t I = 0; I < S.NemesisEvents.size(); ++I) { if (I) Out += ","; Out += S.NemesisEvents[I].first + (S.NemesisEvents[I].second ? ":killed" : ":escaped"); }
		Out += "];drops=[";
		for (size_t I = 0; I < S.Drops.size(); ++I)
		{
			const FDrop& D = S.Drops[I];
			if (I) Out += ";";
			Out += N(D.Id) + "/" + D.Material + "/" + N(D.Amount) + "/" + D.Enemy + "/" + (D.SetDrop ? D.SetDrop->SetId + ":" + D.SetDrop->Slot : "") + "/" + (D.WeaponDrop ? DescribeGear(*D.WeaponDrop) : "");
			if (D.ScenarioClaim)
			{
				const scenario::FClaim& C = *D.ScenarioClaim;
				Out += "/claim:" + C.ScenarioId + ":" + C.RunId + ":" + (C.bParticipated ? "1" : "0") + ":";
				for (size_t R = 0; R < C.Rolls.size(); ++R) { if (R) Out += ","; Out += N(C.Rolls[R]); }
				Out += ":" + (C.Elapsed ? N(*C.Elapsed) : std::string("~")) + ":" + (C.Deaths ? N(*C.Deaths) : std::string("~"));
			}
		}
		Out += "];xp=[";
		for (size_t I = 0; I < S.XpEvents.size(); ++I) { if (I) Out += ";"; Out += S.XpEvents[I].Type + "/" + N(S.XpEvents[I].EnemyLevel) + "/" + N(S.XpEvents[I].CombatHeat); }
		return Out + "]";
	}
}
