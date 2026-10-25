#include "WFDragonSubsystem.h"

#include "Engine/GameInstance.h"
#include "WFDataFiles.h"
#include "WFProgressionSubsystem.h"

using WFData::ToF;
using WFData::ToStd;

void UWFDragonSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency<UWFProgressionSubsystem>();
	Super::Initialize(Collection);
}

UWFProgressionSubsystem* UWFDragonSubsystem::Progression() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UWFProgressionSubsystem>() : nullptr;
}

const wf::FProgression& UWFDragonSubsystem::St() const
{
	static const wf::FProgression Empty;
	const UWFProgressionSubsystem* P = Progression();
	return P ? P->Get() : Empty;
}

std::optional<std::string> UWFDragonSubsystem::OperatorClass() const { return St().IdentityClass; }

bool UWFDragonSubsystem::IsBonded() const { return wf::scenario::IsBonded(St(), OperatorClass()); }

FString UWFDragonSubsystem::UpgradeAbility(const FString& Ability)
{
	UWFProgressionSubsystem* P = Progression();
	if (!P) return TEXT("No save");
	if (!wf::dragon::FindAbility(ToStd(Ability))) return FString::Printf(TEXT("Unknown ability %s"), *Ability);
	wf::dragon::FUpgradeResult R = wf::dragon::UpgradeDragonite(P->Get(), OperatorClass(), ToStd(Ability));
	if (R.Error) return ToF(*R.Error);
	P->Mutable() = std::move(R.Progression);
	P->NotifyChanged();
	return FString();
}

int32 UWFDragonSubsystem::GetUpgradeLevel(const FString& Ability) const
{
	const std::optional<std::string> C = OperatorClass();
	return C ? wf::dragon::UpgradeLevel(St(), *C, ToStd(Ability)) : 0;
}

double UWFDragonSubsystem::GetAbilityStat(const FString& Ability, const FString& Stat) const
{
	const wf::dragon::FStats S = wf::dragon::StatsFor(St(), OperatorClass().value_or("null"), ToStd(Ability));
	const auto Found = S.find(ToStd(Stat));
	return Found == S.end() ? 0.0 : Found->second;
}

void UWFDragonSubsystem::RecordTrust(const FString& Kind, const FString& SourceId)
{
	UWFProgressionSubsystem* P = Progression();
	if (!P) return;
	P->Mutable() = wf::dragon::RecordTrust(P->Get(), OperatorClass(), ToStd(Kind), ToStd(SourceId));
	P->NotifyChanged();
}

double UWFDragonSubsystem::GetTrust() const { return wf::dragon::TrustOf(St(), OperatorClass()).Total; }
int32 UWFDragonSubsystem::GetTrustStage() const { return wf::dragon::TrustStage(St(), OperatorClass()); }

FString UWFDragonSubsystem::GetTrustStageName() const
{
	// vyrak-trust.ts STAGE_NAMES
	static const TCHAR* Names[] = {TEXT("No bond"), TEXT("The Covenant"), TEXT("The Companion"), TEXT("The Proven Covenant"), TEXT("The Ancient Bond"), TEXT("The Eternal Covenant")};
	const int32 Stage = GetTrustStage();
	return Names[FMath::Clamp(Stage, 0, 5)];
}

bool UWFDragonSubsystem::ClaimAncientBond(FString& OutReason)
{
	UWFProgressionSubsystem* P = Progression();
	if (!P) { OutReason = TEXT("No save"); return false; }
	const size_t Before = P->Get().Inventory.size();
	wf::dragon::FClaimResult R = wf::dragon::ClaimAncientBond(P->Get(), OperatorClass());
	OutReason = R.Reason ? ToF(*R.Reason) : FString();
	if (!R.bOk) return false;
	P->Mutable() = std::move(R.Progression);
	for (size_t I = Before; I < P->Get().Inventory.size(); ++I) P->OnLootGained.Broadcast(ToF(P->Get().Inventory[I].Name), ToF(P->Get().Inventory[I].Rarity.value_or("")));
	P->NotifyChanged();
	return true;
}

bool UWFDragonSubsystem::ClaimEternalCovenant()
{
	UWFProgressionSubsystem* P = Progression();
	if (!P) return false;
	const size_t Before = P->Get().Inventory.size();
	wf::dragon::FClaimResult R = wf::dragon::ClaimEternalCovenant(P->Get(), OperatorClass());
	if (!R.bOk) return false;
	P->Mutable() = std::move(R.Progression);
	for (size_t I = Before; I < P->Get().Inventory.size(); ++I) P->OnLootGained.Broadcast(ToF(P->Get().Inventory[I].Name), ToF(P->Get().Inventory[I].Rarity.value_or("")));
	P->NotifyChanged();
	return true;
}

bool UWFDragonSubsystem::CanRide(const FString& RegionId, bool bInDungeon, bool bInStoryMission, bool bIndoors, FString& OutReason) const
{
	wf::dragon::FRideContext Ctx;
	if (!RegionId.IsEmpty()) Ctx.RegionId = ToStd(RegionId);
	Ctx.bInDungeon = bInDungeon;
	Ctx.bInStoryMission = bInStoryMission;
	Ctx.bIndoors = bIndoors;
	const wf::dragon::FRideCheck R = wf::dragon::CanRide(St(), OperatorClass(), Ctx);
	OutReason = R.Reason ? ToF(*R.Reason) : FString();
	return R.bOk;
}

float UWFDragonSubsystem::GetCooldown(const FString& Ability) const
{
	const auto Found = CastRuntime.Cd.find(ToStd(Ability));
	return Found == CastRuntime.Cd.end() ? 0.f : static_cast<float>(Found->second);
}

wf::dragoncast::FContext UWFDragonSubsystem::MakeContext() const
{
	wf::dragoncast::FContext Ctx;
	Ctx.Progression = &St();
	Ctx.Class = OperatorClass();
	return Ctx;
}
