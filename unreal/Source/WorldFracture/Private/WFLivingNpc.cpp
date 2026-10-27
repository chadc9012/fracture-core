#include "WFLivingNpc.h"

#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Camera/PlayerCameraManager.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"

AWFLivingNpc::AWFLivingNpc()
{
	PrimaryActorTick.bCanEverTick = true;
	// the root stands on the ground; the body, head and plate are unscaled siblings of it
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
	Body->SetupAttachment(Root);
	Head = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Head"));
	Head->SetupAttachment(Root);
	Plate = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Plate"));
	Plate->SetupAttachment(Root);
	Body->SetCollisionProfileName(TEXT("BlockAllDynamic"));
	Body->SetCollisionResponseToChannel(ECC_Visibility, ECR_Ignore); // ground traces pass through people (they stood on their own heads)
	Head->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Body->SetRelativeScale3D(FVector(0.5, 0.5, 1.6)); // the engine cylinder is 1 m across and tall, centred: a 1.6 m body
	Body->SetRelativeLocation(FVector(0, 0, 80));
	Head->SetRelativeLocation(FVector(0, 0, 175));
	Head->SetRelativeScale3D(FVector(0.3, 0.3, 0.3));
	Plate->SetRelativeLocation(FVector(0, 0, 215));
	Plate->SetHorizontalAlignment(EHTA_Center);
	Plate->SetWorldSize(22.f);
}

void AWFLivingNpc::Setup(const FString& InId, const FString& Name, const FString& Title, const FLinearColor& Color)
{
	NpcId = InId;
	if (UStaticMesh* Cylinder = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"))) Body->SetStaticMesh(Cylinder);
	if (UStaticMesh* Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"))) Head->SetStaticMesh(Sphere);
	if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")))
	{
		UMaterialInstanceDynamic* Paint = UMaterialInstanceDynamic::Create(Base, this);
		Paint->SetVectorParameterValue(TEXT("Color"), Color);
		Body->SetMaterial(0, Paint);
		Head->SetMaterial(0, Paint);
	}
	Plate->SetText(FText::FromString(FString::Printf(TEXT("%s\n%s"), *Name, *Title)));
	Plate->SetTextRenderColor(Color.ToFColor(true));
}

void AWFLivingNpc::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	// walk toward the post or the rest spot at an easy pace; the plate faces the camera
	if (bHasGoal)
	{
		const FVector At = GetActorLocation();
		const FVector To = GoalCm - At;
		const double Step = 140.0 * DeltaSeconds;
		SetActorLocation(To.Size() <= Step ? GoalCm : At + To.GetSafeNormal() * Step);
	}
	if (const APlayerCameraManager* Cam = UGameplayStatics::GetPlayerCameraManager(this, 0))
		Plate->SetWorldRotation(FRotator(0.f, static_cast<float>((Cam->GetCameraLocation() - Plate->GetComponentLocation()).Rotation().Yaw), 0.f));
}
