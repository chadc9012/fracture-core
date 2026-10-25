#include "Core/WFJsCompat.h"

#include <charconv>
#include <cmath>
#include <cstdlib>

namespace wf::js
{
	std::string NumberToString(double Value)
	{
		if (std::isnan(Value)) return "NaN";
		if (std::isinf(Value)) return Value > 0 ? "Infinity" : "-Infinity";
		if (Value == 0) return "0"; // also -0, as in JavaScript
		if (Value < 0) return "-" + NumberToString(-Value);

		// Shortest round-trip digits in scientific form, e.g. "1.2345e-07".
		char Buffer[64];
		const auto Result = std::to_chars(Buffer, Buffer + sizeof(Buffer), Value, std::chars_format::scientific);
		const std::string Sci(Buffer, Result.ptr);
		const size_t E = Sci.find('e');
		std::string Digits;
		for (size_t I = 0; I < E; ++I)
			if (Sci[I] != '.') Digits += Sci[I];
		const int SciExp = std::atoi(Sci.c_str() + E + 1);

		// ECMAScript: value = 0.<digits> x 10^N with K digits.
		const int K = static_cast<int>(Digits.size());
		const int N = SciExp + 1;
		if (K <= N && N <= 21) return Digits + std::string(static_cast<size_t>(N - K), '0');
		if (0 < N && N <= 21) return Digits.substr(0, static_cast<size_t>(N)) + "." + Digits.substr(static_cast<size_t>(N));
		if (-6 < N && N <= 0) return "0." + std::string(static_cast<size_t>(-N), '0') + Digits;
		const int Exp = N - 1;
		std::string Out = Digits.substr(0, 1);
		if (K > 1) Out += "." + Digits.substr(1);
		Out += Exp < 0 ? "e-" : "e+";
		Out += std::to_string(std::abs(Exp));
		return Out;
	}

	double Round(double Value)
	{
		const double Floor = std::floor(Value);
		return Value - Floor >= 0.5 ? Floor + 1 : Floor;
	}

	uint32_t Fnv1a(const std::string& Text)
	{
		uint32_t Hash = 2166136261u;
		for (const unsigned char C : Text)
		{
			Hash ^= C;
			Hash *= 16777619u; // Math.imul then >>> 0: multiplication modulo 2^32
		}
		return Hash;
	}
}
