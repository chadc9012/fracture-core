#include "Core/WFEnvironmentCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>

namespace wf::env
{
	namespace
	{
		constexpr double EvPi = 3.141592653589793;
		double EvClamp(double V, double Lo, double Hi) { return std::min(Hi, std::max(Lo, V)); }
		double EvWrap(double T) { return std::fmod(std::fmod(T, 1.0) + 1.0, 1.0); }
		double EvHash(double N) { const double X = std::sin(N * 127.1 + 311.7) * 43758.5453; return X - std::floor(X); }
		/** weather-cycle.ts strId: h = (h * 31 + code) | 0 over the UTF-16 units (region ids are ASCII) */
		double EvStrId(const std::string& Id)
		{
			int32_t H = 0;
			for (unsigned char C : Id) H = static_cast<int32_t>(static_cast<uint32_t>(H) * 31u + C);
			return H;
		}
		struct FBase { double Precipitation, Cloud, Visibility, Wind; };
		FBase EvBase(const std::string& S)
		{
			if (S == "OVERCAST") return {0, 0.6, 0.8, 5};
			if (S == "RAIN") return {0.6, 0.75, 0.6, 7};
			if (S == "STORM") return {1, 0.95, 0.42, 14};
			if (S == "FOG") return {0, 0.5, 0.3, 1};
			return {0, 0.1, 1, 2}; // CLEAR
		}
		const std::vector<std::string>& EvTable(const std::string& Region)
		{
			static const std::vector<std::string> Veridan{"RAIN", "OVERCAST", "STORM", "FOG", "CLEAR"}, Ember{"CLEAR", "OVERCAST", "STORM"},
				Frost{"OVERCAST", "STORM", "FOG", "CLEAR"}, Swamps{"FOG", "RAIN", "FOG", "OVERCAST"}, Wastes{"CLEAR", "OVERCAST", "STORM"},
				Solara{"CLEAR", "CLEAR", "OVERCAST", "STORM"}, Nexus{"CLEAR"}, Other{"CLEAR", "OVERCAST", "RAIN"};
			if (Region == "veridan") return Veridan;
			if (Region == "ember") return Ember;
			if (Region == "frostspire") return Frost;
			if (Region == "swamps") return Swamps;
			if (Region == "wastelands") return Wastes;
			if (Region == "solara") return Solara;
			if (Region == "nexus") return Nexus;
			return Other;
		}
		std::string EvLabel(const std::string& Region, const std::string& State, double Precipitation)
		{
			if (Region == "nexus") return "Clear shield";
			if (Region == "ember") return State == "CLEAR" ? "Dust front" : "Ashfall";
			if (Region == "frostspire") return State == "CLEAR" ? "Clear shield" : "Snow haze";
			if (Precipitation > 0.15) return "Rain mist";
			if (Region == "solara" || Region == "wastelands") return "Dust front";
			return "Clear shield";
		}
		struct FClimate { double Base, Seasonal; bool bShielded; };
		FClimate EvClimate(const std::string& R)
		{
			if (R == "veridan") return {0, 1, false};
			if (R == "swamps") return {0.15, 0.7, false};
			if (R == "wastelands") return {0.25, 0.8, false};
			if (R == "solara") return {0.6, 0.5, false};
			if (R == "ember") return {0.7, 0.4, false};
			if (R == "frostspire") return {-0.7, 0.5, false};
			if (R == "nexus") return {0, 0, true};
			return {0.1, 0.8, false};
		}
		double EvSeasonOffset(const std::string& S) { return S == "SUMMER" ? 0.3 : S == "AUTUMN" ? -0.05 : S == "WINTER" ? -0.35 : 0; }
		std::string EvSeasonName(const std::string& S) { return S == "SPRING" ? "Spring" : S == "SUMMER" ? "Summer" : S == "AUTUMN" ? "Autumn" : "Winter"; }
		double EvBuild(double Meter, double Pressure, double Dt, bool bSheltered)
		{
			if (!bSheltered && Pressure > 0) return std::min(1.0, Meter + (Pressure / 20) * Dt);
			return std::max(0.0, Meter - 0.12 * (bSheltered ? 2 : 1) * Dt);
		}
	}

	double HourOf(double T) { return EvWrap(T) * 24; }
	double SunElevation(double T) { return std::sin(EvWrap(T) * EvPi * 2 - EvPi / 2); }

	std::string PhaseFor(double T)
	{
		const double H = HourOf(T) / 24;
		if (H < 0.22) return "Moonlight";
		if (H < 0.3) return "Dawn";
		if (H < 0.7) return "Day";
		if (H < 0.79) return "Sunset";
		if (H < 0.92) return "Night";
		return "Moonlight";
	}

	std::string ClockLabel(double T)
	{
		const double H = HourOf(T);
		const double Hh = std::floor(H), Mm = std::floor((H - Hh) * 60);
		char Buf[16];
		std::snprintf(Buf, sizeof Buf, "%02d:%02d", static_cast<int>(Hh), static_cast<int>(Mm));
		return Buf;
	}

	double NightFactor(double T)
	{
		const double Theta = EvWrap(T) * EvPi * 2 - EvPi / 2;
		return std::min(1.0, std::max(0.0, -std::sin(Theta) * 1.2 + 0.15));
	}

	std::string FrontAt(const std::string& RegionId, double FrontIndex)
	{
		const std::vector<std::string>& T = EvTable(RegionId);
		const double N = static_cast<double>(T.size());
		const double I = std::fmod(std::floor(EvHash(FrontIndex + EvStrId(RegionId) * 0.013) * N), N);
		return T[static_cast<size_t>(I)];
	}

	FWeather SampleWeather(const std::string& RegionIdIn, double T)
	{
		const std::string Id = RegionIdIn.empty() ? "wastelands" : RegionIdIn;
		const double F = T / FrontLength;
		const double Idx = std::floor(F);
		const double Frac = F - Idx;
		const std::string A = FrontAt(Id, Idx), B = FrontAt(Id, Idx + 1);
		const double K = Frac < 1 - 0.25 ? 0 : (Frac - (1 - 0.25)) / 0.25;
		const double S = K * K * (3 - 2 * K);
		const FBase Ba = EvBase(A), Bb = EvBase(B);
		auto Mix = [S](double X, double Y) { return X + (Y - X) * S; };
		FWeather W;
		W.Precipitation = Mix(Ba.Precipitation, Bb.Precipitation);
		const double Wind = Mix(Ba.Wind, Bb.Wind) * (0.8 + 0.4 * std::sin(T * 40 + EvStrId(Id)));
		const double Dir = EvHash(Idx * 3.7 + EvStrId(Id)) * EvPi * 2 + std::sin(T * 9) * 0.4;
		W.State = S < 0.5 ? A : B;
		W.Cloud = Mix(Ba.Cloud, Bb.Cloud);
		W.Visibility = Mix(Ba.Visibility, Bb.Visibility);
		W.WindX = std::cos(Dir) * Wind;
		W.WindZ = std::sin(Dir) * Wind;
		W.Label = EvLabel(Id, W.State, W.Precipitation);
		return W;
	}

	std::string WeatherName(const FWeather& W, const std::string& RegionId)
	{
		if (RegionId == "nexus") return "Clear shield";
		if (W.State == "OVERCAST") return "Overcast";
		if (W.State == "RAIN") return "Rain";
		if (W.State == "STORM") return "Storm";
		if (W.State == "FOG") return "Dense fog";
		return "Clear";
	}

	FSeason SeasonAt(double T)
	{
		const double X = std::max(0.0, T) / SeasonLengthDays;
		const double Index = std::floor(X);
		static const char* const Seasons[4] = {"SPRING", "SUMMER", "AUTUMN", "WINTER"};
		return {Seasons[static_cast<int>(std::fmod(Index, 4.0))], X - Index, std::floor(Index / 4)};
	}

	FEnvironment EnvironmentAt(const std::string& RegionIdIn, double T, double Night)
	{
		const std::string Id = RegionIdIn.empty() ? "wastelands" : RegionIdIn;
		const FClimate Climate = EvClimate(Id);
		const FSeason Season = SeasonAt(T);
		const FWeather Raw = SampleWeather(Id, T);
		const double WetCool = Raw.State == "STORM" ? -0.1 : Raw.State == "RAIN" ? -0.05 : Raw.State == "CLEAR" ? 0.05 : 0;
		const double Diurnal = Night > 0 ? -0.2 * Night : 0.05 * (1 - Night);
		const double Thermal = Climate.bShielded ? 0 : EvClamp(Climate.Base + EvSeasonOffset(Season.Season) * Climate.Seasonal + Diurnal + WetCool, -1, 1);
		FWeather W = Raw;
		if (!Climate.bShielded)
		{
			// seasonal flavour: haze in autumn, hard cloud in winter, bigger spring showers, bright summers
			double P = Raw.Precipitation, C = Raw.Cloud, V = Raw.Visibility;
			if (Season.Season == "WINTER") { C += 0.1; V *= 0.92; }
			else if (Season.Season == "AUTUMN") V *= 0.95;
			else if (Season.Season == "SPRING" && Raw.State == "RAIN") P *= 1.15;
			else if (Season.Season == "SUMMER") C -= 0.1;
			const bool bSnowing = P > 0.15 && Thermal < -0.2 && Id != "ember"; // cold precipitation falls as snow
			W.Precipitation = EvClamp(P, 0, 1);
			W.Cloud = EvClamp(C, 0, 1);
			W.Visibility = EvClamp(V, 0.1, 1);
			if (bSnowing) W.Label = "Snow haze";
		}
		FEnvironment E;
		E.Season = Season.Season;
		E.SeasonProgress = Season.Progress;
		E.Weather = W;
		E.Thermal = Thermal;
		E.TempC = js::Round(12 + Thermal * 30);
		E.bShielded = Climate.bShielded;
		E.Summary = EvSeasonName(Season.Season) + " \xC2\xB7 " + WeatherName(W, Id) + " \xC2\xB7 " + js::NumberToString(E.TempC) + "\xC2\xB0" "C";
		return E;
	}

	FEnvOutput StepEnvironment(FEnvState& S, const FEnvInput& In)
	{
		const bool bShielded = In.Env.bShielded;
		// exposure meters
		const double HeatP = bShielded ? 0 : EvClamp((In.Env.Thermal - 0.7) / 0.3, 0, 1);
		const double ColdP = bShielded ? 0 : EvClamp((-0.7 - In.Env.Thermal) / 0.3, 0, 1);
		const double ToxicP = !bShielded && In.RegionId == "swamps" && In.Env.Weather.State == "FOG" ? 1 : 0;
		S.Heat = EvBuild(S.Heat, HeatP, In.Dt, In.bSheltered);
		S.Cold = EvBuild(S.Cold, ColdP, In.Dt, In.bSheltered);
		S.Toxic = EvBuild(S.Toxic, ToxicP, In.Dt, In.bSheltered);

		// lightning: storms outside the shield, only while the player is exposed
		const bool bStormy = !bShielded && In.Env.Weather.State == "STORM" && In.Env.Weather.Precipitation > 0.8;
		if (bStormy && !In.bSheltered)
		{
			S.NextStrike -= In.Dt;
			if (S.NextStrike <= 0)
			{
				const double A = In.Rand() * EvPi * 2;
				const double D = 6 + In.Rand() * 20;
				S.Strikes.push_back({S.NextId++, In.Px + std::cos(A) * D, In.Pz + std::sin(A) * D, StrikeRadius, StrikeWarnSeconds});
				S.NextStrike = 7 + In.Rand() * 7;
			}
		}
		else if (S.NextStrike < 4) S.NextStrike = 4; // leaving the storm resets the cadence so re-entry isn't instant

		FEnvOutput Out;
		for (FStrike& St : S.Strikes)
		{
			St.Warn -= In.Dt;
			if (St.Warn <= 0) { Out.Detonated.push_back(St); S.Flashes.push_back({St.X, St.Z, 0.3}); }
		}
		if (!Out.Detonated.empty()) S.Strikes.erase(std::remove_if(S.Strikes.begin(), S.Strikes.end(), [](const FStrike& St) { return !(St.Warn > 0); }), S.Strikes.end());
		for (FFlash& F : S.Flashes) F.T -= In.Dt;
		if (!S.Flashes.empty()) S.Flashes.erase(std::remove_if(S.Flashes.begin(), S.Flashes.end(), [](const FFlash& F) { return !(F.T > 0); }), S.Flashes.end());

		// damage and warnings
		if (S.Heat >= 1) { Out.Damage += 1 * In.Dt; Out.Cause = "Heat exhaustion"; }
		if (S.Cold >= 1) { Out.Damage += 1 * In.Dt; Out.Cause = "Hypothermia"; }
		if (S.Toxic >= 1) { Out.Damage += 0.8 * In.Dt; Out.Cause = "Spore toxicity"; }
		const double Worst = std::max({S.Heat, S.Cold, S.Toxic});
		if (!S.Strikes.empty()) Out.Warning = "Lightning inbound \xE2\x80\x94 leave the marked ground";
		else if (Worst >= 0.5)
		{
			const std::string Label = S.Cold == Worst ? "Cold exposure" : S.Heat == Worst ? "Heat stress" : "Spore haze";
			Out.Warning = Label + " " + js::NumberToString(js::Round(Worst * 100)) + "% \xE2\x80\x94 " + (Worst >= 1 ? "taking damage" : "find shelter");
		}
		return Out;
	}
}
