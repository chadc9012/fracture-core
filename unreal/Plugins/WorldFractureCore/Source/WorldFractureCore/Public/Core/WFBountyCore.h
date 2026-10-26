// World Fracture — activity bounties in Nex: bosses, strikes, dungeons and raids pay a first clear and a daily repeat, each
// operator on their own; plus the flat exploration payouts.
//
// Port of the web build's authoritative rules in activity-payouts.ts: PAYOUTS, BOSS_RANK, payoutFor / payInto /
// claimBossBounty (ledger keys payout:<class>:<id>#<OPERATOR>:<first:YYYY-MM-DD|YYYY-MM-DD>), tagLegacyPayouts, payFlat.
// Golden-tested (Tests/BountyCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"

#include <map>
#include <optional>
#include <string>

namespace wf::bounty
{
	using FLedger = std::map<std::string, double>;
	struct FRates { double First = 0, Repeat = 0; };
	/** boss | strike | dungeon | raid */
	WORLDFRACTURECORE_API FRates RatesFor(const std::string& Class);
	/** later campaign bosses pay more (dark-knight 1 ... vyrak 2); unranked bosses 1 */
	WORLDFRACTURECORE_API double BossRank(const std::string& BossId);
	/** the UTC calendar day of a time in ms since the epoch, YYYY-MM-DD (JavaScript toISOString().slice(0, 10)) */
	WORLDFRACTURECORE_API std::string DayOf(double NowMs);

	struct FPayout { std::string Key; double Nex = 0; bool bFirst = false; };
	/** what a clear pays right now and the ledger key it is recorded under; nullopt when today's payout is already taken */
	WORLDFRACTURECORE_API std::optional<FPayout> PayoutFor(const FLedger& Ledger, const std::string& Class, const std::string& Id, double NowMs, double Mult = 1, const std::string& Operator = "");
	/** pay it into the ledger; 0 when already taken today */
	WORLDFRACTURECORE_API FPayout PayInto(FLedger& Ledger, const std::string& Class, const std::string& Id, double NowMs, double Mult = 1, const std::string& Operator = "");
	inline FPayout ClaimBossBounty(FLedger& Ledger, const std::string& ScenarioId, double NowMs, const std::string& Operator) { return PayInto(Ledger, "boss", ScenarioId, NowMs, 1, Operator); }
	/** older saves recorded payouts untagged: they belong to the operator who was being played */
	WORLDFRACTURECORE_API bool TagLegacyPayouts(FLedger& Ledger, const std::string& Operator);
	/** record one flat payout under Key (nothing when the key is already there) */
	WORLDFRACTURECORE_API bool PayFlat(FLedger& Ledger, const std::string& Key, double Nex);
}
