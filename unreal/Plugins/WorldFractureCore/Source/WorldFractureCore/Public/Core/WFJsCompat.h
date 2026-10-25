// Exact JavaScript number behaviour the web build's rules depend on. Weapon drops hash `${zone}|${roll}`, so the
// text of a double must match JavaScript's Number#toString digit for digit, and payouts use Math.round.
#pragma once

#include <cstdint>
#include <string>

namespace wf::js
{
	/** JavaScript's String(number) / Number#toString() for finite numbers (ECMAScript Number::toString, radix 10). */
	std::string NumberToString(double Value);

	/** JavaScript's Math.round: halves round toward +infinity (Math.round(-2.5) === -2). */
	double Round(double Value);

	/** The 32-bit FNV-1a the web build uses over a string's UTF-16 code units (ASCII text: its bytes). */
	uint32_t Fnv1a(const std::string& Text);
}
