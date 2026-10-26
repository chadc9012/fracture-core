#include "WFNexusCity.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/DirectionalLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/SkyLight.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFAssets.h"
#include "WFDataFiles.h"

namespace
{
	constexpr double CityCmPerM = 100.0;

	FLinearColor Hex(const TCHAR* Code) { return FLinearColor::FromSRGBColor(FColor::FromHex(Code)); }

	// the look: gritty concrete and dark glass, lit by neon (owner's "Nexus at night" target frame)
	const FLinearColor Asphalt = Hex(TEXT("1b1f26"));
	const FLinearColor Pavement = Hex(TEXT("3a3f47"));
	const FLinearColor KerbStone = Hex(TEXT("5b6068"));
	const FLinearColor PlazaStone = Hex(TEXT("4a5058"));
	const FLinearColor LinePaint = Hex(TEXT("c9ccd1"));
	const FLinearColor LineYellow = Hex(TEXT("d8b23a"));
	const FLinearColor Glass = Hex(TEXT("1d2b3a"));
	const FLinearColor Concrete = Hex(TEXT("5a5d63"));
	const FLinearColor Industrial = Hex(TEXT("4b4540"));
	const FLinearColor DarkStone = Hex(TEXT("23252a"));
	const FLinearColor Metal = Hex(TEXT("2e3238"));
	const FLinearColor Foliage = Hex(TEXT("2f5a34"));
	const FLinearColor WarmWindow = Hex(TEXT("e8b46a"));
	const FLinearColor CoolWindow = Hex(TEXT("7fc8ff"));
	const FLinearColor LampHead = Hex(TEXT("cfe8ff"));
	const FLinearColor HubCyan = Hex(TEXT("66e0ff"));
	const FLinearColor HydrantRed = Hex(TEXT("a3271f"));
	const FLinearColor CarPaint[6] = {Hex(TEXT("2a2d33")), Hex(TEXT("8a8f96")), Hex(TEXT("6b1e24")), Hex(TEXT("1f3554")), Hex(TEXT("d9d9d6")), Hex(TEXT("3d4a36"))};

	/** the web build turns things about +y by yaw (three.js); with x/z on Unreal X/Y that is minus the angle in Unreal yaw */
	double UnrealYawDeg(double Yaw) { return -FMath::RadiansToDegrees(Yaw); }
	/** a local (x, z) offset turned by a web-build yaw, in world x/z (three.js Ry: x' = x cos + z sin, z' = -x sin + z cos) */
	FVector2D Turn(double LX, double LZ, double Yaw)
	{
		const double C = FMath::Cos(Yaw), S = FMath::Sin(Yaw);
		return FVector2D(LX * C + LZ * S, -LX * S + LZ * C);
	}

	/** row reader for the exporter's flat arrays */
	struct FRow
	{
		TArray<TSharedPtr<FJsonValue>> V;
		double N(int32 Index) const { return V.IsValidIndex(Index) && V[Index].IsValid() ? V[Index]->AsNumber() : 0.0; }
		int32 I(int32 Index) const { return static_cast<int32>(N(Index)); }
		FString S(int32 Index) const { return V.IsValidIndex(Index) && V[Index].IsValid() ? V[Index]->AsString() : FString(); }
	};
	TArray<FRow> Rows(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Field)
	{
		TArray<FRow> Out;
		const TArray<TSharedPtr<FJsonValue>>* List = nullptr;
		if (!Obj.IsValid() || !Obj->TryGetArrayField(Field, List)) return Out;
		for (const TSharedPtr<FJsonValue>& Item : *List)
		{
			const TArray<TSharedPtr<FJsonValue>>* Cells = nullptr;
			if (Item.IsValid() && Item->TryGetArray(Cells)) Out.Add({*Cells});
		}
		return Out;
	}
	TArray<FLinearColor> Colors(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Field)
	{
		TArray<FLinearColor> Out;
		const TArray<TSharedPtr<FJsonValue>>* List = nullptr;
		if (Obj.IsValid() && Obj->TryGetArrayField(Field, List))
			for (const TSharedPtr<FJsonValue>& Item : *List)
				if (Item.IsValid()) Out.Add(Hex(*Item->AsString().Replace(TEXT("#"), TEXT(""))));
		return Out;
	}
	FLinearColor Pick(const TArray<FLinearColor>& List, int32 Index, const FLinearColor& Fallback)
	{
		return List.IsValidIndex(Index) ? List[Index] : Fallback;
	}
}

AWFNexusCity::AWFNexusCity()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.f;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Root->SetMobility(EComponentMobility::Movable);
	RootComponent = Root;
}

void AWFNexusCity::BeginPlay()
{
	Super::BeginPlay();
	if (!bBuilt) Build();
}

UInstancedStaticMeshComponent* AWFNexusCity::Batch(UStaticMesh* Mesh, const FLinearColor& Color, bool bNeon, bool bCollide)
{
	if (!Mesh) return nullptr;
	const FString Key = FString::Printf(TEXT("%s|%s|%d|%d"), *Mesh->GetName(), *Color.ToString(), bNeon ? 1 : 0, bCollide ? 1 : 0);
	if (UInstancedStaticMeshComponent** Found = BatchByKey.Find(Key)) return *Found;

	UInstancedStaticMeshComponent* Ism = NewObject<UInstancedStaticMeshComponent>(this);
	// Movable: a run-time static primitive gets no built lighting (no sky or bounce light on a cooked phone build)
	Ism->SetMobility(EComponentMobility::Movable);
	Ism->SetupAttachment(Root);
	Ism->SetStaticMesh(Mesh);
	Ism->SetCollisionEnabled(bCollide ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
	if (bCollide) Ism->SetCollisionProfileName(TEXT("BlockAll"));
	Ism->SetCastShadow(bCollide && !bNeon); // only the solid architecture casts shadows (cheap on phones)
	UMaterialInterface* Base = bNeon && NeonMaterial ? NeonMaterial.Get() : !bNeon && SurfaceMaterial ? SurfaceMaterial.Get() : BasicMaterial.Get();
	if (Base)
	{
		UMaterialInstanceDynamic* Paint = UMaterialInstanceDynamic::Create(Base, this);
		Paint->SetVectorParameterValue(TEXT("Color"), Color);
		Ism->SetMaterial(0, Paint);
	}
	// registered once filled (end of Build): thousands of AddInstance calls on a live component each rebuild render
	// and physics state
	Batches.Add(Ism);
	BatchByKey.Add(Key, Ism);
	return Ism;
}

UInstancedStaticMeshComponent* AWFNexusCity::ModelBatch(UStaticMesh* Mesh)
{
	const FString Key = FString::Printf(TEXT("model|%s"), *Mesh->GetPathName());
	if (UInstancedStaticMeshComponent** Found = BatchByKey.Find(Key)) return *Found;
	UInstancedStaticMeshComponent* Ism = NewObject<UInstancedStaticMeshComponent>(this);
	Ism->SetMobility(EComponentMobility::Movable);
	Ism->SetupAttachment(Root);
	Ism->SetStaticMesh(Mesh);
	Ism->SetCollisionProfileName(TEXT("BlockAll"));
	Batches.Add(Ism);
	BatchByKey.Add(Key, Ism);
	return Ism;
}

void AWFNexusCity::Box(UInstancedStaticMeshComponent* To, double X, double Y, double Z, double SX, double SY, double SZ, double Yaw) const
{
	if (!To || SX <= 0 || SY <= 0 || SZ <= 0) return;
	// engine cube: 1 m, centred; web x/z/y = Unreal X/Y/Z, so a web size (sx, sy up, sz) scales (X, Y, Z) = (sx, sz, sy)
	const FTransform Xf(FRotator(0.f, static_cast<float>(UnrealYawDeg(Yaw)), 0.f), FVector(X, Z, Y + DatumM) * CityCmPerM, FVector(SX, SZ, SY));
	To->AddInstance(Xf, true);
}

void AWFNexusCity::Cylinder(UInstancedStaticMeshComponent* To, double X, double Y, double Z, double Diameter, double Height) const
{
	if (!To || Diameter <= 0 || Height <= 0) return;
	const FTransform Xf(FRotator::ZeroRotator, FVector(X, Z, Y + DatumM) * CityCmPerM, FVector(Diameter, Diameter, Height));
	To->AddInstance(Xf, true);
}

void AWFNexusCity::AddLightSpot(double X, double Y, double Z, const FLinearColor& Color, float Intensity, float Radius)
{
	LightSpots.Add({FVector(X, Z, Y + DatumM) * CityCmPerM, Color, Intensity, Radius});
}

bool AWFNexusCity::Build()
{
	if (bBuilt) return true;
	CubeMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	CylinderMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	BasicMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	if (!CubeMesh || !CylinderMesh)
	{
		UE_LOG(LogTemp, Error, TEXT("Nexus City: the engine's basic shapes are missing; the city was not built."));
		return false;
	}

	const FString Path = WFData::TablePath(TEXT("NexusCity"));
	FString Text;
	TSharedPtr<FJsonObject> City;
	if (!FFileHelper::LoadFileToString(Text, *Path) || !FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), City) || !City.IsValid())
	{
		UE_LOG(LogTemp, Error, TEXT("Nexus City: could not read %s (run unreal/tools/export-nexus-city.ts); the city was not built."), *Path);
		return false;
	}

	const TSharedPtr<FJsonObject>* HubObj = nullptr;
	if (!City->TryGetObjectField(TEXT("Hub"), HubObj)) return false;
	const TSharedPtr<FJsonObject>& Hub = *HubObj;
	const double HX = Hub->GetNumberField(TEXT("X")), HZ = Hub->GetNumberField(TEXT("Z"));
	const double Outer = Hub->GetNumberField(TEXT("CityOuter"));
	const double RoadR = Hub->GetNumberField(TEXT("RoadR")), RoadHalf = Hub->GetNumberField(TEXT("RoadHalf"));
	const TArray<FLinearColor> ShopTints = Colors(City, TEXT("ShopTints"));
	const TArray<FLinearColor> SignColors = Colors(City, TEXT("SignColors"));
	if (bOnTerrain) DatumM = City->GetNumberField(TEXT("Datum"));
	CityRadiusM = Outer;
	HubCentre = FVector(HX, HZ, DatumM) * CityCmPerM;
	if (!SurfaceMaterial) SurfaceMaterial = WFAssets::Material(TEXT("M_WF_Surface"));
	if (!NeonMaterial) NeonMaterial = WFAssets::Material(TEXT("M_WF_Neon"));

	UStaticMesh* Cube = CubeMesh.Get();
	UStaticMesh* Cyl = CylinderMesh.Get();

	// ---- ground: one asphalt slab under the whole city (top at Z = 0), the plaza, promenade ring and ring-road lines ----
	const double Span = (Outer + 20) * 2;
	if (bOnTerrain) Cylinder(Batch(Cyl, Asphalt, false, true), HX, -0.47, HZ, (Outer + 15) * 2, 1.0); // the terrain pad's flat disc
	else Box(Batch(Cube, Asphalt, false, true), HX, -0.5, HZ, Span, 1.0, Span);
	const double PlazaR = RoadR - RoadHalf;
	Cylinder(Batch(Cyl, PlazaStone, false, true), HX, 0.06, HZ, PlazaR * 2, 0.12);
	{
		const TArray<TSharedPtr<FJsonValue>>* Prom = nullptr;
		double P0 = 12.8, P1 = 13.8;
		if (Hub->TryGetArrayField(TEXT("Promenade"), Prom) && Prom->Num() == 2) { P0 = (*Prom)[0]->AsNumber(); P1 = (*Prom)[1]->AsNumber(); }
		UInstancedStaticMeshComponent* Ring = Batch(Cube, KerbStone, false, false);
		UInstancedStaticMeshComponent* Edge = Batch(Cube, LinePaint, false, false);
		UInstancedStaticMeshComponent* Glow = Batch(Cube, HubCyan, true, false);
		constexpr int32 Steps = 72;
		for (int32 K = 0; K < Steps; ++K)
		{
			const double A = (K + 0.5) * UE_DOUBLE_TWO_PI / Steps, Yaw = -A + UE_DOUBLE_HALF_PI; // tangent along the ring
			const double C = FMath::Cos(A), S = FMath::Sin(A);
			const double Mid = (P0 + P1) / 2, Seg = 2 * UE_DOUBLE_PI * Mid / Steps + 0.05;
			Box(Ring, HX + C * Mid, 0.13, HZ + S * Mid, Seg, 0.02, P1 - P0, Yaw);
			for (const double R : {RoadR - RoadHalf + 0.15, RoadR + RoadHalf - 0.15})
				if (K % 2 == 0) Box(Edge, HX + C * R, 0.01, HZ + S * R, 2 * UE_DOUBLE_PI * R / Steps * 1.6, 0.02, 0.15, Yaw);
			if (K % 3 == 0) Box(Glow, HX + C * PlazaR, 0.14, HZ + S * PlazaR, 2 * UE_DOUBLE_PI * PlazaR / Steps * 2.4, 0.04, 0.12, Yaw);
		}
	}
	// the spawn pad (NEXUS_HUB_SPAWN), facing the plaza
	{
		const double SX = HX + Hub->GetNumberField(TEXT("SpawnX")), SZ = HZ + Hub->GetNumberField(TEXT("SpawnZ"));
		Cylinder(Batch(Cyl, Metal, false, true), SX, 0.08, SZ, 5.0, 0.16);
		Cylinder(Batch(Cyl, HubCyan, true, false), SX, 0.17, SZ, 3.6, 0.02);
		AddLightSpot(SX, 1.5, SZ, HubCyan, 60.f, 900.f);
		SpawnLocation = FVector(SX, SZ, DatumM) * CityCmPerM + FVector(0, 0, 120);
		SpawnRotation = FRotator(0.f, static_cast<float>(FMath::RadiansToDegrees(FMath::Atan2(HZ - SZ, HX - SX))), 0.f);
	}

	// ---- the hub's civic towers (authored GLBs in the web build: their footprint and height here) ----
	for (const FRow& T : Rows(City, TEXT("HubTowers")))
	{
		const double X = T.N(0), Z = T.N(1), W = T.N(2), D = T.N(3), H = T.N(4), Rot = T.N(5);
		const bool bSpire = T.S(6).Contains(TEXT("spire"));
		if (UStaticMesh* Model = WFAssets::Mesh(TEXT("Buildings"), T.S(6)))
		{
			// the web build's authored tower (footprint centre at the origin, ground at 0, lobby toward +z)
			const FTransform Xf(FRotator(0.f, static_cast<float>(UnrealYawDeg(Rot)) + ImportedModelYawDeg, 0.f), FVector(X, Z, DatumM) * CityCmPerM);
			ModelBatch(Model)->AddInstance(Xf, true);
			AddLightSpot(X + Turn(0, D / 2 + 0.6, Rot).X, 3.2, Z + Turn(0, D / 2 + 0.6, Rot).Y, WarmWindow, 45.f, 800.f);
			continue;
		}
		Box(Batch(Cube, bSpire ? Glass : Concrete, false, true), X, H / 2 - 0.5, Z, W, H + 1, D, Rot);
		Box(Batch(Cube, DarkStone, false, true), X, 2.1, Z, W + 0.3, 4.2, D + 0.3, Rot);
		// lobby canopy and doors on the front (+z, toward the plaza)
		const FVector2D Front = Turn(0, D / 2 + 0.6, Rot), Door = Turn(0, D / 2 + 0.16, Rot);
		Box(Batch(Cube, Metal, false, false), X + Front.X, 3.6, Z + Front.Y, W * 0.5, 0.18, 1.4, Rot);
		Box(Batch(Cube, WarmWindow, true, false), X + Door.X, 1.5, Z + Door.Y, W * 0.32, 3.0, 0.1, Rot);
		AddLightSpot(X + Front.X, 3.2, Z + Front.Y, WarmWindow, 45.f, 800.f);
		// lit floors up the plaza face
		UInstancedStaticMeshComponent* Lit = Batch(Cube, bSpire ? CoolWindow : WarmWindow, true, false);
		const FVector2D Face = Turn(0, D / 2 + 0.04, Rot);
		for (double Y = 6.4; Y < H - 2; Y += 3.4 * 2) Box(Lit, X + Face.X, Y, Z + Face.Y, W * 0.86, 0.5, 0.06, Rot);
	}

	// ---- district buildings: body, setback crown, lit floors, roof kit ----
	for (const FRow& B : Rows(City, TEXT("Buildings")))
	{
		const double X = B.N(0), Z = B.N(1), W = B.N(2), D = B.N(3), Yaw = B.N(4), Base = B.N(5), Top = B.N(6);
		const int32 Floors = B.I(7), Style = B.I(8);
		const bool bCrown = B.I(10) != 0;
		const int32 Roof = B.I(11);
		const FLinearColor Body = Style == 0 ? Glass : Style == 1 ? Concrete : Industrial;
		const double BodyTop = bCrown ? Base + (Top - Base) * 0.78 : Top;
		Box(Batch(Cube, Body, false, true), X, (Base + BodyTop) / 2, Z, W, BodyTop - Base, D, Yaw);
		if (bCrown) Box(Batch(Cube, Body, false, true), X, (BodyTop + Top) / 2, Z, W * 0.7, Top - BodyTop, D * 0.7, Yaw);

		// lit floors: thin bands on all four faces (glass towers every other floor in cool light, concrete every third, warm)
		if (Style != 2 && Floors >= 3)
		{
			UInstancedStaticMeshComponent* Lit = Batch(Cube, Style == 0 ? CoolWindow : WarmWindow, true, false);
			const int32 Every = Style == 0 ? 2 : 3;
			for (int32 F = 2; F < Floors; F += Every)
			{
				const double Y = F * 3.4 + 1.6;
				if (Y > BodyTop - 1.2) break;
				Box(Lit, X, Y, Z + D / 2 + 0.03, W * 0.86, 0.45, 0.05, Yaw);
				Box(Lit, X, Y, Z - D / 2 - 0.03, W * 0.86, 0.45, 0.05, Yaw);
				Box(Lit, X + W / 2 + 0.03, Y, Z, 0.05, 0.45, D * 0.86, Yaw);
				Box(Lit, X - W / 2 - 0.03, Y, Z, 0.05, 0.45, D * 0.86, Yaw);
			}
		}
		// roof kit: none, tanks, hvac, antenna, helipad, garden
		const double RW = bCrown ? W * 0.7 : W, RD = bCrown ? D * 0.7 : D;
		switch (Roof)
		{
		case 1: Cylinder(Batch(Cyl, Metal, false, true), X + RW * 0.2, Top + 1.3, Z - RD * 0.15, 2.2, 2.6); Cylinder(Batch(Cyl, Metal, false, true), X - RW * 0.2, Top + 1.1, Z + RD * 0.2, 1.8, 2.2); break;
		case 2: Box(Batch(Cube, Metal, false, true), X - RW * 0.15, Top + 0.8, Z, 3.0, 1.6, 2.0); Box(Batch(Cube, Metal, false, true), X + RW * 0.25, Top + 0.6, Z + RD * 0.2, 1.8, 1.2, 1.8); break;
		case 3:
			Cylinder(Batch(Cyl, Metal, false, false), X, Top + 4.5, Z, 0.3, 9.0);
			Cylinder(Batch(Cyl, Hex(TEXT("ff3b3b")), true, false), X, Top + 9.1, Z, 0.5, 0.3); // aircraft warning light
			break;
		case 4: Cylinder(Batch(Cyl, DarkStone, false, true), X, Top + 0.1, Z, FMath::Min(RW, RD) * 0.8, 0.2); Cylinder(Batch(Cyl, LineYellow, false, false), X, Top + 0.21, Z, FMath::Min(RW, RD) * 0.5, 0.02); break;
		case 5: Box(Batch(Cube, Foliage, false, true), X, Top + 0.3, Z, RW - 1.2, 0.6, RD - 1.2); break;
		default: break;
		}
	}

	// ---- facade kit (axis-aligned boxes: [x, y, z, sx, sy, sz, tint]) ----
	{
		const TSharedPtr<FJsonObject>* FacadeObj = nullptr;
		if (City->TryGetObjectField(TEXT("Facade"), FacadeObj))
		{
			const TSharedPtr<FJsonObject>& Fac = *FacadeObj;
			auto Each = [&](const TCHAR* Field, TFunctionRef<UInstancedStaticMeshComponent*(const FRow&)> Into) {
				for (const FRow& R : Rows(Fac, Field)) Box(Into(R), R.N(0), R.N(1), R.N(2), R.N(3), R.N(4), R.N(5));
			};
			Each(TEXT("Plinths"), [&](const FRow&) { return Batch(Cube, DarkStone, false, true); });
			Each(TEXT("Ledges"), [&](const FRow&) { return Batch(Cube, KerbStone, false, false); });
			Each(TEXT("Fins"), [&](const FRow&) { return Batch(Cube, Metal, false, false); });
			Each(TEXT("Balconies"), [&](const FRow&) { return Batch(Cube, KerbStone, false, false); });
			Each(TEXT("Rails"), [&](const FRow&) { return Batch(Cube, Metal, false, false); });
			Each(TEXT("Portals"), [&](const FRow&) { return Batch(Cube, DarkStone, false, false); });
			Each(TEXT("Lobbies"), [&](const FRow&) { return Batch(Cube, WarmWindow, true, false); });
			Each(TEXT("Shopfronts"), [&](const FRow& R) { return Batch(Cube, Pick(ShopTints, R.I(6), WarmWindow), true, false); });
			Each(TEXT("Awnings"), [&](const FRow& R) { return Batch(Cube, Pick(ShopTints, R.I(6), WarmWindow) * 0.45f, false, false); });
			Each(TEXT("Blades"), [&](const FRow& R) { return Batch(Cube, Pick(ShopTints, R.I(6), WarmWindow), true, false); });
			for (const FRow& R : Rows(Fac, TEXT("Shopfronts"))) AddLightSpot(R.N(0), R.N(1) + 0.4, R.N(2), Pick(ShopTints, R.I(6), WarmWindow), 30.f, 700.f);
			for (const FRow& R : Rows(Fac, TEXT("Lobbies"))) AddLightSpot(R.N(0), R.N(1) + 0.6, R.N(2), WarmWindow, 25.f, 600.f);
		}
	}

	// ---- streets: sidewalks, kerbs, crossings and lines, furniture ----
	for (const FRow& S : Rows(City, TEXT("Slabs"))) Box(Batch(Cube, Pavement, false, true), S.N(0), 0.075, S.N(1), S.N(2) * 2, 0.15, S.N(3) * 2);
	for (const FRow& K : Rows(City, TEXT("Kerbs")))
	{
		const double H = K.I(4) ? 0.04 : 0.16;
		Box(Batch(Cube, KerbStone, false, true), K.N(0), H / 2, K.N(1), K.N(2) * 2, H, K.N(3) * 2);
	}
	for (const FRow& P : Rows(City, TEXT("Paint")))
	{
		const int32 Kind = P.I(4); // zebra, stop, centre, edge, tactile
		const bool bTactile = Kind == 4;
		Box(Batch(Cube, Kind == 2 || bTactile ? LineYellow : LinePaint, false, false), P.N(0), bTactile ? 0.155 : 0.006, P.N(1), P.N(2) * 2, 0.012, P.N(3) * 2);
	}
	for (const FRow& P : Rows(City, TEXT("Props")))
	{
		const double X = P.N(0), Z = P.N(1), Yaw = P.N(2);
		switch (P.I(3)) // bench, bin, bollard, planter, hydrant, shelter, signal, sign
		{
		case 0: Box(Batch(Cube, Metal, false, true), X, 0.45, Z, 1.9, 0.12, 0.64, Yaw); Box(Batch(Cube, Metal, false, true), X, 0.22, Z, 1.7, 0.44, 0.3, Yaw); break;
		case 1: Cylinder(Batch(Cyl, Metal, false, false), X, 0.5, Z, 0.6, 1.0); break;
		case 2: Cylinder(Batch(Cyl, DarkStone, false, false), X, 0.5, Z, 0.28, 1.0); break;
		case 3: Box(Batch(Cube, DarkStone, false, true), X, 0.35, Z, 1.5, 0.7, 0.72, Yaw); Box(Batch(Cube, Foliage, false, false), X, 0.78, Z, 1.3, 0.2, 0.55, Yaw); break;
		case 4: Cylinder(Batch(Cyl, HydrantRed, false, false), X, 0.4, Z, 0.4, 0.8); break;
		case 5:
		{
			const FVector2D Back = Turn(0, -0.7, Yaw);
			Box(Batch(Cube, Metal, false, true), X, 2.6, Z, 4.0, 0.12, 1.6, Yaw);
			Box(Batch(Cube, Hex(TEXT("2a3d4f")), false, true), X + Back.X, 1.3, Z + Back.Y, 3.8, 2.4, 0.08, Yaw);
			AddLightSpot(X, 2.4, Z, CoolWindow, 15.f, 500.f);
			break;
		}
		case 6:
		{
			Cylinder(Batch(Cyl, Metal, false, false), X, 2.6, Z, 0.2, 5.2);
			const FVector2D Arm = Turn(1.6, 0, Yaw);
			Box(Batch(Cube, Metal, false, false), X + Arm.X / 2, 5.1, Z + Arm.Y / 2, 3.2, 0.12, 0.12, Yaw);
			Box(Batch(Cube, Hex(TEXT("1a1a1a")), false, false), X + Arm.X, 4.7, Z + Arm.Y, 0.35, 0.9, 0.3, Yaw);
			break;
		}
		case 7: Cylinder(Batch(Cyl, Metal, false, false), X, 1.5, Z, 0.12, 3.0); Box(Batch(Cube, Hex(TEXT("1f6b45")), false, false), X, 2.85, Z, 1.4, 0.25, 0.04, Yaw); break;
		default: break;
		}
	}

	// ---- street lights (pole, arm over the carriageway, head) and corner lamps ----
	auto Lamp = [&](double X, double Z, double Yaw, double Height, double Reach) {
		Cylinder(Batch(Cyl, Metal, false, false), X, Height / 2, Z, 0.22, Height);
		const FVector2D Arm = Turn(0, Reach, Yaw);
		Box(Batch(Cube, Metal, false, false), X + Arm.X / 2, Height, Z + Arm.Y / 2, 0.12, 0.12, Reach, Yaw);
		Box(Batch(Cube, LampHead, true, false), X + Arm.X, Height - 0.12, Z + Arm.Y, 0.35, 0.12, 0.7, Yaw);
		AddLightSpot(X + Arm.X, Height - 0.4, Z + Arm.Y, LampHead, 90.f, 1400.f);
	};
	for (const FRow& L : Rows(City, TEXT("StreetLights"))) Lamp(L.N(0), L.N(1), L.N(2), 7.0, 2.2);
	for (const FRow& L : Rows(City, TEXT("CornerLamps"))) Lamp(L.N(0), L.N(1), L.N(2), 6.0, 1.2);

	// ---- parked cars (body runs along local z, as in the web build) ----
	for (const FRow& C : Rows(City, TEXT("Cars")))
	{
		const double X = C.N(0), Z = C.N(1), Yaw = C.N(2);
		const FLinearColor Paint = CarPaint[FMath::Clamp(C.I(3), 0, 5)];
		Box(Batch(Cube, Paint, false, true), X, 0.65, Z, 1.9, 0.9, 4.4, Yaw);
		Box(Batch(Cube, Paint * 0.6f, false, false), X, 1.35, Z, 1.7, 0.55, 2.2, Yaw);
		const FVector2D Tail = Turn(0, -2.21, Yaw);
		Box(Batch(Cube, Hex(TEXT("ff2a2a")), true, false), X + Tail.X, 0.8, Z + Tail.Y, 1.6, 0.12, 0.04, Yaw);
	}

	// ---- night signage: violet banners, holographic screens, cyan corner strips ----
	auto Panel = [&](const FRow& S, double Depth, float Light) {
		const double X = S.N(0), Y = S.N(1), Z = S.N(2), Yaw = S.N(3), W = S.N(4), H = S.N(5);
		const FLinearColor Color = Pick(SignColors, S.I(6), HubCyan);
		Box(Batch(Cube, Color, true, false), X, Y, Z, W, H, Depth, Yaw);
		const FVector2D Out = Turn(0, 1.6, Yaw);
		AddLightSpot(X + Out.X, Y, Z + Out.Y, Color, Light, 1600.f);
	};
	for (const FRow& S : Rows(City, TEXT("Banners"))) Panel(S, 0.15, 60.f);
	for (const FRow& S : Rows(City, TEXT("Screens"))) Panel(S, 0.2, 80.f);
	for (const FRow& S : Rows(City, TEXT("Strips")))
	{
		const double Y0 = S.N(2), Y1 = S.N(3);
		Box(Batch(Cube, Pick(SignColors, S.I(4), HubCyan), true, false), S.N(0), (Y0 + Y1) / 2, S.N(1), 0.14, FMath::Max(0.1, Y1 - Y0), 0.14);
	}

	for (UInstancedStaticMeshComponent* Ism : Batches) if (Ism && !Ism->IsRegistered()) Ism->RegisterComponent();

	// ---- the light pool that follows the player ----
#if PLATFORM_ANDROID || PLATFORM_IOS
	const int32 PoolSize = LightPoolMobile;
#else
	const int32 PoolSize = LightPoolDesktop;
#endif
	for (int32 I = 0; I < FMath::Min(PoolSize, LightSpots.Num()); ++I)
	{
		UPointLightComponent* L = NewObject<UPointLightComponent>(this);
		L->SetMobility(EComponentMobility::Movable);
		L->SetupAttachment(Root);
		L->SetCastShadows(false);
		L->SetIntensityUnits(ELightUnits::Candelas);
		L->SetVisibility(false);
		L->RegisterComponent();
		LightPool.Add(L);
	}
	UpdateLightPool();

	int32 Instances = 0;
	for (const UInstancedStaticMeshComponent* Ism : Batches) Instances += Ism ? Ism->GetInstanceCount() : 0;
	UE_LOG(LogTemp, Log, TEXT("Nexus City built: %d pieces in %d draws, %d light spots (%d pooled lights)."), Instances, Batches.Num(), LightSpots.Num(), LightPool.Num());
	bBuilt = true;
	return true;
}

void AWFNexusCity::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	PoolTimer -= DeltaSeconds;
	if (PoolTimer <= 0)
	{
		PoolTimer = 0.25;
		UpdateLightPool();
	}
}

void AWFNexusCity::UpdateLightPool()
{
	if (LightPool.IsEmpty() || LightSpots.IsEmpty()) return;
	FVector Eye = SpawnLocation;
	if (const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0)) Eye = Pawn->GetActorLocation();
	else return;
	// far from the city: switch the pool off
	if (FVector::DistSquared2D(Eye, HubCentre) > FMath::Square(150.0 * CityCmPerM))
	{
		for (UPointLightComponent* L : LightPool) if (L) L->SetVisibility(false);
		return;
	}
	TArray<TPair<double, int32>> Near;
	Near.Reserve(LightSpots.Num());
	for (int32 I = 0; I < LightSpots.Num(); ++I) Near.Add({FVector::DistSquared(Eye, LightSpots[I].At), I});
	const int32 Count = FMath::Min(LightPool.Num(), Near.Num());
	Near.Sort([](const TPair<double, int32>& A, const TPair<double, int32>& B) { return A.Key < B.Key; }); // ~600 spots, 4 times a second
	for (int32 I = 0; I < LightPool.Num(); ++I)
	{
		UPointLightComponent* L = LightPool[I];
		if (!L) continue;
		if (I >= Count) { L->SetVisibility(false); continue; }
		const FLightSpot& Spot = LightSpots[Near[I].Value];
		L->SetWorldLocation(Spot.At);
		L->SetLightColor(Spot.Color);
		L->SetIntensity(Spot.Intensity);
		L->SetAttenuationRadius(Spot.Radius);
		L->SetVisibility(true);
	}
}

void AWFNexusCity::ApplyNightLook()
{
	UWorld* World = GetWorld();
	if (!World) return;
	for (TActorIterator<ADirectionalLight> It(World); It; ++It)
		if (UDirectionalLightComponent* Sun = Cast<UDirectionalLightComponent>(It->GetLightComponent()))
		{
			// moonlight: low, cool, from high up so the towers still read against the sky (a level's own sun may be
			// stationary, which can't turn at run time)
			Sun->SetMobility(EComponentMobility::Movable);
			Sun->SetIntensity(0.35f);
			Sun->SetLightColor(FLinearColor(0.55f, 0.65f, 1.f));
			It->SetActorRotation(FRotator(-55.f, 120.f, 0.f));
		}
	for (TActorIterator<ASkyLight> It(World); It; ++It)
		if (USkyLightComponent* Sky = It->GetLightComponent())
		{
			Sky->SetIntensity(0.25f);
			Sky->SetLightColor(FLinearColor(0.55f, 0.5f, 0.85f)); // violet night bounce
		}
	AExponentialHeightFog* Fog = nullptr;
	for (TActorIterator<AExponentialHeightFog> It(World); It; ++It) { Fog = *It; break; }
	if (!Fog) Fog = World->SpawnActor<AExponentialHeightFog>(FVector(HubCentre.X, HubCentre.Y, 0), FRotator::ZeroRotator);
	if (Fog && Fog->GetComponent())
	{
		UExponentialHeightFogComponent* F = Fog->GetComponent();
		F->SetFogDensity(0.035f); // street-level haze the neon blooms into; the violet comes from the sky light above
		F->SetFogHeightFalloff(0.08f);
	}
}
