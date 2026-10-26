#include "Core/WFBountyCore.h"

#include "Core/WFJsCompat.h"

#include <cmath>
#include <cstdio>
#include <vector>

namespace wf::bounty
{
	namespace
	{
		std::string BtKey(const std::string& Class, const std::string& Id, const std::string& Tail) { return "payout:" + Class + ":" + Id + ":" + Tail; }
		bool BtEverPaid(const FLedger& L, const std::string& Class, const std::string& Id)
		{
			const std::string Prefix = "payout:" + Class + ":" + Id + ":";
			const auto It = L.lower_bound(Prefix); // the first key at or after the prefix starts with it if any does
			return It != L.end() && It->first.compare(0, Prefix.size(), Prefix) == 0;
		}
		/** days since 1970-01-01 to a civil date (Howard Hinnant's days_from_civil inverse) */
		void BtCivil(long long Z, long long& Y, unsigned& M, unsigned& D)
		{
			Z += 719468;
			const long long Era = (Z >= 0 ? Z : Z - 146096) / 146097;
			const unsigned Doe = static_cast<unsigned>(Z - Era * 146097);
			const unsigned Yoe = (Doe - Doe / 1460 + Doe / 36524 - Doe / 146096) / 365;
			Y = static_cast<long long>(Yoe) + Era * 400;
			const unsigned Doy = Doe - (365 * Yoe + Yoe / 4 - Yoe / 100);
			const unsigned Mp = (5 * Doy + 2) / 153;
			D = Doy - (153 * Mp + 2) / 5 + 1;
			M = Mp < 10 ? Mp + 3 : Mp - 9;
			if (M <= 2) ++Y;
		}
	}

	FRates RatesFor(const std::string& Class)
	{
		if (Class == "boss") return {800, 350};
		if (Class == "strike") return {700, 300};
		if (Class == "dungeon") return {1500, 600};
		if (Class == "raid") return {12000, 4000};
		return {0, 0};
	}

	double BossRank(const std::string& BossId)
	{
		if (BossId == "dark-knight") return 1;
		if (BossId == "rime-alpha") return 1.25;
		if (BossId == "drowned-monarch") return 1.5;
		if (BossId == "hollow-saint") return 1.75;
		if (BossId == "vyrak") return 2;
		return 1;
	}

	std::string DayOf(double NowMs)
	{
		const long long Days = static_cast<long long>(std::floor(NowMs / 86400000.0));
		long long Y = 0;
		unsigned M = 0, D = 0;
		BtCivil(Days, Y, M, D);
		char Buf[48];
		std::snprintf(Buf, sizeof Buf, "%04lld-%02u-%02u", Y, M, D);
		return Buf;
	}

	std::optional<FPayout> PayoutFor(const FLedger& Ledger, const std::string& Class, const std::string& RawId, double NowMs, double Mult, const std::string& Operator)
	{
		const std::string Id = Operator.empty() ? RawId : RawId + "#" + Operator;
		const bool bFirst = !BtEverPaid(Ledger, Class, Id);
		const std::string Day = DayOf(NowMs);
		// the first clear is recorded with its day, so it also uses up that day's repeat (no double-dip on day one)
		const std::string Key = bFirst ? BtKey(Class, Id, "first:" + Day) : BtKey(Class, Id, Day);
		if (Ledger.count(Key) || Ledger.count(BtKey(Class, Id, "first:" + Day))) return std::nullopt;
		const FRates R = RatesFor(Class);
		const double Base = bFirst ? R.First : R.Repeat;
		return FPayout{Key, js::Round(Base * Mult * (Class == "boss" ? BossRank(RawId) : 1)), bFirst};
	}

	FPayout PayInto(FLedger& Ledger, const std::string& Class, const std::string& Id, double NowMs, double Mult, const std::string& Operator)
	{
		const std::optional<FPayout> P = PayoutFor(Ledger, Class, Id, NowMs, Mult, Operator);
		if (!P) return {};
		Ledger[P->Key] = P->Nex;
		return *P;
	}

	bool TagLegacyPayouts(FLedger& Ledger, const std::string& Operator)
	{
		FLedger Out;
		bool bChanged = false;
		for (const auto& [K, V] : Ledger)
		{
			std::string Key = K;
			// payout:(boss|strike|dungeon|raid):<id without : or #>:<rest>
			if (K.rfind("payout:", 0) == 0)
			{
				const size_t C1 = K.find(':', 7);
				const std::string Class = C1 == std::string::npos ? "" : K.substr(7, C1 - 7);
				if ((Class == "boss" || Class == "strike" || Class == "dungeon" || Class == "raid") && C1 != std::string::npos)
				{
					const size_t C2 = K.find(':', C1 + 1);
					const std::string Id = C2 == std::string::npos ? "" : K.substr(C1 + 1, C2 - C1 - 1);
					if (!Id.empty() && Id.find('#') == std::string::npos && C2 + 1 < K.size()) Key = "payout:" + Class + ":" + Id + "#" + Operator + ":" + K.substr(C2 + 1);
				}
			}
			if (Key != K) bChanged = true;
			Out[Key] += V;
		}
		if (bChanged) Ledger = std::move(Out);
		return bChanged;
	}

	bool PayFlat(FLedger& Ledger, const std::string& Key, double Nex)
	{
		if (Ledger.count(Key)) return false;
		Ledger[Key] = Nex;
		return true;
	}
}
