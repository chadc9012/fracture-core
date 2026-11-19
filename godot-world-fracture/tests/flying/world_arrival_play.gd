extends Node
## World flight to another airport (Nov 18): your own jet out of the Nexus City hangar flies to Neon City, lands there,
## and getting out parks it at Neon City International (skyways_view arrived("NEC"), airport.gd relocate_aircraft) with
## the hull and tank it came in with. Getting out at sea is refused. The saved profile is restored afterwards.
## Run: godot --headless --path . res://tests/flying/world_arrival_play.tscn

const SkywaysView := preload("res://scripts/flying/skyways_view.gd")
const Geo := preload("res://scripts/nav/world_geo.gd")
const Air := preload("res://scripts/airport/airport.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")

var fails := 0

func check(name: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + name)
	if not cond:
		fails += 1

func _ready() -> void:
	var had := FileAccess.file_exists(Gear.PROFILE)
	var saved := FileAccess.get_file_as_string(Gear.PROFILE) if had else ""
	var pr := Gear.profile_load()
	var a := Air.air(pr)
	a.aircraft["NXC"] = ["skyhawk"]
	a.aircraft["NEC"] = []
	Air.set_fuel(pr, "skyhawk", 100)
	Air.set_condition(pr, "skyhawk", 100)
	Gear.profile_save(pr)
	var v := SkywaysView.new()
	v.craft_id = "skyhawk"
	v.region_id = "nexus"
	v.from_hangar = true
	var got := [""]
	v.arrived.connect(func(code: String): got[0] = code)
	add_child(v)
	for i in 3:
		await get_tree().process_frame
	v.controls.scripted = true
	v.controls.move = Vector2(0.0, 1.0)
	v.controls._brake_held = true
	for i in 400:
		v._process(0.05)
	v.controls._brake_held = false
	var neon: Dictionary = Geo.site("neon-city")
	var t := 0.0
	var tried_at_sea := false
	while t < 400.0 and not (v.place_name() == "Neon City" and Geo.dist(v.globe_pos(), neon.v) < 1100.0):
		v.state.yaw = Geo.heading_to_yaw(Geo.bearing(v.globe_pos(), neon.v))
		v._process(0.05)
		t += 0.05
		if not tried_at_sea and v.place_name() == "Open sea":
			tried_at_sea = true
	check("flew from Nexus City to over Neon City in %.0f s" % t, v.place_name() == "Neon City")
	# down onto the city: ease off, hold DOWN
	v.controls.move = Vector2(0.0, 0.2)
	v.controls._sprint_held = true
	t = 0.0
	while v.state.airborne and t < 200.0:
		if Geo.dist(v.globe_pos(), neon.v) > 60.0:
			v.state.yaw = Geo.heading_to_yaw(Geo.bearing(v.globe_pos(), neon.v))
		v._process(0.05)
		t += 0.05
		if int(t * 20) % 200 == 0:
			print("     t %.0f  alt %.0f  y %.0f  ground %.0f  vy %.1f  speed %.0f  %s" % [t, v.hull.position.y - v.region.ground(v.hull.position.x, v.hull.position.z), v.hull.position.y, v.region.ground(v.hull.position.x, v.hull.position.z), v.state.vy, v.state.speed, v.place_name()])
	v.controls.move = Vector2.ZERO
	v.controls._sprint_held = false
	for i in 200:
		v._process(0.05)
	check("landed in Neon City (hull %d%%, fuel %d%%)" % [int(v.hull_hp * 100), int(v.fuel)], not v.state.airborne)
	v._try_exit()
	check("getting out parks it at Neon City International (arrived %s)" % got[0], got[0] == "NEC")
	var p2 := Gear.profile_load()
	Air.relocate_aircraft(p2, "NXC", got[0], "skyhawk")
	check("the Skyhawk moved from the Nexus hangar list to Neon City's", "skyhawk" in Air.aircraft_at(p2, "NEC") and not ("skyhawk" in Air.aircraft_at(p2, "NXC")))
	check("its tank came back burnt (%d%%)" % Air.fuel(p2, "skyhawk"), Air.fuel(p2, "skyhawk") < 100)
	# like a real airport (owner, Nov 19): no hangar of yours there, so it stays put; a ticket is the way on
	var note := Air.parked_note(p2, "NEC")
	check("no hangar at Neon City: it can't fly out, a ticket is the way on (%s)" % note, note.contains("can't fly out") and note.contains("ticket") and not Air.can_go_airside(p2, "NEC"))
	Air.air(p2).hangars["NEC"] = "A"
	check("with a hangar leased there it's yours to fly again", Air.parked_note(p2, "NEC") == "" and Air.can_go_airside(p2, "NEC"))
	v.queue_free()
	if had:
		var f := FileAccess.open(Gear.PROFILE, FileAccess.WRITE)
		f.store_string(saved)
		f.close()
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(Gear.PROFILE))
	print("world arrival: %d failed" % fails)
	get_tree().quit(0 if fails == 0 else 1)
