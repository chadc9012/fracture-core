extends RefCounted
const Catalog = preload("res://scripts/garage/catalog.gd")
static func stats(state, id: String) -> Dictionary:
	if Catalog.vehicle(id).is_empty():
		return {}
	return Catalog.stats_with(id, state.installed(id))
static func performance(state, id: String) -> Dictionary:
	var s := stats(state, id)
	if s.is_empty():
		return {}
	var damage := clampf(float(state.car(id).get("damage", 0)) / 100.0, 0.0, 1.0)
	return {
		"max_speed": (12.0 + float(s.speed) * 0.42) * (1.0 - 0.45 * damage),
		"acceleration": (4.0 + float(s.accel) * 0.14) * (1.0 - 0.35 * damage),
		"steering": 0.65 + float(s.handling) * 0.011,
		"braking": 10.0 + float(s.handling) * 0.12,
		"armor": float(s.armor)
	}
