extends SceneTree
## hollow_star.gd headless: the gate's pylons and waves, the boss's phase gates, the conduit shield, the overload wipe,
## the final clock, shared lives.
const HollowStar = preload("res://scripts/raid/hollow_star.gd")

func _init() -> void:
	var ok := true
	var r := HollowStar.new()
	# the gate: a held pylon fills in ~22 s, an enemy in the ring drains it
	for i in 30:
		r.tick_pylon(0, 1.0, true, false)
	r.tick_pylon(1, 10.0, true, false)
	r.tick_pylon(1, 3.0, true, true)
	var r1: bool = r.pylons[0] >= 1.0 and r.pylons[1] > 0.3 and r.pylons[1] < 10.0 / 22.0 and r.pylons_online() == 1
	print("pylons charge and drain: ", r1, " ", r.pylons)
	ok = ok and r1
	var waves := 0
	while not r.next_wave().is_empty():
		waves += 1
	for i in 3:
		r.tick_pylon(i, 30.0, true, false)
	var r2: bool = waves == 6 and not r.gate_check(2) and r.gate_check(0) and r.cleared
	print("six waves, then the gate holds: ", r2)
	ok = ok and r2
	# the boss: phase gates hold the hp at each threshold until the phase begins
	r.begin("hollow-star-boss")
	r.hit_boss(50.0)
	var r3: bool = r.phase == 1 and r.shielded and is_equal_approx(r.boss_hp, 70.0) and r.hit_boss(10.0) == 0.0
	print("phase II at 70 with the shield up: ", r3, " hp ", r.boss_hp, " phase ", r.phase)
	ok = ok and r3
	for i in 3:
		r.tick_conduit(i, 6.0, true)
	r.tick(0.1)
	r.hit_boss(100.0)
	var r4: bool = not r.shielded and r.phase == 2 and is_equal_approx(r.boss_hp, 40.0)
	print("conduits drop the shield, phase III at 40: ", r4)
	ok = ok and r4
	r.hit_boss(100.0)
	var dealt := r.hit_boss(2.0)
	var r5: bool = r.phase == 3 and dealt == 4.0 and is_equal_approx(r.boss_hp, 11.0)
	print("phase IV exposes the core (double damage): ", r5, " hp ", r.boss_hp)
	ok = ok and r5
	r.hit_boss(20.0)
	var r6: bool = r.cleared and r.boss_hp <= 0.0
	print("Astravore falls: ", r6)
	ok = ok and r6
	# the overload: phase II left alone wipes the fireteam back to a fresh encounter
	var w := HollowStar.new("hollow-star-boss")
	w.hit_boss(35.0)
	var res := ""
	for i in 100:
		res = w.tick(1.0)
		if res != "":
			break
	var r7: bool = res == "wipe" and w.wipes == 1 and w.phase == 0 and w.boss_hp == 100.0 and w.lives == HollowStar.LIVES
	print("the overload wipes: ", r7)
	ok = ok and r7
	# the final clock
	var c := HollowStar.new("hollow-star-boss")
	c.boss_hp = 16.0
	c.phase = 2
	c.hit_boss(5.0)
	var res2 := ""
	for i in 100:
		res2 = c.tick(1.0)
		if res2 != "":
			break
	var r8: bool = res2 == "wipe" and c.wipes == 1
	print("the final clock wipes: ", r8)
	ok = ok and r8
	# shared lives
	var l := HollowStar.new()
	var wiped := false
	for i in HollowStar.LIVES:
		wiped = l.lose_life()
	var r9: bool = wiped and l.wipes == 1 and l.lives == HollowStar.LIVES
	print("eight lives, then the wipe: ", r9)
	ok = ok and r9
	var r10: bool = HollowStar.reward(true).item == "Hollow Star Lens" and HollowStar.reward(false).item == ""
	print("first-clear reward: ", r10)
	ok = ok and r10
	print("Hollow Star test: ", ok)
	quit(0 if ok else 1)
