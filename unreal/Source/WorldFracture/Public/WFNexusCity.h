#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WFNexusCity.generated.h"

class UInstancedStaticMeshComponent;
class UMaterialInterface;
class UPointLightComponent;
class UStaticMesh;

/**
 * Nexus City, built at play time from DataTables/NexusCity.json (unreal/tools/export-nexus-city.ts), which the exporter
 * reads from the web build's own layout code: the hub plaza, ring road and its civic towers, the four districts' blocks
 * and buildings with their facade kit (plinths, ledges, glass fins, shopfronts, awnings, balconies, lobbies, blade signs),
 * rooftop detail, kerbs, sidewalks, crossings, street furniture, street lights, parked cars, and the night signage
 * (violet banners, holographic screens, cyan corner strips). Positions match the web build: rules metres x/z on the
 * ground = Unreal X/Y, at the Nexus region's real coordinates, so the turrets, detection meter and quests line up.
 *
 * Everything is instanced (one draw per shape and colour) so it holds up on phones. Shapes are the engine's basic
 * meshes and colours go through BasicShapeMaterial until the authored meshes and materials are imported; then set the
 * material slots below (each takes a "Color" vector parameter) and the city picks them up. The neon has no emissive
 * material yet, so a small pool of real lights follows the player and lights the nearest lamps and signs.
 */
UCLASS()
class WORLDFRACTURE_API AWFNexusCity : public AActor
{
	GENERATED_BODY()

public:
	AWFNexusCity();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	/** Reads the layout and builds the city. Safe to call once; returns false (and logs why) if the file is missing. */
	bool Build();

	/** The spawn pad on the hub plaza (web build NEXUS_HUB_SPAWN), standing height included. */
	FVector GetSpawnLocation() const { return SpawnLocation; }
	FRotator GetSpawnRotation() const { return SpawnRotation; }
	/** Hub centre in Unreal units. */
	FVector GetHubCentre() const { return HubCentre; }
	bool IsBuilt() const { return bBuilt; }
	/** the hub's ground height in the web build (m): the city stands at it when bOnTerrain */
	double GetDatum() const { return DatumM; }
	/** how far the city reaches from the hub centre (m) */
	double GetCityRadius() const { return CityRadiusM; }

	/** Stand the city at its real height on the terrain (the web build's hub ground); false keeps it at Z = 0. Set before
	 * the actor begins play (the game mode spawns it deferred). */
	UPROPERTY(EditAnywhere, Category = "Nexus City") bool bOnTerrain = false;
	/** Imported building models: an extra turn (degrees) if the importer's axes leave them facing the wrong way. */
	UPROPERTY(EditAnywhere, Category = "Nexus City|Look") float ImportedModelYawDeg = 0.f;

	/** Night look for the "Nexus at night" target frame: dims the sun to moonlight, cools the sky, adds street-level fog. */
	void ApplyNightLook();

	/** Optional authored materials (vector parameter "Color"); BasicShapeMaterial is used when unset. */
	UPROPERTY(EditAnywhere, Category = "Nexus City|Look") TObjectPtr<UMaterialInterface> SurfaceMaterial;
	/** For signs, strips, shopfronts and lamp heads: ideally an unlit/emissive material driven by "Color". */
	UPROPERTY(EditAnywhere, Category = "Nexus City|Look") TObjectPtr<UMaterialInterface> NeonMaterial;

	/** How many real lights follow the player (lamps and signs nearest to them). Phones get fewer. */
	UPROPERTY(EditAnywhere, Category = "Nexus City|Look") int32 LightPoolDesktop = 24;
	UPROPERTY(EditAnywhere, Category = "Nexus City|Look") int32 LightPoolMobile = 8;

private:
	/** one instanced draw per (shape, colour, collision) */
	UInstancedStaticMeshComponent* Batch(UStaticMesh* Mesh, const FLinearColor& Color, bool bNeon, bool bCollide);
	/** an imported model keeps its own materials */
	UInstancedStaticMeshComponent* ModelBatch(UStaticMesh* Mesh);
	/** a box in rules metres: centre (x, y up, z), size (sx, sy, sz), turned yaw radians the web build's way (about +y) */
	void Box(UInstancedStaticMeshComponent* To, double X, double Y, double Z, double SX, double SY, double SZ, double Yaw = 0) const;
	void Cylinder(UInstancedStaticMeshComponent* To, double X, double Y, double Z, double Diameter, double Height) const;
	void AddLightSpot(double X, double Y, double Z, const FLinearColor& Color, float Intensity, float Radius);
	void UpdateLightPool();

	UPROPERTY() TObjectPtr<USceneComponent> Root;
	UPROPERTY() TArray<TObjectPtr<UInstancedStaticMeshComponent>> Batches;
	UPROPERTY() TArray<TObjectPtr<UPointLightComponent>> LightPool;
	TMap<FString, UInstancedStaticMeshComponent*> BatchByKey;

	/** every place a pooled light can sit (lamp heads, sign faces), Unreal units */
	struct FLightSpot
	{
		FVector At;
		FLinearColor Color;
		float Intensity = 0;
		float Radius = 0;
	};
	TArray<FLightSpot> LightSpots;
	double PoolTimer = 0;

	UPROPERTY() TObjectPtr<UStaticMesh> CubeMesh;
	UPROPERTY() TObjectPtr<UStaticMesh> CylinderMesh;
	UPROPERTY() TObjectPtr<UMaterialInterface> BasicMaterial;

	FVector SpawnLocation = FVector::ZeroVector;
	FRotator SpawnRotation = FRotator::ZeroRotator;
	FVector HubCentre = FVector::ZeroVector;
	bool bBuilt = false;
	double DatumM = 0;
	double CityRadiusM = 95;
};
