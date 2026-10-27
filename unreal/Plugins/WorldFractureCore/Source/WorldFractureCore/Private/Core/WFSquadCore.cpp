#include "Core/WFSquadCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace wf::squad
{
	namespace
	{
		constexpr double SqRun = 7.5, SqWalk = 4.2, SqPi = 3.141592653589793;
		constexpr size_t SqMaxShots = 24;
		double SqTurn(double From, double To, double K)
		{
			double D = To - From;
			while (D > SqPi) D -= SqPi * 2;
			while (D < -SqPi) D += SqPi * 2;
			return From + D * std::min(1.0, K);
		}
	}

	FState CreateSquad(double Px, double Pz, bool bEnabled)
	{
		FState S;
		S.bEnabled = bEnabled;
		for (int I = 0; I < 2; ++I)
		{
			FMate M;
			M.Id = I; M.Name = Names[I];
			M.X = Px + Formation[I][0]; M.Z = Pz + Formation[I][1];
			M.Cool = I * 0.4;
			S.Mates.push_back(M);
		}
		return S;
	}

	FSlot FormationSlot(int I, double Px, double Pz, double Yaw)
	{
		const double* F = Formation[((I % 2) + 2) % 2];
		const double R = F[0], B = F[1];
		const double Fx = std::sin(Yaw), Fz = std::cos(Yaw), Rx = Fz, Rz = -Fx;
		return {Px + Rx * R + Fx * B, Pz + Rz * R + Fz * B};
	}

	int PickTarget(const std::vector<FTarget>& Targets, double Mx, double Mz, double Px, double Pz)
	{
		int Best = -1;
		double BestD = std::numeric_limits<double>::infinity();
		for (size_t I = 0; I < Targets.size(); ++I)
		{
			const FTarget& T = Targets[I];
			if (!T.bAlive || T.bDecoy || js::Hypot(T.X - Px, T.Z - Pz) > EngageRange) continue;
			const double D = js::Hypot(T.X - Mx, T.Z - Mz);
			if (D < BestD) { BestD = D; Best = static_cast<int>(I); }
		}
		return Best;
	}

	double SquadDamage(const FTarget& T, double Dmg)
	{
		if (!T.bBoss) return Dmg;
		const double Floor = T.MaxHp.value_or(T.Hp) * BossFloor;
		return std::max(0.0, std::min(Dmg, T.Hp - Floor));
	}

	std::vector<FHit> StepSquad(FState& Squad, const std::vector<FTarget>& Targets, const FInput& In)
	{
		Squad.Clock += In.Dt;
		std::vector<FHit> Hits;
		if (!Squad.bEnabled) return Hits;
		const bool bEngaged = In.Heat >= EngageHeat && !In.bInVehicle;
		for (size_t I = 0; I < Squad.Mates.size(); ++I)
		{
			FMate& M = Squad.Mates[I];
			// movement: keep the formation slot; jump back if left far behind (fast travel, vehicles)
			const FSlot Slot = FormationSlot(static_cast<int>(I), In.Px, In.Pz, In.Yaw);
			const double Dx = Slot.X - M.X, Dz = Slot.Z - M.Z, D = js::Hypot(Dx, Dz);
			if (D > 60) { M.X = Slot.X; M.Z = Slot.Z; M.Speed = 0; }
			else if (D > 0.6)
			{
				const double V = std::min(D / std::max(In.Dt, 1e-3), D > 6 ? SqRun : SqWalk);
				M.X += (Dx / D) * V * In.Dt; M.Z += (Dz / D) * V * In.Dt; M.Speed = V;
			}
			else M.Speed = 0;
			// targeting and fire
			M.Target = bEngaged ? PickTarget(Targets, M.X, M.Z, In.Px, In.Pz) : -1;
			const FTarget* T = M.Target >= 0 ? &Targets[static_cast<size_t>(M.Target)] : nullptr;
			const double FaceYaw = T ? std::atan2(T->X - M.X, T->Z - M.Z) : M.Speed > 0.3 ? std::atan2(Dx, Dz) : In.Yaw;
			M.Yaw = SqTurn(M.Yaw, FaceYaw, In.Dt * 10);
			M.Firing = std::max(0.0, M.Firing - In.Dt);
			M.Cool -= In.Dt;
			if (!T || M.Cool > 0) continue;
			const double ShotInBurst = std::fmod(std::floor(Squad.Clock / FireInterval + static_cast<double>(I)), Burst + 1);
			M.Cool = ShotInBurst == Burst ? BurstRest : FireInterval;
			if (ShotInBurst == Burst) continue;
			const bool bHit = In.Rand() < HitChance;
			const double Jitter = bHit ? 0 : 1.5 + In.Rand() * 2;
			const double Ang = In.Rand() * SqPi * 2;
			Squad.Shots.push_back({Squad.NextShot++, M.X, M.Z, T->X + std::cos(Ang) * Jitter, T->Z + std::sin(Ang) * Jitter, bHit, Squad.Clock});
			if (Squad.Shots.size() > SqMaxShots) Squad.Shots.erase(Squad.Shots.begin(), Squad.Shots.begin() + static_cast<std::ptrdiff_t>(Squad.Shots.size() - SqMaxShots));
			M.Firing = 0.12;
			if (bHit)
			{
				const double Dmg = SquadDamage(*T, (SquadDps * FireInterval * (Burst + 1)) / Burst);
				if (Dmg > 0) Hits.push_back({static_cast<int>(M.Target), Dmg});
			}
		}
		return Hits;
	}
}
