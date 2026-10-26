#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WFAtmosphere.generated.h"

class USkyAtmosphereComponent;
class UVolumetricCloudComponent;
class UExponentialHeightFogComponent;
class UPostProcessComponent;
class UDirectionalLightComponent;
class USkyLightComponent;

/**
 * The realistic sky and air (Unreal's own physically based systems, driven by the game's clock and weather):
 *  - Sky Atmosphere: an Earth-sized planet's scattering, so dawn, noon, sunset and dusk colour themselves from the sun's
 *    angle instead of a painted sky; the sun light is the atmosphere's sun (index 0) and a cool moon is index 1.
 *  - Volumetric Clouds: Unreal's engine cloud material, casting real cloud shadows on the ground.
 *  - Exponential Height Fog with volumetric fog on PC (light shafts through the haze), denser in fog, rain and storms.
 *  - One unbound post-process: histogram auto exposure, filmic bloom, light vignette and grain, ambient occlusion,
 *    motion blur on PC; a saturated night grade for the neon cities (the owner's target frames).
 *  - On phones (mobile renderer) the atmosphere, clouds, height fog and post-process stay; volumetric fog and motion blur
 *    are off, which the mobile renderer can't afford.
 * AWFGameMode spawns one, hands it the sun and sky light, and calls Update every tick from TickEnvironment.
 */
UCLASS()
class WORLDFRACTURE_API AWFAtmosphere : public AActor
{
	GENERATED_BODY()

public:
	AWFAtmosphere();

	/** the sun the clock turns becomes the atmosphere's sun light (with cloud shadows); the sky light captures the sky live */
	void Bind(UDirectionalLightComponent* Sun, USkyLightComponent* Sky);

	/**
	 * Drive the look from the game state. SunElevation is sin(sun angle) (-1..1), Night 0..1 (environment-core NightFactor),
	 * Cloud / Precipitation / Visibility from the weather (0..1), bNeonCity for the saturated night grade.
	 */
	void Update(float DeltaSeconds, double SunElevation, double Night, double Cloud, double Precipitation, double Visibility, bool bNeonCity);

	UPROPERTY(VisibleAnywhere, Category = "World Fracture") TObjectPtr<USkyAtmosphereComponent> Atmosphere;
	UPROPERTY(VisibleAnywhere, Category = "World Fracture") TObjectPtr<UVolumetricCloudComponent> Clouds;
	UPROPERTY(VisibleAnywhere, Category = "World Fracture") TObjectPtr<UExponentialHeightFogComponent> Fog;
	UPROPERTY(VisibleAnywhere, Category = "World Fracture") TObjectPtr<UPostProcessComponent> Post;
	UPROPERTY(VisibleAnywhere, Category = "World Fracture") TObjectPtr<UDirectionalLightComponent> Moon;

private:
	TWeakObjectPtr<UDirectionalLightComponent> SunRef;
	TWeakObjectPtr<USkyLightComponent> SkyRef;
	bool bMobile = false;
	/** eased weather, so a front rolls in over seconds rather than snapping */
	double CloudNow = 0.3, WetNow = 0, HazeNow = 0;
	double SkyRecapture = 0;
};
