#pragma once

#include "CoreMinimal.h"
#include "Core/WFProgression.h"

/**
 * The save as JSON, using the web build's PlayerProgression field names (completedMissions, materials, inventory,
 * equippedGear, level, xp...), so the same document shape works in both builds.
 */
namespace WFProgressionJson
{
	WORLDFRACTURECORE_API FString ToJson(const wf::FProgression& P);
	/** Missing fields keep their defaults, as the web build's normalizeProgression does. */
	WORLDFRACTURECORE_API bool FromJson(const FString& Json, wf::FProgression& Out, FString& OutError);
}
