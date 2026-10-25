// Golden test for the C++ housing: replays tools/gen-housing-golden.ts, recorded from the web build's real housing.ts and
// residence-deeds.ts. Every purchase, placement, parking result, the Nex ledger and the housing state must match exactly.
#include "Core/WFHousingCore.h"
#include "Core/WFJsCompat.h"

#include <charconv>
#include <cstdio>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace wf;
using namespace wf::housing;

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
	void Same(int Line, const char* What, const std::string& Got, const std::string& Want)
	{
		++Checks;
		if (Got != Want && ++Mismatches <= 25) std::fprintf(stderr, "line %d %s:\n   got  %s\n   want %s\n", Line, What, Got.c_str(), Want.c_str());
	}
	std::string HousingText(const FProgression::FHousing& H)
	{
		std::string Pl, Pa;
		for (const auto& [Home, Rooms] : H.Placed)
		{
			if (!Pl.empty()) Pl += ",";
			Pl += Home + ":";
			bool bFirst = true;
			for (const auto& [K, V] : Rooms) { if (!bFirst) Pl += "/"; bFirst = false; Pl += K + "=" + V; }
		}
		for (const auto& [K, V] : H.Parked) { if (!Pa.empty()) Pa += ","; Pa += K + "=" + V; }
		return (Pl.empty() ? None : Pl) + "|" + H.Home.value_or(None) + "|" + (Pa.empty() ? None : Pa);
	}
	std::string LedgerText(const std::map<std::string, double>& L)
	{
		std::string S;
		for (const auto& [K, V] : L) { if (!S.empty()) S += ","; S += K + "=" + N(V); }
		return S.empty() ? None : S;
	}
}

int main(int Argc, char** Argv)
{
	if (Argc < 2) { std::fprintf(stderr, "usage: %s golden.txt\n", Argv[0]); return 2; }
	std::ifstream In(Argv[1]);
	if (!In) { std::fprintf(stderr, "cannot open %s\n", Argv[1]); return 2; }
	std::vector<std::string> Lines;
	for (std::string L; std::getline(In, L);) if (!L.empty()) Lines.push_back(L);

	FCatalog C;
	std::map<std::string, std::string> FleetNames;
	FProgression P;
	int Cases = 0, Ops = 0, Norms = 0;
	for (size_t I = 0; I < Lines.size(); ++I)
	{
		const int LineNo = static_cast<int>(I) + 1;
		const auto F = Split(Lines[I], '\t');
		const std::string& T = F[0];
		if (T == "HOME") { FHome H; H.Id = F[1]; H.Name = F[2]; H.Kind = F[3]; H.District = F[4]; H.RegionId = F[5]; H.Garage = F[6] == None ? "" : F[6]; H.Price = Num(F[7]); H.Rooms = Split(F[8], ','); C.Homes.push_back(H); }
		else if (T == "DECOR") { FDecor D; D.Id = F[1]; D.Name = F[2]; D.Slot = F[3]; D.Price = Num(F[4]); D.Rooms = Split(F[5], ','); C.Decor.push_back(D); }
		else if (T == "DEED") { FDeed D; D.Id = F[1]; D.Name = F[2]; D.Address = F[3]; D.Kind = F[4]; D.Style = F[5]; D.City = F[6]; D.District = F[7]; D.Price = Num(F[8]); D.Bays = Num(F[9]); C.Deeds.push_back(D); }
		else if (T == "FLEETID") { C.FleetIds.push_back(F[1]); FleetNames[F[1]] = F[2]; }
		else if (T == "C") { ++Cases; P = FProgression{}; P.NexLedger.clear(); }
		else if (T == "NEX") P.NexLedger[F[1]] = Num(F[2]);
		else if (T == "GAR") P.Fleet.Garages.push_back(F[1]);
		else if (T == "OWN") P.Fleet.Owned.push_back(F[1]);
		else if (T == "OP")
		{
			++Ops;
			FResult R;
			if (F[1] == "home") R = BuyHome(C, P, F[2]);
			else if (F[1] == "decor") R = BuyDecor(C, P, F[2]);
			else if (F[1] == "place") R = PlaceDecor(C, P, F[2], static_cast<int>(Num(F[3])), F[4], F[5] == None ? std::nullopt : std::optional<std::string>(F[5]));
			else if (F[1] == "deed") R = BuyDeed(C, P, F[2]);
			else if (F[1] == "park")
			{
				std::string Here;
				for (const std::string& V : ParkedIn(C, P, F[3])) { if (!Here.empty()) Here += ","; Here += V; }
				Same(LineNo, "parked in", Here.empty() ? None : Here, F[4]);
				R = ParkVehicle(C, P, F[2], F[3], FleetNames[F[2]]);
			}
			else R = UnparkVehicle(C, P, F[2], FleetNames[F[2]]);
			++I;
			Same(static_cast<int>(I) + 1, "result", (R.bOk ? "OK:" : "ERR:") + R.Message, Split(Lines[I], '\t')[1]);
		}
		else if (T == "S") Same(LineNo, "state", LedgerText(P.NexLedger) + "\t" + HousingText(P.Housing), F[1] + "\t" + F[2]);
		else if (T == "NORM")
		{
			++Norms;
			// the save loader keeps string values only (non-strings, shown as #value, never reach normalizeHousing)
			FProgression::FHousing H;
			for (const std::string& Home : Split(F[1], ','))
			{
				const size_t Colon = Home.find(':');
				auto& Rooms = H.Placed[Home.substr(0, Colon)];
				for (const std::string& KV : Split(Home.substr(Colon + 1), '/')) { const size_t Eq = KV.find('='); const std::string V = KV.substr(Eq + 1); if (V.empty() || V[0] != '#') Rooms[KV.substr(0, Eq)] = V; }
			}
			if (F[2].empty() || F[2][0] != '#') H.Home = F[2];
			for (const std::string& KV : Split(F[3], ',')) { const size_t Eq = KV.find('='); const std::string V = KV.substr(Eq + 1); if (V.empty() || V[0] != '#') H.Parked[KV.substr(0, Eq)] = V; }
			NormalizeHousing(C, H);
			Same(LineNo, "normalize", HousingText(H), F[4]);
		}
		else Same(LineNo, "line", T, "known");
	}
	std::printf("%d cases, %d operations, %d normalized saves, %d checks, %d mismatches\n", Cases, Ops, Norms, Checks, Mismatches);
	return Mismatches == 0 ? 0 : 1;
}
