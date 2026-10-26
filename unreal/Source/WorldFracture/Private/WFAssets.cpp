#include "WFAssets.h"

#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "UObject/Package.h"

namespace
{
	template <typename T>
	T* TryLoad(const FString& Path)
	{
		// quiet: the setup script may not have run yet, which is normal, not an error
		return LoadObject<T>(nullptr, *Path, nullptr, LOAD_NoWarn | LOAD_Quiet);
	}
}

UMaterialInterface* WFAssets::Material(const TCHAR* Name)
{
	return TryLoad<UMaterialInterface>(FString::Printf(TEXT("/Game/WF/Materials/%s.%s"), Name, Name));
}

UStaticMesh* WFAssets::Mesh(const TCHAR* Folder, const FString& Name)
{
	if (Name.IsEmpty()) return nullptr; // no model for this vehicle
	// asset names can't hold '-', the import turns the GLB's file name into one with '_'
	const FString Asset = Name.Replace(TEXT("-"), TEXT("_"));
	return TryLoad<UStaticMesh>(FString::Printf(TEXT("/Game/WF/Models/%s/%s.%s"), Folder, *Asset, *Asset));
}
