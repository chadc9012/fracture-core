// Golden test for the C++ vehicle weapons: replays tools/gen-vweapons-golden.ts, recorded from the web build's real
// vehicle-weapons.ts, ordnance.ts, launchers.ts and sim.ts fireBullet / fireOrdnance, plus Scene.tsx's fire loop.
// Armament data, decisions and fire-loop shots must match exactly; trigonometry compares to 1e-9 relative.
#include "Core/WFJsCompat.h"
#include "Core/WFVehicleWeaponsCore.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::vweapons;

namespace
{
	const std::string None = "~";
	std::vector<std::string> Split(const std::string& S, char Sep)
	{
		std::vector<std::string> Out;
		std::string Cur;
		for (char C : S) { if (C == Sep) { Out.push_back(Cur); Cur.clear(); } else Cur += C; }
		Out.push_back(Cur);
		return Out;
	}
	double Num(const std::string& S)
	{
		double V = 0;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		if (R.ec != std::errc() || R.ptr != S.data() + S.size()) throw std::runtime_error("bad number: " + S);
		return V;
	}
	std::string N(double V) { return js::NumberToString(V); }
	std::string Muzzles(const std::vector<FOffset>& M)
	{
		std::string Out;
		for (size_t I = 0; I < M.size(); ++I) { if (I) Out += ";"; Out += N(M[I][0]) + "," + N(M[I][1]) + "," + N(M[I][2]); }
		return Out;
	}
	std::string GunText(const std::string& Slot, const FGun& G)
	{
		return "G\t" + Slot + "\t" + G.Name + "\t" + N(G.Rate) + "\t" + N(G.Damage) + "\t" + N(G.Spread) + "\t" + N(G.Speed) + "\t" + N(G.Knock) + "\t" + N(G.Heat) + "\t" + G.Mount + "\t"
			+ N(G.PitchAssist) + "\t" + N(G.Converge) + "\t" + G.Sound + "\t" + (G.Shell ? N(*G.Shell) : None) + "\t" + Muzzles(G.Muzzles);
	}
	std::vector<std::string> ArmText(const FArmament& A)
	{
		std::vector<std::string> Out;
		if (A.Primary) Out.push_back(GunText("PRIMARY", *A.Primary));
		if (A.SecondaryGun) Out.push_back(GunText("SECONDARY_GUN", *A.SecondaryGun));
		if (A.Secondary)
		{
			const FOrdnanceMount& S = *A.Secondary;
			Out.push_back("O\t" + S.Name + "\t" + S.Ordnance + "\t" + N(S.Rate) + "\t" + std::to_string(S.Salvo) + "\t" + N(S.SalvoGap) + "\t" + N(S.Damage) + "\t" + S.Mount + "\t" + Muzzles(S.Muzzles));
		}
		return Out;
	}

	int Checks = 0, Mismatches = 0;
	void Fail(int Line, const std::string& What)
	{
		if (++Mismatches <= 20) std::fprintf(stderr, "line %d: %s\n", Line, What.c_str());
	}
	void Near(int Line, const char* What, double Got, double Want)
	{
		++Checks;
		const double Tol = 1e-9 * std::max(1.0, std::fabs(Want));
		if (!(std::fabs(Got - Want) <= Tol) && !(Got == Want)) Fail(Line, std::string(What) + ": got " + N(Got) + " want " + N(Want));
	}
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want) Fail(Line, std::string(What) + ": got [" + Got + "] want [" + Want + "]");
	}
	std::vector<FCandidate> Cands(const std::vector<std::string>& F, size_t At, int Count)
	{
		std::vector<FCandidate> C;
		for (int I = 0; I < Count; ++I) { const auto P = Split(F[At + I], ' '); C.push_back({Num(P[0]), Num(P[1]), P[2] == "1"}); }
		return C;
	}
	FOrdnanceDef DefOf(const std::string& Id)
	{
		if (const FOrdnanceDef* D = OrdnanceById(Id)) return *D;
		return CannonShell(*ArmamentFor("goliath-tank", "TANK").Primary);
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: %s golden.txt\n", Argv[0]); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	int Arms = 0, Flights = 0, FireSteps = 0;
	FRound Round;
	FArmament Loop;
	FFireState Fire;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const int LineNo = static_cast<int>(I) + 1;
		const std::vector<std::string> F = Split(Lines[I], '\t');
		const std::string& T = F[0];
		if (T == "ARM")
		{
			++Arms;
			const std::vector<std::string> Got = ArmText(ArmamentFor(F[1], F[2], F[3] == None ? "" : F[3]));
			std::vector<std::string> Want;
			while (I + 1 < Lines.size() && (Lines[I + 1].rfind("G\t", 0) == 0 || Lines[I + 1].rfind("O\t", 0) == 0)) Want.push_back(Lines[++I]);
			Same(LineNo, ("armament " + F[1] + " " + F[2] + " " + F[3] + " count").c_str(), std::to_string(Got.size()), std::to_string(Want.size()));
			for (size_t K = 0; K < std::min(Got.size(), Want.size()); ++K) Same(LineNo + 1 + static_cast<int>(K), "hardpoint", Got[K], Want[K]);
		}
		else if (T == "KIND") { /* informational: the game maps these; the host passes its own profile kind */ }
		else if (T == "VP")
		{
			const FVec W = VehiclePoint({Num(F[1]), Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6])}, {Num(F[7]), Num(F[8]), Num(F[9])});
			Near(LineNo, "vp x", W.X, Num(F[10])); Near(LineNo, "vp y", W.Y, Num(F[11])); Near(LineNo, "vp z", W.Z, Num(F[12]));
		}
		else if (T == "AIM")
		{
			const FAim A = AimFor(F[1], {Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6]), Num(F[7])}, Num(F[8]), Num(F[9]), Num(F[10]), {Num(F[11]), Num(F[12]), Num(F[13])}, Num(F[14]));
			Near(LineNo, "aim yaw", A.Yaw, Num(F[15])); Near(LineNo, "aim pitch", A.Pitch, Num(F[16]));
		}
		else if (T == "VV")
		{
			const FVec V = VehicleVelocity(Num(F[1]), Num(F[2]), Num(F[3]));
			Near(LineNo, "vv x", V.X, Num(F[4])); Near(LineNo, "vv y", V.Y, Num(F[5])); Near(LineNo, "vv z", V.Z, Num(F[6]));
		}
		else if (T == "RD")
		{
			++Flights;
			const FOrdnanceDef D = DefOf(F[1]);
			Same(LineNo, "def", D.Kind + " " + N(D.Speed) + " " + N(D.TurnRate) + " " + N(D.Life) + " " + N(D.SplashRadius) + " " + N(D.Damage) + " " + N(D.Proximity) + " " + D.Domain,
				F[2] + " " + F[3] + " " + F[4] + " " + F[5] + " " + F[6] + " " + F[7] + " " + F[8] + " " + F[9]);
			Round = FireRound(D, {Num(F[10]), Num(F[11]), Num(F[12])}, {Num(F[13]), Num(F[14]), Num(F[15])});
		}
		else if (T == "RS")
		{
			std::optional<FVec> Target;
			if (F[2] != None) { const auto P = Split(F[2], ' '); Target = FVec{Num(P[0]), Num(P[1]), Num(P[2])}; }
			const std::optional<FBurst> B = StepRound(Round, Num(F[1]), Target, [](double X, double Z) { return 2 * std::sin(X * 0.05) + std::cos(Z * 0.07) - 1; });
			Near(LineNo, "round x", Round.X, Num(F[3])); Near(LineNo, "round y", Round.Y, Num(F[4])); Near(LineNo, "round z", Round.Z, Num(F[5]));
			Near(LineNo, "round dx", Round.Dx, Num(F[6])); Near(LineNo, "round dy", Round.Dy, Num(F[7])); Near(LineNo, "round dz", Round.Dz, Num(F[8]));
			Near(LineNo, "round age", Round.Age, Num(F[9]));
			Same(LineNo, "alive", Round.bAlive ? "1" : "0", F[10]);
			if (F[11] == None) Same(LineNo, "burst", B ? "burst" : None, None);
			else
			{
				const auto P = Split(F[11], ' ');
				Same(LineNo, "burst", B ? B->Reason : None, P[5]);
				if (B) { Near(LineNo, "burst radius", B->Radius, Num(P[3])); Near(LineNo, "burst damage", B->Damage, Num(P[4])); }
			}
		}
		else if (T == "SP")
		{
			FBurst B; B.Radius = Num(F[1]); B.Damage = Num(F[2]);
			Same(LineNo, "splash", N(SplashDamage(B, Num(F[3]))), F[4]);
		}
		else if (T == "LK")
		{
			const int Count = static_cast<int>(Num(F[6]));
			Same(LineNo, "lock", std::to_string(PickLockTarget(Num(F[1]), Num(F[2]), Num(F[3]), Cands(F, 7, Count), Num(F[4]), Num(F[5]))), F[7 + Count]);
		}
		else if (T == "FB")
		{
			// sim.ts fireBullet: refused while overheated; otherwise heat 11 x gun heat, the round's velocity and reach
			FHeat H{Num(F[13]), F[14] == "1"};
			const bool bFired = !H.bOverheated;
			if (bFired) AddHeat(H, BulletHeat(Num(F[12])));
			Same(LineNo, "fired", bFired ? "1" : "0", F[15]);
			if (bFired)
			{
				const FBullet B = MakeBullet({Num(F[1]), Num(F[2]), Num(F[3])}, Num(F[4]), Num(F[5]), Num(F[6]), {Num(F[7]), Num(F[8]), Num(F[9])}, Num(F[10]), Num(F[11]));
				Near(LineNo, "bullet vx", B.Vel.X, Num(F[16])); Near(LineNo, "bullet vy", B.Vel.Y, Num(F[17])); Near(LineNo, "bullet vz", B.Vel.Z, Num(F[18]));
				Near(LineNo, "bullet life", B.Life, Num(F[19])); Near(LineNo, "bullet dmg", B.Damage, Num(F[20]));
			}
			Near(LineNo, "heat", H.Heat, Num(F[21]));
			Same(LineNo, "overheated", H.bOverheated ? "1" : "0", F[22]);
		}
		else if (T == "FO")
		{
			const FOrdnanceDef D = DefOf(F[1]);
			const int Count = static_cast<int>(Num(F[13]));
			const size_t R = 14 + Count;
			FHeat H{Num(F[10]), F[11] == "1"};
			const bool bFired = !H.bOverheated;
			Same(LineNo, "ord fired", bFired ? "1" : "0", F[R]);
			if (bFired)
			{
				AddHeat(H, OrdnanceHeat(D));
				const FRound Rd = LaunchOrdnance(D, {Num(F[2]), Num(F[3]), Num(F[4])}, Num(F[5]), Num(F[6]), Num(F[7]) * Num(F[12]), Num(F[8]), Num(F[9]), Cands(F, 14, Count));
				Near(LineNo, "ord speed", Rd.Def.Speed, Num(F[R + 1])); Near(LineNo, "ord damage", Rd.Def.Damage, Num(F[R + 2]));
				Same(LineNo, "ord target", std::to_string(Rd.Target), F[R + 3]);
				Near(LineNo, "ord dx", Rd.Dx, Num(F[R + 4])); Near(LineNo, "ord dy", Rd.Dy, Num(F[R + 5])); Near(LineNo, "ord dz", Rd.Dz, Num(F[R + 6]));
			}
			Near(LineNo, "ord heat", H.Heat, Num(F[R + 7]));
			Same(LineNo, "ord overheated", H.bOverheated ? "1" : "0", F[R + 8]);
		}
		else if (T == "FL") { Loop = ArmamentFor(F[1], F[2], F[3] == None ? "" : F[3]); Fire = FFireState{}; }
		else if (T == "FS")
		{
			++FireSteps;
			const std::vector<FShot> Shots = StepFire(Loop, Fire, F[2] == "1", F[3] == "1", Num(F[1]), Num(F[4]), F[5] == "1");
			std::string Got;
			for (size_t K = 0; K < Shots.size(); ++K) { if (K) Got += ";"; Got += Shots[K].Slot + ":" + N(Shots[K].Muzzle[0]) + "," + N(Shots[K].Muzzle[1]) + "," + N(Shots[K].Muzzle[2]); }
			Same(LineNo, "shots", Got.empty() ? None : Got, F[6]);
			Same(LineNo, "fire state", N(Fire.Cool) + " " + N(Fire.GunCool) + " " + N(Fire.SecCool) + " " + N(Fire.SalvoCool) + " " + std::to_string(Fire.SalvoLeft) + " " + std::to_string(Fire.Barrel) + " " + std::to_string(Fire.GunBarrel) + " " + std::to_string(Fire.PodBarrel),
				F[7] + " " + F[8] + " " + F[9] + " " + F[10] + " " + F[11] + " " + F[12] + " " + F[13] + " " + F[14]);
		}
		else { Fail(LineNo, "unknown line " + T); }
	}

	// heat cooling (sim.ts stepSim): 34/s, venting 22/s, ready again at 6
	{
		FHeat H{100, true};
		bool bCooled = false;
		int Steps = 0;
		while (!bCooled && Steps < 1000) { bCooled = CoolHeat(H, 0.1); ++Steps; }
		Same(0, "vent steps", std::to_string(Steps), "43"); // 100 - 22 x 4.3 = 5.4 <= 6
		Near(0, "vent heat", H.Heat, 100 - 22 * 4.3);
		FHeat C{50, false};
		CoolHeat(C, 1);
		Near(0, "cool", C.Heat, 16);
	}

	// chase-ai.ts vehicleDamageStage on 100 - body damage
	for (const auto& [Body, Stage] : std::vector<std::pair<double, std::string>>{{0, "NOMINAL"}, {14.9, "NOMINAL"}, {15, "LIGHT"}, {40, "MEDIUM"}, {64.9, "MEDIUM"}, {65, "HEAVY"}, {85, "CRITICAL"}, {100, "CRITICAL"}})
		Same(0, "damage stage", DamageStage(Body), Stage);
	Same(0, "weapons at 65", WeaponsDisabled(65) ? "1" : "0", "1");
	Same(0, "weapons at 64", WeaponsDisabled(64) ? "1" : "0", "0");

	std::printf("%d armaments, %d ordnance flights, %d fire-loop frames, %d checks, %d mismatches\n", Arms, Flights, FireSteps, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
