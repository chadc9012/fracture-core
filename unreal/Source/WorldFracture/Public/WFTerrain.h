#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "WFTerrain.generated.h"

class UProceduralMeshComponent;
class UMaterialInterface;
class UStaticMeshComponent;

/**
 * The world's ground: the web build's terrain (terrain.ts heightAt, with its rivers carved and supply roads graded),
 * exported by unreal/tools/export-terrain.ts as DataTables/Terrain.bin, built as streamed mesh tiles with collision
 * around the player, and the sea at the web build's water level. Rules metres x / z = Unreal X / Y, height = Z.
 *
 * Tiles are tinted per vertex (region ground colour, rock on steep slopes, sand at the shore, snow up high) for a
 * material that reads vertex colour; until one is set (TerrainMaterial, made by the editor setup script) each tile
 * takes its region's colour through BasicShapeMaterial. A flat pad levels the ground under Nexus City.
 */
UCLASS()
class WORLDFRACTURE_API AWFTerrain : public AActor
{
	GENERATED_BODY()

public:
	AWFTerrain();

	virtual void Tick(float DeltaSeconds) override;

	/** Reads Terrain.bin and Regions.json. False (with a log line) if the heightmap is missing or unreadable. */
	bool Load();
	bool IsLoaded() const { return N > 0; }

	/** Ground height (m) at rules metres x, z: bilinear on the heightmap, with any flat pad applied. */
	double HeightAt(double X, double Z) const;
	/** Ground height (cm) under an Unreal location (cm). */
	double HeightAtCm(double XCm, double YCm) const { return HeightAt(XCm / 100.0, YCm / 100.0) * 100.0; }
	double GetWaterLevel() const { return WaterLevel; }

	/** Levels the ground to Height (m) within Inner m of (X, Z), blending back to the land by Outer m (Nexus City). */
	void SetFlatPad(double X, double Z, double Height, double Inner, double Outer);

	/** Builds every tile within Radius m of an Unreal location right away (so the player has ground under them). */
	void BuildAround(const FVector& AtCm, double Radius);

	/** Optional authored materials: TerrainMaterial reads vertex colour; WaterMaterial takes a "Color" parameter. */
	UPROPERTY(EditAnywhere, Category = "Terrain") TObjectPtr<UMaterialInterface> TerrainMaterial;
	UPROPERTY(EditAnywhere, Category = "Terrain") TObjectPtr<UMaterialInterface> WaterMaterial;
	/** Tiles are kept within this many metres of the player (phones keep fewer). */
	UPROPERTY(EditAnywhere, Category = "Terrain") float StreamRadiusDesktop = 900.f;
	UPROPERTY(EditAnywhere, Category = "Terrain") float StreamRadiusMobile = 500.f;
	/** Triangles are wound for Unreal's front face seen from above; flip if a build ever shows the ground from below. */
	UPROPERTY(EditAnywhere, Category = "Terrain") bool bFlipWinding = false;

private:
	double Sample(int32 IX, int32 IZ) const;
	FLinearColor GroundColor(double X, double Z, double H, double Slope) const;
	void BuildTile(int32 TX, int32 TZ, bool bAsyncCollision);
	void Stream(const FVector& AtCm, double Radius, int32 Budget, bool bAsyncCollision);

	static constexpr int32 TileCells = 32;

	UPROPERTY() TObjectPtr<USceneComponent> Root;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Sea;
	UPROPERTY() TMap<int64, TObjectPtr<UProceduralMeshComponent>> Tiles;
	UPROPERTY() TObjectPtr<UMaterialInterface> BasicMaterial;

	TArray<uint16> Heights;
	int32 N = 0;
	double Cell = 4, Origin = 0, WaterLevel = -2.5, HMin = 0, HStep = 1;

	struct FRegionTint { double X = 0, Z = 0, Radius = 0; FLinearColor Color; };
	TArray<FRegionTint> Regions;

	bool bPad = false;
	double PadX = 0, PadZ = 0, PadH = 0, PadInner = 0, PadOuter = 0;
	double StreamTimer = 0;
};
