// Golden test for the C++ boss-fight rules: replays fights recorded from the web build's real encounter-sim.ts,
// boss-poise.ts, boss-phases.ts, scenario-gimmicks.ts and sim.ts applyMachineDamageMods (tools/gen-encounter-golden.ts).
//
// Fight states compare with numbers to 1e-9 relative (zone placement, lunges and fans use sin / cos / atan2 / hypot,
// which may differ from V8 in the last bit); everything else, decisions included, must match exactly.
#include "Core/WFEncounterCore.h"
#include "Core/WFJsCompat.h"

#include <cctype>
#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf::encounter;

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
		if (S == "Infinity") return std::numeric_limits<double>::infinity();
		double V = 0;
		const auto R = std::from_chars(S.data(), S.data() + S.size(), V);
		if (R.ec != std::errc() || R.ptr != S.data() + S.size()) throw std::runtime_error("bad number: " + S);
		return V;
	}
	std::optional<double> OptNum(const std::string& S) { return S == None ? std::nullopt : std::optional<double>(Num(S)); }
	std::string N(double V) { return wf::js::NumberToString(V); }
	std::string O(const std::optional<double>& V) { return V ? N(*V) : None; }

	std::optional<FZoneSpec> ParseZone(const std::string& S)
	{
		if (S == None) return std::nullopt;
		const std::vector<std::string> F = Split(S, '|');
		FZoneSpec Z;
		Z.Kind = F.at(0); Z.Radius = Num(F.at(1)); Z.Dps = Num(F.at(2)); Z.Slow = OptNum(F.at(3)).value_or(1); Z.Count = Num(F.at(4));
		Z.Arm = Num(F.at(5)); Z.Life = Num(F.at(6)); Z.Place = F.at(7); Z.RingRadius = OptNum(F.at(8)); Z.OrbitSpeed = OptNum(F.at(9)); Z.Name = F.at(10);
		return Z;
	}

	std::string PoiseText(const FPoise& P) { return N(P.Poise) + "|" + N(P.StaggerUntil) + "|" + N(P.WeakPointUntil); }

	std::string StateText(const FBoss& M, FArena& A, double& SeenEvent)
	{
		std::string Enc = None;
		if (M.Encounter)
		{
			const FEncounterState& E = *M.Encounter;
			Enc = std::to_string(E.Phase) + "|" + E.State + "|" + N(E.Timer) + "|" + E.Atk.value_or(None) + "|" + N(E.Cursor) + "|" + N(E.Tx) + "|" + N(E.Tz) + "|" + N(E.Cx) + "|" + N(E.Cz)
				+ "|" + N(E.SinceFinale) + "|" + N(E.FinaleUntil) + "|" + N(E.TellTotal) + "|" + (E.bTruce ? "1" : "0") + "|" + O(E.TruceAt);
		}
		const std::string Boss = std::string(M.bAlive ? "1" : "0") + "|" + N(M.X) + "|" + N(M.Z) + "|" + N(M.Hp) + "|" + N(M.Cool) + "|" + PoiseText(M.Poise) + "|" + M.ScenarioId.value_or(None);
		std::string Zones, Events, Hurts, Decoys;
		for (const FZone& Z : A.Zones)
		{
			if (!Zones.empty()) Zones += ";";
			Zones += N(Z.Id) + "|" + Z.Name + "|" + Z.Kind + "|" + N(Z.X) + "|" + N(Z.Z) + "|" + N(Z.Radius) + "|" + N(Z.Dps) + "|" + N(Z.Slow) + "|" + N(Z.ArmAt) + "|" + N(Z.Until) + "|" + Z.Scope + "|" + (Z.Orbit ? N(Z.Orbit->Ang) : None);
		}
		for (const FEvent& E : A.Events)
		{
			if (E.Id <= SeenEvent) continue;
			if (!Events.empty()) Events += ";";
			Events += N(E.Id) + "|" + E.Kind + "|" + E.ScenarioId + "|" + std::to_string(E.Phase) + "|" + E.PhaseName + "|" + E.Attack.value_or(None) + "|" + E.Text + "|" + N(E.X) + "|" + N(E.Z)
				+ "|" + N(E.Radius) + "|" + N(E.Duration) + "|" + (E.Hit ? (*E.Hit ? "1" : "0") : None) + "|" + N(E.At);
		}
		for (const FEvent& E : A.Events) SeenEvent = std::max(SeenEvent, E.Id);
		for (const FPlayerHit& H : A.Hits) { if (!Hurts.empty()) Hurts += ";"; Hurts += N(H.Damage) + "|" + H.Label; }
		A.Hits.clear();
		for (const FDecoy& D : A.Decoys) { if (!Decoys.empty()) Decoys += ";"; Decoys += N(D.Id) + "|" + N(D.X) + "|" + N(D.Z); }
		std::vector<std::string> Sum;
		for (const FSummon& S : A.Summons) Sum.push_back(N(S.X) + "|" + N(S.Z) + "|" + S.Profile + "|" + S.Kind + "|" + N(S.Hp) + "|" + N(S.Scale) + "|" + (S.bElite ? "1" : "0"));
		std::sort(Sum.begin(), Sum.end());
		std::string Summons;
		for (const std::string& X : Sum) { if (!Summons.empty()) Summons += ";"; Summons += X; }
		return "boss=" + Boss + ";enc=" + Enc + ";zones=[" + Zones + "];events=[" + Events + "];hurts=[" + Hurts + "];hazard=" + N(A.HazardSpeedMult) + ";decoys=[" + Decoys + "];summons=[" + Summons + "]";
	}

	/** Splits text into number and non-number tokens. A '-' starts a number only after a non-alphanumeric character. */
	std::vector<std::pair<bool, std::string>> Tokens(const std::string& S)
	{
		std::vector<std::pair<bool, std::string>> Out;
		size_t I = 0;
		std::string Text;
		while (I < S.size())
		{
			const bool bPrevAlnum = I > 0 && (std::isalnum(static_cast<unsigned char>(S[I - 1])) || S[I - 1] == '_');
			const bool bDigit = std::isdigit(static_cast<unsigned char>(S[I])) && !bPrevAlnum;
			const bool bNeg = S[I] == '-' && I + 1 < S.size() && std::isdigit(static_cast<unsigned char>(S[I + 1])) && !bPrevAlnum;
			if (bDigit || bNeg)
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
	}

	bool FuzzyEqual(const std::string& A, const std::string& B)
	{
		if (A == B) return true;
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

	void Expect(const std::string& What, const std::string& Want, const std::string& Got, size_t Line, bool bFuzzy = false)
	{
		++Checked;
		if (Want == Got) return;
		if (bFuzzy && FuzzyEqual(Want, Got)) { ++Fuzzy; return; }
		if (++Failures <= 5) std::fprintf(stderr, "MISMATCH %s in %s (line %zu)\n  want %s\n  got  %s\n", What.c_str(), CaseName.c_str(), Line, Want.c_str(), Got.c_str());
	}
}

int main(int Argc, char** Argv)
{
	const char* Path = Argc > 1 ? Argv[1] : "encounter_golden.txt";
	std::ifstream In(Path);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Path); return 2; }

	FCatalog C;
	FBoss Boss;
	FArena Arena;
	double SeenEvent = 0;
	std::vector<FBoss*> Bosses;
	std::string Line;
	size_t LineNo = 0, Fights = 0, Steps = 0, Hits = 0;

	while (std::getline(In, Line))
	{
		++LineNo;
		if (Line.empty()) continue;
		const std::vector<std::string> F = Split(Line, '\t');
		const std::string& K = F[0];
		if (K == "ENC")
		{
			FEncounterDef& D = C.Encounters[F.at(1)];
			D.ScenarioId = F.at(1);
			D.Victory = F.at(2);
			if (F.at(3) != None) { const auto T = Split(F.at(3), '|'); D.Truce = FTruce{Num(T.at(0)), Num(T.at(1)), T.at(2)}; }
		}
		else if (K == "ATK")
		{
			FAttackDef A;
			A.Id = F.at(2); A.Kind = F.at(3); A.Label = F.at(4); A.Tell = F.at(5); A.TellTime = Num(F.at(6)); A.Damage = Num(F.at(7)); A.MinRange = Num(F.at(8)); A.MaxRange = Num(F.at(9));
			A.Radius = OptNum(F.at(10)); A.Width = OptNum(F.at(11)); A.Arc = OptNum(F.at(12)); A.Reach = OptNum(F.at(13)); A.Decoys = OptNum(F.at(14));
			A.Recovery = Num(F.at(15)); A.Window = Num(F.at(16)); A.Zones = ParseZone(F.at(17));
			if (F.size() > 18 && F.at(18) != None)
				for (const std::string& G : Split(F.at(18), ','))
				{
					const auto P = Split(G, ':');
					A.Summon.push_back(FSummonGroup{P.at(0), P.at(1), Num(P.at(2)), Num(P.at(3)), Num(P.at(4)), P.at(5) == "1"});
				}
			C.Encounters[F.at(1)].Attacks[A.Id] = A;
		}
		else if (K == "PH")
		{
			FPhaseDef P;
			P.Id = F.at(2); P.Name = F.at(3); P.Below = Num(F.at(4)); P.Nova = F.at(5); P.Attacks = Split(F.at(6), ','); P.Gap = Num(F.at(7)); P.Arena = ParseZone(F.at(8));
			if (F.at(9) != None) { const auto Fi = Split(F.at(9), '|'); P.Finale = FFinale{Fi.at(0), Num(Fi.at(1)), Num(Fi.at(2)), Fi.at(3)}; }
			C.Encounters[F.at(1)].Phases.push_back(P);
		}
		else if (K == "SCR") C.Scenarios[F.at(1)] = FScenarioRule{Num(F.at(2)), F.at(3) == None ? std::string() : F.at(3)};
		else if (K == "RUN")
		{
			CaseName = F.at(1) + " fight at line " + std::to_string(LineNo); ++Fights;
			Boss = FBoss{};
			Boss.ScenarioId = F.at(1); Boss.Profile = F.at(2); Boss.X = Num(F.at(3)); Boss.Z = Num(F.at(4));
			Arena = FArena{};
			SeenEvent = 0;
			Bosses = {&Boss};
		}
		else if (K == "D")
		{
			Boss.Hp -= Num(F.at(1));
			if (Boss.Hp <= 0)
			{
				const double Floor = EncounterHpFloor(C, Boss, Num(F.at(2)));
				if (Floor > 0) Boss.Hp = Floor;
				else { Boss.bAlive = false; EndEncounter(C, Boss, Arena, Num(F.at(2))); }
			}
		}
		else if (K == "ST") Boss.Poise.StaggerUntil = Num(F.at(1));
		else if (K == "CO") Boss.Cool = Num(F.at(1));
		else if (K == "SH") OnDecoyShattered(C, Bosses, Arena, Num(F.at(1)), Num(F.at(2)));
		else if (K == "R") ResetEncounters(C, Bosses, Arena, Num(F.at(1)));
		else if (K == "S")
		{
			const double Dt = Num(F.at(1));
			StepEncounters(C, Bosses, Arena, Dt, Num(F.at(2)), Num(F.at(3)), Num(F.at(4)));
			Boss.Cool = std::max(0.0, Boss.Cool - Dt);
			++Steps;
		}
		else if (K == "X") Expect("fight state", F.at(1), StateText(Boss, Arena, SeenEvent), LineNo, true);
		else if (K == "DB")
		{
			CaseName = "damage boss at line " + std::to_string(LineNo);
			Boss = FBoss{};
			if (F.at(1) != None) Boss.ScenarioId = F.at(1);
		}
		else if (K == "H")
		{
			const double Out = ApplyBossDamage(C, Boss, Num(F.at(1)), F.at(2), std::hypot(0 - Num(F.at(3)), 0 - Num(F.at(4))), Num(F.at(5)));
			std::string History;
			for (const std::string& E : Boss.GimmickHistory) { if (!History.empty()) History += ","; History += E; }
			Expect("damage", F.at(6), N(Out) + "|" + PoiseText(Boss.Poise) + "|" + (History.empty() ? None : History) + "|" + N(Boss.PlayerHits), LineNo, true);
			++Hits;
		}
		else if (K == "PP") Expect("phaseForHpFraction", F.at(2), std::to_string(PhaseForHpFraction(Num(F.at(1)))), LineNo);
		else if (K == "DP")
		{
			const FPoise P = DecayPoise(FPoise{Num(F.at(1)), Num(F.at(2)), Num(F.at(3))}, Num(F.at(4)), Num(F.at(5)));
			Expect("decayPoise", F.at(6), PoiseText(P), LineNo);
		}
		else if (K == "HP")
		{
			double Mult = 0;
			const FPoise P = HitPoise(FPoise{Num(F.at(1)), Num(F.at(2)), Num(F.at(3))}, Num(F.at(4)), Num(F.at(5)), Mult);
			Expect("hitPoise", F.at(6), PoiseText(P) + "|" + N(Mult), LineNo);
		}
		else throw std::runtime_error("unknown line kind: " + K);
	}

	std::printf("%zu encounters, %zu fights, %zu steps, %zu damage hits, %zu checks (%zu within float tolerance), %zu mismatches\n",
		C.Encounters.size(), Fights, Steps, Hits, Checked, Fuzzy, Failures);
	return Failures == 0 && Steps > 0 ? 0 : 1;
}
