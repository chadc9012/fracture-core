extends Node
## Every aircraft in Skyways (skyways_view.gd CRAFT, kinds JET / HELI / AIRSHIP), headless with the frame stepped by
## hand: its model loads, it gets off the apron, climbs clear of the city, flies on without hitting anything, and comes
## back down to the ground. Prints one line per craft with what it did.
## Run: godot --headless --path . res://tests/flying/all_aircraft_play.tscn   (ONLY=<id> for one)

const SkywaysView := preload("res://scripts/flying/skyways_view.gd")

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
	var hp_after_climb: float = v.hull_hp
	check("%s: climbed to %.0f m at %.0f m/s" % [name, top, absf(v.state.speed)], top > 8.0)
	# level off and cruise 15 s
	v.controls._brake_held = false
	for i in 300:
		v._process(0.05)
	var dist := Vector2(v.hull.position.x - start.x, v.hull.position.z - start.z).length()
	print("     after cruise at (%.0f, %.0f), alt %.0f m" % [v.hull.position.x, v.hull.position.z, _alt(v)])
	check("%s: flew %.0f m from the pad, hull %d%%" % [name, dist, int(v.hull_hp * 100)], dist > 60.0 and v.hull_hp > 0.0)
	# come down: ease the throttle, hold DOWN, until it touches the ground
	v.controls.move = Vector2(0.0, 0.2)
	v.controls._sprint_held = true
	t = 0.0
	while v.state.airborne and t < 180.0:
		v._process(0.05)
		t += 0.05
	check("%s: back on the ground after %.0f s (hull %d%%, climb hull %d%%)" % [name, t, int(v.hull_hp * 100), int(hp_after_climb * 100)], not v.state.airborne)
	v.queue_free()
	await get_tree().process_frame
