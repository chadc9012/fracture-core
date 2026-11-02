extends RefCounted
static func effective_damage(current: int, impact_speed: float) -> int:
	return clampi(current + int(maxf(0.0, impact_speed - 8.0) * 0.75), 0, 100)
