#pragma once

#include "CoreMinimal.h"

class UMaterialInterface;
class UStaticMesh;

/**
 * Authored assets made in the editor by unreal/tools/setup_assets.py (materials under /Game/WF/Materials, the web
 * build's GLB models imported under /Game/WF/Models). Everything here is optional: a missing asset returns null quietly
 * and the caller keeps its stand-in (engine basic shapes, BasicShapeMaterial), so the game runs before the setup script
 * has ever been run. /Game/WF is always cooked (DefaultGame.ini), so phone builds carry them too.
 */
namespace WFAssets
{
	/** /Game/WF/Materials/<Name>: M_WF_Surface and M_WF_Neon take a "Color" vector; M_WF_Terrain reads vertex colour;
	 * M_WF_Water takes "Color". */
	WORLDFRACTURE_API UMaterialInterface* Material(const TCHAR* Name);
	/** /Game/WF/Models/<Folder>/<Name>: an imported GLB as a static mesh (buildings, fleet). */
	WORLDFRACTURE_API UStaticMesh* Mesh(const TCHAR* Folder, const FString& Name);
}
