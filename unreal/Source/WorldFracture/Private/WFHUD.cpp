#include "WFHUD.h"

#include "WFMissionSubsystem.h"

#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/World.h"
#include "WFCharacter.h"
#include "WFGameMode.h"
#include "WFProgressionSubsystem.h"
#include "WFQuestSubsystem.h"

namespace
{
	const FLinearColor Cyan(0.45f, 0.9f, 1.f);
	const FLinearColor Soft(0.85f, 0.88f, 0.9f);
	const FLinearColor Warn(1.f, 0.55f, 0.3f);
	const FLinearColor Gold(1.f, 0.82f, 0.35f);
}

void AWFHUD::BeginPlay()
{
	Super::BeginPlay();
	UGameInstance* Game = GetGameInstance();
	if (!Game) return;
	if (UWFProgressionSubsystem* Progression = Game->GetSubsystem<UWFProgressionSubsystem>())
	{
		Progression->OnLootGained.AddDynamic(this, &AWFHUD::HandleLoot);
		Progression->OnLevelUp.AddDynamic(this, &AWFHUD::HandleLevelUp);
	}
	if (UWFQuestSubsystem* Quests = Game->GetSubsystem<UWFQuestSubsystem>()) Quests->OnQuestCompleted.AddDynamic(this, &AWFHUD::HandleQuestCompleted);
}

void AWFHUD::Toast(const FString& Text, const FLinearColor& Color)
{
	Toasts.Insert({Text, Color, GetWorld()->GetTimeSeconds() + 4.0}, 0);
	if (Toasts.Num() > 5) Toasts.SetNum(5);
}

void AWFHUD::HandleLoot(const FString& ItemName, const FString& Rarity)
{
	Toast(FString::Printf(TEXT("Drop - %s%s"), *ItemName, Rarity.IsEmpty() ? TEXT("") : *FString::Printf(TEXT(" (%s)"), *Rarity)), Gold);
}

void AWFHUD::HandleLevelUp(int32 NewLevel) { Toast(FString::Printf(TEXT("LEVEL UP - %d"), NewLevel), Cyan); }
void AWFHUD::HandleQuestCompleted(const FString& QuestId) { Toast(FString::Printf(TEXT("Quest complete - %s"), *QuestId), Cyan); }

void AWFHUD::Line(const FString& Text, float X, float Y, const FLinearColor& Color, float Scale)
{
	DrawText(Text, Color, X, Y, GEngine->GetMediumFont(), Scale);
}

void AWFHUD::DrawHUD()
{
	Super::DrawHUD();
	if (!Canvas) return;
	const float W = Canvas->ClipX, H = Canvas->ClipY;

	// crosshair
	DrawLine(W / 2 - 10, H / 2, W / 2 - 3, H / 2, Soft, 1.5f);
	DrawLine(W / 2 + 3, H / 2, W / 2 + 10, H / 2, Soft, 1.5f);
	DrawLine(W / 2, H / 2 - 10, W / 2, H / 2 - 3, Soft, 1.5f);
	DrawLine(W / 2, H / 2 + 3, W / 2, H / 2 + 10, Soft, 1.5f);

	const AWFCharacter* Player = Cast<AWFCharacter>(GetOwningPawn());
	UGameInstance* Game = GetGameInstance();
	const UWFProgressionSubsystem* Progression = Game ? Game->GetSubsystem<UWFProgressionSubsystem>() : nullptr;
	const UWFQuestSubsystem* Quests = Game ? Game->GetSubsystem<UWFQuestSubsystem>() : nullptr;
	const AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>();

	// bottom left: hull, level
	if (Player)
	{
		const double Hp = Player->GetHealth();
		Line(FString::Printf(TEXT("HULL INTEGRITY  %d%%"), FMath::RoundToInt(Hp)), 32, H - 118, Hp < 30 ? Warn : Cyan);
		DrawRect(FLinearColor(0.1f, 0.12f, 0.14f, 0.7f), 32, H - 92, 300, 8);
		DrawRect(Hp < 30 ? Warn : Cyan, 32, H - 92, 300.f * static_cast<float>(Hp / AWFCharacter::MaxHealth), 8);
	}
	if (Progression)
	{
		Line(FString::Printf(TEXT("LEVEL %d   %d / %d XP"), Progression->GetLevel(), FMath::RoundToInt(Progression->GetXp()), FMath::RoundToInt(Progression->GetXpToNextLevel())), 32, H - 72, Soft);
		Line(FString::Printf(TEXT("KILLS %d   CREDITS %d   GEAR %d"), Progression->GetSessionKills(), FMath::RoundToInt(Progression->GetSessionCredits()), Progression->GetInventoryCount()), 32, H - 50, Soft, 0.9f);
	}

	// bottom right: weapon
	if (Player)
		if (const FWFWeaponStats* Weapon = Player->GetWeapon())
		{
			Line(Weapon->Name.ToUpper(), W - 300, H - 118, Cyan);
			Line(Player->IsReloading() ? TEXT("RELOADING") : FString::Printf(TEXT("%d / %d"), Player->GetAmmoInMag(), Player->GetAmmoReserve()), W - 300, H - 90, Soft, 1.6f);
		}

	// top left: region and quest
	float Y = 32;
	if (Mode) { Line(FString::Printf(TEXT("%s"), *Mode->GetRegionName().ToUpper()), 32, Y, Soft, 0.9f); Y += 26; }
	if (Quests && !Quests->GetActiveQuestId().IsEmpty())
	{
		Line(FString::Printf(TEXT("THE FRACTURE DESCENT / %s"), *Quests->GetActiveQuestTitle().ToUpper()), 32, Y, Cyan);
		Y += 24;
		for (const FWFObjectiveView& O : Quests->GetActiveObjectives())
		{
			Line(FString::Printf(TEXT("%s  %s  %d / %d"), O.bComplete ? TEXT("[x]") : TEXT("[ ]"), *O.Label, FMath::FloorToInt(O.Progress), FMath::FloorToInt(O.Amount)), 40, Y, O.bComplete ? Cyan : Soft, 0.9f);
			Y += 22;
		}
		Line(TEXT("F9: finish quest (development)   F5: save"), 40, Y + 4, FLinearColor(0.6f, 0.6f, 0.6f), 0.75f);
	}

	// running story mission: objective and NOVA's line
	if (const UWFMissionSubsystem* Missions = Game ? Game->GetSubsystem<UWFMissionSubsystem>() : nullptr)
		for (const FString& Id : Missions->GetRunningMissions())
		{
			Line(FString::Printf(TEXT("MISSION / %s"), *Missions->GetObjective(Id).ToUpper()), 32, Y + 40, Gold);
			Line(FString::Printf(TEXT("NOVA: %s"), *Missions->GetNovaLine(Id)), W / 2 - 420, H - 200, Soft, 0.85f);
			break;
		}

	// top right: toasts
	const double Now = GetWorld()->GetTimeSeconds();
	Toasts.RemoveAll([Now](const FToast& T) { return T.Until < Now; });
	float TY = 32;
	for (const FToast& T : Toasts) { Line(T.Text, W - 460, TY, T.Color); TY += 26; }
	if (Player && !Player->GetLastDamageSource().IsEmpty() && Player->GetHealth() < AWFCharacter::MaxHealth)
		Line(FString::Printf(TEXT("Hit by %s"), *Player->GetLastDamageSource()), W / 2 - 80, H - 160, Warn, 0.9f);
}
