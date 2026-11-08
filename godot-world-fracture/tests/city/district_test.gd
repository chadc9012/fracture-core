extends SceneTree
## District streaming rules (scripts/city/district.gd): the start state, the rings, hysteresis at a tile edge, and the
## traffic extents. Run: godot --headless --path . --script res://tests/city/district_test.gd

const District := preload("res://scripts/city/district.gd")

func _init() -> void:
	var ok := true
	var d := District.new(-3, 3)
	var first := d.update(0.0, true)
	var r1: bool = d.state(0) == District.State.ACTIVE and d.state(1) == District.State.ACTIVE and d.state(-1) == District.State.ACTIVE \
		and d.state(2) == District.State.SIMULATED and d.state(-2) == District.State.SIMULATED and d.state(3) == District.State.FROZEN \
		and first.size() == 5
	print("start: 3 active round tile 0, 2 simulated, the rest frozen: ", r1, " ", d.counts())
	ok = ok and r1
	# standing on the edge of tile 0 / 1 (z = 130) changes nothing; 10 m past it still nothing; 20 m past it crosses
	var c2 := d.update(130.0)
	var c3 := d.update(140.0)
	var r2: bool = c2.is_empty() and c3.is_empty() and d.focus_k == 0
	print("the edge and 10 m past it hold the focus (hysteresis): ", r2)
	ok = ok and r2
	var c4 := d.update(150.0)
	var r3: bool = d.focus_k == 1 and c4.get(2) == District.State.ACTIVE and c4.get(-1) == District.State.SIMULATED \
		and c4.get(3) == District.State.SIMULATED and c4.get(-2) == District.State.FROZEN and c4.size() == 4
	print("20 m past the edge: tile 2 activates, -1 simulates, 3 simulates, -2 freezes: ", r3, " ", c4)
	ok = ok and r3
	# coming back: 120 m is inside tile 0 but within the hysteresis band, 110 m crosses back
	var c5 := d.update(120.0)
	var c6 := d.update(110.0)
	var r4: bool = c5.is_empty() and d.focus_k == 1 or false
	r4 = c5.is_empty() and c6.size() == 4 and d.focus_k == 0
	print("back across with hysteresis: ", r4)
	ok = ok and r4
	# the extents: active span is three tiles, simulated span five; the whole street is seven
	var act := d.extent(District.State.ACTIVE)
	var sim := d.extent(District.State.SIMULATED)
	var r5: bool = absf(act.x + 390.0) < 1e-3 and absf(act.y - 390.0) < 1e-3 and absf(sim.x + 650.0) < 1e-3 and absf(sim.y - 650.0) < 1e-3 and absf(d.span().x + 910.0) < 1e-3
	print("extents: active ±390, simulated ±650, street ±910: ", r5, " ", act, " ", sim)
	ok = ok and r5
	# the far end: focus clamps to the last tile, nothing beyond exists
	d.update(2000.0)
	var r6: bool = d.focus_k == 3 and d.state(3) == District.State.ACTIVE and d.state(2) == District.State.ACTIVE and d.state(1) == District.State.SIMULATED and d.state(0) == District.State.FROZEN
	print("the end of the street clamps the focus: ", r6)
	ok = ok and r6
	print("District test: ", ok)
	quit(0 if ok else 1)
