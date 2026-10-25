using UnrealBuildTool;

public class WorldFractureEditorTarget : TargetRules
{
	public WorldFractureEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("WorldFracture");
	}
}
