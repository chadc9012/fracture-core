extends Node
## Every aircraft in Skyways (skyways_view.gd CRAFT, kinds JET / HELI / AIRSHIP), headless with the frame stepped by
## hand: its model loads, it gets off the apron, climbs clear of the city, flies on without hitting anything, and comes
## back down to the ground. Prints one line per craft with what it did.
## Run: godot --headless --path . res://tests/flying/all_aircraft_play.tscn   (ONLY=<id> for one)

const SkywaysView := preload("res://scripts/flying/skyways_view.gd")
const Geo := preload("res://scripts/nav/world_geo.gd")

var fails := 0

func check(name: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + name)
	if not cond:
		fails += 1

func _ready() -> void:
	var only := OS.get_environment("ONLY")
	for id: String in SkywaysView.CRAFT:
		if String(SkywaysView.CRAFT[id].kind) not in ["JET", "HELI", "AIRSHIP"]:
			continue
		if only != "" and id != only:
			continue
		await _fly(id)
	print("all aircraft: %d failed" % fails)
	get_tree().quit(0 if fails == 0 else 1)

func _alt(v) -> float:
	return v.hull.position.y - v.region.ground(v.hull.position.x, v.hull.position.z)

func _fly(id: String) -> void:
	var name := String(SkywaysView.CRAFT[id].name)
	var v := SkywaysView.new()
	v.craft_id = id
	add_child(v)
	for i in 3:
		await get_tree().process_frame
	var meshes := v.hull.find_children("*", "MeshInstance3D", true, false).size() if v.hull else 0
	check("%s: model loaded (%d meshes), on its pad" % [name, meshes], meshes > 0 and v.state != null and not v.state.airborne)
	var start: Vector3 = v.hull.position
	print("     region span %.0f m, pad at (%.0f, %.0f), heading %.0f deg" % [v.region.span(), start.x, start.z, rad_to_deg(v.state.yaw)])
	# full throttle with UP held until it is off the ground
	v.controls.scripted = true
	v.controls.move = Vector2(0.0, 1.0)
	v.controls._brake_held = true
	var t := 0.0
	while not v.state.airborne and t < 40.0:
		v._process(0.05)
		t += 0.05
	check("%s: airborne after %.1f s" % [name, t], v.state.airborne)
	# climb on for 10 s
	var top := 0.0
	for i in 200:
		v._process(0.05)
		top = maxf(top, _alt(v))
	check("%s: climbed to %.0f m at %.0f m/s" % [name, top, absf(v.state.speed)], top > 8.0)
	# level off and cruise 60 s straight out: no limit (owner, Nov 18: "removed completely") — the craft keeps its heading
	# the whole way, and the sea under it keeps up so there is no edge to see
	v.controls._brake_held = false
	# straight means on one great circle of the planet (the craft's local yaw changes with the region frames, Nov 18):
	# the halfway point lies on the line from start to end
	var g0: Vector3 = v.globe_pos()
	var gm := Vector3.ZERO
	var far := 0.0
	for i in 1200:
		v._process(0.05)
		if i == 600:
			gm = v.globe_pos()
		far = maxf(far, Geo.dist(v.globe_pos(), Geo.site("nexus").v))
	var g1: Vector3 = v.globe_pos()
	var bend := Geo.dist(g0, gm) + Geo.dist(gm, g1) - Geo.dist(g0, g1)
	var sea: Node3D = v.region._sea
	var sea_gap := Vector2(sea.position.x - v.hull.position.x, sea.position.z - v.hull.position.z).length() if sea else 0.0
	print("     after cruise over %s, alt %.0f m; furthest %.0f m from Nexus City (the old limit was %.0f)" % [v.place_name(), _alt(v), far, v.region.span() * 3.6 - 40.0])
	check("%s: flew out past the map (%.0f m from the centre, map edge %.0f m), hull %d%%" % [name, far, v.region.span() * 0.5, int(v.hull_hp * 100)], far > v.region.span() * 0.5 + 100.0 and v.hull_hp > 0.0)
	check("%s: nothing turned it back: one straight great circle (%.0f m off line over %.1f km)" % [name, bend, Geo.dist(g0, g1) / 1000.0], bend < 30.0)
	check("%s: the sea is under it out there (%.0f m off)" % [name, sea_gap], sea_gap < 64.0)
	# come down: ease the throttle, hold DOWN, until it touches the ground
	v.controls.move = Vector2(0.0, 0.2)
	v.controls._sprint_held = true
	t = 0.0
	var hard := false
	var vy := 0.0
	var touch := 0.0
	while v.state.airborne and t < 180.0:
		vy = v.state.vy
		touch = v.state.speed
		v._process(0.05)
		t += 0.05
		hard = hard or v.state.hard_landing
	check("%s: back on the ground after %.0f s" % [name, t], not v.state.airborne)
	check("%s: a soft landing holding DOWN (touchdown %.1f m/s down, %.0f m/s along)" % [name, -vy, absf(touch)], not hard)
	v.queue_free()
	await get_tree().process_frame
