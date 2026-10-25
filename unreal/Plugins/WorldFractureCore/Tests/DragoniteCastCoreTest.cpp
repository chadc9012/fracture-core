// Golden test for the C++ Dragonite casts: replays castDragonite / stepDragonite operations recorded from the web
// build's real dragonite-cast.ts (tools/gen-dragoncast-golden.ts). The recorder priced damage at x0.9 and logged every
// world call; this test's world does the same, so the call logs and resulting states must match. Numbers compare to
// 1e-9 relative (cones and knockback use atan2 / sin / cos / hypot).
#include "Core/WFDragoniteCastCore.h"
#include "Core/WFJsCompat.h"

#include <cctype>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::dragoncast;

namespace
{
	const std::string None = "~";

	std::vector<std::string> Split(const std::string& S, char Sep)
	{
		std::vector<std::string> Out;
		std::string Cur;
		for (char C : S)
		{
			if (C == Sep) { Out.push_back(Cur); Cur.clear(); }
			else Cur += C;
		}
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
	std::string O(const std::optional<double>& V) { return V ? N(*V) : None; }
	std::optional<std::string> OptEmpty(const std::string& S) { return S.empty() ? std::nullopt : std::optional<std::string>(S); }

	FGearItem ParseGear(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		FGearItem G;
		G.Id = F.at(0); G.Name = F.at(1); G.Slot = F.at(2); G.Power = Num(F.at(3)); G.Level = Num(F.at(4)); G.Element = F.at(5); G.Source = F.at(6);
		G.SetId = OptEmpty(F.at(7)); G.Rarity = OptEmpty(F.at(8)); G.Perk = OptEmpty(F.at(9));
		return G;
	}

	std::string StatsText(const std::optional<dragon::FStats>& S)
	{
		if (!S) return None;
		std::string Out;
		for (const auto& [K, V] : *S) { if (!Out.empty()) Out += ","; Out += K + ":" + N(V); }
		return Out;
	}

	class FTestWorld final : public IWorld
	{
	public:
		std::vector<std::string> Log;
		double DamageMods(std::vector<FMachine>&, size_t I, double Dmg, const std::string& Element, double X, double Z) override
		{
			Log.push_back("dmg:" + std::to_string(I) + ":" + N(Dmg) + ":" + Element + ":" + N(X) + ":" + N(Z));
			return Dmg * 0.9;
		}
		void Defeat(std::vector<FMachine>& Machines, size_t I) override
		{
			Log.push_back("defeat:" + std::to_string(I));
			if (Machines[I].Hp <= 0) Machines[I].bAlive = false;
		}
		void Alert(const std::string& Text) override { Log.push_back("alert:" + Text); }
	};

	std::string State(const FRuntime& Rt, const std::vector<FMachine>& Ms)
	{
		std::string Cd;
		for (const char* Id : dragon::AbilityIds) { if (!Cd.empty()) Cd += ","; Cd += std::string(Id) + "=" + N(Rt.Cd.at(Id)); }
		const std::string P = Rt.Pending ? N(Rt.Pending->X) + "|" + N(Rt.Pending->Z) + "|" + N(Rt.Pending->Left) + "|" + N(Rt.Pending->Fury) + "|" + StatsText(Rt.Pending->Stats) : None;
		const dragon::FWyrm& W = Rt.Wyrm;
		const std::string Wyrm = std::string(dragon::WyrmStateName(W.State)) + "/" + N(W.T) + "/" + N(W.Left) + "/" + N(W.StrafesLeft) + "/" + (W.Target ? N(*W.Target) : None) + "/" + N(W.Cooldown) + "/" + (W.bFinished ? "1" : "0");
		std::string M;
		for (const FMachine& X : Ms)
		{
			if (!M.empty()) M += ";";
			M += std::string(X.bAlive ? "1" : "0") + "|" + N(X.X) + "|" + N(X.Z) + "|" + N(X.Hp) + "|" + (X.bBoss ? "1" : "0") + "|" + N(X.Aim) + "|" + N(X.Cool) + "|" + N(X.VulnUntil) + "|" + N(X.VulnMult);
		}
		return "cd={" + Cd + "};pending=" + P + ";hide=" + N(Rt.Hide) + ";hideStats=" + StatsText(Rt.HideStats) + ";glide=" + N(Rt.Glide) + ";air=" + N(Rt.AirDashes) + ";landing=" + N(Rt.LandingStrike) + ";wyrm=" + Wyrm + ";machines=[" + M + "]";
	}

	/** number tokens compare to 1e-9 relative, the rest exactly (see EncounterCoreTest.cpp) */
	bool FuzzyEqual(const std::string& A, const std::string& B)
	{
		if (A == B) return true;
		auto Tokens = [](const std::string& S) {
			std::vector<std::pair<bool, std::string>> Out;
			std::string Text;
			size_t I = 0;
			while (I < S.size())
			{
				const bool bPrev = I > 0 && (std::isalnum(static_cast<unsigned char>(S[I - 1])) || S[I - 1] == '_');
				const bool bStart = !bPrev && (std::isdigit(static_cast<unsigned char>(S[I])) || (S[I] == '-' && I + 1 < S.size() && std::isdigit(static_cast<unsigned char>(S[I + 1]))));
				if (bStart)
				{
					size_t J = I + 1;
					while (J < S.size() && (std::isdigit(static_cast<unsigned char>(S[J])) || S[J] == '.' || S[J] == 'e' || ((S[J] == '-' || S[J] == '+') && S[J - 1] == 'e'))) ++J;
					if (!Text.empty()) { Out.push_back({false, Text}); Text.clear(); }
					Out.push_back({true, S.substr(I, J - I)});
					I = J;
				}
				else Text += S[I++];
			}
			if (!Text.empty()) Out.push_back({false, Text});
			return Out;
		};
		const auto Ta = Tokens(A), Tb = Tokens(B);
		if (Ta.size() != Tb.size()) return false;
		for (size_t I = 0; I < Ta.size(); ++I)
		{
			if (Ta[I].first != Tb[I].first) return false;
			if (!Ta[I].first) { if (Ta[I].second != Tb[I].second) return false; continue; }
			double X = 0, Y = 0;
			std::from_chars(Ta[I].second.data(), Ta[I].second.data() + Ta[I].second.size(), X);
			std::from_chars(Tb[I].second.data(), Tb[I].second.data() + Tb[I].second.size(), Y);
			if (!(X == Y || std::fabs(X - Y) <= 1e-9 * std::max(1.0, std::max(std::fabs(X), std::fabs(Y))))) return false;
		}
		return true;
	}

	size_t Checked = 0, Failures = 0, Fuzzy = 0;
	std::string CaseName;
	void Expect(const std::string& What, const std::string& Want, const std::string& Got, size_t Line, bool bFuzzy = true)
	{
		++Checked;
		if (Want == Got) return;
		if (bFuzzy && FuzzyEqual(Want, Got)) { ++Fuzzy; return; }
		if (++Failures <= 5) std::fprintf(stderr, "MISMATCH %s in %s (line %zu)\n  want %s\n  got  %s\n", What.c_str(), CaseName.c_str(), Line, Want.c_str(), Got.c_str());
	}
}

int main(int Argc, char** Argv)
{
	const char* Path = Argc > 1 ? Argv[1] : "dragonitecast_golden.txt";
	std::ifstream In(Path);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Path); return 2; }

	FProgression P;
	FContext Ctx;
	FRuntime Rt;
	FTestWorld World;
	std::vector<FMachine> Machines;
	double Energy = 0;
	std::string Line;
	size_t LineNo = 0, Ops = 0;

	while (std::getline(In, Line))
	{
		++LineNo;
		if (Line.empty()) continue;
		const std::vector<std::string> F = Split(Line, '\t');
		const std::string& K = F[0];
		if (K == "C")
		{
			CaseName = F.at(1);
			P = FProgression{};
			P.Inventory.clear(); P.EarnedRewards.clear(); P.EquippedGear.clear();
			Ctx = FContext{};
			Ctx.Progression = &P;
			if (F.at(2) != None) Ctx.Class = F.at(2);
			Ctx.Fury = Num(F.at(3));
			Energy = Num(F.at(4));
			Rt = FRuntime{};
			Machines.clear();
		}
		else if (K == "PI") P.Inventory.push_back(ParseGear(F.at(1)));
		else if (K == "PE") P.EquippedGear[F.at(1)] = F.at(2);
		else if (K == "K") P.EarnedRewards.push_back(F.at(1));
		else if (K == "M")
		{
			FMachine M;
			M.bAlive = F.at(1) == "1"; M.X = Num(F.at(2)); M.Z = Num(F.at(3)); M.Hp = Num(F.at(4)); M.bBoss = F.at(5) == "1"; M.Aim = Num(F.at(6)); M.Cool = Num(F.at(7)); M.VulnUntil = Num(F.at(8)); M.VulnMult = Num(F.at(9));
			Machines.push_back(M);
		}
		else if (K == "CAST")
		{
			World.Log.clear();
			const FCastOutcome R = CastDragonite(Rt, World, Machines, Energy, F.at(1), FPose{Num(F.at(2)), Num(F.at(3)), Num(F.at(4))}, F.at(5) == "1", Ctx, Num(F.at(6)));
			std::getline(In, Line); ++LineNo;
			const std::vector<std::string> G = Split(Line, '\t');
			Expect("cast", G.at(1), std::string(R.bOk ? "1" : "0") + "|" + R.Text + "|" + O(R.LaunchVy) + "|" + O(R.GlideSeconds) + "|" + O(R.AirDashes) + "|" + N(Energy), LineNo);
			++Ops;
		}
		else if (K == "STEP")
		{
			World.Log.clear();
			const double Dt = Num(F.at(1));
			const FStepResult R = StepDragonite(Rt, World, Machines, Dt, FPose{Num(F.at(2)), Num(F.at(3)), 0}, Ctx);
			std::getline(In, Line); ++LineNo;
			const std::vector<std::string> G = Split(Line, '\t');
			Expect("step", G.at(1), N(R.Resist) + "|" + N(R.Stagger) + "|" + (R.bGliding ? "1" : "0"), LineNo);
			Energy = RegenEnergy(Energy, Dt);
			for (FMachine& M : Machines) M.Cool = std::max(0.0, M.Cool - Dt);
			++Ops;
		}
		else if (K == "EN") Expect("energy", F.at(1), N(Energy), LineNo);
		else if (K == "AIM") Machines.at(static_cast<size_t>(Num(F.at(1)))).Aim = Num(F.at(2));
		else if (K == "L")
		{
			std::string Got;
			for (const std::string& E : World.Log) { if (!Got.empty()) Got += ";"; Got += E; }
			Expect("world calls", F.at(1), Got.empty() ? None : Got, LineNo);
		}
		else if (K == "X") Expect("state", F.at(1), State(Rt, Machines), LineNo);
		else if (K == "ENR") Expect("regenEnergy", F.at(4), N(RegenEnergy(Num(F.at(1)), Num(F.at(2)), Num(F.at(3)))), LineNo, false);
		else throw std::runtime_error("unknown line kind: " + K);
	}
	std::printf("%zu operations, %zu checks (%zu within float tolerance), %zu mismatches\n", Ops, Checked, Fuzzy, Failures);
	return Failures == 0 && Ops > 0 ? 0 : 1;
}
