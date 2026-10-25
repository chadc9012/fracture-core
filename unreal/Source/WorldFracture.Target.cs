using UnrealBuildTool;

public class WorldFractureTarget : TargetRules
{
	public WorldFractureTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("WorldFracture");
	}
}
