// World Fracture — homes: the seven listed homes (apartments, houses, the Aegis penthouse, garage quarters), their decor,
// and the twelve walk-in residences of Nexus and Neon City with their garage bays.
//
// Port of the web build's authoritative rules:
//   housing.ts          buyHome (one-time Nex spend home:<id>; garage quarters need their garage base), buyDecor
//                       (decor:<id>, reusable in every home), placeDecor (slot and room checks), owned homes, normalizeHousing
//   residence-deeds.ts  buyDeed, parkedAt / parkedIn (fleet order), parkVehicle (owned build, owned home, free bay),
//                       unparkVehicle
// Golden-tested (Tests/HousingCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <optional>
#include <string>
#include <vector>

namespace wf::housing
{
	struct FHome { std::string Id, Name, Kind, District, RegionId, Garage, Blurb; double Price = 0; std::vector<std::string> Rooms; };
	struct FDecor { std::string Id, Name, Slot; double Price = 0; std::vector<std::string> Rooms; };
	struct FDeed { std::string Id, Name, Address, Kind, Style, City, District, Blurb; double Price = 0, Bays = 0, X = 0, Z = 0; };
	struct FCatalog
	{
		std::vector<FHome> Homes;
		std::vector<FDecor> Decor;
		std::vector<FDeed> Deeds;
		std::vector<std::string> FleetIds; // fleet.ts FLEET order (bays fill in this order)
		WORLDFRACTURECORE_API const FHome* Home(const std::string& Id) const;
		WORLDFRACTURECORE_API const FDecor* DecorById(const std::string& Id) const;
		WORLDFRACTURECORE_API const FDeed* Deed(const std::string& Id) const;
	};
	struct FResult { bool bOk = false; std::string Message; };

	WORLDFRACTURECORE_API bool OwnsHome(const FProgression& P, const std::string& Id); // homes and residences alike: home:<id>
	WORLDFRACTURECORE_API bool OwnsDecor(const FProgression& P, const std::string& Id);
	WORLDFRACTURECORE_API FResult BuyHome(const FCatalog& C, FProgression& P, const std::string& Id);
	WORLDFRACTURECORE_API FResult BuyDecor(const FCatalog& C, FProgression& P, const std::string& Id);
	/** Places (or with no DecorId, clears) an owned item in room RoomIndex of an owned home. */
	WORLDFRACTURECORE_API FResult PlaceDecor(const FCatalog& C, FProgression& P, const std::string& HomeId, int RoomIndex, const std::string& Slot, const std::optional<std::string>& DecorId);
	/** housing.ts normalizeHousing: drops unknown homes, decor and residence ids from a loaded save. */
	WORLDFRACTURECORE_API void NormalizeHousing(const FCatalog& C, FProgression::FHousing& H);

	WORLDFRACTURECORE_API FResult BuyDeed(const FCatalog& C, FProgression& P, const std::string& Id);
	/** fleet build -> residence, live entries only */
	WORLDFRACTURECORE_API std::vector<std::pair<std::string, std::string>> ParkedAt(const FCatalog& C, const FProgression& P);
	WORLDFRACTURECORE_API std::vector<std::string> ParkedIn(const FCatalog& C, const FProgression& P, const std::string& DeedId);
	WORLDFRACTURECORE_API FResult ParkVehicle(const FCatalog& C, FProgression& P, const std::string& BuildId, const std::string& DeedId, const std::string& BuildName);
	WORLDFRACTURECORE_API FResult UnparkVehicle(const FCatalog& C, FProgression& P, const std::string& BuildId, const std::string& BuildName);
}
