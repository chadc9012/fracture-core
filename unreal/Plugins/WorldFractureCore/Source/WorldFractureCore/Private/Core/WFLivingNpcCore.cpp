#include "Core/WFLivingNpcCore.h"

#include "Core/WFJsCompat.h"
#include "Core/WFRewardCore.h"
#include "Core/WFShopCore.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdint>

namespace wf::living
{
	namespace
	{
		struct FLvDistrict { std::string Id, City, Name; };
		const std::vector<FLvDistrict>& LvDistricts()
		{
			static const std::vector<FLvDistrict> All{
			{"nexus:spire", "nexus", "Spire District"},
			{"nexus:market", "nexus", "Market District"},
			{"nexus:shipyard", "nexus", "Shipyard"},
			{"nexus:arcology", "nexus", "Arcology"},
			{"neon:spire", "neon", "Aegis Spire"},
			{"neon:undercity", "neon", "Undercity"},
			{"neon:market", "neon", "Neon Market"},
			{"neon:grid", "neon", "The Grid"}
			};
			return All;
		}
		std::string LvFactionCity(const std::string& Faction)
		{
			static const std::vector<std::pair<std::string, std::string>> All{
			{"wardens", "nexus"},
			{"guild", "nexus"},
			{"syndicate", "neon"},
			{"aegis", "neon"}
			};
			for (const auto& [F, C] : All) if (F == Faction) return C;
			return "";
		}
		std::string LvFactionName(const std::string& Faction) { const shop::FFaction* F = shop::FactionById(Faction); return F ? F->Name : Faction; }
		std::string LvN(double V) { return js::NumberToString(V); }
		double LvHave(const FProgression& P, const std::string& M) { const auto It = P.Materials.find(M); return It == P.Materials.end() ? 0 : It->second; }
		std::string LvTier(const FProgression& P, const std::string& Faction) { return shop::RepTier(shop::RepOf(P.Living, Faction)); }
		/** living-npcs.ts matLabel: +3 reinforced alloy, +2 micro circuits */
		std::string LvMatLabel(const std::vector<std::pair<std::string, double>>& M)
		{
			std::string Out;
			for (const auto& [K, V] : M)
			{
				std::string Spoken;
				for (char C : K) { if (std::isupper(static_cast<unsigned char>(C))) { Spoken += ' '; Spoken += static_cast<char>(std::tolower(static_cast<unsigned char>(C))); } else Spoken += C; }
				Out += (Out.empty() ? "" : ", ") + std::string("+") + LvN(V) + " " + Spoken;
			}
			return Out;
		}
		void LvAddMaterials(FProgression& P, const std::vector<std::pair<std::string, double>>& Add) { for (const auto& [K, V] : Add) P.Materials[K] = LvHave(P, K) + V; }
		std::string LvDoneKey(const std::string& Id) { return "living:contract:" + Id; }
		std::string LvStashKey(const std::string& Id) { return "living:stash:" + Id; }
		bool LvHas(const std::vector<std::string>& Xs, const std::string& X) { return std::find(Xs.begin(), Xs.end(), X) != Xs.end(); }
		const FIntel* LvIntelById(const std::string& Id) { for (const FIntel& I : Intel()) if (I.Id == Id) return &I; return nullptr; }
		std::string LvLower(std::string S) { for (char& C : S) C = static_cast<char>(std::tolower(static_cast<unsigned char>(C))); return S; }
		void LvBump(FProgression& P, bool (*Match)(const FContract&, const std::string&), const std::string& City, double By)
		{
			for (auto& [Id, Run] : P.Living.Contracts)
			{
				const FContract* C = ContractById(Id);
				if (!C || !Match(*C, City) || Run.Progress >= C->Amount) continue;
				Run.Progress = std::min(C->Amount, Run.Progress + By);
			}
		}
	}

	const std::vector<FCity>& Cities()
	{
		static const std::vector<FCity> All{
			{"nexus", "Nexus City", 62.400000000000006, -296.4, 95},
			{"neon", "Neon City", -273.35298563379115, -198.4140222378975, 62}
		};
		return All;
	}
	const FCity* CityById(const std::string& Id) { for (const FCity& C : Cities()) if (C.Id == Id) return &C; return nullptr; }
	std::string CityAt(double X, double Z)
	{
		for (const char* Id : {"neon", "nexus"})
			if (const FCity* C = CityById(Id); C && js::Hypot(X - C->X, Z - C->Z) <= C->Radius) return C->Id;
		return "";
	}

	const std::vector<FNpc>& Npcs()
	{
		static const std::vector<FNpc> All{
			{"hale", "Commander Hale", "Warden Commander", "nexus", "wardens", "LEADER", 7.4, -4.3, "OBSERVER", {"You've drawn Warden fire in my city. Pay for the damage or get out.", "I'm watching you, Operator. Earn your place.", "Nexus holds because people hold the line. Can you?", "Good to see you, Operator. The perimeter's quieter with you on it.", "Warden-friend. Nexus owes you, and I don't forget debts."}},
			{"vos", "Sergeant Vos", "Warden Quartermaster", "nexus", "wardens", "QUEST", -8.2, 2.2, "ENGINEER", {"Nothing for you here.", "Work's work. Don't make me regret it.", "Outer districts need clearing. Interested?", "Got a bigger job if you've got the nerve.", "Pick any board you like, Operator."}},
			{"ines", "Ines Varo", "Guild Mistress", "nexus", "guild", "LEADER", 5.7, 21.2, "ARTISAN", {"The Guild doesn't deal with vandals.", "Trade's slow when people shoot near my stalls.", "Every bolt in this city passed through a Guild hand.", "Our smiths like your work. So do I.", "Name what you need. The Guild will find it."}},
			{"whisper", "Whisper", "Information Broker", "nexus", "guild", "INFORMANT", -11.3, -11.3, "SCAVENGER", {"...", "Information has a price. Yours just went up.", "Everything in Nexus leaves a trace. I sell the traces.", "I kept something back for you.", "For you? The good stuff."}},
			{"kiro", "Madame Kiro", "Syndicate Boss", "neon", "syndicate", "LEADER", -20, 7, "VENDOR", {"My people have your face. Leave while you still can.", "You smell like the Spire. Prove me wrong.", "The Undercity runs on favours. What's yours?", "The street knows your name now. Good things only.", "Family. Sit. Nobody touches you down here."}},
			{"patch", "Patch", "Syndicate Fixer", "neon", "syndicate", "QUEST", 4, 10, "ENGINEER", {"Walk on.", "Small jobs only, until I trust you.", "Got work that pays and doesn't ask questions.", "Kiro says you're solid. I've got a real job.", "Anything on the board is yours."}},
			{"thorne", "Director Thorne", "Aegis Director", "neon", "aegis", "LEADER", 6, -30, "MEDIC", {"You are flagged at every checkpoint in this city.", "The Directorate tolerates you. For now.", "Order is a service, Operator. Someone has to provide it.", "Your record is clean and useful. I appreciate both.", "The Spire is open to you. Few can say that."}},
			{"static", "Static", "Grid Informant", "neon", "aegis", "INFORMANT", -6, 24, "OBSERVER", {"Connection refused.", "Paying customers only.", "I hear everything the Grid carries. Want some of it?", "Clean signal for a clean customer.", "Priority channel's open for you."}},
			{"moreau", "Lt. Moreau", "Checkpoint Officer", "neon", "aegis", "QUEST", -7, -31, "OBSERVER", {"Halt. You're not cleared.", "Contractor work only. Keep your weapon low.", "The checkpoint needs hands. Directorate pays on time.", "I can put you on the priority roster.", "Whatever you need, Operator."}}
		};
		return All;
	}
	const FNpc* NpcById(const std::string& Id) { for (const FNpc& N : Npcs()) if (N.Id == Id) return &N; return nullptr; }

	bool OnDuty(std::optional<double> Hour)
	{
		if (!Hour || !std::isfinite(*Hour)) return true;
		const double H = std::fmod(std::fmod(*Hour, 24) + 24, 24);
		return !(H >= OffDutyFrom || H < OffDutyTo);
	}
	FPoint RestSpot(const FNpc& Npc)
	{
		const double D = js::Hypot(Npc.Lx, Npc.Lz);
		const uint32_t H = js::Fnv1a(Npc.Id);
		const double Ux = D > 1 ? -Npc.Lx / D : std::cos(static_cast<double>(H % 628u) / 100), Uz = D > 1 ? -Npc.Lz / D : std::sin(static_cast<double>(H % 628u) / 100);
		const double Toward = std::min(RestDistance, D > 1 ? D : RestDistance);
		const double Side = static_cast<double>((static_cast<int32_t>(H) >> 8) % 5) - 2; // JS h >> 8 is a signed shift
		return {Npc.Lx + Ux * Toward + -Uz * Side, Npc.Lz + Uz * Toward + Ux * Side};
	}
	FPoint NpcPosition(const FNpc& Npc, std::optional<double> Hour)
	{
		const FCity* C = CityById(Npc.City);
		const FPoint L = OnDuty(Hour) ? FPoint{Npc.Lx, Npc.Lz} : RestSpot(Npc);
		return {(C ? C->X : 0) + L.X, (C ? C->Z : 0) + L.Z};
	}
	const FNpc* NpcNear(double X, double Z, std::optional<double> Hour)
	{
		const FNpc* Best = nullptr;
		double BestD = TalkReach;
		for (const FNpc& N : Npcs())
		{
			const FPoint P = NpcPosition(N, Hour);
			const double D = js::Hypot(X - P.X, Z - P.Z);
			if (D < BestD) { BestD = D; Best = &N; }
		}
		return Best;
	}

	const std::vector<FContract>& Contracts()
	{
		static const std::vector<FContract> All{
			{"perimeter-sweep", "vos", "wardens", "nexus", "CULL", "Perimeter Sweep", "Put down 8 hostiles inside Nexus City's districts.", 8, "", std::nullopt, std::nullopt, "WARY", 12, {{"reinforcedAlloy", 4}}, 1},
			{"hold-the-line", "vos", "wardens", "nexus", "DEFEND", "Hold the Line", "Win 2 Nexus City world events (invasions, distress calls, raids).", 2, "", std::nullopt, std::nullopt, "TRUSTED", 18, {{"microCircuits", 6}, {"aegisCore", 1}}, 2},
			{"salvage-drive", "ines", "guild", "nexus", "DELIVER", "Salvage Drive", "Hand in 12 Scrap Metal for the Guild workshops.", 12, "scrapMetal", std::nullopt, std::nullopt, "WARY", 10, {{"microCircuits", 5}}, 1},
			{"shipyard-survey", "ines", "guild", "nexus", "SURVEY", "Shipyard Survey", "Walk the Shipyard's south gate and log the damage.", 1, "", 0, 82, "NEUTRAL", 8, {{"dataShards", 3}}, 1},
			{"street-tax", "patch", "syndicate", "neon", "CULL", "Street Tax", "Clear 6 hostiles off Neon City's streets. The Syndicate collects.", 6, "", std::nullopt, std::nullopt, "WARY", 12, {{"microCircuits", 6}}, 1},
			{"dead-drop", "patch", "syndicate", "neon", "SURVEY", "Dead Drop", "Check the dead drop at the east end of the cross street.", 1, "", 37, 7, "NEUTRAL", 8, {{"dataShards", 4}}, 1},
			{"checkpoint-sweep", "moreau", "aegis", "neon", "CULL", "Checkpoint Sweep", "Neutralize 6 hostiles inside Neon City.", 6, "", std::nullopt, std::nullopt, "WARY", 12, {{"reinforcedAlloy", 4}}, 1},
			{"grid-requisition", "moreau", "aegis", "neon", "DELIVER", "Grid Requisition", "Requisition 8 Micro-Circuits for the Grid relays.", 8, "microCircuits", std::nullopt, std::nullopt, "NEUTRAL", 12, {{"dataShards", 5}}, 1},
			{"spire-defense", "moreau", "aegis", "neon", "DEFEND", "Spire Defense", "Win 2 Neon City world events.", 2, "", std::nullopt, std::nullopt, "TRUSTED", 18, {{"aegisCore", 1}, {"microCircuits", 6}}, 2}
		};
		return All;
	}
	const FContract* ContractById(const std::string& Id) { for (const FContract& C : Contracts()) if (C.Id == Id) return &C; return nullptr; }
	std::optional<FPoint> ContractPoint(const FContract& C)
	{
		const FCity* City = CityById(C.City);
		if (!C.Lx || !C.Lz || !City) return std::nullopt;
		return FPoint{City->X + *C.Lx, City->Z + *C.Lz};
	}
	bool ContractDone(const FProgression& P, const std::string& Id) { return LvHas(P.EarnedRewards, LvDoneKey(Id)); }

	const std::vector<FIntel>& Intel()
	{
		static const std::vector<FIntel> All{
			{"nexus-arcology-cache", "whisper", "nexus", "The Arcology Cache", "A Warden quartermaster hid a crate behind the Arcology blocks before the Fracture. Nobody went back for it.", "scrapMetal", 15, -75, -10, {{"reinforcedAlloy", 6}, {"microCircuits", 4}}, 40},
			{"nexus-spire-signal", "whisper", "nexus", "The Spire Signal", "Something under the Spire District keeps pinging an old Vanguard frequency. Someone left a beacon and a stash with it.", "microCircuits", 6, 12, -84, {{"dataShards", 5}, {"tuningCore", 1}}, 60},
			{"neon-grid-stash", "static", "neon", "Grid Maintenance Stash", "A Grid tech skimmed parts for years. The stash sits under the north-east pillars.", "microCircuits", 5, 34, 28, {{"microCircuits", 8}, {"vehicleParts", 3}}, 40},
			{"neon-undercity-vault", "static", "neon", "Undercity Vault", "The Syndicate moved a vault into the west alleys. The Directorate would love to know. You'd love to get there first.", "dataShards", 4, -34, 22, {{"dataShards", 6}, {"tuningCore", 1}}, 80}
		};
		return All;
	}
	FPoint IntelPoint(const FIntel& I)
	{
		const FCity* C = CityById(I.City);
		return {(C ? C->X : 0) + I.Lx, (C ? C->Z : 0) + I.Lz};
	}

	std::vector<FAction> NpcActions(const FProgression& P, const FNpc& Npc)
	{
		std::vector<FAction> Out;
		const std::string Tier = LvTier(P, Npc.Faction);
		if (Tier == "HOSTILE")
		{
			Out.push_back({"amends:" + Npc.Faction, "Make amends", "Pay 20 scrap metal for the damage (+30 standing)", LvHave(P, "scrapMetal") >= 20, "Needs 20 scrap metal"});
			return Out;
		}
		if (Npc.Role == "QUEST" || Npc.Role == "LEADER")
			for (const FContract& C : Contracts())
			{
				if (C.Giver != Npc.Id || ContractDone(P, C.Id)) continue;
				const auto Active = P.Living.Contracts.find(C.Id);
				if (Active != P.Living.Contracts.end())
				{
					const bool bReady = C.Kind == "DELIVER" ? LvHave(P, C.Material) >= C.Amount : Active->second.Progress >= C.Amount;
					const std::string Detail = C.Kind == "DELIVER" ? "Hand over " + LvN(C.Amount) + " " + C.Material + " (you have " + LvN(LvHave(P, C.Material)) + ")"
						: LvN(std::min(Active->second.Progress, C.Amount)) + "/" + LvN(C.Amount) + " · " + LvMatLabel(C.RewardMaterials);
					Out.push_back({"turnin:" + C.Id, "Turn in: " + C.Title, Detail, bReady, "Not finished yet"});
				}
				else
				{
					const bool bTierOk = shop::TierAtLeast(Tier, C.MinTier);
					const bool bSlots = static_cast<int>(P.Living.Contracts.size()) < MaxActiveContracts;
					Out.push_back({"accept:" + C.Id, "Contract: " + C.Title, C.Brief + " Reward: +" + LvN(C.RewardRep) + " standing, " + LvMatLabel(C.RewardMaterials), bTierOk && bSlots,
						!bTierOk ? "Requires " + LvLower(C.MinTier) + " standing" : "You already hold " + LvN(MaxActiveContracts) + " contracts"});
				}
			}
		if (Npc.Role == "INFORMANT")
			for (const FIntel& I : Intel())
			{
				if (I.Seller != Npc.Id || LvHas(P.Living.Intel, I.Id)) continue;
				const double Discount = shop::TierAtLeast(Tier, "TRUSTED") ? 0.5 : 1;
				const double Cost = std::ceil(I.CostAmount * Discount);
				Out.push_back({"intel:" + I.Id, "Buy intel: " + I.Title, LvN(Cost) + " " + I.CostMaterial + (Discount < 1 ? " (trusted price)" : ""), LvHave(P, I.CostMaterial) >= Cost, "Needs " + LvN(Cost) + " " + I.CostMaterial});
			}
		if (Npc.Role == "LEADER" && Npc.City == "neon" && !P.Story.Choices.count(PledgeKey))
		{
			const shop::FFaction* F = shop::FactionById(Npc.Faction);
			Out.push_back({"pledge:" + Npc.Faction, "Pledge to the " + LvFactionName(Npc.Faction), "+20 with them, −25 with the " + LvFactionName(F ? F->Rival : "") + ". Permanent.", shop::TierAtLeast(Tier, "TRUSTED"), "Requires trusted standing"});
		}
		if (Npc.Role == "LEADER" && !LvHas(P.EarnedRewards, "living:commend:" + Npc.Faction))
			Out.push_back({"commend:" + Npc.Faction, "Ask for a commendation", "A one-time reward for honored allies", shop::TierAtLeast(Tier, "HONORED"), "Requires honored standing"});
		return Out;
	}

	FResult PerformNpcAction(FProgression& P, const std::string& NpcId, const std::string& ActionId, double NowMs)
	{
		const FNpc* Npc = NpcById(NpcId);
		if (!Npc) return {false, "Nobody here"};
		const std::vector<FAction> Offered = NpcActions(P, *Npc);
		const auto It = std::find_if(Offered.begin(), Offered.end(), [&](const FAction& A) { return A.Id == ActionId; });
		if (It == Offered.end()) return {false, "Not available"};
		if (!It->bEnabled) return {false, It->Reason.empty() ? std::string("Locked") : It->Reason};
		const size_t Colon = ActionId.find(':');
		const std::string Kind = ActionId.substr(0, Colon), Arg = Colon == std::string::npos ? "" : ActionId.substr(Colon + 1);
		if (Kind == "amends")
		{
			P.Materials["scrapMetal"] = LvHave(P, "scrapMetal") - 20;
			shop::AdjustRep(P.Living, Arg, 30, false);
			return {true, LvFactionName(Arg) + " accept your payment"};
		}
		if (Kind == "accept")
		{
			const FContract* C = ContractById(Arg);
			P.Living.Contracts[C->Id] = {0, NowMs};
			return {true, "Contract accepted: " + C->Title};
		}
		if (Kind == "turnin")
		{
			const FContract* C = ContractById(Arg);
			if (C->Kind == "DELIVER") P.Materials[C->Material] = LvHave(P, C->Material) - C->Amount;
			P.Living.Contracts.erase(C->Id);
			shop::AdjustRep(P.Living, C->Faction, C->RewardRep);
			LvAddMaterials(P, C->RewardMaterials);
			P.EarnedRewards.push_back(LvDoneKey(C->Id));
			P = reward::GrantXP(std::move(P), "OBJECTIVE", std::nullopt, std::nullopt, std::nullopt, C->RewardXp).Progression;
			return {true, C->Title + " complete · +" + LvN(C->RewardRep) + " " + LvFactionName(C->Faction) + " · " + LvMatLabel(C->RewardMaterials)};
		}
		if (Kind == "intel")
		{
			const FIntel* I = LvIntelById(Arg);
			const double Cost = std::ceil(I->CostAmount * (shop::TierAtLeast(LvTier(P, Npc->Faction), "TRUSTED") ? 0.5 : 1));
			P.Materials[I->CostMaterial] = LvHave(P, I->CostMaterial) - Cost;
			P.Living.Intel.push_back(I->Id);
			shop::AdjustRep(P.Living, Npc->Faction, 3, false);
			return {true, "Intel: " + I->Title + ". Marked on your compass."};
		}
		if (Kind == "pledge")
		{
			const shop::FFaction* F = shop::FactionById(Arg);
			shop::AdjustRep(P.Living, Arg, 20, false);
			if (F && !F->Rival.empty()) shop::AdjustRep(P.Living, F->Rival, -25, false);
			P.Story.Choices[PledgeKey] = Arg;
			if (!LvHas(P.Story.Flags, "living:pledged:" + Arg)) P.Story.Flags.push_back("living:pledged:" + Arg);
			return {true, "You stand with the " + LvFactionName(Arg)};
		}
		if (Kind == "commend")
		{
			const std::vector<std::pair<std::string, double>> Reward = Arg == "wardens" || Arg == "aegis" ? std::vector<std::pair<std::string, double>>{{"aegisCore", 2}, {"tuningCore", 1}}
				: std::vector<std::pair<std::string, double>>{{"forgeCatalyst", 1}, {"microCircuits", 10}};
			LvAddMaterials(P, Reward);
			P.FractureShards += 150;
			P.EarnedRewards.push_back("living:commend:" + Arg);
			return {true, LvFactionName(Arg) + " commendation · " + LvMatLabel(Reward) + ", +150 shards"};
		}
		return {false, "Not available"};
	}

	std::string NpcLine(const FProgression& P, const FNpc& Npc, const std::string& EventTitle, double NowMs)
	{
		if (!EventTitle.empty()) return EventTitle + " — get out there, Operator. Talk later.";
		const std::string Tier = LvTier(P, Npc.Faction);
		const FLvDistrict* Fallen = nullptr;
		for (const FLvDistrict& D : LvDistricts())
			if (D.City == Npc.City && shop::DistrictStatus(P.Living, D.Id, NowMs) == "FALLEN") { Fallen = &D; break; }
		if (Fallen && Tier != "HOSTILE") return Fallen->Name + " is still overrun. Until someone takes it back, trade there is dead.";
		static const char* const Tiers[5] = {"HOSTILE", "WARY", "NEUTRAL", "TRUSTED", "HONORED"};
		size_t T = 0;
		for (size_t I = 0; I < 5; ++I) if (Tier == Tiers[I]) T = I;
		const auto Pledge = P.Story.Choices.find(PledgeKey);
		if (Npc.City == "neon" && Pledge != P.Story.Choices.end() && !Pledge->second.empty() && Npc.Role == "LEADER")
			return Npc.Greeting[T] + (Pledge->second == Npc.Faction ? " You chose well." : " I know where you pledged.");
		return Npc.Greeting[T];
	}

	void RecordCityKills(FProgression& P, const std::string& City, double Kills)
	{
		LvBump(P, [](const FContract& C, const std::string& Cy) { return C.City == Cy && C.Kind == "CULL"; }, City, Kills);
	}
	void RecordEventWin(FProgression& P, const std::string& City)
	{
		LvBump(P, [](const FContract& C, const std::string& Cy) { return C.City == Cy && C.Kind == "DEFEND"; }, City, 1);
	}

	std::vector<std::string> RecordReach(FProgression& P, double X, double Z)
	{
		std::vector<std::string> Messages;
		for (auto& [Id, Run] : P.Living.Contracts)
		{
			const FContract* C = ContractById(Id);
			const std::optional<FPoint> Pt = C && C->Kind == "SURVEY" ? ContractPoint(*C) : std::nullopt;
			if (!C || !Pt || Run.Progress >= C->Amount || js::Hypot(X - Pt->X, Z - Pt->Z) > SurveyReach) continue;
			Run.Progress = C->Amount;
			const FNpc* Giver = NpcById(C->Giver);
			Messages.push_back(C->Title + ": surveyed. Return to " + (Giver ? Giver->Name : std::string("the contact")) + ".");
		}
		const std::vector<std::string> Revealed = P.Living.Intel;
		for (const std::string& Id : Revealed)
		{
			const FIntel* I = LvIntelById(Id);
			if (!I || LvHas(P.EarnedRewards, LvStashKey(Id))) continue;
			const FPoint Pt = IntelPoint(*I);
			if (js::Hypot(X - Pt.X, Z - Pt.Z) > StashReach) continue;
			LvAddMaterials(P, I->Reward);
			P.FractureShards += I->Shards;
			P.EarnedRewards.push_back(LvStashKey(Id));
			Messages.push_back(I->Title + " recovered · " + LvMatLabel(I->Reward) + ", +" + LvN(I->Shards) + " shards");
		}
		return Messages;
	}

	std::vector<FMarker> LivingMarkers(const FProgression& P)
	{
		std::vector<FMarker> Out;
		for (const auto& [Id, Run] : P.Living.Contracts)
		{
			const FContract* C = ContractById(Id);
			const std::optional<FPoint> Pt = C && C->Kind == "SURVEY" && Run.Progress < C->Amount ? ContractPoint(*C) : std::nullopt;
			if (C && Pt) Out.push_back({"survey:" + Id, C->Title, Pt->X, Pt->Z, "survey"});
		}
		for (const std::string& Id : P.Living.Intel)
			if (const FIntel* I = LvIntelById(Id); I && !LvHas(P.EarnedRewards, LvStashKey(Id)))
			{
				const FPoint Pt = IntelPoint(*I);
				Out.push_back({"stash:" + Id, I->Title, Pt.X, Pt.Z, "stash"});
			}
		return Out;
	}

	std::vector<FStanding> RepSummary(const FProgression& P, const std::string& City)
	{
		std::vector<FStanding> Out;
		for (const char* F : {"wardens", "guild", "syndicate", "aegis"})
			if (LvFactionCity(F) == City) Out.push_back({F, LvFactionName(F), shop::RepOf(P.Living, F), LvTier(P, F)});
		return Out;
	}
}
