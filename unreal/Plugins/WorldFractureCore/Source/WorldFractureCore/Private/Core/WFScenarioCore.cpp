// World Fracture — Unique Scenario rewards, encounter journal and Vyrak's Covenant. See WFScenarioCore.h.
#include "Core/WFScenarioCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>

namespace wf::scenario
{
	namespace
	{
		bool Has(const FProgression& P, const std::string& Key)
		{
			return std::find(P.EarnedRewards.begin(), P.EarnedRewards.end(), Key) != P.EarnedRewards.end();
		}

		void Add(FProgression& P, const std::string& Key)
		{
			if (!Has(P, Key)) P.EarnedRewards.push_back(Key);
		}

		std::string Lower(std::string S)
		{
			std::transform(S.begin(), S.end(), S.begin(), [](unsigned char C) { return static_cast<char>(std::tolower(C)); });
			return S;
		}

		/** scenario-loot.ts grantOne: new item, or level the owned copy, or shards at the cap. */
		void GrantOne(FProgression& P, const FGearItem& Template, std::vector<std::string>& Granted)
		{
			const auto Owned = std::find_if(P.Inventory.begin(), P.Inventory.end(), [&Template](const FGearItem& G) { return G.Id == Template.Id; });
			if (Owned == P.Inventory.end()) P.Inventory.push_back(Template);
			else if (Owned->Level < ArmorLevelMax)
			{
				Owned->Level += 1;
				Owned->Power += 15;
			}
			else P.FractureShards += DuplicateCapShards;
			Granted.push_back(Template.Id);
		}
	}

	FGrantResult GrantScenarioReward(const FCatalog& C, FProgression P, const FClaim& Claim)
	{
		FGrantResult R;
		const auto Table = C.Loot.find(Claim.ScenarioId);
		if (Table == C.Loot.end() || Claim.RunId.empty()) { R.Progression = std::move(P); R.Status = EGrantStatus::Invalid; return R; }
		const std::string Key = "scenario-run:" + Claim.RunId;
		if (Has(P, Key)) { R.Progression = std::move(P); R.Status = EGrantStatus::AlreadyClaimed; return R; }
		if (!Claim.bParticipated) { R.Progression = std::move(P); R.Status = EGrantStatus::Ineligible; return R; }
		P.EarnedRewards.push_back(Key);
		for (const FGearItem& Item : Table->second.Guaranteed) GrantOne(P, Item, R.ItemIds);
		for (size_t I = 0; I < Table->second.Chance.size(); ++I)
		{
			if (I >= Claim.Rolls.size()) continue;
			const double Roll = Claim.Rolls[I];
			if (Roll >= 0 && Roll < Table->second.Chance[I].Chance) GrantOne(P, Table->second.Chance[I].Item, R.ItemIds);
		}
		R.Progression = std::move(P);
		R.Status = EGrantStatus::Granted;
		return R;
	}

	FProgression RecordEncounterClear(const FCatalog& C, FProgression P, const std::optional<std::string>& Class, const std::string& EncounterId)
	{
		if (!Class || !C.IsUniqueScenario(EncounterId)) return P;
		Add(P, "enc-found:" + EncounterId);
		Add(P, "enc-done:" + *Class + ":" + EncounterId);
		return P;
	}

	std::vector<FGearItem> DragoniteGear(const std::string& Class)
	{
		static const std::pair<const char*, const char*> Slots[] = {{"helmet", "Crest"}, {"gauntlets", "Talons"}, {"chest", "Heartscale"}, {"legs", "Greaves"}, {"classItem", "Covenant Mantle"}};
		std::vector<FGearItem> Out;
		for (const auto& [Slot, Piece] : Slots)
		{
			FGearItem G;
			G.Id = std::string("dragonite-") + Slot + "-" + Lower(Class);
			G.Name = std::string("Dragonite ") + Piece;
			G.Slot = Slot;
			G.Power = 300;
			G.Level = 1;
			G.Element = "THERMAL";
			G.Rarity = "EXOTIC";
			G.SetId = "dragons-covenant";
			G.Source = "Vyrak's Covenant (" + Class + ")";
			Out.push_back(G);
		}
		return Out;
	}

	bool IsBonded(const FProgression& P, const std::optional<std::string>& Class)
	{
		return Class && Has(P, "covenant:vyrak:" + *Class);
	}

	FProgression ClaimCovenant(const FCatalog& C, FProgression P, const std::optional<std::string>& Class, bool& bOutBonded)
	{
		bOutBonded = false;
		if (!Class || IsBonded(P, Class)) return P;
		P.EarnedRewards.push_back("covenant:vyrak:" + *Class);
		for (const FGearItem& G : DragoniteGear(*Class))
			if (std::none_of(P.Inventory.begin(), P.Inventory.end(), [&G](const FGearItem& O) { return O.Id == G.Id; })) P.Inventory.push_back(G);
		P.Materials["dragonite"] += 5;
		const auto Ability = C.CovenantAbility.find(*Class);
		if (Ability != C.CovenantAbility.end() && std::find(P.UnlockedAbilities.begin(), P.UnlockedAbilities.end(), Ability->second) == P.UnlockedAbilities.end())
			P.UnlockedAbilities.push_back(Ability->second);
		bOutBonded = true;
		return P;
	}

	std::vector<std::string> ChallengesMet(const FClaim& Claim)
	{
		std::vector<std::string> Out;
		if (Claim.Deaths && *Claim.Deaths == 0) Out.emplace_back("unbroken-covenant");
		if (Claim.Elapsed && *Claim.Elapsed <= WingsSeconds) Out.emplace_back("wings-of-the-ancient");
		return Out;
	}

	double ClearCount(const FProgression& P, const std::string& Class)
	{
		const std::string Prefix = "covenant-clear:" + Class + ":";
		return static_cast<double>(std::count_if(P.EarnedRewards.begin(), P.EarnedRewards.end(), [&Prefix](const std::string& K) { return K.rfind(Prefix, 0) == 0; }));
	}

	FProgression RecordVyrakClear(const FCatalog& C, FProgression P, const std::optional<std::string>& Class, const std::string& RunId, const std::vector<std::string>& Challenges)
	{
		if (!Class) return P;
		const std::string Done = "covenant-run:" + *Class + ":" + RunId;
		if (Has(P, Done)) return P;
		P.EarnedRewards.push_back(Done);
		bool bBonded = false;
		P = ClaimCovenant(C, std::move(P), Class, bBonded);
		if (!bBonded)
		{
			P.Materials["dragonite"] += 3;
			const double Clears = ClearCount(P, *Class) + 1;
			if (std::fmod(Clears, 2) == 0)
			{
				static const char* Slots[] = {"helmet", "chest", "gauntlets", "legs", "classItem"};
				const std::string Slot = Slots[static_cast<size_t>(std::fmod(Clears / 2 - 1, 5))];
				for (const FGearItem& Base : DragoniteGear(*Class))
					if (Base.Slot == Slot)
					{
						FGearItem Extra = Base;
						Extra.Id = Base.Id + "-r" + js::NumberToString(Clears);
						Extra.Name = Base.Name + " (Rolled)";
						Extra.Power = Base.Power + std::min(20.0, Clears * 2);
						P.Inventory.push_back(Extra);
						break;
					}
			}
		}
		P.EarnedRewards.push_back("covenant-clear:" + *Class + ":" + js::NumberToString(ClearCount(P, *Class) + 1));
		static const std::vector<std::string> Known = {"unbroken-covenant", "wings-of-the-ancient", "dragons-patience"};
		for (const std::string& Challenge : Challenges)
		{
			const std::string Key = "covenant-challenge:" + *Class + ":" + Challenge;
			if (Has(P, Key) || std::find(Known.begin(), Known.end(), Challenge) == Known.end()) continue;
			P.EarnedRewards.push_back(Key);
		}
		return P;
	}

	std::string DayKeyUtc(double NowMs)
	{
		// civil-from-days (Howard Hinnant's algorithm): the date of a UTC day number
		const long long Days = static_cast<long long>(std::floor(NowMs / 86400000.0));
		const long long Z = Days + 719468;
		const long long Era = (Z >= 0 ? Z : Z - 146096) / 146097;
		const long long Doe = Z - Era * 146097;
		const long long Yoe = (Doe - Doe / 1460 + Doe / 36524 - Doe / 146096) / 365;
		const long long Doy = Doe - (365 * Yoe + Yoe / 4 - Yoe / 100);
		const long long Mp = (5 * Doy + 2) / 153;
		const long long Day = Doy - (153 * Mp + 2) / 5 + 1;
		const long long Month = Mp < 10 ? Mp + 3 : Mp - 9;
		const long long Year = Yoe + Era * 400 + (Month <= 2 ? 1 : 0);
		char Buffer[64];
		std::snprintf(Buffer, sizeof(Buffer), "%04lld-%02lld-%02lld", Year, Month, Day);
		return Buffer;
	}

	FProgression MarkCompleted(FProgression P, const std::string& ActivityId, double NowMs)
	{
		const std::string Key = "act:" + ActivityId;
		const auto Found = P.MissionRuns.find(Key);
		FProgression::FRunRecord Record;
		Record.Day = Found != P.MissionRuns.end() ? Found->second.Day : DayKeyUtc(NowMs);
		Record.Count = Found != P.MissionRuns.end() ? Found->second.Count : 0;
		Record.Last = NowMs;
		P.MissionRuns[Key] = Record;
		return P;
	}

	FProgression ClaimScenario(const FCatalog& C, FProgression P, const FClaim& Claim, double NowMs)
	{
		const std::optional<std::string> Class = P.IdentityClass; // copied: P is moved into each step below
		P = GrantScenarioReward(C, std::move(P), Claim).Progression;
		if (Claim.bParticipated) P = RecordEncounterClear(C, std::move(P), Class, Claim.ScenarioId);
		if (Claim.ScenarioId == "vyrak" && Claim.bParticipated)
			P = MarkCompleted(RecordVyrakClear(C, std::move(P), Class, Claim.RunId, ChallengesMet(Claim)), "vyrak-rematch", NowMs);
		return P;
	}
}
