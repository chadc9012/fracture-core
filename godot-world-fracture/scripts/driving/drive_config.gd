extends RefCounted
const Catalog = preload("res://scripts/garage/catalog.gd")
static func vehicle_ids() -> Array[String]:
	var ids: Array[String] = []
	for v in Catalog.VEHICLES:
		ids.append(String(v.id))
	return ids
static func valid_vehicle(id: String) -> bool:
	return not Catalog.vehicle(id).is_empty()
static func clamp_damage(value: int) -> int:
	return clampi(value, 0, 100)
