extends Node
## The Nexus Highlands Overlook (scripts/city/overlook.gd, owner's pick Nov 24): the map has the place, the street's
## HIGHLANDS FUNICULAR door puts the operator on the crag's cap (standing on its deck, above the city), the cliffs are a
## wall at the foot, the funicular rides down and up, and the VIEW names the city, the airport, the harbour, the coastal
## highway and the lands on the horizon at their bearings.
##   godot --headless --path godot-world-fracture res://tests/city/overlook.tscn   (OUT=<png> also renders the view)
const ArrivalView := preload("res://scripts/airport/arrival_view.gd")
const Overlook := preload("res://scripts/city/overlook.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame

func _ready() -> void:
	var has := false
	for p in Data.map("nexus").pois:
		if String(p.id) == "nexus-overlook":
			has = true
	ok(has, "the Highlands Overlook is a place on the Nexus map")
	var b := Overlook.bearing({ "lat": 0.0, "lon": 0.0 }, { "lat": 0.0, "lon": 10.0 })
	ok(absf(b.x - 90.0) < 0.5 and absf(b.y - 1112.0) < 5.0 and Overlook.dir_of(90.0).distance_to(Vector2(1, 0)) < 1e-4 and Overlook.dir_of(0.0).distance_to(Vector2(0, -1)) < 1e-4, "bearings: due east is +x, north is -z (%.1f°, %.0f km)" % [b.x, b.y])
	var v: Control = ArrivalView.new()
	v.dest = "NXC"
	v.region_id = "nexus"
	v.on_cap = true
	add_child(v)
	await _frames(8)
	var o: Node = v.overlook
	ok(o.active(), "the crag stands (cap at %.1f m)" % o.cap.y)
	var city_y: float = v.region.ground(o.face.x, o.face.z)
	ok(o.cap.y - city_y > 30.0, "its cap is well above the city (%.0f m over it)" % (o.cap.y - city_y))
	for i in 30:
		v._process(1.0 / 30.0)
	ok(absf(v.operator.position.y - o.cap.y) < 1.0, "the funicular door stands the operator on the cap (%.1f vs %.1f)" % [v.operator.position.y, o.cap.y])
	# the cliffs: walking at the crag from its foot stops at the wall
	v.operator.position = o.foot
	var to: Vector3 = (o.cap - o.foot) * Vector3(1, 0, 1)
	for i in 120:
		v.operator.cam_yaw = atan2(-to.x, -to.z)
		v.operator.step(1.0 / 30.0, Vector2(0, 1), Vector2.ZERO, false, false)
	ok(v.operator.position.y < o.cap.y - 10.0, "from the foot the crag is a wall, not a step (%.1f m up)" % (v.operator.position.y - o.foot.y))
	# the funicular up
	v.operator.position = o.foot
	await _frames(1)
	o._here = ""
	o.step(0.0)
	ok(o._here == "up", "at the car the ride is offered (%s)" % o._here)
	v.controls._enter = true
	o.step(0.0)
	ok(absf(v.operator.position.y - o.cap.y) < 1.0, "the funicular rides up to the cap")
	# and on the cap, at the middle, the VIEW is offered
	v.operator.position = o.cap
	o._here = ""
	o.step(0.0)
	ok(o._here == "view", "on the cap the VIEW is offered (%s)" % o._here)
	# the view
	v.operator.position = o.cap
	o._begin_view()
	await _frames(3)
	o._place_marks()
	var shown: Array = o.shown()
	print("     in view: ", shown)
	ok(shown.has("NEXUS CITY") and shown.size() >= 3, "the view names the city and what's round it")
	var all := []
	for mk in o._marks:
		all.append((mk[0] as Label).text)
	ok(all.size() >= 8, "the city's places and the lands on the horizon are all named (%d)" % all.size())
	var out := OS.get_environment("OUT")
	if out != "":
		await _frames(20)
		get_viewport().get_texture().get_image().save_png(out)
		print("     wrote ", out)
	o._end_view()
	print("overlook: %d failed" % fails)
	get_tree().quit(0 if fails == 0 else 1)
