#include "Core/WFTacticsCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <set>

namespace wf::tactics
{
	namespace
	{
		constexpr double TcPi = 3.141592653589793;
	}

	std::string SquadRole(int Index, bool bElite, bool bBoss)
	{
		if (bBoss || bElite) return "LEADER";
		static const char* const Roles[3] = {"ASSAULT", "RANGED", "FLANKER"};
		return Roles[((Index % 3) + 3) % 3];
	}

	FMove SquadMove(const std::string& Role, double Distance, double PlayerHp, double PlayerThreat, double T, const std::string& Archetype, bool bRangedHoldFire, const std::string& Posture)
	{
		const auto Hold = [Distance](double Range) { return std::max(-1.0, std::min(1.0, (Distance - Range) / 8)); };
		if (PlayerHp < 0.35) return {1, 0}; // weak player: everyone rushes
		const double Spread = PlayerThreat > 40 || Posture == "CONTROL" ? 0.5 : 0;
		if (Role == "ASSAULT") return {Archetype == "DEFENSIVE" ? 1.3 : 1, Spread * std::sin(T)};
		if (Role == "RANGED")
		{
			if (bRangedHoldFire) return {std::min(0.0, Hold(38)), 0.2 * std::sin(T * 0.7)};
			return {Archetype == "STRATEGIST" ? Hold(20) : Hold(Posture == "POWER" ? 36 : 28), 0.6 * std::sin(T * 0.7) + Spread};
		}
		if (Role == "FLANKER")
		{
			const double CloseRange = (Archetype == "STRIKER" ? 18 : 12) + (Posture == "UTILITY" ? 4 : 0);
			const double Commit = Archetype == "STRIKER" || Posture == "UTILITY" ? 1 : Distance > 10 ? 1 : 0.3;
			return {Hold(CloseRange) * (Archetype == "STRIKER" ? 0.85 : 0.5), Commit};
		}
		// LEADER
		return {Archetype == "STRATEGIST" ? Hold(13) : Hold(Posture == "POWER" ? 24 : 18), 0.4 * std::sin(T * 0.5)};
	}

	std::string SquadArchetypeFor(const ability::FBuild& Build)
	{
		std::set<std::string> Classes;
		for (const auto& [Slot, Id] : Build.Slots) Classes.insert(ability::NodeById(Id).ClassId);
		if (Classes.size() == 3) return "BALANCED"; // Adaptive Fighter
		if (Classes.count("TITAN") && Classes.count("WARLOCK")) return "DEFENSIVE";
		if (Classes.count("HUNTER")) return "STRIKER";
		return "STRATEGIST";
	}

	bool ThrowsGrenades(const std::string& Kind) { return Kind == "RAIDER" || Kind == "VANGUARD"; }

	std::optional<FPoint> FindFlankSpot(double Mx, double Mz, const FPoint3& Player, int Side, const FGround& Ground, const FSightBlocked& Blocked, double EyeHeight)
	{
		const double Base = std::atan2(Mx - Player.X, Mz - Player.Z);
		std::optional<FPoint> Best;
		double BestD = std::numeric_limits<double>::infinity();
		for (const double R : {11.0, 15.0, 19.0})
			for (const double Swing : {55.0, 80.0, 110.0})
			{
				const double A = Base + Side * (Swing * TcPi) / 180;
				const double X = Player.X + std::sin(A) * R, Z = Player.Z + std::cos(A) * R;
				if (Blocked({X, Ground(X, Z) + EyeHeight, Z}, {Player.X, Player.Y - 0.35, Player.Z})) continue;
				const double D = js::Hypot(X - Mx, Z - Mz);
				if (D < BestD) { BestD = D; Best = FPoint{X, Z}; }
			}
		return Best;
	}

	FLob LobVelocity(const FPoint3& From, const FPoint3& To, double G)
	{
		const double Dx = To.X - From.X, Dz = To.Z - From.Z, Dy = To.Y - From.Y, D = js::Hypot(Dx, Dz);
		const double T = std::min(1.9, std::max(0.9, D / 13));
		return {Dx / T, (Dy + 0.5 * G * T * T) / T, Dz / T, T};
	}

	void StepGrenade(FGrenade& G, double Dt, const FGround& Ground)
	{
		G.Fuse -= Dt;
		if (G.bRest) return;
		G.Vy -= FGrenadeTuning::Gravity * Dt;
		G.X += G.Vx * Dt; G.Y += G.Vy * Dt; G.Z += G.Vz * Dt;
		const double Floor = Ground(G.X, G.Z) + 0.08;
		if (G.Y <= Floor)
		{
			G.Y = Floor;
			if (std::fabs(G.Vy) < 1.5)
			{
				G.Vy = 0;
				G.Vx *= std::pow(FGrenadeTuning::Friction, Dt * 8);
				G.Vz *= std::pow(FGrenadeTuning::Friction, Dt * 8);
				if (js::Hypot(G.Vx, G.Vz) < 0.3) G.bRest = true;
			}
			else { G.Vy = -G.Vy * FGrenadeTuning::Bounce; G.Vx *= 0.6; G.Vz *= 0.6; }
		}
	}

	double GrenadeDamage(double Dist, bool bCovered)
	{
		return Dist >= FGrenadeTuning::Radius ? 0 : FGrenadeTuning::Damage * (1 - Dist / FGrenadeTuning::Radius) * (bCovered ? FGrenadeTuning::CoverSoak : 1);
	}

	double BeepEvery(double Fuse) { return std::max(0.08, std::min(0.5, Fuse * 0.2)); }

	std::optional<FThreat> RoundThreat(const FRoundLike& R, double Mx, double Mz, const FGround& Ground, double Body)
	{
		const double V = std::max(1.0, R.Speed), Left = std::max(0.0, R.Life - R.Age);
		const double Rx = Mx - R.X, Rz = Mz - R.Z;
		double Hl = js::Hypot(R.Dx, R.Dz);
		if (Hl == 0) Hl = 1e-6;
		const double Along = (Rx * R.Dx + Rz * R.Dz) / (Hl * Hl);
		double TGround = std::numeric_limits<double>::infinity();
		for (double S = 1; S <= std::min(Left * V, 120.0); S += 1)
		{
			const double X = R.X + R.Dx * S, Y = R.Y + R.Dy * S, Z = R.Z + R.Dz * S;
			if (Y <= Ground(X, Z)) { TGround = S / V; break; }
		}
		double TBurst = TGround, Bx = R.X + R.Dx * TGround * V, Bz = R.Z + R.Dz * TGround * V;
		if (Along > 0)
		{
			const double Cx = R.X + R.Dx * Along, Cz = R.Z + R.Dz * Along;
			const double Miss = js::Hypot(Mx - Cx, Mz - Cz);
			if (Miss <= R.Proximity + Body && Along / V < TGround) { TBurst = Along / V; Bx = Cx; Bz = Cz; }
		}
		if (!std::isfinite(TBurst) || TBurst > Left) return std::nullopt;
		if (js::Hypot(Mx - Bx, Mz - Bz) > R.SplashRadius + Body * 0.5) return std::nullopt;
		return FThreat{Bx, Bz, TBurst};
	}

	FPoint DiveDirection(double Mx, double Mz, const FPoint& Burst, double RoundDx, double RoundDz, int Side)
	{
		const double Ax = Mx - Burst.X, Az = Mz - Burst.Z, Al = js::Hypot(Ax, Az);
		if (Al > 0.8) return {Ax / Al, Az / Al};
		double L = js::Hypot(RoundDx, RoundDz);
		if (L == 0) L = 1;
		return {(-RoundDz / L) * Side, (RoundDx / L) * Side};
	}

	bool ReactsInTime(double TimeToBurst, bool bElite, double Roll)
	{
		if (TimeToBurst < ReactMin) return false;
		return Roll < (bElite ? 0.75 : 0.5);
	}

	FPoint FleeDirection(double Mx, double Mz, double Cx, double Cz, double Seed)
	{
		const double Ax = Mx - Cx, Az = Mz - Cz, Al = js::Hypot(Ax, Az);
		if (Al > 0.5) return {Ax / Al, Az / Al};
		const double A = Seed * TcPi * 2;
		return {std::sin(A), std::cos(A)};
	}
}
