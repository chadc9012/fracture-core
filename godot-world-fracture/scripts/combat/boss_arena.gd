extends Control
## The Rift Gate (asset catalog: Fracture creatures & bosses): pick one of the six Fracture bosses and fight it at the
## Verdant Forest crash-site clearing with the shared on-foot stack — the operator, the worn guns, enemies.gd for the hull
## bar, adds and respawns, boss_view.gd for the creature. The HUD carries the boss bar (hull, phase, poise) and the
## telegraphs as toasts. A clear pays the row's Nex / XP into the profile and is remembered (`boss_clears`), so the first
## clear of each boss is the big one (later clears pay a third).

signal closed

const Region3D := preload("res://scripts/region_3d.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const Boss := preload("res://scripts/combat/boss.gd")
const BossView := preload("res://scripts/combat/boss_view.gd")
const REGION := "veridan"

var boss_id := ""
var region: Control
var operator: Node3D
var controls: Control
var gunplay: Node3D
var enemies: Node3D
var boss: Node3D
var _picker: Control
var _bar: Label
var _respawn_t := 0.0
var _done := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if boss_id == "":
		_pick()
	else:
		_start()

func _pick() -> void:
	_picker = Control.new()
	_picker.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_picker)
	var bg := ColorRect.new()
	bg.color = Color(0.04, 0.02, 0.06, 0.96)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_picker.add_child(bg)
	var box := VBoxContainer.new()
	box.position = Vector2(24, 80)
	box.custom_minimum_size = Vector2(492, 0)
	box.add_theme_constant_override("separation", 10)
	_picker.add_child(box)
	var title := Label.new()
	title.text = "RIFT GATE · FRACTURE BOSSES"
	title.add_theme_font_size_override("font_size", 26)
	box.add_child(title)
	var p := Gear.profile_load()
	var clears: Dictionary = p.get("boss_clears", {})
	for id in Boss.BOSSES:
		var d: Dictionary = Boss.BOSSES[id]
		var b := Button.new()
		var done: bool = clears.has(id)
		b.text = "%s%s — %d Nex" % [String(d.name).to_upper(), "  ✓" if done else "", int(d.reward[0]) / (3 if done else 1)]
		b.custom_minimum_size = Vector2(0, 48)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.add_theme_color_override("font_color", Color(0.85, 0.55, 1.0))
		b.pressed.connect(func(): boss_id = id; _picker.queue_free(); _picker = null; _start())
		box.add_child(b)
		var blurb := Label.new()
		blurb.text = String(d.blurb)
		blurb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		blurb.custom_minimum_size = Vector2(492, 0)
		blurb.add_theme_font_size_override("font_size", 13)
		blurb.modulate = Color(0.65, 0.7, 0.78)
		box.add_child(blurb)
	var back := Button.new()
	back.text = "← BACK"
	back.custom_minimum_size = Vector2(0, 48)
	back.pressed.connect(func(): closed.emit())
	box.add_child(back)

func _start() -> void:
	region = Region3D.new()
	region.set_anchors_preset(Control.PRESET_FULL_RECT)
	region.closed.connect(func(): closed.emit())
	add_child(region)
	var start := Vector2(495.0, -235.0)
	for poi in Data.map(REGION).get("pois", []):
		if poi.id == "crash-site":
			start = Vector2(poi.x, poi.z)
	region.show_region(REGION, start, Region3D.Mode.PLAY)
	controls = TouchControls.new()
	add_child(controls)
	operator = Player.new()
	region.world().add_child(operator)
	var half: float = region.span() * 0.5 - 20.0
	operator.bounds = Rect2(-half, -half, half * 2.0, half * 2.0)
	operator.ground_at = func(x: float, z: float) -> float: return region.ground(x, z)
	operator.obstacles = region.building_boxes()
	operator.position = region.stand_point()
	operator.build()
	operator.attach_camera(region.camera())
	region.camera().current = true
	gunplay = Gunplay.new()
	region.world().add_child(gunplay)
	gunplay.setup(operator, operator.obstacles)
	enemies = Enemies.new()
	region.world().add_child(enemies)
	enemies.setup(operator, gunplay)
	enemies.operator_down.connect(func(): _respawn_t = 5.0)
	var gear := Gear.load_save()
	gunplay.set_loadout(Gear.loadout(gear))
	enemies.hull_max = Enemies.HULL_MAX + Gear.hull_bonus(gear)
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	# the boss, out across the clearing
	boss = BossView.new()
	region.world().add_child(boss)
	var at := operator.position + Vector3(0, 0, -18.0)
	at.y = region.ground(at.x, at.z)
	boss.setup(boss_id, at, operator, gunplay, enemies, operator.ground_at)
	boss.obstacles = operator.obstacles
	boss.heading = PI
	boss.toast = func(t: String) -> void: controls.toast(t)
	boss.killed.connect(_on_killed)
	_bar = Label.new()
	_bar.position = Vector2(16, 60)
	_bar.add_theme_font_size_override("font_size", 18)
	_bar.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	_bar.modulate = Color(0.95, 0.75, 1.0)
	add_child(_bar)
	var back := Button.new()
	back.text = "← GLOBE"
	back.position = Vector2(16, 16)
	back.pressed.connect(func(): closed.emit())
	add_child(back)
	controls.toast("%s — %s" % [String(boss.rules.def.name), String(boss.rules.def.blurb)])

func _process(dt: float) -> void:
	if not boss:
		return
	dt = minf(dt, 0.05)
	enemies.step(dt)
	boss.step(dt)
	controls.show_hull(enemies.hull / enemies.hull_max, enemies.hurt, enemies.down)
	if _respawn_t > 0.0:
		_respawn_t -= dt
		if _respawn_t <= 0.0:
			operator.position = region.stand_point()
			operator.velocity = Vector3.ZERO
	operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
	if controls.take_next():
		gunplay.next_weapon()
	gunplay.step(dt, region.camera(), controls.fire, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
	var g = gunplay.gun()
	controls.weapon_name.text = g.display_name()
	controls.ammo.text = ("RELOADING" if g.reloading > 0.0 else g.ammo_text())
	var r: Boss = boss.rules
	var blocks := int(round(r.hull / r.hull_max * 20.0))
	var bar := "█".repeat(blocks) + "░".repeat(20 - blocks)
	var state := "STAGGERED" if r.staggered() else ("WEAK POINT" if r.weak_point() else String(r.tuning().label))
	_bar.text = "%s\n%s %d%%\n%s · poise %d%%" % [String(r.def.name), bar, int(r.hull / r.hull_max * 100.0), state, int(r.poise)]
	if r.dead:
		_bar.text = "%s\nDOWN" % String(r.def.name)

func _on_killed(id: String, reward: Dictionary) -> void:
	if _done:
		return
	_done = true
	var p := Gear.profile_load()
	var clears: Dictionary = p.get("boss_clears", {})
	var first: bool = not clears.has(id)
	var nex := int(reward.nex) / (1 if first else 3)
	var xp := int(reward.xp) / (1 if first else 3)
	p.nex = int(p.nex) + nex
	p.xp = int(p.xp) + xp
	clears[id] = int(clears.get(id, 0)) + 1
	p.boss_clears = clears
	Gear.profile_save(p)
	controls.toast("%s down — +%d Nex, +%d XP%s" % [String(Boss.BOSSES[id].name), nex, xp, "" if first else " (repeat)"])
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.position = Vector2(-170, -70)
	var v := VBoxContainer.new()
	panel.add_child(v)
	var t := Label.new()
	t.text = "%s DEFEATED\n+%d Nex   +%d XP" % [String(Boss.BOSSES[id].name).to_upper(), nex, xp]
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 22)
	v.add_child(t)
	var b := Button.new()
	b.text = "BACK TO THE GATE"
	b.custom_minimum_size = Vector2(300, 48)
	b.pressed.connect(func(): closed.emit())
	v.add_child(b)
	add_child(panel)
