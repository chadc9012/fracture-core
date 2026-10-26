#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WFWorldBuildings.generated.h"

class AWFTerrain;
class UInstancedStaticMeshComponent;
class UMaterialInterface;
class UPointLightComponent;
class UStaticMesh;

/**
 * Everything built outside Nexus City's district grid, from DataTables/WorldBuildings.json
 * (unreal/tools/export-world-buildings.ts, read from the web build's own layout code): Neon City's tower grid and street
 * lights, the walk-in homes (houses, townhouses, duplexes, courtyard homes, apartments, condos, lofts, villas) with
 * their garages, the jungle-reclaimed city in Verdant Forest, and an airport and a seaport at every landing zone.
 *
 * Boxes arrive already turned into Unreal's frame; each group is moved onto this terrain by the difference between it
 * and the web build's ground at the group's anchor. Walls, floors and glass are solid (homes are walked into through
 * their doors); lamps glow and feed a pool of real lights that follows the player. Imported Neon tower models
 * (/Game/WF/Models/Buildings/neon_v_<A-F>) replace the tower massing when the setup script has run.
 */
UCLASS()
class WORLDFRACTURE_API AWFWorldBuildings : public AActor
{
	GENERATED_BODY()

public:
	AWFWorldBuildings();

	virtual void Tick(float DeltaSeconds) override;

	/** Reads the layout and builds it on Ground (null: the flat Z = 0 world). */
	bool Build(const AWFTerrain* Ground);

	/** The fleet model a vehicle shows (fleet-models.ts): its fleet build's look, else its chassis's. Empty if unknown. */
	static FString FleetModelFor(const FString& VehicleId, const FString& BuildId);

	UPROPERTY(EditAnywhere, Category = "Buildings") int32 LightPoolDesktop = 16;
	UPROPERTY(EditAnywhere, Category = "Buildings") int32 LightPoolMobile = 6;
	/** Imported tower models: an extra turn (degrees) if the importer's axes leave them facing the wrong way. */
	UPROPERTY(EditAnywhere, Category = "Buildings") float ImportedModelYawDeg = 0.f;

private:
	UInstancedStaticMeshComponent* Batch(const FLinearColor& Color, int32 Mat, bool bModel = false, UStaticMesh* Model = nullptr);
	void UpdateLightPool();

	UPROPERTY() TObjectPtr<USceneComponent> Root;
	UPROPERTY() TArray<TObjectPtr<UInstancedStaticMeshComponent>> Batches;
	UPROPERTY() TArray<TObjectPtr<UPointLightComponent>> LightPool;
	UPROPERTY() TObjectPtr<UStaticMesh> CubeMesh;
	UPROPERTY() TObjectPtr<UMaterialInterface> SolidMaterial;
	UPROPERTY() TObjectPtr<UMaterialInterface> GlassMaterial;
	UPROPERTY() TObjectPtr<UMaterialInterface> LampMaterial;
	TMap<FString, UInstancedStaticMeshComponent*> BatchByKey;

	struct FLightSpot { FVector At; FLinearColor Color; float Intensity = 0; float Radius = 0; };
	TArray<FLightSpot> LightSpots;
	double PoolTimer = 0;
};
