extends Node
## Skyways in the F-39 Jupiter (scripts/flying/skyways_view.gd), headless with the frame stepped by hand: the jet
## starts on the apron on its undercarriage, folds it away once it is up and climbing, and drops it again coming down.
## Run: godot --headless --path . res://tests/flying/skyways_play.tscn

const SkywaysView := preload("res://scripts/flying/skyways_view.gd")
const Handling := preload("res://scripts/driving/vehicle_handling.gd")
const Air := preload("res://scripts/airport/airport.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")

var ok := true

func check(name: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + name)
	ok = ok and cond

func _ready() -> void:
	for f in ["user://profile.json"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(f))
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
	# a hangar aircraft: it takes off with its saved condition and tank, burns fuel with the throttle, brings both back
	v.queue_free()
	await get_tree().process_frame
	var pr := Gear.profile_load()
	Air.set_condition(pr, "vanguard-jet", 70)
	Air.set_fuel(pr, "vanguard-jet", 30)
	Gear.profile_save(pr)
	v = SkywaysView.new()
	v.craft_id = "vanguard-jet"
	v.from_hangar = true
	add_child(v)
	for i in 3:
		await get_tree().process_frame
	check("a hangar jet takes off with its condition as hull (%d%%) and its tank (%d%%)" % [int(v.hull_hp * 100), int(v.fuel)], is_equal_approx(v.hull_hp, 0.7) and is_equal_approx(v.fuel, 30.0))
	v.controls.scripted = true
	v.controls.move = Vector2(0.0, 1.0)
	v.controls._brake_held = true
	for i in 400:   # 20 s wide open
		v._process(0.05)
	var burnt := 30.0 - v.fuel
	check("the throttle burns the tank (%.1f%% in 20 s)" % burnt, burnt > 2.0 and burnt < 6.0 and v._hud.text.contains("FUEL"))
	v.fuel = 0.4
	for i in 60:
		v._process(0.05)
	var sp0: float = absf(v.state.speed)
	for i in 100:
		v._process(0.05)
	check("empty, there is no thrust: the jet slows (%.0f → %.0f m/s) and the warning shows" % [sp0, absf(v.state.speed)], v.fuel <= 0.0 and absf(v.state.speed) < sp0 and v._fuel_warned)
	v.hull_hp = 0.55
	v.queue_free()
	await get_tree().process_frame
	pr = Gear.profile_load()
	check("closing the flight writes the hull and the tank back (%d%%, %d%%)" % [Air.condition(pr, "vanguard-jet"), Air.fuel(pr, "vanguard-jet")], Air.condition(pr, "vanguard-jet") == 55 and Air.fuel(pr, "vanguard-jet") == 0)
	# the air race (air_race.gd): three rival jets on the apron lift when you do and fly the rings; placings by rings
	# then time; the purse by place
	v = SkywaysView.new()
	v.craft_id = "vanguard-jet"
	v.air_race = true
	add_child(v)
	for i in 3:
		await get_tree().process_frame
	check("an air race fields three rival jets on the apron", v.race != null and v.race.rivals.size() == 3 and not v.race.launched)
	var apron := true
	for r in v.race.rivals:
		apron = apron and r.pos.distance_to(v.pad) > 15.0 and r.pos.distance_to(v.pad) < 90.0 and absf(r.pos.y - v.pad.y) < 3.0
	check("the rivals wait beside the pad, on the ground", apron)
	v.race.step(0.05)
	check("nobody moves before you lift off", not v.race.launched and v.race.rivals[0].speed == 0.0)
	check("on the line everyone has 0 rings and you are P1 of 4 by the tie", v.race.place() == 1 and v.race.standings().size() == 4)
	v.controls.scripted = true
	v.controls.move = Vector2(0.0, 1.0)
	v.controls._brake_held = true
	for i in 40:
		v._process(0.05)
	check("you lift off and the field launches", v.state.airborne and v.race.launched)
	for i in 500:   # 25 s
		v._process(0.05)
	var flown := 0
	for r in v.race.rivals:
		flown = maxi(flown, int(r.next))
	var high := true
	for r in v.race.rivals:
		high = high and r.pos.y > v.region.ground(r.pos.x, r.pos.z) + 5.0
	check("25 s in the rivals are flying the rings (best %d of %d) above the ground" % [flown, v.rings.size()], flown >= 1 and high)
	check("rivals ahead of you on rings place ahead", v.race.place() > 1 or v.next_ring >= flown)
	# the finish: you through the last ring while a rival has the lot — second place money
	v.race.rivals[0].next = v.rings.size()
	v.race.rivals[0].done_at = 10.0
	v.next_ring = v.rings.size() - 1
	var pr0 := Gear.profile_load()
	var nex0 := int(pr0.get("nex", 0))
	v.hull.position = v.rings[v.rings.size() - 1].pos
	v._process(0.05)
	var pr1 := Gear.profile_load()
	check("through the last ring behind one rival: P2 and the P2 purse (%d Nex)" % v.race.purse(2), v.finished and v.race.place() == 2 and int(pr1.get("nex", 0)) - nex0 == v.race.purse(2))
	print("skyways play: ", "0 failed" if ok else "FAILED")
	get_tree().quit(0 if ok else 1)
