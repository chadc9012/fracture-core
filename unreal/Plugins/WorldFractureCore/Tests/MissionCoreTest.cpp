// Golden test for the C++ mission machines: replays random event streams recorded from the web build's
// src/game/missions/* (tools/gen-mission-golden.ts) and requires an identical run after every event.
#include "Core/WFMissionCore.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf::mission;

namespace
{
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
}

int main(int Argc, char** Argv)
{
	const char* Path = Argc > 1 ? Argv[1] : "mission_golden.txt";
	std::ifstream In(Path);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Path); return 2; }

	FLines Lines;
	FContext Context;
	FRun Run;
	std::string Line, Case;
	size_t LineNo = 0, Cases = 0, Checked = 0, Failures = 0;
	std::map<std::string, size_t> PerMission;

	while (std::getline(In, Line))
	{
		++LineNo;
		if (Line.empty()) continue;
		const std::vector<std::string> F = Split(Line, '\t');
		const std::string& K = F[0];
		if (K == "CTX")
		{
			Context.Airlock = {Num(F.at(1)), Num(F.at(2))};
			Context.Ring = {Num(F.at(3)), Num(F.at(4))};
			Context.Reactor = {Num(F.at(5)), Num(F.at(6))};
		}
		else if (K == "L") Lines.Add(F.at(1), F.at(2), F.at(3), F.at(4));
		else if (K == "C")
		{
			if (!IsKnown(F.at(1))) throw std::runtime_error("unknown mission " + F[1]);
			Run = Initial(F.at(1));
			Context.Faction = F.at(2) == "~" ? std::nullopt : std::optional<std::string>(F[2]);
			Case = F[1] + " (" + F[2] + ")";
			++Cases;
		}
		else if (K == "E")
		{
			FEvent E;
			const std::string& T = F.at(1);
			const std::string& A = F.at(2);
			if (T == "START") E.Type = EEvent::Start;
			else if (T == "ANCHOR") { E.Type = EEvent::Anchor; E.X = Num(A); E.Z = Num(F.at(3)); }
			else if (T == "ARRIVED") { E.Type = EEvent::Arrived; if (A != "~") E.From = A; }
			else if (T == "CLEAR") { E.Type = EEvent::Clear; if (A != "~") E.From = A; }
			else if (T == "HACK") { E.Type = EEvent::Hack; E.Progress = Num(A); }
			else if (T == "HOLD") { E.Type = EEvent::Hold; E.Progress = Num(A); }
			else if (T == "ACK") E.Type = EEvent::Ack;
			else if (T == "DECIDED") E.Type = EEvent::Decided;
			else throw std::runtime_error("unknown event " + T);
			Run = Advance(Lines, Context, Run, E);
		}
		else if (K == "X")
		{
			const std::string Want = Line.substr(2);
			const std::string Got = Describe(Run);
			++Checked;
			++PerMission[Run.Id];
			if (Got != Want)
			{
				if (++Failures <= 5) std::fprintf(stderr, "MISMATCH %s line %zu\n  want %s\n  got  %s\n", Case.c_str(), LineNo, Want.c_str(), Got.c_str());
				// resync from the web build's state is not possible from text alone; the next case starts clean
			}
		}
		else throw std::runtime_error("unknown line kind: " + K);
	}
	std::printf("%zu missions, %zu lines, %zu cases, %zu states checked, %zu mismatches\n", PerMission.size(), Lines.Num(), Cases, Checked, Failures);
	return Failures == 0 && Checked > 0 ? 0 : 1;
}
