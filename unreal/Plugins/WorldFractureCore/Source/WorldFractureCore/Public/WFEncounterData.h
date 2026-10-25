#pragma once

#include "CoreMinimal.h"
#include "Core/WFEncounterCore.h"

/** Loads the authored boss encounters (DataTables/ScenarioEncounters.json) and the scenario damage rules
 *  (DataTables/UniqueScenarios.json: OutsideWindowMult, Gimmick) into the engine-free core's catalog. */
namespace WFEncounterData
{
	WORLDFRACTURECORE_API bool LoadCatalog(wf::encounter::FCatalog& Out, FString& OutError);
}
