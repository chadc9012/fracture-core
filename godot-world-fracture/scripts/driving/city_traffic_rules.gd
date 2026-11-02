extends RefCounted
const SPEED_LIMIT_KMH := 60.0
static func speeding(speed_mps: float) -> bool:
	return absf(speed_mps) * 3.6 > SPEED_LIMIT_KMH
