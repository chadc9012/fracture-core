#include "WFAtmosphere.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/PostProcessComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/VolumetricCloudComponent.h"
#include "Materials/MaterialInterface.h"
#include "RHI.h"

namespace
{
	/** Unreal's own volumetric cloud material (engine content, cooked with every project that references it) */
	const TCHAR* CloudMaterialPath = TEXT("/Engine/EngineSky/VolumetricClouds/m_SimpleVolumetricCloud_Inst.m_SimpleVolumetricCloud_Inst");

	double Approach(double Now, double Target, double Rate, double Dt) { return Now + (Target - Now) * FMath::Clamp(Rate * Dt, 0.0, 1.0); }
}

AWFAtmosphere::AWFAtmosphere()
{
	PrimaryActorTick.bCanEverTick = false; // AWFGameMode drives Update from its environment tick

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);
	Root->SetMobility(EComponentMobility::Movable);

	// Earth's atmosphere (the component's defaults are Earth: 6360 km ground radius, 100 km of air); the planet's top sits
	// at the world origin, which is the web build's sea-level frame
	Atmosphere = CreateDefaultSubobject<USkyAtmosphereComponent>(TEXT("SkyAtmosphere"));
	Atmosphere->SetupAttachment(Root);

	Clouds = CreateDefaultSubobject<UVolumetricCloudComponent>(TEXT("VolumetricClouds"));
	Clouds->SetupAttachment(Root);

	Fog = CreateDefaultSubobject<UExponentialHeightFogComponent>(TEXT("HeightFog"));
	Fog->SetupAttachment(Root);

	Post = CreateDefaultSubobject<UPostProcessComponent>(TEXT("PostProcess"));
	Post->SetupAttachment(Root);
	Post->bUnbound = true;

	// the moon: a second, dim and cool atmosphere light that takes over when the sun is down
	Moon = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Moon"));
	Moon->SetupAttachment(Root);
	Moon->SetMobility(EComponentMobility::Movable);
}

void AWFAtmosphere::Bind(UDirectionalLightComponent* Sun, USkyLightComponent* Sky)
{
	// phones run the mobile renderer: keep it to what that renderer supports and can afford
	bMobile = GMaxRHIFeatureLevel <= ERHIFeatureLevel::ES3_1;

	if (UMaterialInterface* CloudMat = LoadObject<UMaterialInterface>(nullptr, CloudMaterialPath)) Clouds->SetMaterial(CloudMat);
	Clouds->SetLayerBottomAltitude(1.6f); // km: a cumulus deck over the hills
	Clouds->SetLayerHeight(bMobile ? 6.f : 9.f);

	Fog->SetFogDensity(0.012f);
	Fog->SetFogHeightFalloff(0.18f);
	Fog->SetStartDistance(600.f);
	Fog->SetVolumetricFog(!bMobile); // light shafts through the haze (desktop renderer only)
	Fog->SetVolumetricFogScatteringDistribution(0.6f);
	Fog->SetVolumetricFogExtinctionScale(1.f);

	Moon->SetIntensity(0.f);
	Moon->SetLightColor(FLinearColor(0.55f, 0.66f, 1.f));
	Moon->SetAtmosphereSunLight(true);
	Moon->SetAtmosphereSunLightIndex(1);
	Moon->SetCastShadows(!bMobile);
	Moon->SetWorldRotation(FRotator(-50.f, 210.f, 0.f));

	if (Sun)
	{
		SunRef = Sun;
		Sun->SetMobility(EComponentMobility::Movable);
		Sun->SetAtmosphereSunLight(true);
		Sun->SetAtmosphereSunLightIndex(0);
		Sun->bCastCloudShadows = true;
		Sun->SetLightSourceAngle(0.53f); // the real sun's disc: soft, physically sized shadow penumbrae
		Sun->MarkRenderStateDirty();
	}
	if (Sky)
	{
		SkyRef = Sky;
		Sky->SetMobility(EComponentMobility::Movable);
		Sky->bRealTimeCapture = true; // the sky light is captured from the atmosphere and clouds as they change
		Sky->SetIntensity(1.f);
		Sky->SetLightColor(FLinearColor::White);
		Sky->MarkRenderStateDirty();
	}

	// the camera: filmic and physically exposed (the target frames are rich and cinematic, not flat)
	FPostProcessSettings& S = Post->Settings;
	S.bOverride_AutoExposureMethod = true; S.AutoExposureMethod = EAutoExposureMethod::AEM_Histogram;
	S.bOverride_AutoExposureMinBrightness = true; S.AutoExposureMinBrightness = -1.5f;
	S.bOverride_AutoExposureMaxBrightness = true; S.AutoExposureMaxBrightness = 12.f;
	S.bOverride_AutoExposureSpeedUp = true; S.AutoExposureSpeedUp = 2.5f;
	S.bOverride_AutoExposureSpeedDown = true; S.AutoExposureSpeedDown = 1.2f;
	S.bOverride_BloomIntensity = true; S.BloomIntensity = 0.65f;
	S.bOverride_BloomThreshold = true; S.BloomThreshold = -1.f;
	S.bOverride_VignetteIntensity = true; S.VignetteIntensity = 0.35f;
	S.bOverride_FilmGrainIntensity = true; S.FilmGrainIntensity = bMobile ? 0.f : 0.08f;
	S.bOverride_AmbientOcclusionIntensity = true; S.AmbientOcclusionIntensity = 0.6f;
	S.bOverride_MotionBlurAmount = true; S.MotionBlurAmount = bMobile ? 0.f : 0.35f;
	S.bOverride_SceneFringeIntensity = true; S.SceneFringeIntensity = 0.f;
	S.bOverride_ColorSaturation = true; S.ColorSaturation = FVector4(1.08, 1.08, 1.08, 1.0);
	S.bOverride_ColorContrast = true; S.ColorContrast = FVector4(1.06, 1.06, 1.06, 1.0);
	S.bOverride_WhiteTemp = true; S.WhiteTemp = 6500.f;
}

void AWFAtmosphere::Update(float DeltaSeconds, double SunElevation, double Night, double Cloud, double Precipitation, double Visibility, bool bNeonCity)
{
	const double Dt = FMath::Min(static_cast<double>(DeltaSeconds), 0.25);
	CloudNow = Approach(CloudNow, FMath::Clamp(Cloud, 0.0, 1.0), 0.15, Dt);
	WetNow = Approach(WetNow, FMath::Clamp(Precipitation, 0.0, 1.0), 0.2, Dt);
	HazeNow = Approach(HazeNow, FMath::Clamp(1.0 - Visibility, 0.0, 1.0), 0.2, Dt);

	// the air: overcast and rain thicken the haze low down; fog closes visibility right in
	Fog->SetFogDensity(static_cast<float>(0.012 + 0.03 * CloudNow + 0.06 * WetNow + 0.22 * HazeNow));
	Fog->SetFogHeightFalloff(static_cast<float>(0.18 - 0.1 * HazeNow));
	Fog->SetStartDistance(static_cast<float>(600.0 * (1.0 - 0.9 * HazeNow)));
	Atmosphere->SetMieScatteringScale(static_cast<float>(0.004 + 0.012 * HazeNow + 0.006 * WetNow)); // aerosols: hazier light near the ground
	Clouds->SetLayerHeight(static_cast<float>((bMobile ? 5.0 : 7.0) + 5.0 * CloudNow)); // a deeper deck under a front

	// the sun dims behind the cloud deck (the atmosphere colours it by angle on its own); the moon takes the night
	if (UDirectionalLightComponent* Sun = SunRef.Get())
	{
		const double Up = FMath::Clamp((SunElevation + 0.05) / 0.25, 0.0, 1.0);
		Sun->SetIntensity(static_cast<float>(10.0 * Up * (1.0 - 0.6 * CloudNow) * (1.0 - 0.4 * WetNow)));
		Sun->SetLightColor(FLinearColor::White); // colour comes from the atmosphere's transmittance
	}
	Moon->SetIntensity(static_cast<float>(0.6 * FMath::Clamp(Night, 0.0, 1.0) * (1.0 - 0.7 * CloudNow)));

	// the camera grade: the neon cities at night run richer and cooler (the owner's target frames)
	FPostProcessSettings& S = Post->Settings;
	const double NeonNight = bNeonCity ? FMath::Clamp(Night, 0.0, 1.0) : 0.0;
	const float Sat = static_cast<float>(1.08 + 0.17 * NeonNight - 0.1 * WetNow);
	S.ColorSaturation = FVector4(Sat, Sat, Sat, 1.0);
	S.BloomIntensity = static_cast<float>(0.65 + 0.55 * NeonNight);
	S.WhiteTemp = static_cast<float>(6500.0 + 900.0 * NeonNight + 400.0 * CloudNow);
	S.AutoExposureMinBrightness = static_cast<float>(-1.5 - 1.0 * Night);

	// the sky light follows the sky: recapture now and then (real-time capture also updates on its own where supported)
	SkyRecapture -= Dt;
	if (SkyRecapture <= 0)
	{
		SkyRecapture = 2.0;
		if (USkyLightComponent* Sky = SkyRef.Get()) Sky->RecaptureSky();
	}
}
