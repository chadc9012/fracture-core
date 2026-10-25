#include "Core/WFOperatorCore.h"

#include "Core/WFJsCompat.h"
#include "Core/WFVehicleCore.h"

namespace wf::operators
{
	namespace
	{
		const FProgression::FOperatorPocket OpFreshPocket{};

		/** a ledger whose balance is Target, with every purchase and claim kept */
		void OpSetBalance(std::map<std::string, double>& Ledger, double Target)
		{
			Ledger.erase(NexOffsetKey);
			double Raw = 0;
			for (const auto& [K, V] : Ledger) Raw += V;
			const double Offset = js::Round(Target) - Raw;
			if (Offset != 0) Ledger[NexOffsetKey] = Offset;
		}
	}

	bool IsOperatorClass(const std::string& Cls) { return Cls == "TITAN" || Cls == "HUNTER" || Cls == "WARLOCK"; }

	FProgression::FOperatorPocket LivePocket(const FProgression& P)
	{
		FProgression::FOperatorPocket Out;
		Out.Level = P.Level;
		Out.Xp = P.Xp;
		Out.Nex = vehicle::NexBalance(P.NexLedger);
		Out.FractureShards = P.FractureShards;
		Out.Materials = P.Materials;
		return Out;
	}

	FProgression::FOperatorPocket OperatorPocket(const FProgression& P, const std::string& Cls)
	{
		if (Cls == P.PocketClass) return LivePocket(P);
		const auto It = P.Operators.find(Cls);
		return It == P.Operators.end() ? OpFreshPocket : It->second;
	}

	bool SwitchOperator(FProgression& P, const std::string& Cls)
	{
		if (!IsOperatorClass(Cls) || Cls == P.PocketClass) return false;
		P.Operators[P.PocketClass] = LivePocket(P);
		const auto It = P.Operators.find(Cls);
		const FProgression::FOperatorPocket Next = It == P.Operators.end() ? OpFreshPocket : It->second;
		P.PocketClass = Cls;
		P.Level = Next.Level;
		P.Xp = Next.Xp;
		P.FractureShards = Next.FractureShards;
		P.Materials = Next.Materials;
		OpSetBalance(P.NexLedger, Next.Nex);
		return true;
	}

	std::string DescribeOperators(const FProgression& P)
	{
		std::string Out;
		for (const char* Cls : { "TITAN", "HUNTER", "WARLOCK" })
		{
			const FProgression::FOperatorPocket K = OperatorPocket(P, Cls);
			if (!Out.empty()) Out += "\n";
			Out += std::string(Cls == P.PocketClass ? "> " : "  ") + Cls + "  Level " + js::NumberToString(K.Level) + "  XP " + js::NumberToString(K.Xp) + "  Nex " + js::NumberToString(K.Nex) + "  Shards " + js::NumberToString(K.FractureShards) + "  Materials " + std::to_string(K.Materials.size());
		}
		return Out;
	}
}
