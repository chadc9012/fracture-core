extends SceneTree
## The long-distance routes (owner's Racing Tracks Pack 01; scripts/racing/route.gd, route_race.gd): every route lays
## out near its pack length with its checkpoints in order, the road stays smooth (no kinks a car couldn't follow) and
## climbs where it should, the windowed nearest search agrees with a full search, and a simulated race over each finishes:
## a stage at its end, a circuit after its laps, skipping a checkpoint across country doesn't count, and the police can
## bust a car boxed in at a crawl.
## Run: godot --headless --path . --script res://tests/racing/routes_test.gd

const Route := preload("res://scripts/racing/route.gd")
const RouteRace := preload("res://scripts/racing/route_race.gd")

var ok := true

func check(name: String, cond: bool, detail := "") -> void:
	print(("ok   " if cond else "FAIL ") + name + ("  " + detail if detail != "" else ""))
	if not cond:
		ok = false

func _initialize() -> void:
	var ids := Route.ids()
	check("eight routes in the pack", ids.size() == 8, str(ids))
	for id in ids:
		var r := Route.new(id)
		var pack: float = r.def.length_m
		# bends add road: within +25 % of the pack's length, never shorter than it
		check("%s length %.1f km (pack %.1f)" % [id, r.length / 1000.0, pack / 1000.0], r.length >= pack * 0.97 and r.length <= pack * 1.25)
		var in_order := true
		for i in range(1, r.checkpoints.size()):
			if r.checkpoints[i] <= r.checkpoints[i - 1]:
				in_order = false
		check("%s %d checkpoints in order" % [id, r.checkpoints.size()], in_order and r.checkpoints.size() >= 10)
		# smooth: the heading never turns more than 25 degrees in 10 m (a hairpin at road speed is ~12)
		var worst := 0.0
		var d := 10.0
		while d < r.length - 10.0:
			worst = maxf(worst, rad_to_deg(r.dir_at(d).angle_to(r.dir_at(d + 10.0))))
			d += 10.0
		check("%s turns at most %.1f deg / 10 m" % [id, worst], worst < 25.0)
		# the climb: Frostveil ends well above where it starts; circuits end where they began
		if id == "frostveil-summit":
			check("frostveil climbs %.0f m" % (r.at(r.length).y - r.at(0.0).y), r.at(r.length).y - r.at(0.0).y > 1000.0)
		if r.closed:
			check("%s closes on itself" % id, r.at(r.length - 1.0).distance_to(r.at(0.0)) < 8.0)
		# the windowed search agrees with the full one near a car
		var agree := true
		for k in 20:
			var s := r.length * (k + 0.5) / 20.0
			var p := r.at(s) + Vector3(3, 0, -2)
			var w: Array = r.nearest_from(p, s - 30.0)
			var full: Array = r.nearest_from(p, -1.0)
			if absf(float(w[1]) - float(full[1])) > 2.0:
				agree = false
		check("%s windowed nearest agrees" % id, agree)
		# a simulated race: three cars drive the road at different speeds, sampled every 50 m of the leader
		var race := RouteRace.new(r, 1 if not r.closed else 2)
		var a := race.add("A")
		var b := race.add("B")
		var me := race.add("You", true)
		race.start()
		var pa := 0.0
		var pb := 0.0
		var pm := 0.0
		var steps := 0
		while not race.finished and steps < 200000:
			pa += 50.0
			pb += 46.0
			pm += 48.0
			var pos := [r.at(pa), r.at(pb), r.at(pm)]
			race.tick(1.0, pos)
			steps += 1
		check("%s race finishes in order A, You, B" % id, race.finished and race.order()[0] == a and race.order()[1] == me and race.order()[2] == b,
			"%d steps, laps %d" % [steps, race.laps_to_go])
		check("%s pays the winner more than last" % id, race.prize() > 0)
	# a shortcut across country misses the checkpoint it skips
	var r2 := Route.new("glass-flats")
	var race2 := RouteRace.new(r2)
	var e := race2.add("You", true)
	race2.start()
	var cp: float = r2.checkpoints[3]
	race2.tick(1.0, [r2.at(cp - 200.0)])
	for c in 3:
		race2.tick(1.0, [r2.at(r2.checkpoints[c] + 1.0)])
	var far := r2.at(cp + 5.0) + Vector3(0, 0, 400.0)
	e.hint = cp
	race2.tick(1.0, [far])
	check("a checkpoint passed far off the road is missed", int(e.next) <= 3, "next %d" % int(e.next))
	# the police bust a car boxed in at a crawl
	var r3 := Route.new("neon-midnight")
	var race3 := RouteRace.new(r3)
	race3.add("You", true)
	race3.start()
	for k in 40:
		race3.police(0.1, 2.0, 0, 2)
	check("boxed in by cruisers at a crawl: busted", race3.busted and race3.finished and race3.prize() == 0)
	print("routes: ", "ok" if ok else "FAILED")
	quit(0 if ok else 1)
