using UnrealBuildTool;

/** The game module: actors, pawns, game mode and HUD. Rules (rewards, quests, missions) come from WorldFractureCore. */
public class WorldFracture : ModuleRules
{
	public WorldFracture(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"WorldFractureCore",
		});
	}
}
