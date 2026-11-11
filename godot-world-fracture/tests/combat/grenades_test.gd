extends SceneTree
## grenades.gd headless: the pure rules match the web build (grenades.ts); each frame's three grenades do their thing to
## real enemies.gd bots — Breacher kills and throws back, Concussion stuns, Thermite burns, Shroud blinds, Tripmine waits
## and goes off, Tracer marks for +33%, Singularity pulls in, Arc Chain jumps, Rift Well heals the operator — the
## operator's own team is never touched, and the J key / GRENADE press reaches gunplay through touch_controls.
const Player = preload("res://scripts/player/operator_player.gd")
const Gunplay = preload("res://scripts/combat/gunplay.gd")
const Enemies = preload("res://scripts/combat/enemies.gd")
const Grenades = preload("res://scripts/combat/grenades.gd")
const Controls = preload("res://scripts/player/touch_controls.gd")

var ok := true
var p: Node3D
var g: Node3D
var en: Node3D
var gr: Node3D

func check(label: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + label)
	ok = ok and cond

func _init() -> void:
	# ---- pure rules ----
	var bre: Dictionary = Grenades.GRENADES.breacher
	check("blast: full at the centre, half at the edge, none past it", is_equal_approx(Grenades.blast_damage(bre, 0.0), 6.0) and Grenades.blast_damage(bre, 6.0) == 0.0 and absf(Grenades.blast_damage(bre, 3.0) - 4.5) < 1e-4)
	check("zone radius: burn / pull use reach, the rest radius", Grenades.zone_radius(Grenades.GRENADES.thermite) == 4.5 and Grenades.zone_radius(Grenades.GRENADES.singularity) == 8.0 and Grenades.zone_radius(Grenades.GRENADES.shroud) == 6.5)
	var all := []
	for f in ["goliath", "nyx", "cipher"]:
		for k in Grenades.kinds_for(f):
			all.append(k)
			check("%s belongs to %s" % [k, f], Grenades.GRENADES[k].frame == f)
	check("nine grenades, three per frame, none shared", all.size() == 9 and Grenades.GRENADES.size() == 9)
	check("cycle wraps", Grenades.next_kind("nyx", "tracer") == "shroud" and Grenades.next_kind("cipher", "singularity") == "arc-chain")
	var pouch := Grenades.new_pouch("breacher")
	pouch.charges = 1
	var sw := Grenades.switch_pouch(pouch, "singularity")
	check("switching keeps the fill as a fraction (1/2 of 2 → 0 of 1)", sw.kind == "singularity" and sw.charges == 0)
	for i in 14 * 10 + 1:
		Grenades.step_pouch(pouch, 0.1)
	check("a charge comes back after the cooldown", pouch.charges == 2)

	# ---- the scene ----
	p = Player.new()
	root.add_child(p)
	p.bounds = Rect2(-60, -60, 120, 120)
	p.ground_at = func(_x: float, _z: float) -> float: return 0.0
	g = Gunplay.new()
	root.add_child(g)
	g.setup(p, p.obstacles)
	gr = g.grenades
	gr.persist = false
	en = Enemies.new()
	root.add_child(en)
	en.setup(p, g)
	en.respawn_enabled = false
	check("enemies.gd hands gunplay its roster (for the Rift Well)", g.roster == en)

	# GOLIATH
	gr.set_frame("goliath")
	var scout = en.spawn("scout", Vector3(10, 0, 0))
	var elite = en.spawn("elite", Vector3(13.5, 0, 0))
	_drop("breacher", Vector3(10, 0, 0))
	check("Breacher kills a scout at the centre", not scout.target.alive())
	check("and throws the elite back and hurts it", elite.target.hp < elite.target.max_hp or elite.target.shield < elite.target.shield_max)
	check("knocked away from the blast", elite.mover.position.x > 13.6)
	var e2 = en.spawn("elite", Vector3(-10, 0, 0))
	_drop("concussion", Vector3(-12, 0, 0))
	check("Concussion stuns", e2.target.stun > 1.5)
	e2.target.shield = 0.0
	var hp0: float = e2.target.hp
	_drop("thermite", Vector3(-10, 0, 0))
	var hp1: float = e2.target.hp
	_run(3.0)
	check("Thermite hits, then the pool keeps burning", hp1 < hp0 and e2.target.hp < hp1 - 30.0)
	_run(4.0)
	check("the pool burns out", gr.live.is_empty())

	# NYX
	gr.set_frame("nyx")
	check("NYX's first grenade is Shroud", gr.pouch.kind == "shroud")
	_drop("shroud", p.position + Vector3(0, 0, 1))
	check("Shroud: the operator stands in smoke", gr.in_smoke(p.position))
	var watcher = en.spawn("scout", Vector3(0, 0, -20))
	for i in 60 * 2:
		en.step(1.0 / 60.0)
		gr.step(1.0 / 60.0, null)
	check("a scout 20 m off can't see the operator in it", watcher.state == Enemies.State.PATROL)
	_run(8.0)
	check("the smoke clears", not gr.in_smoke(p.position))
	watcher.target.hp = 0.0
	en.step(0.016)
	gr.pouch = Grenades.new_pouch("tripmine")
	gr.throw_along(Vector3(20, 1.5, 20), Vector3(0, -1, 0))
	_run(1.5)
	var mine: Dictionary = gr.live[0]
	check("Tripmine sticks where it lands and arms", mine.rest and mine.armed)
	var walker = en.spawn("scout", Vector3(26, 0, 20))
	_run(1.0)
	check("and waits while nothing is close", gr.live.size() == 1 and walker.target.hp == walker.target.max_hp)
	walker.mover.position = Vector3(21.5, 0, 20)
	walker.target.box = en._box(walker)
	_run(0.1)
	check("then goes off when a bot comes within reach", gr.live.is_empty() and not walker.target.alive())
	var marked = en.spawn("elite", Vector3(-20, 0, 20))
	marked.target.shield = 0.0
	_drop("tracer", Vector3(-20, 0, 20))
	check("Tracer marks what it catches", marked.target.mark > 5.0)
	var before: float = marked.target.hp
	g.grenade_hit(marked.target, 10.0, Vector3.ZERO)
	check("a marked bot takes a third more", absf(before - marked.target.hp - 13.3) < 0.01)
	_run(6.5)
	check("the mark wears off", marked.target.mark == 0.0)

	# CIPHER
	gr.set_frame("cipher")
	var a = en.spawn("scout", Vector3(-30, 0, -26))
	var b = en.spawn("scout", Vector3(-24, 0, -30))
	var a0: float = a.mover.position.distance_to(Vector3(-30, 0, -30))
	_drop("singularity", Vector3(-30, 0, -30), 1.4)
	check("Singularity drags bots in", a.mover.position.distance_to(Vector3(-30, 0, -30)) < a0 - 2.0)
	_run(1.0)
	check("then collapses on them", a.target.hp < a.target.max_hp and b.target.hp < b.target.max_hp)
	var chain := []
	for i in 5:
		chain.append(en.spawn("elite", Vector3(30 + i * 6.0, 0, -30)))
	_drop("arc-chain", Vector3(30, 0, -30))
	var stunned := chain.filter(func(e): return e.target.stun > 0.0).size()
	check("Arc Chain stuns the first and arcs on to three more (4 of 5)", stunned == 4)
	var ally = en.spawn("elite", Vector3(40, 0, 40), [], en.operator_team)
	var foe = en.spawn("elite", Vector3(41, 0, 40), [], 0)
	_drop("breacher", Vector3(40, 0, 40))
	check("the operator's own team is never touched", ally.target.hp == ally.target.max_hp and ally.target.shield == ally.target.shield_max and foe.target.shield < foe.target.shield_max)
	en.hull = 40.0
	en.since_hit = 0.0
	var slow = en.spawn("scout", Vector3(1, 0, 1))
	slow.cool = 0.0
	_drop("rift-well", p.position)
	_run(2.0)
	check("Rift Well heals the operator standing in it", en.hull > 55.0)
	check("and slows the bots in it", slow.cool > 0.5)
	_run(7.0)

	# the input: J (scripted press) reaches gunplay through the controls group and spends a charge
	var c := Controls.new()
	c.scripted = true
	root.add_child(c)
	c._ready()
	g.controls = c
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.position = Vector3(0, 1.6, 4)
	cam.look_at(Vector3(0, 1.0, -6))
	gr.pouch = Grenades.new_pouch("arc-chain")
	c._grenade = true
	g.step(1.0 / 60.0, cam, false, false, 0.0)
	check("GRENADE / J throws from gunplay and spends a charge", gr.live.size() == 1 and gr.pouch.charges == 1)
	c._cycle_grenade = true
	g.step(1.0 / 60.0, cam, false, false, 0.0)
	check("⟳ / K cycles to the next of the frame's own", gr.pouch.kind == "rift-well")
	check("the HUD line reads the grenade", c.grenade_label != null and c.grenade_label.text.begins_with("RIFT WELL"))
	print("Grenades test: ", ok)
	quit(0 if ok else 1)

## a grenade of `kind` dropped onto `at` and run until it goes off (`extra` more seconds after)
func _drop(kind: String, at: Vector3, extra := 0.0) -> void:
	gr.pouch = Grenades.new_pouch(kind)
	gr.throw_along(at + Vector3(0, 0.6, 0), Vector3(0, -1, 0))
	var g0: Dictionary = gr.live[gr.live.size() - 1]
	# a straight drop barely rolls: take the throw's sideways speed out so it lands on the spot
	g0.vel = Vector3(0, -1, 0)
	_run(float(Grenades.GRENADES[kind].fuse) + 0.05 + extra)

func _run(s: float) -> void:
	for i in int(s * 60.0):
		gr.step(1.0 / 60.0, null)
		_tick_targets(1.0 / 60.0)

func _tick_targets(dt: float) -> void:
	for t in g.targets:
		t.stun = maxf(0.0, t.stun - dt)
		t.mark = maxf(0.0, t.mark - dt)
