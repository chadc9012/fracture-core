extends SceneTree
## The super (scripts/combat/super_ability.gd): charge from time, kills and headshots; each frame's super does its job.
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Super := preload("res://scripts/combat/super_ability.gd")
var fails := 0

func ok(c: bool, what: String) -> void:
	if not c:
		fails += 1
	print(("ok   " if c else "FAIL ") + what)

class Dummy extends Node3D:
	var rig = null
	var ground_at := func(_x, _z): return 0.0

func _target(g, at: Vector3, hp: float):
	var t = Gunplay.Target.new(AABB(at + Vector3(-0.4, 0, -0.4), Vector3(0.8, 1.8, 0.8)), hp, null)
	g.targets.append(t)
	return t

func _init() -> void:
	var player := Dummy.new()
	get_root().add_child(player)
	var g: Node3D = Gunplay.new()
	get_root().add_child(g)
	g.setup(player, [] as Array[AABB])
	var s: Node3D = g.super_ability
	ok(s != null, "gunplay carries a super")
	ok(not s.full(), "it starts empty")
	s.step(10.0, null, false)
	ok(absf(s.charge - 10.0 * Super.CHARGE.time) < 0.001, "it charges with time")
	var t0 = _target(g, Vector3(0, 0, -3), 10.0)
	g.grenade_hit(t0, 100.0, Vector3.ZERO)
	ok(s.charge > 10.0 * Super.CHARGE.time + 0.08, "a kill charges it")
	s.step(0.1, null, true)
	ok(not t0.alive() and s.charge > 0.0, "it won't fire before it's full")
	# Titan: the slam hurts what is near and spares what is far
	s.frame = "goliath"
	s.charge = 1.0
	var near = _target(g, Vector3(3, 0, 0), 500.0)
	var far = _target(g, Vector3(30, 0, 0), 500.0)
	s.cast(null)
	ok(not near.alive(), "FRACTURE SLAM drops what stands within its radius")
	ok(far.alive(), "and spares what stands outside it")
	ok(s.charge == 0.0, "casting empties the meter")
	# Hunter: the next three shots are ×6, then back to ×1
	s.frame = "nyx"
	s.charge = 1.0
	s.cast(null)
	var m := [s.shot_mult(), s.shot_mult(), s.shot_mult(), s.shot_mult()]
	ok(m == [6.0, 6.0, 6.0, 1.0], "GOLDEN GUN empowers three shots (%s)" % str(m))
	s.charge = 1.0
	s.cast(null)
	s.step(11.0, null, false)
	ok(s.shot_mult() == 1.0, "unused shots lapse after the window")
	# Warlock: the nova bursts ahead, along the camera
	s.frame = "cipher"
	s.charge = 1.0
	var cam := Camera3D.new()
	get_root().add_child(cam)
	cam.look_at_from_position(Vector3(0, 1.6, 0), Vector3(0, 1.6, -10))
	var ahead = _target(g, Vector3(0, 0, -21), 500.0)
	var behind = _target(g, Vector3(0, 0, 21), 500.0)
	s.cast(cam)
	ok(not ahead.alive(), "NOVA BOMB lands ahead along the crosshair")
	ok(behind.alive(), "and not behind")
	# kill callouts: two kills in a row make a streak
	var c := Control.new()
	c.set_script(load("res://scripts/player/touch_controls.gd"))
	c.scripted = true
	get_root().add_child(c)
	g.controls = c
	g._streak_t = 0.0
	var k1 = _target(g, Vector3(0, 0, -2), 1.0)
	var k2 = _target(g, Vector3(0, 0, -2), 1.0)
	g.grenade_hit(k1, 10.0, Vector3.ZERO)
	g.grenade_hit(k2, 10.0, Vector3.ZERO)
	ok(g._streak == 2 and c._medal != null, "two quick kills call out a DOUBLE KILL")
	print("super test: %s" % ("true" if fails == 0 else "false (%d failed)" % fails))
	quit(0 if fails == 0 else 1)
