extends SceneTree
## The map's waypoint (scripts/nav/waypoint.gd), headless: set / read / clear, where you stood, and the road route on
## Nexus City's map — it runs along the streets (longer than the straight line, every leg short) and ends on the spot.
## Prints "waypoint: N failed".

const Waypoint := preload("res://scripts/nav/waypoint.gd")
var failed := 0

func ok(c: bool, what: String) -> void:
	print(("ok   " if c else "FAIL ") + what)
	if not c:
		failed += 1

func _initialize() -> void:
	var keep := FileAccess.get_file_as_string(Waypoint.SAVE) if FileAccess.file_exists(Waypoint.SAVE) else ""
	Waypoint.set_waypoint("nexus", 162.4, 13.6, "Nexus Airport")
	Waypoint.set_here("nexus", 4.4, -255.0, 1.0)
	var w := Waypoint.get_waypoint()
	ok(String(w.map) == "nexus" and String(w.name) == "Nexus Airport" and absf(float(w.x) - 162.4) < 0.01, "a waypoint is kept")
	ok(String(Waypoint.get_here().map) == "nexus", "and where you stood")
	var Data = load("res://scripts/data.gd").new()
	Data._ready()
	var m: Dictionary = Data.map("nexus")
	var a := Vector2(4.4, -255.0)
	var b := Vector2(162.4, 13.6)
	var r := Waypoint.route(m, a, b)
	var L := Waypoint.length(r)
	ok(r.size() > 6 and r[0] == a and r[r.size() - 1] == b, "a route from you to the spot (%d points)" % r.size())
	ok(L > a.distance_to(b) * 1.02 and L < a.distance_to(b) * 2.0, "along the streets: %.0f m against %.0f m straight" % [L, a.distance_to(b)])
	Waypoint.clear_waypoint()
	ok(Waypoint.get_waypoint().is_empty() and not Waypoint.get_here().is_empty(), "cleared, and where you stood stays")
	if keep != "":
		FileAccess.open(Waypoint.SAVE, FileAccess.WRITE).store_string(keep)
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(Waypoint.SAVE))
	Data.free()
	print("waypoint: %d failed" % failed)
	quit(1 if failed > 0 else 0)
