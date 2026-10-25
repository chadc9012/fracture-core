// World Fracture — racing and the activity engine slice it runs on. See WFRaceCore.h.
#include "Core/WFRaceCore.h"

#include "Core/WFJsCompat.h"
#include "Core/WFRewardCore.h"
#include "Core/WFScenarioCore.h"

#include <algorithm>
#include <cmath>

namespace wf::race
{
	const char* const Difficulties[3] = {"standard", "advanced", "legendary"};
	const char* const Ranks[5] = {"Rookie", "Contender", "Veteran", "Elite", "Legend"};

	namespace
	{
		constexpr double RacePi = 3.14159265358979323846;
		constexpr double RankAt[5] = {0, 10, 28, 60, 110};
		constexpr int MaxRecoveries = 4;
		constexpr double CollisionPenalty = 1.5, CollisionCap = 12, RecoveryPenalty = 5, WreckPenalty = 8, StagingTimeoutS = 600;
		constexpr double PlaceBonus[3] = {0.5, 0.3, 0.15};
		constexpr double PointsByPlace[8] = {15, 12, 10, 8, 6, 4, 2, 1};
		const char* const WrongModeNote = "Wrong movement mode for this race";

		double DiffNum(const std::string& D, double Standard, double Advanced, double Legendary)
		{
			return D == "legendary" ? Legendary : D == "advanced" ? Advanced : Standard;
		}
		double MedalValue(const std::string& M) { return M == "gold" ? 3 : M == "silver" ? 2 : M == "bronze" ? 1 : 0; }

		bool RaceHas(const std::vector<std::string>& V, const std::string& K) { return std::find(V.begin(), V.end(), K) != V.end(); }
		const std::string* RaceFindPrefix(const std::vector<std::string>& V, const std::string& Prefix)
		{
			for (const std::string& E : V) if (E.rfind(Prefix, 0) == 0) return &E;
			return nullptr;
		}
		double ParseNum(const std::string& S)
		{
			// Number(...) of a key suffix the game itself wrote (an integer); anything else reads as NaN
			if (S.empty()) return 0;
			char* End = nullptr;
			const double V = std::strtod(S.c_str(), &End);
			return End && *End == 0 ? V : std::nan("");
		}

		std::string PbKey(const std::string& Id, const std::string& D) { return "race-pb:" + Id + ":" + D + ":"; }
		std::string MedalKey(const std::string& Id, const std::string& D, const std::string& M) { return "race-medal:" + Id + ":" + D + ":" + M; }
		std::string ChampKey(const std::string& C, const std::string& R) { return "champ:" + C + ":" + R + ":"; }
		std::string RivalBeatKey(const std::string& Id, const std::string& D, int Slot) { return "rival-beat:" + Id + ":" + D + ":" + std::to_string(Slot); }

		/** racing.ts rng: mulberry-style 32-bit step */
		struct FRaceRng
		{
			uint32_t Seed;
			double Next()
			{
				Seed = static_cast<uint32_t>((Seed ^ (Seed >> 15)) * 2246822507u + 0x6d2b79f5u);
				return Seed / 4294967296.0;
			}
		};

		FPoint WorldPoint(const FRaceDef& Def, int I)
		{
			const int N = static_cast<int>(Def.Points.size());
			return Def.Points[static_cast<size_t>(std::max(0, std::min(N - 1, I)))];
		}

		double SegDist(double Px, double Pz, double Ax, double Az, double Bx, double Bz)
		{
			const double Dx = Bx - Ax, Dz = Bz - Az, L2 = Dx * Dx + Dz * Dz;
			const double U = L2 != 0 ? std::max(0.0, std::min(1.0, ((Px - Ax) * Dx + (Pz - Az) * Dz) / L2)) : 0;
			return std::hypot(Px - (Ax + U * Dx), Pz - (Az + U * Dz));
		}

		/** rival-personas.ts shapes, by persona index */
		double PersonaShape(int Index, double U)
		{
			if (U <= 0 || U >= 1) return U;
			switch (Index)
			{
			case 0: return 1 - std::pow(1 - U, 0.55);                                  // rabbit
			case 1: return std::pow(U, 0.6);                                           // closer
			case 2: return U;                                                          // metronome
			case 3: return U + 0.07 * std::sin(U * RacePi * 1) * U * (1 - U);          // hothead
			case 4: return 1 - std::pow(1 - U, 0.85);                                  // grinder
			default: return U + 0.14 * std::sin(U * RacePi * 2) * U * (1 - U);         // wildcard
			}
		}
		const char* const PersonaNames[6] = {"Rabbit", "Closer", "Metronome", "Hothead", "Grinder", "Wildcard"};
		int PersonaIndex(const std::string& RaceId, const std::string& D, int Slot) { return static_cast<int>(Hash(RaceId + ":" + D + ":" + std::to_string(Slot) + ":persona") % 6); }

		std::vector<double> Legs(const FRaceDef& Def, double& OutTotal)
		{
			std::vector<double> Out;
			OutTotal = 0;
			for (size_t I = 1; I < Def.Points.size(); ++I)
			{
				const double L = std::hypot(Def.Points[I - 1].X - Def.Points[I].X, Def.Points[I - 1].Z - Def.Points[I].Z);
				Out.push_back(L);
				OutTotal += L;
			}
			return Out;
		}
	}

	const FRaceDef* FCatalog::Find(const std::string& Id) const
	{
		for (const FRaceDef& R : Races) if (R.Id == Id) return &R;
		return nullptr;
	}

	double CheckpointRadius(const std::string& Mode) { return Mode == "foot" ? 7 : Mode == "dive" ? 12 : 14; }
	double Corridor(const std::string& Mode) { return Mode == "foot" ? 45 : Mode == "dive" ? 70 : 90; }
	double TimeLimit(const FRaceDef& Def, const std::string& D) { return js::Round(Def.Par * DiffNum(D, 1.8, 1.45, 1.2)); }
	bool WindowOpen(const FPoint& P, double Time) { return !P.WindowPeriod || std::fmod(Time, *P.WindowPeriod) < P.WindowOpen.value_or(0); }

	uint32_t Hash(const std::string& S)
	{
		uint32_t H = 2166136261u;
		for (const unsigned char C : S) H = (H ^ C) * 16777619u;
		return H;
	}

	FRun NewRaceRun(const FRaceDef& Def, const std::string& Difficulty, double NowMs)
	{
		FRun R;
		R.RaceId = Def.Id;
		R.Difficulty = Difficulty;
		R.Wall0 = NowMs;
		return R;
	}

	std::vector<double> RivalTimes(const FRaceDef& Def, const std::string& D)
	{
		FRaceRng R{Hash(Def.Id + ":" + D)};
		const double Lo = DiffNum(D, 0.98, 0.94, 0.88), Hi = DiffNum(D, 1.35, 1.2, 1.08);
		std::vector<double> Out;
		for (int I = 0; I < Def.Rivals; ++I) Out.push_back(Def.Par * (Lo + (Hi - Lo) * R.Next()));
		std::sort(Out.begin(), Out.end());
		return Out;
	}

	std::string PersonaName(const std::string& RaceId, const std::string& D, int Slot) { return PersonaNames[PersonaIndex(RaceId, D, Slot)]; }

	std::vector<FRivalPos> RivalPositions(const FRaceDef& Def, const std::string& D, double Time)
	{
		double Total = 0;
		const std::vector<double> L = Legs(Def, Total);
		std::vector<FRivalPos> Out;
		const std::vector<double> Times = RivalTimes(Def, D);
		for (size_t K = 0; K < Times.size(); ++K)
		{
			const double Rt = Times[K];
			double Dist = std::min(1.0, PersonaShape(PersonaIndex(Def.Id, D, static_cast<int>(K)), Time / Rt)) * Total;
			size_t I = 0;
			while (I + 1 < L.size() && Dist > L[I]) { Dist -= L[I]; ++I; }
			const FPoint A = WorldPoint(Def, static_cast<int>(I)), B = WorldPoint(Def, static_cast<int>(I) + 1);
			const double Li = I < L.size() ? L[I] : 0;
			const double U = Li != 0 ? std::min(1.0, Dist / Li) : 0;
			const double Lateral = (K % 2 ? 1.0 : -1.0) * (3 + static_cast<double>(K));
			const double Den = Li != 0 ? Li : 1;
			const double Nx = -(B.Z - A.Z) / Den, Nz = (B.X - A.X) / Den;
			FRivalPos P;
			P.X = A.X + (B.X - A.X) * U + Nx * Lateral;
			P.Z = A.Z + (B.Z - A.Z) * U + Nz * Lateral;
			if (A.Depth && B.Depth) P.Depth = *A.Depth + (*B.Depth - *A.Depth) * U;
			P.Progress = std::min(1.0, Time / Rt);
			Out.push_back(P);
		}
		return Out;
	}

	FResult Evaluate(const FRaceDef& Def, const FRun& Run, double CollisionPen)
	{
		const double Total = Run.Time + Run.Penalties + CollisionPen;
		const double Gold = Def.Par * DiffNum(Run.Difficulty, 1, 0.93, 0.86);
		const size_t N = Def.Points.size();
		FResult R;
		R.bValid = Run.Next >= static_cast<int>(N) && Run.Passed.size() + 1 >= N;
		if (R.bValid) R.Medal = Total <= Gold ? std::optional<std::string>("gold") : Total <= Gold * 1.15 ? std::optional<std::string>("silver") : Total <= Gold * 1.35 ? std::optional<std::string>("bronze") : std::nullopt;
		const std::vector<double> Field = RivalTimes(Def, Run.Difficulty);
		R.Place = 1 + static_cast<int>(std::count_if(Field.begin(), Field.end(), [Total](double Rt) { return Rt < Total; }));
		R.Field = static_cast<int>(Field.size()) + 1;
		R.Time = js::Round(Total * 1000) / 1000;
		R.Penalties = js::Round((Run.Penalties + CollisionPen) * 1000) / 1000;
		R.Par = Def.Par;
		R.Style = js::Round(Run.Style);
		R.Difficulty = Run.Difficulty;
		return R;
	}

	void TickRace(const FRaceDef& Def, FRun& Run, const FTick& T)
	{
		if (Run.Phase == "finished" || Run.Phase == "failed") return;
		const double Limit = TimeLimit(Def, Run.Difficulty), Dt = std::max(0.0, std::min(T.Dt, 0.25)), Cr = CheckpointRadius(Def.Mode);
		auto Fail = [&Run](const char* Why) { Run.Phase = "failed"; Run.FailReason = Why; };
		if ((T.Now - Run.Wall0) / 1000 > (Run.Phase == "staging" ? StagingTimeoutS : Limit * 1.6 + 30)) { Fail(Run.Phase == "staging" ? "Never reached the start line" : "Out of time"); return; }
		const bool bModeOk = T.Mode.value_or(Def.Mode) == Def.Mode;
		Run.Notice = bModeOk ? std::nullopt : std::optional<std::string>(WrongModeNote);
		const FPoint Start = WorldPoint(Def, 0);
		if (Run.Phase == "staging")
		{
			if (bModeOk && std::hypot(T.X - Start.X, T.Z - Start.Z) <= StartRadius) { Run.Phase = "countdown"; Run.Countdown = CountdownS; Run.Wall0 = T.Now; }
			return;
		}
		if (Run.Phase == "countdown")
		{
			if (!bModeOk || std::hypot(T.X - Start.X, T.Z - Start.Z) > StartRadius) { Run.Phase = "staging"; Run.Notice = bModeOk ? "Stay on the start line" : WrongModeNote; return; }
			Run.Countdown -= Dt;
			if (Run.Countdown <= 0) { Run.Phase = "running"; Run.Countdown = 0; }
			return;
		}
		// running
		Run.Time += Dt;
		if (Run.Time > Limit) { Fail("Out of time"); return; }
		Run.Collisions += T.Collisions;
		Run.Impact = std::max(0.0, Run.Impact - Dt * 0.55);
		if (bModeOk && Def.Mode == "vehicle")
			for (const FObstacle& O : Def.Obstacles)
			{
				if (O.Segment != Run.Next || RaceHas(Run.HitObstacles, O.Id) || std::hypot(T.X - O.X, T.Z - O.Z) > O.Radius) continue;
				Run.HitObstacles.push_back(O.Id);
				Run.Collisions += 1;
				Run.Impact = 1;
				Run.Notice = "Hit a track obstacle: collision penalty";
			}
		Run.Style += std::max(0.0, T.Style);
		const double CollisionPen = std::min(CollisionCap, Run.Collisions * CollisionPenalty);
		auto Recover = [&](double Penalty, const char* Why) {
			if (++Run.Recoveries > MaxRecoveries) { Fail("Too many recoveries"); return; }
			Run.Penalties += Penalty;
			const FPoint Back = WorldPoint(Def, Run.Next > 1 ? Run.Next - 1 : 0);
			Run.Recover = FRun::FRecover{Back.X, Back.Z, Back.Depth};
			Run.Notice = Why;
			Run.Outside = 0;
		};
		if (T.bVehicleDisabled && Def.Mode == "vehicle") { Recover(WreckPenalty, "Vehicle wrecked: recovered to the last checkpoint"); return; }
		if (T.bFell) { Recover(RecoveryPenalty, "Recovered to the last checkpoint"); return; }
		// staying on the course: distance to the leg you are on (and the shortcut leg, if one is offered here)
		const FPoint Prev = WorldPoint(Def, Run.Next - 1), Nxt = WorldPoint(Def, Run.Next);
		double Off = SegDist(T.X, T.Z, Prev.X, Prev.Z, Nxt.X, Nxt.Z);
		const FShortcut* Sc = nullptr;
		for (const FShortcut& S : Def.Shortcuts) if (S.At == Run.Next) { Sc = &S; break; }
		if (Sc) Off = std::min(Off, SegDist(T.X, T.Z, Prev.X, Prev.Z, Sc->ViaX, Sc->ViaZ));
		if (Off > Corridor(Def.Mode))
		{
			Run.Outside += Dt;
			if (Run.Outside > 8) { Recover(RecoveryPenalty, "Left the course: recovered to the last checkpoint"); return; }
			if (Run.Outside > 3) Run.Notice = "Return to the course";
		}
		else Run.Outside = 0;
		if (!bModeOk) return;
		auto Near = [&](double X, double Z) { return std::hypot(T.X - X, T.Z - Z) <= Cr; };
		// shortcut: an authored alternative gate that skips ahead, only by actually passing through it
		if (Sc && Near(Sc->ViaX, Sc->ViaZ))
		{
			for (int K = Run.Next; K < Sc->SkipTo; ++K) Run.Passed.push_back(K);
			Run.Next = Sc->SkipTo;
			Run.bViaShortcut = true;
			Run.Notice = "Shortcut taken";
		}
		if (Run.Next < static_cast<int>(Def.Points.size()))
		{
			const FPoint& Pt = Def.Points[static_cast<size_t>(Run.Next)];
			const bool bDepthOk = !Pt.Depth || !T.Y || std::fabs(*T.Y - *Pt.Depth) <= 8;
			if (Near(Nxt.X, Nxt.Z) && bDepthOk) // the web build tests the gate it looked up before any shortcut
			{
				if (!WindowOpen(Pt, Run.Time)) Run.Notice = "Gate closed: wait for it to open";
				else { Run.Passed.push_back(Run.Next); Run.Next += 1; }
			}
		}
		if (Run.Next >= static_cast<int>(Def.Points.size()))
		{
			Run.Phase = "finished";
			Run.Result = Evaluate(Def, Run, CollisionPen);
		}
	}

	double CourseProgress(const FRaceDef& Def, int Next, double X, double Z)
	{
		double Total = 0;
		const std::vector<double> L = Legs(Def, Total);
		if (Total == 0) return 0;
		const int Leg = std::max(1, std::min(static_cast<int>(Def.Points.size()) - 1, Next));
		double Done = 0;
		for (int I = 0; I < Leg - 1; ++I) Done += L[static_cast<size_t>(I)];
		const FPoint A = WorldPoint(Def, Leg - 1), B = WorldPoint(Def, Leg);
		const double Dx = B.X - A.X, Dz = B.Z - A.Z, L2 = Dx * Dx + Dz * Dz;
		const double U = L2 != 0 ? std::max(0.0, std::min(1.0, ((X - A.X) * Dx + (Z - A.Z) * Dz) / L2)) : 0;
		const double LegLen = static_cast<size_t>(Leg - 1) < L.size() ? L[static_cast<size_t>(Leg - 1)] : 0;
		return std::min(1.0, (Done + U * LegLen) / Total);
	}

	void LivePlace(const FRaceDef& Def, const FRun& Run, double X, double Z, int& OutPlace, int& OutField)
	{
		if (Run.Phase != "running") { OutPlace = OutField = Def.Rivals + 1; return; }
		const double Me = CourseProgress(Def, Run.Next, X, Z);
		const std::vector<FRivalPos> R = RivalPositions(Def, Run.Difficulty, Run.Time);
		OutPlace = 1 + static_cast<int>(std::count_if(R.begin(), R.end(), [Me](const FRivalPos& P) { return P.Progress > Me; }));
		OutField = static_cast<int>(R.size()) + 1;
	}

	double RaceSpeedFactor(double Impact) { return 1 - 0.45 * std::max(0.0, std::min(1.0, Impact)); }

	std::optional<double> PersonalBest(const FProgression& P, const std::string& Id, const std::string& D)
	{
		const std::string Prefix = PbKey(Id, D);
		const std::string* K = RaceFindPrefix(P.EarnedRewards, Prefix);
		if (!K) return std::nullopt;
		return ParseNum(K->substr(Prefix.size())) / 1000;
	}

	std::optional<std::string> BestMedal(const FProgression& P, const std::string& Id, const std::string& D)
	{
		for (const char* M : {"gold", "silver", "bronze"}) if (RaceHas(P.EarnedRewards, MedalKey(Id, D, M))) return std::string(M);
		return std::nullopt;
	}

	double RacingScore(const FCatalog& C, const FProgression& P)
	{
		double S = 0;
		for (const FRaceDef& R : C.Races)
			for (const char* D : Difficulties)
				if (const std::optional<std::string> M = BestMedal(P, R.Id, D)) S += MedalValue(*M) * DiffNum(D, 1, 1.5, 2.5);
		return S;
	}

	int ChampionshipsWon(const FCatalog& C, const FProgression& P)
	{
		int N = 0;
		for (const FChampionship& Ch : C.Championships) if (RaceHas(P.EarnedRewards, "champ-done:" + Ch.Id)) ++N;
		return N;
	}

	int RankIndex(const FCatalog& C, const FProgression& P)
	{
		const double S = RacingScore(C, P);
		int R = 0;
		for (int I = 0; I < 5; ++I) if (S >= RankAt[I]) R = I;
		return R == 4 && ChampionshipsWon(C, P) < 2 ? 3 : R;
	}

	FChampionshipStatus ChampionshipPoints(const FProgression& P, const FChampionship& Ch)
	{
		FChampionshipStatus S;
		for (const std::string& R : Ch.Rounds)
		{
			const std::string Prefix = ChampKey(Ch.Id, R);
			if (const std::string* K = RaceFindPrefix(P.EarnedRewards, Prefix)) S.PerRound[R] = ParseNum(K->substr(Prefix.size()));
		}
		for (const auto& [R, V] : S.PerRound) S.Total += V;
		S.bComplete = std::all_of(Ch.Rounds.begin(), Ch.Rounds.end(), [&S](const std::string& R) { return S.PerRound.count(R) > 0; });
		return S;
	}

	std::optional<std::string> DifficultyLocked(const FProgression& P, const std::string& Id, const std::string& D)
	{
		if (D == "advanced" && !BestMedal(P, Id, "standard")) return std::string("Earn a medal on Standard first");
		if (D == "legendary" && BestMedal(P, Id, "advanced").value_or("") != "gold") return std::string("Earn a gold on Advanced first");
		return std::nullopt;
	}

	bool HiddenUnlocked(const FProgression& P, const FRaceDef& Race)
	{
		if (!Race.bHidden) return true;
		int Found = 0;
		for (const std::string& M : Race.HiddenMarkers) if (P.MissionRuns.count("act:d-" + M)) ++Found;
		return Found >= Race.HiddenNeed;
	}

	bool ApplyRaceResult(const FCatalog& C, FProgression& P, const std::string& ActivityId, double ActivityNex, double StartedAt, const FRun& Run, FRaceReward& OutReward, std::string& OutError)
	{
		const FRaceDef* Race = C.Find(Run.RaceId);
		if (!Race || Run.Phase != "finished" || !Run.Result || !Run.Result->bValid) { OutError = "No valid result"; return false; }
		const std::string Key = "race-run:" + ActivityId + ":" + js::NumberToString(StartedAt);
		if (P.NexLedger.count(Key)) { OutError = "Already recorded"; return false; }
		const FResult& Res = *Run.Result;
		const std::string& D = Res.Difficulty;
		const int Before = RankIndex(C, P);
		FRaceReward Reward;
		std::vector<std::string> Earned = P.EarnedRewards;
		{
			FProgression Probe;
			Probe.EarnedRewards = Earned;
			const std::optional<double> Best = PersonalBest(Probe, Race->Id, D);
			Reward.bPersonalBest = !Best || Res.Time < *Best;
		}
		if (Reward.bPersonalBest)
		{
			const std::string Prefix = PbKey(Race->Id, D);
			Earned.erase(std::remove_if(Earned.begin(), Earned.end(), [&Prefix](const std::string& E) { return E.rfind(Prefix, 0) == 0; }), Earned.end());
			Earned.push_back(Prefix + js::NumberToString(js::Round(Res.Time * 1000)));
		}
		if (Res.Medal)
			for (const char* M : {"gold", "silver", "bronze"})
				if (MedalValue(M) <= MedalValue(*Res.Medal) && !RaceHas(Earned, MedalKey(Race->Id, D, M)))
				{
					Earned.push_back(MedalKey(Race->Id, D, M));
					if (*Res.Medal == M) Reward.bNewMedal = true;
				}
		const std::vector<double> Times = RivalTimes(*Race, D);
		for (size_t Slot = 0; Slot < Times.size(); ++Slot)
		{
			const std::string K = RivalBeatKey(Race->Id, D, static_cast<int>(Slot));
			if (Times[Slot] <= Res.Time || RaceHas(Earned, K)) continue;
			Earned.push_back(K);
			Reward.RivalsFirstBeaten.push_back(PersonaName(Race->Id, D, static_cast<int>(Slot)));
		}
		const double BonusMult = (Res.Place >= 1 && Res.Place <= 3 ? PlaceBonus[Res.Place - 1] : 0) + (Res.Medal == std::optional<std::string>("gold") ? 0.3 : Res.Medal == std::optional<std::string>("silver") ? 0.15 : 0) + (DiffNum(D, 1, 1.4, 2) - 1);
		Reward.NexBonus = js::Round(ActivityNex * BonusMult);
		Reward.Medal = Res.Medal;
		FProgression Next = P;
		Next.EarnedRewards = Earned;
		Next.NexLedger[Key] = Reward.NexBonus;
		for (const FChampionship& Ch : C.Championships)
		{
			if (!RaceHas(Ch.Rounds, Race->Id)) continue;
			const double Pts = Res.Place >= 1 && Res.Place <= 8 ? PointsByPlace[Res.Place - 1] : 0;
			Reward.ChampionshipPoints = Pts;
			const std::string Prefix = ChampKey(Ch.Id, Race->Id);
			const std::string* PrevKey = RaceFindPrefix(Next.EarnedRewards, Prefix);
			const double PrevPts = PrevKey ? ParseNum(PrevKey->substr(Prefix.size())) : -1;
			if (Pts > PrevPts)
			{
				const std::string Old = PrevKey ? *PrevKey : std::string();
				if (PrevKey) Next.EarnedRewards.erase(std::remove(Next.EarnedRewards.begin(), Next.EarnedRewards.end(), Old), Next.EarnedRewards.end());
				Next.EarnedRewards.push_back(Prefix + js::NumberToString(Pts));
			}
			const FChampionshipStatus S = ChampionshipPoints(Next, Ch);
			if (S.bComplete && !RaceHas(Next.EarnedRewards, "champ-done:" + Ch.Id))
			{
				Reward.bChampionshipDone = true;
				Next.EarnedRewards.push_back("champ-done:" + Ch.Id);
				Next.EarnedRewards.push_back("race-title:" + Ch.Id);
				Next.NexLedger["champ-reward:" + Ch.Id] = 400 + Ch.Rank * 150;
			}
		}
		const int After = RankIndex(C, Next);
		if (After > Before) Reward.RankUp = Ranks[After];
		P = std::move(Next);
		OutReward = Reward;
		return true;
	}
}

namespace wf::activity
{
	namespace
	{
		std::string RecKey(const std::string& Id) { return "act:" + Id; }
		std::string WeekKeyUtc(double NowMs)
		{
			const double Days = std::floor(NowMs / 86400000.0);
			const double Weekday = std::fmod(std::fmod(Days + 4, 7) + 7, 7); // 1970-01-01 was a Thursday
			const double Back = std::fmod(Weekday + 6, 7);
			return scenario::DayKeyUtc((Days - Back) * 86400000.0);
		}
	}

	std::string PeriodKey(const FActivityDef& Def, double NowMs) { return Def.Period == "week" ? "w" + WeekKeyUtc(NowMs) : scenario::DayKeyUtc(NowMs); }

	double ReputationOf(const FProgression& P, const std::string& Faction)
	{
		const std::string Prefix = "rep:" + Faction + ":";
		for (const std::string& E : P.EarnedRewards)
			if (E.rfind(Prefix, 0) == 0)
			{
				char* End = nullptr;
				const std::string Tail = E.substr(Prefix.size());
				const double V = std::strtod(Tail.c_str(), &End);
				return End && *End == 0 && !Tail.empty() && std::isfinite(V) ? V : 0; // Number(...) || 0
			}
		return 0;
	}

	void AddReputation(FProgression& P, const std::string& Faction, double Amount)
	{
		const double Total = ReputationOf(P, Faction) + std::max(0.0, std::floor(Amount));
		const std::string Prefix = "rep:" + Faction + ":";
		P.EarnedRewards.erase(std::remove_if(P.EarnedRewards.begin(), P.EarnedRewards.end(), [&Prefix](const std::string& E) { return E.rfind(Prefix, 0) == 0; }), P.EarnedRewards.end());
		P.EarnedRewards.push_back(Prefix + js::NumberToString(Total));
	}

	FState ActivityState(const race::FCatalog& Races, const FProgression& P, const FActivityDef& Def, double NowMs)
	{
		FState S;
		const auto Rec = P.MissionRuns.find(RecKey(Def.Id));
		const bool bHas = Rec != P.MissionRuns.end();
		const double Used = bHas && Rec->second.Day == PeriodKey(Def, NowMs) ? Rec->second.Count : 0;
		S.AttemptsLeft = std::max(0.0, Def.Attempts - Used);
		const double Last = bHas ? Rec->second.Last.value_or(0) : 0;
		const double Since = Last > NowMs ? 0 : NowMs - Last;
		S.CooldownLeftMs = Last != 0 ? std::max(0.0, Def.CooldownMin * 60000 - Since) : 0;
		if (Def.RaceRankGate && race::RankIndex(Races, P) < *Def.RaceRankGate) { S.Reason = std::string("Requires racing rank ") + race::Ranks[*Def.RaceRankGate]; return S; }
		if (Def.MinRep != 0 && ReputationOf(P, Def.Faction) < Def.MinRep) { S.Reason = "Requires " + js::NumberToString(Def.MinRep) + " " + Def.Faction + " reputation"; return S; }
		if (S.AttemptsLeft <= 0) { S.Reason = Def.Period == "week" ? "Weekly limit reached" : "Daily limit reached"; return S; }
		if (S.CooldownLeftMs > 0) { S.Reason = "On cooldown"; return S; }
		S.bAvailable = true;
		return S;
	}

	bool StartActivity(const race::FCatalog& Races, FProgression& P, const FActivityDef& Def, double NowMs, const std::optional<std::string>& Difficulty, FActivityRun& OutRun, std::string& OutError)
	{
		const FState S = ActivityState(Races, P, Def, NowMs);
		if (!S.bAvailable) { OutError = S.Reason.value_or("Unavailable"); return false; }
		const std::string K = RecKey(Def.Id);
		const auto Rec = P.MissionRuns.find(K);
		const bool bHas = Rec != P.MissionRuns.end();
		const double Today = bHas && Rec->second.Day == PeriodKey(Def, NowMs) ? Rec->second.Count : 0;
		FProgression::FRunRecord R;
		R.Day = PeriodKey(Def, NowMs);
		R.Count = Today + 1;
		R.Last = bHas ? Rec->second.Last.value_or(0) : 0; // the attempt is spent now and never refunded
		P.MissionRuns[K] = R;
		OutRun = FActivityRun{};
		OutRun.Id = Def.Id;
		OutRun.StartedAt = NowMs;
		OutRun.Difficulty = Difficulty;
		return true;
	}

	bool ChallengeMet(const FActivityDef& Def, const FActivityRun& Run, double NowMs)
	{
		if (!Def.ChallengeId) return false;
		const std::string& C = *Def.ChallengeId;
		if (C == "no-damage") return !Run.bWasHurt && !Run.bDiedDuring;
		if (C == "no-death") return !Run.bDiedDuring;
		if (C == "gold") return Run.Race && Run.Race->Result && Run.Race->Result->Medal == std::optional<std::string>("gold");
		return Def.TimeLimitSum > 0 && (NowMs - Run.StartedAt) / 1000 <= Def.TimeLimitSum * 0.6;
	}

	bool CompleteActivity(FProgression& P, const FActivityDef& Def, const FActivityRun& Run, double NowMs, bool bFeatured, FPayout& OutPayout, std::string& OutError)
	{
		if (Run.Status != "complete" || Run.Id != Def.Id) { OutError = "Not complete"; return false; }
		const bool bBonus = ChallengeMet(Def, Run, NowMs);
		const FRewards& R = Def.Rewards;
		const std::string K = RecKey(Def.Id);
		const auto Rec = P.MissionRuns.find(K);
		const bool bHas = Rec != P.MissionRuns.end();
		const double Taper = Def.Kind == "crucible" && (bHas ? Rec->second.Count : 1) > 5 ? 0.1 : 1;
		const double Mult = (bBonus ? 1.25 : 1) * (bFeatured ? 1.5 : 1) * Taper;
		const std::string ClaimKey = "activity:" + Def.Id + ":" + (bHas ? Rec->second.Day : PeriodKey(Def, NowMs)) + ":" + js::NumberToString(bHas ? Rec->second.Count : 1);
		if (P.NexLedger.count(ClaimKey)) { OutError = "Already claimed"; return false; }
		FProgression::FRunRecord NewRec;
		if (bHas) NewRec = Rec->second;
		else { NewRec.Day = PeriodKey(Def, NowMs); NewRec.Count = 1; }
		NewRec.Last = NowMs;
		P.MissionRuns[K] = NewRec;
		FPayout Pay;
		Pay.bBonus = bBonus;
		Pay.bFeatured = bFeatured;
		Pay.Nex = js::Round(R.Nex * Mult);
		Pay.Rep = js::Round(R.Rep * Mult);
		P.NexLedger[ClaimKey] = Pay.Nex;
		// pays the listed XP: a MISSION grant is 1,200 base, so scale by xp / 1,200
		P = reward::GrantXP(std::move(P), "MISSION", std::nullopt, std::nullopt, std::nullopt, (R.Xp / 1200) * Mult).Progression;
		const std::string FirstCatalyst = "activity-first-catalyst:" + Def.Id;
		const bool bCatalystPaid = std::find(P.EarnedRewards.begin(), P.EarnedRewards.end(), FirstCatalyst) != P.EarnedRewards.end();
		for (const auto& [Id, N] : R.Materials)
		{
			if (Id == "forgeCatalyst" && bCatalystPaid) continue;
			const double Amt = Id == "forgeCatalyst" ? N : js::Round(N * Mult);
			if (Amt > 0) { Pay.Materials[Id] = Amt; P.Materials[Id] += Amt; }
		}
		if (Pay.Materials.count("forgeCatalyst") && Pay.Materials["forgeCatalyst"] != 0 && !bCatalystPaid) P.EarnedRewards.push_back(FirstCatalyst);
		AddReputation(P, Def.Faction, Pay.Rep);
		Pay.Xp = js::Round(R.Xp * Mult);
		OutPayout = Pay;
		return true;
	}
}
