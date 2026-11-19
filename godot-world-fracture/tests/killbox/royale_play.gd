extends Node
## Fracture Royale on the Verdant Forest (scripts/killbox/royale_view.gd), played headless with the frame stepped by
## hand: the squad drops at the circle's edge, rival squads land every 40 s, the fracture burns outside the circle, a
## walk out of it costs hull, the lobby empties and the match ends with a result and a payment.
## Run: godot --headless --path . res://tests/killbox/royale_play.tscn

const RoyaleView := preload("res://scripts/killbox/royale_view.gd")
const Match := preload("res://scripts/killbox/killbox_match.gd")

var ok := true

func check(name: String, cond: bool) -> void:
	print(("ok   " if cond else "FAIL ") + name)
	ok = ok and cond

func _ready() -> void:
	for f in ["user://profile.json", "user://inventory.json"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(f))
	var v := RoyaleView.new()
	add_child(v)
	for i in 3:
		await get_tree().process_frame
	v.controls.scripted = true
	var m: Match = v.match_state
	check("the lobby is 60 across 20 squads at the first circle", m.alive == 60 and m.squads() == 20 and is_equal_approx(m.radius, Match.START_RADIUS))
	var me := Vector2(v.operator.position.x, v.operator.position.z)
	var d0 := me.distance_to(v.centre)
	check("the squad stands inside the circle near its edge (%d m)" % int(d0), d0 < Match.START_RADIUS and d0 > Match.START_RADIUS - 40.0)
	check("two allies and a rival squad are on the field", v.enemies.alive_on(1) == 2 and v.enemies.alive_on(0) == 3)
	for e in v.enemies.enemies:
		var p := Vector2(e.mover.position.x, e.mover.position.z)
		check("%s stands inside the circle" % e.type, p.distance_to(v.centre) < Match.START_RADIUS)
	# 45 s: a second squad has landed, the circle still holds
	for i in 900:
		v._process(0.05)
	check("a second rival squad landed by 45 s (rivals %d)" % v.enemies.alive_on(0), v.enemies.enemies.size() >= 8 and not m.closing)
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
	print("royale play: ", "0 failed" if ok else "FAILED")
	get_tree().quit(0 if ok else 1)
