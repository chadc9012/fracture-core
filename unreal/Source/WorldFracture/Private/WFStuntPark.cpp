#include "WFStuntPark.h"

#include "Components/InstancedStaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"

namespace
{
	constexpr double SpCmPerM = 100.0;
	constexpr double SpThick = 0.6; // m: the steel plate under a ramp face
	/** BasicShapes cube is 100 cm a side */
	constexpr double SpCube = 100.0;

	UInstancedStaticMeshComponent* SpBatch(AActor* Owner, USceneComponent* Root, const FLinearColor& Color, bool bCollide)
	{
		UInstancedStaticMeshComponent* Ism = NewObject<UInstancedStaticMeshComponent>(Owner);
		Ism->SetupAttachment(Root);
		if (UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"))) Ism->SetStaticMesh(Cube);
		if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")))
		{
			UMaterialInstanceDynamic* Paint = UMaterialInstanceDynamic::Create(Base, Owner);
			Paint->SetVectorParameterValue(TEXT("Color"), Color);
			Ism->SetMaterial(0, Paint);
		}
		// Movable: a run-time static primitive gets no built lighting (as AWFNexusCity's batches)
		Ism->SetMobility(EComponentMobility::Movable);
		Ism->SetCollisionEnabled(bCollide ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
		if (bCollide) Ism->SetCollisionProfileName(TEXT("BlockAll"));
		Ism->RegisterComponent();
		return Ism;
	}
}

AWFStuntPark::AWFStuntPark()
{
	PrimaryActorTick.bCanEverTick = false;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent->SetMobility(EComponentMobility::Movable);
}

void AWFStuntPark::Slab(const FVector& Origin, const FRotator& Facing, double A0, double H0, double A1, double H1, double Width)
{
	if (!Steel) Steel = SpBatch(this, RootComponent, FLinearColor(0.32f, 0.3f, 0.27f), true);
	const double Run = A1 - A0, Rise = H1 - H0, Len = FMath::Sqrt(Run * Run + Rise * Rise);
	if (Len < 0.01) return;
	const double Pitch = FMath::RadiansToDegrees(FMath::Atan2(Rise, Run));
	// the top face's middle, then half the plate down along the face's normal (-sin, cos) in (along, up)
	const double MidA = (A0 + A1) / 2, MidH = (H0 + H1) / 2, Sn = Rise / Len, Cs = Run / Len;
	const FVector Local((MidA + Sn * SpThick / 2) * SpCmPerM, 0, (MidH - Cs * SpThick / 2) * SpCmPerM);
	const FVector At = Origin + Facing.RotateVector(Local);
	const FRotator Rot = FRotator(static_cast<float>(Pitch), Facing.Yaw, 0.f);
	Steel->AddInstance(FTransform(Rot, At, FVector(Len * SpCmPerM / SpCube, Width * SpCmPerM / SpCube, SpThick * SpCmPerM / SpCube)), true);
}

void AWFStuntPark::AddRamp(const FVector& GroundCentreCm, double YawDeg, double Length, double Ramp, double Width, double Height, const FString& Label)
{
	// stunt-park.ts rampDeck: the base sits 0.15 m into the ground; rampProfile: up the ramp, the flat top (if any), down to base
	const FVector Base = GroundCentreCm - FVector(0, 0, 0.15 * SpCmPerM);
	const FRotator Facing(0.f, static_cast<float>(YawDeg), 0.f);
	const double H = Length / 2;
	Slab(Base, Facing, -H, 0, -H + Ramp, Height, Width);
	if (H - Ramp > -H + Ramp + 0.01)
	{
		Slab(Base, Facing, -H + Ramp, Height, H - Ramp, Height, Width);
		// the deck under the top is solid: a block from the base to just under the plate
		const double TopLen = Length - 2 * Ramp, Fill = Height - SpThick;
		if (Fill > 0.05)
			Steel->AddInstance(FTransform(Facing, Base + FVector(0, 0, Fill / 2 * SpCmPerM), FVector(TopLen * SpCmPerM / SpCube, Width * SpCmPerM / SpCube, Fill * SpCmPerM / SpCube)), true);
	}
	Slab(Base, Facing, H - Ramp, Height, H, 0, Width);
	UTextRenderComponent* Sign = NewObject<UTextRenderComponent>(this);
	Sign->SetupAttachment(RootComponent);
	Sign->SetMobility(EComponentMobility::Movable);
	Sign->SetText(FText::FromString(Label));
	Sign->SetHorizontalAlignment(EHTA_Center);
	Sign->SetWorldSize(140.f);
	Sign->SetTextRenderColor(FColor(255, 190, 60));
	Sign->RegisterComponent();
	Sign->SetWorldLocationAndRotation(Base + Facing.RotateVector(FVector(-H * SpCmPerM, 0, (Height + 2.5) * SpCmPerM)), FRotator(0.f, static_cast<float>(YawDeg) + 180.f, 0.f));
}

void AWFStuntPark::AddFence(const FVector& CentreCm, double YawDeg, double Length, double Width, const TFunctionRef<double(double, double)>& Ground)
{
	if (!Posts) Posts = SpBatch(this, RootComponent, FLinearColor(0.45f, 0.33f, 0.2f), false); // posts only: the run-ups stay open
	const FRotator Facing(0.f, static_cast<float>(YawDeg), 0.f);
	auto Post = [&](double Along, double Across) {
		const FVector P = CentreCm + Facing.RotateVector(FVector(Along * SpCmPerM, Across * SpCmPerM, 0));
		const double Z = Ground(P.X, P.Y);
		Posts->AddInstance(FTransform(Facing, FVector(P.X, P.Y, Z + 60.0), FVector(0.18, 0.18, 1.2)), true);
	};
	for (double A = -Length / 2; A <= Length / 2 + 0.01; A += 10) { Post(A, -Width / 2); Post(A, Width / 2); }
	for (double C = -Width / 2 + 10; C < Width / 2 - 0.01; C += 10) { Post(-Length / 2, C); Post(Length / 2, C); }
}
