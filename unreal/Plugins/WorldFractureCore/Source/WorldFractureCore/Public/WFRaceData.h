#pragma once

#include "CoreMinimal.h"
#include "Core/WFRaceCore.h"

#include <map>
#include <string>

/** Loads the 68 race courses (DataTables/RaceCourses.json, world coordinates) with their activity rules, and the
 *  championships (DataTables/Championships.json), into the engine-free core's catalog. */
namespace WFRaceData
{
	WORLDFRACTURECORE_API bool Load(wf::race::FCatalog& OutRaces, std::map<std::string, wf::activity::FActivityDef>& OutActivities, FString& OutError);
}
