// World Fracture — boss fights. See WFEncounterCore.h.
#include "Core/WFEncounterCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <set>

namespace wf::encounter
{
	namespace
	{
		constexpr double EncounterPi = 3.14159265358979323846;

		const FPhaseTuning RegionalPhases[3] = {
			{"ENGAGED", "Reading your approach.", 1, 1, 1},
			{"OVERDRIVEN", "Systems overdriving \xE2\x80\x94 faster, harder hits.", 1.2, 1.3, 0.85},
			{"OVERLOADED", "Critical overload \xE2\x80\x94 maximum output, slower recovery.", 1.4, 1.6, 1.3},
		};

		FEncounterState Fresh(const FBoss& M)
		{
			FEncounterState E;
			E.Tx = M.X; E.Tz = M.Z; E.Cx = M.X; E.Cz = M.Z;
			return E;
		}

		bool HasEncounter(const FCatalog& C, const FBoss& M) { return M.ScenarioId && C.Find(*M.ScenarioId); }

		struct FEmit
		{
			std::string Kind, Text;
			std::optional<std::string> Attack;
			double X = 0, Z = 0, Radius = 0, Duration = 0;
			std::optional<bool> Hit;
			std::optional<std::string> ScenarioId;
			std::optional<int> Phase;
		};

		void Emit(const FCatalog& C, FArena& A, const FBoss* M, const FEmit& E, double Now)
		{
			const std::optional<std::string> Sid = M && M->ScenarioId ? M->ScenarioId : E.ScenarioId;
			const FEncounterDef* Def = Sid ? C.Find(*Sid) : nullptr;
			const int Phase = M && M->Encounter ? M->Encounter->Phase : E.Phase.value_or(0);
			FEvent Ev;
			Ev.Id = A.NextEventId++;
			Ev.Kind = E.Kind;
			Ev.ScenarioId = Sid.value_or("");
			Ev.Phase = Phase;
			Ev.PhaseName = Def && Phase >= 0 && static_cast<size_t>(Phase) < Def->Phases.size() ? Def->Phases[static_cast<size_t>(Phase)].Name : std::string();
			Ev.Attack = E.Attack;
			Ev.Text = E.Text;
			Ev.X = E.X; Ev.Z = E.Z; Ev.Radius = E.Radius; Ev.Duration = E.Duration;
			Ev.Hit = E.Hit;
			Ev.At = Now;
			A.Events.push_back(Ev);
			if (A.Events.size() > MaxEvents) A.Events.erase(A.Events.begin(), A.Events.begin() + static_cast<long>(A.Events.size() - MaxEvents));
		}

		void AddZone(FArena& A, const std::string& ScenarioId, const FZoneSpec& Spec, double X, double Z, const std::string& Scope, double Now, std::optional<FZone::FOrbit> Orbit = std::nullopt)
		{
			FZone Zn;
			Zn.Id = A.NextZoneId++;
			Zn.ScenarioId = ScenarioId; Zn.Name = Spec.Name; Zn.Kind = Spec.Kind;
			Zn.X = X; Zn.Z = Z; Zn.Radius = Spec.Radius; Zn.Dps = Spec.Dps; Zn.Slow = Spec.Slow;
			Zn.ArmAt = Now + Spec.Arm; Zn.Until = Now + Spec.Life; Zn.Scope = Scope; Zn.Orbit = Orbit;
			A.Zones.push_back(Zn);
		}

		void SpawnZones(const FCatalog& C, FArena& A, const FBoss& M, const FEncounterState& Enc, const FZoneSpec& Spec, const std::string& Scope, double Now, double Px, double Pz)
		{
			const std::string& Id = *M.ScenarioId;
			for (int I = 0; I < static_cast<int>(Spec.Count); ++I)
			{
				const double Ang = (I / Spec.Count) * EncounterPi * 2 + Enc.Cursor * 0.7;
				if (Spec.Place == "PLAYER")
				{
					const double R = Spec.RingRadius.value_or(10);
					AddZone(A, Id, Spec, I == 0 ? Px : Px + std::sin(Ang) * R, I == 0 ? Pz : Pz + std::cos(Ang) * R, Scope, Now);
				}
				else if (Spec.Place == "RING")
				{
					const double A2 = (I / Spec.Count) * EncounterPi * 2 + EncounterPi / 4;
					const double R = Spec.RingRadius.value_or(20);
					AddZone(A, Id, Spec, Enc.Cx + std::sin(A2) * R, Enc.Cz + std::cos(A2) * R, Scope, Now);
				}
				else
				{
					const double R = Spec.RingRadius.value_or(12);
					AddZone(A, Id, Spec, M.X + std::sin(Ang) * R, M.Z + std::cos(Ang) * R, Scope, Now, FZone::FOrbit{M.X, M.Z, R, Ang, Spec.OrbitSpeed.value_or(0.5)});
				}
			}
			FEmit E;
			E.Kind = "ZONE"; E.Text = Spec.Name;
			E.X = Spec.Place == "PLAYER" ? Px : M.X; E.Z = Spec.Place == "PLAYER" ? Pz : M.Z;
			E.Radius = Spec.Radius; E.Duration = Spec.Arm;
			Emit(C, A, &M, E, Now);
		}

		void RemoveZones(FArena& A, const std::string& ScenarioId, bool bPhaseOnly)
		{
			A.Zones.erase(std::remove_if(A.Zones.begin(), A.Zones.end(), [&](const FZone& Z) { return Z.ScenarioId == ScenarioId && (!bPhaseOnly || Z.Scope == "phase"); }), A.Zones.end());
		}

		void EnterPhase(const FCatalog& C, FArena& A, FBoss& M, const FEncounterDef& Def, FEncounterState& Enc, int Index, double Now, double Px, double Pz)
		{
			Enc.Phase = Index; Enc.State = "IDLE"; Enc.Timer = 2.5; Enc.Cursor = 0; Enc.Atk.reset(); Enc.SinceFinale = 0; Enc.FinaleUntil = 0;
			RemoveZones(A, *M.ScenarioId, true);
			const FPhaseDef& Phase = Def.Phases[static_cast<size_t>(Index)];
			if (Phase.Arena) SpawnZones(C, A, M, Enc, *Phase.Arena, "phase", Now, Px, Pz);
			FEmit E;
			E.Kind = "PHASE"; E.Text = Phase.Nova; E.X = M.X; E.Z = M.Z;
			Emit(C, A, &M, E, Now);
		}

		void SpawnDecoys(const FCatalog& C, FArena& A, const FBoss& Boss, const FEncounterState& Enc, double Count, double Now)
		{
			const size_t Live = A.Decoys.size();
			for (int I = 0; I < static_cast<int>(Count) && static_cast<int>(Live) + I < MaxDecoys; ++I)
			{
				const double Ang = (I / Count) * EncounterPi * 2 + Enc.Cursor;
				// 16 m out, beyond machine separation, so copies stay readable
				FDecoy D{A.NextDecoyId++, Boss.X + std::sin(Ang) * 16, Boss.Z + std::cos(Ang) * 16};
				A.Decoys.push_back(D);
				FEmit E;
				E.Kind = "DECOY"; E.Text = "False Saint"; E.X = D.X; E.Z = D.Z;
				Emit(C, A, &Boss, E, Now);
			}
		}

		/** the boss calls in real troops, spread around it at 18 m (outside machine separation, inside the arena) */
		/** sim.machines.find(!alive): the lowest slot no summon holds (slot 0 is the boss) */
		int EnFreeSlot(const FArena& A)
		{
			for (int Slot = 1;; ++Slot)
				if (std::none_of(A.Summons.begin(), A.Summons.end(), [Slot](const FSummon& S) { return S.Slot == Slot; })) return Slot;
		}

		void SpawnSummons(const FCatalog& C, FArena& A, const FBoss& Boss, const FEncounterState& Enc, const std::vector<FSummonGroup>& Groups, double Now)
		{
			// turrets do not count against the cap
			size_t Live = static_cast<size_t>(std::count_if(A.Summons.begin(), A.Summons.end(), [](const FSummon& S) { return !IsTurret(S); }));
			int Made = 0;
			double Total = 0;
			for (const FSummonGroup& G : Groups) Total += G.Count;
			for (const FSummonGroup& G : Groups)
				for (int I = 0; I < static_cast<int>(G.Count) && Live < static_cast<size_t>(MaxSummoned); ++I)
				{
					const double Ang = ((Made + 0.5) / Total) * EncounterPi * 2 + Enc.Cursor * 1.3;
					FSummon S;
					S.Id = A.NextSummonId++;
					S.Slot = EnFreeSlot(A);
					S.ScenarioId = Boss.ScenarioId.value_or("");
					S.Profile = G.Profile; S.Kind = G.Kind; S.Scale = G.Scale; S.bElite = G.bElite;
					S.X = Boss.X + std::sin(Ang) * 18; S.Z = Boss.Z + std::cos(Ang) * 18;
					S.Hp = G.Hp * A.EnemyHpScale;
					A.Summons.push_back(S);
					FEmit E;
					E.Kind = "SUMMON"; E.Text = G.Profile; E.X = S.X; E.Z = S.Z;
					Emit(C, A, &Boss, E, Now);
					++Live; ++Made;
				}
		}

		/** Resolves an attack at the end of its tell. */
		void Impact(const FCatalog& C, FArena& A, FBoss& M, FEncounterState& Enc, const FAttackDef& Atk, double Now, double Px, double Pz)
		{
			bool bHit = false;
			double X = M.X, Z = M.Z, Radius = Atk.Radius.value_or(0);
			if (Atk.Kind == "SLAM") bHit = InCircle(Px, Pz, M.X, M.Z, Atk.Radius.value_or(8));
			else if (Atk.Kind == "POUNCE")
			{
				M.X = Enc.Tx; M.Z = Enc.Tz; X = M.X; Z = M.Z;
				bHit = InCircle(Px, Pz, M.X, M.Z, Atk.Radius.value_or(6));
			}
			else if (Atk.Kind == "LUNGE")
			{
				const double Ax = M.X, Az = M.Z;
				double D = std::hypot(Enc.Tx - Ax, Enc.Tz - Az);
				if (D == 0) D = 1;
				const double Reach = std::min(D + 4, 34.0); // overshoots the snapshot a little, never across the map
				const double Bx = Ax + ((Enc.Tx - Ax) / D) * Reach, Bz = Az + ((Enc.Tz - Az) / D) * Reach;
				bHit = DistToSegment(Px, Pz, Ax, Az, Bx, Bz) <= Atk.Width.value_or(3) / 2 + 1;
				M.X = Bx; M.Z = Bz; Radius = Atk.Width.value_or(3) / 2;
			}
			else if (Atk.Kind == "FAN")
			{
				bHit = InFan(Px, Pz, M.X, M.Z, Enc.Tx, Enc.Tz, Atk.Arc.value_or(0.3), Atk.Reach.value_or(40));
				Radius = Atk.Reach.value_or(40);
			}
			else if (Atk.Kind == "FIELD") { if (Atk.Zones) SpawnZones(C, A, M, Enc, *Atk.Zones, "attack", Now, Px, Pz); }
			else if (Atk.Kind == "CLONES") SpawnDecoys(C, A, M, Enc, Atk.Decoys.value_or(3), Now);
			else if (Atk.Kind == "SUMMON") { if (!Atk.Summon.empty()) SpawnSummons(C, A, M, Enc, Atk.Summon, Now); }
			if (bHit && Atk.Damage > 0) A.Hits.push_back({Atk.Damage, Atk.Label});
			if (Atk.Kind != "FIELD" && Atk.Kind != "CLONES" && Atk.Kind != "SUMMON")
			{
				FEmit E;
				E.Kind = "IMPACT"; E.Attack = Atk.Id; E.Text = Atk.Label; E.X = X; E.Z = Z; E.Radius = Radius; E.Hit = bHit;
				Emit(C, A, &M, E, Now);
			}
		}

		const FAttackDef* PickNext(const FEncounterDef& Def, const FPhaseDef& Phase, FEncounterState& Enc, double D)
		{
			if (Phase.Finale && Enc.SinceFinale >= static_cast<double>(Phase.Attacks.size()))
			{
				const auto F = Def.Attacks.find(Phase.Finale->Attack);
				return F == Def.Attacks.end() ? nullptr : &F->second;
			}
			const size_t N = Phase.Attacks.size();
			for (size_t I = 0; I < N; ++I)
			{
				const auto F = Def.Attacks.find(Phase.Attacks[(static_cast<size_t>(Enc.Cursor) + I) % N]);
				if (F != Def.Attacks.end() && D >= F->second.MinRange && D <= F->second.MaxRange)
				{
					Enc.Cursor = Enc.Cursor + static_cast<double>(I) + 1;
					return &F->second;
				}
			}
			return nullptr;
		}

		void StepBoss(const FCatalog& C, FArena& A, FBoss& M, double Dt, double Px, double Pz, double Now)
		{
			const FEncounterDef* DefP = C.Find(*M.ScenarioId);
			if (!DefP) return;
			const FEncounterDef& Def = *DefP;
			if (!M.Encounter) M.Encounter = Fresh(M);
			FEncounterState& Enc = *M.Encounter;
			const double MaxHp = M.MaxHp;
			if (Def.Truce && !Enc.bTruce && M.Hp / MaxHp <= Def.Truce->Below)
			{
				Enc.bTruce = true; Enc.TruceAt = Now; Enc.State = "IDLE"; Enc.Atk.reset();
				RemoveZones(A, *M.ScenarioId, false);
				M.Poise = FPoise{};
				FEmit E;
				E.Kind = "TRUCE"; E.Text = Def.Truce->Nova; E.X = M.X; E.Z = M.Z;
				Emit(C, A, &M, E, Now);
			}
			if (Enc.bTruce)
			{
				M.Hp = std::max(M.Hp, MaxHp * Def.Truce->FloorFrac);
				if (Now - Enc.TruceAt.value_or(Now) > TruceDepartSeconds) // withdraws: no kill, no drops
				{
					M.bAlive = false;
					FEmit E;
					E.Kind = "DEPART"; E.Text = M.Profile + " withdraws to its lair"; E.X = M.X; E.Z = M.Z;
					Emit(C, A, &M, E, Now);
					M.ScenarioId.reset();
					M.Encounter.reset();
					M.PlayerHits = 0;
				}
				return;
			}
			const int Target = PhaseIndexFor(Def, M.Hp / MaxHp);
			if (Target > Enc.Phase) EnterPhase(C, A, M, Def, Enc, Target, Now, Px, Pz);
			const FPhaseDef& Phase = Def.Phases[static_cast<size_t>(Enc.Phase)];
			const double D = std::hypot(Px - M.X, Pz - M.Z);
			if (D > EngageRange) return;

			if (Enc.State == "TELL")
			{
				if (IsStaggered(M.Poise, Now)) // a stagger interrupts the wind-up
				{
					FEmit E;
					E.Kind = "INTERRUPT"; E.Attack = Enc.Atk; E.Text = "Attack interrupted"; E.X = M.X; E.Z = M.Z;
					Emit(C, A, &M, E, Now);
					Enc.State = "RECOVER"; Enc.Timer = 0.8; Enc.Atk.reset();
					return;
				}
				Enc.Timer -= Dt;
				if (Enc.Timer > 0) return;
				const FAttackDef& Atk = Def.Attacks.at(*Enc.Atk);
				Impact(C, A, M, Enc, Atk, Now, Px, Pz);
				Enc.SinceFinale += 1;
				const bool bFinale = Phase.Finale && Atk.Id == Phase.Finale->Attack;
				if (bFinale)
				{
					Enc.SinceFinale = 0;
					Enc.FinaleUntil = Now + Phase.Finale->Window;
					M.Poise = FPoise{0, Enc.FinaleUntil, Enc.FinaleUntil};
					FEmit E;
					E.Kind = "FINALE"; E.Text = Phase.Finale->Nova; E.X = M.X; E.Z = M.Z; E.Duration = Phase.Finale->Window;
					Emit(C, A, &M, E, Now);
				}
				else if (Atk.Window > 0)
				{
					M.Poise = OpenWeakPoint(M.Poise, Now);
					M.Poise.WeakPointUntil = std::min(M.Poise.WeakPointUntil, Now + Atk.Window); // this attack's authored opening
				}
				Enc.State = "RECOVER"; Enc.Timer = Atk.Recovery; Enc.Atk.reset();
				return;
			}
			if (Enc.State == "RECOVER")
			{
				Enc.Timer -= Dt;
				if (Enc.Timer <= 0) { Enc.State = "IDLE"; Enc.Timer = Phase.Gap; }
				return;
			}
			// IDLE: a stunned boss starts no new attack
			if (M.Cool > 0) return;
			Enc.Timer -= Dt;
			if (Enc.Timer > 0) return;
			const FAttackDef* Atk = PickNext(Def, Phase, Enc, D);
			if (!Atk) { Enc.Timer = 0.5; return; }
			Enc.State = "TELL"; Enc.Atk = Atk->Id; Enc.Timer = Atk->TellTime; Enc.TellTotal = Atk->TellTime; Enc.Tx = Px; Enc.Tz = Pz;
			FEmit E;
			E.Kind = "TELL"; E.Attack = Atk->Id; E.Text = Atk->Tell;
			E.X = Atk->Kind == "SLAM" ? M.X : Enc.Tx; E.Z = Atk->Kind == "SLAM" ? M.Z : Enc.Tz;
			E.Radius = Atk->Radius ? *Atk->Radius : Atk->Width ? *Atk->Width : Atk->Reach.value_or(0);
			E.Duration = Atk->TellTime;
			Emit(C, A, &M, E, Now);
		}

		void StepZones(FArena& A, double Dt, double Px, double Pz, double Now)
		{
			A.HazardSpeedMult = 1;
			if (A.Zones.empty()) return;
			A.Zones.erase(std::remove_if(A.Zones.begin(), A.Zones.end(), [Now](const FZone& Z) { return !(Z.Until > Now); }), A.Zones.end());
			for (FZone& Z : A.Zones)
			{
				if (Z.Orbit)
				{
					Z.Orbit->Ang += Z.Orbit->Speed * Dt;
					Z.X = Z.Orbit->Cx + std::sin(Z.Orbit->Ang) * Z.Orbit->R;
					Z.Z = Z.Orbit->Cz + std::cos(Z.Orbit->Ang) * Z.Orbit->R;
				}
				if (Now < Z.ArmAt || !InCircle(Px, Pz, Z.X, Z.Z, Z.Radius)) continue;
				if (Z.Kind == "SLOW") A.HazardSpeedMult = std::min(A.HazardSpeedMult, Z.Slow);
				if (Z.Dps > 0) A.Hits.push_back({Z.Dps * Dt, Z.Name});
			}
		}
	}

	// ---- poise ----
	FPoise DecayPoise(const FPoise& S, double Dt, double Now)
	{
		if (Now < S.StaggerUntil || S.Poise <= 0) return S;
		FPoise Out = S;
		Out.Poise = std::max(0.0, S.Poise - PoiseDecayPerSec * Dt);
		return Out;
	}

	FPoise HitPoise(const FPoise& S, double PoiseDamage, double Now, double& OutDamageMult)
	{
		const bool bStaggered = Now < S.StaggerUntil;
		const bool bWeak = !bStaggered && Now < S.WeakPointUntil;
		OutDamageMult = bStaggered ? StaggerDamageMult : bWeak ? WeakPointDamageMult : 1;
		if (bStaggered) return S;
		// just out of a stagger: the boss has its feet back, no poise builds for a moment
		if (Now < S.StaggerUntil + PoiseRefractory) return S;
		const double Poise = S.Poise + PoiseDamage;
		if (Poise >= PoiseMax) return FPoise{0, Now + StaggerDuration, Now + StaggerDuration};
		FPoise Out = S;
		Out.Poise = Poise;
		return Out;
	}

	FPoise OpenWeakPoint(const FPoise& S, double Now)
	{
		FPoise Out = S;
		Out.WeakPointUntil = std::max(S.WeakPointUntil, Now + WeakPointDuration);
		return Out;
	}

	// ---- regional phases ----
	int PhaseForHpFraction(double Fraction)
	{
		if (Fraction <= 0.3) return 2;
		if (Fraction <= 0.66) return 1;
		return 0;
	}
	const FPhaseTuning& TuningFor(int Phase) { return RegionalPhases[Phase >= 0 && Phase <= 2 ? Phase : 0]; }

	// ---- gimmicks ----
	std::string AttunedElement(double NowSec)
	{
		static const char* Order[4] = {"KINETIC", "THERMAL", "CRYO", "ARC"};
		return Order[static_cast<size_t>(std::fmod(std::floor(std::max(0.0, NowSec) / AttuneSeconds), 4.0))];
	}

	double GimmickMultiplier(const std::string& Gimmick, const std::string& Element, double NowSec, double Distance, std::vector<std::string>& InOutHistory)
	{
		const std::vector<std::string> Before = InOutHistory;
		InOutHistory.push_back(Element);
		if (InOutHistory.size() > HistoryLength) InOutHistory.erase(InOutHistory.begin(), InOutHistory.begin() + static_cast<long>(InOutHistory.size() - HistoryLength));
		if (Gimmick == "adaptive")
		{
			double Streak = 1;
			for (size_t I = Before.size(); I > 0 && Before[I - 1] == Element; --I) Streak += 1;
			const double Counter = Streak <= 3 ? 1 : std::max(0.3, 1 - (Streak - 3) * 0.2);
			const double Mixed = std::set<std::string>(InOutHistory.begin(), InOutHistory.end()).size() >= 3 && InOutHistory.size() >= 4 ? 1.3 : 1;
			return Counter * Mixed;
		}
		if (Gimmick == "attune") return Element == AttunedElement(NowSec) ? 1.25 : 0.3;
		if (Gimmick == "closing")
		{
			const double T = std::min(1.0, std::max(0.0, (Distance - CloseRange) / (FarRange - CloseRange)));
			return 1.2 - T * 1.08;
		}
		return 1;
	}

	// ---- encounters ----
	const FEncounterDef* FCatalog::Find(const std::string& Id) const
	{
		const auto F = Encounters.find(Id);
		return F == Encounters.end() ? nullptr : &F->second;
	}

	int PhaseIndexFor(const FEncounterDef& Def, double HpFraction)
	{
		int Idx = 0;
		for (size_t I = 0; I < Def.Phases.size(); ++I)
			if (HpFraction <= Def.Phases[I].Below + 1e-9) Idx = static_cast<int>(I);
		return Idx;
	}

	bool InCircle(double Px, double Pz, double Cx, double Cz, double R) { return std::hypot(Px - Cx, Pz - Cz) <= R; }

	double DistToSegment(double Px, double Pz, double Ax, double Az, double Bx, double Bz)
	{
		const double Dx = Bx - Ax, Dz = Bz - Az, L2 = Dx * Dx + Dz * Dz;
		const double T = L2 == 0 ? 0 : std::max(0.0, std::min(1.0, ((Px - Ax) * Dx + (Pz - Az) * Dz) / L2));
		return std::hypot(Px - (Ax + T * Dx), Pz - (Az + T * Dz));
	}

	bool InFan(double Px, double Pz, double Ox, double Oz, double Tx, double Tz, double Arc, double Reach)
	{
		const double D = std::hypot(Px - Ox, Pz - Oz);
		if (D > Reach) return false;
		if (D < 1e-6) return true;
		const double Aim = std::atan2(Tx - Ox, Tz - Oz), At = std::atan2(Px - Ox, Pz - Oz);
		double Diff = std::fmod(std::fabs(At - Aim), EncounterPi * 2);
		if (Diff > EncounterPi) Diff = EncounterPi * 2 - Diff;
		return Diff <= Arc;
	}

	void StepEncounters(const FCatalog& C, std::vector<FBoss*>& Bosses, FArena& A, double Dt, double Px, double Pz, double Now)
	{
		std::vector<FBoss*> Live;
		for (FBoss* M : Bosses) if (M && M->bAlive && M->bBoss && HasEncounter(C, *M)) Live.push_back(M);
		for (FBoss* M : Live) StepBoss(C, A, *M, Dt, Px, Pz, Now);
		if (Live.empty())
		{
			// no live encounter boss: nothing may keep damaging, slowing or masquerading as the boss
			A.Zones.clear();
			A.Decoys.clear();
			A.Summons.clear(); // called-in troops leave with the boss, paying nothing
		}
		if (!Live.empty()) StepSummonSkills(A, Dt, Px, Pz, Now);
		StepZones(A, Dt, Px, Pz, Now);
	}

	double EncounterHpFloor(const FCatalog& C, const FBoss& B, double Now)
	{
		const FEncounterDef* Def = B.ScenarioId ? C.Find(*B.ScenarioId) : nullptr;
		if (!Def || !B.Encounter) return 0;
		if (Def->Truce) return B.MaxHp * Def->Truce->FloorFrac; // non-lethal encounters can never be ended by damage
		const FPhaseDef& Phase = Def->Phases[static_cast<size_t>(B.Encounter->Phase)];
		if (!Phase.Finale) return 0;
		return Now < B.Encounter->FinaleUntil ? 0 : Phase.Finale->FloorHp;
	}

	void ResetEncounters(const FCatalog& C, std::vector<FBoss*>& Bosses, FArena& A, double Now)
	{
		A.Decoys.clear();
		A.Summons.clear();
		for (FBoss* M : Bosses)
		{
			if (!M || !M->bAlive || !M->bBoss || !HasEncounter(C, *M)) continue;
			const std::optional<FEncounterState> Old = M->Encounter;
			M->Hp = M->MaxHp;
			M->Poise = FPoise{};
			M->Cool = std::max(M->Cool, 2.0);
			if (Old) { M->X = Old->Cx; M->Z = Old->Cz; } // back to the arena centre
			M->Encounter = Fresh(*M);
			FEmit E;
			E.Kind = "RESET"; E.Text = "The encounter resets"; E.X = M->X; E.Z = M->Z;
			Emit(C, A, M, E, Now);
		}
		A.Zones.clear();
		A.HazardSpeedMult = 1;
	}

	void EndEncounter(const FCatalog& C, const FBoss& B, FArena& A, double Now)
	{
		const FEncounterDef* Def = B.ScenarioId ? C.Find(*B.ScenarioId) : nullptr;
		if (!Def) return;
		RemoveZones(A, *B.ScenarioId, false);
		A.Decoys.clear();
		A.Summons.clear();
		A.HazardSpeedMult = 1;
		FEmit E;
		E.Kind = "VICTORY"; E.Text = Def->Victory; E.X = B.X; E.Z = B.Z;
		Emit(C, A, &B, E, Now);
	}

	namespace
	{
		FSummon::FSkill& EnStateFor(FSummon& S, double Cd)
		{
			if (!S.Skill) { S.Skill = FSummon::FSkill{}; S.Skill->Cd = Cd; }
			return *S.Skill;
		}
		void EnFace(FSummon& S, double X, double Z) { S.Rot = std::atan2(X - S.X, Z - S.Z); }
		/** the summon in the lowest slot above After, or null */
		FSummon* EnNextBySlot(FArena& A, int After)
		{
			FSummon* Best = nullptr;
			for (FSummon& S : A.Summons) if (S.Slot > After && (!Best || S.Slot < Best->Slot)) Best = &S;
			return Best;
		}
	}

	void StepSummonSkills(FArena& A, double Dt, double Px, double Pz, double Now)
	{
		int Deployed = static_cast<int>(std::count_if(A.Summons.begin(), A.Summons.end(), [](const FSummon& S) { return IsTurret(S); }));
		// slot order, like the web build's machine loop: a turret deployed into a later slot is stepped this same frame
		for (int Cur = 0;;)
		{
			FSummon* M = EnNextBySlot(A, Cur);
			if (!M) break;
			Cur = M->Slot;
			const double D = js::Hypot(Px - M->X, Pz - M->Z);
			if (M->Profile == Turret)
			{
				FSummon::FSkill& Sk = EnStateFor(*M, 0);
				M->X = Sk.Ax; M->Z = Sk.Az; EnFace(*M, Px, Pz); // a turret never moves
				Sk.Life -= Dt;
				if (Sk.Life <= 0)
				{
					const double Id = M->Id;
					A.Summons.erase(std::remove_if(A.Summons.begin(), A.Summons.end(), [Id](const FSummon& S) { return S.Id == Id; }), A.Summons.end());
					--Deployed;
				}
				continue;
			}
			if (M->Profile == Reaver)
			{
				FSummon::FSkill& Sk = EnStateFor(*M, 2);
				Sk.Cd -= Dt;
				if (Sk.St == "IDLE")
				{
					if (Sk.Cd <= 0 && D > ReaverStrike.MinRange && D < ReaverStrike.MaxRange)
					{
						// aim at a point just BEHIND the player as seen from the Reaver, so the strike is a flank, not a charge
						const double Ux = (Px - M->X) / (D != 0 ? D : 1), Uz = (Pz - M->Z) / (D != 0 ? D : 1);
						Sk.St = "TELL"; Sk.T = ReaverStrike.Windup; Sk.Total = ReaverStrike.Windup; Sk.Ax = M->X; Sk.Az = M->Z;
						Sk.Tx = Px + Ux * ReaverStrike.Behind; Sk.Tz = Pz + Uz * ReaverStrike.Behind; Sk.Radius = ReaverStrike.Radius;
					}
				}
				else
				{
					M->X = Sk.Ax; M->Z = Sk.Az; EnFace(*M, Sk.Tx, Sk.Tz); // crouches in place while the strike is read
					Sk.T -= Dt;
					if (Sk.T <= 0)
					{
						M->X = Sk.Tx; M->Z = Sk.Tz;
						if (InCircle(Px, Pz, Sk.Tx, Sk.Tz, Sk.Radius)) A.Hits.push_back({ReaverStrike.Damage, Reaver});
						Sk.St = "IDLE"; Sk.Cd = ReaverStrike.Cooldown;
					}
				}
			}
			else if (M->Profile == Arcanist)
			{
				FSummon::FSkill& Sk = EnStateFor(*M, 3);
				Sk.Cd -= Dt;
				if (Sk.St == "IDLE")
				{
					if (Sk.Cd <= 0 && D < ArcanistOrb.MaxRange)
					{
						Sk.St = "TELL"; Sk.T = ArcanistOrb.Windup; Sk.Total = ArcanistOrb.Windup; Sk.Ax = M->X; Sk.Az = M->Z;
						Sk.Tx = Px; Sk.Tz = Pz; Sk.Radius = ArcanistOrb.Radius;
					}
				}
				else
				{
					M->X = Sk.Ax; M->Z = Sk.Az; EnFace(*M, Sk.Tx, Sk.Tz);
					Sk.T -= Dt;
					if (Sk.T <= 0)
					{
						if (InCircle(Px, Pz, Sk.Tx, Sk.Tz, Sk.Radius)) A.Hits.push_back({ArcanistOrb.Damage, Arcanist});
						FZone Z;
						Z.Id = A.NextZoneId++; Z.ScenarioId = "astravore"; Z.Name = "Void Orb pool"; Z.Kind = "SLOW";
						Z.X = Sk.Tx; Z.Z = Sk.Tz; Z.Radius = Sk.Radius * 0.8; Z.Dps = ArcanistOrb.PoolDps; Z.Slow = ArcanistOrb.PoolSlow;
						Z.ArmAt = Now; Z.Until = Now + ArcanistOrb.PoolLife; Z.Scope = "attack";
						A.Zones.push_back(Z);
						Sk.St = "IDLE"; Sk.Cd = ArcanistOrb.Cooldown;
					}
				}
			}
			else if (M->Profile == Sentinel)
			{
				FSummon::FSkill& Sk = EnStateFor(*M, 4); // keeps its own suppressing fire; the turrets are extra
				Sk.Cd -= Dt;
				if (Sk.St == "IDLE")
				{
					if (Sk.Cd <= 0 && D < SentinelDeploy.MaxRange && Deployed < MaxTurrets)
					{
						const double Ux = (Px - M->X) / (D != 0 ? D : 1), Uz = (Pz - M->Z) / (D != 0 ? D : 1);
						Sk.St = "TELL"; Sk.T = SentinelDeploy.Windup; Sk.Total = SentinelDeploy.Windup; Sk.Ax = M->X; Sk.Az = M->Z;
						Sk.Tx = M->X + Ux * SentinelDeploy.Distance; Sk.Tz = M->Z + Uz * SentinelDeploy.Distance; Sk.Radius = 1.8;
					}
				}
				else
				{
					Sk.T -= Dt;
					if (Sk.T <= 0)
					{
						const double Tx = Sk.Tx, Tz = Sk.Tz;
						Sk.St = "IDLE"; Sk.Cd = SentinelDeploy.Cooldown;
						if (Deployed < MaxTurrets)
						{
							// summon-skills.ts deployTurret: hp 2, scale 0.5, facing as the Sentinel; the push may move M
							FSummon T;
							T.Id = A.NextSummonId++; T.Slot = EnFreeSlot(A); T.ScenarioId = M->ScenarioId; T.Profile = Turret; T.Kind = "RAIDER";
							T.X = Tx; T.Z = Tz; T.Hp = 2; T.Scale = 0.5; T.bElite = false; T.Rot = M->Rot;
							T.Skill = FSummon::FSkill{}; T.Skill->Ax = Tx; T.Skill->Az = Tz; T.Skill->Life = TurretLife;
							A.Summons.push_back(T);
							++Deployed;
						}
					}
				}
			}
		}
		// remember where each troop stands before the engine's AI moves it
		for (FSummon& S : A.Summons) if (S.Skill) { S.Skill->Ox = S.X; S.Skill->Oz = S.Z; }
	}

	void StepSummonPins(FArena& A, double Dt, double Px, double Pz)
	{
		for (FSummon& M : A.Summons)
		{
			if (!M.Skill) continue;
			const FSummon::FSkill& Sk = *M.Skill;
			if (IsTurret(M) || ((M.Profile == Reaver || M.Profile == Arcanist) && Sk.St == "TELL")) { M.X = Sk.Ax; M.Z = Sk.Az; continue; }
			const double Dx = Px - Sk.Ox, Dz = Pz - Sk.Oz, Dd = js::Hypot(Dx, Dz), D = Dd != 0 ? Dd : 1, Ux = Dx / D, Uz = Dz / D;
			if (M.Profile == Reaver)
			{
				const double V = D > 2.5 ? ReaverSpeed : 0;
				M.X = Sk.Ox + Ux * V * Dt; M.Z = Sk.Oz + Uz * V * Dt; EnFace(M, Px, Pz);
			}
			else if (M.Profile == Arcanist)
			{
				const double V = D > ArcanistBandMax ? ArcanistSpeed : D < ArcanistBandMin ? -ArcanistSpeed : 0;
				M.X = Sk.Ox + Ux * V * Dt; M.Z = Sk.Oz + Uz * V * Dt; EnFace(M, Px, Pz);
			}
		}
	}

	FSummon& AddSummon(FArena& A, const std::string& ScenarioId, const std::string& Profile, const std::string& Kind, double X, double Z, double Hp, double Scale, bool bElite)
	{
		FSummon S;
		S.Id = A.NextSummonId++; S.Slot = EnFreeSlot(A); S.ScenarioId = ScenarioId;
		S.Profile = Profile; S.Kind = Kind; S.X = X; S.Z = Z; S.Hp = Hp; S.Scale = Scale; S.bElite = bElite;
		A.Summons.push_back(S);
		return A.Summons.back();
	}

	void OnSummonDefeated(FArena& A, double SummonId)
	{
		A.Summons.erase(std::remove_if(A.Summons.begin(), A.Summons.end(), [SummonId](const FSummon& S) { return S.Id == SummonId; }), A.Summons.end());
	}

	void OnDecoyShattered(const FCatalog& C, std::vector<FBoss*>& Bosses, FArena& A, double DecoyId, double Now)
	{
		const auto Found = std::find_if(A.Decoys.begin(), A.Decoys.end(), [DecoyId](const FDecoy& D) { return D.Id == DecoyId; });
		if (Found == A.Decoys.end()) return;
		const FDecoy Decoy = *Found;
		A.Decoys.erase(Found);
		FEmit E;
		E.Kind = "DECOY_SHATTER"; E.ScenarioId = std::string("hollow-saint"); E.Text = "False Saint shattered"; E.X = Decoy.X; E.Z = Decoy.Z;
		Emit(C, A, nullptr, E, Now);
		if (!A.Decoys.empty()) return;
		for (FBoss* M : Bosses)
			if (M && M->bAlive && M->bBoss && M->ScenarioId && *M->ScenarioId == "hollow-saint")
			{
				M->Poise = OpenWeakPoint(M->Poise, Now); // all copies gone: the real Saint is exposed
				break;
			}
	}

	double ApplyBossDamage(const FCatalog& C, FBoss& B, double Dmg, const std::string& Element, double Distance, double Now)
	{
		double Mult = 1;
		B.Poise = HitPoise(B.Poise, Dmg * PoisePerDamage, Now, Mult);
		const FScenarioRule* Rule = nullptr;
		if (B.ScenarioId)
		{
			const auto F = C.Scenarios.find(*B.ScenarioId);
			if (F != C.Scenarios.end()) Rule = &F->second;
		}
		// Unique Scenario: near-immune outside the weak-point / stagger window
		if (B.ScenarioId && Mult == 1) Mult = Rule ? Rule->OutsideWindowMult : 1;
		Dmg *= Mult;
		if (B.ScenarioId)
		{
			Dmg *= GimmickMultiplier(Rule ? Rule->Gimmick : std::string(), Element, Now, Distance, B.GimmickHistory);
			B.PlayerHits += 1;
		}
		return Dmg;
	}

	std::optional<int> StepRegionalPhase(FBoss& B, double Dt, double Now)
	{
		B.Poise = DecayPoise(B.Poise, Dt, Now);
		const int Next = PhaseForHpFraction(std::max(0.0, B.Hp) / B.MaxHp);
		if (Next == B.RegionalPhase) return std::nullopt;
		B.RegionalPhase = Next;
		B.Poise = OpenWeakPoint(B.Poise, Now); // the phase shift doubles as the weak-point telegraph
		return Next;
	}

	bool WindupHud(const FCatalog& C, const FBoss& B, std::string& OutLabel, double& OutProgress)
	{
		if (!B.Encounter || B.Encounter->State != "TELL" || !B.Encounter->Atk || B.Encounter->TellTotal <= 0) return false;
		const FEncounterDef* Def = B.ScenarioId ? C.Find(*B.ScenarioId) : nullptr;
		if (!Def) return false;
		const auto F = Def->Attacks.find(*B.Encounter->Atk);
		if (F == Def->Attacks.end()) return false;
		OutLabel = F->second.Label;
		OutProgress = std::min(1.0, std::max(0.0, 1 - B.Encounter->Timer / B.Encounter->TellTotal));
		return true;
	}
}
