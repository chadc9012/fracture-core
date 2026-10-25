// World Fracture — per-operator pockets: Titan, Hunter and Warlock each keep their own level, XP, Nex, fracture shards
// and materials. Gear, vehicles, homes, story and claims stay shared.
//
// Port of the web build's authoritative rules in operator-pockets.ts: the live fields of FProgression always belong to
// PocketClass; SwitchOperator stores them and loads the next operator's. The Nex ledger also records ownership and
// one-time claims, so it stays whole; one balancing entry (wallet:offset) makes its total the played operator's balance.
// Golden-tested (Tests/OperatorCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"
#include "Core/WFProgression.h"

#include <string>

namespace wf::operators
{
	inline const char* const NexOffsetKey = "wallet:offset";
	WORLDFRACTURECORE_API bool IsOperatorClass(const std::string& Cls);
	/** the played operator's values, read from the live fields */
	WORLDFRACTURECORE_API FProgression::FOperatorPocket LivePocket(const FProgression& P);
	/** any operator's values (live for the one being played) */
	WORLDFRACTURECORE_API FProgression::FOperatorPocket OperatorPocket(const FProgression& P, const std::string& Cls);
	/** make Cls the played operator; false (and P unchanged) when Cls is already played or not a class */
	WORLDFRACTURECORE_API bool SwitchOperator(FProgression& P, const std::string& Cls);
	/** "Level 7 · NΞ 1,200" style one-line summary for consoles and logs */
	WORLDFRACTURECORE_API std::string DescribeOperators(const FProgression& P);
}
