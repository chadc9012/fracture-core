#pragma once

#include "CoreMinimal.h"
#include "Core/WFProgression.h"
#include "Core/WFVehicleCore.h"
#include "Dom/JsonObject.h"

/**
 * The save as JSON, using the web build's PlayerProgression field names (completedMissions, materials, inventory,
 * equippedGear, level, xp...), so the same document shape works in both builds.
 */
namespace WFProgressionJson
{
	/** Garage (when given) writes ownedVehicles / garageLoadout / selectedVehicle / vehicleConditions. */
	WORLDFRACTURECORE_API FString ToJson(const wf::FProgression& P, const wf::FGarage* Garage = nullptr);
	/** Missing fields keep their defaults, as the web build's normalizeProgression does. */
	WORLDFRACTURECORE_API bool FromJson(const FString& Json, wf::FProgression& Out, FString& OutError, wf::FGarage* OutGarage = nullptr);
	/** One GearItem object (id, name, slot, power, level, element, source, setId?, rarity?, perk?). */
	WORLDFRACTURECORE_API wf::FGearItem GearFromJson(const TSharedPtr<FJsonObject>& Item);
	WORLDFRACTURECORE_API TSharedRef<FJsonObject> GearToJson(const wf::FGearItem& G);
}
