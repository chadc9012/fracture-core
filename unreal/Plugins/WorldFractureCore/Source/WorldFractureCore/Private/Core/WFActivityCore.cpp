#include "Core/WFActivityCore.h"

#include "Core/WFBountyCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <set>

namespace wf::activity
{
	namespace
	{
		constexpr double ActDayMs = 86400000.0;
		bool ActNear(const FArea& Area, const FTick& T, const FFrac& F, double R = CheckpointRadius)
		{
			const FFrac W = PointWorld(Area, F);
			return js::Hypot(T.X - W.X, T.Z - W.Z) <= R;
		}
		void ActAdvance(const std::vector<FObjective>& Stages, FActivityRun& Run, double NowMs)
		{
			if (static_cast<size_t>(Run.Stage) + 1 >= Stages.size()) { Run.Status = "complete"; return; }
			++Run.Stage;
			Run.StageStartedAt = NowMs; Run.Progress = 0; Run.Need = NeedOf(Stages[static_cast<size_t>(Run.Stage)]);
			Run.Cp = 0; Run.Visited.clear(); Run.bCarrying = false; Run.Hold = 0;
			Run.KillsBase = -1; // re-baselined on the next tick so kills before this stage never count
		}
		/** activities.ts rng32: a small deterministic generator (Math.imul, >>> 0) */
		struct FActRng
		{
			uint32_t S;
			explicit FActRng(double Seed) : S(static_cast<uint32_t>(static_cast<int32_t>(static_cast<int64_t>(Seed))) ^ 0x9e3779b9u) {}
			double operator()()
			{
				S = static_cast<uint32_t>((S ^ (S >> 15)) * 2246822507u) + 0x6d2b79f5u;
				return S / 4294967296.0;
			}
		};
		template <typename T>
		std::vector<T> ActShuffled(std::vector<T> A, double Seed)
		{
			FActRng R(Seed);
			for (size_t I = A.size(); I-- > 1;)
			{
				const size_t J = static_cast<size_t>(std::floor(R() * static_cast<double>(I + 1)));
				std::swap(A[I], A[J]);
			}
			return A;
		}
		/** the day number (since the epoch, UTC) of the Monday of NowMs's week */
		double ActMondayDay(double NowMs)
		{
			const double Day = std::floor(NowMs / ActDayMs);
			return Day - std::fmod(std::fmod(Day + 3, 7) + 7, 7); // 1970-01-01 was a Thursday
		}
	}

	FFrac PointWorld(const FArea& Area, const FFrac& F) { return {Area.X + F.X * Area.Radius, Area.Z + F.Z * Area.Radius}; }

	double NeedOf(const FObjective& O)
	{
		if (O.Kind == "race") return 1;
		if (O.Kind == "crucible" || O.Kind == "pvp") return O.Target;
		if (O.Kind == "kills") return O.Count;
		if (O.Kind == "course" || O.Kind == "collect") return static_cast<double>(O.Points.size());
		if (O.Kind == "hold") return O.Seconds;
		return 1;
	}

	void BeginObjectives(FActivityRun& Run, const std::vector<FObjective>& Stages, double NowMs)
	{
		Run.Stage = 0; Run.StageStartedAt = NowMs; Run.Progress = 0; Run.Need = Stages.empty() ? 0 : NeedOf(Stages.front());
		Run.Cp = 0; Run.Visited.clear(); Run.bCarrying = false; Run.Hold = 0;
		Run.KillsBase = -1; Run.ElitesBase = -1; Run.BossesBase = -1; Run.HpMin = 100; Run.Deaths0 = -1;
		Run.bDiedDuring = false; Run.bWasHurt = false;
	}

	std::optional<FTarget> CurrentTarget(const std::vector<FObjective>& Stages, const FArea& Area, const FActivityRun& Run)
	{
		if (Run.Status != "active" || Run.Stage < 0 || static_cast<size_t>(Run.Stage) >= Stages.size()) return std::nullopt;
		const FObjective& O = Stages[static_cast<size_t>(Run.Stage)];
		auto At = [&](const FFrac& F) { const FFrac W = PointWorld(Area, F); return FTarget{W.X, W.Z, O.Label}; };
		if (O.Kind == "course")
		{
			if (Run.Cp < 0 || static_cast<size_t>(Run.Cp) >= O.Points.size()) return std::nullopt;
			return At(O.Points[static_cast<size_t>(Run.Cp)]);
		}
		if (O.Kind == "collect")
		{
			for (size_t I = 0; I < O.Points.size(); ++I)
				if (std::find(Run.Visited.begin(), Run.Visited.end(), static_cast<int>(I)) == Run.Visited.end()) return At(O.Points[I]);
			return std::nullopt;
		}
		if (O.Kind == "hold") return At(O.At);
		if (O.Kind == "deliver") return At(Run.bCarrying ? O.To : O.From);
		if (O.Kind == "crucible" || O.Kind == "pvp") return At(ArenaPoint);
		return std::nullopt;
	}

	void StepRun(const std::vector<FObjective>& Stages, const FArea& Area, FActivityRun& Run, const FTick& T)
	{
		if (Run.Status != "active") return;
		if (Run.KillsBase < 0) { Run.KillsBase = T.Kills; Run.ElitesBase = T.Elites; Run.BossesBase = T.Bosses; Run.Deaths0 = T.Deaths; }
		if (T.Hp < Run.HpMin) Run.HpMin = T.Hp;
		if (T.Hp < 99.5 && Run.HpMin < 99.5) Run.bWasHurt = Run.HpMin < 99.5;
		if (T.Deaths > Run.Deaths0) Run.bDiedDuring = true;
		if (Run.Stage < 0 || static_cast<size_t>(Run.Stage) >= Stages.size()) return;
		const FObjective& O = Stages[static_cast<size_t>(Run.Stage)];
		const double Elapsed = (T.NowMs - Run.StageStartedAt) / 1000;
		const bool bTimed = O.Kind == "course" || O.Kind == "collect" || O.Kind == "deliver"; // races keep their own clock
		if (bTimed && Elapsed > O.TimeLimit) { Run.Status = "failed"; Run.FailReason = "Out of time"; return; }
		if (O.Kind == "kills")
		{
			const double N = O.Tier == "boss" ? T.Bosses - Run.BossesBase : O.Tier == "elite" ? T.Elites - Run.ElitesBase : T.Kills - Run.KillsBase;
			Run.Progress = std::min(O.Count, std::max(0.0, N));
			if (Run.Progress >= O.Count) ActAdvance(Stages, Run, T.NowMs);
		}
		else if (O.Kind == "course")
		{
			if (Run.Cp >= 0 && static_cast<size_t>(Run.Cp) < O.Points.size() && ActNear(Area, T, O.Points[static_cast<size_t>(Run.Cp)])) { ++Run.Cp; Run.Progress = Run.Cp; }
			if (static_cast<size_t>(Run.Cp) >= O.Points.size()) ActAdvance(Stages, Run, T.NowMs);
		}
		else if (O.Kind == "collect")
		{
			for (size_t I = 0; I < O.Points.size(); ++I)
				if (std::find(Run.Visited.begin(), Run.Visited.end(), static_cast<int>(I)) == Run.Visited.end() && ActNear(Area, T, O.Points[I])) Run.Visited.push_back(static_cast<int>(I));
			Run.Progress = static_cast<double>(Run.Visited.size());
			if (Run.Visited.size() >= O.Points.size()) ActAdvance(Stages, Run, T.NowMs);
		}
		else if (O.Kind == "hold")
		{
			const FFrac W = PointWorld(Area, O.At);
			if (js::Hypot(T.X - W.X, T.Z - W.Z) <= O.Radius) Run.Hold += T.Dt;
			else Run.Hold = std::max(0.0, Run.Hold - T.Dt * 2);
			Run.Progress = std::min(O.Seconds, std::floor(Run.Hold));
			if (Run.Hold >= O.Seconds) ActAdvance(Stages, Run, T.NowMs);
		}
		else if (O.Kind == "crucible")
		{
			if (!Run.RivalBase) Run.RivalBase = T.RivalKills.value_or(0);
			Run.Progress = std::max(0.0, T.RivalKills.value_or(0) - *Run.RivalBase);
			Run.TheirScore = std::max(0.0, T.Deaths - Run.Deaths0);
			if (Run.Progress >= O.Target) ActAdvance(Stages, Run, T.NowMs);
			else if (*Run.TheirScore >= O.Target) { Run.Status = "failed"; Run.FailReason = "The rivals reached " + js::NumberToString(O.Target) + " first"; }
		}
		else if (O.Kind == "pvp")
		{
			if (!T.Pvp) return;
			Run.Progress = T.Pvp->Us; Run.TheirScore = T.Pvp->Them; Run.PvpLine = T.Pvp->Line;
			if (T.Pvp->Result == "win") ActAdvance(Stages, Run, T.NowMs);
			else if (T.Pvp->Result == "loss") { Run.Status = "failed"; Run.FailReason = T.Pvp->Reason.empty() ? std::string("Match lost") : T.Pvp->Reason; }
		}
		else if (O.Kind == "deliver")
		{
			if (!Run.bCarrying && ActNear(Area, T, O.From)) Run.bCarrying = true;
			else if (Run.bCarrying && ActNear(Area, T, O.To)) { Run.Progress = 1; ActAdvance(Stages, Run, T.NowMs); }
		}
	}

	void AbandonRun(FActivityRun& Run)
	{
		if (Run.Status == "active") { Run.Status = "failed"; Run.FailReason = "Abandoned"; }
	}

	std::string AreaOfPoint(double X, double Z, const std::vector<FArea>& Areas)
	{
		std::string Best;
		double BestD = std::numeric_limits<double>::infinity();
		for (const FArea& A : Areas)
		{
			const double D = js::Hypot(X - A.X, Z - A.Z);
			if (D <= A.Radius * 1.2 && D < BestD) { Best = A.Id; BestD = D; }
		}
		return Best;
	}

	std::string CategoryOf(const std::string& Kind, const std::string& Id, const std::string& Area)
	{
		if (Kind == "side") return "side";
		if (Kind == "race" || Kind == "parkour") return "movement";
		if (Kind == "event") return "events";
		if (Kind == "contract" && (Area == "neon-underground" || Id == "th-dock" || Id == "wl-route" || Id == "nu-vault" || Id == "wl-blacksite")) return "underground";
		return "bounty";
	}

	std::vector<std::string> FeaturedFor(double NowMs, const std::vector<FBoardEntry>& Activities)
	{
		std::vector<FBoardEntry> Pool;
		for (const FBoardEntry& A : Activities) if (A.MinRep == 0 && !A.bGated) Pool.push_back(A);
		std::set<std::string> Seen;
		std::vector<std::string> Out;
		for (const FBoardEntry& A : ActShuffled(Pool, std::floor(NowMs / ActDayMs)))
		{
			if (!Seen.insert(A.Area).second) continue;
			Out.push_back(A.Id);
			if (static_cast<int>(Out.size()) >= FeaturedCount) break;
		}
		return Out;
	}

	std::vector<std::string> WeeklyElitesFor(double NowMs, const std::vector<std::string>& Elites)
	{
		std::vector<std::string> Out = ActShuffled(Elites, ActMondayDay(NowMs));
		if (Out.size() > static_cast<size_t>(WeeklyCount)) Out.resize(static_cast<size_t>(WeeklyCount));
		return Out;
	}

	std::string WeekKeyUtc(double NowMs) { return bounty::DayOf(ActMondayDay(NowMs) * ActDayMs); }
}
