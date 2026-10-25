// Golden test for the C++ quest core: replays every case recorded from the web build's TypeScript engine
// (tools/gen-quest-golden.ts) and requires an identical progression after each step.
//
// Build and run outside Unreal (any C++17 compiler):
//   g++ -std=c++17 -O1 -Wall -Wextra -I../Source/WorldFractureCore/Public
//       QuestCoreTest.cpp ../Source/WorldFractureCore/Private/Core/WFQuestCore.cpp -o quest_test
//   ./quest_test quest_golden.txt
#include "Core/WFQuestCore.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf::quest;

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

	std::string Inner(const std::string& S, char Open, char Close)
	{
		if (S.size() < 2 || S.front() != Open || S.back() != Close) throw std::runtime_error("expected " + std::string(1, Open) + "...: " + S);
		return S.substr(1, S.size() - 2);
	}

	std::vector<std::string> ParseList(const std::string& S)
	{
		const std::string Body = Inner(S, '[', ']');
		return Body.empty() ? std::vector<std::string>{} : Split(Body, ',');
	}

	std::map<std::string, double> ParseNumberMap(const std::string& S)
	{
		std::map<std::string, double> Out;
		const std::string Body = Inner(S, '{', '}');
		if (Body.empty()) return Out;
		for (const std::string& Pair : Split(Body, ','))
		{
			const size_t Colon = Pair.rfind(':');
			Out[Pair.substr(0, Colon)] = Num(Pair.substr(Colon + 1));
		}
		return Out;
	}

	/** Inverse of ToCanonicalString, used for each case's starting state. */
	FProgression ParseCanonical(const std::string& Text)
	{
		FProgression P;
		for (const std::string& Field : Split(Text, ';'))
		{
			const size_t Eq = Field.find('=');
			const std::string Name = Field.substr(0, Eq), Value = Field.substr(Eq + 1);
			if (Name == "active") { if (Value != "null") P.ActiveQuestId = Value; }
			else if (Name == "completed") P.CompletedMissions = ParseList(Value);
			else if (Name == "unlocked") P.UnlockedWorlds = ParseList(Value);
			else if (Name == "world") P.CurrentWorld = Value;
			else if (Name == "corruption") P.CorruptionLevel = Num(Value);
			else if (Name == "shards") P.FractureShards = Num(Value);
			else if (Name == "materials") P.Materials = ParseNumberMap(Value);
			else if (Name == "dungeon") P.DungeonClears = ParseNumberMap(Value);
			else if (Name == "flags")
			{
				const std::string Body = Inner(Value, '{', '}');
				if (!Body.empty())
					for (const std::string& Pair : Split(Body, ','))
					{
						const size_t Colon = Pair.rfind(':');
						P.WorldFlags[Pair.substr(0, Colon)] = Pair.substr(Colon + 1) == "true";
					}
			}
			else if (Name == "progress")
			{
				// id:[a,b],id2:[c] — split on "]," boundaries.
				std::string Body = Inner(Value, '{', '}');
				size_t Pos = 0;
				while (Pos < Body.size())
				{
					const size_t Colon = Body.find(":[", Pos);
					const size_t Close = Body.find(']', Colon);
					std::vector<double> Values;
					const std::string Items = Body.substr(Colon + 2, Close - Colon - 2);
					if (!Items.empty()) for (const std::string& V : Split(Items, ',')) Values.push_back(Num(V));
					P.QuestObjectiveProgress[Body.substr(Pos, Colon - Pos)] = Values;
					Pos = Close + 2; // skip "],"
				}
			}
			else throw std::runtime_error("unknown field: " + Name);
		}
		return P;
	}

	FEvent ParseEvent(const std::vector<std::string>& F)
	{
		const std::string& Type = F.at(1);
		const std::string& World = F.at(2);
		const std::string& Id = F.at(3);
		const double N = Num(F.at(4));
		if (Type == "ENTER_WORLD") return FEvent::EnterWorld(World);
		if (Type == "KILL") return FEvent::Kill(World);
		if (Type == "SURVIVED") return FEvent::Survived(World, N);
		if (Type == "MISSION_COMPLETE") return FEvent::MissionComplete(Id);
		if (Type == "DUNGEON_CLEARED") return FEvent::DungeonCleared(Id);
		if (Type == "BOSS_DEFEATED") return FEvent::BossDefeated(Id);
		if (Type == "HEAT_LEVEL") return FEvent::HeatLevel(N);
		if (Type == "LOCKDOWN_TIER") return FEvent::LockdownTier(Id);
		if (Type == "HACK_COMPLETE") return FEvent::HackComplete();
		throw std::runtime_error("unknown event: " + Type);
	}
}

int main(int Argc, char** Argv)
{
	const char* Path = Argc > 1 ? Argv[1] : "quest_golden.txt";
	std::ifstream In(Path);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Path); return 2; }

	FCatalog Catalog;
	FQuest* Building = nullptr;
	std::vector<FQuest> Pending;
	std::string Line, CaseName;
	FProgression State;
	size_t Cases = 0, Checked = 0, Failures = 0, LineNo = 0;

	auto FlushCatalog = [&]() {
		for (FQuest& Q : Pending) Catalog.Add(std::move(Q));
		Pending.clear();
		Building = nullptr;
	};

	while (std::getline(In, Line))
	{
		++LineNo;
		if (Line.empty()) continue;
		const std::vector<std::string> F = Split(Line, '\t');
		const std::string& Kind = F[0];
		if (Kind == "Q")
		{
			FQuest Q;
			Q.Id = F.at(1); Q.Title = F.at(2); Q.World = F.at(3); Q.RewardShards = Num(F.at(4));
			if (F.at(5) != None) Q.UnlocksWorld = F[5];
			if (F.at(6) != None) Q.NextQuestId = F[6];
			Q.Corruption = Num(F.at(7));
			if (F.at(8) != None)
				for (const std::string& Pair : Split(F[8], ','))
				{
					const size_t Eq = Pair.find('=');
					Q.RewardMaterials[Pair.substr(0, Eq)] = Num(Pair.substr(Eq + 1));
				}
			Pending.push_back(std::move(Q));
			Building = &Pending.back();
		}
		else if (Kind == "O")
		{
			FObjective O;
			if (!ParseObjectiveType(F.at(1), O.Type)) throw std::runtime_error("unknown objective type " + F[1]);
			if (F.at(2) != None) O.Key = F[2];
			O.Amount = Num(F.at(3));
			Building->Objectives.push_back(O);
		}
		else if (Kind == "C") { if (!Pending.empty()) FlushCatalog(); CaseName = F.at(1); ++Cases; }
		else if (Kind == "S") State = ParseCanonical(F.at(1));
		else if (Kind == "F") State = FinishActiveQuest(Catalog, State);
		else if (Kind == "E") State = GameTick(Catalog, State, ParseEvent(F));
		else if (Kind == "X")
		{
			++Checked;
			const std::string Got = ToCanonicalString(State);
			if (Got != F.at(1))
			{
				if (++Failures <= 5)
					std::fprintf(stderr, "MISMATCH case %s (line %zu)\n  want %s\n  got  %s\n", CaseName.c_str(), LineNo, F[1].c_str(), Got.c_str());
				State = ParseCanonical(F[1]); // resync so one divergence doesn't cascade
			}
		}
		else throw std::runtime_error("unknown line kind: " + Kind);
	}

	std::printf("%zu quests, %zu cases, %zu states checked, %zu mismatches\n", Catalog.Num(), Cases, Checked, Failures);
	return Failures == 0 && Checked > 0 ? 0 : 1;
}
