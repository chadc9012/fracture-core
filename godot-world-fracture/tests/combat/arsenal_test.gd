extends SceneTree
## The arsenal (owner, Nov 22: "weapons with distinct personalities rather than simply different damage numbers"):
##   pure (weapons.gd) — every category has its card (damage, range, fire rate, accuracy, stability, reload, magazine,
##     handling, element, perks); gear items map to the owner's categories; each frame kicks in its own learnable pattern
##     and stability tames it; tactical reloads are shorter than empty ones; a swap draws by handling; the bow draws and
##     looses; perks (rampage, subsistence, kill clip, outlaw, overcharge) do what they say; item perks are fixed per item
##     and exotics carry a signature
##   on the armed street — ADS zooms and slows; a rocket flies and its blast downs a trooper; THERMAL burns, CRYO freezes,
##     ARC jumps; the bow's arrow lands; the HUD layout editor moves a button and saves it; the controller reads.
##   godot --headless --path godot-world-fracture --script res://tests/combat/arsenal_test.gd
## Prints "arsenal: N failed".

const Weapons := preload("res://scripts/combat/weapons.gd")
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
	_pure()
	await _street()
	_done()

func _done() -> void:
	print("arsenal: %d failed" % failed)
	quit(1 if failed > 0 else 0)

# --------------------------------------------------------------------------------------------- the rules
func _pure() -> void:
	# every category the owner listed has a frame and a full card
	var want := ["Assault Rifle", "Submachine Gun", "Hand Cannon", "Pistol", "Shotgun", "Sniper Rifle", "Marksman Rifle", "Light Machine Gun", "Rocket Launcher", "Grenade Launcher", "Bow"]
	var have := {}
	var cards_ok := true
	for f in Weapons.ALL:
		var st := Weapons.stats(f, 1.0, "ARC", ["rampage"])
		have[st.category] = true
		for k in ["damage", "range", "fire_rate", "accuracy", "stability", "reload", "magazine", "handling", "element", "perks"]:
			cards_ok = cards_ok and st.has(k)
	var all_cats := true
	for c in want:
		all_cats = all_cats and have.has(c)
	ok(all_cats and cards_ok, "every category has a frame and a ten-stat card (%d frames)" % Weapons.ALL.size())
	var sn := Weapons.stats("SNIPER")
	var smg := Weapons.stats("SMG")
	ok(sn.damage > smg.damage and sn.range > smg.range and smg.fire_rate > sn.fire_rate and smg.handling > sn.handling, "a sniper hits harder and further, an SMG fires faster and handles quicker")
	# gear items → the owner's categories
	ok(Weapons.frame_for({ "cls": "bow", "frame": "SNIPER", "name": "Static Bow" }) == "BOW"
		and Weapons.frame_for({ "cls": "launcher", "frame": "HEAVY", "name": "Breach GL", "slot": "heavy" }) == "GL"
		and Weapons.frame_for({ "cls": "", "frame": "HEAVY", "name": "World Ender", "slot": "heavy" }) == "ROCKET"
		and Weapons.frame_for({ "cls": "pistol", "frame": "SIDEARM", "name": "Scrap-Slugger" }) == "SIDEARM"
		and Weapons.frame_for({ "cls": "pistol", "frame": "SIDEARM", "name": "Vector Pistol" }) == "PISTOL"
		and Weapons.frame_for({ "cls": "ar", "frame": "AUTO", "name": "Longshot Marksman" }) == "MARKSMAN"
		and Weapons.frame_for({ "cls": "ar", "frame": "AUTO", "name": "Vanguard MK-IV" }) == "AUTO", "gear items fire as their category (bow, GL, rocket, hand cannon, pistol, marksman, rifle)")
	# recoil: the same gun kicks the same way every string; a steadier gun kicks less; sights halve it; frames differ
	var a1 := Weapons.recoil_kick("AUTO", 4)
	var a2 := Weapons.recoil_kick("AUTO", 4)
	var smg_side := 0.0
	var lmg_side := 0.0
	for i in 12:
		smg_side += absf(Weapons.recoil_kick("SMG", i).x) / Weapons.recoil_kick("SMG", i).y
		lmg_side += absf(Weapons.recoil_kick("LMG", i).x) / Weapons.recoil_kick("LMG", i).y
	ok(a1 == a2 and Weapons.recoil_kick("AUTO", 4, true).y < a1.y * 0.6 and Weapons.recoil_kick("AUTO", 4, false, 40.0).y < a1.y and smg_side > lmg_side,
		"recoil is a learnable pattern: repeatable, halved down the sights, tamed by stability, the SMG snakes more than the LMG")
	# reloads: tactical shorter than empty; a swap mid-reload cancels it; drawing a gun waits on its handling
	var g := Weapons.Gun.new("AUTO")
	g.mag = 10
	g.reload()
	var tac: float = g.reloading
	g.cancel_reload()
	g.mag = 0
	g.reload()
	var empty: float = g.reloading
	ok(tac < empty and absf(empty - 1.6) < 1e-3 and absf(tac - 1.6 * 0.85) < 1e-3, "a tactical reload (%.2f s) is shorter than an empty one (%.2f s)" % [tac, empty])
	var lmg := Weapons.Gun.new("LMG")
	var pis := Weapons.Gun.new("PISTOL")
	lmg.draw(); pis.draw()
	var lmg_shots := 0
	var pis_shots := 0
	for i in 20:   # a third of a second
		lmg_shots += lmg.step(1.0 / 60.0, true)
		pis_shots += pis.step(1.0 / 60.0, true)
	ok(pis_shots >= 1 and lmg_shots == 0, "a pistol is out and firing while the LMG is still being drawn")
	# the bow: hold to draw, let go to loose; a short draw is weak, a full one full
	var bow := Weapons.Gun.new("BOW")
	var out := 0
	for i in 40:
		out += bow.step(1.0 / 60.0, true)
	out += bow.step(1.0 / 60.0, false)
	var full: float = bow.last_charge
	for i in 60:
		bow.step(1.0 / 60.0, false)
	for i in 10:
		out += bow.step(1.0 / 60.0, true)
	out += bow.step(1.0 / 60.0, false)
	ok(out == 2 and full >= 0.99 and bow.last_charge < 0.5 and bow.reserve == 38 and not bow.reload(), "the bow draws and looses: full draw %.2f, quick draw %.2f, two arrows spent" % [full, bow.last_charge])
	# perks
	var r := Weapons.Gun.new("AUTO")
	r.perks = ["rampage", "subsistence", "kill_clip"]
	r.mag = 10
	r.on_kill(false); r.on_kill(false)
	var ramp: float = r.damage_mult()
	ok(absf(ramp - 1.2) < 1e-4 and r.mag == 22, "Rampage ×1.2 after two kills; Subsistence put rounds back (mag %d)" % r.mag)
	r.reload()
	ok(absf(r.damage_mult() - 1.2 * 1.25) < 1e-4, "Kill Clip: a reload right after a kill hits +25%")
	for i in 285:
		r._tick(1.0 / 60.0)
	ok(absf(r.damage_mult() - 1.25) < 1e-4, "Rampage fades after 4.5 s, Kill Clip still on")
	var o := Weapons.Gun.new("SIDEARM")
	o.perks = ["outlaw"]
	o.mag = 0
	var slow: float = o.reload_mult()
	o.cancel_reload()
	o.on_kill(true)
	ok(o.reload_mult() < slow, "Outlaw: a precision kill speeds the next reload")
	var x := Weapons.Gun.new("AUTO")
	x.perks = ["overcharge"]
	var boosted := 0
	for i in 12:
		if x.on_hit(false) > 1.0:
			boosted += 1
	ok(boosted == 2, "Overcharge: every sixth hit lands ×3")
	var p1 := Weapons.item_perks("cat-void-rifle", "AUTO", "exotic")
	var p2 := Weapons.item_perks("cat-void-rifle", "AUTO", "exotic")
	var p3 := Weapons.item_perks("vanguard-mk4", "AUTO", "common")
	ok(p1 == p2 and p1.size() == 3 and Weapons.EXOTIC_PERKS.has(p1[0]) and p3.size() == 2 and not Weapons.EXOTIC_PERKS.has(p3[0]), "item perks are fixed per item; an exotic carries a signature perk (%s)" % ", ".join(p1))
	ok(Weapons.element_of("PLASMA").shield > Weapons.element_of("VOID").shield and Weapons.element_of("kinetic").unshielded > 1.0 and Weapons.element_of("THERMAL").has("burn"), "the elements: plasma strips shields hardest, kinetic hits bare hulls harder, thermal burns")

# --------------------------------------------------------------------------------------------- on the street
func _street() -> void:
	var main: Node = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await frames(20)
	if main.creator:
		main._close_creator()
	main._open_street(true, "nexus", true)
	await frames(10)
	var st = main.street
	if st == null:
		ok(false, "the street opens")
		return
	st.controls.scripted = true
	var gp = st.gunplay
	var op = st.operator
	var cam: Camera3D = st.cam
	gp.assist_deg = 0.0
	gp.set_loadout([
		{ "slot": "primary", "id": "t-rifle", "name": "Test Rifle", "frame": "AUTO", "mult": 1.0, "cls": "ar", "element": "THERMAL" },
		{ "slot": "secondary", "id": "t-bow", "name": "Test Bow", "frame": "SNIPER", "mult": 1.0, "cls": "bow", "element": "CRYO" },
		{ "slot": "heavy", "id": "t-rocket", "name": "World Ender", "frame": "HEAVY", "mult": 1.0, "cls": "", "element": "ARC" },
	])
	ok(gp.guns.size() == 3 and gp.guns[1].frame == "BOW" and gp.guns[2].frame == "ROCKET" and gp._models.has("BOW") and gp._models.has("ROCKET"), "the worn bow and rocket launcher load as their own frames and models")
	# ADS: the camera zooms and the body slows
	var fov0: float = cam.fov
	st.controls._ads_on = true
	for i in 30:
		gp.step(1.0 / 30.0, cam, false, false, 0.0)
		await process_frame
	ok(gp.ads >= 1.0 and cam.fov < fov0 * 0.85 and op.ads_blend >= 1.0, "ADS: the sights come up, the view zooms (%.0f° → %.0f°)" % [fov0, cam.fov])
	st.controls._ads_on = false
	for i in 30:
		gp.step(1.0 / 30.0, cam, false, false, 0.0)
		await process_frame
	ok(gp.ads <= 0.0 and absf(cam.fov - fov0) < 0.5, "and lowering them gives the view back")
	# a target in front: a dummy box the bolts can find
	var fwd := -cam.global_transform.basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var at: Vector3 = op.position + fwd * 4.0     # nearer than the street's own troopers, so no bolt goes to them
	var t: Gunplay.Target = gp.add_dummy(at, 500.0)
	await frames(2)
	gp.aim_at(t, cam)
	# THERMAL rifle: a hit burns on after it
	var before: float = t.hp
	for i in 8:
		gp.aim_at(t, cam)
		gp.step(1.0 / 30.0, cam, i < 4, false, 0.0)
		await process_frame
	var after_hit: float = t.hp
	for i in 30:
		gp.step(1.0 / 30.0, cam, false, false, 0.0)
		await process_frame
	ok(after_hit < before and t.hp < after_hit, "a THERMAL hit burns on after the shot (%.0f → %.0f → %.0f)" % [before, after_hit, t.hp])
	# the bow: CRYO arrows, five hits freeze
	gp.next_weapon()
	for i in 20:
		gp.step(1.0 / 30.0, cam, false, false, 0.0)
		await process_frame
	t.hp = t.max_hp
	t.burn = 0.0
	var froze := false
	for shot in 5:
		# the street steps the guns itself each frame from its controls: hold FIRE there, then let go
		st.controls.fire = true
		for i in 50:
			gp.aim_at(t, cam)
			await process_frame
		st.controls.fire = false
		for i in 12:
			await process_frame
		froze = froze or t.stun > 0.5
	ok(t.hp < t.max_hp and froze, "the bow's CRYO arrows land and five hits freeze the target (hp %.0f)" % t.hp)
	# the rocket: a round flies and its blast takes the target down
	gp.next_weapon()
	for i in 25:
		gp.step(1.0 / 30.0, cam, false, false, 0.0)
		await process_frame
	t.hp = 60.0
	t.shield = 0.0
	gp.aim_at(t, cam)
	var flying := false
	for i in 40:
		gp.step(1.0 / 30.0, cam, i == 0, false, 0.0)
		flying = flying or gp.ordnance.live() > 0
		await process_frame
	ok(flying and not t.alive(), "a rocket flies and its blast downs the target")
	# the HUD editor (touch layout) and the controller read, on a touch overlay of its own
	var Touch := load("res://scripts/player/touch_controls.gd")
	OS.set_environment("WF_TOUCH", "1")
	var tc: Control = Touch.new()
	root.add_child(tc)
	await frames(2)
	OS.unset_environment("WF_TOUCH")
	var btns: Dictionary = tc._layout_buttons()
	ok(btns.has("FIRE") and btns.has("ADS") and btns.has("MELEE") and btns.has("SUPER"), "the phone HUD carries FIRE, ADS, MELEE and the abilities (%d buttons)" % btns.size())
	if btns.has("FIRE"):
		var fb: Button = btns.FIRE
		var p0: Vector2 = fb.position
		tc.set_editing(true)
		tc.edit_touch(fb, Vector2(-60, -40))
		tc._resize(0.2)
		tc.set_editing(false)
		var moved: Vector2 = fb.position
		fb.position = p0
		fb.scale = Vector2.ONE
		tc._load_layout()
		ok(fb.position.is_equal_approx(moved) and absf(fb.scale.x - 1.2) < 0.01, "the HUD editor moves and sizes FIRE, and the layout loads back (%s)" % str(fb.position))
		tc._reset_layout()
		tc._save_layout()
	tc.queue_free()
