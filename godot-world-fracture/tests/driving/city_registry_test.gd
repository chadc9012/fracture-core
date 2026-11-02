extends SceneTree
const Registry = preload("res://scripts/driving/city_vehicle_registry.gd")
func _init() -> void:
	var ok := Registry.registered("tuner") and not Registry.registered("unknown")
	print("Registry test: ", ok)
	quit(0 if ok else 1)
