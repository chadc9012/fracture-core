extends SceneTree
## Track Pack 01 (the owner's eight tracks, Nov 11), headless: every track loads from their data at its full length with
## their 12 checkpoints in order; the gridded nearest-point search agrees with the full scan; the highways climb; each
## venue builds (road pieces, scenery, arches); a race runs on the shortest and on the water lap (cars on the road's
## height, hovering on the water); the lobby lists all eight with the lap choice.
##   godot --headless --path godot-world-fracture --script res://tests/racing/track_pack_test.gd
## Prints "track pack: N failed".

const Track := preload("res://scripts/racing/track.gd")
const TrackPack := preload("res://scripts/racing/track_pack.gd")
const PackVenue := preload("res://scripts/racing/pack_venue.gd")
const RaceView := preload("res://scripts/racing/race_view.gd")
var failed := 0

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func frames(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	ok(TrackPack.ids().size() == 8 and Track.ids().size() == Track.TRACKS.size() + 8, "the eight tracks join the race list")
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	for id in TrackPack.ids():
		var t := Track.new(String(id))
		var target := float(t.def.target_km) * 1000.0
		var cps: Array = t.checkpoint_alongs()
		ok(absf(t.length - target) / target < 0.02 and cps.size() == 12 and float(cps[0]) < 5.0,
			"%s: %.1f km (owner's %.0f), 12 checkpoints from the line" % [t.def.name, t.length / 1000.0, target / 1000.0])
		# the grid's nearest against the full scan, near the road
		var agree := true
		for i in 25:
			var d := rng.randf() * t.length
			var p := t.at(d) + Vector3(rng.randf_range(-20, 20), 0, rng.randf_range(-20, 20))
			var fast: Array = t.nearest(p)
			var g: Dictionary = t._grid
			t._grid = {}
			var slow: Array = t.nearest(p)
			t._grid = g
			if absf(float(fast[1]) - float(slow[1])) > 0.05:
				agree = false
		ok(agree and not t._grid.is_empty(), "%s: the gridded search finds the same nearest point" % t.def.name)
	var ring := Track.new("neon-ring-express")
	var top := 0.0
	for p in ring.pts:
		top = maxf(top, p.y)
	ok(top > 15.0 and absf(ring.height_at(ring.at(ring.length * 0.3)) - ring.at(ring.length * 0.3).y) < 0.5, "the Ring Express climbs onto its viaduct (%.0f m)" % top)

	# every venue builds
	for id in TrackPack.ids():
		var t := Track.new(String(id))
		var v := PackVenue.new()
		root.add_child(v)
		var t0 := Time.get_ticks_msec()
		v.build(t)
		var ms := Time.get_ticks_msec() - t0
		ok(v.chunks >= int(t.length / PackVenue.CHUNK) - 1 or t.def.env == "water", "%s builds: %d road pieces, %d scenery groups, %d arches (%d ms)" % [t.def.name, v.chunks, v.scenery, v.arches, ms])
		ok(v.scenery > 0 and v.arches >= 10, "%s has its scenery and checkpoint arches" % t.def.name)
		v.queue_free()
		await process_frame

	# a race on the shortest, then on the water
	for id in ["neon-midnight-run", "azure-hover-challenge"]:
		var rv := RaceView.new()
		rv.track_id = id
		rv.laps = 1
		root.add_child(rv)
		await frames(3)
		ok(rv.track.pack() and rv.venue != null and rv.race.laps_to_go == 1 and rv.race.entries.size() == 4, "%s: on the grid, 1 lap, four cars" % rv.track.def.name)
		ok(String(rv.race.entries[0].name) == String(rv.track.def.rivals[0]), "the track's own rivals (%s)" % rv.race.entries[0].name)
		rv.countdown = 0.05
		rv.controls.scripted = true
		rv.autopilot = true
		var t0 := Time.get_ticks_msec()
		while rv.race.time < 6.0 and Time.get_ticks_msec() - t0 < 90000:
			await process_frame
		var me: Dictionary = rv.race.player()
		var pp: Vector3 = rv.player.node.position
		var road_y: float = rv.track.height_at(pp)
		ok(float(me.frac) > 0.0 and float(me.frac) < 0.5 and rv.player.speed > 10.0, "%s: away down the road (%.0f m, %d km/h)" % [rv.track.def.name, float(me.frac) * rv.track.length, int(rv.player.speed * 3.6)])
		if id == "azure-hover-challenge":
			ok(bool(rv.player.profile.get("hover", false)) and pp.y > road_y + 0.5, "on the water the cars hover (%.1f m up)" % (pp.y - road_y))
		else:
			ok(absf(pp.y - road_y) < 0.3, "the car rides the road's height")
		ok(rv.hud.text.contains("CP ") and rv.hud.text.contains("km to go"), "the HUD counts checkpoints and distance")
		rv.queue_free()
		await frames(3)

	# the lobby
	var Hub = load("res://scripts/modes/modes_hub.gd")
	var hub = Hub.new()
	root.add_child(hub)
	await frames(2)
	hub.open_mode("races")
	await frames(2)
	var buttons := 0
	for b in hub.page.find_children("*", "Button", true, false):
		if (b as Button).text.contains("\n") and ((b as Button).text.contains(" km")):
			buttons += 1
	ok(buttons == 8, "the races page lists the eight (%d)" % buttons)
	hub.lap_mode = 0
	ok(hub.pack_laps(Track.def_of("nexus-grand-prix")) == 1, "1 LAP")
	hub.lap_mode = 1
	ok(hub.pack_laps(Track.def_of("nexus-grand-prix")) == 5, "BOARD: the Grand Prix runs its 5")
	hub.lap_mode = 2
	ok(hub.pack_laps(Track.def_of("nexus-grand-prix")) == 10, "ENDURANCE: 10")
	print("track pack: %d failed" % failed)
	quit(1 if failed > 0 else 0)
