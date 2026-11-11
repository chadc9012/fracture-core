extends SceneTree
## Combat details (asset catalog §5, Nov 10), played on the armed Nexus street, headless:
##   energy shields — the operator's absorbs a hit before the hull and recharges; an elite trooper's takes bolts first and
##     the fusion frame strips it faster (Target.take)
##   destructible cover — a crate on the walk is a solid box until bolts break it: the box leaves the obstacle list, the
##     crate hides, debris flies, `cover_broken` fires and no kill is counted
##   magazines — a reload drops the spent one; holsters — the carried sidearm rides the thigh while the rifle is in hand;
##   attachments — the rifle carries its laser; armour damage — a battered operator's plating takes the scorch overlay
##   godot --headless --path godot-world-fracture --script res://tests/combat/combat_details_test.gd
## Prints "combat details: N failed".

const Gunplay := preload("res://scripts/combat/gunplay.gd")
var failed := 0

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func frames(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	load("res://scripts/city/street_slice.gd").force_armed = true
	_run.call_deferred()

func _run() -> void:
	# the shield rule on its own
	var t := Gunplay.Target.new(AABB(Vector3.ZERO, Vector3.ONE), 60.0)
	t.shield_max = 30.0
	t.shield = 30.0
	var r1: Dictionary = t.take(20.0)
	ok(is_equal_approx(t.shield, 10.0) and is_equal_approx(t.hp, 60.0) and not bool(r1.broke), "a shield takes the bolt before the hull")
	var r2: Dictionary = t.take(20.0, true)
	ok(t.shield <= 0.0 and bool(r2.broke) and absf(t.hp - (60.0 - (20.0 - 10.0 / 1.5))) < 0.01, "an energy bolt strips it ×1.5 and the rest lands on the hull (hp %.2f)" % t.hp)

	var main: Node = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await frames(20)
	if main.creator:
		main._close_creator()
	main._open_street(true, "nexus", true)
	await frames(10)
	var st = main.street
	ok(st != null and st.armed, "the street opens armed (force_armed)")
	if st == null:
		_done()
		return
	st.controls.scripted = true
	var gp = st.gunplay
	var en = st.enemies

	# the operator's shield, then the hull, then the recharge
	en.shield = en.shield_max
	en.hull = en.hull_max
	en._hit_operator(25.0)
	ok(is_equal_approx(en.shield, en.shield_max - 25.0) and is_equal_approx(en.hull, en.hull_max), "the operator's shield takes the first hit (shield %.0f)" % en.shield)
	en._hit_operator(25.0)
	ok(en.shield <= 0.0 and is_equal_approx(en.hull, en.hull_max - 10.0), "what gets past it lands on the hull (hull %.0f)" % en.hull)
	en.since_hit = 4.0
	en.step(0.5)
	ok(en.shield > 0.0, "it recharges once the hits stop")
	ok(st.controls._shield_fill != null, "the HUD shows a shield bar")

	# an elite trooper carries a shield
	var elite_shielded := false
	for e in en.enemies:
		if e.type == "elite":
			elite_shielded = e.target.shield_max > 0.0
	ok(elite_shielded, "the elite trooper has a shield")

	# armour damage: the plating scorches as the hull drops
	en.hull = en.hull_max * 0.2
	en.step(0.016)
	var scorched := false
	for mi in st.operator.rig.body_root.find_children("*", "MeshInstance3D", true, false):
		if (mi as MeshInstance3D).material_overlay != null:
			scorched = true
	ok(scorched, "a battered operator's armour takes the scorch overlay")
	en.hull = en.hull_max
	en.step(0.016)

	# destructible cover: walk up to a crate and shoot it until it breaks
	var crate: Gunplay.Target = null
	for tg in gp.targets:
		if tg.has_meta("cover") and tg.max_hp < 100.0:
			crate = tg
			break
	ok(crate != null, "crates stand on the walks as cover")
	if crate:
		var idx := int(crate.get_meta("cover"))
		ok(st.operator.obstacles[idx] == crate.box, "the crate is a solid box")
		var broken := [false]
		gp.cover_broken.connect(func(_c): broken[0] = true)
		var kills_before: int = gp.kills
		var debris_before: int = gp._debris_n
		var c := crate.box.get_center()
		st.operator.position = Vector3(c.x, 0.18, c.z + 7.0)
		st.operator.velocity = Vector3.ZERO
		for i in 120:
			st.operator.recoil = 0.0     # a player pulls down against the kick
			gp.aim_at(crate, st.cam)
			gp.step(0.05, st.cam, true, false, 0.0)
			await process_frame
			if not crate.alive():
				break
		ok(not crate.alive() and broken[0], "bolts break it (%d shots)" % gp.shots_fired)
		ok(st.operator.obstacles[idx] != crate.box and not crate.node.visible, "the box leaves the world and the crate is gone")
		ok(gp._debris_n > debris_before or gp._debris_n == gp.DEBRIS_MAX, "it falls into debris")
		ok(gp.kills == kills_before, "breaking cover is not a kill")

	# a reload drops the spent magazine
	var mags: int = gp._mags
	gp.gun().mag = 0
	gp.step(0.016, st.cam, true, false, 0.0)
	ok(gp._mags == mags + 1 or gp._mags == gp.MAGS_MAX, "a reload drops the spent magazine")

	# holsters and attachments
	gp.set_loadout([{ "frame": "AUTO", "name": "Rifle", "mult": 1.0 }, { "frame": "SIDEARM", "name": "Hand Cannon", "mult": 1.0 }])
	await frames(2)
	ok(String(gp._slung.get("SIDEARM", "")) == "thigh" and gp._models["SIDEARM"].visible, "the carried sidearm rides the thigh holster")
	ok(gp._models["AUTO"].has_meta("laser"), "the rifle carries a laser module")
	gp.next_weapon()
	await frames(2)
	ok(String(gp._slung.get("AUTO", "")) == "back", "swapping slings the rifle across the back")
	# where they sit: the slung rifle behind the spine, not through the chest; the holstered sidearm at the right hip
	gp.next_weapon()
	await frames(2)
	gp.next_weapon()
	await frames(2)
	var sk: Skeleton3D = st.operator.rig.skeleton
	var fwd: Vector3 = st.operator.rig.global_transform.basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var spine: Vector3 = sk.global_transform * sk.get_bone_global_pose(gp._spine_bone).origin
	var rifle_at: Vector3 = gp._models["AUTO"].global_position
	ok((rifle_at - spine).dot(fwd) < -0.05 and rifle_at.distance_to(spine) < 0.8, "the slung rifle rides the back (%.2f m behind the spine)" % -(rifle_at - spine).dot(fwd))
	gp.next_weapon()
	await frames(2)
	var hip: Vector3 = sk.global_transform * sk.get_bone_global_pose(gp._thigh_bone).origin
	var pistol_at: Vector3 = gp._models["SIDEARM"].global_position
	ok(pistol_at.distance_to(hip) < 0.5 and (pistol_at - hip).dot(fwd.cross(Vector3.UP)) > 0.05, "the holstered sidearm sits at the right hip")
	_done()

func _done() -> void:
	print("combat details: %d failed" % failed)
	quit(1 if failed > 0 else 0)
