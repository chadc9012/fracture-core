// Exact JavaScript number behaviour the web build's rules depend on. Weapon drops hash `${zone}|${roll}`, so the
// text of a double must match JavaScript's Number#toString digit for digit, and payouts use Math.round.
#pragma once

#include "Core/WFCoreApi.h"

#include <cstdint>
#include <string>

namespace wf::js
{
	/** JavaScript's String(number) / Number#toString() for finite numbers (ECMAScript Number::toString, radix 10). */
	WORLDFRACTURECORE_API std::string NumberToString(double Value);

	/** JavaScript's Math.round: halves round toward +infinity (Math.round(-2.5) === -2). */
	WORLDFRACTURECORE_API double Round(double Value);

	/** V8's Math.hypot for two numbers (scaled by the larger, Kahan-summed squares), which can differ from std::hypot in
	 *  the last bit; rules that compare a distance against a range at its exact edge need the JavaScript result. */
	WORLDFRACTURECORE_API double Hypot(double A, double B);

	/** The 32-bit FNV-1a the web build uses over a string's UTF-16 code units (ASCII text: its bytes). */
	WORLDFRACTURECORE_API uint32_t Fnv1a(const std::string& Text);
}
