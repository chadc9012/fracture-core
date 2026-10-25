#include "Core/WFHousingCore.h"

#include "Core/WFFleetCore.h"
#include "Core/WFJsCompat.h"
#include "Core/WFVehicleCore.h"

#include <algorithm>
#include <regex>

namespace wf::housing
{
	namespace
	{
		bool HoHas(const std::vector<std::string>& V, const std::string& S) { return std::find(V.begin(), V.end(), S) != V.end(); }
		bool HoIsFleet(const FCatalog& C, const std::string& Id) { return HoHas(C.FleetIds, Id); }
	}

	const FHome* FCatalog::Home(const std::string& Id) const { for (const FHome& H : Homes) if (H.Id == Id) return &H; return nullptr; }
	const FDecor* FCatalog::DecorById(const std::string& Id) const { for (const FDecor& D : Decor) if (D.Id == Id) return &D; return nullptr; }
	const FDeed* FCatalog::Deed(const std::string& Id) const { for (const FDeed& D : Deeds) if (D.Id == Id) return &D; return nullptr; }

	bool OwnsHome(const FProgression& P, const std::string& Id) { return P.NexLedger.count("home:" + Id) > 0; }
	bool OwnsDecor(const FProgression& P, const std::string& Id) { return P.NexLedger.count("decor:" + Id) > 0; }

	FResult BuyHome(const FCatalog& C, FProgression& P, const std::string& Id)
	{
		const FHome* H = C.Home(Id);
		if (!H) return {false, "Unknown property"};
		if (OwnsHome(P, Id)) return {false, "You already own this property"};
		if (!H->Garage.empty() && !HoHas(P.Fleet.Garages, H->Garage)) return {false, "Buy the garage base first to add living quarters"};
		std::map<std::string, double> Ledger = P.NexLedger;
		if (!vehicle::SpendNex(Ledger, "home:" + Id, H->Price)) return {false, "Needs " + js::NumberToString(H->Price) + " Nex (you have " + js::NumberToString(vehicle::NexBalance(P.NexLedger)) + ")"};
		P.NexLedger = std::move(Ledger);
		if (!P.Housing.Home) P.Housing.Home = Id;
		return {true, H->Name + " is yours"};
	}

	FResult BuyDecor(const FCatalog& C, FProgression& P, const std::string& Id)
	{
		const FDecor* D = C.DecorById(Id);
		if (!D) return {false, "Unknown item"};
		if (OwnsDecor(P, Id)) return {false, "Already owned — place it in any home for free"};
		std::map<std::string, double> Ledger = P.NexLedger;
		if (!vehicle::SpendNex(Ledger, "decor:" + Id, D->Price)) return {false, "Needs " + js::NumberToString(D->Price) + " Nex (you have " + js::NumberToString(vehicle::NexBalance(P.NexLedger)) + ")"};
		P.NexLedger = std::move(Ledger);
		return {true, D->Name + " bought"};
	}

	FResult PlaceDecor(const FCatalog& C, FProgression& P, const std::string& HomeId, int RoomIndex, const std::string& Slot, const std::optional<std::string>& DecorId)
	{
		const FHome* H = C.Home(HomeId);
		if (!H || !OwnsHome(P, HomeId)) return {false, "You don't own this property"};
		if (RoomIndex < 0 || RoomIndex >= static_cast<int>(H->Rooms.size())) return {false, "No such room"};
		const std::string& Room = H->Rooms[static_cast<size_t>(RoomIndex)];
		const std::string Key = std::to_string(RoomIndex) + ":" + Slot;
		std::map<std::string, std::string> Rooms = P.Housing.Placed.count(HomeId) ? P.Housing.Placed[HomeId] : std::map<std::string, std::string>{};
		if (!DecorId) Rooms.erase(Key);
		else
		{
			const FDecor* D = C.DecorById(*DecorId);
			if (!D || !OwnsDecor(P, *DecorId)) return {false, "Buy this item first"};
			if (D->Slot != Slot) return {false, D->Name + " doesn't go in the " + Slot + " slot"};
			if (!HoHas(D->Rooms, Room)) return {false, D->Name + " can't go in a " + Room};
			Rooms[Key] = *DecorId;
		}
		P.Housing.Placed[HomeId] = std::move(Rooms);
		return {true, DecorId ? "Placed" : "Removed"};
	}

	void NormalizeHousing(const FCatalog& C, FProgression::FHousing& H)
	{
		std::map<std::string, std::map<std::string, std::string>> Placed;
		for (const auto& [Home, Rooms] : H.Placed)
		{
			if (!C.Home(Home)) continue;
			auto& Out = Placed[Home];
			for (const auto& [K, V] : Rooms) if (C.DecorById(V)) Out[K] = V;
		}
		H.Placed = std::move(Placed);
		if (H.Home && !C.Home(*H.Home)) H.Home.reset();
		static const std::regex Residence("^(nexus|neon)-home-\\d+$");
		std::map<std::string, std::string> Parked;
		for (const auto& [V, At] : H.Parked) if (At.empty() || std::regex_match(At, Residence)) Parked[V] = At;
		H.Parked = std::move(Parked);
	}

	FResult BuyDeed(const FCatalog& C, FProgression& P, const std::string& Id)
	{
		const FDeed* D = C.Deed(Id);
		if (!D) return {false, "Unknown property"};
		if (OwnsHome(P, Id)) return {false, "You already own this property"};
		std::map<std::string, double> Ledger = P.NexLedger;
		if (!vehicle::SpendNex(Ledger, "home:" + Id, D->Price))
			return {false, "Needs " + fleet::FormatInt(D->Price) + " Nex (you have " + fleet::FormatInt(vehicle::NexBalance(P.NexLedger)) + ")"};
		P.NexLedger = std::move(Ledger);
		const std::string Bays = D->Bays ? " · " + js::NumberToString(D->Bays) + " parking bay" + (D->Bays > 1 ? "s" : "") : "";
		return {true, D->Address + " is yours" + Bays};
	}

	std::vector<std::pair<std::string, std::string>> ParkedAt(const FCatalog& C, const FProgression& P)
	{
		std::vector<std::pair<std::string, std::string>> Out;
		for (const auto& [V, At] : P.Housing.Parked) if (!At.empty() && HoIsFleet(C, V)) Out.push_back({V, At});
		return Out;
	}

	std::vector<std::string> ParkedIn(const FCatalog& C, const FProgression& P, const std::string& DeedId)
	{
		std::vector<std::string> Out;
		for (const std::string& V : C.FleetIds)
		{
			const auto It = P.Housing.Parked.find(V);
			if (It != P.Housing.Parked.end() && It->second == DeedId) Out.push_back(V);
		}
		return Out;
	}

	FResult ParkVehicle(const FCatalog& C, FProgression& P, const std::string& BuildId, const std::string& DeedId, const std::string& BuildName)
	{
		const FDeed* D = C.Deed(DeedId);
		if (!D || !HoIsFleet(C, BuildId)) return {false, "Unknown property or vehicle"};
		if (!OwnsHome(P, DeedId)) return {false, "You don't own this property"};
		if (!HoHas(P.Fleet.Owned, BuildId)) return {false, "Buy the vehicle first"};
		if (!D->Bays) return {false, "This home has no garage"};
		const std::vector<std::string> Here = ParkedIn(C, P, DeedId);
		if (HoHas(Here, BuildId)) return {false, BuildName + " is already parked here"};
		if (static_cast<double>(Here.size()) >= D->Bays) return {false, "All " + js::NumberToString(D->Bays) + " bay" + (D->Bays > 1 ? "s are" : " is") + " taken"};
		P.Housing.Parked[BuildId] = DeedId;
		return {true, BuildName + " parked at " + D->Address};
	}

	FResult UnparkVehicle(const FCatalog& C, FProgression& P, const std::string& BuildId, const std::string& BuildName)
	{
		const auto It = P.Housing.Parked.find(BuildId);
		if (It == P.Housing.Parked.end() || It->second.empty() || !HoIsFleet(C, BuildId)) return {false, "Not parked anywhere"};
		P.Housing.Parked[BuildId] = ""; // kept, not deleted, so a merge with an older copy can't park it back
		return {true, BuildName + " taken out of the garage"};
	}
}
