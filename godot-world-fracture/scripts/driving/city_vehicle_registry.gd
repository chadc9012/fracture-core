extends RefCounted
const Catalog = preload("res://scripts/garage/catalog.gd")
static func registered(id: String) -> bool:
	return not Catalog.vehicle(id).is_empty()
static func display_name(id: String) -> String:
	var v := Catalog.vehicle(id)
	return String(v.get("name", "Unknown vehicle"))
