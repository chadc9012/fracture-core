#include "WFGps.h"

#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Dom/JsonObject.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "InputCoreTypes.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/FileHelper.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFDataFiles.h"
#include "WFHUD.h"

namespace
{
	TSharedPtr<FJsonObject> ReadObject(const TCHAR* Table)
	{
		FString Text;
		TSharedPtr<FJsonObject> Obj;
		if (!FFileHelper::LoadFileToString(Text, *WFData::TablePath(Table))) return nullptr;
		if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Obj)) return nullptr;
		return Obj;
	}

	TArray<TSharedPtr<FJsonValue>> ReadArray(const TCHAR* Table)
	{
		FString Text;
		TArray<TSharedPtr<FJsonValue>> Rows;
		if (FFileHelper::LoadFileToString(Text, *WFData::TablePath(Table))) FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Rows);
		return Rows;
	}

	/** a "Key": [[n, n, ...], ...] field as rows of numbers (strings become 0) */
	TArray<TArray<double>> NumberRows(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Field)
	{
		TArray<TArray<double>> Out;
		const TArray<TSharedPtr<FJsonValue>>* Rows = nullptr;
		if (!Obj.IsValid() || !Obj->TryGetArrayField(Field, Rows)) return Out;
		for (const TSharedPtr<FJsonValue>& Row : *Rows)
		{
			TArray<double>& R = Out.AddDefaulted_GetRef();
			if (!Row.IsValid() || Row->Type != EJson::Array) continue;
			for (const TSharedPtr<FJsonValue>& V : Row->AsArray()) R.Add(V.IsValid() && V->Type == EJson::Number ? V->AsNumber() : 0.0);
		}
		return Out;
	}

	constexpr float DashSpacingM = 3.5f, DashLengthM = 1.8f, DashWidthM = 0.55f, DashThickM = 0.05f;
}

AWFGpsNavigator::AWFGpsNavigator()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bTickEvenWhenPaused = true; // the map screen pauses the game and still needs its keys
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));

	auto Dashes = [this](const TCHAR* Name) {
		UInstancedStaticMeshComponent* C = CreateDefaultSubobject<UInstancedStaticMeshComponent>(Name);
		C->SetupAttachment(GetRootComponent());
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->SetCastShadow(false);
		return C;
	};
	RoadDashes = Dashes(TEXT("RouteRoad"));
	PlazaDashes = Dashes(TEXT("RoutePlaza"));

	Beacon = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Beacon"));
	Beacon->SetupAttachment(GetRootComponent());
	Beacon->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Beacon->SetCastShadow(false);
	Beacon->SetVisibility(false);
	BeaconLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("BeaconLight"));
	BeaconLight->SetupAttachment(GetRootComponent());
	BeaconLight->SetIntensity(6000.f);
	BeaconLight->SetAttenuationRadius(1500.f);
	BeaconLight->SetCastShadows(false);
	BeaconLight->SetVisibility(false);
}

AWFGpsNavigator* AWFGpsNavigator::Find(const UWorld* World)
{
	if (!World) return nullptr;
	for (TActorIterator<AWFGpsNavigator> It(const_cast<UWorld*>(World)); It; ++It) return *It;
	return nullptr;
}

bool AWFGpsNavigator::Build(double InGroundZ)
{
	GroundZ = InGroundZ;
	const TSharedPtr<FJsonObject> City = ReadObject(TEXT("NexusCity"));
	const TSharedPtr<FJsonObject>* HubObj = nullptr;
	if (!City.IsValid() || !City->TryGetObjectField(TEXT("Hub"), HubObj))
	{
		UE_LOG(LogTemp, Error, TEXT("GPS: could not read %s; no navigation."), *WFData::TablePath(TEXT("NexusCity")));
		return false;
	}
	Hub = FVector2D((*HubObj)->GetNumberField(TEXT("X")), (*HubObj)->GetNumberField(TEXT("Z")));
	RingRadius = (*HubObj)->GetNumberField(TEXT("RoadR"));
	const double JunctionHalf = (*HubObj)->GetNumberField(TEXT("Street")) / 2;
	const double CityOuter = (*HubObj)->GetNumberField(TEXT("CityOuter"));

	// building footprints the GPS must not cut through: rows hold full width and depth; hub towers also a turn
	for (const TArray<double>& B : NumberRows(City, TEXT("Buildings")))
		if (B.Num() >= 4) Footprints.Add({B[0], B[1], B[2] / 2, B[3] / 2, 0});
	for (const TArray<double>& T : NumberRows(City, TEXT("HubTowers")))
		if (T.Num() >= 6) Footprints.Add({T[0], T[1], T[2] / 2, T[3] / 2, T[5]});
	const std::vector<wf::gps::FRect> Obstacles(Footprints.GetData(), Footprints.GetData() + Footprints.Num());

	std::vector<std::vector<double>> Segments;
	for (const TArray<double>& S : NumberRows(City, TEXT("Segments"))) Segments.emplace_back(S.GetData(), S.GetData() + S.Num());
	Graph.AddCitySegments(Segments, JunctionHalf);
	Graph.AddRing(Hub.X, Hub.Y, RingRadius, 48); // 48 pieces keep the ring round on the full map
	const int32 Spokes = Graph.ConnectRingSpokes(Obstacles, 42);
	const int32 Bridges = Graph.BridgeComponents(Obstacles, 80);
	UE_LOG(LogTemp, Log, TEXT("GPS: %d nodes, %d edges (%d ring spokes, %d plaza crossings), %d piece(s)"),
		static_cast<int32>(Graph.Nodes().size()), static_cast<int32>(Graph.Edges().size()), Spokes, Bridges, Graph.CountComponents());
	if (Graph.Edges().empty()) return false;

	// destinations: landmarks and shops inside the city, then the four districts' streets
	auto Inside = [&](double X, double Z) { return FVector2D::Distance(FVector2D(X, Z), Hub) <= CityOuter; };
	auto AddFrom = [&](const TCHAR* Table, const TCHAR* Kind) {
		for (const TSharedPtr<FJsonValue>& V : ReadArray(Table))
		{
			const TSharedPtr<FJsonObject>* O = nullptr;
			if (!V.IsValid() || !V->TryGetObject(O)) continue;
			double X = 0, Z = 0;
			FString Name;
			if (!(*O)->TryGetNumberField(TEXT("X"), X) || !(*O)->TryGetNumberField(TEXT("Z"), Z) || !Inside(X, Z)) continue;
			if (!(*O)->TryGetStringField(TEXT("DisplayName"), Name)) Name = (*O)->GetStringField(TEXT("Id"));
			Destinations.Add({Name, Kind, X, Z});
		}
	};
	AddFrom(TEXT("Landmarks"), TEXT("LANDMARK"));
	AddFrom(TEXT("RegionalShops"), TEXT("SHOP"));
	// nexus-districts.ts districtAt: north (-z) Spire, east Market, west Arcology, south Shipyard
	struct FDistrict { const TCHAR* Label; double Dx, Dz; };
	for (const FDistrict& D : {FDistrict{TEXT("Spire streets (north)"), 0, -60}, FDistrict{TEXT("Market streets (east)"), 60, 0},
			 FDistrict{TEXT("Arcology streets (west)"), -60, 0}, FDistrict{TEXT("Shipyard streets (south)"), 0, 60}})
	{
		const wf::gps::FSnap S = Graph.Snap(Hub.X + D.Dx, Hub.Y + D.Dz);
		if (S.Edge >= 0) Destinations.Add({D.Label, TEXT("DISTRICT"), S.X, S.Z});
	}

	UMaterialInterface* Base = RouteMaterial ? RouteMaterial.Get() : LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	UStaticMesh* Cylinder = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	auto Paint = [&](UMeshComponent* C, const FLinearColor& Color) {
		if (!Base) return;
		UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(Base, this);
		M->SetVectorParameterValue(TEXT("Color"), Color);
		C->SetMaterial(0, M);
	};
	RoadDashes->SetStaticMesh(Cube);
	PlazaDashes->SetStaticMesh(Cube);
	Beacon->SetStaticMesh(Cylinder);
	Paint(RoadDashes, RoadColor);
	Paint(PlazaDashes, PlazaColor);
	Paint(Beacon, RoadColor);
	BeaconLight->SetLightColor(RoadColor);

	bBuilt = true;
	return true;
}

void AWFGpsNavigator::EndPlay(const EEndPlayReason::Type Reason)
{
	if (bMapOpen) ToggleMap();
	Super::EndPlay(Reason);
}

bool AWFGpsNavigator::GetPlayer(double& X, double& Z, double& YawDeg) const
{
	const APlayerController* PC = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr;
	const APawn* Pawn = PC ? PC->GetPawn() : nullptr;
	if (!Pawn) return false;
	const FVector P = Pawn->GetActorLocation();
	X = P.X / 100.0;
	Z = P.Y / 100.0;
	YawDeg = PC->GetControlRotation().Yaw;
	return true;
}

void AWFGpsNavigator::Toast(const FString& Text, const FLinearColor& Color) const
{
	const APlayerController* PC = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr;
	if (AWFHUD* Hud = PC ? Cast<AWFHUD>(PC->GetHUD()) : nullptr) Hud->Toast(Text, Color);
}

// ---------------------------------------------------------------- waypoint and route

void AWFGpsNavigator::RouteToDestination(int32 Index)
{
	if (!Destinations.IsValidIndex(Index)) return;
	const FWFGpsDestination& D = Destinations[Index];
	SetPinAt(D.X, D.Z, D.Label);
	Pin.Kind = D.Kind;
}

void AWFGpsNavigator::SetPinAt(double X, double Z, const FString& Label)
{
	if (!bBuilt) return;
	bHasPin = true;
	Pin = {Label, TEXT("PIN"), X, Z};
	Replan();
	if (Route.bValid)
		Toast(FString::Printf(TEXT("GPS: %s  -  %s"), *Label, UTF8_TO_TCHAR(wf::gps::FormatDistance(Route.Length).c_str())), FLinearColor(0.1f, 1.f, 0.65f));
}

void AWFGpsNavigator::ClearPin()
{
	bHasPin = false;
	Route = wf::gps::FRoute();
	Guidance = wf::gps::FGuidance();
	RebuildRibbon();
}

void AWFGpsNavigator::Replan()
{
	double X = 0, Z = 0, Yaw = 0;
	if (!bHasPin || !GetPlayer(X, Z, Yaw)) return;
	Route = wf::gps::PlanRoute(Graph, X, Z, Pin.X, Pin.Z);
	Guidance = wf::gps::Guide(Route, X, Z, 0); // Guidance.Next points into this Route
	OffRouteFor = 0;
	if (!Route.bValid) Toast(FString::Printf(TEXT("GPS: no route to %s"), *Pin.Label), FLinearColor(1.f, 0.55f, 0.3f));
	RebuildRibbon();
}

double AWFGpsNavigator::GroundAt(double X, double Z) const
{
	// from just above street level, so banners and screens overhead are not mistaken for the ground
	FHitResult Hit;
	const FVector Start(X * 100, Z * 100, GroundZ + 250), End(X * 100, Z * 100, GroundZ - 2000);
	if (GetWorld() && GetWorld()->LineTraceSingleByObjectType(Hit, Start, End, FCollisionObjectQueryParams(ECC_WorldStatic))) return Hit.ImpactPoint.Z;
	return GroundZ;
}

void AWFGpsNavigator::RebuildRibbon()
{
	RoadDashes->ClearInstances();
	PlazaDashes->ClearInstances();
	const bool bShow = bHasPin && Route.bValid;
	Beacon->SetVisibility(bShow);
	BeaconLight->SetVisibility(bShow);
	if (!bShow) return;

	// dashes laid along the route line, each turned to its leg, a few centimetres above the street
	double Carry = DashSpacingM * 0.5;
	for (size_t I = 0; I + 1 < Route.Points.size(); ++I)
	{
		const wf::gps::FPoint& A = Route.Points[I];
		const wf::gps::FPoint& B = Route.Points[I + 1];
		const double Len = FMath::Sqrt(FMath::Square(B.X - A.X) + FMath::Square(B.Z - A.Z));
		if (Len < 0.01) continue;
		const double Yaw = FMath::RadiansToDegrees(FMath::Atan2(B.Z - A.Z, B.X - A.X));
		UInstancedStaticMeshComponent* Into = Route.Kinds[I] == wf::gps::EEdgeKind::Plaza ? PlazaDashes : RoadDashes;
		double At = Carry;
		for (; At < Len; At += DashSpacingM)
		{
			const double X = A.X + (B.X - A.X) * At / Len, Z = A.Z + (B.Z - A.Z) * At / Len;
			const FVector Loc(X * 100, Z * 100, GroundAt(X, Z) + 6);
			Into->AddInstance(FTransform(FRotator(0, Yaw, 0), Loc, FVector(DashLengthM, DashWidthM, DashThickM)), true);
		}
		Carry = At - Len;
	}

	// a thin light column over the destination (cylinder: 100 cm tall, pivot at its centre)
	const double Gz = GroundAt(Pin.X, Pin.Z);
	Beacon->SetWorldLocation(FVector(Pin.X * 100, Pin.Z * 100, Gz + 1500));
	Beacon->SetWorldScale3D(FVector(0.35, 0.35, 30));
	BeaconLight->SetWorldLocation(FVector(Pin.X * 100, Pin.Z * 100, Gz + 300));
}

// ---------------------------------------------------------------- map screen

void AWFGpsNavigator::ToggleMap()
{
	APlayerController* PC = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr;
	bMapOpen = !bMapOpen;
	MapView.bValid = false;
	UGameplayStatics::SetGamePaused(this, bMapOpen);
	if (!PC) return;
	PC->SetShowMouseCursor(bMapOpen);
	if (bMapOpen)
	{
		FInputModeGameAndUI Mode;
		Mode.SetHideCursorDuringCapture(false);
		PC->SetInputMode(Mode);
	}
	else PC->SetInputMode(FInputModeGameOnly());
}

void AWFGpsNavigator::MoveSelection(int32 Delta)
{
	if (Destinations.IsEmpty()) return;
	Selected = (Selected + Delta + Destinations.Num()) % Destinations.Num();
}

void AWFGpsNavigator::HandleKeys()
{
	APlayerController* PC = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr;
	if (!PC) return;
	auto Pressed = [PC](const FKey& K) { return PC->WasInputKeyJustPressed(K); };
	if (Pressed(EKeys::M) || Pressed(EKeys::Gamepad_DPad_Left)) { ToggleMap(); return; }
	if (!bMapOpen) return;
	if (Pressed(EKeys::Up) || Pressed(EKeys::W) || Pressed(EKeys::Gamepad_DPad_Up)) MoveSelection(-1);
	if (Pressed(EKeys::Down) || Pressed(EKeys::S) || Pressed(EKeys::Gamepad_DPad_Down)) MoveSelection(1);
	if (Pressed(EKeys::Enter) || Pressed(EKeys::Gamepad_FaceButton_Bottom)) { RouteToDestination(Selected); ToggleMap(); return; }
	if (Pressed(EKeys::BackSpace) || Pressed(EKeys::Delete) || Pressed(EKeys::Gamepad_FaceButton_Right)) ClearPin();
	if (Pressed(EKeys::LeftMouseButton) && MapView.bValid)
	{
		float Mx = 0, My = 0;
		if (PC->GetMousePosition(Mx, My) && Mx >= MapView.Left && My >= MapView.Top && Mx <= MapView.Left + MapView.Width && My <= MapView.Top + MapView.Height)
		{
			const double X = MapView.MinX + static_cast<double>(Mx - MapView.Left) / MapView.Scale;
			const double Z = MapView.MinZ + static_cast<double>(My - MapView.Top) / MapView.Scale;
			SetPinAt(X, Z, TEXT("Custom waypoint")); // map-pin.ts pinAt label
		}
	}
}

void AWFGpsNavigator::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!bBuilt) return;
	HandleKeys();
	if (bMapOpen) return; // paused

	double X = 0, Z = 0, Yaw = 0;
	if (!GetPlayer(X, Z, Yaw)) return;
	const FVector2D Here(X, Z);
	if (bHasLastPos && DeltaSeconds > 0)
	{
		const double Instant = FVector2D::Distance(Here, LastPos) / static_cast<double>(DeltaSeconds);
		if (Instant < 120) SpeedMs = FMath::Lerp(SpeedMs, FMath::Max(Instant, 1.5), FMath::Min(1.0, static_cast<double>(DeltaSeconds) * 0.5));
	}
	LastPos = Here;
	bHasLastPos = true;

	if (!bHasPin) return;
	GuideTimer += DeltaSeconds;
	if (GuideTimer < 0.15) return;
	const double Step = GuideTimer;
	GuideTimer = 0;
	if (!Route.bValid) { Replan(); return; }
	Guidance = wf::gps::Guide(Route, X, Z, Guidance.Progress);
	if (Guidance.bArrived)
	{
		Toast(FString::Printf(TEXT("Arrived: %s"), *Pin.Label), FLinearColor(0.1f, 1.f, 0.65f));
		ClearPin();
		return;
	}
	OffRouteFor = Guidance.bShouldReroute ? OffRouteFor + Step : 0;
	if (OffRouteFor > 1.0) Replan(); // a second off the line: recalculate from here
}
