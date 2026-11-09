extends SceneTree
## Boss rules (scripts/combat/boss.gd, the web's boss-phases / boss-poise): phases by hull, poise → stagger → ×2.25 window
## and the refractory, a phase change opens the weak point, the attack cycle telegraphs then fires, SUMMON calls adds,
## the six board bosses load with their hulls. Run: godot --headless --path . --script res://tests/combat/boss_test.gd

const Boss := preload("res://scripts/combat/boss.gd")

func _init() -> void:
	var ok := true
	# every board boss: a model that exists, hull scaled, attacks known
	var r1 := true
	for id in Boss.BOSSES:
		var b := Boss.new(id)
		r1 = r1 and ResourceLoader.exists("res://models/bosses/" + String(b.def.model)) and b.hull_max > 1000.0
		for a in b.def.attacks:
			r1 = r1 and Boss.ATTACKS.has(a)
	print("six bosses with models, hulls and known attacks: ", r1)
	ok = ok and r1
	# phases: 100 % → 0, 60 % → 1 (OVERDRIVEN, weak point opens), 25 % → 2
	var b := Boss.new("rift-hound")
	var r2: bool = b.phase == 0
	b.hull = b.hull_max * 0.61   # worn down; the next hit crosses 66 %
	b.hit(1.0)
	var ev := b.drain()
	r2 = r2 and b.phase == 1 and ev.any(func(e): return e.kind == "phase" and e.label == "OVERDRIVEN") and b.weak_point()
	var weak_dmg := b.hit(10.0)
	r2 = r2 and absf(weak_dmg - 16.0) < 1e-6
	print("phases by hull; the phase flare opens a ×1.6 weak point: ", r2, " dealt ", weak_dmg)
	ok = ok and r2
	# poise: 100 / 1.6 = 62.5 damage of sustained fire breaks it → 4 s stagger at ×2.25, then 6 s of no poise
	var c := Boss.new("colossus")
	var broke := false
	for i in 20:
		c.hit(4.0)
		c.tick(0.1, 30.0)
		if c.staggered():
			broke = true
			break
	var r3: bool = broke and c.step == Boss.Step.STAGGERED and c.move_speed() == 0.0
	var big := c.hit(10.0)
	r3 = r3 and absf(big - 22.5) < 1e-6
	for i in 45:
		c.tick(0.1, 30.0)
	r3 = r3 and not c.staggered() and c.step != Boss.Step.STAGGERED
	var p0 := c.poise
	c.hit(10.0)
	r3 = r3 and c.poise == p0   # refractory: nothing builds
	for i in 70:
		c.tick(0.1, 30.0)
	c.hit(10.0)
	r3 = r3 and c.poise > p0
	print("sustained fire staggers (×2.25 window), then a 6 s refractory: ", r3)
	ok = ok and r3
	# chip damage decays: 10 hits of 2 spread over 20 s never stagger
	var d := Boss.new("vyrak")
	for i in 10:
		d.hit(2.0)
		for k in 20:
			d.tick(0.1, 30.0)
	var r4: bool = not d.staggered() and d.poise < 10.0
	print("chip damage decays, no cheese stagger: ", r4, " poise ", d.poise)
	ok = ok and r4
	# the attack cycle: out of range it approaches; in range it telegraphs then fires the listed attack, then cools down
	var h := Boss.new("rift-hound")
	h.tick(0.1, 40.0)
	var r5: bool = h.step == Boss.Step.APPROACH and h.move_speed() > 8.0
	var fired := ""
	var tele := false
	for i in 60:
		h.tick(0.1, 3.0)
		for e in h.drain():
			if e.kind == "telegraph":
				tele = true
			if e.kind == "attack":
				fired = e.attack
	r5 = r5 and tele and fired == "LUNGE" and h.step == Boss.Step.COOLDOWN or h.step == Boss.Step.APPROACH
	r5 = r5 and fired == "LUNGE"
	print("approach → telegraph → LUNGE → cooldown: ", r5)
	ok = ok and r5
	# SUMMON brings the adds (count grows with the phase); OVERLOADED attacks hit ×1.6
	var a := Boss.new("astravore")
	var summ := 0
	for i in 40:
		a.tick(0.1, 50.0)
		for e in a.drain():
			if e.kind == "summon":
				summ = int(e.count)
	var r6: bool = summ == 2
	a.hull = a.hull_max * 0.26
	a.hit(1.0)
	a.drain()
	var dmg := 0.0
	for i in 400:
		a.tick(0.1, 10.0)
		for e in a.drain():
			if e.kind == "attack" and e.attack == "VOLLEY":
				dmg = float(e.damage)
	r6 = r6 and a.phase == 2 and absf(dmg - 9.0 * 1.6) < 1e-6
	print("SUMMON calls the brood; OVERLOADED volleys hit ×1.6: ", r6, " adds ", summ, " dmg ", dmg)
	ok = ok and r6
	# death
	var k := Boss.new("crystal-stalker")
	k.hit(k.hull_max)
	var r7: bool = k.dead and k.drain().any(func(e): return e.kind == "dead") and k.reward().nex == 800
	print("the kill pays the reward: ", r7)
	ok = ok and r7
	print("Boss test: ", ok)
	quit(0 if ok else 1)
