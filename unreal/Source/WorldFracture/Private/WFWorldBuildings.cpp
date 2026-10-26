#include "WFWorldBuildings.h"

#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/FileHelper.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WFAssets.h"
#include "WFDataFiles.h"
#include "WFTerrain.h"

namespace
{
	constexpr double BuildCmPerM = 100.0;

	TSharedPtr<FJsonObject> LoadBuildings()
	{
		static TSharedPtr<FJsonObject> Cached;
		if (Cached.IsValid()) return Cached;
		FString Text;
		TSharedPtr<FJsonObject> Obj;
		if (FFileHelper::LoadFileToString(Text, *WFData::TablePath(TEXT("WorldBuildings"))) && FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Obj) && Obj.IsValid())
			Cached = Obj;
		return Cached;
	}

	double Num(const TArray<TSharedPtr<FJsonValue>>& Row, int32 Index)
	{
		return Row.IsValidIndex(Index) && Row[Index].IsValid() ? Row[Index]->AsNumber() : 0.0;
	}
}

AWFWorldBuildings::AWFWorldBuildings()
{
	PrimaryActorTick.bCanEverTick = true;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
}

FString AWFWorldBuildings::FleetModelFor(const FString& VehicleId, const FString& BuildId)
{
	const TSharedPtr<FJsonObject> Data = LoadBuildings();
	const TSharedPtr<FJsonObject>* Models = nullptr;
	if (!Data.IsValid() || !Data->TryGetObjectField(TEXT("FleetModels"), Models)) return FString();
	const TSharedPtr<FJsonObject>* ByBuild = nullptr;
	const TSharedPtr<FJsonObject>* ByBase = nullptr;
	FString Out;
	if (!BuildId.IsEmpty() && (*Models)->TryGetObjectField(TEXT("Build"), ByBuild) && (*ByBuild)->TryGetStringField(BuildId, Out)) return Out;
	if ((*Models)->TryGetObjectField(TEXT("Base"), ByBase) && (*ByBase)->TryGetStringField(VehicleId, Out)) return Out;
	return FString();
}

UInstancedStaticMeshComponent* AWFWorldBuildings::Batch(const FLinearColor& Color, int32 Mat, bool bModel, UStaticMesh* Model)
{
	const FString Key = bModel && Model ? FString::Printf(TEXT("model|%s"), *Model->GetPathName()) : FString::Printf(TEXT("%s|%d"), *Color.ToString(), Mat);
	if (UInstancedStaticMeshComponent** Found = BatchByKey.Find(Key)) return *Found;
	UInstancedStaticMeshComponent* Ism = NewObject<UInstancedStaticMeshComponent>(this);
	Ism->SetMobility(EComponentMobility::Movable);
	Ism->SetupAttachment(Root);
	Ism->SetStaticMesh(bModel && Model ? Model : CubeMesh.Get());
	const bool bLamp = Mat == 2;
	Ism->SetCollisionEnabled(bLamp ? ECollisionEnabled::NoCollision : ECollisionEnabled::QueryAndPhysics);
	if (!bLamp) Ism->SetCollisionProfileName(TEXT("BlockAll"));
	Ism->SetCastShadow(!bLamp);
	if (!bModel)
	{
		UMaterialInterface* Base = Mat == 2 ? LampMaterial.Get() : Mat == 1 ? GlassMaterial.Get() : SolidMaterial.Get();
		if (Base)
		{
			UMaterialInstanceDynamic* Paint = UMaterialInstanceDynamic::Create(Base, this);
			Paint->SetVectorParameterValue(TEXT("Color"), Color);
			Ism->SetMaterial(0, Paint);
		}
	}
	Batches.Add(Ism); // registered once filled, at the end of Build
	BatchByKey.Add(Key, Ism);
	return Ism;
}

bool AWFWorldBuildings::Build(const AWFTerrain* Ground)
{
	const TSharedPtr<FJsonObject> Data = LoadBuildings();
	CubeMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	UMaterialInterface* Basic = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	SolidMaterial = WFAssets::Material(TEXT("M_WF_Surface"));
	if (!SolidMaterial) SolidMaterial = Basic;
	GlassMaterial = WFAssets::Material(TEXT("M_WF_Glass"));
	if (!GlassMaterial) GlassMaterial = SolidMaterial;
	LampMaterial = WFAssets::Material(TEXT("M_WF_Neon"));
	if (!LampMaterial) LampMaterial = SolidMaterial;
	if (!Data.IsValid() || !CubeMesh)
	{
		UE_LOG(LogTemp, Error, TEXT("World buildings: DataTables/WorldBuildings.json missing or unreadable (run unreal/tools/export-world-buildings.ts)."));
		return false;
	}

	TArray<FLinearColor> Palette;
	const TArray<TSharedPtr<FJsonValue>>* PaletteJson = nullptr;
	if (Data->TryGetArrayField(TEXT("Palette"), PaletteJson))
		for (const TSharedPtr<FJsonValue>& C : *PaletteJson)
			if (C.IsValid()) Palette.Add(FLinearColor::FromSRGBColor(FColor::FromHex(C->AsString().Replace(TEXT("#"), TEXT("")))));
	auto ColorAt = [&Palette](int32 Index) { return Palette.IsValidIndex(Index) ? Palette[Index] : FLinearColor::Gray; };
	// the web build's ground at a point -> this world's ground there
	auto Shift = [Ground](double X, double Z, double WebGround) { return Ground ? Ground->HeightAt(X, Z) - WebGround : -WebGround; };

	const TArray<TSharedPtr<FJsonValue>>* Groups = nullptr;
	if (Data->TryGetArrayField(TEXT("Groups"), Groups))
		for (const TSharedPtr<FJsonValue>& GroupValue : *Groups)
		{
			const TSharedPtr<FJsonObject> G = GroupValue.IsValid() ? GroupValue->AsObject() : nullptr;
			if (!G.IsValid()) continue;
			const double GX = G->GetNumberField(TEXT("X")), GZ = G->GetNumberField(TEXT("Z"));
			const double Dz = Shift(GX, GZ, G->GetNumberField(TEXT("WebGround")));

			// an imported Neon tower replaces its massing, strips and lit floors
			FString Variant;
			if (G->TryGetStringField(TEXT("Variant"), Variant))
				if (UStaticMesh* Model = WFAssets::Mesh(TEXT("Buildings"), FString::Printf(TEXT("neon-v-%s"), *Variant)))
				{
					const double Floor = G->GetNumberField(TEXT("Floor")) + Dz;
					const double Yaw = G->GetNumberField(TEXT("Yaw"));
					const FTransform Xf(FRotator(0.f, static_cast<float>(-FMath::RadiansToDegrees(Yaw)) + ImportedModelYawDeg, 0.f), FVector(GX, GZ, Floor) * BuildCmPerM);
					Batch(FLinearColor::White, 0, true, Model)->AddInstance(Xf, true);
					continue;
				}

			const TArray<TSharedPtr<FJsonValue>>* Boxes = nullptr;
			if (!G->TryGetArrayField(TEXT("Boxes"), Boxes)) continue;
			for (const TSharedPtr<FJsonValue>& BoxValue : *Boxes)
			{
				const TArray<TSharedPtr<FJsonValue>>* B = nullptr;
				if (!BoxValue.IsValid() || !BoxValue->TryGetArray(B)) continue;
				const TArray<TSharedPtr<FJsonValue>>& R = *B;
				const FVector At(Num(R, 0), Num(R, 1), Num(R, 2) + Dz);
				FQuat Turn(Num(R, 3), Num(R, 4), Num(R, 5), Num(R, 6));
				Turn.Normalize(); // the export rounds to 3 decimals
				FVector Size(Num(R, 7), Num(R, 8), Num(R, 9));
				const int32 Mat = static_cast<int32>(Num(R, 11));
				const bool bPrism = Num(R, 12) > 0.5;
				if (bPrism) Size.Z *= 0.55; // a gable roof: a low cap until the roof mesh exists
				if (Size.X <= 0 || Size.Y <= 0 || Size.Z <= 0) continue;
				const FLinearColor Color = ColorAt(static_cast<int32>(Num(R, 10)));
				Batch(Color, Mat)->AddInstance(FTransform(Turn, At * BuildCmPerM, Size), true);
				if (Mat == 2 && Size.GetMax() > 0.5) LightSpots.Add({At * BuildCmPerM, Color, 35.f, 900.f});
			}
		}

	// Neon City's street lights: pole, arm over the street, a head in the street's glow
	const TArray<TSharedPtr<FJsonValue>>* Lights = nullptr;
	if (Data->TryGetArrayField(TEXT("NeonStreetLights"), Lights))
		for (const TSharedPtr<FJsonValue>& LightValue : *Lights)
		{
			const TArray<TSharedPtr<FJsonValue>>* L = nullptr;
			if (!LightValue.IsValid() || !LightValue->TryGetArray(L)) continue;
			const double X = Num(*L, 0), Z = Num(*L, 1), Yaw = Num(*L, 2);
			const double Base = Num(*L, 4) + Shift(X, Z, Num(*L, 4));
			const FLinearColor Glow = ColorAt(static_cast<int32>(Num(*L, 3)));
			const FVector2D Arm(FMath::Sin(Yaw) * 1.8, FMath::Cos(Yaw) * 1.8); // the web build's yaw points along (sin, cos) on (x, z)
			Batch(FLinearColor(0.18f, 0.19f, 0.21f), 0)->AddInstance(FTransform(FQuat::Identity, FVector(X, Z, Base + 3.5) * BuildCmPerM, FVector(0.2, 0.2, 7.0)), true);
			const FVector Head(X + Arm.X, Z + Arm.Y, Base + 6.9);
			Batch(Glow, 2)->AddInstance(FTransform(FQuat::Identity, Head * BuildCmPerM, FVector(0.6, 0.6, 0.15)), true);
			LightSpots.Add({Head * BuildCmPerM, Glow, 70.f, 1300.f});
		}

	for (UInstancedStaticMeshComponent* Ism : Batches) if (Ism && !Ism->IsRegistered()) Ism->RegisterComponent();

#if PLATFORM_ANDROID || PLATFORM_IOS
	const int32 PoolSize = LightPoolMobile;
#else
	const int32 PoolSize = LightPoolDesktop;
#endif
	for (int32 I = 0; I < FMath::Min(PoolSize, LightSpots.Num()); ++I)
	{
		UPointLightComponent* Light = NewObject<UPointLightComponent>(this);
		Light->SetMobility(EComponentMobility::Movable);
		Light->SetupAttachment(Root);
		Light->SetCastShadows(false);
		Light->SetIntensityUnits(ELightUnits::Candelas);
		Light->SetVisibility(false);
		Light->RegisterComponent();
		LightPool.Add(Light);
	}
	int32 Instances = 0;
	for (const UInstancedStaticMeshComponent* Ism : Batches) Instances += Ism ? Ism->GetInstanceCount() : 0;
	UE_LOG(LogTemp, Log, TEXT("World buildings: %d pieces in %d draws, %d light spots."), Instances, Batches.Num(), LightSpots.Num());
	return true;
}

void AWFWorldBuildings::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	PoolTimer -= DeltaSeconds;
	if (PoolTimer > 0) return;
	PoolTimer = 0.3;
	UpdateLightPool();
}

void AWFWorldBuildings::UpdateLightPool()
{
	const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
	if (!Pawn || LightPool.IsEmpty()) return;
	const FVector Eye = Pawn->GetActorLocation();
	TArray<TPair<double, int32>> Near;
	for (int32 I = 0; I < LightSpots.Num(); ++I)
	{
		const double D = FVector::DistSquared(Eye, LightSpots[I].At);
		if (D < FMath::Square(250.0 * BuildCmPerM)) Near.Add({D, I});
	}
	Near.Sort([](const TPair<double, int32>& A, const TPair<double, int32>& B) { return A.Key < B.Key; });
	for (int32 I = 0; I < LightPool.Num(); ++I)
	{
		UPointLightComponent* Light = LightPool[I];
		if (!Light) continue;
		if (!Near.IsValidIndex(I)) { Light->SetVisibility(false); continue; }
		const FLightSpot& Spot = LightSpots[Near[I].Value];
		Light->SetWorldLocation(Spot.At);
		Light->SetLightColor(Spot.Color);
		Light->SetIntensity(Spot.Intensity);
		Light->SetAttenuationRadius(Spot.Radius);
		Light->SetVisibility(true);
	}
}
