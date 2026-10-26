// World Fracture — the Operator's movement kit: class air mobility (Titan one weighty lift, Hunter two quick air jumps,
// Warlock one air jump then a held glide), the slide out of a sprint, crouch and prone stances, the running vault and its
// chain bonus, and the momentum kept when bailing out of a vehicle.
//
// Port of the web build's authoritative rules:
//   movement.ts  AIR_PROFILE, land, airJump, glideVy, startSlide, cancelSlide, stepSlide, resolveStance, stepStance,
//                STANCE_SPEED / STANCE_DROP, movementFov, cameraDrop
//   parkour.ts   vaultLunge, parkourChainBonus, exitVehicleMomentum
// Speeds are the web build's foot units (BASE_FOOT_SPEED 14 = a walk); the engine converts with its own walk speed.
// Golden-tested (Tests/MoveCoreTest.cpp).
#pragma once

#include "Core/WFCoreApi.h"

#include <string>

namespace wf::move
{
	struct FAirProfile { int AirJumps = 1; double JumpMult = 1; bool bGlide = false; };
	WORLDFRACTURECORE_API FAirProfile AirProfile(const std::string& ClassId);
	inline constexpr double BaseFootSpeed = 14, GlideMaxFall = 2.2, GlideThrust = 14;
	inline constexpr double SlideSeconds = 0.85, SlideCooldown = 0.6, SlideStartMult = 1.3, SlideEndMult = 0.5;
	/** sprint speed needed to slide (1.2 x a walk, never more than the original world's 26) */
	inline constexpr double SlideMinSpeed = BaseFootSpeed * 1.2 < 26 ? BaseFootSpeed * 1.2 : 26;

	struct FMoveState
	{
		std::string Stance = "STAND"; // STAND | CROUCH | PRONE
		bool bProne = false;          // prone is a toggle; crouch is held
		double StanceDrop = 0;
		int AirJumpsLeft = 0;
		double SlideLeft = 0, SlideCool = 0, SlideDirX = 0, SlideDirZ = 0, SlideSpeed = 0;
		double Drop = 0;
	};
	WORLDFRACTURECORE_API double StanceSpeed(const std::string& Stance);  // 1 / 0.45 / 0.22
	WORLDFRACTURECORE_API double StanceDropFor(const std::string& Stance); // camera sink 0 / 0.32 / 0.85
	/** touching the ground refills the air jumps */
	WORLDFRACTURECORE_API void Land(FMoveState& S, const std::string& ClassId);
	/** spend an air jump; the vertical-speed multiplier, or a negative value when none are left */
	WORLDFRACTURECORE_API double AirJump(FMoveState& S, const std::string& ClassId);
	/** Warlock glide: holding jump while falling caps the fall speed */
	WORLDFRACTURECORE_API double GlideVy(double Vy, const std::string& ClassId, bool bHolding);
	WORLDFRACTURECORE_API bool StartSlide(FMoveState& S, double Vx, double Vz);
	WORLDFRACTURECORE_API void CancelSlide(FMoveState& S);
	/** advances the slide; the slide speed now (0 when not sliding) */
	WORLDFRACTURECORE_API double StepSlide(FMoveState& S, double Dt);
	WORLDFRACTURECORE_API double MovementFov(bool bAiming, bool bSprinting, bool bSliding, const std::string& Stance = "STAND");
	struct FStanceInput { bool bCrouchHeld = false, bSprinting = false, bJumping = false, bGrounded = true, bSliding = false, bSwimming = false; };
	WORLDFRACTURECORE_API std::string ResolveStance(FMoveState& S, const FStanceInput& In);
	WORLDFRACTURECORE_API void StepStance(FMoveState& S, double Dt);
	inline double CameraDrop(const FMoveState& S) { return S.Drop * 0.55 + S.StanceDrop; }

	struct FLunge { double VerticalBoost = 0, ForwardBoost = 0; };
	WORLDFRACTURECORE_API FLunge VaultLunge(double ForwardSpeed, double BaseJumpSpeed);
	WORLDFRACTURECORE_API double ParkourChainBonus(int ChainCount, double TimeSinceLastAction);
	inline constexpr double ChainWindow = 1.4;
	inline double ExitVehicleMomentum(double VehicleSpeed, double KeepFraction = 0.55) { return VehicleSpeed * KeepFraction; }
}
