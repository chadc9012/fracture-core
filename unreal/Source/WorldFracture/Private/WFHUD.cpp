#include "WFHUD.h"

#include "WFMissionSubsystem.h"

#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/World.h"
#include "WFCharacter.h"
#include "WFVehicle.h"
#include "WFDragonSubsystem.h"
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
		Progression->OnScenarioClaimed.AddDynamic(this, &AWFHUD::HandleScenarioClaimed);
		Progression->OnMissionPaid.AddDynamic(this, &AWFHUD::HandleMissionPaid);
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

void AWFHUD::HandleMissionPaid(const FString& MissionId, double Factor, bool bFirstClear)
{
	Toast(FString::Printf(TEXT("MISSION PAID - %s%s (x%.2f)"), *MissionId, bFirstClear ? TEXT(" first clear") : TEXT(""), Factor), Gold);
}

void AWFHUD::HandleScenarioClaimed(const FString& ScenarioId, bool bPaid)
{
	Toast(bPaid ? FString::Printf(TEXT("SCENARIO CLEARED - %s: signature reward claimed"), *ScenarioId)
		: FString::Printf(TEXT("%s down - no signature reward (needs 5 hits, once per run)"), *ScenarioId), bPaid ? Gold : Warn);
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

	// boss panel: name, health, encounter phase, and the attack being wound up (encounter-sim.ts windupHud)
	if (const AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>())
	{
		FString Name, Phase, Windup;
		double HpFrac = 0, Progress = 0;
		if (Mode->GetBossHud(Name, HpFrac, Phase, Windup, Progress))
		{
			auto Bar = [](double Fraction, int32 Cells) { FString B; const int32 Full = FMath::Clamp(FMath::RoundToInt(Fraction * Cells), 0, Cells); for (int32 I = 0; I < Cells; ++I) B += I < Full ? TEXT("#") : TEXT("-"); return B; };
			const float X = W * 0.5f - 230.f;
			Line(FString::Printf(TEXT("%s  -  %s"), *Name.ToUpper(), *Phase), X, 28, Gold, 1.1f);
			Line(FString::Printf(TEXT("[%s] %d%%"), *Bar(HpFrac, 40), FMath::RoundToInt(HpFrac * 100)), X, 52, Warn);
			if (!Windup.IsEmpty()) Line(FString::Printf(TEXT("%s  [%s]"), *Windup.ToUpper(), *Bar(Progress, 20)), X, 74, FLinearColor(1.f, 0.3f, 0.25f), 1.05f);
		}
	}

	if (const AWFVehicle* Vehicle = Cast<AWFVehicle>(GetOwningPawn()))
	{
		const wf::vehicle::FState& S = Vehicle->GetState();
		const wf::vehicle::FCondition& C = Vehicle->GetCondition();
		Line(FString::Printf(TEXT("%s  (%s)"), *Vehicle->GetDef().Name.ToUpper(), UTF8_TO_TCHAR(Vehicle->GetProfile().Kind.c_str())), 32, H - 118, Cyan);
		Line(FString::Printf(TEXT("%d km/h%s%s   body %d%%  engine %d%%  tires %d%%"), FMath::RoundToInt(FMath::Abs(S.Speed) * 3.6), S.bAirborne ? TEXT("   AIRBORNE") : TEXT(""), S.Slip > 0.3 ? TEXT("   DRIFT") : TEXT(""),
			FMath::RoundToInt(C.Body), FMath::RoundToInt(C.Engine), FMath::RoundToInt(C.Tires)), 32, H - 92, Soft, 1.2f);
		const double Now = GetWorld()->GetTimeSeconds();
		Toasts.RemoveAll([Now](const FToast& T) { return T.Until < Now; });
		float TY = 32;
		for (const FToast& T : Toasts) { Line(T.Text, W - 460, TY, T.Color); TY += 26; }
		return; // the on-foot panels are for the Operator
	}

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
		if (const UWFDragonSubsystem* Dragon = GetGameInstance()->GetSubsystem<UWFDragonSubsystem>(); Dragon && Dragon->IsBonded())
		{
			const AWFCharacter* Rider = Cast<AWFCharacter>(GetOwningPawn());
			FString Cds;
			for (const char* Id : wf::dragon::AbilityIds)
			{
				const float Cd = Dragon->GetCooldown(UTF8_TO_TCHAR(Id));
				if (Cd > 0) Cds += FString::Printf(TEXT(" %s %ds"), UTF8_TO_TCHAR(Id), FMath::CeilToInt(Cd));
			}
			Line(FString::Printf(TEXT("VYRAK  %s  trust %d/100   energy %d   wyrm %s%s   %s"), *Dragon->GetTrustStageName(), FMath::RoundToInt(Dragon->GetTrust()), FMath::RoundToInt(Dragon->GetEnergy()), *Dragon->GetWyrmState(), *Cds,
				Rider && Rider->IsRiding() ? *FString::Printf(TEXT("RIDING %d m/s"), FMath::RoundToInt(Rider->GetRideSpeed())) : TEXT("[8 9 0 - = \\ ; Dragonite  F7 Wyrmcall  V ride]")), 32, H - 166, FLinearColor(0.75f, 0.55f, 1.f), 0.9f);
		}
		const FString Class = Progression->GetIdentityClass();
		Line(FString::Printf(TEXT("%s%s   NEX %d   DRAGONITE %d   [F6 class  F8 scenario]"), Class.IsEmpty() ? TEXT("NO CLASS") : *Class, Progression->IsBondedToVyrak() ? TEXT(" (Vyrak bond)") : TEXT(""),
			FMath::RoundToInt(Progression->GetNexBalance()), FMath::RoundToInt(Progression->GetMaterial(TEXT("dragonite")))), 32, H - 142, Soft, 0.9f);
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
