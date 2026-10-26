#include "Core/WFMoveCore.h"

#include "Core/WFJsCompat.h"

#include <algorithm>
#include <cmath>

namespace wf::move
{
	FAirProfile AirProfile(const std::string& ClassId)
	{
		if (ClassId == "HUNTER") return {2, 0.9, false};
		if (ClassId == "WARLOCK") return {1, 0.7, true};
		return {1, 0.8, false}; // TITAN
	}

	double StanceSpeed(const std::string& Stance) { return Stance == "PRONE" ? 0.22 : Stance == "CROUCH" ? 0.45 : 1; }
	double StanceDropFor(const std::string& Stance) { return Stance == "PRONE" ? 0.85 : Stance == "CROUCH" ? 0.32 : 0; }

	void Land(FMoveState& S, const std::string& ClassId) { S.AirJumpsLeft = AirProfile(ClassId).AirJumps; }

	double AirJump(FMoveState& S, const std::string& ClassId)
	{
		if (S.AirJumpsLeft <= 0) return -1;
		--S.AirJumpsLeft;
		return AirProfile(ClassId).JumpMult;
	}

	double GlideVy(double Vy, const std::string& ClassId, bool bHolding)
	{
		return AirProfile(ClassId).bGlide && bHolding && Vy < -GlideMaxFall ? -GlideMaxFall : Vy;
	}

	bool StartSlide(FMoveState& S, double Vx, double Vz)
	{
		const double Speed = js::Hypot(Vx, Vz);
		if (S.SlideLeft > 0 || S.SlideCool > 0 || Speed < SlideMinSpeed) return false;
		S.SlideLeft = SlideSeconds;
		S.SlideDirX = Vx / Speed;
		S.SlideDirZ = Vz / Speed;
		S.SlideSpeed = Speed;
		return true;
	}

	void CancelSlide(FMoveState& S)
	{
		if (S.SlideLeft > 0) S.SlideCool = SlideCooldown;
		S.SlideLeft = 0;
	}

	double StepSlide(FMoveState& S, double Dt)
	{
		S.SlideCool = std::max(0.0, S.SlideCool - Dt);
		const bool bWas = S.SlideLeft > 0;
		S.SlideLeft = std::max(0.0, S.SlideLeft - Dt);
		if (bWas && S.SlideLeft <= 0) S.SlideCool = SlideCooldown;
		S.Drop += ((S.SlideLeft > 0 ? 1 : 0) - S.Drop) * (1 - std::exp(-14 * Dt));
		if (S.SlideLeft <= 0) return 0;
		const double T = 1 - S.SlideLeft / SlideSeconds;
		return S.SlideSpeed * (SlideStartMult + (SlideEndMult - SlideStartMult) * T * T);
	}

	double MovementFov(bool bAiming, bool bSprinting, bool bSliding, const std::string& Stance)
	{
		if (bAiming) return 48;
		if (bSliding) return 90;
		if (bSprinting) return 84;
		return Stance == "STAND" ? 78 : 74;
	}

	std::string ResolveStance(FMoveState& S, const FStanceInput& In)
	{
		if (In.bSprinting || In.bJumping || !In.bGrounded || In.bSwimming) S.bProne = false;
		std::string Next = "STAND";
		if (!In.bSliding && In.bGrounded && !In.bSwimming) Next = S.bProne ? "PRONE" : In.bCrouchHeld ? "CROUCH" : "STAND";
		S.Stance = Next;
		return Next;
	}

	void StepStance(FMoveState& S, double Dt) { S.StanceDrop += (StanceDropFor(S.Stance) - S.StanceDrop) * (1 - std::exp(-12 * Dt)); }

	FLunge VaultLunge(double ForwardSpeed, double BaseJumpSpeed)
	{
		const double Momentum = std::min(1.0, ForwardSpeed / 24);
		return {BaseJumpSpeed * (1 + Momentum * 0.25), Momentum * 6};
	}

	double ParkourChainBonus(int ChainCount, double TimeSinceLastAction)
	{
		if (TimeSinceLastAction > ChainWindow) return 0;
		return std::min(0.35, ChainCount * 0.08);
	}
}
