#include "WFTerrain.h"

#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/Compression.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "ProceduralMeshComponent.h"
#include "WFAssets.h"
#include "WFDataFiles.h"

namespace
{
	constexpr double TerrainCmPerM = 100.0;

	int64 TileKey(int32 TX, int32 TZ) { return (static_cast<int64>(TX) << 32) | static_cast<int64>(static_cast<uint32>(TZ)); }

	FLinearColor TerrainHex(const FString& Code)
	{
		return FLinearColor::FromSRGBColor(FColor::FromHex(Code.Replace(TEXT("#"), TEXT(""))));
	}

	const FLinearColor Rock = FLinearColor::FromSRGBColor(FColor(88, 86, 82));
	const FLinearColor Sand = FLinearColor::FromSRGBColor(FColor(176, 158, 118));
	const FLinearColor Snow = FLinearColor::FromSRGBColor(FColor(228, 234, 240));
	const FLinearColor Wilds = FLinearColor::FromSRGBColor(FColor(74, 86, 60));
	const FLinearColor SeaColor = FLinearColor::FromSRGBColor(FColor(18, 42, 56));
}

AWFTerrain::AWFTerrain()
{
	PrimaryActorTick.bCanEverTick = true;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	Sea = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Sea"));
	Sea->SetupAttachment(Root);
	Sea->SetCollisionEnabled(ECollisionEnabled::NoCollision); // vehicles float by the water level (AWFVehicle), not a surface
	Sea->SetCastShadow(false);
}

bool AWFTerrain::Load()
{
	if (N > 0) return true;
	const FString Path = FPaths::Combine(FPaths::ProjectDir(), TEXT("DataTables"), TEXT("Terrain.bin"));
	TArray<uint8> Bytes;
	if (!FFileHelper::LoadFileToArray(Bytes, *Path) || Bytes.Num() < 32 || FMemory::Memcmp(Bytes.GetData(), "WFT1", 4) != 0)
	{
		UE_LOG(LogTemp, Error, TEXT("Terrain: could not read %s (run unreal/tools/export-terrain.ts)."), *Path);
		return false;
	}
	int32 Count = 0, Packed = 0;
	float Header[5] = {};
	FMemory::Memcpy(&Count, Bytes.GetData() + 4, 4);
	FMemory::Memcpy(Header, Bytes.GetData() + 8, 20);
	FMemory::Memcpy(&Packed, Bytes.GetData() + 28, 4);
	if (Count < 2 || Packed <= 0 || 32 + Packed > Bytes.Num()) { UE_LOG(LogTemp, Error, TEXT("Terrain: %s is damaged."), *Path); return false; }
	Heights.SetNumUninitialized(Count * Count);
	if (!FCompression::UncompressMemory(NAME_Zlib, Heights.GetData(), Count * Count * static_cast<int32>(sizeof(uint16)), Bytes.GetData() + 32, Packed))
	{
		UE_LOG(LogTemp, Error, TEXT("Terrain: %s did not decompress."), *Path);
		Heights.Reset();
		return false;
	}
	N = Count;
	Cell = Header[0];
	Origin = Header[1];
	WaterLevel = Header[2];
	HMin = Header[3];
	HStep = Header[4];

	// region ground colours (regions.ts ground) for the vertex tint
	FString Error;
	TArray<TSharedPtr<FJsonObject>> Rows;
	if (WFData::LoadRows(TEXT("Regions"), Rows, Error))
		for (const TSharedPtr<FJsonObject>& R : Rows)
			Regions.Add({WFData::Num(R, TEXT("X")), WFData::Num(R, TEXT("Z")), WFData::Num(R, TEXT("Radius")), TerrainHex(WFData::Str(R, TEXT("Ground")))});

	BasicMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	if (!TerrainMaterial) TerrainMaterial = WFAssets::Material(TEXT("M_WF_Terrain"));
	if (!WaterMaterial) WaterMaterial = WFAssets::Material(TEXT("M_WF_Water"));
	// the sea: one slab over the whole map, its top at the water level
	if (UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube")))
	{
		const double Span = (N - 1) * Cell + 2000;
		const double Mid = Origin + (N - 1) * Cell / 2;
		Sea->SetStaticMesh(Cube);
		Sea->SetWorldLocationAndRotation(FVector(Mid, Mid, WaterLevel - 0.5) * TerrainCmPerM, FRotator::ZeroRotator);
		Sea->SetWorldScale3D(FVector(Span, Span, 1.0));
		UMaterialInterface* Base = WaterMaterial ? WaterMaterial.Get() : BasicMaterial.Get();
		if (Base)
		{
			UMaterialInstanceDynamic* Paint = UMaterialInstanceDynamic::Create(Base, this);
			Paint->SetVectorParameterValue(TEXT("Color"), SeaColor);
			Sea->SetMaterial(0, Paint);
		}
	}
	UE_LOG(LogTemp, Log, TEXT("Terrain: %dx%d samples every %.0f m, water at %.1f m."), N, N, Cell, WaterLevel);
	return true;
}

double AWFTerrain::Sample(int32 IX, int32 IZ) const
{
	IX = FMath::Clamp(IX, 0, N - 1);
	IZ = FMath::Clamp(IZ, 0, N - 1);
	return HMin + Heights[IZ * N + IX] * HStep;
}

double AWFTerrain::HeightAt(double X, double Z) const
{
	if (N <= 0) return 0;
	const double FX = (X - Origin) / Cell, FZ = (Z - Origin) / Cell;
	const int32 IX = FMath::FloorToInt32(FX), IZ = FMath::FloorToInt32(FZ);
	const double TX = FX - IX, TZ = FZ - IZ;
	const double H0 = FMath::Lerp(Sample(IX, IZ), Sample(IX + 1, IZ), TX);
	const double H1 = FMath::Lerp(Sample(IX, IZ + 1), Sample(IX + 1, IZ + 1), TX);
	double H = FMath::Lerp(H0, H1, TZ);
	if (bPad)
	{
		const double D = FMath::Sqrt(FMath::Square(X - PadX) + FMath::Square(Z - PadZ));
		const double W = 1.0 - FMath::SmoothStep(PadInner, PadOuter, D);
		H = FMath::Lerp(H, PadH, W);
	}
	return H;
}

void AWFTerrain::SetFlatPad(double X, double Z, double Height, double Inner, double Outer)
{
	bPad = true;
	PadX = X; PadZ = Z; PadH = Height; PadInner = Inner; PadOuter = FMath::Max(Outer, Inner + 1);
	// tiles already built under the pad were built without it
	TArray<int64> Keys;
	Tiles.GetKeys(Keys);
	for (const int64 Key : Keys)
		if (UProceduralMeshComponent* Tile = Tiles[Key]) Tile->DestroyComponent();
	Tiles.Reset();
}

FLinearColor AWFTerrain::GroundColor(double X, double Z, double H, double Slope) const
{
	// the regions' ground colours, each fading out over 150 m past its edge, over the wilds' olive
	FLinearColor Sum = Wilds * 0.15f;
	float Weight = 0.15f;
	for (const FRegionTint& R : Regions)
	{
		const double Out = FMath::Max(0.0, FMath::Sqrt(FMath::Square(X - R.X) + FMath::Square(Z - R.Z)) - R.Radius);
		const float W = static_cast<float>(FMath::Exp(-Out / 150.0));
		Sum += R.Color * W;
		Weight += W;
	}
	FLinearColor C = Sum / Weight;
	C = FLinearColor::LerpUsingHSV(C, Sand, static_cast<float>(1.0 - FMath::SmoothStep(WaterLevel + 0.4, WaterLevel + 2.5, H)));
	C = FMath::Lerp(C, Rock, static_cast<float>(FMath::SmoothStep(0.55, 0.95, Slope)));
	C = FMath::Lerp(C, Snow, static_cast<float>(FMath::SmoothStep(135.0, 175.0, H) * (1.0 - FMath::SmoothStep(0.7, 1.1, Slope))));
	C.A = 1.f;
	return C;
}

void AWFTerrain::BuildTile(int32 TX, int32 TZ)
{
	const int64 Key = TileKey(TX, TZ);
	if (Tiles.Contains(Key) || N <= 0) return;
	const int32 X0 = TX * TileCells, Z0 = TZ * TileCells;
	if (X0 >= N - 1 || Z0 >= N - 1 || X0 < 0 || Z0 < 0) return;
	const int32 CX = FMath::Min(TileCells, N - 1 - X0), CZ = FMath::Min(TileCells, N - 1 - Z0);

	TArray<FVector> Verts;
	TArray<int32> Tris;
	TArray<FVector> Normals;
	TArray<FVector2D> UV;
	TArray<FLinearColor> Colors;
	const int32 Row = CX + 1;
	Verts.Reserve(Row * (CZ + 1));
	for (int32 Z = 0; Z <= CZ; ++Z)
		for (int32 X = 0; X <= CX; ++X)
		{
			const double WX = Origin + (X0 + X) * Cell, WZ = Origin + (Z0 + Z) * Cell;
			const double H = HeightAt(WX, WZ);
			const double DX = (HeightAt(WX + Cell, WZ) - HeightAt(WX - Cell, WZ)) / (2 * Cell);
			const double DZ = (HeightAt(WX, WZ + Cell) - HeightAt(WX, WZ - Cell)) / (2 * Cell);
			Verts.Add(FVector(WX, WZ, H) * TerrainCmPerM);
			Normals.Add(FVector(-DX, -DZ, 1.0).GetSafeNormal());
			UV.Add(FVector2D(WX / 8.0, WZ / 8.0));
			Colors.Add(GroundColor(WX, WZ, H, FMath::Sqrt(DX * DX + DZ * DZ)));
		}
	// two triangles a cell, wound clockwise seen from above (Unreal's front face); flip with bFlipWinding if a build shows
	// the ground from below
	Tris.Reserve(CX * CZ * 6);
	for (int32 Z = 0; Z < CZ; ++Z)
		for (int32 X = 0; X < CX; ++X)
		{
			const int32 A = Z * Row + X, B = A + 1, C = A + Row, D = C + 1;
			if (bFlipWinding) { Tris.Append({A, C, B, B, C, D}); }
			else { Tris.Append({A, B, C, B, D, C}); }
		}

	UProceduralMeshComponent* Tile = NewObject<UProceduralMeshComponent>(this);
	Tile->bUseAsyncCooking = true;
	Tile->bUseComplexAsSimpleCollision = true;
	Tile->SetupAttachment(Root);
	Tile->SetCollisionProfileName(TEXT("BlockAll"));
	Tile->CreateMeshSection_LinearColor(0, Verts, Tris, Normals, UV, Colors, TArray<FProcMeshTangent>(), true);
	if (TerrainMaterial) Tile->SetMaterial(0, TerrainMaterial);
	else if (BasicMaterial)
	{
		UMaterialInstanceDynamic* Paint = UMaterialInstanceDynamic::Create(BasicMaterial, this);
		Paint->SetVectorParameterValue(TEXT("Color"), Colors[Colors.Num() / 2]);
		Tile->SetMaterial(0, Paint);
	}
	Tile->RegisterComponent();
	Tiles.Add(Key, Tile);
}

void AWFTerrain::Stream(const FVector& AtCm, double Radius, int32 Budget)
{
	if (N <= 0) return;
	const double TileM = TileCells * Cell;
	const double PX = AtCm.X / TerrainCmPerM, PZ = AtCm.Y / TerrainCmPerM;
	const int32 Tiles1D = FMath::DivideAndRoundUp(N - 1, TileCells);
	// the tiles wanted, nearest first
	TArray<TPair<double, FIntPoint>> Want;
	for (int32 TZ = 0; TZ < Tiles1D; ++TZ)
		for (int32 TX = 0; TX < Tiles1D; ++TX)
		{
			const double CX = Origin + (TX + 0.5) * TileM, CZ = Origin + (TZ + 0.5) * TileM;
			const double D = FMath::Sqrt(FMath::Square(CX - PX) + FMath::Square(CZ - PZ)) - TileM * 0.71;
			if (D < Radius && !Tiles.Contains(TileKey(TX, TZ))) Want.Add({D, FIntPoint(TX, TZ)});
		}
	Want.Sort([](const TPair<double, FIntPoint>& A, const TPair<double, FIntPoint>& B) { return A.Key < B.Key; });
	for (int32 I = 0; I < Want.Num() && I < Budget; ++I) BuildTile(Want[I].Value.X, Want[I].Value.Y);

	// drop tiles well past the radius
	TArray<int64> Drop;
	for (const TPair<int64, TObjectPtr<UProceduralMeshComponent>>& T : Tiles)
	{
		const int32 TX = static_cast<int32>(T.Key >> 32), TZ = static_cast<int32>(T.Key & 0xffffffff);
		const double CX = Origin + (TX + 0.5) * TileM, CZ = Origin + (TZ + 0.5) * TileM;
		if (FMath::Sqrt(FMath::Square(CX - PX) + FMath::Square(CZ - PZ)) - TileM * 0.71 > Radius + TileM) Drop.Add(T.Key);
	}
	for (const int64 Key : Drop)
	{
		if (UProceduralMeshComponent* Tile = Tiles[Key]) Tile->DestroyComponent();
		Tiles.Remove(Key);
	}
}

void AWFTerrain::BuildAround(const FVector& AtCm, double Radius)
{
	Stream(AtCm, Radius, 1000);
}

void AWFTerrain::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	StreamTimer -= DeltaSeconds;
	if (StreamTimer > 0 || N <= 0) return;
	StreamTimer = 0.4;
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Pawn) return;
#if PLATFORM_ANDROID || PLATFORM_IOS
	const double Radius = StreamRadiusMobile;
#else
	const double Radius = StreamRadiusDesktop;
#endif
	Stream(Pawn->GetActorLocation(), Radius, 3); // a few tiles at a time, so driving fast never hitches on a burst
}
