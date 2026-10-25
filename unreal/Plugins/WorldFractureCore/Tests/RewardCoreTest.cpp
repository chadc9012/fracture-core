// Golden test for the C++ reward core: replays kills, drop claims and XP grants recorded from the web build's real
// sim.ts / inventory.ts / xp.ts (tools/gen-reward-golden.ts), feeding back the exact random numbers it drew.
#include "Core/WFJsCompat.h"
#include "Core/WFRewardCore.h"

#include <charconv>
#include <cstdio>
#include <deque>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::reward;

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

	std::optional<std::string> Opt(const std::string& S) { return S == None ? std::nullopt : std::optional<std::string>(S); }

	class FReplayRandom : public IRandom
	{
	public:
		std::deque<double> Uniforms;
		std::deque<std::string> Suffixes;
		double Uniform() override
		{
			if (Uniforms.empty()) throw std::runtime_error("C++ drew more random numbers than the web build");
			const double V = Uniforms.front(); Uniforms.pop_front(); return V;
		}
		std::string UniqueSuffix() override
		{
			if (Suffixes.empty()) throw std::runtime_error("C++ asked for more suffixes than the web build");
			std::string V = Suffixes.front(); Suffixes.pop_front(); return V;
		}
	};

	size_t Checked = 0, Failures = 0;
	std::string CaseName;

	void Expect(const std::string& What, const std::string& Want, const std::string& Got, size_t Line)
	{
		++Checked;
		if (Want == Got) return;
		if (++Failures <= 6) std::fprintf(stderr, "MISMATCH %s in %s (line %zu)\n  want %s\n  got  %s\n", What.c_str(), CaseName.c_str(), Line, Want.c_str(), Got.c_str());
	}
}

int main(int Argc, char** Argv)
{
	const char* Path = Argc > 1 ? Argv[1] : "reward_golden.txt";
	std::ifstream In(Path);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Path); return 2; }

	// JavaScript number text spot checks (the weapon-drop hash depends on these).
	const std::pair<double, const char*> JsCases[] = {{0.1, "0.1"}, {1e-7, "1e-7"}, {1.5e-6, "0.0000015"}, {123456789012345680000.0, "123456789012345680000"}, {1e21, "1e+21"}, {0.30000000000000004, "0.30000000000000004"}, {250, "250"}, {-2.5, "-2.5"}};
	for (const auto& [Value, Want] : JsCases) Expect("NumberToString", Want, js::NumberToString(Value), 0);
	Expect("Round(2.5)", "3", js::NumberToString(js::Round(2.5)), 0);
	Expect("Round(-2.5)", "-2", js::NumberToString(js::Round(-2.5)), 0);

	FCatalog Catalog;
	FProgression P, Q;
	FSimTally Sim;
	std::string Line;
	size_t LineNo = 0, Cases = 0, Kills = 0;
	bool AfterClaim = false;

	while (std::getline(In, Line))
	{
		++LineNo;
		if (Line.empty()) continue;
		const std::vector<std::string> F = Split(Line, '\t');
		const std::string& K = F[0];
		if (K == "SET")
		{
			FArmorSet S{F.at(1), F.at(2), F.at(3), F.at(4), {}};
			for (int I = 0; I < 5; ++I) S.Pieces[SetSlots[I]] = F.at(5 + static_cast<size_t>(I));
			Catalog.Sets.push_back(S);
		}
		else if (K == "POOLE") Catalog.EnemyPool.push_back({F.at(1), F.at(2), F.at(3), F.at(4)});
		else if (K == "POOLB") Catalog.BossPool.push_back({F.at(1), F.at(2), F.at(3), F.at(4)});
		else if (K == "C") { CaseName = F.at(1); ++Cases; P = FProgression{}; P.Inventory.clear(); Sim = FSimTally{}; AfterClaim = false; }
		else if (K == "PI")
		{
			FGearItem G;
			G.Id = F.at(1); G.Name = F.at(2); G.Slot = F.at(3); G.Power = Num(F.at(4)); G.Level = Num(F.at(5)); G.Element = F.at(6); G.Source = F.at(7);
			G.SetId = Opt(F.at(8)); G.Rarity = Opt(F.at(9));
			P.Inventory.push_back(G);
		}
		else if (K == "PE") P.EquippedGear[F.at(1)] = F.at(2);
		else if (K == "PM") P.Materials[F.at(1)] = Num(F.at(2));
		else if (K == "PD") P.DungeonClears[F.at(1)] = Num(F.at(2));
		else if (K == "PC") P.CompletedMissions.push_back(F.at(1));
		else if (K == "PX") { P.Xp = Num(F.at(1)); P.Level = Num(F.at(2)); P.CalibrationTokens = Num(F.at(3)); P.NovaLevel = Num(F.at(4)); }
		else if (K == "PN") P.NovaUnlocks.push_back(F.at(1));
		else if (K == "S")
		{
			Sim.Credits = Num(F.at(1)); Sim.Kills = Num(F.at(2)); Sim.BossKills = Num(F.at(3)); Sim.EliteKills = Num(F.at(4));
			Sim.RivalKills = Num(F.at(5)); Sim.NextDropId = Num(F.at(6)); Sim.CombatHeat = Num(F.at(7));
		}
		else if (K == "K")
		{
			FMachine M;
			M.bAlive = F.at(1) == "1"; M.bBoss = F.at(2) == "1"; M.bElite = F.at(3) == "1"; M.bDecoy = F.at(4) == "1";
			M.bMission = F.at(5) == "1"; M.bEmergencyQuest = F.at(6) == "1"; M.Hp = Num(F.at(7));
			M.Zone = F.at(8); M.DropMaterial = F.at(9); M.Profile = F.at(10);
			M.Rival = Opt(F.at(11)); M.Living = Opt(F.at(12)); M.Nemesis = Opt(F.at(13));
			const ECredit Credit = F.at(14) == "world" ? ECredit::World : ECredit::Player;
			FReplayRandom Random;
			if (F.at(15) != None) { Random.Uniforms = {Num(F.at(15)), Num(F.at(16))}; Random.Suffixes = {F.at(17)}; }
			try { DefeatMachine(Catalog, M, Credit, Sim, Random); }
			catch (const std::exception& E) { Expect("draws", "same draws as the web build", E.what(), LineNo); }
			Expect("draw count", "0", std::to_string(Random.Uniforms.size() + Random.Suffixes.size()), LineNo);
			++Kills;
		}
		else if (K == "T") Expect("tally", F.at(1), DescribeTally(Sim), LineNo);
		else if (K == "CLAIM") { Q = ClaimDrops(Catalog, P, Sim.Drops); AfterClaim = true; }
		else if (K == "L") Expect(AfterClaim ? "loot" : "loot?", F.at(1), DescribeLoot(Q), LineNo);
		else if (K == "X")
		{
			const double Scale = Num(F.at(4));
			FGrantXpResult R = GrantXP(Q, F.at(1), Num(F.at(2)), Num(F.at(3)), std::nullopt, Scale);
			Q = R.Progression;
			std::getline(In, Line); ++LineNo;
			const std::vector<std::string> G = Split(Line, '\t');
			std::string Unlocked;
			for (size_t I = 0; I < R.NovaUnlocked.size(); ++I) { if (I) Unlocked += ","; Unlocked += R.NovaUnlocked[I]; }
			Expect("grantXP", G.at(1) + "|" + G.at(2) + "|" + G.at(3) + "|" + G.at(4),
				js::NumberToString(R.Gained) + "|" + (R.bLeveledUp ? "1" : "0") + "|" + js::NumberToString(R.NewLevel) + "|" + (Unlocked.empty() ? None : Unlocked), LineNo);
		}
		else throw std::runtime_error("unknown line kind: " + K);
	}

	std::printf("%zu sets, %zu/%zu pool weapons, %zu cases, %zu kills, %zu checks, %zu mismatches\n",
		Catalog.Sets.size(), Catalog.EnemyPool.size(), Catalog.BossPool.size(), Cases, Kills, Checked, Failures);
	return Failures == 0 && Kills > 0 ? 0 : 1;
}
