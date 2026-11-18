extends Node
## World flight (owner, Nov 18: "make it so you can fly around the world"): a jet takes off from Nexus City, flies the
## great circle toward Neon City and arrives there (the region builds under it, with the craft carried into its frame),
## flies on over the open sea round the planet, and comes back into Nexus City airspace from the other side. The GPS
## shows the place and points at the next region all the way. Headless, frames stepped by hand.
## Run: godot --headless --path . res://tests/flying/world_flight_play.tscn

const SkywaysView := preload("res://scripts/flying/skyways_view.gd")
const Geo := preload("res://scripts/nav/world_geo.gd")

var fails := 0

func check(name: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + name)
	if not cond:
		fails += 1

func _ready() -> void:
	var v := SkywaysView.new()
	v.craft_id = OS.get_environment("CRAFT") if OS.get_environment("CRAFT") != "" else "void-skimmer"
	add_child(v)
	for i in 3:
		await get_tree().process_frame
	var home: Vector3 = v.globe_pos()
	check("starts on the globe at Nexus City (%s)" % Geo.lat_lon_text(Geo.vec_to_lat_lon(home)), home != Vector3.ZERO and v.place_name() == "Nexus City")
	check("the GPS is on screen", v.gps != null and v.gps.is_inside_tree())
	# off the runway and up
	v.controls.scripted = true
	v.controls.move = Vector2(0.0, 1.0)
	v.controls._brake_held = true
	for i in 500:
		v._process(0.05)
	v.controls._brake_held = false
	check("airborne and climbing (%.0f m)" % v.hull.position.y, v.state.airborne)
	# turn onto the great circle for Neon City, then hold the stick still: the frame changes must keep it straight
	var neon: Dictionary = Geo.site("neon-city")
	v.state.yaw = Geo.heading_to_yaw(Geo.bearing(v.globe_pos(), neon.v))
	var p0: Vector3 = v.globe_pos()   # the great circle starts here: a full lap must come back over this point
	var closest := INF
	var seen := []
	var flown := 0.0
	var last: Vector3 = v.globe_pos()
	var t := 0.0
	var rebuilds := []
	var worst_frame := 0.0
	var gps_far := ""
	var back_home := false
	var left_home := false
	while t < 1200.0:
		var place: String = v.place_name()
		var t0 := Time.get_ticks_msec()
		v._process(0.05)
		var ms := Time.get_ticks_msec() - t0
		t += 0.05
		var now: Vector3 = v.globe_pos()
		flown += Geo.dist(last, now)
		last = now
		if v.place_name() != place:
			seen.append(v.place_name())
			if v.place_name() != "Open sea":
				rebuilds.append(ms)
			print("     %5.0f s  %6.1f km  %-14s %s  alt %.0f m  (%d ms)" % [t, flown / 1000.0, v.place_name(), Geo.lat_lon_text(Geo.vec_to_lat_lon(now)), v.hull.position.y - v.region.water_level(), ms])
		if v.place_name() == "Open sea" and gps_far == "":
			gps_far = v.gps._caption()
		if flown > 60000.0:
			closest = minf(closest, Geo.dist(now, p0))
		if flown > 80000.0:
			break
		if v.hull_hp <= 0.3:
			break
	check("arrived at Neon City on the way (%s)" % ", ".join(seen), "Neon City" in seen)
	check("flew out over the open sea", "Open sea" in seen)
	check("the GPS over the sea says where (%s)" % gps_far, gps_far.begins_with("Open sea") and gps_far.contains("°"))
	check("flew right round the world and back over where it set course (%.0f m off after %.1f km, %.0f s at %.0f m/s)" % [closest, flown / 1000.0, t, absf(v.state.speed)], closest < 800.0)
	# then home: steer for Nexus City until it builds under you
	t = 0.0
	while t < 400.0 and v.place_name() != "Nexus City":
		v.state.yaw = Geo.heading_to_yaw(Geo.bearing(v.globe_pos(), home))
		v._process(0.05)
		t += 0.05
	back_home = v.place_name() == "Nexus City"
	check("flew home into Nexus City airspace in %.0f s" % t, back_home)
	while t < 400.0 and Geo.dist(v.globe_pos(), home) > 400.0:
		v.state.yaw = Geo.heading_to_yaw(Geo.bearing(v.globe_pos(), home))
		v._process(0.05)
		t += 0.05
	check("still flying, hull %d%%" % int(v.hull_hp * 100), v.state.airborne and v.hull_hp > 0.3)
	print("     region builds: %s ms" % [rebuilds])
	# land at home: ease off and hold DOWN
	v.controls.move = Vector2(0.0, 0.2)
	v.controls._sprint_held = true
	var hard := false
	t = 0.0
	while v.state.airborne and t < 180.0:
		v._process(0.05)
		t += 0.05
		hard = hard or v.state.hard_landing
	check("landed at home after %.0f s (%s)" % [t, "hard" if hard else "soft"], not v.state.airborne and not hard)
	print("world flight: %d failed" % fails)
	get_tree().quit(0 if fails == 0 else 1)
