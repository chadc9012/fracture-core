// Golden test for the C++ fleet and gadgets: replays tools/gen-fleet-golden.ts, recorded from the web build's real fleet.ts
// and vehicle-gadgets.ts. Purchases, tuning, paint, cosmetics, the saved state and the gadget objects must match;
// trigonometry (flares, drones, flames) compares to 1e-9 relative.
#include "Core/WFFleetCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;

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
	int Checks = 0, Mismatches = 0;
	bool NumberLike(const std::string& S, double& V) { if (S.empty()) return false; const auto R = std::from_chars(S.data(), S.data() + S.size(), V); return R.ec == std::errc() && R.ptr == S.data() + S.size(); }
	std::vector<std::string> Tokens(const std::string& S)
	{
		std::vector<std::string> Out;
		std::string Cur;
		for (char C : S) { if (std::string("|/;,:=#\t").find(C) != std::string::npos) { Out.push_back(Cur); Out.push_back(std::string(1, C)); Cur.clear(); } else Cur += C; }
		Out.push_back(Cur);
		return Out;
	}
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got == Want) return;
		const auto G = Tokens(Got), W = Tokens(Want);
		bool bOk = G.size() == W.size();
		for (size_t I = 0; bOk && I < G.size(); ++I)
		{
			if (G[I] == W[I]) continue;
			double A = 0, B = 0;
			bOk = NumberLike(G[I], A) && NumberLike(W[I], B) && std::fabs(A - B) <= 1e-9 * std::max(1.0, std::fabs(B));
		}
		if (!bOk && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	fleet::FCost Cost(const std::string& S)
	{
		fleet::FCost C;
		if (S == None) return C;
		for (const std::string& P : Split(S, ';')) { const auto KV = Split(P, '='); C.push_back({KV[0], Num(KV[1])}); }
		return C;
	}
	std::string Join(const std::vector<std::string>& V, const char* Sep = ",") { std::string O; for (size_t I = 0; I < V.size(); ++I) { if (I) O += Sep; O += V[I]; } return O.empty() ? None : O; }
	std::string FleetText(const FProgression::FFleet& F)
	{
		std::string T, Pa, Co;
		for (const auto& [K, M] : F.Tuning) { if (!T.empty()) T += ","; T += K + ":"; bool bFirst = true; for (const auto& [Nd, L] : M) { if (!bFirst) T += "/"; bFirst = false; T += Nd + "=" + N(L); } }
		for (const auto& [K, V] : F.Paint) { if (!Pa.empty()) Pa += ","; Pa += K + "=" + V; }
		for (const auto& [K, C] : F.Cosmetics) { if (!Co.empty()) Co += ","; Co += K + "=" + C.Wheels + "/" + C.Body + "/" + C.Spoiler + "/" + C.Armor + "/" + C.Glow; }
		return Join(F.Owned) + "|" + Join(F.Garages) + "|" + (T.empty() ? None : T) + "|" + (Pa.empty() ? None : Pa) + "|" + F.Active.value_or(None) + "|" + (Co.empty() ? None : Co);
	}
	std::string StateText(const FProgression& P, const FGarage& G)
	{
		std::string M, L;
		for (const auto& [K, V] : P.Materials) { if (!M.empty()) M += ","; M += K + "=" + N(V); }
		for (const auto& [K, V] : P.NexLedger) { if (!L.empty()) L += ","; L += K + "=" + N(V); }
		return (M.empty() ? None : M) + "#" + (L.empty() ? None : L) + "#" + FleetText(P.Fleet) + "#" + Join(G.Owned) + "#" + Join(G.Loadout) + "#" + G.Selected.value_or(None);
	}
	std::string GadgetText(const gadget::FState& S)
	{
		std::string Mi, Ca, Dr, Fl;
		for (const auto& M : S.Mines) { if (!Mi.empty()) Mi += ";"; Mi += M.Kind + "/" + N(M.X) + "/" + N(M.Y) + "/" + N(M.Z) + "/" + N(M.ArmAt) + "/" + N(M.Until) + "/" + N(M.Id); }
		for (const auto& C : S.Caltrops) { if (!Ca.empty()) Ca += ";"; Ca += N(C.X) + "/" + N(C.Z) + "/" + N(C.R) + "/" + N(C.Until) + "/" + N(C.Id); }
		for (const auto& D : S.Drones) { if (!Dr.empty()) Dr += ";"; Dr += N(D.X) + "/" + N(D.Y) + "/" + N(D.Z) + "/" + N(D.Until) + "/" + N(D.Cool) + "/" + N(D.Angle) + "/" + N(D.Id); }
		for (const auto& F : S.Flares) { if (!Fl.empty()) Fl += ";"; Fl += N(F.X) + "/" + N(F.Y) + "/" + N(F.Z) + "/" + N(F.Vx) + "/" + N(F.Vy) + "/" + N(F.Vz) + "/" + N(F.Until); }
		auto O = [](const std::string& X) { return X.empty() ? None : X; };
		return O(Mi) + "|" + O(Ca) + "|" + O(Dr) + "|" + O(Fl) + "|" + N(S.SpoofUntil) + "|" + N(S.NextId);
	}
	std::vector<gadget::FPoint> Points(const std::string& S)
	{
		std::vector<gadget::FPoint> Out;
		if (S == None) return Out;
		for (const std::string& P : Split(S, ';')) { const auto T = Split(P, '/'); Out.push_back({Num(T[0]), Num(T[1]), T[2] == "1"}); }
		return Out;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: %s golden.txt\n", Argv[0]); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	fleet::FCatalog C;
	std::map<std::string, fleet::FVehicleStats> Chassis;
	FProgression P;
	FGarage G;
	gadget::FState GS;
	int Cases = 0, Ops = 0, GadgetOps = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const int LineNo = static_cast<int>(I) + 1;
		const auto F = Split(Lines[I], '\t');
		const std::string& T = F[0];
		if (T == "FL")
		{
			fleet::FEntry E;
			E.Id = F[1]; E.Name = F[2]; E.Category = F[3]; E.Base = F[4]; E.Garage = F[5]; E.Ability = F[6]; E.NexPrice = Num(F[7]); E.Cost = Cost(F[8]);
			E.Hardpoints = Split(F[9], '|'); E.Paints = Split(F[10], '|');
			C.Fleet.push_back(E);
		}
		else if (T == "N") C.Fleet.back().Nodes.push_back({F[1], F[2], F[3], F[4], Num(F[5]), Num(F[6]), Cost(F[7])});
		else if (T == "GB") C.Garages.push_back({F[1], F[2], F[3], Num(F[4]), Num(F[5]), F[6] == "1", Cost(F[7])});
		else if (T == "VD") Chassis[F[1]] = {F[1], F[2], Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6])};
		else if (T == "C") { ++Cases; P = FProgression{}; P.Materials.clear(); P.NexLedger.clear(); G = FGarage{}; }
		else if (T == "PMAT") P.Materials[F[1]] = Num(F[2]);
		else if (T == "NEX") P.NexLedger[F[1]] = Num(F[2]);
		else if (T == "OWNV") { G.Owned.push_back(F[1]); G.Loadout.push_back(F[1]); G.Selected = F[1]; }
		else if (T == "OP")
		{
			++Ops;
			fleet::FResult R;
			if (F[1] == "garage") R = fleet::BuyGarage(C, P, F[2]);
			else if (F[1] == "buy") R = fleet::BuyFleetVehicle(C, P, G, F[2]);
			else if (F[1] == "active") R = fleet::SetActiveFleet(C, P, G, F[2]);
			else if (F[1] == "tune") R = fleet::TuneNode(C, P, F[2], F[3]);
			else if (F[1] == "paint") R = fleet::SetPaint(C, P, F[2], F[3]);
			else R = fleet::SetCosmetic(C, P, F[2], F[3], F[4]);
			++I;
			Same(static_cast<int>(I) + 1, "result", (R.bOk ? "OK:" : "ERR:") + R.Message, Split(Lines[I], '\t')[1]);
		}
		else if (T == "S") Same(LineNo, "state", StateText(P, G), F[1]);
		else if (T == "TV")
		{
			const fleet::FVehicleStats V = fleet::TunedVehicle(C, Chassis[F[1]], P.Fleet);
			Same(LineNo, "tuned", V.Name + "|" + N(V.Speed) + "|" + N(V.Hull) + "|" + N(V.Handling) + "|" + N(V.Ram), F[2] + "|" + F[3] + "|" + F[4] + "|" + F[5] + "|" + F[6]);
		}
		else if (T == "TS")
		{
			const auto S = fleet::TuningSummary(C, P.Fleet);
			std::string Got = None;
			if (S)
			{
				std::string St;
				for (const auto& X : S->Stats) { if (!St.empty()) St += ","; St += X.Stat + "/" + N(X.Level) + "/" + N(X.MaxLevel) + "/" + N(X.Bonus); }
				Got = S->BuildName + "|" + S->Category + "|" + S->Ability + "|" + St;
			}
			Same(LineNo, "summary", Got, F[1]);
		}
		else if (T == "SC")
		{
			std::string Got;
			for (const auto& X : fleet::Sanctuaries(C, P)) { if (!Got.empty()) Got += ","; Got += N(X.X) + "/" + N(X.Z) + "/" + N(X.Radius); }
			Same(LineNo, "sanctuaries", Got.empty() ? None : Got, F[1]);
		}
		else if (T == "GF")
		{
			const auto Gd = gadget::GadgetFor(F[1] == None ? "" : F[1]);
			Same(LineNo, "gadget", Gd ? Gd->Kind + "|" + Gd->Name + "|" + Gd->Use + "|" + N(Gd->Cooldown) : None, F[2]);
		}
		else if (T == "GC") GS = gadget::FState{};
		else if (T == "GOP")
		{
			++GadgetOps;
			const std::string& Op = F[1];
			if (Op == "mine") gadget::DropMine(GS, F[2], Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6]));
			else if (Op == "trig")
			{
				const auto Ts = Points(F[3]);
				std::string Got;
				for (const auto& M : GS.Mines) { if (!Got.empty()) Got += ","; Got += gadget::MineTriggered(M, Num(F[2]), Ts) ? "1" : "0"; }
				Same(LineNo, "mine trigger", Got.empty() ? None : Got, F[4]);
			}
			else if (Op == "caltrops") gadget::LaunchCaltrops(GS, Num(F[2]), Num(F[3]), Num(F[4]));
			else if (Op == "incal") Same(LineNo, "in caltrops", gadget::InCaltrops(GS, Num(F[2]), Num(F[3]), Num(F[4])) ? "1" : "0", F[5]);
			else if (Op == "flame")
			{
				std::string Got;
				for (const auto& Pt : Points(F[6])) { if (!Got.empty()) Got += ","; Got += gadget::InFlames(Num(F[2]), Num(F[3]), Num(F[4]), Pt.X, Pt.Z, Num(F[5])) ? "1" : "0"; }
				Same(LineNo, "flames", Got.empty() ? None : Got, F[7]);
			}
			else if (Op == "flares") gadget::PopFlares(GS, Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]), Num(F[6]));
			else if (Op == "drone") gadget::LaunchDrone(GS, Num(F[2]), Num(F[3]), Num(F[4]), Num(F[5]));
			else if (Op == "step")
			{
				const double Dt = Num(F[2]), Now = Num(F[3]);
				gadget::StepFlares(GS, Now, Dt);
				const auto Ts = Points(F[7]);
				std::vector<bool> Vis;
				if (F[8] != None) for (const std::string& V : Split(F[8], ',')) Vis.push_back(V == "1");
				std::string Hits;
				for (auto& D : GS.Drones) { gadget::StepDrone(D, Num(F[4]), Num(F[5]), Num(F[6]), Dt); if (!Hits.empty()) Hits += ","; Hits += std::to_string(gadget::DroneTarget(D, Ts, Vis)); }
				Same(LineNo, "drone targets", (Hits.empty() ? None : Hits) + "\t" + (gadget::Spoofed(GS, Now) ? "1" : "0"), F[9] + "\t" + F[10]);
			}
			else if (Op == "ram")
			{
				const auto R = gadget::RamFor(gadget::GadgetFor(F[2]), Num(F[3]), Num(F[4]));
				Same(LineNo, "ram", N(R.DamageMult) + "/" + N(R.SelfMult) + "\t" + N(gadget::SlowFor(Num(F[7]), F[6] == "1")), F[5] + "\t" + F[8]);
			}
		}
		else if (T == "GS") Same(LineNo, "gadget state", GadgetText(GS), F[1]);
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d fleet cases, %d operations, %d gadget operations, %d checks, %d mismatches\n", Cases, Ops, GadgetOps, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
