extends SceneTree
const Access = preload("res://scripts/driving/city_garage_access.gd")
const Portal = preload("res://scripts/driving/city_garage_portal.gd")
func _init() -> void:
	var ok := Access.in_range(Portal.LOCATION) and not Access.in_range(Vector3.ZERO)
	print("City garage range test: ", ok)
	quit(0 if ok else 1)
