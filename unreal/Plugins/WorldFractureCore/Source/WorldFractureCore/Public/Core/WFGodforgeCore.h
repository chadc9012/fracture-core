// World Fracture — the Godforge: Vael, the Last Forgewright, and her hidden forge under the Hollow Crown, and the Living Secret
// World whose three Forgewright's Marks open it.
//   I   The Sealed Door   — find the three Forgewright's Marks (secrets forge-mark-1..3, in Frostspire, Ember Peaks, the Wastelands).
//   II  Furnace Guardian  — walking into the opened Hollow Crown wakes the Furnace Guardian; its kill pays the Heart of the Hollow
//                           Crown and two forge catalysts.
//   III The Godforge      — at Vael: forge a relic, socket runes (some conflict), ascend it (more sockets, more power), awaken it
//                           with 100 kills, collect rune dust.
//
// Port of the web build's authoritative rules:
//   godforge.ts  HOLLOW_CROWN / VAEL, forgeStage, marksFound, guardianDue, vaelNear, RUNES, CONFLICTS, conflictOf, runeUnlocked,
//                TIERS, RELIC_DESIGNS, forgeRelic, relicElement, socketRune, removeRune, ascendRelic, recordRelicKills,
//                runeDustEarned, collectRuneDust, runeCombat (and its multipliers), claimHeart
//   secrets.ts   SECRETS, secretPoint, conditionHolds, senseSecret, claimSecret (with the activity-payouts.ts secret payout)
// The premium store is disabled in the web build (PREMIUM_STORE_ENABLED false) and is not ported. Golden-tested
// (Tests/GodforgeCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <cmath>
#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace wf::godforge
{
	using FCost = std::vector<std::pair<std::string, double>>; // material -> amount, in the web build's key order

	// ---- the place (Wastelands centre -300, 180, radius 252: the Hollow Crown sits 0.12 r east, 0.55 r south) ----
	inline constexpr double HollowCrownX = -300 + 252 * 0.12, HollowCrownZ = 180 + 252 * 0.55, HollowCrownRadius = 14;
	inline constexpr double VaelX = HollowCrownX - 3, VaelZ = HollowCrownZ - 4, VaelReach = 3.6;
	inline const std::string GuardianTag = "godforge-guardian", HeartKey = "godforge:heart";
	inline constexpr double GuardianHp = 60; // x the challenge's enemy health

	WORLDFRACTURECORE_API std::string ForgeStage(const FProgression& P); // SEALED | DOOR | GUARDIAN_SLAIN
	WORLDFRACTURECORE_API int MarksFound(const FProgression& P);
	WORLDFRACTURECORE_API bool GuardianDue(const FProgression& P, double X, double Z);
	WORLDFRACTURECORE_API bool VaelNear(const FProgression& P, double X, double Z);

	// ---- runes ----
	struct FRune
	{
		std::string Id, Name, Text;
		std::string Burst, Element; // "" = none
		std::string UnlockKind;     // secret | nemesis | heart
		std::string UnlockId;
		int UnlockCount = 0;
		std::string UnlockLabel;
	};
	WORLDFRACTURECORE_API const std::vector<FRune>& Runes(); // RUNE_ORDER
	WORLDFRACTURECORE_API const FRune* RuneById(const std::string& Id);
	/** the socketed rune Rune cannot share a weapon with, or "" */
	WORLDFRACTURECORE_API std::string ConflictOf(const std::string& Rune, const std::vector<std::string>& Runes);
	WORLDFRACTURECORE_API int NemesesSlain(const FProgression& P);
	WORLDFRACTURECORE_API bool RuneUnlocked(const FProgression& P, const std::string& Rune);

	// ---- relics ----
	struct FTier { std::string Id, Label; int Sockets = 1; double Power = 0; std::string Next; FCost Cost; double Shards = 0; std::string Requires; int NemesesSlain = 0; };
	WORLDFRACTURECORE_API const std::vector<FTier>& Tiers();
	WORLDFRACTURECORE_API const FTier* TierById(const std::string& Id);
	inline constexpr double AwakenKills = 100, AwakenPower = 30, HeartCatalysts = 2;
	struct FRelicDesign { std::string Id, Name, Slot, Blurb; };
	WORLDFRACTURECORE_API const std::vector<FRelicDesign>& Designs();

	/** a forge action: the new save and Vael's line, or why it was refused */
	struct FForgeResult { bool bOk = false; FProgression Progression; std::string Message; std::string Error; };
	/** the item id is god-<design>-<now in base 36>: NowMs should be a whole number of milliseconds */
	WORLDFRACTURECORE_API FForgeResult ForgeRelic(const FProgression& P, const std::string& DesignId, double NowMs);
	/** the element follows the first rune that has one (so the weapon hits like its runes); otherwise kinetic */
	WORLDFRACTURECORE_API std::string RelicElement(const std::vector<std::string>& Runes);
	WORLDFRACTURECORE_API FForgeResult SocketRune(const FProgression& P, const std::string& ItemId, const std::string& Rune);
	WORLDFRACTURECORE_API FForgeResult RemoveRune(const FProgression& P, const std::string& ItemId, const std::string& Rune);
	WORLDFRACTURECORE_API FForgeResult AscendRelic(const FProgression& P, const std::string& ItemId);
	/** mastery: kills with the relic in hand; at 100 it awakens (+30 power) once. Message is set when it awakens. */
	WORLDFRACTURECORE_API FForgeResult RecordRelicKills(const FProgression& P, const std::string& ItemId, double Kills);
	WORLDFRACTURECORE_API double RuneDustEarned(const FProgression& P);
	WORLDFRACTURECORE_API FForgeResult CollectRuneDust(const FProgression& P);
	/** the Furnace Guardian fell: the Heart and two forge catalysts, once */
	WORLDFRACTURECORE_API FForgeResult ClaimHeart(const FProgression& P);

	/** combat rules for the relic in hand (sim.ts reads them each frame) */
	struct FRuneCombat { std::vector<std::string> Bursts; bool bDevour = false, bRift = false, bWard = false, bReap = false, bAwakened = false; };
	WORLDFRACTURECORE_API FRuneCombat RuneCombat(const FGearItem::FGodforge* G);
	inline constexpr int DevourEvery = 8;
	inline constexpr double DevourMult = 2.5, RiftMult = 1.25, WardMult = 0.85, ReapHeal = 6, AwakenedMult = 1.1;
	/** sim.ts runeDamageMult without the bursts: awakened x1.1, every 8th hit with Devour x2.5, Rift x1.25 on elites and bosses.
	 *  DevourHits is the running count (reset when the relic in hand changes). */
	WORLDFRACTURECORE_API double RuneDamageMult(const FRuneCombat& R, int& DevourHits, bool bEliteOrBoss);

	/** Scene.tsx nightFactor of the day fraction (hour / 24): secrets that answer at night want more than 0.5 */
	inline double NightFactor(double DayFraction)
	{
		const double Theta = std::fmod(std::fmod(DayFraction, 1.0) + 1.0, 1.0) * 3.141592653589793 * 2 - 3.141592653589793 / 2;
		const double V = -std::sin(Theta) * 1.2 + 0.15;
		return V < 0 ? 0 : V > 1 ? 1 : V;
	}

	// ---- secrets.ts ----
	struct FSecret
	{
		std::string Id, RegionId, Name;
		double Fx = 0, Fz = 0; // a fraction of the region radius from its centre (north = -z)
		std::string Condition; // ALWAYS | NIGHT | STORM | NEMESIS_SLAIN | PLEDGED | FRAGMENTS
		std::string Locked, Lore;
		FCost Reward;
		double Shards = 0;
	};
	WORLDFRACTURECORE_API const std::vector<FSecret>& Secrets();
	WORLDFRACTURECORE_API const std::string& ConditionText(const std::string& Condition);
	inline constexpr double SecretReach = 4, SecretHum = 60, SecretShimmer = 25, SecretNex = 400;
	struct FRegionCircle { double X = 0, Z = 0, Radius = 0; };
	/** where a secret is: its region's centre plus the fractions of the radius */
	WORLDFRACTURECORE_API FRegionCircle SecretPoint(const FSecret& S, const FRegionCircle& Region);
	struct FSecretContext { bool bNight = false, bStorm = false, bNemesisSlain = false, bPledged = false; };
	WORLDFRACTURECORE_API bool ConditionHolds(const std::string& Condition, const FSecretContext& Ctx, const std::vector<std::string>& Earned);
	struct FSensed { const FSecret* Secret = nullptr; double Dist = 0; bool bOpen = false; };
	/** the nearest unfound secret within 60 m of (X, Z), whether it answers now; RegionOf gives a region's circle (nullopt = unknown) */
	WORLDFRACTURECORE_API std::optional<FSensed> SenseSecret(double X, double Z, const FSecretContext& Ctx, const std::vector<std::string>& Earned,
		const std::function<std::optional<FRegionCircle>(const std::string&)>& RegionOf);
	/** claim it once: its materials and shards, the lore as a story collectible, and the Nex payout payout:secret:<id> */
	WORLDFRACTURECORE_API FForgeResult ClaimSecret(const FProgression& P, const std::string& Id, const FSecretContext& Ctx);
}
