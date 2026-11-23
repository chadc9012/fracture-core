extends Node
## Fracture Royale on the Verdant Forest (scripts/killbox/royale_view.gd), played headless with the frame stepped by
## hand: the squad drops at the circle's edge, rival squads land every 40 s, the fracture burns outside the circle, a
## walk out of it costs hull, the lobby empties and the match ends with a result and a payment.
## Run: godot --headless --path . res://tests/killbox/royale_play.tscn

const RoyaleView := preload("res://scripts/killbox/royale_view.gd")
const Match := preload("res://scripts/killbox/killbox_match.gd")
const Kit := preload("res://scripts/killbox/royale_kit.gd")

var ok := true

func check(name: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + name)
	ok = ok and cond

func _ready() -> void:
	for f in ["user://profile.json", "user://inventory.json", "user://royale_kit.json"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(f))
	var v := RoyaleView.new()
	v.drop_in = false   # the opening on the ground; the drop has its own run at the end
	add_child(v)
	for i in 3:
		await get_tree().process_frame
	v.controls.scripted = true
	var m: Match = v.match_state
	check("the lobby is 60 across 20 squads at the first circle", m.alive == 60 and m.squads() == 20 and is_equal_approx(m.radius, Match.START_RADIUS))
	var me := Vector2(v.operator.position.x, v.operator.position.z)
	var d0 := me.distance_to(v.centre)
	check("the squad stands inside the circle near its edge (%d m)" % int(d0), d0 < Match.START_RADIUS and d0 > Match.START_RADIUS - 40.0)
	check("two allies and two rival squads are on the field", v.enemies.alive_on(1) == 2 and v.rivals() == 6)
	for e in v.enemies.enemies:
		var p := Vector2(e.mover.position.x, e.mover.position.z)
		check("%s stands inside the circle" % e.type, p.distance_to(v.centre) < Match.START_RADIUS)
	# 45 s: a second squad has landed, the circle still holds
	for i in 900:
		v._process(0.05)
	check("more rivals landed by 45 s (rivals %d)" % v.rivals(), v.enemies.enemies.size() >= 11 and not m.closing)
	# step out past the wall: the fracture burns
	var hull0: float = v.enemies.hull
	# toward the map's middle, where there is room past the wall (out along the landing bearing can be off the map, and the
	# operator is held inside it)
	var dir := (-v.centre).normalized() if v.centre.length() > 1.0 else (me - v.centre).normalized()
	v.operator.position = Vector3(v.centre.x + dir.x * (m.radius + 30.0), v.operator.position.y, v.centre.y + dir.y * (m.radius + 30.0))
	v.controls.fire = false
	for i in 100:
		v._process(0.05)
	check("outside the circle the fracture burns the hull (%.0f → %.0f)" % [hull0, v.enemies.hull], v.enemies.hull < hull0)
	check("the prompt says so", String(v.controls.prompt_label.text).begins_with("OUTSIDE") if "prompt_label" in v.controls else true)
	v.operator.position = Vector3(v.centre.x, v.operator.position.y, v.centre.y)
	# the first closing phase: the wall shrinks
	for i in 400:
		v._process(0.05)
	check("by 70 s the circle is closing and smaller", m.closing and m.radius < Match.START_RADIUS)
	check("the wall and ring follow the circle", is_equal_approx(v._wall.scale.x, m.radius) and is_equal_approx(v._ring.scale.x, m.radius))
	# the lobby runs down and the match ends with a result and a payment
	var t := 0.0
	while not m.over and t < 900.0:
		v._process(0.05)
		t += 0.05
	check("the match ends (%s, %s) by %.0f s" % [m.winner, m.reason, t], m.over and m.winner in ["us", "them"])
	check("the result paid the profile", v._paid and v._done_panel != null)
	# the battle-royale layer: a sidearm and no armour at the start, loot on the field, and the drop
	v.queue_free()
	await get_tree().process_frame
	# the drop kit: the standard canopy is yours, the sport canopy and the wingsuit are bought with Nex
	var k0: Dictionary = Kit.load_kit()
	check("a fresh kit owns only the standard canopy", Kit.owns(k0, "canopy-standard") and not Kit.owns(k0, "canopy-sport") and not Kit.owns(k0, "wingsuit"))
	var poor := { "nex": 100 }
	check("no Nex, no wingsuit", Kit.buy(k0, poor, "wingsuit").begins_with("Needs") and not Kit.owns(k0, "wingsuit") and int(poor.nex) == 100)
	# a jump with the standard kit: RUN does nothing, the round canopy opens itself and cannot be cut away
	var plain := RoyaleView.new()
	plain.show_kit = false
	add_child(plain)
	for i in 3:
		await get_tree().process_frame
	plain.controls.scripted = true
	plain._jump()
	plain.controls.sprint = true
	for i in 20:
		plain._process(0.05)
	check("without the wingsuit RUN is just a fall", not plain.wingsuit and plain.phase == "fall")
	plain.controls.sprint = false
	var ps := 0
	var round_seen := false
	while plain.phase != "" and ps < 2000:
		plain._process(0.05)
		if plain.phase == "chute":
			round_seen = true
			plain.controls._jump = true    # JUMP under the round canopy does not cut it away
		ps += 1
	check("the standard canopy opens itself and lands you", round_seen and plain.phase == "" and plain._canopy == null)
	plain.queue_free()
	await get_tree().process_frame
	var rich := { "nex": 6000 }
	check("with the Nex both are bought and kept", Kit.buy(k0, rich, "wingsuit").begins_with("Bought") and Kit.buy(k0, rich, "canopy-sport").begins_with("Bought") and int(rich.nex) == 500 and Kit.buy(k0, rich, "wingsuit").contains("already"))
	Kit.save_kit(k0)
	check("the kit is saved", Kit.owns(Kit.load_kit(), "wingsuit") and Kit.owns(Kit.load_kit(), "canopy-sport"))
	var d := RoyaleView.new()
	d.show_kit = false
	add_child(d)
	for i in 3:
		await get_tree().process_frame
	d.controls.scripted = true
	check("you ride the dropship in with a common sidearm and no armour", d.phase == "ship" and d.gunplay.guns.size() == 1 and d.gunplay.guns[0].frame == "SIDEARM" and d.enemies.shield == 0.0)
	check("the field is seeded with loot (%d things)" % d.loot.items.size(), d.loot.items.size() >= 100)
	var alt0: float = d.operator.position.y - d.region.ground(d.operator.position.x, d.operator.position.z)
	for i in 40:
		d._process(0.05)
	d._jump()
	check("jumping starts the free fall from %d m" % int(alt0), d.phase == "fall" and alt0 > 100.0)
	# the wingsuit (RUN held): it covers ground and sinks slowly; a plain fall drops
	var w0: Vector3 = d.operator.position
	d.controls.sprint = true
	for i in 40:
		d._process(0.05)
	var w1: Vector3 = d.operator.position
	check("the wingsuit glides (%d m over the ground for %d m down)" % [int(Vector2(w1.x - w0.x, w1.z - w0.z).length()), int(w0.y - w1.y)], d.wingsuit and Vector2(w1.x - w0.x, w1.z - w0.z).length() > 45.0 and w0.y - w1.y < 40.0 and d._wings.visible)
	d.controls.sprint = false
	d._process(0.05)
	check("letting go drops out of it", not d.wingsuit and not d._wings.visible)
	# the canopy: opened by hand, cut away, opened again
	d._open_canopy()
	for i in 20:
		d._process(0.05)
	check("the canopy holds the fall to a few m/s and flies forward", d.phase == "chute" and absf(d._fall_v.y) < 9.0 and Vector2(d._fall_v.x, d._fall_v.z).length() > 8.0)
	if d.operator.position.y - d.region.ground(d.operator.position.x, d.operator.position.z) > 30.0:
		d._cut_away()
		check("cutting it away is a free fall again", d.phase == "fall" and d._canopy == null)
	var steps := 0
	var saw_canopy := d.phase == "chute"
	while d.phase != "" and steps < 2000:
		d._process(0.05)
		saw_canopy = saw_canopy or d.phase == "chute"
		steps += 1
	check("the canopy opens and you land with your squad (%.0f s)" % (steps * 0.05), saw_canopy and d.phase == "" and d.enemies.alive_on(1) == 2 and d.rivals() == 6)
	for e in d.enemies.enemies:
		if e.team != 1:
			e.target.take(99999.0)     # the field cleared: the rest is not a fight
	d._process(0.05)
	# loot: a gun into a free slot, a plate onto the armour, a chest spilling its contents
	var at: Vector3 = d.operator.position
	d.loot.add("gun", at, "AUTO", "epic")
	d.loot.add("plate", at)
	d._process(0.05)
	check("walking over a gun and a plate takes them", d.gunplay.guns.size() == 2 and d.gunplay.gun().frame == "AUTO" and d.gunplay.gun().rarity == "epic" and is_equal_approx(d.enemies.shield, 50.0))
	var n0: int = d.loot.items.size()
	d.loot.add("chest", at + Vector3(1.0, 0, 0))
	d._process(0.05)
	check("a chest opens and spills a gun and supplies", d.loot.opened == 1 and d.loot.items.size() >= n0 + 4)
	d.loot.meds = 1
	d.enemies.hull = 30.0
	check("a med kit gives hull back", d.loot.heal(d.enemies) and d.enemies.hull > 70.0 and d.loot.meds == 0)
	var sup: RefCounted = d.loot.supply(Vector2(at.x + 6.0, at.z))
	for i in 300:
		d._process(0.05)
	check("a supply drop comes down and lands", not sup.falling)
	# the squad game: rival squads are teams of their own, a downed squadmate comes back at their beacon, a knocked
	# operator is picked up
	var teams := {}
	for e in d.enemies.enemies:
		if e.team != 1:
			teams[e.team] = true
	check("each rival squad is its own team (%d teams)" % teams.size(), teams.size() >= 2)
	check("the dial carries the circle", d._gps.rings.size() == 1 and is_equal_approx(float(d._gps.rings[0].r), d.match_state.radius))
	var mate: RefCounted = null
	for e in d._allies:
		if e.target.alive():
			mate = e
	var b0: int = d._beacons.size()
	var r0: int = d.revives
	d.operator.position = mate.mover.position + Vector3(6.0, 0, 0)
	mate.target.take(99999.0)
	for i in 4:
		d._process(0.05)
	check("a squadmate down leaves a beacon (%d → %d)" % [b0, d._beacons.size()], d._beacons.size() == b0 + 1 and not mate.target.alive())
	if d._beacons.size() > b0:
		var spot: Vector3 = d._beacons[-1].node.position
		for i in 100:
			d.operator.position = spot
			d._process(0.05)
	check("standing on it brings them back", mate.target.alive() and d.revives == r0 + 1)
	for e in d.enemies.enemies:
		if e.team != 1:
			e.target.take(99999.0)     # the field cleared, so the pick-up is not a fight
	d.enemies.burn(99999.0)
	d._process(0.05)
	check("down with a squadmate up, you are knocked, not out", d.knocked > 0.0 and not d.match_state.over)
	for i in 240:
		d._process(0.05)
	check("a squadmate picks you up (hull %d)" % int(d.enemies.hull), d.knocked == 0.0 and d.enemies.down <= 0.0 and d.enemies.hull > 0.0 and not d.match_state.over)
	# vehicles: in, driven, out
	check("vehicles stand on the field (%d)" % d.rides.parked.size(), d.rides.parked.size() >= 6)
	var ride: Node3D = d.rides.parked[0]
	d.operator.position = ride.position + Vector3(1.5, 0, 0)
	d.controls._enter = true
	d._process(0.05)
	var p0: Vector3 = ride.position
	check("ENTER by a vehicle gets in", d.rides.driving())
	d.controls.move = Vector2(0, 1)
	for i in 80:
		d._process(0.05)
	check("it drives (%.0f m)" % ride.position.distance_to(p0), ride.position.distance_to(p0) > 5.0 and d.operator.position.distance_to(ride.position) < 0.5)
	d.controls.move = Vector2.ZERO
	d.rides.car.speed = 0.0
	d.controls._enter = true
	d._process(0.05)
	check("ENTER when stopped gets out", not d.rides.driving() and d.operator.rig.visible)
	print("royale play: ", "0 failed" if ok else "FAILED")
	get_tree().quit(0 if ok else 1)
