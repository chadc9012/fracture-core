// World Fracture — weapon foundries and on-foot weapon heat.
//
// Port of the web build's authoritative rules:
//   foundries.ts  foundryOf (a weapon's foundry from its name, else a stable hash), FOUNDRY_RULES
//   Scene.tsx     the foundry rules the fire loop applies: Omolon -25% heat per shot, SUROS -30% recoil, Tex Mechanica +25%
//                 damage from the hip
//   sim.ts        fireBullet / fireLauncher on foot: HEAT_PER_SHOT_FOOT 7 x the weapon's heat (split across a shotgun's pellets),
//                 refused while venting; the shared gauge (one for on foot and every vehicle gun) overheats at 100 and vents
//                 (wf::vweapons::AddHeat / CoolHeat). Häkke +20% bullet damage to elites and bosses, Black Armory's nanite hop.
// Golden-tested (Tests/GodforgeCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"
#include "Core/WFVehicleWeaponsCore.h"

#include <string>

namespace wf::foundry
{
	/** OMOLON | HAKKE | SUROS | TEX_MECHANICA | BLACK_ARMORY, or "" for armor, vehicles and nothing */
	WORLDFRACTURECORE_API std::string FoundryOf(const FGearItem* Item);
	WORLDFRACTURECORE_API std::string FoundryOfName(const std::string& Name, const std::string& Slot);
	struct FRules { double OmolonHeat = 0.75, HakkeArmored = 1.2, SurosRecoil = 0.7, TexHip = 1.25, NaniteDamage = 1.5, NaniteRange = 10; };
	inline constexpr FRules Rules{};
	/** Scene.tsx: what the equipped weapon's foundry does to the next trigger pull */
	struct FFootRules { double HeatMult = 1, RecoilMult = 1, HipMult = 1; };
	WORLDFRACTURECORE_API FFootRules FootRules(const std::string& Foundry, bool bAiming);

	/** One trigger pull of an on-foot gun: each pellet adds 7 x WeaponHeat x HeatMult / Pellets and is refused once the gauge is
	 *  venting (a shotgun can tip it mid-spread). Returns the pellets that fired; bTipped says the pull caused an overheat. */
	WORLDFRACTURECORE_API int FireFootBullets(vweapons::FHeat& H, double WeaponHeat, double HeatMult, int Pellets, bool& bTipped);
	/** an on-foot launcher round: 7 x WeaponHeat x HeatMult, refused while venting */
	WORLDFRACTURECORE_API bool FireFootLauncher(vweapons::FHeat& H, double WeaponHeat, double HeatMult, bool& bTipped);
}
