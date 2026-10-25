#include "WFHUD.h"

#include "Engine/GameInstance.h"

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
#include "WFRaceSubsystem.h"

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
			auto Bar = [](double Fraction, int32 Cells) { FString B; const int32 Full = FMath::Clamp(FMath::RoundToInt32(Fraction * Cells), 0, Cells); for (int32 I = 0; I < Cells; ++I) B += I < Full ? TEXT("#") : TEXT("-"); return B; };
			const float X = W * 0.5f - 230.f;
			Line(FString::Printf(TEXT("%s  -  %s"), *Name.ToUpper(), *Phase), X, 28, Gold, 1.1f);
			Line(FString::Printf(TEXT("[%s] %d%%"), *Bar(HpFrac, 40), FMath::RoundToInt32(HpFrac * 100)), X, 52, Warn);
			if (!Windup.IsEmpty()) Line(FString::Printf(TEXT("%s  [%s]"), *Windup.ToUpper(), *Bar(Progress, 20)), X, 74, FLinearColor(1.f, 0.3f, 0.25f), 1.05f);
		}
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
		if (Arm.Primary || Arm.Secondary || Arm.SecondaryGun)
		{
			const wf::vweapons::FHeat& Heat = Vehicle->GetHeat();
			FString Guns = Arm.Primary ? FString::Printf(TEXT("LMB %s"), UTF8_TO_TCHAR(Arm.Primary->Name.c_str())) : FString();
			if (Arm.SecondaryGun) Guns += FString::Printf(TEXT("   RMB %s"), UTF8_TO_TCHAR(Arm.SecondaryGun->Name.c_str()));
			else if (Arm.Secondary) Guns += FString::Printf(TEXT("   RMB %s x%d"), UTF8_TO_TCHAR(Arm.Secondary->Name.c_str()), Arm.Secondary->Salvo);
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
			Line(FString::Printf(TEXT("%s  %s  %d / %d"), O.bComplete ? TEXT("[x]") : TEXT("[ ]"), *O.Label, FMath::FloorToInt32(O.Progress), FMath::FloorToInt32(O.Amount)), 40, Y, O.bComplete ? Cyan : Soft, 0.9f);
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
