#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "WFHUD.generated.h"

/**
 * Text HUD drawn on the canvas (no widget assets needed): crosshair, hull integrity, weapon and ammo, level and XP,
 * session kills and credits, the active Fracture Descent quest with its objectives, and loot / level-up toasts.
 * The Destiny-style UMG HUD from the reference art replaces it later.
 */
UCLASS()
class WORLDFRACTURE_API AWFHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void BeginPlay() override;
	virtual void DrawHUD() override;
	void Toast(const FString& Text, const FLinearColor& Color);

private:
	UFUNCTION() void HandleScenarioClaimed(const FString& ScenarioId, bool bPaid);
	UFUNCTION() void HandleLoot(const FString& ItemName, const FString& Rarity);
	UFUNCTION() void HandleLevelUp(int32 NewLevel);
	UFUNCTION() void HandleQuestCompleted(const FString& QuestId);

	void Line(const FString& Text, float X, float Y, const FLinearColor& Color, float Scale = 1.f);

	struct FToast
	{
		FString Text;
		FLinearColor Color;
		double Until = 0;
	};
	TArray<FToast> Toasts;
};
