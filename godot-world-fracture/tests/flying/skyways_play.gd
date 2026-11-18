extends Node
## Skyways in the F-39 Jupiter (scripts/flying/skyways_view.gd), headless with the frame stepped by hand: the jet
## starts on the apron on its undercarriage, folds it away once it is up and climbing, and drops it again coming down.
## Run: godot --headless --path . res://tests/flying/skyways_play.tscn

const SkywaysView := preload("res://scripts/flying/skyways_view.gd")
const Handling := preload("res://scripts/driving/vehicle_handling.gd")

var ok := true

func check(name: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + name)
	ok = ok and cond

func _ready() -> void:
	var v := SkywaysView.new()
	v.craft_id = "vanguard-jet"
	add_child(v)
	for i in 3:
		await get_tree().process_frame
	check("the jet stands on its pad", v.state != null and not v.state.airborne and v.hull.position.distance_to(v.pad) < 3.0)
	check("a tricycle undercarriage under the belly (3 legs, 5 tyres)", v._gear != null and v._gear.get_child_count() == 3 and v._gear_wheels.size() == 5)
	check("the gear is down on the pad", v._gear.visible and is_equal_approx(v._gear_k, 1.0))
	var leg0: Node3D = v._gear.get_child(0)
	var tyre: Node3D = v._gear_wheels[0]
	check("the nose tyre hangs the ride height below the hull (%.2f m)" % -tyre.position.y, tyre.position.y < -(Handling.RIDE - 0.6) and tyre.position.y > -Handling.RIDE)
	check("the nose leg is ahead of the mains", leg0.position.z < (v._gear.get_child(1) as Node3D).position.z)
	# throttle up the runway with UP held: the jet lifts, climbs clear, the gear folds
	v.controls.scripted = true
	v.controls.move = Vector2(0.0, 1.0)
	v.controls._brake_held = true
	var t := 0.0
	while not v.state.airborne and t < 30.0:
		v._process(0.05)
		t += 0.05
	check("airborne after a takeoff run (%.1f s)" % t, v.state.airborne)
	var spin: float = tyre.rotation.x
	check("the tyres spun on the runway", absf(spin) > 0.5)
	for i in 200:
		v._process(0.05)
	var alt: float = v.hull.position.y - v.region.ground(v.hull.position.x, v.hull.position.z)
	check("climbing clear (%.0f m) the gear folded away" % alt, alt > 8.0 and v._gear_k < 0.05 and not v._gear.visible)
	# ease off and sink: coming down under 40 m the gear drops
	v.controls._brake_held = false
	v.controls.move = Vector2(0.0, 0.3)
	v.controls._sprint_held = true   # DOWN
	var puffs := 0
	t = 0.0
	while v._gear_k < 0.95 and t < 120.0:
		v._process(0.05)
		t += 0.05
		if v._touch_puff and v._touch_puff.emitting:
			puffs += 1
	alt = v.hull.position.y - v.region.ground(v.hull.position.x, v.hull.position.z)
	check("coming down (%.0f m, %.0f m/s) the gear is back down by %.0f s" % [alt, v.state.speed, t], v._gear_k >= 0.95 and v._gear.visible)
	print("skyways play: ", "0 failed" if ok else "FAILED")
	get_tree().quit(0 if ok else 1)
