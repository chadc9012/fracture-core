#include "Core/WFVehicleWeaponsCore.h"
#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <map>

#if defined(__GNUC__)
#pragma GCC diagnostic ignored "-Wmissing-field-initializers" // designated initializers leave the rest unset on purpose
#endif

namespace wf::vweapons
{
	namespace
	{
		/** a Partial<VehicleGun>: only the fields set override */
		struct FVwGunPatch
		{
			std::optional<std::string> Name;
			std::optional<double> Rate, Damage, Spread, Speed, Knock, Heat;
			std::optional<std::vector<FOffset>> Muzzles;
			std::optional<std::string> Mount;
			std::optional<double> PitchAssist, Converge;
			std::optional<std::string> Sound;
			std::optional<double> Shell;
		};
		void VwPatch(FGun& G, const FVwGunPatch& P)
		{
			if (P.Name) G.Name = *P.Name;
			if (P.Rate) G.Rate = *P.Rate;
			if (P.Damage) G.Damage = *P.Damage;
			if (P.Spread) G.Spread = *P.Spread;
			if (P.Speed) G.Speed = *P.Speed;
			if (P.Knock) G.Knock = *P.Knock;
			if (P.Heat) G.Heat = *P.Heat;
			if (P.Muzzles) G.Muzzles = *P.Muzzles;
			if (P.Mount) G.Mount = *P.Mount;
			if (P.PitchAssist) G.PitchAssist = *P.PitchAssist;
			if (P.Converge) G.Converge = *P.Converge;
			if (P.Sound) G.Sound = *P.Sound;
			if (P.Shell) G.Shell = *P.Shell;
		}
		/** vehicle-weapons.ts gun(): the defaults under a patch */
		FGun VwGun(const FVwGunPatch& P) { FGun G; VwPatch(G, P); return G; }

		struct FVwOverride
		{
			// primary: unset = keep, Null = unarmed, else a patch
			bool bPrimarySet = false, bPrimaryNull = false;
			FVwGunPatch Primary;
			bool bSecondarySet = false;
			std::optional<FOrdnanceMount> Secondary;
			bool bSecondaryGunSet = false;
			std::optional<FVwGunPatch> SecondaryGun;
		};
		FVwOverride VwPrim(FVwGunPatch P) { FVwOverride O; O.bPrimarySet = true; O.Primary = std::move(P); return O; }
		FVwOverride& VwSec(FVwOverride& O, std::optional<FOrdnanceMount> S) { O.bSecondarySet = true; O.Secondary = std::move(S); return O; }
		FVwOverride VwWithSec(FVwOverride O, std::optional<FOrdnanceMount> S) { VwSec(O, std::move(S)); return O; }
		FVwOverride VwWithSecGun(FVwOverride O, FVwGunPatch G) { O.bSecondaryGunSet = true; O.SecondaryGun = std::move(G); return O; }
		FOrdnanceMount VwOrd(const char* Id, const char* Name, double Rate, int Salvo, double Gap, double Damage, std::vector<FOffset> Muzzles, const char* Mount)
		{
			FOrdnanceMount M;
			M.Ordnance = Id; M.Name = Name; M.Rate = Rate; M.Salvo = Salvo; M.SalvoGap = Gap; M.Damage = Damage; M.Muzzles = std::move(Muzzles); M.Mount = Mount;
			return M;
		}

		const std::map<std::string, FArmament>& VwByKind()
		{
			static const std::map<std::string, FArmament> M = [] {
				std::map<std::string, FArmament> K;
				K["RACER"] = {VwGun({.Name = "Roof repeater", .Rate = 0.11, .Damage = 0.9, .Muzzles = std::vector<FOffset>{{0.35, 1.25, 1.2}, {-0.35, 1.25, 1.2}}, .Converge = 60}), std::nullopt, std::nullopt};
				K["OFFROAD"] = {VwGun({.Name = "Pintle machine gun", .Rate = 0.1, .Damage = 1, .Spread = 0.016, .Muzzles = std::vector<FOffset>{{0, 2.1, 0.4}}, .Mount = "TURRET"}), std::nullopt, std::nullopt};
				K["TANK"] = {VwGun({.Name = "120mm fracture cannon", .Rate = 1.4, .Damage = 9, .Spread = 0.002, .Speed = 220, .Knock = 6, .Heat = 3, .Muzzles = std::vector<FOffset>{{0, 2.35, 4.6}}, .Mount = "TURRET", .Sound = "VEHICLE", .Shell = 4.5}),
					VwOrd("guided-missile", "Guided anti-armor missile", 6, 1, 0, 22, {{0.9, 2.6, 0.5}}, "TURRET"), std::nullopt};
				K["JET"] = {VwGun({.Name = "Arc cannon", .Rate = 0.07, .Damage = 1.2, .Spread = 0.008, .Speed = 260, .Heat = 0.45, .Muzzles = std::vector<FOffset>{{1.1, 0.8, 3.2}, {-1.1, 0.8, 3.2}}, .PitchAssist = 0.12, .Converge = 220, .Sound = "PULSE"}),
					VwOrd("air-missile", "Missiles", 2.2, 2, 0.18, 16, {{2.4, 0.6, 0.6}, {-2.4, 0.6, 0.6}}, "FIXED"), std::nullopt};
				K["HELI"] = {VwGun({.Name = "Chin chain gun", .Rate = 0.065, .Damage = 0.9, .Spread = 0.02, .Speed = 200, .Heat = 0.35, .Muzzles = std::vector<FOffset>{{0, 0.55, 2.6}}, .Mount = "TURRET", .Sound = "AUTO"}),
					VwOrd("rocket-pod", "Rocket pods", 2.6, 6, 0.09, 8, {{1.6, 0.9, 0.8}, {-1.6, 0.9, 0.8}}, "FIXED"), std::nullopt};
				K["BOAT"] = {VwGun({.Name = "Heavy deck gun", .Rate = 0.16, .Damage = 1.6, .Spread = 0.014, .Speed = 170, .Knock = 2, .Heat = 0.9, .Muzzles = std::vector<FOffset>{{0, 2.2, 2.2}}, .Mount = "TURRET"}), std::nullopt, std::nullopt};
				K["SUB"] = {VwGun({.Name = "Bow cannon", .Rate = 0.2, .Damage = 1.4, .Spread = 0.01, .Speed = 120, .Muzzles = std::vector<FOffset>{{0, 0.4, 3}}, .Mount = "FIXED", .PitchAssist = 0.3}),
					VwOrd("phase-torpedo", "Phase torpedoes", 3.5, 1, 0, 20, {{0, -0.3, 3}}, "FIXED"), std::nullopt};
				return K;
			}();
			return M;
		}

		const std::map<std::string, FVwOverride>& VwById()
		{
			static const std::map<std::string, FVwOverride> M = {
				{"aether-hoverbike", VwPrim({.Name = "Twin pulse emitters", .Rate = 0.09, .Damage = 0.8, .Muzzles = std::vector<FOffset>{{0.3, 0.75, 1.1}, {-0.3, 0.75, 1.1}}, .Converge = 50, .Sound = "PULSE"})},
				{"scrap-interceptor", VwPrim({.Name = "Roof repeater", .Rate = 0.1, .Damage = 1})},
				{"raider-buggy", VwPrim({.Name = "Ram-cage SMGs", .Rate = 0.08, .Damage = 0.7, .Spread = 0.022, .Muzzles = std::vector<FOffset>{{0.6, 1.1, 1.6}, {-0.6, 1.1, 1.6}}, .Mount = "FIXED", .Converge = 40})},
				{"tech-transport", VwPrim({.Name = "Pulse-laser array", .Rate = 0.09, .Damage = 1.1, .Spread = 0.008, .Speed = 220, .Muzzles = std::vector<FOffset>{{0, 3.2, 1.5}}, .Mount = "TURRET", .Sound = "PULSE"})},
				{"void-skimmer", VwPrim({.Name = "Void lance", .Rate = 0.35, .Damage = 4, .Spread = 0.002, .Speed = 320, .Muzzles = std::vector<FOffset>{{0, 0.7, 4}}, .Sound = "PULSE"})},
				{"ai-interceptor", VwPrim({.Name = "Continuous laser", .Rate = 0.05, .Damage = 0.7, .Spread = 0.003, .Speed = 300, .Heat = 0.3, .Muzzles = std::vector<FOffset>{{0, 0.7, 2.5}}, .Sound = "PULSE"})},
				{"leviathan", VwPrim({.Name = "Heavy energy batteries", .Rate = 0.3, .Damage = 3, .Spread = 0.01, .Speed = 200, .Knock = 3, .Muzzles = std::vector<FOffset>{{2.5, 4, 6}, {-2.5, 4, 6}}, .Mount = "TURRET", .Sound = "PULSE"})},
			};
			return M;
		}

		const std::map<std::string, FVwOverride>& VwByBuild()
		{
			static const std::map<std::string, FVwOverride> M = [] {
				std::map<std::string, FVwOverride> B;
				B["goliath-4x4"] = VwPrim({.Name = "12.7mm auto-turret", .Rate = 0.09, .Damage = 1.2, .Spread = 0.014, .Knock = 1.4, .Muzzles = std::vector<FOffset>{{0, 2.15, 0.2}}, .Mount = "TURRET"});
				B["behemoth-v16"] = VwPrim({.Name = "20mm autocannon", .Rate = 0.18, .Damage = 2.2, .Spread = 0.012, .Speed = 180, .Knock = 2.2, .Heat = 0.9, .Muzzles = std::vector<FOffset>{{0, 1.9, 0.6}}, .Mount = "TURRET", .Converge = 0});
				B["dune-stalker"] = VwPrim({.Name = "Front twin heavy MGs", .Rate = 0.1, .Damage = 1.1, .Spread = 0.016, .Muzzles = std::vector<FOffset>{{0.35, 0.8, 1.2}, {-0.35, 0.8, 1.2}}, .Converge = 60, .Sound = "AUTO"});
				B["aegis-siege"] = VwWithSecGun(VwWithSec(VwPrim({.Name = "120mm plasma smoothbore", .Sound = "PULSE"}), std::nullopt),
					{.Name = "Pintle: pulse machine gun", .Rate = 0.08, .Damage = 0.9, .Spread = 0.016, .Speed = 220, .Heat = 0.4, .Muzzles = std::vector<FOffset>{{-0.7, 3.0, 0.8}}, .Mount = "TURRET", .Sound = "PULSE"});
				B["valkyrie-vtol"] = VwWithSec(VwPrim({.Name = "30mm rotary cannon", .Rate = 0.08, .Damage = 1.4, .Spread = 0.018, .Speed = 210, .Heat = 0.4, .Muzzles = std::vector<FOffset>{{0, 0.5, 3.2}}}),
					VwOrd("guided-missile", "Lock-on rocket pods", 3, 4, 0.12, 9, {{1.7, 0.9, 0.8}, {-1.7, 0.9, 0.8}}, "FIXED"));
				B["ghost-ray"] = VwPrim({.Name = "Thermal sniper / pulse array", .Rate = 0.6, .Damage = 4.5, .Spread = 0.001, .Speed = 320, .Knock = 2, .Heat = 1.4, .Muzzles = std::vector<FOffset>{{0, 0.85, 1.2}}, .Converge = 0, .Sound = "PULSE"});
				B["f39-jupiter"] = VwWithSec(VwPrim({.Name = "Arc cannon"}), std::nullopt);
				B["nautilus-abyss"] = VwWithSec(VwPrim({.Name = "Hull: mining laser", .Rate = 0.05, .Damage = 0.6, .Spread = 0.002, .Speed = 260, .Heat = 0.3, .Sound = "PULSE"}),
					VwOrd("phase-torpedo", "Sonic torpedoes", 3.5, 1, 0, 20, {{0, -0.3, 3}}, "FIXED"));
				B["triton-hydrospear"] = VwWithSec(VwPrim({.Name = "Plasma arc turret", .Rate = 0.12, .Damage = 1.3, .Spread = 0.012, .Speed = 220, .Sound = "PULSE"}),
					VwOrd("phase-torpedo", "Micro torpedo racks", 3, 3, 0.15, 10, {{1, 0.4, 2}, {-1, 0.4, 2}}, "FIXED"));
				B["nomad-bike"] = VwPrim({.Name = "Bar-mounted twin SMGs", .Rate = 0.07, .Damage = 0.65, .Spread = 0.02, .Muzzles = std::vector<FOffset>{{0.3, 0.85, 1}, {-0.3, 0.85, 1}}, .Converge = 45, .Sound = "AUTO"});
				B["rift-runner"] = VwPrim({.Name = "Hood: rift-shot cannon", .Rate = 0.45, .Damage = 3, .Spread = 0.004, .Speed = 220, .Knock = 2.5, .Heat = 1.2, .Muzzles = std::vector<FOffset>{{0, 1, 2}}, .Converge = 0, .Sound = "PULSE"});
				B["sandstalker-atv"] = VwPrim({.Name = "Roll bar: light machine gun", .Rate = 0.1, .Damage = 0.9});
				B["void-chaser"] = VwWithSec(VwPrim({.Name = "Twin void lances", .Rate = 0.3, .Damage = 2.6, .Spread = 0.002, .Speed = 320, .Knock = 1.8, .Heat = 0.9, .Muzzles = std::vector<FOffset>{{0.6, 0.7, 2.2}, {-0.6, 0.7, 2.2}}, .Converge = 120, .Sound = "PULSE"}), std::nullopt);
				{ FVwOverride O; O.bPrimarySet = O.bPrimaryNull = true; B["civic-rover"] = VwWithSec(O, std::nullopt); }
				B["neon-drift"] = VwPrim({.Name = "Underglow arc emitters", .Rate = 0.08, .Damage = 0.8, .Spread = 0.03, .Speed = 110, .Heat = 0.5, .Muzzles = std::vector<FOffset>{{0.8, 0.4, 1.6}, {-0.8, 0.4, 1.6}}, .Converge = 30, .Sound = "PULSE"});
				B["war-rig"] = VwWithSecGun(VwPrim({.Name = "Cab: flak turret", .Rate = 0.22, .Damage = 1.8, .Spread = 0.03, .Speed = 170, .Knock = 2, .Heat = 0.8, .Muzzles = std::vector<FOffset>{{0, 3.4, 2}}, .Mount = "TURRET"}),
					{.Name = "Trailer: twin heavy MG nests", .Rate = 0.08, .Damage = 1, .Spread = 0.018, .Speed = 170, .Heat = 0.4, .Muzzles = std::vector<FOffset>{{1.2, 3.1, -3.5}, {-1.2, 3.1, -3.5}}, .Mount = "TURRET", .Sound = "AUTO"});
				B["apex-hauler"] = VwPrim({.Name = "Roof: point-defence laser", .Rate = 0.06, .Damage = 0.7, .Spread = 0.002, .Speed = 300, .Heat = 0.3, .Muzzles = std::vector<FOffset>{{0, 3.4, 1}}, .Mount = "TURRET", .Sound = "PULSE"});
				B["skyhawk"] = VwWithSec(VwPrim({.Name = "Chin: 20mm gun", .Rate = 0.1, .Damage = 1.2, .Spread = 0.016}), std::nullopt);
				B["riftwing"] = VwWithSec(VwPrim({.Name = "Wing-root rift cannons", .Rate = 0.12, .Damage = 1.8, .Spread = 0.006, .Speed = 280, .Muzzles = std::vector<FOffset>{{1.6, 0.8, 1.5}, {-1.6, 0.8, 1.5}}, .Converge = 200}), std::nullopt);
				B["solara-falcon"] = VwWithSec(VwPrim({.Name = "Nose: solar beam", .Rate = 0.05, .Damage = 0.8, .Spread = 0.002, .Speed = 320, .Heat = 0.35, .Muzzles = std::vector<FOffset>{{0, 0.8, 4}}, .Converge = 0, .Sound = "PULSE"}),
					VwOrd("rocket-pod", "Wing rocket rails", 2.4, 4, 0.1, 9, {{2.4, 0.6, 0.6}, {-2.4, 0.6, 0.6}}, "FIXED"));
				B["void-skimmer-prototype"] = VwWithSec(VwPrim({.Name = "Bow: void lance array", .Rate = 0.25, .Damage = 4, .Spread = 0.002, .Speed = 320, .Muzzles = std::vector<FOffset>{{0.8, 0.7, 4}, {0, 0.9, 4.2}, {-0.8, 0.7, 4}}, .Converge = 160}), std::nullopt);
				return B;
			}();
			return M;
		}

		FArmament VwApply(const FArmament& Base, const FVwOverride* O)
		{
			if (!O) return Base;
			FArmament A;
			if (!O->bPrimarySet) A.Primary = Base.Primary;
			else if (O->bPrimaryNull) A.Primary.reset();
			else if (Base.Primary) { A.Primary = Base.Primary; VwPatch(*A.Primary, O->Primary); }
			else { FVwGunPatch P{.Name = "Gun", .Muzzles = std::vector<FOffset>{{0, 1, 1}}}; FGun G = VwGun(P); VwPatch(G, O->Primary); A.Primary = G; }
			A.Secondary = O->bSecondarySet ? O->Secondary : Base.Secondary;
			if (!O->bSecondaryGunSet) A.SecondaryGun = Base.SecondaryGun;
			else if (O->SecondaryGun) A.SecondaryGun = VwGun(*O->SecondaryGun);
			return A;
		}
		template <typename M> const typename M::mapped_type* VwLookup(const M& Map, const std::string& K) { const auto It = Map.find(K); return It == Map.end() ? nullptr : &It->second; }

		std::array<double, 3> VwNorm(double X, double Y, double Z)
		{
			double L = js::Hypot(X, Y, Z);
			if (L == 0) L = 1;
			return {X / L, Y / L, Z / L};
		}
	}

	FArmament ArmamentFor(const std::string& VehicleId, const std::string& Kind, const std::string& BuildId)
	{
		const FArmament* Base = VwLookup(VwByKind(), Kind);
		const FArmament Chassis = VwApply(Base ? *Base : FArmament{}, VwLookup(VwById(), VehicleId));
		return BuildId.empty() ? Chassis : VwApply(Chassis, VwLookup(VwByBuild(), BuildId));
	}

	std::vector<std::string> BuildIds()
	{
		std::vector<std::string> Out;
		for (const auto& [K, V] : VwByBuild()) Out.push_back(K);
		return Out;
	}

	FVec VehiclePoint(const FPose& P, const FOffset& Local)
	{
		const double R = Local[0], U = Local[1], F = Local[2];
		const double Cr = std::cos(P.Roll), Sr = std::sin(P.Roll);
		const double R1 = R * Cr - U * Sr, U1 = R * Sr + U * Cr;
		const double Cp = std::cos(P.Pitch), Sp = std::sin(P.Pitch);
		const double U2 = U1 * Cp + F * Sp, F2 = -U1 * Sp + F * Cp;
		const double Cy = std::cos(P.Yaw), Sy = std::sin(P.Yaw);
		return {P.X + F2 * Sy - R1 * Cy, P.Y + U2, P.Z + F2 * Cy + R1 * Sy};
	}

	FAim AimFor(const std::string& Mount, const FPose& Pose, double CamYaw, double CamPitch, double PitchAssist, const FVec& Muzzle, double Converge)
	{
		if (Mount == "TURRET") return {CamYaw, CamPitch};
		const double Pitch = Pose.Pitch + std::max(-PitchAssist, std::min(PitchAssist, CamPitch));
		if (Converge <= 0) return {Pose.Yaw, Pitch};
		const double Tx = Pose.X + std::sin(Pose.Yaw) * Converge - Muzzle.X, Tz = Pose.Z + std::cos(Pose.Yaw) * Converge - Muzzle.Z;
		return {std::atan2(Tx, Tz), Pitch};
	}

	FVec VehicleVelocity(double Yaw, double Speed, double Vy) { return {std::sin(Yaw) * Speed, Vy, std::cos(Yaw) * Speed}; }

	const std::vector<FOrdnanceDef>& Ordnance()
	{
		static const std::vector<FOrdnanceDef> O = {
			{"rocket-pod", "ROCKET", "Rocket pod (70mm)", 90, 0, 4, 5, 18, 1.2, "ANY"},
			{"launcher-rocket", "ROCKET", "Shoulder launcher rocket", 70, 0, 4, 7, 30, 1.4, "ANY"},
			{"air-missile", "MISSILE", "Air-to-air missile", 130, 1.6, 6, 8, 40, 3, "AIR"},
			{"guided-missile", "MISSILE", "Guided anti-armor missile", 85, 1.2, 6, 6, 45, 2, "LAND"},
			{"phase-torpedo", "TORPEDO", "Phase torpedo", 30, 0.8, 9, 9, 38, 2.5, "WATER"},
		};
		return O;
	}

	const FOrdnanceDef* OrdnanceById(const std::string& Id)
	{
		for (const FOrdnanceDef& D : Ordnance()) if (D.Id == Id) return &D;
		return nullptr;
	}

	FOrdnanceDef CannonShell(const FGun& G) { return {"cannon-shell", "ROCKET", G.Name, G.Speed, 0, 3, G.Shell.value_or(0), 1, 1.6, "ANY"}; }

	FRound FireRound(const FOrdnanceDef& Def, const FVec& From, const FVec& Aim)
	{
		const auto D = VwNorm(Aim.X, Aim.Y, Aim.Z);
		FRound R;
		R.bAlive = true; R.Def = Def; R.X = From.X; R.Y = From.Y; R.Z = From.Z; R.Dx = D[0]; R.Dy = D[1]; R.Dz = D[2]; R.Age = 0;
		return R;
	}

	std::optional<FBurst> StepRound(FRound& R, double Dt, const std::optional<FVec>& Target, const std::function<double(double, double)>& Ground)
	{
		if (!R.bAlive) return std::nullopt;
		const FOrdnanceDef& D = R.Def;
		if (D.TurnRate > 0 && Target)
		{
			const auto T = VwNorm(Target->X - R.X, Target->Y - R.Y, Target->Z - R.Z);
			const double Dot = std::min(1.0, std::max(-1.0, R.Dx * T[0] + R.Dy * T[1] + R.Dz * T[2]));
			const double Ang = std::acos(Dot), Step = std::min(Ang, D.TurnRate * Dt), K = Ang > 1e-6 ? Step / Ang : 0;
			const auto N = VwNorm(R.Dx + (T[0] - R.Dx) * K, R.Dy + (T[1] - R.Dy) * K, R.Dz + (T[2] - R.Dz) * K);
			R.Dx = N[0]; R.Dy = N[1]; R.Dz = N[2];
		}
		R.X += R.Dx * D.Speed * Dt; R.Y += R.Dy * D.Speed * Dt; R.Z += R.Dz * D.Speed * Dt; R.Age += Dt;
		auto Burst = [&R, &D](const char* Reason) { R.bAlive = false; return FBurst{R.X, R.Y, R.Z, D.SplashRadius, D.Damage, Reason}; };
		if (Target && js::Hypot(Target->X - R.X, Target->Y - R.Y, Target->Z - R.Z) <= D.Proximity) return Burst("PROXIMITY");
		if (D.Domain != "WATER" && R.Y <= Ground(R.X, R.Z)) return Burst("GROUND");
		if (R.Age >= D.Life) return Burst("TIMEOUT");
		return std::nullopt;
	}

	double SplashDamage(const FBurst& B, double Distance)
	{
		return Distance >= B.Radius ? 0 : std::round(B.Damage * (1 - Distance / B.Radius) * 100) / 100;
	}

	int PickLockTarget(double FromX, double FromZ, double Yaw, const std::vector<FCandidate>& Cands, double Cone, double Range)
	{
		int Best = -1;
		double BestD = std::numeric_limits<double>::infinity();
		const double Fx = std::sin(Yaw), Fz = std::cos(Yaw);
		for (int I = 0; I < static_cast<int>(Cands.size()); ++I)
		{
			const FCandidate& C = Cands[I];
			if (!C.bAlive) continue;
			const double Dx = C.X - FromX, Dz = C.Z - FromZ, D = js::Hypot(Dx, Dz);
			if (D < 4 || D > Range) continue;
			const double Ang = std::acos(std::min(1.0, std::max(-1.0, (Dx * Fx + Dz * Fz) / D)));
			if (Ang <= Cone && D < BestD) { Best = I; BestD = D; }
		}
		return Best;
	}

	FRound LaunchOrdnance(const FOrdnanceDef& Def, const FVec& From, double Yaw, double Pitch, double Damage, double Carry, double Knock, const std::vector<FCandidate>& Cands)
	{
		const int Lock = Def.TurnRate > 0 ? PickLockTarget(From.X, From.Z, Yaw, Cands, 0.5, Def.Kind == "MISSILE" ? 260 : 120) : -1;
		FOrdnanceDef D = Def;
		D.Speed = Def.Speed + std::max(0.0, Carry);
		D.Damage = Damage;
		FRound R = FireRound(D, From, {std::sin(Yaw) * std::cos(Pitch), std::sin(Pitch), std::cos(Yaw) * std::cos(Pitch)});
		R.Target = Lock;
		R.Knock = Knock;
		return R;
	}

	FBullet MakeBullet(const FVec& From, double Yaw, double Pitch, double Speed, const FVec& Inherit, double Damage, double Knock)
	{
		FBullet B;
		B.Pos = From;
		B.Vel = {std::sin(Yaw) * std::cos(Pitch) * Speed + Inherit.X, std::sin(Pitch) * Speed + Inherit.Y, std::cos(Yaw) * std::cos(Pitch) * Speed + Inherit.Z};
		B.Life = 1.4 * std::max(1.0, Speed / 130);
		B.Damage = Damage;
		B.Knock = Knock;
		return B;
	}

	bool AddHeat(FHeat& H, double Amount)
	{
		H.Heat = std::min(100.0, H.Heat + Amount);
		if (H.Heat >= 100 && !H.bOverheated) { H.bOverheated = true; return true; }
		return false;
	}
	double BulletHeat(double GunHeat) { return HeatPerShotVehicle * GunHeat; }
	double OrdnanceHeat(const FOrdnanceDef& Def) { return HeatPerShotVehicle * (Def.Kind == "ROCKET" && Def.SplashRadius <= 5 ? 0.5 : 1.5); }
	bool CoolHeat(FHeat& H, double Dt)
	{
		H.Heat = std::max(0.0, H.Heat - Dt * (H.bOverheated ? 22 : 34));
		if (H.bOverheated && H.Heat <= 6) { H.bOverheated = false; return true; }
		return false;
	}

	const char* DamageStage(double BodyDamage)
	{
		const double Health = 100 - BodyDamage;
		if (Health <= 15) return "CRITICAL";
		if (Health <= 35) return "HEAVY";
		if (Health <= 60) return "MEDIUM";
		if (Health <= 85) return "LIGHT";
		return "NOMINAL";
	}
	bool WeaponsDisabled(double BodyDamage) { const std::string S = DamageStage(BodyDamage); return S == "HEAVY" || S == "CRITICAL"; }

	std::vector<FShot> StepFire(const FArmament& A, FFireState& S, bool bTrigger, bool bSecondary, double Dt, double FireRateMod, bool bBlocked)
	{
		std::vector<FShot> Out;
		S.Cool -= Dt; S.GunCool -= Dt; S.SecCool -= Dt; S.SalvoCool -= Dt;
		if (bBlocked) return Out;
		auto FireGun = [&](const FGun& G, double& Cool, int& Barrel, const char* Slot) {
			if (Cool > 0 || G.Muzzles.empty()) return;
			Cool = G.Rate / FireRateMod;
			Out.push_back({Slot, G.Muzzles[Barrel++ % G.Muzzles.size()]});
		};
		if (bTrigger && A.Primary) FireGun(*A.Primary, S.Cool, S.Barrel, "PRIMARY");
		if (bSecondary && A.SecondaryGun) FireGun(*A.SecondaryGun, S.GunCool, S.GunBarrel, "SECONDARY_GUN");
		if (const std::optional<FOrdnanceMount>& Sec = A.Secondary)
		{
			if (bSecondary && S.SecCool <= 0 && S.SalvoLeft <= 0) { S.SecCool = Sec->Rate; S.SalvoLeft = Sec->Salvo; S.SalvoCool = 0; }
			if (S.SalvoLeft > 0 && S.SalvoCool <= 0 && !Sec->Muzzles.empty())
			{
				Out.push_back({"ORDNANCE", Sec->Muzzles[S.PodBarrel++ % Sec->Muzzles.size()]});
				--S.SalvoLeft;
				S.SalvoCool = Sec->SalvoGap;
			}
		}
		return Out;
	}
}
