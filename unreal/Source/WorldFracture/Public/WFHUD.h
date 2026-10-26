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
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;
	virtual void DrawHUD() override;
	/** touch buttons (phones, or any PC started with -touchhud) press and release the Operator's input actions */
	virtual void NotifyHitBoxClick_Implementation(FName BoxName) override;
	virtual void NotifyHitBoxRelease_Implementation(FName BoxName) override;
	void Toast(const FString& Text, const FLinearColor& Color);

private:
	UFUNCTION() void HandleMissionPaid(const FString& MissionId, double Factor, bool bFirstClear);
	UFUNCTION() void HandleScenarioClaimed(const FString& ScenarioId, bool bPaid);
	UFUNCTION() void HandleLoot(const FString& ItemName, const FString& Rarity);
	UFUNCTION() void HandleLevelUp(int32 NewLevel);
	UFUNCTION() void HandleQuestCompleted(const FString& QuestId);

	void Line(const FString& Text, float X, float Y, const FLinearColor& Color, float Scale = 1.f);
	bool WantsTouchControls() const;
	/** the touch button's action on whatever is possessed: the Operator on foot, the vehicle while driving */
	class UInputAction* TouchActionFor(FName Id) const;
	void DrawTouchControls(float W, float H);
	void ReleaseTouch(FName BoxName);
	/** where each button was drawn this frame (for letting go when the finger slides off) */
	TMap<FName, FBox2D> TouchRects;
	TMap<FName, TWeakObjectPtr<class UInputAction>> HeldTouch;
	TArray<FName> HeldIds() const { TArray<FName> Out; HeldTouch.GetKeys(Out); return Out; }

	struct FToast
	{
		FString Text;
		FLinearColor Color;
		double Until = 0;
	};
	TArray<FToast> Toasts;
};
