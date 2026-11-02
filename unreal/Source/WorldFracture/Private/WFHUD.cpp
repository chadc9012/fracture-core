#include "WFHUD.h"

#include "Core/WFCityCore.h"

#include "Engine/GameInstance.h"

#include "WFMissionSubsystem.h"

#include "Engine/Canvas.h"
#include "GameFramework/PlayerController.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/World.h"
#include "WFCharacter.h"
#include "WFVehicle.h"
#include "WFDragonSubsystem.h"
#include "WFGameMode.h"
#include "WFProgressionSubsystem.h"
#include "WFQuestSubsystem.h"
#include "WFRaceSubsystem.h"
#include "WFActivitySubsystem.h"
#include "Core/WFJsCompat.h"
#include "WFShopSubsystem.h"
#include "WFGps.h"
#include "Core/WFGpsCore.h"

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

	// GPS: the city map replaces the HUD while it is open (the game is paused); otherwise the minimap sits under the rest
	if (!GpsCache.IsValid()) GpsCache = AWFGpsNavigator::Find(GetWorld());
	if (AWFGpsNavigator* Gps = GpsCache.Get(); Gps && Gps->IsBuilt())
	{
		if (Gps->IsMapOpen()) { DrawGpsMap(W, H, *Gps); return; }
		DrawGpsMinimap(W, H, *Gps);
	}

	// boss panel: name, health, encounter phase, and the attack being wound up (encounter-sim.ts windupHud)
	if (const AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>())
	{
		FString Name, Phase, Windup;
		double HpFrac = 0, Progress = 0;
		if (Mode->GetBossHud(Name, HpFrac, Phase, Windup, Progress))
		{
			auto Bar = [](double Fraction, int32 Cells) { FString B; const int32 Full = FMath::Clamp(FMath::RoundToInt32(Fraction * Cells), 0, Cells); for (int32 I = 0; I < Cells; ++I) B += I < Full ? TEXT("#") : TEXT("-"); return B; };
			const float X = W * 0.5f - 230.f;
			Line(FString::Printf(TEXT("%s  -  %s"), *Name.ToUpper(), *Phase), X, 28, Gold, 1.1f);
			Line(FString::Printf(TEXT("[%s] %d%%"), *Bar(HpFrac, 40), FMath::RoundToInt32(HpFrac * 100)), X, 52, Warn);
			if (!Windup.IsEmpty()) Line(FString::Printf(TEXT("%s  [%s]"), *Windup.ToUpper(), *Bar(Progress, 20)), X, 74, FLinearColor(1.f, 0.3f, 0.25f), 1.05f);
		}
	}

	// the nemesis on the field (living-runtime.ts hud.nemesis)
	if (const AWFGameMode* NemMode = GetWorld()->GetAuthGameMode<AWFGameMode>())
	{
		FString NemLine;
		if (NemMode->GetNemesisHud(NemLine)) Line(NemLine, W * 0.5f - 230.f, 96.f, FLinearColor(1.f, 0.35f, 0.3f), 0.95f);
	}

	// Wastelands activity panel (wasteland-runtime.ts WasteHud): title, lines and a progress bar
	if (const AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>())
		if (const std::optional<wf::wasteland::FHud>& Hud = Mode->GetWastelandHud())
		{
			const float X = W * 0.5f - 230.f;
			float Y = 110.f;
			Line(UTF8_TO_TCHAR(Hud->Title.c_str()), X, Y, Gold, 1.05f);
			Y += 24;
			for (const std::string& L : Hud->Lines) { Line(UTF8_TO_TCHAR(L.c_str()), X, Y, Soft, 0.9f); Y += 20; }
			if (Hud->Progress)
			{
				DrawRect(FLinearColor(0.1f, 0.12f, 0.14f, 0.7f), X, Y + 4, 300, 6);
				DrawRect(Hud->Kind == "VAULT" && *Hud->Progress < 0.35 ? Warn : Cyan, X, Y + 4, 300.f * static_cast<float>(FMath::Clamp(*Hud->Progress, 0.0, 1.0)), 6);
			}
		}

	// a strike run (the Operations hub's run panel): stage, objective, boss counter, hazard and shared lives
	if (const AWFGameMode* StMode = GetWorld()->GetAuthGameMode<AWFGameMode>())
	{
		FString Title;
		TArray<FString> Lines;
		double Hazard = 0;
		if (StMode->GetStrikeHud(Title, Lines, Hazard))
		{
			const float X = 30.f;
			float Y = H * 0.32f;
			Line(Title, X, Y, Gold, 1.0f);
			Y += 22;
			for (const FString& L : Lines) { Line(L, X, Y, Soft, 0.8f); Y += 18; }
			DrawRect(FLinearColor(0.1f, 0.12f, 0.14f, 0.7f), X, Y + 4, 280, 6);
			DrawRect(Hazard > 0.7 ? FLinearColor(1.f, 0.3f, 0.25f) : Hazard > 0.4 ? Warn : Cyan, X, Y + 4, 280.f * static_cast<float>(FMath::Clamp(Hazard, 0.0, 1.0)), 6);
		}
		// the activity run (ActivityBoard / the HUD objective): name, stage, progress, timer, challenge, distance to the marker
		if (const UWFActivitySubsystem* Board = GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFActivitySubsystem>() : nullptr; Board && Board->IsRunning())
		{
			float Y = H * 0.2f;
			const TArray<FString> RunLines = Board->DescribeRun(UWFProgressionSubsystem::NowMs());
			for (int32 I = 0; I < RunLines.Num(); ++I) { Line(RunLines[I], 30.f, Y, I == 0 ? Gold : Soft, I == 0 ? 0.95f : 0.8f); Y += 20; }
			const APawn* Pawn = GetOwningPawn();
			if (const std::optional<wf::activity::FTarget> Tg = Board->Target(); Tg && Pawn)
			{
				const FVector2D Here = StMode->WebPosition(Pawn->GetActorLocation());
				Line(FString::Printf(TEXT("Marker: %.0f m"), wf::js::Hypot(Here.X - Tg->X, Here.Y - Tg->Z)), 30.f, Y, Cyan, 0.8f);
			}
		}
		// region-hazards.ts: the hazard acting on you (Scene.tsx hud.hazard: name, intensity, active)
		const wf::hazard::FHazardEffect& Hz = StMode->GetRegionHazard();
		if (Hz.Id != "none" || Hz.DamagePerSec > 0 || Hz.GravityMul != 1)
		{
			FString Meter;
			const int32 Full = FMath::Clamp(FMath::RoundToInt32(Hz.Intensity * 10), 0, 10);
			for (int32 I = 0; I < 10; ++I) Meter += I < Full ? TEXT("#") : TEXT("-");
			Line(FString::Printf(TEXT("%s  [%s]%s"), UTF8_TO_TCHAR(Hz.Name.c_str()), *Meter, Hz.DamagePerSec > 0 || Hz.GravityMul != 1 ? TEXT("  ACTIVE") : TEXT("")), 30.f, H - 230.f, Hz.DamagePerSec > 0 ? FLinearColor(1.f, 0.35f, 0.3f) : Warn, 0.8f);
		}
		if (!StMode->GetCityEventLine().IsEmpty()) Line(StMode->GetCityEventLine(), W * 0.5f - 260.f, 30.f, FLinearColor(1.f, 0.55f, 0.3f), 0.9f);
		if (!StMode->GetVenueLine().IsEmpty()) Line(StMode->GetVenueLine(), W * 0.5f - 260.f, H - 170.f, FLinearColor(1.f, 0.35f, 0.75f), 0.9f);
		if (StMode->GetTalkHint().IsEmpty() && !StMode->GetVenueHint().IsEmpty()) Line(StMode->GetVenueHint(), W * 0.5f - 160.f, H - 140.f, Gold, 0.9f);
		if (!StMode->GetTalkHint().IsEmpty()) Line(StMode->GetTalkHint(), W * 0.5f - 160.f, H - 140.f, Gold, 0.9f);
		if (!StMode->GetWorldBossLine().IsEmpty()) Line(StMode->GetWorldBossLine(), W * 0.5f - 300.f, 6.f, Gold, 0.9f);
	}

	// city: the heat level (heat.ts), and in Nexus City the surveillance meter, lockdown tier and hack (stealth.ts)
	if (const AWFGameMode* Mode = GetWorld()->GetAuthGameMode<AWFGameMode>())
	{
		const float X = W - 430.f;
		float Y = 150.f;
		const wf::city::FHeatStatus Heat = wf::city::HeatStatus(Mode->GetHeatMeter());
		if (Mode->GetHeatMeter() > 0.5)
		{
			Line(FString::Printf(TEXT("HEAT %d  %s"), Heat.Level, UTF8_TO_TCHAR(Heat.Label)), X, Y, Heat.Level >= 4 ? FLinearColor(1.f, 0.3f, 0.25f) : Warn, 1.0f);
			Line(UTF8_TO_TCHAR(Heat.Response), X, Y + 20, Soft, 0.75f);
			Y += 44;
		}
		if (Mode->IsInNexus() && (Mode->GetDetectionMeter() > 0.5 || Mode->IsHacking() || Mode->GetHackProgress() > 0))
		{
			const std::string State = wf::city::DetectionStateFor(Mode->GetDetectionMeter());
			const wf::city::FLockdownStatus Lock = wf::city::LockdownStatus(Mode->GetDetectionMeter());
			const FLinearColor C = State == "RED" ? FLinearColor(1.f, 0.3f, 0.25f) : State == "YELLOW" ? Warn : Cyan;
			Line(FString::Printf(TEXT("DETECTION %d%%  %s"), FMath::RoundToInt32(Mode->GetDetectionMeter()), UTF8_TO_TCHAR(Lock.Label)), X, Y, C, 0.95f);
			Line(UTF8_TO_TCHAR(Lock.Response), X, Y + 20, Soft, 0.75f);
			Y += 44;
			Line(FString::Printf(TEXT("HACK %d%%%s"), FMath::RoundToInt32(Mode->GetHackProgress()), Mode->IsHacking() ? TEXT("  (holding H)") : TEXT("  (hold H to hack)")), X, Y, Cyan, 0.85f);
		}
	}

	// shop counter: today's stock of the open shop (regional-shops.ts shopOffers), its gate, and what you can pay with
	if (const UWFShopSubsystem* Shops = GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFShopSubsystem>() : nullptr)
		if (const wf::shop::FShop* Shop = Shops->GetOpenShop())
		{
			const float X = 40.f;
			float Y = 110.f;
			DrawRect(FLinearColor(0.02f, 0.03f, 0.05f, 0.78f), X - 12, Y - 10, 760, 470);
			Line(FString::Printf(TEXT("%s  -  %s, %s"), UTF8_TO_TCHAR(Shop->Name.c_str()), UTF8_TO_TCHAR(Shop->Kind.c_str()), UTF8_TO_TCHAR(Shop->Place.c_str())), X, Y, Gold, 1.1f);
			Y += 26;
			const FString Lock = Shops->GetLock();
			Line(Lock.IsEmpty() ? FString::Printf(TEXT("You have %d %s   [Buy <n>  Service <itemId> [element]  CloseShop]"), FMath::RoundToInt32(Shops->GetCurrencyBalance()), UTF8_TO_TCHAR(Shop->Currency.c_str()))
				: FString::Printf(TEXT("CLOSED TO YOU: %s"), *Lock), X, Y, Lock.IsEmpty() ? Soft : Warn, 0.9f);
			Y += 28;
			const std::vector<wf::shop::FOffer> Offers = Shops->GetOffers();
			for (int32 I = 0; I < static_cast<int32>(Offers.size()) && I < 14; ++I)
			{
				const wf::shop::FOffer& O = Offers[static_cast<size_t>(I)];
				Line(FString::Printf(TEXT("%2d  %-34s %5d   lv %d"), I, UTF8_TO_TCHAR(O.Name.c_str()), FMath::RoundToInt32(O.Price), FMath::RoundToInt32(O.MinLevel)), X, Y, O.Detail.rfind("DAILY", 0) == 0 ? Gold : Cyan, 0.9f);
				Line(UTF8_TO_TCHAR(O.Detail.c_str()), X + 420, Y + 2, Soft, 0.7f);
				Y += 22;
			}
			if (Offers.empty()) Line(Shop->Kind == "gunsmith" ? TEXT("Services only: Service <itemId> upgrades a weapon") : TEXT("Nothing in stock today"), X, Y, Soft, 0.9f);
		}

	// race panel: phase, clock, gate, live place (racing.ts livePlace), penalties
	if (const UWFRaceSubsystem* Racing = GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFRaceSubsystem>() : nullptr)
		if (const wf::race::FRun* Run = Racing->ActiveRun())
			if (const wf::race::FRaceDef* Def = Racing->ActiveDef())
			{
				const float X = W * 0.5f - 140.f; // under the boss panel, clear of the toasts
				const int32 Gates = static_cast<int32>(Def->Points.size()) - 1;
				Line(FString::Printf(TEXT("%s  (%s)"), UTF8_TO_TCHAR(Def->Name.c_str()), UTF8_TO_TCHAR(Run->Difficulty.c_str())), X, 104, Gold, 1.1f);
				if (Run->Phase == "staging") Line(TEXT("Get to the start line"), X, 128, Soft);
				else if (Run->Phase == "countdown") Line(FString::Printf(TEXT("%d"), FMath::CeilToInt32(Run->Countdown)), X, 128, Gold, 2.f);
				else
				{
					const double Limit = wf::race::TimeLimit(*Def, Run->Difficulty);
					Line(FString::Printf(TEXT("%.1f s / %.0f   par %.0f"), Run->Time, Limit, Def->Par), X, 128, Soft, 1.2f);
					Line(FString::Printf(TEXT("Checkpoint %d / %d"), FMath::Clamp(Run->Next, 0, Gates), Gates), X, 152, Cyan);
					if (const APawn* Pawn = GetOwningPawn())
					{
						const FVector P = Pawn->GetActorLocation() / 100.0;
						int32 Place = 1, Field = 1;
						wf::race::LivePlace(*Def, *Run, P.X - Racing->OffsetX(), P.Y - Racing->OffsetZ(), Place, Field);
						Line(FString::Printf(TEXT("P%d / %d"), Place, Field), X, 176, Gold, 1.3f);
					}
					if (Run->Penalties > 0 || Run->Collisions > 0)
						Line(FString::Printf(TEXT("+%.1f s penalties   %g collisions"), Run->Penalties, Run->Collisions), X, 202, Warn);
				}
			}

	if (const AWFVehicle* Vehicle = Cast<AWFVehicle>(GetOwningPawn()))
	{
		const wf::vehicle::FState& S = Vehicle->GetState();
		const wf::vehicle::FCondition& C = Vehicle->GetCondition();
		Line(FString::Printf(TEXT("%s  (%s)"), *Vehicle->GetDef().Name.ToUpper(), UTF8_TO_TCHAR(Vehicle->GetProfile().Kind.c_str())), 32, H - 118, Cyan);
		Line(FString::Printf(TEXT("%d km/h%s%s   body %d%%  engine %d%%  tires %d%%"), FMath::RoundToInt32(FMath::Abs(S.Speed) * 3.6), S.bAirborne ? TEXT("   AIRBORNE") : TEXT(""), S.Slip > 0.3 ? TEXT("   DRIFT") : TEXT(""),
			FMath::RoundToInt32(C.Body), FMath::RoundToInt32(C.Engine), FMath::RoundToInt32(C.Tires)), 32, H - 92, Soft, 1.2f);
		// hardpoints and the shared weapon heat (vehicle-weapons.ts, sim.ts weaponHeat)
		const wf::vweapons::FArmament& Arm = Vehicle->GetArmament();
		if (Arm.Primary || Arm.Secondary || Arm.SecondaryGun || Vehicle->GetGadget())
		{
			const wf::vweapons::FHeat& Heat = Vehicle->GetHeat();
			FString Guns = Arm.Primary ? FString::Printf(TEXT("LMB %s"), UTF8_TO_TCHAR(Arm.Primary->Name.c_str())) : FString();
			if (Arm.SecondaryGun) Guns += FString::Printf(TEXT("   RMB %s"), UTF8_TO_TCHAR(Arm.SecondaryGun->Name.c_str()));
			else if (Arm.Secondary) Guns += FString::Printf(TEXT("   RMB %s x%d"), UTF8_TO_TCHAR(Arm.Secondary->Name.c_str()), Arm.Secondary->Salvo);
			else if (const std::optional<wf::gadget::FGadget>& G = Vehicle->GetGadget())
				Guns += G->Use == "PASSIVE" ? FString::Printf(TEXT("   %s"), UTF8_TO_TCHAR(G->Name.c_str()))
					: FString::Printf(TEXT("   RMB %s%s"), UTF8_TO_TCHAR(G->Name.c_str()), Vehicle->GetGadgetCooldown() > 0 ? *FString::Printf(TEXT(" %.0fs"), Vehicle->GetGadgetCooldown()) : TEXT(""));
			FString Bar;
			for (int32 I = 0; I < 20; ++I) Bar += I < FMath::RoundToInt32(Heat.Heat / 5) ? TEXT("#") : TEXT("-");
			const TCHAR* State = Vehicle->AreWeaponsDisabled() ? TEXT("   WEAPONS OFFLINE") : Heat.bOverheated ? TEXT("   OVERHEAT") : TEXT("");
			Line(FString::Printf(TEXT("%s   heat [%s]%s"), *Guns, *Bar, State), 32, H - 66, Heat.bOverheated || Vehicle->AreWeaponsDisabled() ? Warn : Soft);
		}
		// aim point: the camera follows the turret / gun aim
		DrawLine(W / 2 - 12, H / 2, W / 2 - 4, H / 2, Soft, 1.5f);
		DrawLine(W / 2 + 4, H / 2, W / 2 + 12, H / 2, Soft, 1.5f);
		DrawLine(W / 2, H / 2 - 12, W / 2, H / 2 - 4, Soft, 1.5f);
		DrawLine(W / 2, H / 2 + 4, W / 2, H / 2 + 12, Soft, 1.5f);
		const double Now = GetWorld()->GetTimeSeconds();
		Toasts.RemoveAll([Now](const FToast& T) { return T.Until < Now; });
		float TY = 32;
		for (const FToast& T : Toasts) { Line(T.Text, W - 460, TY, T.Color); TY += 26; }
		DrawTouchControls(W, H); // the driving buttons (anything held on foot lets go once its finger lifts)
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
		Line(FString::Printf(TEXT("HULL INTEGRITY  %d%%"), FMath::RoundToInt32(Hp)), 32, H - 118, Hp < 30 ? Warn : Cyan);
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
				if (Cd > 0) Cds += FString::Printf(TEXT(" %s %ds"), UTF8_TO_TCHAR(Id), FMath::CeilToInt32(Cd));
			}
			Line(FString::Printf(TEXT("VYRAK  %s  trust %d/100   energy %d   wyrm %s%s   %s"), *Dragon->GetTrustStageName(), FMath::RoundToInt32(Dragon->GetTrust()), FMath::RoundToInt32(Dragon->GetEnergy()), *Dragon->GetWyrmState(), *Cds,
				Rider && Rider->IsRiding() ? *FString::Printf(TEXT("RIDING %d m/s"), FMath::RoundToInt32(Rider->GetRideSpeed())) : TEXT("[8 9 0 - = \\ ; Dragonite  F7 Wyrmcall  V ride]")), 32, H - 166, FLinearColor(0.75f, 0.55f, 1.f), 0.9f);
		}
		const FString Class = Progression->GetIdentityClass();
		Line(FString::Printf(TEXT("%s%s   NEX %d   DRAGONITE %d   [F6 class  F8 scenario]"), Class.IsEmpty() ? TEXT("NO CLASS") : *Class, Progression->IsBondedToVyrak() ? TEXT(" (Vyrak bond)") : TEXT(""),
			FMath::RoundToInt32(Progression->GetNexBalance()), FMath::RoundToInt32(Progression->GetMaterial(TEXT("dragonite")))), 32, H - 142, Soft, 0.9f);
		Line(FString::Printf(TEXT("LEVEL %d   %d / %d XP"), Progression->GetLevel(), FMath::RoundToInt32(Progression->GetXp()), FMath::RoundToInt32(Progression->GetXpToNextLevel())), 32, H - 72, Soft);
		Line(FString::Printf(TEXT("KILLS %d   CREDITS %d   GEAR %d"), Progression->GetSessionKills(), FMath::RoundToInt32(Progression->GetSessionCredits()), Progression->GetInventoryCount()), 32, H - 50, Soft, 0.9f);
	}

	// bottom centre: the class abilities (ability-hud.ts abilityHud: usable = off cooldown and enough energy)
	if (Player)
	{
		const wf::ability::FLiveBuild& Live = Player->GetLiveBuild();
		const std::vector<wf::ability::FHudRow> Rows = wf::ability::AbilityHud(Live);
		float X = W * 0.5f - 330.f;
		for (int32 I = 0; I < static_cast<int32>(Rows.size()); ++I)
		{
			const wf::ability::FHudRow& R = Rows[I];
			const FString State = R.State == "COOLDOWN" ? FString::Printf(TEXT("%.1fs"), R.Cooldown) : R.State == "NO_ENERGY" ? FString(TEXT("no energy")) : FString(UTF8_TO_TCHAR(R.State.c_str()));
			Line(FString::Printf(TEXT("[%s] %s  %s"), AWFCharacter::AbilityKey(I), UTF8_TO_TCHAR(R.Name.c_str()), *State), X, H - 96, R.bReady ? Cyan : R.State == "ACTIVE" ? Gold : Soft, 0.9f);
			X += 225.f;
		}
		FString Timers;
		if (Live.SiegeTime > 0) Timers += FString::Printf(TEXT("  SIEGE %.0fs"), Live.SiegeTime);
		if (Live.VeilTime > 0) Timers += FString::Printf(TEXT("  VEILED %.0fs"), Live.VeilTime);
		if (Live.HackTime > 0) Timers += FString::Printf(TEXT("  DISRUPTION %.0fs"), Live.HackTime);
		if (Player->GetBarrier() > 0) Timers += FString::Printf(TEXT("  BARRIER %.0fs"), Player->GetBarrier());
		if (Player->GetRiftTurretCount() > 0) Timers += FString::Printf(TEXT("  TURRETS %d"), Player->GetRiftTurretCount());
		if (!Live.VerbKind.empty()) Timers += FString::Printf(TEXT("  %s %.0fs"), UTF8_TO_TCHAR(wf::ability::VerbLabel(Live.VerbKind).c_str()), Live.VerbTime);
		const FString Sub = Player->GetSubclass();
		Line(FString::Printf(TEXT("ENERGY %d%s%s%s"), FMath::RoundToInt32(Live.Energy), Sub.IsEmpty() ? TEXT("") : *FString::Printf(TEXT("   %s"), *Sub), *Timers,
			Live.EffectTime > 0 ? *FString::Printf(TEXT("   %s"), UTF8_TO_TCHAR(Live.Effect.c_str())) : TEXT("")), W * 0.5f - 330.f, H - 72, Soft, 0.85f);
	}

	// bottom right: weapon
	if (Player)
		if (const FWFWeaponStats* Weapon = Player->GetWeapon())
		{
			Line(Weapon->Name.ToUpper(), W - 300, H - 118, Cyan);
			Line(Player->IsBladeOut() ? FString::Printf(TEXT("COMBO %d / 3"), Player->GetComboStep()) : Player->IsReloading() ? FString(TEXT("RELOADING")) : FString::Printf(TEXT("%d / %d"), Player->GetAmmoInMag(), Player->GetAmmoReserve()), W - 300, H - 90, Soft, 1.6f);
			// sim.ts weaponHeat: the shared gauge (it vents slower after an overheat)
			if (const AWFGameMode* HeatMode = GetWorld()->GetAuthGameMode<AWFGameMode>(); HeatMode && !Player->IsBladeOut())
			{
				const wf::vweapons::FHeat& G = HeatMode->GetWeaponHeat();
				if (G.Heat > 0.5 || G.bOverheated)
				{
					FString Bar;
					for (int32 I = 0; I < 20; ++I) Bar += I < FMath::RoundToInt32(G.Heat / 5) ? TEXT("#") : TEXT("-");
					Line(FString::Printf(TEXT("HEAT [%s]%s"), *Bar, G.bOverheated ? TEXT("  VENTING") : TEXT("")), W - 300, H - 52, G.bOverheated ? Warn : Soft, 0.8f);
				}
			}
		}

	// a weapon-evolution ruin in reach
	if (const AWFGameMode* RuinMode = GetWorld()->GetAuthGameMode<AWFGameMode>(); RuinMode && !RuinMode->GetRuinHint().IsEmpty())
		Line(RuinMode->GetRuinHint(), W * 0.5f - 330.f, H - 175, FLinearColor(0.75f, 0.5f, 1.f), 0.8f);

	// NOVA senses a secret (secrets.ts): the distance, its name in reach, or why it does not answer yet
	if (const AWFGameMode* SecretMode = GetWorld()->GetAuthGameMode<AWFGameMode>())
	{
		double Dist = -1;
		FString Name, Locked;
		SecretMode->GetSecretHud(Dist, Name, Locked);
		if (Dist >= 0)
		{
			const FString Text = !Locked.IsEmpty() ? Locked : !Name.IsEmpty() ? FString::Printf(TEXT("NOVA: %s"), *Name) : FString::Printf(TEXT("NOVA: something hums nearby (%d m)"), FMath::RoundToInt32(Dist));
			Line(Text, W * 0.5f - 230.f, H - 150, FLinearColor(0.75f, 0.5f, 1.f), 0.85f);
		}
	}

	// top left: region and quest
	float Y = 32;
	if (Mode)
	{
		Line(FString::Printf(TEXT("%s"), *Mode->GetRegionName().ToUpper()), 32, Y, Soft, 0.9f); Y += 26;
		// the clock, phase and environment summary (world.ts clockLabel / phaseFor, environment.ts summary)
		const double Clock = Mode->GetDayClock();
		Line(FString::Printf(TEXT("%s  %s  %s"), UTF8_TO_TCHAR(wf::env::ClockLabel(Clock).c_str()), UTF8_TO_TCHAR(wf::env::PhaseFor(Clock).c_str()), UTF8_TO_TCHAR(Mode->GetEnvironment().Summary.c_str())), 32, Y, Soft, 0.8f); Y += 22;
		if (!Mode->GetHazardWarning().IsEmpty()) { Line(Mode->GetHazardWarning(), 32, Y, Warn, 0.85f); Y += 22; }
	}
	if (Quests && !Quests->GetActiveQuestId().IsEmpty())
	{
		Line(FString::Printf(TEXT("THE FRACTURE DESCENT / %s"), *Quests->GetActiveQuestTitle().ToUpper()), 32, Y, Cyan);
		Y += 24;
		for (const FWFObjectiveView& O : Quests->GetActiveObjectives())
		{
			Line(FString::Printf(TEXT("%s  %s  %d / %d"), O.bComplete ? TEXT("[x]") : TEXT("[ ]"), *O.Label, FMath::FloorToInt32(O.Progress), FMath::FloorToInt32(O.Amount)), 40, Y, O.bComplete ? Cyan : Soft, 0.9f);
			Y += 22;
		}
		Line(TEXT("F9: finish quest (development)   F5: save"), 40, Y + 4, FLinearColor(0.6f, 0.6f, 0.6f), 0.75f);
	}

	// running story mission: objective and NOVA's line
	if (const UWFMissionSubsystem* Missions = Game ? Game->GetSubsystem<UWFMissionSubsystem>() : nullptr)
		if (const auto Running = Missions->GetRunningMissions(); !Running.IsEmpty())
		{
			// the first running mission only
			const FString& Id = Running[0];
			Line(FString::Printf(TEXT("MISSION / %s"), *Missions->GetObjective(Id).ToUpper()), 32, Y + 40, Gold);
			Line(FString::Printf(TEXT("NOVA: %s"), *Missions->GetNovaLine(Id)), W / 2 - 420, H - 200, Soft, 0.85f);
		}

	// top right: toasts
	const double Now = GetWorld()->GetTimeSeconds();
	Toasts.RemoveAll([Now](const FToast& T) { return T.Until < Now; });
	float TY = 32;
	for (const FToast& T : Toasts) { Line(T.Text, W - 460, TY, T.Color); TY += 26; }
	if (Player && !Player->GetLastDamageSource().IsEmpty() && Player->GetHealth() < AWFCharacter::MaxHealth)
		Line(FString::Printf(TEXT("Hit by %s"), *Player->GetLastDamageSource()), W / 2 - 80, H - 160, Warn, 0.9f);

	DrawTouchControls(W, H);
}

// --- touch controls (phones): buttons that inject into the Operator's own Enhanced Input actions --------------------

namespace
{
	/** one on-screen button: the action it drives, its label, and where it sits (fractions of the screen, from the right) */
	struct FTouchButton
	{
		const TCHAR* Action;
		const TCHAR* Label;
		float Right, Bottom, Size;
	};
	// right thumb cluster (the engine's virtual sticks own the bottom corners: move on the left, look on the right)
	const FTouchButton TouchButtons[] = {
		{TEXT("Fire"), TEXT("FIRE"), 0.20f, 0.38f, 0.115f},
		{TEXT("Aim"), TEXT("AIM"), 0.33f, 0.30f, 0.085f},
		{TEXT("Jump"), TEXT("JUMP"), 0.09f, 0.50f, 0.085f},
		{TEXT("Reload"), TEXT("R"), 0.33f, 0.47f, 0.07f},
		{TEXT("Crouch"), TEXT("CROUCH"), 0.08f, 0.66f, 0.075f},
		{TEXT("NextWeapon"), TEXT("SWAP"), 0.20f, 0.58f, 0.07f},
		{TEXT("Sprint"), TEXT("SPRINT"), 0.86f, 0.52f, 0.08f},
		{TEXT("Interact"), TEXT("E"), 0.45f, 0.40f, 0.07f},
		{TEXT("Ability1"), TEXT("Q"), 0.31f, 0.86f, 0.065f},
		{TEXT("Ability2"), TEXT("F"), 0.22f, 0.86f, 0.065f},
		{TEXT("Ability3"), TEXT("X"), 0.13f, 0.86f, 0.065f},
		{TEXT("Hack"), TEXT("HACK"), 0.45f, 0.86f, 0.065f},
	};
	// driving: the left stick steers and drives (up throttle, down brake / reverse), the right stick aims the guns
	const FTouchButton DriveButtons[] = {
		{TEXT("Drive.Fire"), TEXT("FIRE"), 0.20f, 0.38f, 0.115f},
		{TEXT("Drive.Secondary"), TEXT("ALT"), 0.33f, 0.30f, 0.085f},
		{TEXT("Drive.Handbrake"), TEXT("DRIFT"), 0.09f, 0.50f, 0.085f},
		{TEXT("Drive.Boost"), TEXT("BOOST"), 0.86f, 0.52f, 0.08f},
		{TEXT("Drive.Ascend"), TEXT("UP"), 0.33f, 0.47f, 0.07f},
		{TEXT("Drive.Descend"), TEXT("DOWN"), 0.20f, 0.58f, 0.07f},
		{TEXT("Drive.Exit"), TEXT("EXIT"), 0.45f, 0.40f, 0.07f},
	};
}

UInputAction* AWFHUD::TouchActionFor(FName Id) const
{
	if (const AWFCharacter* Player = Cast<AWFCharacter>(GetOwningPawn())) return Player->GetTouchAction(Id);
	if (const AWFVehicle* Vehicle = Cast<AWFVehicle>(GetOwningPawn())) return Vehicle->GetTouchAction(Id);
	return nullptr;
}

bool AWFHUD::WantsTouchControls() const
{
	static const bool bForced = FParse::Param(FCommandLine::Get(), TEXT("touchhud")); // try the layout on a PC: -touchhud
	return bForced || FPlatformMisc::GetUseVirtualJoysticks();
}

void AWFHUD::DrawTouchControls(float W, float H)
{
	if (!WantsTouchControls()) return;
	const bool bDriving = Cast<AWFVehicle>(GetOwningPawn()) != nullptr;
	if (!bDriving && !Cast<AWFCharacter>(GetOwningPawn())) return;
	if (APlayerController* PC = GetOwningPlayerController())
	{
		// hit boxes only see touches (and, for -touchhud on a PC, clicks) with these on
		PC->bEnableTouchEvents = PC->bEnableTouchOverEvents = true;
		PC->bEnableClickEvents = PC->bEnableMouseOverEvents = true;
		// a finger that slid off its button never sends a release there: let go of any held button with no finger on it
		for (const FName& Id : HeldIds())
		{
			const FBox2D* Rect = TouchRects.Find(Id);
			bool bStillDown = false;
			for (int32 T = 0; Rect && T < 10 && !bStillDown; ++T)
			{
				float TX = 0, TY = 0;
				bool bPressed = false;
				PC->GetInputTouchState(static_cast<ETouchIndex::Type>(ETouchIndex::Touch1 + T), TX, TY, bPressed);
				bStillDown = bPressed && Rect->IsInside(FVector2D(TX, TY));
			}
			if (!bStillDown && Rect && FParse::Param(FCommandLine::Get(), TEXT("touchhud"))) // a mouse holding the button
			{
				float MX = 0, MY = 0;
				bStillDown = PC->IsInputKeyDown(EKeys::LeftMouseButton) && PC->GetMousePosition(MX, MY) && Rect->IsInside(FVector2D(MX, MY));
			}
			if (!bStillDown) ReleaseTouch(Id);
		}
	}
	const float Unit = FMath::Min(W, H);
	const TArrayView<const FTouchButton> Buttons = bDriving ? TArrayView<const FTouchButton>(DriveButtons) : TArrayView<const FTouchButton>(TouchButtons);
	for (const FTouchButton& B : Buttons)
	{
		const float Size = B.Size * Unit;
		const float X = W - B.Right * W - Size / 2, Y = H - B.Bottom * H - Size / 2;
		const FName Id(B.Action);
		const bool bHeld = HeldTouch.Contains(Id);
		DrawRect(bHeld ? FLinearColor(0.4f, 0.9f, 1.f, 0.45f) : FLinearColor(0.05f, 0.08f, 0.12f, 0.45f), X, Y, Size, Size);
		DrawRect(FLinearColor(0.4f, 0.9f, 1.f, 0.8f), X, Y, Size, 2.f); // a cyan top edge, Destiny-style
		float TW = 0, TH = 0;
		GetTextSize(B.Label, TW, TH, GEngine->GetMediumFont(), 0.8f);
		Line(B.Label, X + (Size - TW) / 2, Y + (Size - TH) / 2, Soft, 0.8f);
		AddHitBox(FVector2D(X, Y), FVector2D(Size, Size), Id, true, 1);
		TouchRects.Add(Id, FBox2D(FVector2D(X, Y), FVector2D(X + Size, Y + Size)));
	}
}

void AWFHUD::NotifyHitBoxClick(FName HitBox)
{
	Super::NotifyHitBoxClick(HitBox);
	const FName BoxName = HitBox;
	const APlayerController* PC = GetOwningPlayerController();
	UInputAction* Action = TouchActionFor(BoxName);
	UEnhancedInputLocalPlayerSubsystem* Input = PC ? ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()) : nullptr;
	if (!Action || !Input || HeldTouch.Contains(BoxName)) return;
	const FInputActionValue Value = Action->ValueType == EInputActionValueType::Boolean ? FInputActionValue(true) : FInputActionValue(1.f);
	// weapon swap is a tap (its action fires every frame it's held); everything else is held until the finger lifts:
	// Started, Triggered every frame, then Completed, like a held key
	if (BoxName == TEXT("NextWeapon")) { Input->InjectInputForAction(Action, Value, {}, {}); return; }
	Input->StartContinuousInputInjectionForAction(Action, Value, {}, {});
	HeldTouch.Add(BoxName, Action);
}

void AWFHUD::NotifyHitBoxRelease(FName HitBox)
{
	Super::NotifyHitBoxRelease(HitBox);
	ReleaseTouch(HitBox);
}

void AWFHUD::ReleaseTouch(FName BoxName)
{
	TWeakObjectPtr<UInputAction> Action;
	if (!HeldTouch.RemoveAndCopyValue(BoxName, Action)) return;
	// the action held, not looked up again: the pawn may have changed (a vehicle) since the finger went down
	const APlayerController* PC = GetOwningPlayerController();
	if (UEnhancedInputLocalPlayerSubsystem* Input = PC ? ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()) : nullptr)
		if (Action.IsValid()) Input->StopContinuousInputInjectionForAction(Action.Get());
}

void AWFHUD::EndPlay(const EEndPlayReason::Type Reason)
{
	for (const FName& Id : HeldIds()) ReleaseTouch(Id); // never leave fire or sprint held
	Super::EndPlay(Reason);
}

// ---------------------------------------------------------------- GPS

namespace
{
	const FLinearColor GpsRoad(0.42f, 0.44f, 0.5f), GpsRing(0.2f, 0.62f, 0.85f), GpsPlaza(0.55f, 0.47f, 0.22f);
	const FLinearColor GpsRoute(0.1f, 1.f, 0.65f), GpsRoutePlaza(1.f, 0.78f, 0.2f), GpsBuilding(0.3f, 0.3f, 0.42f), GpsPin(1.f, 0.3f, 0.35f);

	/** Liang-Barsky: clips the segment to the box; false if none of it is inside */
	bool ClipToBox(double L, double T, double R, double B, FVector2D& P0, FVector2D& P1)
	{
		const double Dx = P1.X - P0.X, Dy = P1.Y - P0.Y;
		const double P[4] = {-Dx, Dx, -Dy, Dy};
		const double Q[4] = {P0.X - L, R - P0.X, P0.Y - T, B - P0.Y};
		double T0 = 0, T1 = 1;
		for (int32 I = 0; I < 4; ++I)
		{
			if (P[I] == 0) { if (Q[I] < 0) return false; continue; }
			const double U = Q[I] / P[I];
			if (P[I] < 0) T0 = FMath::Max(T0, U);
			else T1 = FMath::Min(T1, U);
			if (T0 > T1) return false;
		}
		const FVector2D A = P0;
		P0 = A + FVector2D(Dx, Dy) * T0;
		P1 = A + FVector2D(Dx, Dy) * T1;
		return true;
	}

	float GpsF(double V) { return static_cast<float>(V); }

	/** a footprint's four corners (web rotation.y: local x -> (cos, -sin), local z -> (sin, cos)) */
	void Corners(const wf::gps::FRect& R, FVector2D Out[4])
	{
		const double C = FMath::Cos(R.Rot), S = FMath::Sin(R.Rot);
		const double L[4][2] = {{-R.HalfX, -R.HalfZ}, {R.HalfX, -R.HalfZ}, {R.HalfX, R.HalfZ}, {-R.HalfX, R.HalfZ}};
		for (int32 I = 0; I < 4; ++I) Out[I] = FVector2D(R.X + L[I][0] * C + L[I][1] * S, R.Z - L[I][0] * S + L[I][1] * C);
	}

	FString ManeuverLabel(const wf::gps::FManeuver& M) { return UTF8_TO_TCHAR(M.Text().c_str()); }
}

void AWFHUD::DrawGpsMinimap(float W, float H, const AWFGpsNavigator& Gps)
{
	double Px = 0, Pz = 0, Yaw = 0;
	if (!Gps.GetPlayer(Px, Pz, Yaw)) return;
	const float Size = 240.f, Scale = 1.5f; // 160 m across
	const float L = W - 30.f - Size, T = H - 150.f - Size, R = L + Size, B = T + Size;
	const FVector2D C(L + Size / 2, T + Size / 2);
	const double Th = FMath::DegreesToRadians(Yaw);
	const FVector2D Fwd(FMath::Cos(Th), FMath::Sin(Th)), Right(-FMath::Sin(Th), FMath::Cos(Th));
	// heading-up: the camera's forward is up, its right is right (screen y grows downward like world z)
	auto ToScreen = [&](double X, double Z) {
		const FVector2D D(X - Px, Z - Pz);
		return C + FVector2D(FVector2D::DotProduct(D, Right), -FVector2D::DotProduct(D, Fwd)) * Scale;
	};
	auto Seg = [&](FVector2D A, FVector2D Bp, const FLinearColor& Color, float Thick) {
		if (ClipToBox(L, T, R, B, A, Bp)) DrawLine(GpsF(A.X), GpsF(A.Y), GpsF(Bp.X), GpsF(Bp.Y), Color, Thick);
	};

	DrawRect(FLinearColor(0.02f, 0.03f, 0.05f, 0.8f), L, T, Size, Size);
	const double Reach = static_cast<double>(Size / Scale); // only what can be on the map
	for (const wf::gps::FRect& Foot : Gps.GetFootprints())
	{
		if (FMath::Abs(Foot.X - Px) > Reach || FMath::Abs(Foot.Z - Pz) > Reach) continue;
		FVector2D Q[4];
		Corners(Foot, Q);
		for (int32 I = 0; I < 4; ++I) Seg(ToScreen(Q[I].X, Q[I].Y), ToScreen(Q[(I + 1) % 4].X, Q[(I + 1) % 4].Y), GpsBuilding, 1.f);
	}
	const auto& Nodes = Gps.GetGraph().Nodes();
	for (const wf::gps::FEdge& E : Gps.GetGraph().Edges())
	{
		const wf::gps::FNode& A = Nodes[static_cast<size_t>(E.A)];
		const wf::gps::FNode& Bn = Nodes[static_cast<size_t>(E.B)];
		const bool bPlaza = E.Kind == wf::gps::EEdgeKind::Plaza;
		const bool bRing = E.Kind == wf::gps::EEdgeKind::Ring;
		Seg(ToScreen(A.X, A.Z), ToScreen(Bn.X, Bn.Z), bPlaza ? GpsPlaza : bRing ? GpsRing : GpsRoad, bPlaza ? 2.f : bRing ? 5.f : 7.f);
	}
	const wf::gps::FRoute& Route = Gps.GetRoute();
	if (Gps.HasPin() && Route.bValid)
		for (size_t I = 0; I + 1 < Route.Points.size(); ++I)
			Seg(ToScreen(Route.Points[I].X, Route.Points[I].Z), ToScreen(Route.Points[I + 1].X, Route.Points[I + 1].Z),
				Route.Kinds[I] == wf::gps::EEdgeKind::Plaza ? GpsRoutePlaza : GpsRoute, 4.f);
	if (Gps.HasPin())
	{
		// the pin, held to the edge when it is off the map
		FVector2D P = ToScreen(Gps.GetPin().X, Gps.GetPin().Z);
		const FVector2D D = P - C;
		const float Edge = Size / 2 - 8;
		const float Over = FMath::Max(FMath::Abs(D.X), FMath::Abs(D.Y)) / Edge;
		if (Over > 1) P = C + D / Over;
		DrawRect(GpsPin, GpsF(P.X) - 5, GpsF(P.Y) - 5, 10, 10);
	}
	// north marker on the rim, the player arrow in the middle, the frame
	{
		const FVector2D Dn(FVector2D::DotProduct(FVector2D(0, -1), Right), -FVector2D::DotProduct(FVector2D(0, -1), Fwd));
		const FVector2D Np = C + Dn.GetSafeNormal() * (Size / 2 - 12);
		Line(TEXT("N"), GpsF(Np.X) - 5, GpsF(Np.Y) - 9, Gold, 0.9f);
	}
	const float Cx = GpsF(C.X), Cy = GpsF(C.Y);
	DrawLine(Cx, Cy - 10, Cx - 7, Cy + 8, FLinearColor::White, 3.f);
	DrawLine(Cx, Cy - 10, Cx + 7, Cy + 8, FLinearColor::White, 3.f);
	DrawLine(Cx - 7, Cy + 8, Cx, Cy + 3, FLinearColor::White, 3.f);
	DrawLine(Cx + 7, Cy + 8, Cx, Cy + 3, FLinearColor::White, 3.f);
	DrawLine(L, T, R, T, Cyan, 1.5f);
	DrawLine(R, T, R, B, Cyan, 1.5f);
	DrawLine(R, B, L, B, Cyan, 1.5f);
	DrawLine(L, B, L, T, Cyan, 1.5f);
	Line(TEXT("[M] CITY MAP"), L, B + 4, Soft, 0.75f);

	// the next instruction above the map
	if (!Gps.HasPin() || !Route.bValid) return;
	const wf::gps::FGuidance& G = Gps.GetGuidance();
	const FString Remaining = UTF8_TO_TCHAR(wf::gps::FormatDistance(G.Remaining).c_str());
	if (G.Next)
	{
		const bool bArriving = G.Next->Type == wf::gps::EManeuver::Arrive;
		const FString Step = bArriving ? FString(TEXT("ARRIVE")) : ManeuverLabel(*G.Next).ToUpper();
		Line(FString::Printf(TEXT("%s   %s"), *Step, UTF8_TO_TCHAR(wf::gps::FormatDistance(G.ToNext).c_str())), L, T - 58, GpsRoute, 1.1f);
	}
	Line(FString::Printf(TEXT("%s  -  %s  -  %d min"), *Gps.GetPin().Label, *Remaining, wf::gps::EtaMinutes(G.Remaining, Gps.GetSpeed())), L, T - 30, Soft, 0.8f);
	if (G.OffRoute > wf::gps::OffRouteDistance) Line(TEXT("Recalculating..."), L, T - 80, Warn, 0.85f);
}

void AWFHUD::DrawGpsMap(float W, float H, AWFGpsNavigator& Gps)
{
	DrawRect(FLinearColor(0.01f, 0.015f, 0.03f, 0.92f), 0, 0, W, H);
	const auto& Nodes = Gps.GetGraph().Nodes();
	// fit the street network (plus a margin) into the area right of the list
	double MinX = TNumericLimits<double>::Max(), MinZ = MinX, MaxX = -MinX, MaxZ = -MinX;
	for (const wf::gps::FNode& N : Nodes) { MinX = FMath::Min(MinX, N.X); MaxX = FMath::Max(MaxX, N.X); MinZ = FMath::Min(MinZ, N.Z); MaxZ = FMath::Max(MaxZ, N.Z); }
	MinX -= 20; MinZ -= 20; MaxX += 20; MaxZ += 20;
	const float AreaL = 420.f, AreaT = 70.f, AreaW = FMath::Max(100.f, W - AreaL - 40.f), AreaH = FMath::Max(100.f, H - AreaT - 60.f);
	const double Scale = FMath::Min(static_cast<double>(AreaW) / (MaxX - MinX), static_cast<double>(AreaH) / (MaxZ - MinZ));
	FWFGpsMapView View;
	View.bValid = true;
	View.Scale = Scale;
	View.Width = GpsF((MaxX - MinX) * Scale);
	View.Height = GpsF((MaxZ - MinZ) * Scale);
	View.Left = AreaL + (AreaW - View.Width) / 2;
	View.Top = AreaT + (AreaH - View.Height) / 2;
	View.MinX = MinX;
	View.MinZ = MinZ;
	Gps.SetMapView(View);
	auto ToScreen = [&](double X, double Z) { return FVector2D(View.Left + (X - MinX) * Scale, View.Top + (Z - MinZ) * Scale); };
	auto Seg = [&](const FVector2D& A, const FVector2D& B, const FLinearColor& Color, float Thick) { DrawLine(GpsF(A.X), GpsF(A.Y), GpsF(B.X), GpsF(B.Y), Color, Thick); };

	DrawRect(FLinearColor(0.03f, 0.045f, 0.07f, 1.f), View.Left, View.Top, View.Width, View.Height);
	for (const wf::gps::FRect& Foot : Gps.GetFootprints())
	{
		FVector2D Q[4];
		Corners(Foot, Q);
		for (int32 I = 0; I < 4; ++I) Seg(ToScreen(Q[I].X, Q[I].Y), ToScreen(Q[(I + 1) % 4].X, Q[(I + 1) % 4].Y), GpsBuilding, 1.f);
	}
	const float RoadPx = FMath::Max(3.f, GpsF(7.0 * Scale)), RingPx = FMath::Max(3.f, GpsF(4.4 * Scale)); // street 7 m, ring road 4.4 m
	for (const wf::gps::FEdge& E : Gps.GetGraph().Edges())
	{
		const wf::gps::FNode& A = Nodes[static_cast<size_t>(E.A)];
		const wf::gps::FNode& B = Nodes[static_cast<size_t>(E.B)];
		const bool bPlaza = E.Kind == wf::gps::EEdgeKind::Plaza;
		const bool bRing = E.Kind == wf::gps::EEdgeKind::Ring;
		Seg(ToScreen(A.X, A.Z), ToScreen(B.X, B.Z), bPlaza ? GpsPlaza : bRing ? GpsRing : GpsRoad, bPlaza ? 2.f : bRing ? RingPx : RoadPx);
	}
	const wf::gps::FRoute& Route = Gps.GetRoute();
	if (Gps.HasPin() && Route.bValid)
		for (size_t I = 0; I + 1 < Route.Points.size(); ++I)
			Seg(ToScreen(Route.Points[I].X, Route.Points[I].Z), ToScreen(Route.Points[I + 1].X, Route.Points[I + 1].Z),
				Route.Kinds[I] == wf::gps::EEdgeKind::Plaza ? GpsRoutePlaza : GpsRoute, 4.f);

	// destinations: numbered dots, the selected one named on the map
	const TArray<FWFGpsDestination>& Dests = Gps.GetDestinations();
	for (int32 I = 0; I < Dests.Num(); ++I)
	{
		const FVector2D P = ToScreen(Dests[I].X, Dests[I].Z);
		const bool bSel = I == Gps.GetSelected();
		const FLinearColor Col = Dests[I].Kind == TEXT("SHOP") ? Gold : Dests[I].Kind == TEXT("DISTRICT") ? GpsRing : Cyan;
		DrawRect(bSel ? FLinearColor::White : Col, GpsF(P.X) - (bSel ? 5.f : 3.f), GpsF(P.Y) - (bSel ? 5.f : 3.f), bSel ? 10.f : 6.f, bSel ? 10.f : 6.f);
		if (bSel) Line(Dests[I].Label, GpsF(P.X) + 10, GpsF(P.Y) - 10, FLinearColor::White, 0.9f);
	}
	if (Gps.HasPin())
	{
		const FVector2D P = ToScreen(Gps.GetPin().X, Gps.GetPin().Z);
		DrawRect(GpsPin, GpsF(P.X) - 6, GpsF(P.Y) - 6, 12, 12);
	}
	double Px = 0, Pz = 0, Yaw = 0;
	if (Gps.GetPlayer(Px, Pz, Yaw))
	{
		const FVector2D P = ToScreen(Px, Pz);
		const double Th = FMath::DegreesToRadians(Yaw);
		const FVector2D Dir(FMath::Cos(Th), FMath::Sin(Th)), Rt(-FMath::Sin(Th), FMath::Cos(Th));
		const FVector2D Tip = P + Dir * 12, BackL = P - Dir * 8 - Rt * 7, BackR = P - Dir * 8 + Rt * 7;
		Seg(Tip, BackL, FLinearColor::White, 3.f);
		Seg(Tip, BackR, FLinearColor::White, 3.f);
		Seg(BackL, P - Dir * 3, FLinearColor::White, 3.f);
		Seg(BackR, P - Dir * 3, FLinearColor::White, 3.f);
	}

	// the list
	float Y = 40.f;
	Line(TEXT("NEXUS CITY  /  GPS"), 40, Y, Cyan, 1.3f);
	Y += 44;
	for (int32 I = 0; I < Dests.Num(); ++I)
	{
		const bool bSel = I == Gps.GetSelected();
		if (bSel) DrawRect(FLinearColor(0.1f, 0.3f, 0.38f, 0.8f), 34, Y - 2, 360, 24);
		const FString Tag = Dests[I].Kind == TEXT("SHOP") ? TEXT("shop") : Dests[I].Kind == TEXT("DISTRICT") ? TEXT("streets") : TEXT("place");
		Line(FString::Printf(TEXT("%2d  %s"), I + 1, *Dests[I].Label), 40, Y, bSel ? FLinearColor::White : Soft, 0.9f);
		Line(Tag, 330, Y + 2, FLinearColor(0.55f, 0.6f, 0.65f), 0.75f);
		Y += 26;
	}
	Y += 16;
	if (Gps.HasPin() && Route.bValid)
	{
		Line(FString::Printf(TEXT("ROUTE: %s"), *Gps.GetPin().Label), 40, Y, GpsRoute, 0.95f);
		Y += 24;
		Line(FString::Printf(TEXT("%s  -  about %d min"), UTF8_TO_TCHAR(wf::gps::FormatDistance(Route.Length).c_str()), wf::gps::EtaMinutes(Route.Length, Gps.GetSpeed())), 40, Y, Soft, 0.85f);
		Y += 24;
		for (const wf::gps::FManeuver& M : Route.Maneuvers)
		{
			if (M.Type == wf::gps::EManeuver::Depart) continue;
			if (Y > H - 120) break;
			Line(FString::Printf(TEXT("%6s   %s"), UTF8_TO_TCHAR(wf::gps::FormatDistance(M.AtDistance).c_str()), *ManeuverLabel(M)), 40, Y, Soft, 0.8f);
			Y += 20;
		}
	}
	Line(TEXT("Up / Down choose   Enter route   Click map: custom waypoint   Backspace clear   M close"), 40, H - 40, FLinearColor(0.6f, 0.65f, 0.7f), 0.8f);
	float Lx = AreaL;
	for (const TPair<const TCHAR*, FLinearColor>& Key : {TPair<const TCHAR*, FLinearColor>(TEXT("streets"), GpsRoad), TPair<const TCHAR*, FLinearColor>(TEXT("ring road"), GpsRing),
			 TPair<const TCHAR*, FLinearColor>(TEXT("plaza crossing"), GpsPlaza), TPair<const TCHAR*, FLinearColor>(TEXT("route"), GpsRoute), TPair<const TCHAR*, FLinearColor>(TEXT("waypoint"), GpsPin)})
	{
		DrawRect(Key.Value, Lx, AreaT - 23, 18, 6);
		Line(Key.Key, Lx + 24, AreaT - 30, Soft, 0.8f);
		Lx += 150;
	}
}
