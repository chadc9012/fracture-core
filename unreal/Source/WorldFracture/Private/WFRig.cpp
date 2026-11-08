#include "WFRig.h"

#include "Animation/AnimSequence.h"
#include "Engine/SkeletalMesh.h"
#include "GameFramework/Actor.h"
#include "ReferenceSkeleton.h"

namespace
{
	template <typename T>
	T* TryLoad(const FString& Path) { return LoadObject<T>(nullptr, *Path, nullptr, LOAD_NoWarn | LOAD_Quiet); }

	/** the yaw (degrees) that turns the rig's walking direction (heel to toe) onto +X; NaN when it has no foot bones */
	float FacingYaw(const USkeletalMesh* Mesh)
	{
		const FReferenceSkeleton& Ref = Mesh->GetRefSkeleton();
		const TArray<FTransform>& Local = Ref.GetRefBonePose();
		TArray<FTransform> Cs;
		Cs.SetNum(Local.Num());
		for (int32 I = 0; I < Local.Num(); ++I)
		{
			const int32 Parent = Ref.GetParentIndex(I);
			Cs[I] = Parent == INDEX_NONE ? Local[I] : Local[I] * Cs[Parent];
		}
		FVector Forward = FVector::ZeroVector;
		for (const TCHAR* Side : {TEXT("Left"), TEXT("Right")})
		{
			int32 Foot = INDEX_NONE, Toe = INDEX_NONE;
			for (int32 I = 0; I < Ref.GetNum(); ++I)
			{
				const FString Name = Ref.GetBoneName(I).ToString();
				if (Name.EndsWith(FString(Side) + TEXT("Foot"))) Foot = I;
				else if (Name.EndsWith(FString(Side) + TEXT("ToeBase"))) Toe = I;
			}
			if (Foot != INDEX_NONE && Toe != INDEX_NONE) Forward += Cs[Toe].GetLocation() - Cs[Foot].GetLocation();
		}
		Forward.Z = 0;
		if (Forward.SizeSquared() < KINDA_SMALL_NUMBER) return NAN;
		return -FMath::RadiansToDegrees(FMath::Atan2(Forward.Y, Forward.X));
	}
}

UWFRig::UWFRig()
{
	SetCollisionEnabled(ECollisionEnabled::NoCollision);
	SetGenerateOverlapEvents(false);
	CastShadow = true;
	bCastDynamicShadow = true;
	// a crowd on a phone: only animate what's on screen, and let distant ones update less often
	VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::OnlyTickPoseWhenRendered;
	bEnableUpdateRateOptimizations = true;
	SetAnimationMode(EAnimationMode::AnimationSingleNode);
}

bool UWFRig::Wear(const FString& Model, float HeightCm, float FeetZ)
{
	const FString A = Model.Replace(TEXT("-"), TEXT("_"));
	const FString Dir = FString::Printf(TEXT("/Game/WF/Characters/%s/"), *A);
	USkeletalMesh* Mesh = TryLoad<USkeletalMesh>(Dir + A + TEXT(".") + A);
	if (!Mesh) return false;
	auto Clip = [&](const TCHAR* Name)
	{
		const FString N = A + TEXT("_") + Name;
		if (UAnimSequence* Moved = TryLoad<UAnimSequence>(Dir + N + TEXT(".") + N)) return Moved;
		// where the glTF importer leaves them: _src/<asset>/<file>/SkeletalMeshes/<file><clip> (e.g. raider-regularwalk)
		const FString Src = Model + Name;
		return TryLoad<UAnimSequence>(FString::Printf(TEXT("/Game/WF/Characters/_src/%s/%s/SkeletalMeshes/%s.%s"), *A, *Model, *Src, *Src));
	};
	Idle = Clip(TEXT("idle"));
	Walk = Clip(TEXT("walk"));
	Run = Clip(TEXT("run"));
	if (!Walk) Walk = Run;
	if (!Run) Run = Walk;
	if (!Idle) Idle = Walk; // some rigs ship only walk/run: a slow walk reads better than a T-pose

	SetSkeletalMesh(Mesh);
	const FBox Box = Mesh->GetImportedBounds().GetBox();
	const float Tall = static_cast<float>(Box.Max.Z - Box.Min.Z);
	const float Scale = Tall > 1.f ? HeightCm / Tall : 1.f;
	const float Yaw = FacingYaw(Mesh);
	SetRelativeScale3D(FVector(Scale));
	SetRelativeRotation(FRotator(0.f, FMath::IsNaN(Yaw) ? -90.f : Yaw, 0.f));
	SetRelativeLocation(FVector(0.f, 0.f, FeetZ - static_cast<float>(Box.Min.Z) * Scale));
	bWorn = true;
	Playing = -1;
	if (IsRegistered()) Drive(0.f);
	return true;
}

void UWFRig::Drive(float SpeedCmS)
{
	if (!bWorn) return;
	const int32 State = SpeedCmS < 20.f ? 0 : SpeedCmS < 260.f ? 1 : 2;
	UAnimSequence* Want = State == 0 ? Idle : State == 1 ? Walk : Run;
	if (State != Playing && Want)
	{
		PlayAnimation(Want, true);
		Playing = State;
	}
	// feet keep up with the ground: the clip's speed follows the real speed (within reason)
	SetPlayRate(State == 0 ? 1.f : FMath::Clamp(SpeedCmS / (State == 1 ? WalkPace : RunPace), 0.6f, 1.6f));
}

UWFRig* UWFRig::Attach(AActor* Owner, USceneComponent* Parent, const FString& Model, float HeightCm, float FeetZ)
{
	if (!Owner || !Parent || Model.IsEmpty()) return nullptr;
	UWFRig* Rig = NewObject<UWFRig>(Owner, MakeUniqueObjectName(Owner, UWFRig::StaticClass(), TEXT("Rig")));
	Rig->SetupAttachment(Parent);
	Rig->RegisterComponent();
	if (!Rig->Wear(Model, HeightCm, FeetZ))
	{
		Rig->DestroyComponent();
		return nullptr;
	}
	Owner->AddInstanceComponent(Rig);
	Rig->Drive(0.f);
	return Rig;
}
