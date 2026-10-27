#include "Core/WFStrikeCore.h"

#include "Core/WFBountyCore.h"
#include "Core/WFJsCompat.h"
#include "Core/WFRewardCore.h"

#include <algorithm>
#include <cmath>
#include <set>

namespace wf::strike
{
	namespace
	{
		const std::string StrikeKind = "strike";
		std::string StrikeNum(double V) { return js::NumberToString(V); }
		bool StrikeHas(const std::vector<std::string>& Xs, const std::string& X) { return std::find(Xs.begin(), Xs.end(), X) != Xs.end(); }
		double StrikeStageGain(const FStage& S) { return S.HazardPerStep ? *S.HazardPerStep : DefaultHazardGain(S.Type); }
		/** the run after one more objective step's worth of credit (raid-stages.ts contributions) */
		void StrikeContribute(const FDefinition& Def, const FStage& Stage, FRun& Out, const FRun& Run)
		{
			Out.Damage = Run.Damage + js::Round((Stage.Type == "BOSS_FIGHT" || Stage.Type == "COMBAT" ? 140 : 45) * (Def.DamageMult ? *Def.DamageMult : 1));
			Out.Support = Run.Support + (Stage.Type == "PUZZLE_COMBAT" || Stage.Type == "SYNC_TRAVERSAL" ? 85 : 25);
		}
	}

	double DefaultHazardGain(const std::string& StageType)
	{
		if (StageType == "SYNC_TRAVERSAL") return 11;
		if (StageType == "COMBAT") return 8;
		if (StageType == "PUZZLE_COMBAT") return 14;
		if (StageType == "TRAVERSAL_COMBAT") return 12;
		if (StageType == "BOSS_FIGHT") return 9;
		return 0; // every stage the game defines has one of the five types
	}

	FRun CreateRun(const FDefinition& Def)
	{
		FRun R;
		R.Lives = Def.MaxLives;
		R.Message = "Fireteam synchronized.";
		return R;
	}

	FRun Advance(const FDefinition& Def, const FRun& Run)
	{
		if (Run.Status == "COMPLETE" || Run.Status == "WIPED") return Run;
		if (Run.StageIndex < 0 || static_cast<size_t>(Run.StageIndex) >= Def.Stages.size())
		{
			FRun Out = Run;
			Out.Status = "COMPLETE";
			Out.Message = "Encounter complete.";
			return Out;
		}
		const FStage& Stage = Def.Stages[static_cast<size_t>(Run.StageIndex)];
		const double NextProgress = std::min(Stage.Target, Run.Progress + 1);
		const double NextHazard = std::min(100.0, Run.Hazard + StrikeStageGain(Stage));
		if (NextHazard >= 100)
		{
			FRun Out = Run;
			Out.Hazard = 100;
			Out.Status = "WIPED";
			Out.Message = "Sand entombment reached critical pressure. Fireteam lost.";
			return Out;
		}
		FRun Out = Run;
		StrikeContribute(Def, Stage, Out, Run);
		if (NextProgress < Stage.Target)
		{
			int Phase = 0;
			if (!Stage.BossPhases.empty())
				Phase = static_cast<int>(std::min(static_cast<double>(Stage.BossPhases.size()) - 1, std::floor((NextProgress / Stage.Target) * static_cast<double>(Stage.BossPhases.size()))));
			Out.Status = "ACTIVE";
			Out.Progress = NextProgress;
			Out.Hazard = NextHazard;
			Out.BossPhase = Phase;
			if (!Stage.BossPhases.empty() && Phase >= 0) Out.Message = Stage.BossPhases[static_cast<size_t>(Phase)].Name + " · " + Stage.BossPhases[static_cast<size_t>(Phase)].Mechanic;
			else Out.Message = Stage.Objective + " · " + StrikeNum(NextProgress) + "/" + StrikeNum(Stage.Target);
			return Out;
		}
		const size_t NextStage = static_cast<size_t>(Run.StageIndex) + 1;
		Out.StagePerformance.push_back({Stage.Name, Stage.Target, NextHazard});
		if (NextStage >= Def.Stages.size())
		{
			Out.Status = "COMPLETE";
			Out.Progress = NextProgress;
			Out.Hazard = NextHazard;
			Out.Message = "Final threat neutralized. Signature cache secured.";
			return Out;
		}
		Out.SelectedRoute.reset();
		Out.Status = "ACTIVE";
		Out.StageIndex = static_cast<int>(NextStage);
		Out.Progress = 0;
		Out.BossPhase = 0;
		Out.Hazard = Def.bNoCheckpointRelief ? NextHazard : std::max(0.0, NextHazard - (Stage.bCheckpoint ? 35 : 18));
		Out.Message = "Checkpoint secured · " + Def.Stages[NextStage].Name;
		return Out;
	}

	FRun ChooseRoute(const FRun& Run, const std::string& RouteId)
	{
		FRun Out = Run;
		Out.SelectedRoute = RouteId;
		Out.Hazard = std::max(0.0, Run.Hazard - 6);
		std::string Spoken = RouteId;
		std::replace(Spoken.begin(), Spoken.end(), '-', ' ');
		Out.Message = "Route locked: " + Spoken + ". Fireteam path synchronized.";
		return Out;
	}

	FRun LoseLife(const FDefinition& Def, const FRun& Run)
	{
		(void)Def;
		if (Run.Status == "COMPLETE" || Run.Status == "WIPED") return Run;
		FRun Out = Run;
		Out.Lives = std::max(0.0, Run.Lives - 1);
		Out.LivesUsed = Run.LivesUsed + 1;
		Out.Status = Out.Lives == 0 ? "WIPED" : "ACTIVE";
		Out.Message = Out.Lives == 0 ? std::string("Shared lives depleted. Fireteam lost.") : "Resonant recovered · " + StrikeNum(Out.Lives) + " shared lives remain.";
		return Out;
	}

	// ---- the ladder ----
	const std::vector<FTier>& TiersOf(const std::string& Kind)
	{
		static const std::vector<FTier> StrikeTiers{
			{"standard", "Standard", 0, 60, 1, 1, 0, 1, 100, "The strike as written."},
			{"hero", "Hero", 1, 72, 1.25, 1.4, 0, 1.5, 200, "Longer fights, a tougher boss."},
			{"legend", "Legend", 2, 84, 1.6, 2, -1, 2.5, 300, "Fewer shared lives. Mistakes cost."},
			{"master", "Master", 3, 94, 2, 3, -1, 4, 400, "The top of the playlist. Bring a plan."},
		};
		static const std::vector<FTier> RaidTiers{
			{"normal", "Normal", 0, 80, 1, 1, 0, 1, 300, "The raid as written."},
			{"heroic", "Heroic", 1, 86, 1.3, 1.6, -1, 1.75, 400, "Every encounter is longer and the wipe margin is thinner."},
			{"mastery", "Mastery", 2, 91, 1.7, 2.4, -2, 3, 500, "Cleared Heroic? This is where the raid starts to fight back."},
			{"contest", "Contest", 3, 96, 2.2, 3.4, -3, 5, 600, "The hardest it goes. Few shared lives, long fights, the best payout in the game."},
		};
		return Kind == "strike" ? StrikeTiers : RaidTiers;
	}
	const FTier& TierById(const std::string& Kind, const std::string& Id)
	{
		const std::vector<FTier>& Ts = TiersOf(Kind);
		for (const FTier& T : Ts) if (T.Id == Id) return T;
		return Ts.front();
	}
	void RecordTierClear(FProgression& P, const std::string& ActivityId, const std::string& TierId)
	{
		const std::string Key = TierClearKey(ActivityId, TierId);
		if (!StrikeHas(P.EarnedRewards, Key)) P.EarnedRewards.push_back(Key);
	}
	bool TierCleared(const FProgression& P, const std::string& Kind, const std::vector<std::string>& ActivityIds, const std::string& TierId)
	{
		for (const std::string& Id : ActivityIds) if (StrikeHas(P.EarnedRewards, TierClearKey(Id, TierId))) return true;
		if (Kind == "raid" && TierId == TiersOf("raid").front().Id)
			for (const std::string& Id : ActivityIds)
			{
				const auto It = P.DungeonClears.find(Id);
				if (It != P.DungeonClears.end() && It->second > 0) return true;
			}
		return false;
	}
	bool TierUnlocked(const FProgression& P, const std::string& Kind, const std::vector<std::string>& ActivityIds, const std::string& TierId)
	{
		const FTier& Tier = TierById(Kind, TierId);
		if (Tier.Rank == 0) return true;
		return TierCleared(P, Kind, ActivityIds, TiersOf(Kind)[static_cast<size_t>(Tier.Rank - 1)].Id);
	}
	const FTier& HighestUnlocked(const FProgression& P, const std::string& Kind, const std::vector<std::string>& ActivityIds)
	{
		const std::vector<FTier>& Ts = TiersOf(Kind);
		for (auto It = Ts.rbegin(); It != Ts.rend(); ++It) if (TierUnlocked(P, Kind, ActivityIds, It->Id)) return *It;
		return Ts.front();
	}
	std::string TierTarget(const std::string& Kind, const std::string& ActivityId, const std::string& TierId)
	{
		return TierById(Kind, TierId).Rank == 0 ? ActivityId : ActivityId + "@" + TierId;
	}
	std::vector<std::string> SearchStages(const std::string& DefId)
	{
		if (DefId == "hollow-star") return {"broken-gate", "seal-chambers", "echo-realm"};
		return {};
	}

	double FlawlessPeak(const FDefinition& Def, const std::vector<std::string>& Searches)
	{
		FRun Run = CreateRun(Def);
		Run.Status = "ACTIVE";
		double Peak = 0;
		for (int I = 0; I < 2000 && Run.Status == "ACTIVE"; ++I)
		{
			if (Run.Progress == 0 && !Searches.empty())
			{
				const std::string Id = Run.StageIndex >= 0 && static_cast<size_t>(Run.StageIndex) < Def.Stages.size() ? Def.Stages[static_cast<size_t>(Run.StageIndex)].Id : std::string();
				if (StrikeHas(Searches, Id)) Run.Hazard = std::min(100.0, Run.Hazard + SearchHazard);
			}
			Run = Advance(Def, Run);
			Peak = std::max(Peak, Run.Hazard);
		}
		return Run.Status == "WIPED" ? 100 : Peak;
	}

	// The web build memoises tuneHazard on a key that leaves out the blackout and damage flags; for every definition it is
	// actually called with, the inputs behind one key are the same, so this port tunes afresh each time.
	FDefinition TuneHazard(const FDefinition& Def, double Target, bool bSearchRoom)
	{
		const std::vector<std::string> Searches = bSearchRoom ? SearchStages(Def.Id) : std::vector<std::string>{};
		const double Limit = std::min(ChallengePeakCap, Target + TuneSlack);
		auto Ok = [&](const FDefinition& D) { return FlawlessPeak(D) <= Limit && FlawlessPeak(D, Searches) < 100; };
		auto Closer = [&](double Peak, double Than) { return std::fabs(Peak - Target) < std::fabs(Than - Target); };
		auto Build = [&](double K) {
			FDefinition D = Def;
			for (FStage& S : D.Stages) S.HazardPerStep = std::max(1.0, js::Round(StrikeStageGain(S) * K));
			return D;
		};
		FDefinition Best = Build(0.2);
		double BestPeak = FlawlessPeak(Best);
		for (double K = 0.2; K <= 4; K += 0.01)
		{
			FDefinition Cand = Build(K);
			const double Peak = FlawlessPeak(Cand);
			if (Ok(Cand) && Closer(Peak, BestPeak)) { Best = std::move(Cand); BestPeak = Peak; } // (peak === bestPeak && cand === best) never holds
			if (Peak >= 100) break;
		}
		// nudge single stages, last first: one more hazard per step, one objective more or fewer, one less hazard per step
		bool bImproved = true;
		for (int Guard = 0; bImproved && Guard < 300; ++Guard)
		{
			bImproved = false;
			for (size_t I = Best.Stages.size(); I-- > 0 && !bImproved;)
				for (int Move = 0; Move < 4 && !bImproved; ++Move)
				{
					FDefinition Cand = Best;
					FStage& S = Cand.Stages[I];
					switch (Move)
					{
					case 0: S.HazardPerStep = (S.HazardPerStep ? *S.HazardPerStep : 0) + 1; break;
					case 1: S.Target = S.Target + 1; break;
					case 2: S.Target = std::max(1.0, S.Target - 1); break;
					default: S.HazardPerStep = std::max(1.0, (S.HazardPerStep ? *S.HazardPerStep : 2) - 1); break;
					}
					const double Peak = FlawlessPeak(Cand);
					if (Ok(Cand) && Closer(Peak, BestPeak)) { Best = std::move(Cand); BestPeak = Peak; bImproved = true; }
				}
		}
		return Best;
	}

	FDefinition ApplyChallenge(const FDefinition& Def, const std::string& ModId)
	{
		FDefinition D = Def;
		if (ModId == "no-revive") D.bNoCheckpointRelief = true;
		else if (ModId == "iron-boss") { for (FStage& S : D.Stages) if (S.Type == "BOSS_FIGHT") S.Target = js::Round(S.Target * 1.4); }
		else if (ModId == "blackout") D.bBlackout = true;
		else if (ModId == "swarm") { for (FStage& S : D.Stages) if (S.Type != "BOSS_FIGHT") S.Target = js::Round(S.Target * 1.3); }
		else if (ModId == "glass") { D.DamageMult = 1.5; D.MaxLives = std::max(1.0, Def.MaxLives - 2); }
		// short-fuse: scaleEncounter raises the flawless peak by challengeBump instead
		return D;
	}
	double ChallengeBump(const std::string& ModId)
	{
		if (ModId == "no-revive" || ModId == "short-fuse") return 4;
		if (ModId == "iron-boss" || ModId == "swarm") return 3;
		return 0;
	}
	FDefinition ScaleEncounter(const FDefinition& Def, const FTier& Tier, const std::string& Mod)
	{
		FDefinition Structural = Def;
		if (Tier.Rank != 0)
		{
			Structural.Name = Def.Name + " · " + Tier.Name;
			Structural.MaxLives = std::max(1.0, Def.MaxLives + Tier.LivesDelta);
			for (FStage& S : Structural.Stages)
			{
				const double Scale = S.Type == "BOSS_FIGHT" ? 1 + (Tier.BossHealthScale - 1) * 0.35 : 1 + (Tier.EnemyScale - 1) * 0.5;
				S.Target = std::max(S.Target, js::Round(S.Target * Scale));
			}
		}
		const FDefinition WithMod = Mod.empty() ? Structural : ApplyChallenge(Structural, Mod);
		if (Def.Activity == "RAID" && Tier.Rank == 0 && Mod.empty()) return Def;
		return TuneHazard(WithMod, std::min(ChallengePeakCap, Tier.Peak + (Mod.empty() ? 0 : ChallengeBump(Mod))), Tier.Rank <= SearchRoomRank && Mod.empty());
	}
	const std::vector<FModifier>& RaidChallenges()
	{
		static const std::vector<FModifier> Mods{
			{"no-revive", "Last Light", "No shared-life recovery between encounters."},
			{"short-fuse", "Short Fuse", "Hazard builds faster in every encounter."},
			{"iron-boss", "Iron Boss", "The final boss has extra armor in every phase."},
			{"blackout", "Blackout", "Beacons and the minimap are dark inside the raid."},
			{"swarm", "Swarm", "Adds arrive in larger groups."},
			{"glass", "Glass Cannons", "Everyone deals more damage and takes much more."},
		};
		return Mods;
	}
	const FModifier& WeeklyRaidChallenge(double NowMs)
	{
		const double N = static_cast<double>(RaidChallenges().size());
		return RaidChallenges()[static_cast<size_t>(std::fmod(std::fmod(bounty::WeekIndex(NowMs), N) + N, N))];
	}
	double WeeklyMult(const std::string& Kind, const FTier& Tier, bool bFeatured, bool bChallengeTaken)
	{
		(void)bChallengeTaken; // the raid's weekly challenge pays on its featured encounter, not on the whole raid
		if (Kind == "strike") return bFeatured && Tier.Rank >= 1 ? WeeklyStrikeBonus : 1;
		return 1;
	}

	// ---- strikes ----
	namespace
	{
		FStage StrikeStage(const char* Id, const char* Name, const char* Type, const char* Objective, double Target, bool bCheckpoint, const char* Label, std::vector<std::string> Enemies)
		{
			FStage S;
			S.Id = Id; S.Name = Name; S.Type = Type; S.Objective = Objective; S.Target = Target; S.bCheckpoint = bCheckpoint; S.HazardLabel = Label; S.Enemies = std::move(Enemies);
			return S;
		}
		FDefinition MakeStrike(const char* Id, const char* Name, const char* Region, const char* Identity, const char* Hazard, const char* Boss, const char* Gear, const char* Perk, std::vector<FStage> Stages, std::vector<std::string> Traits)
		{
			FDefinition D;
			D.Id = Id; D.Name = Name; D.Activity = "STRIKE"; D.Region = Region; D.Duration = "10–20 min"; D.MaxLives = 3;
			D.Identity = Identity; D.Hazard = Hazard; D.Boss = Boss;
			D.Signature = {Gear, D.Id.size() % 2 ? "WEAPON" : "ARMOR", Perk, std::move(Traits)};
			D.Stages = std::move(Stages);
			return D;
		}
		FStage StrikeBoss(FStage S, std::vector<FBossPhase> Phases, const char* Reward) { S.BossPhases = std::move(Phases); S.Reward = Reward; return S; }
	}
	const std::vector<FDefinition>& Strikes()
	{
		static const std::vector<FDefinition> All{
			MakeStrike("strike-slagworks", "Strike · Slagworks Breach", "Ember Reaches", "A shut-down foundry has restarted on its own, and the slag lines are feeding something at the bottom.", "Molten overflow", "Cinder Warden", "Slagbreaker Coil", "Kills near molten channels feed a short heat surge.",
				{
					StrikeStage("slag-approach", "The Hot Line", "TRAVERSAL_COMBAT", "Cross the catwalks before the overflow gates open", 4, true, "OVERFLOW", {"Brute", "Tracker"}),
					StrikeStage("slag-push", "Furnace Hall", "COMBAT", "Clear the hall and shut down two furnaces", 5, true, "OVERFLOW", {"Brute", "Sentinel"}),
					StrikeBoss(StrikeStage("slag-boss", "Cinder Warden", "BOSS_FIGHT", "Break the Warden's plating while the pour is paused", 6, false, "OVERFLOW", {"Cinder Warden"}),
						{{"Phase I · Plated", 100, "The Warden sweeps the walkway with heat lances.", "Stay off the lit lanes and hit the vents."},
						 {"Phase II · Pour", 50, "Slag floods one half of the arena at a time.", "Rotate to the dry half and strip the plating."}}, "Slagbreaker Coil"),
				}, {"Heat Sink", "Overpour", "Quenched Rounds"}),
			MakeStrike("strike-bloom", "Strike · Bloom Sanctum", "Veridan Forest", "A mother-bloom has grown through an old research dome and is seeding it with spore drones.", "Spore density", "Mother Spore", "Bloomveil Mantle", "Healing leaves a lingering spore cloud that slows enemies.",
				{
					StrikeStage("bloom-approach", "Overgrown Gate", "SYNC_TRAVERSAL", "Cut three root locks together", 3, true, "SPORES", {"Tracker"}),
					StrikeStage("bloom-push", "The Greenhouse", "PUZZLE_COMBAT", "Defend the vent controls while the spores thin", 5, true, "SPORES", {"Sentinel", "Tracker"}),
					StrikeBoss(StrikeStage("bloom-boss", "Mother Spore", "BOSS_FIGHT", "Burn the core while the drones respawn", 6, false, "SPORES", {"Mother Spore"}),
						{{"Phase I · Seeding", 100, "Drones carry spore seeds to the walls.", "Pop drones before they land."},
						 {"Phase II · Bloom", 50, "The core opens and releases a wide cloud.", "Shoot it through the cloud, then clear out."}}, "Bloomveil Mantle"),
				}, {"Spore Wake", "Green Thumb", "Slow Bloom"}),
			MakeStrike("strike-drowned-relay", "Strike · Drowned Relay", "Verdant Swamps", "A flooded relay tower is broadcasting a signal that pulls machines in from across the marsh.", "Rising water", "Tide Engine", "Relay Breaker", "Precision hits ring a pulse that staggers nearby machines.",
				{
					StrikeStage("relay-approach", "The Causeway", "COMBAT", "Hold the causeway against the signal's pull", 5, true, "WATER", {"Tracker", "Brute"}),
					StrikeStage("relay-push", "Flooded Floor", "TRAVERSAL_COMBAT", "Reach the upper deck as the water rises", 5, true, "WATER", {"Sentinel"}),
					StrikeBoss(StrikeStage("relay-boss", "Tide Engine", "BOSS_FIGHT", "Silence the relay's three arrays", 6, false, "WATER", {"Tide Engine"}),
						{{"Phase I · Broadcast", 100, "The Engine pulses in a rising ring.", "Jump the ring and shoot the first array."},
						 {"Phase II · Surge", 50, "The deck floods and arrays move.", "Stay high, finish the last two arrays."}}, "Relay Breaker"),
				}, {"Ring Echo", "High Water", "Tuned Rounds"}),
			MakeStrike("strike-skyline-override", "Strike · Skyline Override", "Nexus City", "A hijacked rooftop defence grid is turning the skyline's own turrets on the streets below.", "Turret grid", "Warden Prime-0", "Override Key", "Defeated turrets turn into a short-lived ally decoy.",
				{
					StrikeStage("sky-approach", "Street Level", "COMBAT", "Fight up to the lift lobby", 4, true, "GRID", {"Sentinel", "Brute"}),
					StrikeStage("sky-push", "Rooftop Run", "SYNC_TRAVERSAL", "Hack three grid nodes across the rooftops", 3, true, "GRID", {"Sentinel"}),
					StrikeBoss(StrikeStage("sky-boss", "Warden Prime-0", "BOSS_FIGHT", "Take the grid master offline", 6, false, "GRID", {"Warden Prime-0"}),
						{{"Phase I · Lock-on", 100, "Turrets paint the team and fire in volleys.", "Break line of sight between volleys."},
						 {"Phase II · Override", 50, "The Warden pulls the grid into its own shield.", "Kill the feed nodes, then focus the Warden."}}, "Override Key"),
				}, {"Ghost Grid", "Decoy Drop", "Clean Break"}),
		};
		return All;
	}
	const std::vector<std::string>& StrikeIds()
	{
		static const std::vector<std::string> Ids = [] { std::vector<std::string> Out; for (const FDefinition& D : Strikes()) Out.push_back(D.Id); return Out; }();
		return Ids;
	}
	const FDefinition* FindStrike(const std::string& Id)
	{
		for (const FDefinition& D : Strikes()) if (D.Id == Id) return &D;
		return nullptr;
	}
	const FDefinition& WeeklyStrike(double NowMs)
	{
		const double N = static_cast<double>(Strikes().size());
		return Strikes()[static_cast<size_t>(std::fmod(std::fmod(bounty::WeekIndex(NowMs), N) + N, N))];
	}
	std::string StrikeClaimKey(const std::string& StrikeId, const std::string& TierId, double NowMs, const std::string& Operator)
	{
		return "strike-claim:" + StrikeId + ":" + TierId + (Operator.empty() ? std::string() : "#" + Operator) + ":" + bounty::DayOf(NowMs);
	}
	bool CanClaimStrike(const FProgression& P, const std::string& StrikeId, const std::string& TierId, double NowMs)
	{
		return !StrikeHas(P.EarnedRewards, StrikeClaimKey(StrikeId, TierId, NowMs, P.PocketClass));
	}
	bool StrikeTierUnlocked(const FProgression& P, const std::string& TierId) { return TierUnlocked(P, "strike", StrikeIds(), TierId); }

	namespace
	{
		double StrikeMult(const std::string& StrikeId, const FTier& Tier, double NowMs)
		{
			return Tier.PayMult * WeeklyMult("strike", Tier, WeeklyStrike(NowMs).Id == StrikeId, false);
		}
	}
	std::optional<FStrikePayout> StrikePayout(const FProgression& P, const std::string& StrikeId, const std::string& TierId, double NowMs)
	{
		const FTier& Tier = TierById(StrikeKind, TierId);
		const std::optional<bounty::FPayout> Pay = bounty::PayoutFor(P.NexLedger, "strike", TierTarget("strike", StrikeId, TierId), NowMs, StrikeMult(StrikeId, Tier, NowMs), P.PocketClass);
		if (!Pay) return std::nullopt;
		return FStrikePayout{Pay->Key, Pay->Nex, Pay->bFirst};
	}
	FClaim ClaimStrikeClear(const FProgression& P, const std::string& StrikeId, const std::string& TierId, double NowMs)
	{
		const FDefinition* Def = FindStrike(StrikeId);
		if (!Def || !StrikeTierUnlocked(P, TierId) || !CanClaimStrike(P, StrikeId, TierId, NowMs)) return {P, 0, false};
		const FTier& Tier = TierById(StrikeKind, TierId);
		const double Mult = StrikeMult(StrikeId, Tier, NowMs);
		FProgression Next = P;
		// Array.from(new Set([...earned, signature, claim key])): first occurrences, in order
		std::vector<std::string> Earned = P.EarnedRewards;
		Earned.push_back(Def->Signature.Name);
		Earned.push_back(StrikeClaimKey(StrikeId, TierId, NowMs, P.PocketClass));
		std::set<std::string> Seen;
		Next.EarnedRewards.clear();
		for (const std::string& E : Earned) if (Seen.insert(E).second) Next.EarnedRewards.push_back(E);
		Next.FractureShards = P.FractureShards + 12 * (1 + Tier.Rank);
		RecordTierClear(Next, StrikeId, TierId);
		const bounty::FPayout Paid = bounty::PayInto(Next.NexLedger, "strike", TierTarget("strike", StrikeId, TierId), NowMs, Mult, Next.PocketClass);
		reward::FGrantXpResult Xp = reward::GrantXP(std::move(Next), "DISCOVERY", std::nullopt, std::nullopt, std::nullopt, 1 + Tier.Rank * 0.5);
		return {std::move(Xp.Progression), Paid.Nex, Paid.bFirst};
	}
}

namespace wf::worldboss
{
	namespace
	{
		constexpr double WbPeriod = PeriodMin * 60000, WbWindow = WindowMin * 60000;
	}
	const std::vector<FRaidSite>& RaidSites()
	{
		static const std::vector<FRaidSite> Sites{
			{"wastelands", "Grid-Iron Flats", "The Rust Colossus", 0.55, 2.4},
			{"veridan", "Old-Growth Hollow", "The Verdant Effigy", 0.5, 0.9},
			{"frostspire", "Whiteout Shelf", "The Frost Titan", 0.55, 3.6},
			{"ember", "Caldera Rim", "The Magma Overseer", 0.5, 5.2},
			{"solara", "Glass Dunes", "The Sun-Scorched Behemoth", 0.55, 1.7},
			{"swamps", "Drowned Causeway", "The Mire Leviathan", 0.5, 4.4},
		};
		return Sites;
	}
	FRaids WorldBossAt(double NowMs)
	{
		const double K = std::floor(NowMs / WbPeriod);
		auto Make = [&](double I) {
			const double N = static_cast<double>(RaidSites().size());
			FRaid R;
			R.Site = RaidSites()[static_cast<size_t>(std::fmod(std::fmod(I, N) + N, N))];
			R.StartsAt = I * WbPeriod;
			R.EndsAt = R.StartsAt + WbWindow;
			R.Id = "wb-" + js::NumberToString(I);
			R.bLive = NowMs >= R.StartsAt && NowMs < R.StartsAt + WbWindow;
			return R;
		};
		return {Make(K), Make(K + 1)};
	}
	const std::vector<std::pair<std::string, double>>& RewardMaterials()
	{
		static const std::vector<std::pair<std::string, double>> Mats{{"fractureCore", 1}, {"reinforcedAlloy", 8}, {"forgeCatalyst", 2}};
		return Mats;
	}
	bool PayWorldBoss(FProgression& P, const std::string& RaidId)
	{
		const std::string Key = WorldBossKey(RaidId);
		if (P.NexLedger.count(Key)) return false;
		P.NexLedger[Key] = RewardNex;
		for (const auto& [M, N] : RewardMaterials()) P.Materials[M] = (P.Materials.count(M) ? P.Materials[M] : 0) + N;
		return true;
	}
	std::string WorldBossBanner(double NowMs)
	{
		const FRaids R = WorldBossAt(NowMs);
		if (R.Current.bLive)
			return "WORLD BOSS · " + R.Current.Site.Boss + " has risen at " + R.Current.Site.Name + " · " + js::NumberToString(std::ceil((R.Current.EndsAt - NowMs) / 60000)) + " min left · the factions stand together";
		return "Next world boss: " + R.Next.Site.Boss + " · " + R.Next.Site.Name + " in " + js::NumberToString(std::ceil((R.Next.StartsAt - NowMs) / 60000)) + " min";
	}
	FPoint RaidSiteWorld(const FRaidSite& Site, double RegionX, double RegionZ, double RegionRadius, const std::function<double(double, double)>& Ground, double Water)
	{
		double X = RegionX + std::cos(Site.Bearing) * RegionRadius * Site.Out, Z = RegionZ + std::sin(Site.Bearing) * RegionRadius * Site.Out;
		for (int I = 0; I < 16 && Ground(X, Z) < Water + 1.5; ++I) { X += (RegionX - X) * 0.15; Z += (RegionZ - Z) * 0.15; }
		return {X, Z};
	}
}
