// World Fracture — mission payouts. See WFMissionRewardCore.h.
#include "Core/WFMissionRewardCore.h"

#include "Core/WFJsCompat.h"
#include "Core/WFScenarioCore.h"

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace wf::missionreward
{
	namespace
	{
		bool MissionRewardContains(const std::vector<std::string>& Items, const std::string& Item)
		{
			return std::find(Items.begin(), Items.end(), Item) != Items.end();
		}

		/** armor-collections.ts hash: h = (h * 31 + charCode) >>> 0, seeded with 17. */
		uint32_t CollectionHash(const std::string& S)
		{
			uint64_t H = 17;
			for (const unsigned char Ch : S) H = (H * 31 + Ch) & 0xffffffffull;
			return static_cast<uint32_t>(H);
		}

		/** progression.ts missionBox: fresher clears crack better boxes. */
		void MissionBox(bool bFirstClear, double Factor, std::string& OutRarity, std::map<std::string, double>& OutMaterials)
		{
			if (bFirstClear) { OutRarity = "EPIC"; OutMaterials = {{"scrapMetal", 8}, {"dataShards", 2}, {"dataChip", 3}, {"relicFragment", 1}}; }
			else if (Factor >= 1) { OutRarity = "RARE"; OutMaterials = {{"scrapMetal", 5}, {"dataShards", 1}, {"dataChip", 2}}; }
			else { OutRarity = "COMMON"; OutMaterials = {{"scrapMetal", 2}, {"dataChip", 1}}; }
		}

		std::string MissionRewardNum(double V) { return js::NumberToString(V); }

		std::string MissionRewardMap(const std::map<std::string, double>& M)
		{
			std::string Out = "{";
			bool bFirst = true;
			for (const auto& [K, V] : M) { if (!bFirst) Out += ","; bFirst = false; Out += K + ":" + MissionRewardNum(V); }
			return Out + "}";
		}
	}

	bool IsSideContract(const std::string& MissionId) { return MissionId.rfind("side-", 0) == 0; }

	double RepeatRewardFactor(double RunsToday, bool bFirstEver)
	{
		if (bFirstEver) return 1.5;
		if (RunsToday < 10) return 1;
		return std::max(0.25, 1 - (RunsToday - 9) * 0.15);
	}

	double SideRewardFactor(double RunsToday, bool bFirstEver)
	{
		if (bFirstEver) return 0.5;
		return RunsToday < 3 ? 0.25 : 0.05;
	}

	double MissionWeaponPower(const FCatalog& C, const std::string& MissionId)
	{
		const auto Found = std::find(C.Campaign.begin(), C.Campaign.end(), MissionId);
		return Found == C.Campaign.end() ? 190 : 140 + 17 * static_cast<double>(Found - C.Campaign.begin());
	}

	FGearItem CompletionWeapon(const FCatalog& C, const std::string& Source, const std::string& Key)
	{
		FGearItem Item;
		if (C.CompletionPool.empty()) return Item;
		const reward::FWeaponTemplate& Pick = C.CompletionPool[js::Fnv1a(Source + ":" + Key) % C.CompletionPool.size()];
		Item.Id = "reward-weapon:" + Source + ":" + Key;
		Item.Name = Pick.Name;
		Item.Slot = Pick.Slot;
		Item.Power = Source == "mission" ? MissionWeaponPower(C, Key) : 260;
		Item.Level = 1;
		Item.Element = Pick.Element;
		Item.Source = Source == "dungeon" ? "Dungeon clear reward" : "Mission reward";
		return Item;
	}

	std::optional<FGearItem> CampaignExotic(const FCatalog& C, const std::string& MissionId)
	{
		const auto Found = C.CampaignExotics.find(MissionId);
		if (Found == C.CampaignExotics.end()) return std::nullopt;
		const FExotic& W = Found->second;
		FGearItem Item;
		Item.Id = "exotic:" + W.WeaponId;
		Item.Name = W.Name;
		Item.Slot = W.Slot;
		Item.Power = MissionWeaponPower(C, MissionId) + 20;
		Item.Level = 1;
		Item.Element = W.Element;
		Item.Source = "Exotic \xC2\xB7 " + W.Source;
		Item.Rarity = "EXOTIC";
		return Item;
	}

	std::optional<reward::FSetDrop> CollectionReward(const FCatalog& C, const std::string& Activity, const std::string& Key, double Run, bool bFirstClear)
	{
		if (!bFirstClear && std::fmod(Run, PityRuns) != 0) return std::nullopt;
		std::vector<const FCollection*> Pool;
		for (const FCollection& Col : C.Collections)
			if (MissionRewardContains(Col.Sources, Activity)) Pool.push_back(&Col);
		if (Pool.empty()) return std::nullopt;
		const uint32_t H = CollectionHash(Key + ":" + js::NumberToString(Run));
		static const char* Slots[] = {"helmet", "gauntlets", "chest", "legs", "classItem"};
		return reward::FSetDrop{Pool[H % Pool.size()]->SetId, Slots[(H >> 8) % 5]};
	}

	FProgression RewardMission(const reward::FCatalog& Rewards, const FCatalog& C, FProgression P, const std::string& MissionId, const std::map<std::string, double>& Materials, double NowMs)
	{
		const bool bFirstClear = !MissionRewardContains(P.CompletedMissions, MissionId);
		const bool bSide = IsSideContract(MissionId);
		const std::string Day = scenario::DayKeyUtc(NowMs);
		const auto Prev = P.MissionRuns.find(MissionId);
		const double RunsToday = Prev != P.MissionRuns.end() && Prev->second.Day == Day ? Prev->second.Count : 0;
		const double Factor = bSide ? SideRewardFactor(RunsToday, bFirstClear) : RepeatRewardFactor(RunsToday, bFirstClear);

		reward::FGrantXpResult Xp = reward::GrantXP(std::move(P), "MISSION", std::nullopt, std::nullopt, std::nullopt, Factor);
		P = std::move(Xp.Progression);

		FProgression::FMissionReward Reward;
		Reward.MissionId = MissionId;
		Reward.Factor = Factor;
		Reward.bFirstClear = bFirstClear;
		Reward.Xp = Xp.Gained;
		for (const auto& [Id, Amount] : Materials)
		{
			const double Paid = std::max(1.0, js::Round(Amount * Factor));
			Reward.Materials[Id] = Paid;
			P.Materials[Id] += Paid;
		}
		// first clear only: the upgrade material (upgrade-gates.ts FIRST_CLEAR_SPECIAL)
		if (bFirstClear)
		{
			if (bSide) P.Materials["tuningCore"] += 1;
			else if (MissionId != "mission-01") P.Materials["forgeCatalyst"] += 1;
		}
		MissionBox(bFirstClear, Factor, Reward.BoxRarity, Reward.BoxMaterials);
		for (const auto& [Id, Amount] : Reward.BoxMaterials) P.Materials[Id] += Amount;

		if (bFirstClear && !bSide && MissionId != "mission-01")
		{
			const FGearItem Weapon = CompletionWeapon(C, "mission", MissionId);
			if (std::none_of(P.Inventory.begin(), P.Inventory.end(), [&Weapon](const FGearItem& G) { return G.Id == Weapon.Id; })) P.Inventory.push_back(Weapon);
		}
		if (bFirstClear) P.CompletedMissions.push_back(MissionId);
		// campaign exotics: this mission's on its first clear, plus any earlier clear's that is missing
		for (const std::string& Done : P.CompletedMissions)
			if (std::optional<FGearItem> Exotic = CampaignExotic(C, Done))
				if (std::none_of(P.Inventory.begin(), P.Inventory.end(), [&Exotic](const FGearItem& G) { return G.Id == Exotic->Id; })) P.Inventory.push_back(*Exotic);
		// armor collections: first clear always, repeats every PITY_RUNS-th run
		if (std::optional<reward::FSetDrop> Drop = CollectionReward(C, bSide ? "patrol" : "story", MissionId, RunsToday + 1, bFirstClear))
			P = reward::GrantSetPiece(Rewards, std::move(P), *Drop);

		const bool bStory = MissionRewardContains(C.StoryMissions, MissionId);
		P.NexLedger["mission:" + MissionId + ":" + Day + ":" + js::NumberToString(RunsToday + 1)] = js::Round((bStory ? StoryNex : OtherNex) * Factor);
		FProgression::FRunRecord Run;
		Run.Day = Day;
		Run.Count = RunsToday + 1;
		P.MissionRuns[MissionId] = Run;
		P.LastMissionReward = Reward;
		return P;
	}

	FCompletionResult ApplyMissionCompletion(const reward::FCatalog& Rewards, const FCatalog& C, FProgression P, const std::string& MissionId, double NowMs)
	{
		FCompletionResult R;
		const auto Found = C.Completions.find(MissionId);
		if (MissionRewardContains(P.CompletedMissions, MissionId) || Found == C.Completions.end())
		{
			R.Progression = std::move(P);
			return R;
		}
		R.Progression = RewardMission(Rewards, C, std::move(P), MissionId, Found->second.Materials, NowMs);
		R.bPaid = true;
		R.QuestEvent = Found->second;
		return R;
	}

	std::string Describe(const FProgression& P)
	{
		std::string Out = reward::DescribeLoot(P) + ";completed=[";
		for (size_t I = 0; I < P.CompletedMissions.size(); ++I) { if (I) Out += ","; Out += P.CompletedMissions[I]; }
		Out += "];nex=" + MissionRewardMap(P.NexLedger) + ";last=";
		if (!P.LastMissionReward) return Out + "~";
		const FProgression::FMissionReward& L = *P.LastMissionReward;
		return Out + L.MissionId + "/" + MissionRewardNum(L.Factor) + "/" + (L.bFirstClear ? "1" : "0") + "/" + MissionRewardNum(L.Xp) + "/" + MissionRewardMap(L.Materials) + "/" + L.BoxRarity + "/" + MissionRewardMap(L.BoxMaterials);
	}
}
