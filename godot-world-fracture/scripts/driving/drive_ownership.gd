extends RefCounted
const Catalog = preload("res://scripts/garage/catalog.gd")
static func available(state) -> Array[String]:
	var ids: Array[String] = []
	for v in Catalog.VEHICLES:
		if state.cars.has(v.id):
			ids.append(String(v.id))
	return ids
static func owns(state, id: String) -> bool:
	return state.cars.has(id) and not Catalog.vehicle(id).is_empty()
