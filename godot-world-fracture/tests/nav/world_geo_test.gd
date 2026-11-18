extends SceneTree
## world_geo.gd: the planet frame (to_globe / to_local round trip, bearings, reframing) and the flyable sites
const Geo := preload("res://scripts/nav/world_geo.gd")
var failed := 0
func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		failed += 1
func _initialize() -> void:
	_run.call_deferred()
func _run() -> void:
	var a := Geo.lat_lon_to_vec(13.0, -4.0)
	var ll := Geo.vec_to_lat_lon(a)
	ok(absf(ll.x - 13.0) < 1e-3 and absf(ll.y + 4.0) < 1e-3, "lat/lon round trip %s" % ll)
	# 2 km east is +lon, 2 km north (-z) is +lat
	var e := Geo.vec_to_lat_lon(Geo.to_globe(a, 2000.0, 0.0))
	var n := Geo.vec_to_lat_lon(Geo.to_globe(a, 0.0, -2000.0))
	ok(e.y > -4.0 and absf(e.x - 13.0) < 0.3, "x is east (%s)" % e)
	ok(n.x > 13.0 and absf(n.y + 4.0) < 0.01, "-z is north (%s)" % n)
	ok(absf(n.x - 13.0 - 10.0) < 0.01, "2 km is 10 degrees (%s)" % n)
	for p in [Vector2(300, -800), Vector2(-5000, 7000), Vector2(15000, 2000)]:
		var g := Geo.to_globe(a, p.x, p.y)
		var back := Geo.to_local(a, g)
		ok(back.distance_to(p) < 0.5, "local round trip %s -> %s" % [p, back])
	var b := Geo.lat_lon_to_vec(6.5, 25.0)
	ok(absf(rad_to_deg(Geo.bearing(a, b)) - 103.0) < 10.0, "Nexus -> Neon City bears east-south-east (%.0f deg)" % rad_to_deg(Geo.bearing(a, b)))
	print("     Nexus -> Neon City %.0f m" % Geo.dist(a, b))
	# reframe: a point and heading carried to another anchor and back
	var r := Geo.reframe(a, b, 1200.0, -300.0, 0.7)
	var r2 := Geo.reframe(b, a, r[0].x, r[0].y, r[1])
	ok(r2[0].distance_to(Vector2(1200, -300)) < 0.5 and absf(angle_difference(r2[1], 0.7)) < 0.01, "reframe round trip %s %.3f" % [r2[0], r2[1]])
	# flying straight on a great circle comes back round: step 72 km in 500 m steps, reframing each 3 km
	var anchor := a
	var pos := Vector2.ZERO
	var yaw := Geo.heading_to_yaw(deg_to_rad(90.0))
	var travelled := 0.0
	while travelled < 2.0 * PI * Geo.R:
		pos += Vector2(-sin(yaw), -cos(yaw)) * 500.0
		travelled += 500.0
		if pos.length() > 3000.0:
			var here := Geo.to_globe(anchor, pos.x, pos.y)
			var rf := Geo.reframe(anchor, here, pos.x, pos.y, yaw)
			anchor = here
			pos = rf[0]
			yaw = rf[1]
	var end := Geo.to_globe(anchor, pos.x, pos.y)
	ok(Geo.dist(end, a) < 600.0, "round the world east comes home (%.0f m off, %.0f km flown)" % [Geo.dist(end, a), travelled / 1000.0])
	var s := Geo.sites()
	ok(s.size() >= 15, "%d flyable sites" % s.size())
	for x in s:
		print("     %-18s %-16s %6.1f %7.1f" % [x.map, x.continent, x.lat, x.lon])
	print("world geo: %d failed" % failed)
	quit(1 if failed else 0)
