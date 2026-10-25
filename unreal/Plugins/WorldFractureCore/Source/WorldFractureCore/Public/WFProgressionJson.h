#pragma once

#include "CoreMinimal.h"
#include "Core/WFProgression.h"
#include "Dom/JsonObject.h"

/**
 * The save as JSON, using the web build's PlayerProgression field names (completedMissions, materials, inventory,
 * equippedGear, level, xp...), so the same document shape works in both builds.
 */
namespace WFProgressionJson
{
	WORLDFRACTURECORE_API FString ToJson(const wf::FProgression& P);
	/** Missing fields keep their defaults, as the web build's normalizeProgression does. */
	WORLDFRACTURECORE_API bool FromJson(const FString& Json, wf::FProgression& Out, FString& OutError);
	/** One GearItem object (id, name, slot, power, level, element, source, setId?, rarity?, perk?). */
	WORLDFRACTURECORE_API wf::FGearItem GearFromJson(const TSharedPtr<FJsonObject>& Item);
	WORLDFRACTURECORE_API TSharedRef<FJsonObject> GearToJson(const wf::FGearItem& G);
}
