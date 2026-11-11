extends SceneTree
## track.gd + race.gd headless: a closed lap, progress round it, laps counted only forwards past the line, positions and prize.
const Track = preload("res://scripts/racing/track.gd")
const Race = preload("res://scripts/racing/race.gd")

func _init() -> void:
	var t := Track.new("nexus-speedway")
	var ok := true
	var r1: bool = t.length > 1500.0 and t.length < 3500.0 and t.at(0.0).distance_to(t.at(t.length)) < 0.5 and t.progress(t.at(10.0)) > 0.0 and t.progress(t.at(10.0)) < 0.05
	print("a closed lap with progress: ", r1, " length ", t.length)
	ok = ok and r1
	var r2: bool = not t.off_track(t.at(100.0)) and t.off_track(t.at(100.0) + Vector3(20, 0, 0)) and t.curvature_ahead(t.at(5.0), 20.0) < 0.3
	print("grass and the straight: ", r2)
	ok = ok and r2
	var race := Race.new(t, 2)
	var me := race.add("You", true)
	var rival := race.add("Rival")
	race.start()
	# both drive round; the rival is faster, so it finishes first. Positions follow.
	var d_me := -8.0
	var d_r := -8.0
	var steps := 0
	while not race.finished and steps < 20000:
		d_me += 20.0 / 60.0
		d_r += 26.0 / 60.0
		race.tick(1.0 / 60.0, [t.at(d_me), t.at(d_r)])
		steps += 1
	var r3: bool = race.finished and me.laps == 2 and rival.laps == 2 and race.position_of(rival) == 1 and race.position_of(me) == 2 and race.prize() == int(t.def.prize[1])
	print("laps, finish order and prize: ", r3, " me ", me.laps, " rival ", rival.laps, " place ", race.position_of(me), " prize ", race.prize())
	ok = ok and r3
	var r4: bool = me.best_lap > 20.0 and absf(me.best_lap - t.length / 20.0) < 1.0
	print("lap times: ", r4, " ", me.best_lap)
	ok = ok and r4
	# reversing over the line never counts
	var race2 := Race.new(t, 3)
	var e := race2.add("Back", true)
	race2.start()
	var d := 2.0
	for i in 600:
		d -= 10.0 / 60.0
		race2.tick(1.0 / 60.0, [t.at(d)])
	var r5: bool = e.laps == 0
	print("no laps backwards: ", r5)
	ok = ok and r5
	var g0 := t.grid(0)
	var g1 := t.grid(1)
	var r6: bool = g0.origin.distance_to(g1.origin) > 5.0 and t.progress(g0.origin) > 0.9
	print("grid behind the line: ", r6)
	ok = ok and r6
	print("Race test: ", ok)
	quit(0 if ok else 1)
