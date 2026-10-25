#include "Core/WFFleetCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>

namespace wf::fleet
{
	namespace
	{
		bool FlHas(const std::vector<std::string>& V, const std::string& S) { return std::find(V.begin(), V.end(), S) != V.end(); }
		double FlMat(const FProgression& P, const std::string& M) { const auto It = P.Materials.find(M); return It == P.Materials.end() ? 0 : It->second; }
		/** fleet.ts pay: every cost line affordable, else the first one that is not */
		std::optional<std::string> FlPay(FProgression& P, const FCost& Cost)
		{
			for (const auto& [K, V] : Cost)
				if (FlMat(P, K) < V) return "Needs " + js::NumberToString(V) + " " + K + " (you have " + js::NumberToString(FlMat(P, K)) + ")";
			for (const auto& [K, V] : Cost) P.Materials[K] = FlMat(P, K) - V;
			return std::nullopt;
		}
	}

	const FEntry* FCatalog::Find(const std::string& Id) const { for (const FEntry& E : Fleet) if (E.Id == Id) return &E; return nullptr; }
	const FGarageBase* FCatalog::FindGarage(const std::string& Id) const { for (const FGarageBase& G : Garages) if (G.Id == Id) return &G; return nullptr; }

	std::string FormatInt(double V)
	{
		const bool bNeg = V < 0;
		std::string Digits = js::NumberToString(std::fabs(js::Round(V)));
		std::string Out;
		for (size_t I = 0; I < Digits.size(); ++I)
		{
			if (I && (Digits.size() - I) % 3 == 0) Out += ',';
			Out += Digits[I];
		}
		return (bNeg ? "-" : "") + Out;
	}

	FResult BuyGarage(const FCatalog& C, FProgression& P, const std::string& Id)
	{
		const FGarageBase* G = C.FindGarage(Id);
		if (!G) return {false, "Unknown base"};
		if (FlHas(P.Fleet.Garages, Id)) return {false, "You already own this base"};
		FProgression Next = P;
		if (std::optional<std::string> Err = FlPay(Next, G->Cost)) return {false, *Err};
		Next.Fleet.Garages.push_back(Id);
		P = std::move(Next);
		return {true, G->Name + " is yours"};
	}

	FResult BuyFleetVehicle(const FCatalog& C, FProgression& P, FGarage& Gar, const std::string& Id)
	{
		const FEntry* E = C.Find(Id);
		if (!E) return {false, "Unknown vehicle"};
		if (FlHas(P.Fleet.Owned, Id)) return {false, "Already in your fleet"};
		if (!FlHas(P.Fleet.Garages, E->Garage)) { const FGarageBase* G = C.FindGarage(E->Garage); return {false, "Needs the " + (G ? G->Name : E->Garage)}; }
		const double Balance = vehicle::NexBalance(P.NexLedger);
		if (E->NexPrice > 0 && Balance < E->NexPrice) return {false, "Needs " + FormatInt(E->NexPrice) + " Nex (you have " + FormatInt(Balance) + ")"};
		FProgression Next = P;
		if (std::optional<std::string> Err = FlPay(Next, E->Cost)) return {false, *Err};
		if (E->NexPrice > 0 && !vehicle::SpendNex(Next.NexLedger, "fleet:" + Id, E->NexPrice)) return {false, "Purchase already recorded"};
		FGarage NextG = Gar;
		if (!FlHas(NextG.Owned, E->Base)) NextG.Owned.push_back(E->Base);
		if (!FlHas(NextG.Loadout, E->Base))
		{
			NextG.Loadout.push_back(E->Base);
			if (NextG.Loadout.size() > 3) NextG.Loadout.erase(NextG.Loadout.begin(), NextG.Loadout.end() - 3);
		}
		NextG.Selected = E->Base;
		Next.Fleet.Owned.push_back(Id);
		Next.Fleet.Active = Id;
		P = std::move(Next);
		Gar = std::move(NextG);
		return {true, E->Name + " added to your fleet and set as your active vehicle"};
	}

	FResult SetActiveFleet(const FCatalog& C, FProgression& P, FGarage& G, const std::string& Id)
	{
		const FEntry* E = C.Find(Id);
		if (!E || !FlHas(P.Fleet.Owned, Id)) return {false, "Not in your fleet"};
		G.Selected = E->Base;
		P.Fleet.Active = Id;
		return {true, E->Name + " is your active vehicle"};
	}

	FResult TuneNode(const FCatalog& C, FProgression& P, const std::string& Id, const std::string& NodeId)
	{
		const FEntry* E = C.Find(Id);
		if (!E || !FlHas(P.Fleet.Owned, Id)) return {false, "Not in your fleet"};
		const auto N = std::find_if(E->Nodes.begin(), E->Nodes.end(), [&NodeId](const FNode& X) { return X.Id == NodeId; });
		if (N == E->Nodes.end()) return {false, "Unknown tuning node"};
		const auto T = P.Fleet.Tuning.find(Id);
		const double Lvl = T == P.Fleet.Tuning.end() || !T->second.count(NodeId) ? 0 : T->second.at(NodeId);
		if (Lvl >= N->MaxLevel) return {false, N->Name + " is maxed"};
		FProgression Next = P;
		if (std::optional<std::string> Err = FlPay(Next, N->Cost)) return {false, *Err};
		Next.Fleet.Tuning[Id][NodeId] = Lvl + 1;
		P = std::move(Next);
		return {true, E->Name + ": " + N->Name + " stage " + js::NumberToString(Lvl + 1)};
	}

	FResult SetPaint(const FCatalog& C, FProgression& P, const std::string& Id, const std::string& Paint)
	{
		const FEntry* E = C.Find(Id);
		if (!E || !FlHas(P.Fleet.Owned, Id) || !FlHas(E->Paints, Paint)) return {false, "Not available"};
		P.Fleet.Paint[Id] = Paint;
		return {true, E->Name + " painted " + Paint};
	}

	FResult SetCosmetic(const FCatalog& C, FProgression& P, const std::string& Id, const std::string& Key, const std::string& Value)
	{
		static const std::map<std::string, std::vector<std::string>> Options = {{"wheels", {"standard", "sport", "offroad"}}, {"body", {"stock", "widebody", "aero"}}, {"spoiler", {"none", "lip", "wing"}}, {"armor", {"stock", "reinforced"}}, {"glow", {"off", "cyan", "magenta"}}};
		const FEntry* E = C.Find(Id);
		const auto O = Options.find(Key);
		if (!E || !FlHas(P.Fleet.Owned, Id)) return {false, "Not in your fleet"};
		if (O == Options.end() || !FlHas(O->second, Value)) return {false, "Invalid cosmetic option"};
		auto& Cos = P.Fleet.Cosmetics[Id];
		(Key == "wheels" ? Cos.Wheels : Key == "body" ? Cos.Body : Key == "spoiler" ? Cos.Spoiler : Key == "armor" ? Cos.Armor : Cos.Glow) = Value;
		return {true, E->Name + ": " + Key + " set to " + Value};
	}

	FVehicleStats TunedVehicle(const FCatalog& C, const FVehicleStats& Base, const FProgression::FFleet& F)
	{
		const FEntry* A = F.Active ? C.Find(*F.Active) : nullptr;
		if (!A || A->Base != Base.Id) return Base;
		const auto T = F.Tuning.find(A->Id);
		std::map<std::string, double> Mult = {{"speed", 1}, {"hull", 1}, {"handling", 1}, {"ram", 1}};
		for (const FNode& N : A->Nodes) Mult[N.Stat] += N.PerLevel * (T == F.Tuning.end() || !T->second.count(N.Id) ? 0 : T->second.at(N.Id));
		FVehicleStats Out = Base;
		Out.Name = A->Name;
		Out.Speed = Base.Speed * Mult["speed"]; Out.Hull = Base.Hull * Mult["hull"]; Out.Handling = Base.Handling * Mult["handling"]; Out.Ram = Base.Ram * Mult["ram"];
		return Out;
	}

	std::optional<FTuningSummary> TuningSummary(const FCatalog& C, const FProgression::FFleet& F)
	{
		const FEntry* A = F.Active ? C.Find(*F.Active) : nullptr;
		if (!A) return std::nullopt;
		const auto T = F.Tuning.find(A->Id);
		std::map<std::string, FStatTuning> By;
		for (const FNode& N : A->Nodes)
		{
			const double L = T == F.Tuning.end() || !T->second.count(N.Id) ? 0 : T->second.at(N.Id);
			FStatTuning& R = By[N.Stat];
			R.Stat = N.Stat; R.Level += L; R.MaxLevel += N.MaxLevel; R.Bonus += N.PerLevel * L;
		}
		FTuningSummary S{A->Name, A->Category, A->Ability, {}};
		for (const char* Stat : {"speed", "handling", "hull", "ram"}) if (By.count(Stat)) S.Stats.push_back(By[Stat]);
		return S;
	}

	std::vector<FCircle> Sanctuaries(const FCatalog& C, const FProgression& P)
	{
		std::vector<FCircle> Out;
		for (const std::string& Id : P.Fleet.Garages)
			if (const FGarageBase* G = C.FindGarage(Id); G && !G->bUnderwater) Out.push_back({G->X, G->Z - 4, SanctuaryRadius});
		return Out;
	}
}

namespace wf::gadget
{
	std::optional<FGadget> GadgetFor(const std::string& BuildId)
	{
		static const std::map<std::string, FGadget> G = {
			{"goliath-4x4", {"RAM", "Bumper: kinetic ramming grill", "PASSIVE", 0}},
			{"behemoth-v16", {"FLAME", "Under-chassis flame jets", "HELD", 0}},
			{"dune-stalker", {"MINE", "Rear mine dropper", "PRESS", 1.6}},
			{"f39-jupiter", {"DRONE", "RQ-44 Remora drone dock", "PRESS", 28}},
			{"rift-runner", {"CALTROPS", "Rear: caltrop launcher", "PRESS", 9}},
			{"void-chaser", {"EMP_MINE", "EMP mine dispenser", "PRESS", 2.4}},
			{"skyhawk", {"FLARES", "Pylons: flare pods", "PRESS", 11}},
			{"void-skimmer-prototype", {"BREACH", "Hull: boundary-breach thruster", "PRESS", 8}},
		};
		const auto It = G.find(BuildId);
		return It == G.end() ? std::nullopt : std::optional<FGadget>(It->second);
	}

	const FMineTuning& MineTuning(const std::string& Kind)
	{
		static const FMineTuning Mine{0.9, 3.4, 7, 16, 2.4, 90, 6};
		static const FMineTuning Emp{0.9, 4, 10, 3, 0, 90, 4, 3, 0.25, 3};
		return Kind == "EMP_MINE" ? Emp : Mine;
	}

	void DropMine(FState& S, const std::string& Kind, double X, double Y, double Z, double Now)
	{
		const FMineTuning& T = MineTuning(Kind);
		S.Mines.push_back({Kind, X, Y, Z, Now + T.Arm, Now + T.Life, S.NextId++});
		int Count = 0;
		for (const FMine& M : S.Mines) if (M.Kind == Kind) ++Count;
		if (Count > T.Max)
			for (auto It = S.Mines.begin(); It != S.Mines.end(); ++It) if (It->Kind == Kind) { S.Mines.erase(It); break; } // the oldest goes
	}
	bool MineTriggered(const FMine& M, double Now, const std::vector<FPoint>& Targets)
	{
		if (Now < M.ArmAt) return false;
		const double R = MineTuning(M.Kind).Trigger;
		return std::any_of(Targets.begin(), Targets.end(), [&](const FPoint& T) { return std::hypot(T.X - M.X, T.Z - M.Z) <= R; });
	}
	void LaunchCaltrops(FState& S, double X, double Z, double Now)
	{
		S.Caltrops.push_back({X, Z, CaltropRadius, Now + CaltropLife, S.NextId++});
		if (S.Caltrops.size() > 3) S.Caltrops.erase(S.Caltrops.begin());
	}
	bool InCaltrops(const FState& S, double X, double Z, double Now)
	{
		return std::any_of(S.Caltrops.begin(), S.Caltrops.end(), [&](const FCaltrops& C) { return C.Until > Now && std::hypot(X - C.X, Z - C.Z) <= C.R; });
	}
	bool InFlames(double SX, double SZ, double Yaw, double TX, double TZ, double BodyR)
	{
		const double Fx = std::sin(Yaw), Fz = std::cos(Yaw), Dx = TX - SX, Dz = TZ - SZ;
		const double Along = Dx * Fx + Dz * Fz;
		const double C = std::max(-2.0, std::min(FlameAhead, Along));
		return std::hypot(Dx - Fx * C, Dz - Fz * C) <= FlameReach + BodyR;
	}
	void PopFlares(FState& S, double X, double Y, double Z, double Yaw, double Now)
	{
		const int N = FlareCount;
		for (int I = 0; I < N; ++I)
		{
			const double Side = I % 2 ? 1 : -1, K = std::floor(I / 2.0) / (N / 2.0);
			const double A = Yaw + 3.141592653589793 + Side * (0.6 + K * 0.9);
			S.Flares.push_back({X, Y, Z, std::sin(A) * (10 + K * 6), 4 - K * 3, std::cos(A) * (10 + K * 6), Now + FlareFall});
		}
		if (S.Flares.size() > 32) S.Flares.erase(S.Flares.begin(), S.Flares.end() - 32);
		S.SpoofUntil = Now + FlareSpoof;
	}
	void StepFlares(FState& S, double Now, double Dt)
	{
		S.Flares.erase(std::remove_if(S.Flares.begin(), S.Flares.end(), [Now](const FFlare& F) { return !(F.Until > Now); }), S.Flares.end());
		for (FFlare& F : S.Flares)
		{
			F.Vy -= 9.8 * 0.35 * Dt; F.Vx *= 1 - Dt * 0.6; F.Vz *= 1 - Dt * 0.6;
			F.X += F.Vx * Dt; F.Y += F.Vy * Dt; F.Z += F.Vz * Dt;
		}
	}
	bool Spoofed(const FState& S, double Now) { return S.SpoofUntil > Now; }
	void LaunchDrone(FState& S, double X, double Y, double Z, double Now)
	{
		S.Drones.erase(std::remove_if(S.Drones.begin(), S.Drones.end(), [Now](const FDrone& D) { return !(D.Until > Now); }), S.Drones.end());
		if (!S.Drones.empty()) S.Drones.erase(S.Drones.begin()); // one Remora per dock
		S.Drones.push_back({X, Y, Z, Now + DroneLife, 0.6, 0, S.NextId++});
	}
	void StepDrone(FDrone& D, double Px, double Py, double Pz, double Dt)
	{
		D.Angle += Dt * 0.7;
		const double Tx = Px + std::sin(D.Angle) * DroneOrbit, Tz = Pz + std::cos(D.Angle) * DroneOrbit, Ty = Py + DroneHeight;
		const double Dx = Tx - D.X, Dy = Ty - D.Y, Dz = Tz - D.Z, Dist = std::hypot(Dx, Dy, Dz);
		const double Step = std::min(Dist, DroneSpeed * Dt);
		if (Dist > 1e-6) { D.X += (Dx / Dist) * Step; D.Y += (Dy / Dist) * Step; D.Z += (Dz / Dist) * Step; }
		D.Cool -= Dt;
	}
	int DroneTarget(const FDrone& D, const std::vector<FPoint>& Targets, const std::vector<bool>& Visible)
	{
		int Best = -1;
		double Bd = DroneRange;
		for (int I = 0; I < static_cast<int>(Targets.size()); ++I)
		{
			const FPoint& T = Targets[I];
			if (!T.bAlive) continue;
			const double Dist = std::hypot(T.X - D.X, T.Z - D.Z);
			if (Dist < Bd && (Visible.empty() || Visible[I])) { Bd = Dist; Best = I; }
		}
		return Best;
	}
	FRam RamFor(const std::optional<FGadget>& G, double BreachUntil, double Now)
	{
		if (G && G->Kind == "RAM") return {RamDamageMult, RamSelfMult};
		if (G && G->Kind == "BREACH" && BreachUntil > Now) return {BreachRamMult, BreachSelfMult};
		return {1, 1};
	}
	double SlowFor(double Base, bool bBoss) { return bBoss ? std::max(Base, 0.8) : Base; }
}
