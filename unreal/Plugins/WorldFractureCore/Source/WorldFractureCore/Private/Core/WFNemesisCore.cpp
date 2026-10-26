#include "Core/WFNemesisCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cstdint>
#include <map>

namespace wf::nemesis
{
	namespace
	{
		std::string NmN(double V) { return js::NumberToString(V); }
		bool NmHas(const std::vector<std::string>& Xs, const std::string& X) { return std::find(Xs.begin(), Xs.end(), X) != Xs.end(); }
		const char* const NmNames[16] = {"Krag", "Vesh", "Ultor", "Maro", "Sable", "Dregg", "Ister", "Koba", "Ravik", "Thane", "Oru", "Zell", "Brask", "Nyl", "Gorran", "Hask"};
		const char* const NmEpithets[12] = {"the Unbroken", "Bone-Saw", "the Patient", "Ash-Tongue", "the Collector", "Red Mile", "the Echo", "Iron Jaw", "Ninefold", "the Quiet", "Wire-Hand", "the Last Shot"};
		const char* const NmStrengths[4] = {"IRON_HIDE", "BRUTAL", "SURVIVOR", "VENGEFUL"};
		const char* const NmWeaknesses[3] = {"FIRE_SCARRED", "FROST_SCARRED", "ARC_SCARRED"};
		/** nemesis.ts hash: FNV-1a over `for (const ch of s)` charCodeAt(0) (each code point; above U+FFFF its high surrogate) */
		uint32_t NmHash(const std::string& S)
		{
			uint32_t H = 2166136261u;
			for (size_t I = 0; I < S.size();)
			{
				const unsigned char C = static_cast<unsigned char>(S[I]);
				uint32_t Cp = C;
				size_t Len = 1;
				if (C >= 0xF0 && I + 3 < S.size()) { Cp = ((C & 0x07u) << 18) | ((static_cast<unsigned char>(S[I + 1]) & 0x3Fu) << 12) | ((static_cast<unsigned char>(S[I + 2]) & 0x3Fu) << 6) | (static_cast<unsigned char>(S[I + 3]) & 0x3Fu); Len = 4; }
				else if (C >= 0xE0 && I + 2 < S.size()) { Cp = ((C & 0x0Fu) << 12) | ((static_cast<unsigned char>(S[I + 1]) & 0x3Fu) << 6) | (static_cast<unsigned char>(S[I + 2]) & 0x3Fu); Len = 3; }
				else if (C >= 0xC0 && I + 1 < S.size()) { Cp = ((C & 0x1Fu) << 6) | (static_cast<unsigned char>(S[I + 1]) & 0x3Fu); Len = 2; }
				H ^= Cp > 0xFFFF ? 0xD800u + ((Cp - 0x10000u) >> 10) : Cp;
				H *= 16777619u;
				I += Len;
			}
			return H;
		}
	}

	const std::vector<FTrait>& Traits()
	{
		static const std::vector<FTrait> Table{
			{"IRON_HIDE", "Iron Hide", "+40% health", "strength"},
			{"BRUTAL", "Brutal", "Hits 30% harder", "strength"},
			{"SURVIVOR", "Survivor", "Comes back once after you kill it", "strength"},
			{"VENGEFUL", "Vengeful", "Gains two ranks when it kills you", "strength"},
			{"FIRE_SCARRED", "Fire-scarred", "Takes double damage from thermal", "weakness"},
			{"FROST_SCARRED", "Frost-scarred", "Takes double damage from cryo", "weakness"},
			{"ARC_SCARRED", "Arc-scarred", "Takes double damage from arc", "weakness"},
		};
		return Table;
	}

	const FTrait* TraitById(const std::string& Id)
	{
		for (const FTrait& T : Traits()) if (T.Id == Id) return &T;
		return nullptr;
	}

	std::string WeakElement(const FNemesis& N)
	{
		for (const std::string& T : N.Traits)
		{
			if (T == "FIRE_SCARRED") return "THERMAL";
			if (T == "FROST_SCARRED") return "CRYO";
			if (T == "ARC_SCARRED") return "ARC";
		}
		return "";
	}

	bool CanPromote(const FKiller& K) { return !K.bBoss && !K.Profile.empty() && K.Profile != "Hostile"; }

	FListResult OnPlayerKilled(const std::vector<FNemesis>& List, const std::optional<FKiller>& Killer, const std::string& RegionName, double NowMs)
	{
		FListResult R;
		R.List = List;
		if (!Killer) return R;
		if (!Killer->Nemesis.empty())
		{
			auto It = std::find_if(R.List.begin(), R.List.end(), [&](const FNemesis& X) { return X.Id == Killer->Nemesis && X.Status == "ALIVE"; });
			if (It == R.List.end()) return R;
			const FNemesis N = *It;
			const double Up = NmHas(N.Traits, "VENGEFUL") ? 2 : 1;
			It->Rank = std::min(MaxRank, N.Rank + Up);
			It->Kills = N.Kills + 1;
			It->LastSeenAt = NowMs;
			It->Grudge = "Twice now" + (N.Kills > 0 ? ", " + NmN(N.Kills + 1) + " times" : std::string()) + ". " + RegionName + " is mine, Operator.";
			R.Line = N.Name + " " + N.Epithet + " grows stronger (rank " + NmN(It->Rank) + ")";
			return R;
		}
		if (!CanPromote(*Killer)) return R;
		if (std::count_if(R.List.begin(), R.List.end(), [](const FNemesis& X) { return X.Status == "ALIVE"; }) >= MaxAlive) return R;
		const uint32_t Seed = NmHash(Killer->Profile + "|" + Killer->Zone + "|" + NmN(NowMs));
		// names stay unique among nemeses you have met (alive or slain)
		uint32_t Ni = Seed % 16;
		for (int K = 0; K < 16 && std::any_of(R.List.begin(), R.List.end(), [&](const FNemesis& X) { return X.Name == NmNames[Ni]; }); ++K) Ni = (Ni + 1) % 16;
		FNemesis N;
		N.Name = NmNames[Ni];
		N.Epithet = NmEpithets[(Seed >> 8) % 12];
		N.Id = "nem-" + js::ToBase36(NowMs) + "-" + js::ToBase36(static_cast<double>(Seed % 1679616));
		N.Profile = Killer->Profile; N.RegionId = Killer->Zone;
		N.Rank = Killer->bElite ? 2 : 1;
		N.Traits = {NmStrengths[(Seed >> 4) % 4], NmWeaknesses[(Seed >> 12) % 3]};
		N.Kills = 1; N.Returns = 0; N.Status = "ALIVE"; N.CreatedAt = NowMs; N.LastSeenAt = NowMs;
		N.Grudge = "Remember me? " + RegionName + ". You went down hard.";
		R.List.push_back(N);
		R.Line = "A " + Killer->Profile + " who killed you has become a nemesis: " + N.Name + " " + N.Epithet;
		return R;
	}

	FKillResult OnNemesisKilled(const std::vector<FNemesis>& List, const std::string& Id, double NowMs)
	{
		FKillResult R;
		R.List = List;
		auto It = std::find_if(R.List.begin(), R.List.end(), [&](const FNemesis& X) { return X.Id == Id && X.Status == "ALIVE"; });
		if (It == R.List.end()) return R;
		const FNemesis N = *It;
		R.Slain = N;
		if (NmHas(N.Traits, "SURVIVOR") && N.Returns == 0)
		{
			It->Returns = 1;
			It->Rank = std::min(MaxRank, N.Rank + 1);
			It->Traits.erase(std::remove(It->Traits.begin(), It->Traits.end(), "SURVIVOR"), It->Traits.end());
			It->LastSeenAt = NowMs;
			It->Grudge = "You thought that was the end? Look at what you did to my face.";
			R.Line = N.Name + " " + N.Epithet + " crawled away. It will be back.";
			R.bReturned = true;
			return R;
		}
		It->Status = "SLAIN";
		It->LastSeenAt = NowMs;
		R.Line = N.Name + " " + N.Epithet + " is dead.";
		return R;
	}

	FStats NemesisStats(const FNemesis& N)
	{
		const double Hp = 8 * (1 + 0.6 * (N.Rank - 1)) * (NmHas(N.Traits, "IRON_HIDE") ? 1.4 : 1);
		return {Hp, (1 + 0.15 * (N.Rank - 1)) * (NmHas(N.Traits, "BRUTAL") ? 1.3 : 1), 1.5 + 0.12 * N.Rank};
	}

	double WeaknessMult(const FNemesis* N, const std::string& Element)
	{
		if (!N || Element.empty()) return 1;
		for (const std::string& T : N->Traits)
			if ((T == "FIRE_SCARRED" && Element == "THERMAL") || (T == "FROST_SCARRED" && Element == "CRYO") || (T == "ARC_SCARRED" && Element == "ARC")) return 2;
		return 1;
	}

	FReward NemesisReward(const FNemesis& N)
	{
		FReward R;
		R.Materials = {{"reinforcedAlloy", 2 * N.Rank}, {"dataShards", N.Rank}};
		if (N.Rank >= 3) R.Materials.push_back({"forgeCatalyst", 1});
		if (N.Rank >= 5) R.Materials.push_back({"fractureCore", 1});
		R.Shards = 40 * N.Rank;
		return R;
	}

	std::string RewardKey(const FNemesis& N, double Life) { return "nemesis:" + N.Id + ":" + NmN(Life); }

	const FNemesis* AmbushDue(const std::vector<FNemesis>& List, const std::string& RegionId, double SecondsInRegion, double SinceLastAmbush, const std::string& Summoned)
	{
		if (RegionId.empty()) return nullptr;
		std::vector<const FNemesis*> Here;
		for (const FNemesis& N : List) if (N.Status == "ALIVE" && N.RegionId == RegionId) Here.push_back(&N);
		std::stable_sort(Here.begin(), Here.end(), [](const FNemesis* A, const FNemesis* B) { return B->Rank < A->Rank; });
		if (!Summoned.empty())
			for (const FNemesis* N : Here) if (N->Id == Summoned) { if (SecondsInRegion > 4) return N; break; }
		if (Here.empty() || SecondsInRegion < AmbushAfter || SinceLastAmbush < AmbushCooldown) return nullptr;
		return Here.front();
	}

	std::vector<FNemesis> MergeNemeses(const std::vector<FNemesis>& A, const std::vector<FNemesis>& B)
	{
		std::vector<FNemesis> Out; // insertion order of first sighting, as a Map keeps
		for (const std::vector<FNemesis>* Src : {&A, &B})
			for (const FNemesis& N : *Src)
			{
				auto It = std::find_if(Out.begin(), Out.end(), [&](const FNemesis& X) { return X.Id == N.Id; });
				if (It == Out.end()) { Out.push_back(N); continue; }
				const FNemesis O = *It;
				FNemesis M = N.LastSeenAt >= O.LastSeenAt ? N : O;
				M.Status = O.Status == "SLAIN" || N.Status == "SLAIN" ? "SLAIN" : "ALIVE";
				M.Rank = std::max(O.Rank, N.Rank); M.Kills = std::max(O.Kills, N.Kills); M.Returns = std::max(O.Returns, N.Returns);
				*It = M;
			}
		return Out;
	}

	FApplied ApplyPlayerDeath(const FProgression& P, const FKiller& Killer, const std::string& RegionName, double NowMs)
	{
		const FListResult R = OnPlayerKilled(P.Nemeses, Killer, RegionName, NowMs);
		FApplied Out{P, R.Line};
		if (!R.Line.empty()) Out.Progression.Nemeses = R.List;
		return Out;
	}

	FApplied ApplyNemesisKill(const FProgression& P, const std::string& Id, double NowMs)
	{
		const auto Before = std::find_if(P.Nemeses.begin(), P.Nemeses.end(), [&](const FNemesis& X) { return X.Id == Id && X.Status == "ALIVE"; });
		if (Before == P.Nemeses.end()) return {P, ""};
		const FKillResult R = OnNemesisKilled(P.Nemeses, Id, NowMs);
		FApplied Out{P, R.Line};
		Out.Progression.Nemeses = R.List;
		const std::string Key = RewardKey(*Before, Before->Returns);
		if (NmHas(P.EarnedRewards, Key)) return Out;
		const FReward Pay = NemesisReward(*Before);
		std::string Paid;
		for (const auto& [K, V] : Pay.Materials)
		{
			Out.Progression.Materials[K] = (Out.Progression.Materials.count(K) ? Out.Progression.Materials[K] : 0) + V;
			if (!Paid.empty()) Paid += ", ";
			Paid += "+" + NmN(V) + " " + K;
		}
		Out.Progression.FractureShards += Pay.Shards;
		Out.Progression.EarnedRewards.push_back(Key);
		Out.Line = R.Line + " " + Paid + ", +" + NmN(Pay.Shards) + " shards";
		return Out;
	}
}
