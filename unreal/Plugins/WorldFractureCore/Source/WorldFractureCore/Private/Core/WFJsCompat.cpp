#include "Core/WFJsCompat.h"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <initializer_list>
#include <limits>

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

	namespace
	{
		double JsHypotN(std::initializer_list<double> Values)
		{
			double Max = 0;
			bool bNaN = false;
			for (const double V : Values)
			{
				if (std::isinf(V)) return std::numeric_limits<double>::infinity();
				if (std::isnan(V)) bNaN = true;
				else Max = std::max(Max, std::fabs(V));
			}
			if (bNaN) return std::numeric_limits<double>::quiet_NaN();
			if (Max == 0) return 0;
			double Sum = 0, Compensation = 0;
			for (const double V : Values)
			{
				const double R = std::fabs(V) / Max;
				const double Summand = R * R - Compensation;
				const double Preliminary = Sum + Summand;
				Compensation = (Preliminary - Sum) - Summand;
				Sum = Preliminary;
			}
			return std::sqrt(Sum) * Max;
		}
	}

	double Hypot(double A, double B, double C) { return JsHypotN({A, B, C}); }

	double Hypot(double A, double B)
	{
		A = std::fabs(A); B = std::fabs(B);
		if (std::isinf(A) || std::isinf(B)) return std::numeric_limits<double>::infinity();
		if (std::isnan(A) || std::isnan(B)) return std::numeric_limits<double>::quiet_NaN();
		const double Max = std::max(A, B);
		if (Max == 0) return 0;
		double Sum = 0, Compensation = 0;
		for (const double X : { A, B })
		{
			const double R = X / Max;
			const double Summand = R * R - Compensation;
			const double Preliminary = Sum + Summand;
			Compensation = (Preliminary - Sum) - Summand;
			Sum = Preliminary;
		}
		return std::sqrt(Sum) * Max;
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

	std::string ToFixed(double Value, int Digits)
	{
		if (std::isnan(Value)) return "NaN";
		if (Value < 0) return "-" + ToFixed(-Value, Digits); // (-0.04).toFixed(1) === "-0.0"; -0 is not < 0
		// glibc / MSVC print the exact decimal expansion; round it half up at Digits by hand
		char Buf[512];
		std::snprintf(Buf, sizeof(Buf), "%.120f", Value);
		std::string S(Buf);
		const size_t Dot = S.find('.');
		std::string Whole = S.substr(0, Dot), Frac = S.substr(Dot + 1);
		const bool bUp = Frac[static_cast<size_t>(Digits)] >= '5';
		std::string Kept = Whole + Frac.substr(0, static_cast<size_t>(Digits));
		if (bUp)
		{
			int I = static_cast<int>(Kept.size()) - 1;
			for (; I >= 0; --I)
			{
				if (Kept[static_cast<size_t>(I)] == '9') { Kept[static_cast<size_t>(I)] = '0'; continue; }
				++Kept[static_cast<size_t>(I)];
				break;
			}
			if (I < 0) Kept.insert(Kept.begin(), '1');
		}
		const size_t WholeLen = Kept.size() - static_cast<size_t>(Digits);
		return Digits > 0 ? Kept.substr(0, WholeLen) + "." + Kept.substr(WholeLen) : Kept;
	}

	std::string ToBase36(double Value)
	{
		unsigned long long N = static_cast<unsigned long long>(Value < 0 ? 0 : Value);
		if (N == 0) return "0";
		std::string Out;
		while (N) { const unsigned D = static_cast<unsigned>(N % 36); Out.insert(Out.begin(), static_cast<char>(D < 10 ? '0' + D : 'a' + (D - 10))); N /= 36; }
		return Out;
	}
}
