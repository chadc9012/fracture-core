// Golden test for the C++ mission payouts: replays rewardMission / applyMissionCompletion calls recorded from the web
// build's real progression.ts and missions/persistence.ts (tools/gen-missionreward-golden.ts).
#include "Core/WFJsCompat.h"
#include "Core/WFMissionRewardCore.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::missionreward;

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

	std::optional<std::string> OptEmpty(const std::string& S) { return S.empty() ? std::nullopt : std::optional<std::string>(S); }

	FGearItem ParseGear(const std::string& S)
	{
		const std::vector<std::string> F = Split(S, '|');
		if (F.size() != 10) throw std::runtime_error("bad gear: " + S);
		FGearItem G;
		G.Id = F[0]; G.Name = F[1]; G.Slot = F[2]; G.Power = Num(F[3]); G.Level = Num(F[4]); G.Element = F[5]; G.Source = F[6];
		G.SetId = OptEmpty(F[7]); G.Rarity = OptEmpty(F[8]); G.Perk = OptEmpty(F[9]);
		return G;
	}

	/** "id:amount,id:amount" or "~" */
	std::map<std::string, double> ParseMaterials(const std::string& S)
	{
		std::map<std::string, double> Out;
		if (S == None) return Out;
		for (const std::string& Pair : Split(S, ','))
		{
			const size_t Colon = Pair.find(':');
			Out[Pair.substr(0, Colon)] = Num(Pair.substr(Colon + 1));
		}
		return Out;
	}

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
	const char* Path = Argc > 1 ? Argv[1] : "missionreward_golden.txt";
	std::ifstream In(Path);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Path); return 2; }

	reward::FCatalog Rewards;
	FCatalog Missions;
	FProgression P;
	std::string Line;
	size_t LineNo = 0, Cases = 0, Calls = 0;
	std::optional<FCompletionResult> Pending; // an A line waits for its E line

	while (std::getline(In, Line))
	{
		++LineNo;
		if (Line.empty()) continue;
		const std::vector<std::string> F = Split(Line, '\t');
		const std::string& K = F[0];
		if (K == "SET")
		{
			reward::FArmorSet S{F.at(1), F.at(2), F.at(3), F.at(4), {}};
			for (int I = 0; I < 5; ++I) S.Pieces[reward::SetSlots[I]] = F.at(5 + static_cast<size_t>(I));
			Rewards.Sets.push_back(S);
		}
		else if (K == "CP") Missions.CompletionPool.push_back({F.at(1), F.at(2), F.at(3), F.at(4)});
		else if (K == "CAMP") Missions.Campaign.push_back(F.at(1));
		else if (K == "EXO") Missions.CampaignExotics[F.at(1)] = {F.at(2), F.at(3), F.at(4), F.at(5), F.at(6)};
		else if (K == "COLL") Missions.Collections.push_back({F.at(1), Split(F.at(2), ',')});
		else if (K == "STORY") Missions.StoryMissions.push_back(F.at(1));
		else if (K == "COMP") Missions.Completions[F.at(1)] = {ParseMaterials(F.at(4)), F.at(2), F.at(3)};
		else if (K == "C") { CaseName = F.at(1); ++Cases; P = FProgression{}; P.Inventory.clear(); }
		else if (K == "PI") P.Inventory.push_back(ParseGear(F.at(1)));
		else if (K == "PE") P.EquippedGear[F.at(1)] = F.at(2);
		else if (K == "PM") P.Materials[F.at(1)] = Num(F.at(2));
		else if (K == "PC") P.CompletedMissions.push_back(F.at(1));
		else if (K == "PX") { P.Xp = Num(F.at(1)); P.Level = Num(F.at(2)); P.CalibrationTokens = Num(F.at(3)); P.NovaLevel = Num(F.at(4)); P.FractureShards = Num(F.at(5)); }
		else if (K == "PN") P.NovaUnlocks.push_back(F.at(1));
		else if (K == "PRUN")
		{
			FProgression::FRunRecord R;
			R.Day = F.at(2); R.Count = Num(F.at(3));
			if (F.at(4) != None) R.Last = Num(F.at(4));
			P.MissionRuns[F.at(1)] = R;
		}
		else if (K == "PNEX") P.NexLedger[F.at(1)] = Num(F.at(2));
		else if (K == "R") { P = RewardMission(Rewards, Missions, std::move(P), F.at(1), ParseMaterials(F.at(3)), Num(F.at(2))); ++Calls; }
		else if (K == "A") { Pending = ApplyMissionCompletion(Rewards, Missions, P, F.at(1), Num(F.at(2))); P = Pending->Progression; ++Calls; }
		else if (K == "E")
		{
			if (!Pending) throw std::runtime_error("E without A");
			const std::string Got = std::string(Pending->bPaid ? "1" : "0") + "|" + (Pending->QuestEvent ? Pending->QuestEvent->EventType : None) + "|" + (Pending->QuestEvent ? Pending->QuestEvent->EventId : None);
			Expect("completion", F.at(1) + "|" + F.at(2) + "|" + F.at(3), Got, LineNo);
			Pending.reset();
		}
		else if (K == "L") Expect("state", F.at(1), Describe(P), LineNo);
		else throw std::runtime_error("unknown line kind: " + K);
	}

	std::printf("%zu sets, %zu completion weapons, %zu collections, %zu cases, %zu payouts, %zu checks, %zu mismatches\n",
		Rewards.Sets.size(), Missions.CompletionPool.size(), Missions.Collections.size(), Cases, Calls, Checked, Failures);
	return Failures == 0 && Calls > 0 ? 0 : 1;
}
