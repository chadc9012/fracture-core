#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

/// Builds the World Fracture Unity sample from nothing but scripts (run by GameCI: -executeMethod BuildSample.Android):
/// a URP pipeline asset for phones, one scene holding the NexusStreet builder, and an Android APK at Builds/UnitySample.apk.
public static class BuildSample
{
    [MenuItem("World Fracture/Build Android sample")]
    public static void Android()
    {
        Directory.CreateDirectory("Assets/Settings");
        var rendererData = ScriptableObject.CreateInstance<UniversalRendererData>();
        AssetDatabase.CreateAsset(rendererData, "Assets/Settings/MobileRenderer.asset");
        var urp = UniversalRenderPipelineAsset.Create(rendererData);
        urp.msaaSampleCount = 2;
        urp.supportsHDR = true;
        AssetDatabase.CreateAsset(urp, "Assets/Settings/MobileURP.asset");
        GraphicsSettings.defaultRenderPipeline = urp;
        QualitySettings.renderPipeline = urp;

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var street = new GameObject("Nexus street").AddComponent<NexusStreet>();
        street.lit = Shader.Find("Universal Render Pipeline/Lit");
        street.unlit = Shader.Find("Universal Render Pipeline/Unlit");
        Directory.CreateDirectory("Assets/Scenes");
        EditorSceneManager.SaveScene(scene, "Assets/Scenes/NexusStreet.unity");
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene("Assets/Scenes/NexusStreet.unity", true) };

        PlayerSettings.companyName = "World Fracture";
        PlayerSettings.productName = "WF Unity Sample";
        PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.chadc9012.wfunitysample");
        PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
        PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
        PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
        AssetDatabase.SaveAssets();

        Directory.CreateDirectory("Builds");
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { "Assets/Scenes/NexusStreet.unity" },
            locationPathName = "Builds/UnitySample.apk",
            target = BuildTarget.Android,
            options = BuildOptions.None,
        });
        Debug.Log($"World Fracture Unity sample: {report.summary.result}, {report.summary.totalSize} bytes");
        if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded) EditorApplication.Exit(1);
    }
}
#endif
