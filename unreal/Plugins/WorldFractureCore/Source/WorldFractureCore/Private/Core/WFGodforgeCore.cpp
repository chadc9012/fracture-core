#include "Core/WFGodforgeCore.h"

#include "Core/WFBountyCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>

namespace wf::godforge
{
	namespace
	{
		std::string GfN(double V) { return js::NumberToString(V); }
		bool GfHas(const std::vector<std::string>& Xs, const std::string& X) { return std::find(Xs.begin(), Xs.end(), X) != Xs.end(); }
		double GfMat(const FProgression& P, const std::string& K) { const auto It = P.Materials.find(K); return It == P.Materials.end() ? 0 : It->second; }
		std::string GfLower(std::string S) { for (char& C : S) C = static_cast<char>(C >= 'A' && C <= 'Z' ? C - 'A' + 'a' : C); return S; }
		const char* const GfMarks[3] = {"forge-mark-1", "forge-mark-2", "forge-mark-3"};
		std::string GfSecretKey(const std::string& Id) { return "secret:" + Id; }
		FForgeResult GfFail(const FProgression& P, std::string Error) { FForgeResult R; R.Progression = P; R.Error = std::move(Error); return R; }
		FForgeResult GfOk(FProgression P, std::string Message) { FForgeResult R; R.bOk = true; R.Progression = std::move(P); R.Message = std::move(Message); return R; }
		FGearItem* GfRelic(FProgression& P, const std::string& Id)
		{
			for (FGearItem& I : P.Inventory) if (I.Id == Id && I.Godforge) return &I;
			return nullptr;
		}
		/** pay(): every cost in order, then the shards; the first shortfall is the error */
		std::optional<std::string> GfPay(FProgression& P, const FCost& Cost, double Shards)
		{
			for (const auto& [K, V] : Cost) if (GfMat(P, K) < V) return "Needs " + GfN(V) + " " + K + " (you have " + GfN(GfMat(P, K)) + ")";
			if (P.FractureShards < Shards) return "Needs " + GfN(Shards) + " fracture shards (you have " + GfN(P.FractureShards) + ")";
			for (const auto& [K, V] : Cost) P.Materials[K] = GfMat(P, K) - V;
			P.FractureShards -= Shards;
			return std::nullopt;
		}
		size_t GfCountPrefix(const std::vector<std::string>& Xs, const std::string& Prefix)
		{
			return static_cast<size_t>(std::count_if(Xs.begin(), Xs.end(), [&](const std::string& X) { return X.rfind(Prefix, 0) == 0; }));
		}
	}

	std::string ForgeStage(const FProgression& P)
	{
		if (GfHas(P.EarnedRewards, HeartKey)) return "GUARDIAN_SLAIN";
		for (const char* M : GfMarks) if (!GfHas(P.EarnedRewards, GfSecretKey(M))) return "SEALED";
		return "DOOR";
	}

	int MarksFound(const FProgression& P)
	{
		int N = 0;
		for (const char* M : GfMarks) if (GfHas(P.EarnedRewards, GfSecretKey(M))) ++N;
		return N;
	}

	bool GuardianDue(const FProgression& P, double X, double Z) { return ForgeStage(P) == "DOOR" && js::Hypot(X - HollowCrownX, Z - HollowCrownZ) < HollowCrownRadius; }
	bool VaelNear(const FProgression& P, double X, double Z) { return ForgeStage(P) == "GUARDIAN_SLAIN" && js::Hypot(X - VaelX, Z - VaelZ) < VaelReach; }

	const std::vector<FRune>& Runes()
	{
		static const std::vector<FRune> Table{
			{"STORM", "Storm Rune", "Every 4th hit chains lightning to 2 nearby enemies.", "STORM_ARC", "ARC", "heart", "", 0, "The Heart of the Hollow Crown"},
			{"EMBER", "Ember Rune", "Every 5th hit detonates a thermal burst.", "EMBER_BRAND", "THERMAL", "secret", "forge-mark-2", 0, "Forgewright's Mark: Ash"},
			{"FROST", "Frost Rune", "+30% damage to chilled enemies; every 6th hit shatters frost.", "RIME_SHATTER", "CRYO", "secret", "forge-mark-1", 0, "Forgewright's Mark: Ice"},
			{"BLOOM", "Bloom Rune", "Every 4th hit blooms corrosive spores.", "ROT_BLOOM", "BIO", "secret", "drowned-bell", 0, "The Drowned Bell (swamps, at night)"},
			{"SUN", "Sun Rune", "Every 6th hit flares and briefly stuns nearby enemies.", "SUN_FLARE", "THERMAL", "secret", "moon-shrine", 0, "The Moonlit Shrine (Veridan, at night)"},
			{"DEVOUR", "Devour Rune", "Each hit stores energy; every 8th hit releases it for +150% damage.", "", "", "nemesis", "", 1, "Kill a nemesis"},
			{"RIFT", "Rift Rune", "+25% damage to elites and bosses.", "", "", "secret", "storm-relay", 0, "The Storm Relay (Solara, in a storm)"},
			{"WARD", "Ward Rune", "Take 15% less damage while it is in your hands.", "", "", "secret", "trophy-cairn", 0, "The Trophy Cairn (Wastelands, after a nemesis kill)"},
			{"REAP", "Reap Rune", "Every kill restores 6 health.", "", "", "nemesis", "", 3, "Kill three nemeses"},
		};
		return Table;
	}

	const FRune* RuneById(const std::string& Id)
	{
		for (const FRune& R : Runes()) if (R.Id == Id) return &R;
		return nullptr;
	}

	std::string ConflictOf(const std::string& Rune, const std::vector<std::string>& Socketed)
	{
		static const std::pair<const char*, const char*> Conflicts[3] = {{"EMBER", "FROST"}, {"SUN", "BLOOM"}, {"DEVOUR", "WARD"}};
		for (const std::string& B : Socketed)
			for (const auto& [X, Y] : Conflicts)
				if ((Rune == X && B == Y) || (Rune == Y && B == X)) return B;
		return "";
	}

	int NemesesSlain(const FProgression& P)
	{
		return static_cast<int>(std::count_if(P.Nemeses.begin(), P.Nemeses.end(), [](const FProgression::FNemesis& N) { return N.Status == "SLAIN"; }));
	}

	bool RuneUnlocked(const FProgression& P, const std::string& Rune)
	{
		const FRune* R = RuneById(Rune);
		if (!R) return false;
		if (R->UnlockKind == "heart") return GfHas(P.EarnedRewards, HeartKey);
		if (R->UnlockKind == "secret") return GfHas(P.EarnedRewards, GfSecretKey(R->UnlockId));
		return NemesesSlain(P) >= (R->UnlockCount ? R->UnlockCount : 1);
	}

	const std::vector<FTier>& Tiers()
	{
		static const std::vector<FTier> Table{
			{"RELIC", "Relic", 1, 0, "ASCENDANT", {{"forgeCatalyst", 2}, {"crownHeart", 1}}, 200, "The Heart of the Hollow Crown", 0},
			{"ASCENDANT", "Ascendant Relic", 2, 40, "GODFORGED", {{"forgeCatalyst", 2}, {"runeDust", 4}}, 400, "One slain nemesis", 1},
			{"GODFORGED", "Godforged", 3, 80, "SOVEREIGN", {{"forgeCatalyst", 3}, {"runeDust", 8}, {"aegisCore", 2}}, 800, "Three slain nemeses", 3},
			{"SOVEREIGN", "Sovereign Godforged", 4, 120, "", {{"forgeCatalyst", 4}, {"runeDust", 14}, {"fractureCore", 1}}, 1500, "Five slain nemeses and a Fracture Core", 5},
		};
		return Table;
	}

	const FTier* TierById(const std::string& Id)
	{
		for (const FTier& T : Tiers()) if (T.Id == Id) return &T;
		return nullptr;
	}

	const std::vector<FRelicDesign>& Designs()
	{
		static const std::vector<FRelicDesign> Table{
			{"eclipse-devourer", "Eclipse Devourer", "primary", "A blade-rifle that cuts through corrupted shields and keeps what it takes."},
			{"crownfire", "Crownfire", "heavy", "Forged in the Hollow Crown's last fire. It remembers every war it ended."},
			{"stillwater", "Stillwater Lance", "primary", "Quiet until it isn't. Vael's own weapon, before the Fracture."},
		};
		return Table;
	}

	FForgeResult ForgeRelic(const FProgression& P, const std::string& DesignId, double NowMs)
	{
		if (ForgeStage(P) != "GUARDIAN_SLAIN") return GfFail(P, "The forge is cold. Bring Vael the Heart of the Hollow Crown.");
		const FRelicDesign* D = nullptr;
		for (const FRelicDesign& X : Designs()) if (X.Id == DesignId) D = &X;
		if (!D) return GfFail(P, "Unknown design");
		if (std::any_of(P.Inventory.begin(), P.Inventory.end(), [&](const FGearItem& I) { return I.Godforge && I.Name == D->Name; })) return GfFail(P, "You already carry " + D->Name);
		FProgression Next = P;
		const FTier& Relic = Tiers().front();
		if (const std::optional<std::string> Error = GfPay(Next, Relic.Cost, Relic.Shards)) return GfFail(P, *Error);
		FGearItem Item;
		Item.Id = "god-" + D->Id + "-" + js::ToBase36(NowMs);
		Item.Name = D->Name; Item.Slot = D->Slot; Item.Power = 300; Item.Level = 1; Item.Element = "KINETIC";
		Item.Source = "Forged by Vael \xC2\xB7 Hollow Crown"; Item.Rarity = "EXOTIC";
		Item.Godforge = FGearItem::FGodforge{};
		Next.Inventory.push_back(Item);
		return GfOk(std::move(Next), D->Name + " forged. Vael: \"It is yours. Give it a rune and it will answer.\"");
	}

	std::string RelicElement(const std::vector<std::string>& Socketed)
	{
		for (const std::string& R : Socketed) if (const FRune* Def = RuneById(R); Def && !Def->Element.empty()) return Def->Element;
		return "KINETIC";
	}

	FForgeResult SocketRune(const FProgression& P, const std::string& ItemId, const std::string& Rune)
	{
		FProgression Next = P;
		FGearItem* Item = GfRelic(Next, ItemId);
		if (!Item) return GfFail(P, "Not a Godforged relic");
		const FRune* Def = RuneById(Rune);
		if (!Def) return GfFail(P, "Unknown rune");
		FGearItem::FGodforge& G = *Item->Godforge;
		if (!RuneUnlocked(P, Rune)) return GfFail(P, Def->Name + " is not yours yet: " + Def->UnlockLabel);
		if (GfHas(G.Runes, Rune)) return GfFail(P, "Already socketed");
		const FTier* T = TierById(G.Tier);
		const int Sockets = T ? T->Sockets : 1;
		if (static_cast<int>(G.Runes.size()) >= Sockets) return GfFail(P, (T ? T->Label : G.Tier) + " has " + GfN(Sockets) + " socket" + (Sockets > 1 ? "s" : "") + ". Ascend it for more.");
		const std::string Clash = ConflictOf(Rune, G.Runes);
		if (!Clash.empty()) return GfFail(P, Def->Name + " rejects " + RuneById(Clash)->Name);
		G.Runes.push_back(Rune);
		Item->Element = RelicElement(G.Runes);
		const std::string Name = Item->Name;
		return GfOk(std::move(Next), Def->Name + " bound to " + Name);
	}

	FForgeResult RemoveRune(const FProgression& P, const std::string& ItemId, const std::string& Rune)
	{
		FProgression Next = P;
		FGearItem* Item = GfRelic(Next, ItemId);
		if (!Item || !GfHas(Item->Godforge->Runes, Rune)) return GfFail(P, "Not socketed");
		std::vector<std::string>& Socketed = Item->Godforge->Runes;
		Socketed.erase(std::remove(Socketed.begin(), Socketed.end(), Rune), Socketed.end());
		Item->Element = RelicElement(Socketed);
		const FRune* Def = RuneById(Rune);
		return GfOk(std::move(Next), (Def ? Def->Name : Rune) + " released");
	}

	FForgeResult AscendRelic(const FProgression& P, const std::string& ItemId)
	{
		FProgression Probe = P;
		const FGearItem* Found = GfRelic(Probe, ItemId);
		if (!Found) return GfFail(P, "Not a Godforged relic");
		const FTier* Cur = TierById(Found->Godforge->Tier);
		const FTier* T = Cur && !Cur->Next.empty() ? TierById(Cur->Next) : nullptr;
		if (!T) return GfFail(P, "Already Sovereign");
		const int Slain = NemesesSlain(P);
		if (Slain < T->NemesesSlain) return GfFail(P, T->Label + " needs " + GfLower(T->Requires) + " (" + GfN(Slain) + "/" + GfN(T->NemesesSlain) + ")");
		FProgression Next = P;
		if (const std::optional<std::string> Error = GfPay(Next, T->Cost, T->Shards)) return GfFail(P, *Error);
		FGearItem* Item = GfRelic(Next, ItemId);
		Item->Level += 1;
		Item->Power += T->Power - Cur->Power;
		Item->Godforge->Tier = T->Id;
		const std::string Name = Item->Name;
		return GfOk(std::move(Next), Name + " is now " + T->Label);
	}

	FForgeResult RecordRelicKills(const FProgression& P, const std::string& ItemId, double Kills)
	{
		FProgression Next = P;
		FGearItem* Item = GfRelic(Next, ItemId);
		if (!Item || Kills <= 0) return GfOk(P, "");
		FGearItem::FGodforge& G = *Item->Godforge;
		const double Total = G.Kills + Kills;
		const bool bAwaken = !G.bAwakened && Total >= AwakenKills;
		Item->Power += bAwaken ? AwakenPower : 0;
		G.Kills = Total;
		G.bAwakened = G.bAwakened || bAwaken;
		const std::string Name = Item->Name;
		return GfOk(std::move(Next), bAwaken ? Name + " awakens. Vael would be proud." : "");
	}

	double RuneDustEarned(const FProgression& P)
	{
		return 2.0 * NemesesSlain(P) + static_cast<double>(GfCountPrefix(P.EarnedRewards, "secret:"));
	}

	FForgeResult CollectRuneDust(const FProgression& P)
	{
		const double Taken = static_cast<double>(GfCountPrefix(P.EarnedRewards, "godforge:dust:"));
		const double Owed = RuneDustEarned(P) - Taken;
		if (Owed <= 0) return GfFail(P, "Vael has no dust for you. Kill a nemesis or find a secret.");
		FProgression Next = P;
		for (double I = 0; I < Owed; ++I) Next.EarnedRewards.push_back("godforge:dust:" + GfN(Taken + I + 1));
		Next.Materials["runeDust"] = GfMat(P, "runeDust") + Owed;
		return GfOk(std::move(Next), "+" + GfN(Owed) + " rune dust");
	}

	FForgeResult ClaimHeart(const FProgression& P)
	{
		if (GfHas(P.EarnedRewards, HeartKey)) return GfFail(P, "Already claimed");
		FProgression Next = P;
		Next.Materials["crownHeart"] = GfMat(P, "crownHeart") + 1;
		Next.Materials["forgeCatalyst"] = GfMat(P, "forgeCatalyst") + HeartCatalysts;
		Next.EarnedRewards.push_back(HeartKey);
		return GfOk(std::move(Next), "The Heart of the Hollow Crown is yours, with " + GfN(HeartCatalysts) + " forge catalysts. Vael waits at the forge.");
	}

	FRuneCombat RuneCombat(const FGearItem::FGodforge* G)
	{
		FRuneCombat R;
		if (!G) return R;
		for (const std::string& Id : G->Runes) if (const FRune* Def = RuneById(Id); Def && !Def->Burst.empty()) R.Bursts.push_back(Def->Burst);
		R.bDevour = GfHas(G->Runes, "DEVOUR"); R.bRift = GfHas(G->Runes, "RIFT"); R.bWard = GfHas(G->Runes, "WARD"); R.bReap = GfHas(G->Runes, "REAP");
		R.bAwakened = G->bAwakened;
		return R;
	}

	double RuneDamageMult(const FRuneCombat& R, int& DevourHits, bool bEliteOrBoss)
	{
		double K = R.bAwakened ? AwakenedMult : 1;
		if (R.bDevour) { ++DevourHits; if (DevourHits >= DevourEvery) { DevourHits = 0; K *= DevourMult; } }
		if (R.bRift && bEliteOrBoss) K *= RiftMult;
		return K;
	}

	const std::vector<FSecret>& Secrets()
	{
		static const std::vector<FSecret> Table{
			{"forge-mark-1", "frostspire", "Forgewright's Mark: Ice", -0.42, 0.31, "ALWAYS", "", "A hammer-and-crown sigil cut into blue ice. Beneath it: \"The fire went down, not out.\"", {{"cryoCrystal", 3}}, 30},
			{"forge-mark-2", "ember", "Forgewright's Mark: Ash", 0.36, -0.4, "ALWAYS", "", "The same sigil, fused into obsidian. \"Three marks to find the door. The Crown sleeps under the broken ground.\"", {{"thermalShards", 3}}, 30},
			{"forge-mark-3", "wastelands", "Forgewright's Mark: Rust", -0.3, -0.45, "ALWAYS", "", "Scratched into a pre-war blast door. \"Vael kept the last forge. Bring the Heart and she will open it.\"", {{"scrapMetal", 10}}, 30},
			{"moon-shrine", "veridan", "Moonlit Shrine", 0.5, 0.2, "NIGHT", "NOVA: Something here only wakes under the moon.", "A ring of standing stones that hums with Resonance at night. Someone left an offering for the Operators who never came back.", {{"sporeFiber", 4}, {"tuningCore", 1}}, 40},
			{"storm-relay", "solara", "Storm Relay", -0.5, 0.25, "STORM", "NOVA: A dead relay. It would need a lot of power to wake.", "The lightning wakes an Authority relay long enough to play one message: \"Containment was never the goal.\"", {{"anomalyCarbon", 4}, {"dataShards", 3}}, 50},
			{"trophy-cairn", "wastelands", "Trophy Cairn", 0.45, 0.35, "NEMESIS_SLAIN", "NOVA: Raider trophies. They only respect someone who has killed one of their champions.", "Helmets of fallen raider champions. Yours is the newest name scratched under them.", {{"reinforcedAlloy", 5}, {"forgeCatalyst", 1}}, 60},
			{"drowned-bell", "swamps", "Drowned Bell", 0.2, -0.5, "NIGHT", "NOVA: A bell under the water. It rings at night, they say.", "The bell rings once as you touch it. Somewhere far below, something in Thalassia answers.", {{"bioCatalyst", 3}}, 40},
			{"syndicate-ledger", "nexus", "Undercity Ledger", 0.2, 0.6, "PLEDGED", "NOVA: A locked ledger. Only someone sworn to a Neon faction would know the code.", "A ledger of who the Syndicate and the Directorate both pay. The same name is on both sides: the Fuel King.", {{"microCircuits", 6}, {"dataShards", 4}}, 50},
		};
		return Table;
	}

	const std::string& ConditionText(const std::string& Condition)
	{
		static const std::vector<std::pair<std::string, std::string>> Text{{"ALWAYS", ""}, {"NIGHT", "Only at night"}, {"STORM", "Only in a storm"},
			{"NEMESIS_SLAIN", "After you kill a nemesis"}, {"PLEDGED", "After you pledge in Neon City"}, {"FRAGMENTS", "After all three Forgewright fragments"}};
		for (const auto& [K, V] : Text) if (K == Condition) return V;
		return Text.front().second;
	}

	FRegionCircle SecretPoint(const FSecret& S, const FRegionCircle& Region) { return {Region.X + S.Fx * Region.Radius, Region.Z + S.Fz * Region.Radius, 0}; }

	bool ConditionHolds(const std::string& Condition, const FSecretContext& Ctx, const std::vector<std::string>& Earned)
	{
		if (Condition == "ALWAYS") return true;
		if (Condition == "NIGHT") return Ctx.bNight;
		if (Condition == "STORM") return Ctx.bStorm;
		if (Condition == "NEMESIS_SLAIN") return Ctx.bNemesisSlain;
		if (Condition == "PLEDGED") return Ctx.bPledged;
		if (Condition == "FRAGMENTS") { for (const char* M : GfMarks) if (!GfHas(Earned, GfSecretKey(M))) return false; return true; }
		return false;
	}

	std::optional<FSensed> SenseSecret(double X, double Z, const FSecretContext& Ctx, const std::vector<std::string>& Earned,
		const std::function<std::optional<FRegionCircle>(const std::string&)>& RegionOf)
	{
		std::optional<FSensed> Best;
		for (const FSecret& S : Secrets())
		{
			if (GfHas(Earned, GfSecretKey(S.Id))) continue;
			const std::optional<FRegionCircle> R = RegionOf(S.RegionId);
			if (!R) continue;
			const FRegionCircle At = SecretPoint(S, *R);
			const double D = js::Hypot(X - At.X, Z - At.Z);
			if (D > SecretHum || (Best && D >= Best->Dist)) continue;
			Best = FSensed{&S, D, ConditionHolds(S.Condition, Ctx, Earned)};
		}
		return Best;
	}

	FForgeResult ClaimSecret(const FProgression& P, const std::string& Id, const FSecretContext& Ctx)
	{
		const FSecret* S = nullptr;
		for (const FSecret& X : Secrets()) if (X.Id == Id) S = &X;
		if (!S) return GfFail(P, "Nothing here");
		if (GfHas(P.EarnedRewards, GfSecretKey(Id))) return GfFail(P, "Already found");
		if (!ConditionHolds(S->Condition, Ctx, P.EarnedRewards)) return GfFail(P, !S->Locked.empty() ? S->Locked : ConditionText(S->Condition));
		FProgression Next = P;
		for (const auto& [K, V] : S->Reward) Next.Materials[K] = GfMat(Next, K) + V;
		Next.FractureShards += S->Shards;
		Next.EarnedRewards.push_back(GfSecretKey(Id));
		if (!GfHas(Next.Story.Collectibles, "secret:" + Id)) Next.Story.Collectibles.push_back("secret:" + Id);
		bounty::PayFlat(Next.NexLedger, "payout:secret:" + Id, SecretNex);
		return GfOk(std::move(Next), "Secret found: " + S->Name + ". " + S->Lore);
	}
}
