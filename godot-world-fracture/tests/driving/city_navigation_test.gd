extends SceneTree
const Nav = preload("res://scripts/driving/city_navigation.gd")
func _init() -> void:
	var ok := Nav.distance_to_garage(Vector3(-32,0,-80)) == 0.0
	print("Navigation test: ", ok)
	quit(0 if ok else 1)
