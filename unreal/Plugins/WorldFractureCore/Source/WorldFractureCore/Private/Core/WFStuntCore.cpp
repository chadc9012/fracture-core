#include "Core/WFStuntCore.h"

#include "Core/WFJsCompat.h"
#include "Core/WFWastelandCore.h"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace wf::stunt
{
	namespace
	{
		constexpr double StPi = std::numbers::pi;
		std::string StuntTimes(double N, const std::string& Base)
		{
			if (N == 1) return Base;
			if (N == 2) return "Double " + Base;
			if (N == 3) return "Triple " + Base;
			return js::NumberToString(N) + "x " + Base;
		}
		double StuntFull(double A) { return std::floor((std::fabs(A) + CleanTilt) / (StPi * 2)); }

		double StuntScore(FRun& Run, const std::vector<FTrick>& Tricks, double Now)
		{
			double Base = 0;
			for (const FTrick& T : Tricks) Base += T.Points;
			if (Base == 0 || std::isnan(Base)) return 0;
			Run.Combo = Now <= Run.ComboUntil ? Run.Combo + 1 : 1;
			Run.ComboUntil = Now + ComboWindow;
			const double Mult = ComboMult(Run.Combo), Pts = js::Round(Base * Mult);
			Run.Total += Pts;
			Run.Best = std::max(Run.Best, Pts);
			std::string Label;
			for (const FTrick& T : Tricks)
				if (T.Name != "Air time") Label += (Label.empty() ? "" : " + ") + T.Name;
			if (Label.empty()) Label = "Air";
			Run.Last = FLast{Run.Combo > 1 ? Label + "  x" + js::NumberToString(Mult) : Label, Pts, Now, false};
			return Pts;
		}
	}

	double Wrap(double A)
	{
		const double T = std::fmod(std::fmod(A + StPi, StPi * 2) + StPi * 2, StPi * 2);
		return T - StPi;
	}

	std::optional<FLanding> StepAir(FAir& St, double Stand, const FAirInput& In, double Dt)
	{
		if (Dt <= 0) return std::nullopt;
		const double GroundVy = (Stand - St.LastStand) / Dt;
		St.LastStand = Stand;
		if (!St.bAirborne)
		{
			// follow the ground; leave it when it drops away faster than gravity could pull the vehicle after it
			const double NextY = St.Y + St.Vy * Dt - 0.5 * Gravity * Dt * Dt;
			if (NextY > Stand + LaunchGap)
			{
				St.bAirborne = true; St.Y = NextY; St.Vy -= Gravity * Dt; St.AirTime = Dt; St.Pitch = 0; St.Roll = 0; St.SpinYaw = 0;
				return std::nullopt;
			}
			St.Y = Stand;
			// the ground's vertical speed, eased so one bumpy sample does not fling the car
			St.Vy += (std::max(-30.0, std::min(30.0, GroundVy)) - St.Vy) * (1 - std::exp(-14 * Dt));
			return std::nullopt;
		}
		St.Vy -= Gravity * Dt;
		St.Y += St.Vy * Dt;
		St.AirTime += Dt;
		St.Pitch += (In.Brake - In.Throttle) * PitchRate * Dt;
		if (In.bHandbrake) St.Roll += -In.Steer * RollRate * Dt;
		else St.SpinYaw += In.Steer * YawRate * Dt;
		if (St.Y > Stand) return std::nullopt;
		FLanding L;
		L.Impact = std::max(0.0, GroundVy - St.Vy);
		L.bClean = std::fabs(Wrap(St.Pitch)) < CleanTilt && std::fabs(Wrap(St.Roll)) < CleanTilt;
		L.AirTime = St.AirTime; L.Pitch = St.Pitch; L.Roll = St.Roll; L.SpinYaw = St.SpinYaw;
		St.bAirborne = false; St.Y = Stand; St.Vy = GroundVy * 0.3; St.Pitch = 0; St.Roll = 0; St.SpinYaw = 0; St.AirTime = 0;
		return L;
	}

	std::vector<FTrick> LandingTricks(const FLanding& L)
	{
		std::vector<FTrick> Out;
		if (!L.bClean) return Out;
		// a rotation counts once it is nearly complete (the clean-landing window lets you touch down a little short)
		const double Flips = StuntFull(L.Pitch), Rolls = StuntFull(L.Roll), Spins = std::floor((std::fabs(L.SpinYaw) + 0.5) / (StPi * 2));
		if (Flips != 0) Out.push_back({StuntTimes(Flips, L.Pitch > 0 ? "Backflip" : "Frontflip"), FlipPoints * Flips * (Flips > 1 ? 1.25 : 1)});
		if (Rolls != 0) Out.push_back({StuntTimes(Rolls, "Barrel Roll"), RollPoints * Rolls * (Rolls > 1 ? 1.25 : 1)});
		if (Spins != 0) Out.push_back({Spins == 1 ? std::string("360 Spin") : js::NumberToString(Spins * 360) + " Spin", Spin360Points * Spins});
		if (L.AirTime >= HugeAir) Out.push_back({"Huge Air", HugeAirPoints});
		else if (L.AirTime >= BigAir) Out.push_back({"Big Air", BigAirPoints});
		if (!Out.empty()) Out.push_back({"Air time", js::Round(L.AirTime * PerSecondAir)});
		for (FTrick& T : Out) T.Points = js::Round(T.Points);
		return Out;
	}

	double ComboMult(double N) { return std::min(ComboMax, 1 + std::max(0.0, N - 1) * ComboStep); }

	double ScoreLanding(FRun& Run, const FLanding& L, double Now)
	{
		if (!L.bClean)
		{
			Run.Combo = 0; Run.ComboUntil = 0;
			Run.Last = FLast{"Wipeout", 0, Now, true};
			return 0;
		}
		return StuntScore(Run, LandingTricks(L), Now);
	}

	double StepPowerslide(FRun& Run, double Slip, double Speed, double Dt, double Now)
	{
		if (Slip > SlideSlip && std::fabs(Speed) > SlideMinSpeed) { Run.SlideTime += Dt; return 0; }
		const double T = Run.SlideTime;
		Run.SlideTime = 0;
		if (T < SlideMinTime) return 0;
		return StuntScore(Run, {{"Powerslide", js::Round(PowerslidePoints * T)}}, Now);
	}

	double StuntNex(double Points, double PaidToday) { return std::max(0.0, std::min(DailyCap - PaidToday, std::floor(Points / PointsPerNex))); }

	bool PayStunts(std::map<std::string, double>& Ledger, const std::string& Day, double Points)
	{
		const std::string Key = "stunts:" + Day;
		const auto It = Ledger.find(Key);
		const double Paid = It == Ledger.end() ? 0 : It->second, Nex = StuntNex(Points, Paid);
		if (!(Nex > 0)) return false;
		Ledger[Key] = Paid + Nex;
		return true;
	}

	const FPark& StuntPark()
	{
		static const FPark Park{wasteland::RegionCentre.X - 40, wasteland::RegionCentre.Z + 160, 1, 0, 150, 46};
		return Park;
	}
	const std::vector<FRamp>& Ramps()
	{
		static const std::vector<FRamp> All{
			{"kicker", -42, -12, 18, 9, 9, 3.2, "Kicker"},
			{"tabletop", -6, -12, 32, 11, 11, 4.6, "Tabletop"},
			{"launch", 38, -12, 30, 15, 10, 7.5, "Mega Launch"},
			{"hump-a", -30, 13, 14, 7, 8, 2.2, "Whoops"},
			{"hump-b", -12, 13, 14, 7, 8, 2.2, "Whoops"},
			{"hump-c", 6, 13, 14, 7, 8, 2.2, "Whoops"},
			{"gap-up", 30, 13, 20, 10, 9, 5, "Gap Jump"},
			{"gap-down", 56, 13, 20, 10, 9, 4, "Gap Jump"},
		};
		return All;
	}
	FPoint RampCentre(const FRamp& R)
	{
		const FPark& P = StuntPark();
		return {P.X + P.DirX * R.Along - P.DirZ * R.Across, P.Z + P.DirZ * R.Along + P.DirX * R.Across};
	}
	FDeck RampDeck(const FRamp& R, double Ground)
	{
		const FPoint C = RampCentre(R);
		const double Base = Ground - 0.15;
		return {"stunt-" + R.Id, C.X, C.Z, StuntPark().DirX, StuntPark().DirZ, R.Length, R.Width, Base + R.Height, Base, R.Ramp};
	}
	std::vector<std::pair<double, double>> RampProfile(const FRamp& R)
	{
		const double H = R.Length / 2;
		return {{-H, 0}, {-H + R.Ramp, R.Height}, {H - R.Ramp, R.Height}, {H, 0}};
	}
	bool InStuntPark(double X, double Z, double Margin)
	{
		const FPark& P = StuntPark();
		const double Dx = X - P.X, Dz = Z - P.Z;
		const double Along = Dx * P.DirX + Dz * P.DirZ, Across = -Dx * P.DirZ + Dz * P.DirX;
		return std::fabs(Along) < P.Length / 2 + Margin && std::fabs(Across) < P.Width / 2 + Margin;
	}
}
