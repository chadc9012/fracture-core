extends RefCounted
static func traction(surface: String) -> float:
	match surface:
		"asphalt": return 1.0
		"gravel": return 0.75
		"sand": return 0.55
		"wet": return 0.68
		_: return 0.8
