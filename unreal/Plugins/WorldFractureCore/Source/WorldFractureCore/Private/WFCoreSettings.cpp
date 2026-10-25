#include "WFCoreSettings.h"

UWFCoreSettings::UWFCoreSettings()
{
	CategoryName = TEXT("Game");
	// Same as the web build's STARTING_UNLOCKED_WORLDS (src/game/progression.ts).
	StartingUnlockedWorlds = { TEXT("veridan"), TEXT("nexus"), TEXT("wastelands"), TEXT("solara"), TEXT("swamps"), TEXT("frostspire"), TEXT("ember") };
}
