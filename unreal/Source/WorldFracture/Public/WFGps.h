#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/WFGpsCore.h"
#include "WFGps.generated.h"

class UInstancedStaticMeshComponent;
class UMaterialInterface;
class UPointLightComponent;
class UStaticMeshComponent;

/** a place the GPS can route to (rules metres on the ground: x, z) */
struct FWFGpsDestination
{
	FString Label;
	FString Kind; // SHOP | LANDMARK | DISTRICT | PIN
	double X = 0, Z = 0;
};

/** where the HUD drew the full map this frame, so a click can be turned back into a world point */
struct FWFGpsMapView
{
	bool bValid = false;
	float Left = 0, Top = 0, Width = 0, Height = 0;
	double MinX = 0, MinZ = 0, Scale = 1; // pixels per metre
};

/**
 * The GPS for Nexus City: road graph, waypoint, route, turn-by-turn guidance and the route drawn on the street.
 *
 * The graph comes from DataTables/NexusCity.json (road segments, the hub's ring road, building footprints) through
 * wf::gps (WorldFractureCore, tested by Tests/GpsCoreTest.cpp). Destinations are the city's shops (RegionalShops.json),
 * landmarks (Landmarks.json) and its four districts' streets (north Spire, east Market, west Arcology, south Shipyard,
 * as nexus-districts.ts districtAt). A waypoint counts as reached within 12 m (map-pin.ts ARRIVE_RADIUS).
 *
 * Keys: M opens the city map (the game pauses); on it Up/Down choose a destination, Enter routes there, a left click
 * drops a custom waypoint, Backspace clears it, M or Escape closes. Gamepad: D-pad left opens/closes, D-pad up/down
 * choose, A routes, B clears. Console: GpsList, GpsTo <number|name>, GpsClear.
 */
UCLASS()
class WORLDFRACTURE_API AWFGpsNavigator : public AActor
{
	GENERATED_BODY()

public:
	AWFGpsNavigator();

	virtual void Tick(float DeltaSeconds) override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

	/** Reads the city layout and builds the road graph. GroundZ (cm) is the city's street level. */
	bool Build(double GroundZ);
	bool IsBuilt() const { return bBuilt; }

	/** the navigator in this world, if the game mode spawned one */
	static AWFGpsNavigator* Find(const UWorld* World);

	// ---- waypoint ----
	void RouteToDestination(int32 Index);
	void SetPinAt(double X, double Z, const FString& Label);
	void ClearPin();
	bool HasPin() const { return bHasPin; }
	const FWFGpsDestination& GetPin() const { return Pin; }

	// ---- map screen ----
	void ToggleMap();
	bool IsMapOpen() const { return bMapOpen; }
	int32 GetSelected() const { return Selected; }
	void MoveSelection(int32 Delta);
	/** the HUD reports where it drew the map; clicks use it */
	void SetMapView(const FWFGpsMapView& View) { MapView = View; }

	// ---- what the HUD draws ----
	const TArray<FWFGpsDestination>& GetDestinations() const { return Destinations; }
	const wf::gps::FRoadGraph& GetGraph() const { return Graph; }
	const TArray<wf::gps::FRect>& GetFootprints() const { return Footprints; }
	const wf::gps::FRoute& GetRoute() const { return Route; }
	const wf::gps::FGuidance& GetGuidance() const { return Guidance; }
	/** the hub's centre and ring radius (m), for the map's plaza */
	FVector2D GetHub() const { return Hub; }
	double GetRingRadius() const { return RingRadius; }
	/** the player (or the vehicle they drive) in rules metres, and the camera's heading (degrees, Unreal yaw) */
	bool GetPlayer(double& X, double& Z, double& YawDeg) const;
	/** recent average ground speed (m/s), for the arrival estimate */
	double GetSpeed() const { return SpeedMs; }

	/** Optional emissive material for the route line (vector parameter "Color"); BasicShapeMaterial when unset. */
	UPROPERTY(EditAnywhere, Category = "GPS") TObjectPtr<UMaterialInterface> RouteMaterial;
	/** the route line's colours: on roads, and across open plaza */
	UPROPERTY(EditAnywhere, Category = "GPS") FLinearColor RoadColor = FLinearColor(0.1f, 1.f, 0.65f);
	UPROPERTY(EditAnywhere, Category = "GPS") FLinearColor PlazaColor = FLinearColor(1.f, 0.78f, 0.2f);

private:
	void Replan();
	void RebuildRibbon();
	void HandleKeys();
	void Toast(const FString& Text, const FLinearColor& Color) const;
	double GroundAt(double X, double Z) const;

	bool bBuilt = false;
	double GroundZ = 0;
	wf::gps::FRoadGraph Graph;
	TArray<wf::gps::FRect> Footprints;
	TArray<FWFGpsDestination> Destinations;
	FVector2D Hub = FVector2D::ZeroVector;
	double RingRadius = 0;

	bool bHasPin = false;
	FWFGpsDestination Pin;
	wf::gps::FRoute Route;
	wf::gps::FGuidance Guidance;
	double OffRouteFor = 0;
	double GuideTimer = 0;

	bool bMapOpen = false;
	int32 Selected = 0;
	FWFGpsMapView MapView;

	double SpeedMs = 8;
	FVector2D LastPos = FVector2D::ZeroVector;
	bool bHasLastPos = false;

	UPROPERTY() TObjectPtr<UInstancedStaticMeshComponent> RoadDashes;
	UPROPERTY() TObjectPtr<UInstancedStaticMeshComponent> PlazaDashes;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Beacon;
	UPROPERTY() TObjectPtr<UPointLightComponent> BeaconLight;
};
