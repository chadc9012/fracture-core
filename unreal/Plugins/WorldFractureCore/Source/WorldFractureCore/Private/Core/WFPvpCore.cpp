#include "Core/WFPvpCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numbers>

namespace wf::pvp
{
	namespace
	{
		constexpr double PvPi = std::numbers::pi;
		const std::vector<std::string> PvClasses{"TITAN", "HUNTER", "WARLOCK"};

		/** pvp.ts rnd: a deterministic 0..1 from the state's seed (advances it) */
		double PvRnd(FState& St)
		{
			St.Seed = static_cast<uint32_t>((St.Seed ^ 0x5bd1e995u) * 1103515245u) + 12345u;
			return static_cast<double>(St.Seed % 100000u) / 100000;
		}
		double PvRoundTime(const FMode& M) { return M.RoundTime > 0 ? M.RoundTime : 90; }
		std::string PvClock(double S)
		{
			const std::string Sec = js::NumberToString(std::floor(std::fmod(S, 60)));
			return js::NumberToString(std::floor(S / 60)) + ":" + (Sec.size() < 2 ? "0" + Sec : Sec);
		}
		std::string PvN(double V) { return js::NumberToString(V); }

		void PvFront(FState& St, const FMode& M, double Dt)
		{
			const double Ours = std::max(0, M.TeamSize - Fireteam), Theirs = std::max(0, M.TeamSize - M.OnField);
			if (PvRnd(St) < Dt * FrontRate * Ours) St.Us += 1;
			if (PvRnd(St) < Dt * FrontRate * Theirs) St.Them += 1;
		}
		void PvZones(FState& St, const FEvents& E)
		{
			for (FZone& Z : St.Zones)
			{
				const bool bHere = js::Hypot(E.Px - Z.Dx, E.Pz - Z.Dz) < ZoneRadius;
				if (bHere) Z.Cap = std::min(1.0, Z.Cap + E.Dt / ZoneCaptureS);
				else if (PvRnd(St) < E.Dt / 30) Z.Cap = PvRnd(St) < 0.5 ? 1 : -1; // the off-field fight trades the others
				Z.Owner = Z.Cap >= 1 ? std::string("us") : Z.Cap <= -1 ? std::string("them") : Z.Owner;
			}
			const double Before = std::floor((St.Clock - E.Dt) / ZoneTickS), Now = std::floor(St.Clock / ZoneTickS);
			if (Now > Before)
				for (const FZone& Z : St.Zones)
				{
					if (Z.Owner == "us") St.Us += 1;
					else if (Z.Owner == "them") St.Them += 1;
				}
		}
		void PvEndRound(FState& St, const FMode& M, bool bWon, const char* Why)
		{
			if (bWon) St.UsRounds += 1; else St.ThemRounds += 1;
			St.Reason = Why; St.RoundOver = 3;
			St.Round += 1; St.RoundClock = 0; St.Plant = 0; St.ZoneHold = 0; St.RoundRivalsLeft = M.OnField;
			if (M.Id == "lockdown") St.bAttacking = !St.bAttacking;
			St.Us = St.UsRounds; St.Them = St.ThemRounds;
		}
		void PvRounds(FState& St, const FMode& M, const FEvents& E)
		{
			if (St.RoundOver > 0) { St.RoundOver = std::max(0.0, St.RoundOver - E.Dt); return; }
			St.RoundClock += E.Dt;
			St.RoundRivalsLeft = E.RivalsAlive;
			const bool bOnObjective = js::Hypot(E.Px, E.Pz) < ZoneRadius;
			if (E.bDied) { PvEndRound(St, M, false, "You went down"); return; }
			if (St.RoundClock > 1 && E.RivalsAlive == 0) { PvEndRound(St, M, true, "Rivals wiped"); return; }
			const double Rt = PvRoundTime(M);
			if (M.Id == "lockdown")
			{
				if (St.bAttacking)
				{
					if (bOnObjective) St.ZoneHold += E.Dt; else St.ZoneHold = std::max(0.0, St.ZoneHold - E.Dt);
					if (St.ZoneHold >= RoundZoneS + 2) { PvEndRound(St, M, true, "Objective secured"); return; }
					if (St.RoundClock >= Rt) { PvEndRound(St, M, false, "Out of time"); return; }
				}
				else
				{
					if (!bOnObjective) St.Plant += E.Dt / 12; else St.Plant = std::max(0.0, St.Plant - E.Dt / 6);
					if (St.Plant >= 1) { PvEndRound(St, M, false, "The objective fell"); return; }
					if (St.RoundClock >= Rt) { PvEndRound(St, M, true, "Held the line"); return; }
				}
				return;
			}
			if (St.RoundClock >= Rt)
			{
				if (bOnObjective) St.ZoneHold += E.Dt; else St.Plant += E.Dt / 15;
				if (St.ZoneHold >= RoundZoneS) { PvEndRound(St, M, true, "Zone captured"); return; }
				if (St.Plant >= 1) { PvEndRound(St, M, false, "They took the zone"); return; }
			}
		}
		void PvRoyale(FState& St, const FMode& M, const FEvents& E)
		{
			const FCircle Z = RoyaleRadius(St.Clock);
			St.Radius = Z.Radius; St.Phase = Z.Phase;
			if (E.bDied)
			{
				St.Result = "loss";
				St.Reason = "Eliminated · placed " + PvN(std::ceil(St.Alive / M.TeamSize)) + " of " + PvN(static_cast<double>(M.Players) / M.TeamSize);
				return;
			}
			const double Others = St.Alive - M.TeamSize;
			const double Fall = Others > 0 ? Others * E.Dt / std::max(20.0, (RoyalePhaseHold + RoyalePhaseShrink) * RoyalePhases - St.Clock) : 0;
			const double Drop = PvRnd(St) < Fall ? 1 : 0;
			St.Alive = std::max(static_cast<double>(M.TeamSize), St.Alive - E.Kills - Drop);
			St.Us = E.Kills + St.Us; St.Them = St.Alive;
		}
		void PvDecide(FState& St, const FMode& M)
		{
			if (!St.Result.empty()) return;
			if (M.Kind == "royale") { if (St.Alive <= M.TeamSize) { St.Result = "win"; St.Reason = "Last squad standing"; } return; }
			if (M.Kind == "rounds")
			{
				if (St.UsRounds >= M.Target) { St.Result = "win"; St.Reason = PvN(St.UsRounds) + "–" + PvN(St.ThemRounds); }
				else if (St.ThemRounds >= M.Target) { St.Result = "loss"; St.Reason = PvN(St.UsRounds) + "–" + PvN(St.ThemRounds); }
				return;
			}
			if (St.Us >= M.Target) { St.Result = "win"; St.Reason = PvN(St.Us) + "–" + PvN(St.Them); return; }
			if (St.Them >= M.Target) { St.Result = "loss"; St.Reason = M.Kind == "ffa" ? std::string("Another operator reached the target") : PvN(St.Us) + "–" + PvN(St.Them); return; }
			if (M.TimeLimit > 0 && St.Clock >= M.TimeLimit)
			{
				St.Result = St.Us > St.Them ? "win" : "loss";
				St.Reason = "Time · " + PvN(St.Us) + "–" + PvN(St.Them);
			}
		}
		FSpawn PvSpawn(int Slot, const std::string& Cls, const FFieldWorld& World)
		{
			FSpawn S;
			S.Slot = Slot; S.Class = Cls;
			S.Angle = World.Rand() * PvPi * 2;
			S.Cool = 1.2 + World.Rand();
			return S;
		}
		double& PvAt(std::vector<double>& V, int I) { if (static_cast<size_t>(I) >= V.size()) V.resize(static_cast<size_t>(I) + 1, 0); return V[static_cast<size_t>(I)]; }
	}

	const FCrucibleMode* CrucibleMode(const std::string& Id)
	{
		static const std::vector<FCrucibleMode> Modes{
			{"duel", "Duel", 1, 5, "One rival operator, first to five eliminations."},
			{"skirmish", "Skirmish", 3, 10, "Free-for-all against three rival operators, first to ten."},
		};
		for (const FCrucibleMode& M : Modes) if (M.Id == Id) return &M;
		return nullptr;
	}
	std::string RivalLabel(const std::string& Class) { return Class == "TITAN" ? "GOLIATH" : Class == "HUNTER" ? "NYX" : "CIPHER"; }
	std::vector<std::string> RivalLineup(const std::string& Mode, const std::string& PlayerClass)
	{
		if (Mode == "duel")
		{
			for (const std::string& C : PvClasses) if (C != PlayerClass) return {C};
			return {"HUNTER"};
		}
		const FCrucibleMode* M = CrucibleMode(Mode);
		const size_t N = M ? static_cast<size_t>(M->Rivals) : 0;
		return std::vector<std::string>(PvClasses.begin(), PvClasses.begin() + static_cast<std::ptrdiff_t>(std::min(N, PvClasses.size())));
	}
	std::vector<std::string> RivalSquad(int N, int Offset)
	{
		std::vector<std::string> Out;
		for (int I = 0; I < N; ++I) Out.push_back(PvClasses[static_cast<size_t>(((I + Offset) % 3 + 3) % 3)]);
		return Out;
	}
	FField NewCrucible(const std::string& Mode)
	{
		FField F;
		F.Mode = Mode;
		const FCrucibleMode* M = CrucibleMode(Mode);
		F.Respawn.assign(M ? static_cast<size_t>(M->Rivals) : 0, 0);
		return F;
	}

	std::vector<FSpawn> StepRivals(FField& St, const std::string& PlayerClass, double Dt, const FFieldWorld& World)
	{
		std::vector<FSpawn> Out;
		const std::vector<std::string> Lineup = RivalLineup(St.Mode, PlayerClass);
		for (size_t I = 0; I < Lineup.size(); ++I)
		{
			const int Slot = static_cast<int>(I);
			if (World.SlotAlive(Slot)) { PvAt(St.Respawn, Slot) = RivalRespawnS; continue; }
			PvAt(St.Respawn, Slot) -= Dt;
			if (PvAt(St.Respawn, Slot) > 0) continue;
			if (!World.HasRoom()) continue;
			Out.push_back(PvSpawn(Slot, Lineup[I], World));
			PvAt(St.Respawn, Slot) = RivalRespawnS;
		}
		return Out;
	}

	std::vector<FSpawn> StepField(FField& St, const std::vector<std::string>& Lineup, bool bRespawn, double Dt, const FFieldWorld& World)
	{
		std::vector<FSpawn> Out;
		St.bSpentSet = true;
		auto Spent = [&St](int Slot) -> std::vector<bool>::reference { if (static_cast<size_t>(Slot) >= St.Spent.size()) St.Spent.resize(static_cast<size_t>(Slot) + 1, false); return St.Spent[static_cast<size_t>(Slot)]; };
		for (size_t I = 0; I < Lineup.size(); ++I)
		{
			const int Slot = static_cast<int>(I);
			if (World.SlotAlive(Slot)) { PvAt(St.Respawn, Slot) = RivalRespawnS; Spent(Slot) = true; continue; }
			if (!bRespawn && static_cast<size_t>(Slot) < St.Spent.size() && St.Spent[static_cast<size_t>(Slot)]) continue; // a read never grows it
			PvAt(St.Respawn, Slot) -= Dt;
			if (PvAt(St.Respawn, Slot) > 0) continue;
			if (!World.HasRoom()) continue;
			Out.push_back(PvSpawn(Slot, Lineup[I], World));
			PvAt(St.Respawn, Slot) = RivalRespawnS;
			Spent(Slot) = true;
		}
		return Out;
	}

	void ResetField(FField& St)
	{
		St.Spent.clear();
		St.bSpentSet = true;
		for (double& R : St.Respawn) R = 0.8;
	}

	const std::vector<FMode>& Modes()
	{
		static const std::vector<FMode> All{
			{"clash", "Clash", "team", "6v6 team deathmatch", "Two teams of six. Every elimination scores for your team; first to 75 wins.", 6, 12, 3, 75, 600, 0, "killbox-clash", false},
			{"dominion", "Dominion", "zones", "6v6 objective control", "Hold zones A, B and C. Held zones tick points, eliminations add more; first to 150.", 6, 12, 3, 150, 600, 0, "killbox-dominion", false},
			{"freefall", "Freefall", "ffa", "12-player free-for-all", "Everyone for themselves. First to 20 eliminations, or the highest score when time runs out.", 1, 12, 4, 20, 480, 0, "killbox-freefall", false},
			{"lockdown", "Lockdown", "rounds", "4v4 attack and defend", "Rounds alternate: attack the objective and hold it, then defend it. No respawns in a round; first to 4 rounds.", 4, 8, 4, 4, 0, 90, "killbox-lockdown", false},
			{"ascendancy", "Killbox: Ascendancy", "rounds", "Elite 3v3 elimination", "Wipe the other three to take the round. At the buzzer a capture zone decides it. Downed stays down; first to 5.", 3, 6, 3, 5, 0, 90, "killbox-ascendancy", true},
			{"royale", "Fracture Royale", "royale", "60-player survival", "Twenty squads of three. Scavenge, fight and outrun the closing fracture; the last squad standing wins.", 3, 60, 3, 1, 0, 0, "killbox-royale", false},
		};
		return All;
	}
	const FMode* ModeById(const std::string& Id)
	{
		for (const FMode& M : Modes()) if (M.Id == Id) return &M;
		return nullptr;
	}
	const FMode* ModeForActivity(const std::string& ActivityId)
	{
		for (const FMode& M : Modes()) if (M.Activity == ActivityId) return &M;
		return nullptr;
	}

	FState NewPvp(const std::string& Mode, uint32_t Seed)
	{
		FState St;
		St.Mode = Mode;
		St.Seed = Seed;
		const FMode* M = ModeById(Mode);
		if (!M) return St;
		if (M->Kind == "ffa") St.Board.assign(static_cast<size_t>(M->Players), 0);
		if (M->Kind == "zones") St.Zones = {{"A", -22, 0, "", 0}, {"B", 0, 0, "", 0}, {"C", 22, 0, "", 0}};
		St.RoundRivalsLeft = M->Kind == "rounds" ? M->OnField : 0;
		St.Alive = M->Players;
		St.Radius = M->Kind == "royale" ? RoyaleStartRadius : 0;
		return St;
	}

	bool StepPvp(FState& St, const FEvents& E)
	{
		if (!St.Result.empty()) return true;
		const FMode* M = ModeById(St.Mode);
		if (!M) return false;
		St.Clock += E.Dt;
		if (M->Kind == "team")
		{
			St.Us += E.Kills; if (E.bDied) St.Them += 1;
			PvFront(St, *M, E.Dt);
		}
		else if (M->Kind == "zones")
		{
			St.Us += E.Kills; if (E.bDied) St.Them += 1;
			PvFront(St, *M, E.Dt);
			PvZones(St, E);
		}
		else if (M->Kind == "ffa")
		{
			St.Board[0] += E.Kills;
			if (E.bDied) { const size_t K = 1 + static_cast<size_t>(std::floor(PvRnd(St) * (M->Players - 1))); St.Board[K] += 1; }
			for (size_t I = 1; I < St.Board.size(); ++I) if (PvRnd(St) < E.Dt * FrontRate * 0.6) St.Board[I] += 1;
			St.Us = St.Board[0];
			St.Them = St.Board.size() > 1 ? *std::max_element(St.Board.begin() + 1, St.Board.end()) : -std::numeric_limits<double>::infinity();
		}
		else if (M->Kind == "rounds") PvRounds(St, *M, E);
		else if (M->Kind == "royale") PvRoyale(St, *M, E);
		PvDecide(St, *M);
		return !St.Result.empty();
	}

	FCircle RoyaleRadius(double T)
	{
		const double Step = RoyalePhaseHold + RoyalePhaseShrink;
		const double Phase = std::min(static_cast<double>(RoyalePhases), std::floor(T / Step));
		auto R = [](double P) { return RoyaleStartRadius + (RoyaleFinalRadius - RoyaleStartRadius) * (P / RoyalePhases); };
		if (Phase >= RoyalePhases) return {RoyaleFinalRadius, Phase, false};
		const double Into = T - Phase * Step;
		if (Into < RoyalePhaseHold) return {R(Phase), Phase, false};
		const double K = (Into - RoyalePhaseHold) / RoyalePhaseShrink;
		return {R(Phase) + (R(Phase + 1) - R(Phase)) * K, Phase, true};
	}

	double StormDamage(const FState& St, double Dist)
	{
		static const double Dps[5] = {2, 3, 5, 8, 12};
		return Dist > St.Radius ? Dps[static_cast<size_t>(std::min(4.0, St.Phase))] : 0;
	}

	int FieldSize(const FState& St)
	{
		const FMode* M = ModeById(St.Mode);
		if (!M) return 0;
		if (M->Kind == "rounds") return St.RoundOver > 0 ? 0 : M->OnField;
		if (M->Kind == "royale") return static_cast<int>(std::min(static_cast<double>(M->OnField), std::max(0.0, St.Alive - M->TeamSize)));
		return M->OnField;
	}
	bool Respawns(const FState& St)
	{
		const FMode* M = ModeById(St.Mode);
		return M && M->Kind != "rounds";
	}

	std::string PvpLine(const FState& St)
	{
		const FMode* M = ModeById(St.Mode);
		if (!M) return "";
		const std::string Left = M->TimeLimit > 0 ? " · " + PvClock(std::max(0.0, M->TimeLimit - St.Clock)) : "";
		if (M->Kind == "team") return "Us " + PvN(St.Us) + " – " + PvN(St.Them) + " Them" + Left;
		if (M->Kind == "zones")
		{
			std::string Zs;
			for (const FZone& Z : St.Zones) Zs += (Zs.empty() ? "" : " ") + Z.Id + (Z.Owner == "us" ? "●" : Z.Owner == "them" ? "○" : "·");
			return "Us " + PvN(St.Us) + " – " + PvN(St.Them) + " Them · " + Zs + Left;
		}
		if (M->Kind == "ffa")
		{
			double Rank = 1;
			for (size_t I = 1; I < St.Board.size(); ++I) if (St.Board[I] > St.Board[0]) Rank += 1;
			const char* Suffix = Rank == 1 ? "st" : Rank == 2 ? "nd" : Rank == 3 ? "rd" : "th";
			return "You " + PvN(St.Board.empty() ? 0 : St.Board[0]) + " · leader " + PvN(St.Them) + " · " + PvN(Rank) + Suffix + " of " + PvN(M->Players) + Left;
		}
		if (M->Kind == "rounds")
		{
			const double Rt = PvRoundTime(*M);
			const bool bZone = St.RoundClock >= Rt;
			std::string Role;
			if (M->Id == "lockdown") Role = St.bAttacking ? std::string("ATTACK") : "DEFEND · plant " + PvN(js::Round(St.Plant * 100)) + "%";
			else if (bZone) Role = "ZONE OPEN — take the centre";
			else Role = PvN(St.RoundRivalsLeft) + " rival" + (St.RoundRivalsLeft == 1 ? "" : "s") + " left";
			return "Round " + PvN(St.Round) + " · " + PvN(St.UsRounds) + "–" + PvN(St.ThemRounds) + " · " + (St.RoundOver > 0 ? St.Reason : Role + " · " + PvClock(std::max(0.0, Rt - St.RoundClock)));
		}
		const FCircle Z = RoyaleRadius(St.Clock);
		return PvN(St.Alive) + " alive · " + PvN(std::ceil(St.Alive / M->TeamSize)) + " squads · circle " + PvN(js::Round(Z.Radius)) + " m" + (Z.bClosing ? " CLOSING" : "");
	}
}
