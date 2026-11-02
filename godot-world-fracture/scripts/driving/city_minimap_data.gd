extends RefCounted
const Portal = preload("res://scripts/driving/city_garage_portal.gd")
static func garage_marker() -> Dictionary:
	return {"name": "Nexus Customs", "position": Portal.LOCATION}
