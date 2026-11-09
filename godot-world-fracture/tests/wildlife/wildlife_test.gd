extends SceneTree
## Wildlife rules (scripts/wildlife/wildlife.gd): a herd grazes, freezes and bolts together; a wolf pack hunts a deer down;
## nocturnal animals rest by day; the raptor circles its range; fish flee a swimmer and the shark catches fish; the
## bank-dwelling crocodile is the one land animal that enters water. Run: godot --headless --path . --script res://tests/wildlife/wildlife_test.gd

const Wildlife := preload("res://scripts/wildlife/wildlife.gd")

func _init() -> void:
	var ok := true
	var dry := func(_x: float, _z: float) -> bool: return false
	var far := { "pos": Vector2(1e5, 1e5), "speed": 0.0, "sprinting": false }
	# a deer herd left alone grazes and wanders inside its home radius
	var w := Wildlife.new(3)
	var herd: Array = w.spawn_group("DEER", Vector2(0, 0), 5)
	var states := {}
	var max_d := 0.0
	for i in 1800:
		w.step_all(1.0 / 30.0, far, false, dry)
		for c in herd:
			states[c.state] = true
			max_d = maxf(max_d, c.pos.distance_to(c.home))
	var r1: bool = states.has(Wildlife.St.GRAZE) and states.has(Wildlife.St.WANDER) and max_d < 26.0 * 1.2 and w.alive("DEER") == 5
	print("a herd grazes and wanders near home: ", r1, " furthest ", max_d)
	ok = ok and r1
	# a sprinting operator 15 m away: the whole herd bolts (shared alarm), away from the threat
	var threat := { "pos": herd[0].pos + Vector2(15, 0), "speed": 7.0, "sprinting": true }
	var before: Array = herd.map(func(c): return c.pos)
	for i in 60:
		w.step_all(1.0 / 30.0, threat, false, dry)
	var fled := 0
	for i in herd.size():
		var c = herd[i]
		if c.state == Wildlife.St.FLEE and c.pos.distance_to(threat.pos) > (before[i] as Vector2).distance_to(threat.pos):
			fled += 1
	var r2: bool = fled == 5
	print("the herd bolts together away from a sprinting operator: ", r2, " fled ", fled)
	ok = ok and r2
	# a wolf pack at night hunts a lone deer down; by day the wolves rest at home
	var w2 := Wildlife.new(5)
	var deer: Wildlife.Critter = w2.spawn("DEER", Vector2(0, 0))
	var pack: Array = w2.spawn_group("WOLF", Vector2(25, 0), 3, 3.0)
	var hunted := false
	for i in 3000:
		w2.step_all(1.0 / 30.0, far, true, dry)
		for wolf in pack:
			if wolf.state == Wildlife.St.STALK or wolf.state == Wildlife.St.CHASE:
				hunted = true
		if deer.down >= 0.0:
			break
	var r3: bool = hunted and deer.down >= 0.0 and w2.catches >= 1
	print("a wolf pack stalks and catches a deer at night: ", r3, " catches ", w2.catches)
	ok = ok and r3
	var w3 := Wildlife.new(5)
	var wolf_day: Wildlife.Critter = w3.spawn("WOLF", Vector2(0, 0))
	var resting := false
	for i in 1500:
		w3.step_all(1.0 / 30.0, far, false, dry)
		if wolf_day.state == Wildlife.St.REST:
			resting = true
	var r4: bool = resting and wolf_day.pos.distance_to(wolf_day.home) < 6.0
	print("a wolf rests at home by day (nocturnal): ", r4)
	ok = ok and r4
	# a raptor circles its range at altitude
	var w4 := Wildlife.new(9)
	var hawk: Wildlife.Critter = w4.spawn("RAPTOR", Vector2(0, 0))
	var min_r := INF
	var max_r := 0.0
	for i in 1800:
		w4.step_all(1.0 / 30.0, far, false, dry)
		if i > 600:
			var r := hawk.pos.distance_to(hawk.home)
			min_r = minf(min_r, r)
			max_r = maxf(max_r, r)
	var r5: bool = hawk.alt > 20.0 and min_r > 30.0 and max_r < 90.0
	print("the raptor soars in a circle over its range: ", r5, " r ", min_r, "..", max_r, " alt ", hawk.alt)
	ok = ok and r5
	# fish dart from a swimmer; a shark in the same lake catches fish
	var w5 := Wildlife.new(11)
	var school: Array = w5.spawn_group("FISH", Vector2(0, 0), 6, 2.0)
	var shark: Wildlife.Critter = w5.spawn("SHARK", Vector2(8, 0))
	for i in 1500:
		w5.step_all(1.0 / 30.0, far, false, dry)
		if w5.catches > 0:
			break
	var r6: bool = w5.catches >= 1 and w5.catches <= 3 and shark.alt < 0.0   # one catch, then it feeds a while
	var w5b := Wildlife.new(11)
	var school2: Array = w5b.spawn_group("FISH", Vector2(0, 0), 6, 2.0)
	var swimmer := { "pos": school2[0].pos + Vector2(3, 0), "speed": 2.0, "sprinting": false }
	var d0: float = school2[0].pos.distance_to(swimmer.pos)
	for i in 30:
		w5b.step_all(1.0 / 30.0, swimmer, false, dry)
	r6 = r6 and school2[0].pos.distance_to(swimmer.pos) > d0
	print("the shark catches a fish; fish dart from a swimmer: ", r6)
	ok = ok and r6
	# the crocodile enters the river that stops a deer
	var wet := func(x: float, _z: float) -> bool: return x > 5.0
	var w6 := Wildlife.new(13)
	var croc: Wildlife.Critter = w6.spawn("CROCODILE", Vector2(4, 0))
	var deer2: Wildlife.Critter = w6.spawn("DEER", Vector2(4, 30))
	var croc_wet := false
	var deer_wet := false
	for i in 4000:
		w6.step_all(1.0 / 30.0, far, false, wet)
		croc_wet = croc_wet or croc.pos.x > 5.2
		deer_wet = deer_wet or deer2.pos.x > 5.2
	var r7: bool = croc_wet and not deer_wet
	print("the crocodile takes to the water, the deer never does: ", r7)
	ok = ok and r7
	print("Wildlife test: ", ok)
	quit(0 if ok else 1)
