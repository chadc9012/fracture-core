extends RefCounted
static func grip_factor(weather: String) -> float:
	match weather:
		"rain": return 0.72
		"storm": return 0.6
		_: return 1.0
