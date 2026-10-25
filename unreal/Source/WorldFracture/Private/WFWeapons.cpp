#include "WFWeapons.h"

#include "WFDataFiles.h"

namespace WFWeapons
{
	TArray<FWFWeaponStats> LoadGuns(FString& OutError)
	{
		TArray<FWFWeaponStats> Out;
		TArray<TSharedPtr<FJsonObject>> Rows;
		if (!WFData::LoadRows(TEXT("Weapons"), Rows, OutError)) return Out;
		// The web build's slot order: primary rifles first, then the sidearm and shotgun, then heavies.
		static const TCHAR* Order[] = {TEXT("AUTO"), TEXT("PULSE"), TEXT("SIDEARM"), TEXT("SHOTGUN"), TEXT("HEAVY")};
		for (const TCHAR* Id : Order)
			for (const TSharedPtr<FJsonObject>& Row : Rows)
			{
				if (WFData::Str(Row, TEXT("Id")) != Id || WFData::Str(Row, TEXT("Kind")) != TEXT("gun")) continue;
				FWFWeaponStats W;
				W.Id = Id;
				W.Name = WFData::Str(Row, TEXT("DisplayName"));
				W.Kind = WFData::Str(Row, TEXT("Kind"));
				W.Damage = WFData::Num(Row, TEXT("Damage"), 1);
				W.FireRate = WFData::Num(Row, TEXT("FireRate"), 0.2);
				W.Burst = FMath::Max(1, static_cast<int32>(WFData::Num(Row, TEXT("Burst"), 1)));
				W.BurstGap = WFData::Num(Row, TEXT("BurstGap"), 0);
				W.Spread = WFData::Num(Row, TEXT("Spread"), 0.03);
				W.AdsSpread = WFData::Num(Row, TEXT("AdsSpread"), 0.4);
				W.Recoil = WFData::Num(Row, TEXT("Recoil"), 0.01);
				W.Mag = static_cast<int32>(WFData::Num(Row, TEXT("Mag"), 30));
				W.Reserve = static_cast<int32>(WFData::Num(Row, TEXT("Reserve"), 120));
				W.Reload = WFData::Num(Row, TEXT("Reload"), 1.6);
				W.Pellets = FMath::Max(1, static_cast<int32>(WFData::Num(Row, TEXT("Pellets"), 1)));
				Out.Add(W);
			}
		if (Out.IsEmpty()) OutError = TEXT("Weapons.json has none of AUTO, PULSE, SIDEARM, SHOTGUN, HEAVY");
		return Out;
	}
}
