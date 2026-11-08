extends Control
const Phone := preload("res://scripts/phone.gd")
## Killbox in Godot: a match on one of the owner's arenas (arena.gd data) — Kaiju Complex (two blocks of neon-trimmed
## rooftops over a Neon City street, joined by three crossings), Fracture Floor (a plaza between two uplink terraces, data
## pillars that rewrite the sightlines) or Killbox Prime (one big roof round a capture zone, two lower balconies). Clash: your team
## of trooper bots against theirs, every elimination scores, first to 75. The operator, guns, bots and gear are the shared
## stack (scripts/player, scripts/combat, scripts/gear); roofs are the ground (arena.surface_at), the parapets, cover and
## ledges are the obstacle boxes, and falling below the kill plane is a death. Night, wet roofs, neon signs; the Billboard
## Blackout event darkens the signs for 30 s. The scoreboard and the clock sit in the HUD.

signal closed

const Arena := preload("res://scripts/killbox/arena.gd")
const Match := preload("res://scripts/killbox/killbox_match.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const PROFILE := "user://profile.json"
const BOT_TYPES := ["scout", "elite", "marksman", "scout", "executor"]
## the palette per arena `look` (killbox-arenas.ts): neon trim colours, the facade and roof tones, the sign text
const LOOKS := {
	"neon-rooftops": { "trim": [Color(1.0, 0.18, 0.62), Color(0.15, 0.85, 1.0), Color(0.62, 0.3, 1.0), Color(1.0, 0.62, 0.15), Color(0.25, 1.0, 0.55)], "facade": Color(0.1, 0.1, 0.14), "roof": Color(0.12, 0.12, 0.15), "sky": Color(0.03, 0.02, 0.07), "fog": Color(0.2, 0.12, 0.35), "sign": "KAIJU", "sign_color": Color(1.0, 0.18, 0.62) },
	"nexus-grid": { "trim": [Color(0.2, 0.9, 1.0), Color(0.6, 0.95, 1.0), Color(0.3, 0.6, 1.0)], "facade": Color(0.08, 0.1, 0.14), "roof": Color(0.1, 0.12, 0.16), "sky": Color(0.01, 0.03, 0.06), "fog": Color(0.08, 0.2, 0.3), "sign": "NEXUS UPLINK", "sign_color": Color(0.2, 0.9, 1.0) },
	"skydock": { "trim": [Color(1.0, 0.75, 0.2), Color(0.9, 0.95, 1.0), Color(0.3, 0.8, 1.0)], "facade": Color(0.12, 0.13, 0.16), "roof": Color(0.16, 0.17, 0.2), "sky": Color(0.05, 0.06, 0.1), "fog": Color(0.3, 0.3, 0.38), "sign": "SKYDOCK", "sign_color": Color(1.0, 0.75, 0.2) },
	"prime-roof": { "trim": [Color(0.75, 0.3, 1.0), Color(1.0, 0.3, 0.5), Color(0.4, 0.5, 1.0)], "facade": Color(0.09, 0.07, 0.13), "roof": Color(0.11, 0.1, 0.15), "sky": Color(0.04, 0.01, 0.07), "fog": Color(0.22, 0.1, 0.32), "sign": "KILLBOX PRIME", "sign_color": Color(0.75, 0.3, 1.0) },
}

## "" opens the arena picker first; a shot sets it before the view is added
var arena_id := ""
var mode_id := "clash"
var arena: Arena
var match_state: Match
var world: Node3D
var cam: Camera3D
var controls: Control
var operator: Node3D
var gunplay: Node3D
var enemies: Node3D
var hud: Label
var board: Label
var signs: Array = []
var sign_lights: Array = []
var _blackout := false
var _respawn_t := 0.0
var _rng := RandomNumberGenerator.new()
var _done_panel: Control
var _paid := false
var look: Dictionary = LOOKS["neon-rooftops"]
var _shifted := false
var _shifter_nodes: Array = []   # [{node, up_y, down_y, phase}]
var _picker: Control

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if arena_id == "":
		_pick()
	else:
		_start()

## the arena list before the match: name, region blurb, the fracture event
func _pick() -> void:
	_picker = Control.new()
	_picker.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_picker)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.02, 0.05, 0.96)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_picker.add_child(bg)
	var box := VBoxContainer.new()
	box.position = Vector2(24, 80)
	box.custom_minimum_size = Vector2(492, 0)
	box.add_theme_constant_override("separation", 14)
	_picker.add_child(box)
	var title := Label.new()
	title.text = "KILLBOX · CLASH"
	title.add_theme_font_size_override("font_size", 26)
	box.add_child(title)
	var sub := Label.new()
	sub.text = "Pick the arena. Six a side with your trooper squad; every elimination scores, first to 75."
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.custom_minimum_size = Vector2(492, 0)
	sub.modulate = Color(0.8, 0.85, 0.9)
	box.add_child(sub)
	for id in Arena.arena_ids():
		var a := Arena.new(id)
		var b := Button.new()
		b.text = "%s\n%s" % [String(a.def.name).to_upper(), String(a.fracture_name())]
		b.custom_minimum_size = Vector2(0, 64)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.add_theme_color_override("font_color", (LOOKS.get(String(a.def.look), look) as Dictionary).sign_color)
		b.pressed.connect(func(): arena_id = id; _picker.queue_free(); _picker = null; _start())
		box.add_child(b)
		var blurb := Label.new()
		blurb.text = String(a.def.blurb)
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
	_rng.seed = 31
	arena = Arena.new(arena_id)
	look = LOOKS.get(String(arena.def.look), LOOKS["neon-rooftops"])
	match_state = Match.new(Arena.mode(mode_id))
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.02, 0.04)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	Phone.fit_viewport(vp)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	world = Node3D.new()
	vp.add_child(world)
	_environment()
	_street()
	_roofs()
	_walks()
	_cover()
	_signs()
	_shifters()
	_zones()
	cam = Camera3D.new()
	cam.fov = 62.0
	cam.near = 0.08
	cam.far = 2500.0
	world.add_child(cam)
	cam.current = true
	# the operator on the home roof, the two teams of bots
	controls = TouchControls.new()
	add_child(controls)
	operator = Player.new()
	world.add_child(operator)
	var b := arena.bounds()
	operator.bounds = b
	operator.ground_at = func(x: float, z: float) -> float:
		var s: float = arena.surface_at(x, z)
		return s if s != -INF else -60.0
	operator.obstacles = arena.boxes()
	operator.position = arena.spawn("us")
	operator.heading = PI
	operator.build()
	operator.attach_camera(cam)
	gunplay = Gunplay.new()
	world.add_child(gunplay)
	gunplay.setup(operator, operator.obstacles)
	enemies = Enemies.new()
	world.add_child(enemies)
	enemies.setup(operator, gunplay)
	enemies.operator_team = 1
	enemies.operator_down.connect(_on_operator_down)
	enemies.bot_down.connect(_on_bot_down)
	var gear := Gear.load_save()
	gunplay.set_loadout(Gear.loadout(gear))
	enemies.hull_max = Enemies.HULL_MAX + Gear.hull_bonus(gear)
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	var size: int = int(match_state.mode.get("teamSize", 6))
	for i in size - 1:
		var e: RefCounted = enemies.spawn(BOT_TYPES[i % BOT_TYPES.size()], arena.spawn("us", [], i + 1), [], 1)
		e.state = Enemies.State.ENGAGE
	for i in size:
		var e2: RefCounted = enemies.spawn(BOT_TYPES[i % BOT_TYPES.size()], arena.spawn("them", [], i), [], 0)
		e2.state = Enemies.State.ENGAGE
	hud = Label.new()
	hud.position = Vector2(16, 60)
	hud.add_theme_font_size_override("font_size", 22)
	hud.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	hud.add_theme_constant_override("shadow_offset_x", 1)
	hud.add_theme_constant_override("shadow_offset_y", 1)
	add_child(hud)
	board = Label.new()
	board.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	board.position = Vector2(-200, 60)
	board.add_theme_font_size_override("font_size", 15)
	board.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	add_child(board)
	var back := Button.new()
	back.text = "← LEAVE"
	back.position = Vector2(16, 16)
	back.pressed.connect(func(): closed.emit())
	add_child(back)
	controls.toast("%s · %s — first to %d" % [String(arena.def.name), String(match_state.mode.name), match_state.target()])

# --------------------------------------------------------------------------------------------- the look
func _mat(c: Color, rough := 0.8, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

func _box(size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	mi.material_override = mat
	world.add_child(mi)
	return mi

func _environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = look.sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.25, 0.2, 0.4)
	env.ambient_light_energy = 1.3
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_enabled = true
	env.fog_light_color = look.fog
	env.fog_density = 0.0015 if String(arena.def.look) == "neon-rooftops" else 0.0005
	env.glow_enabled = true
	env.glow_intensity = 0.6
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var moon := DirectionalLight3D.new()
	moon.light_color = Color(0.5, 0.55, 0.9)
	moon.light_energy = 0.7
	moon.rotation_degrees = Vector3(-55, 20, 0)
	moon.shadow_enabled = true
	world.add_child(moon)

## the street far below between the two blocks, lit by the signs: a reason not to fall
func _street() -> void:
	_box(Vector3(140, 0.2, 140), Vector3(0, -0.1, 0), _mat(Color(0.05, 0.05, 0.07), 0.3, 0.2))
	var paint := _mat(Color(0.8, 0.8, 0.75), 0.5)
	var z := -60.0
	while z < 60.0:
		_box(Vector3(0.15, 0.02, 3.0), Vector3(0, 0.01, z), paint)
		z += 9.0
	for s: float in [-1.0, 1.0]:
		_box(Vector3(0.15, 0.02, 140), Vector3(s * 6.5, 0.01, 0), paint)
	# the two blocks' facades up to the roofs, with lit windows
	var facade := _mat(look.facade, 0.7)
	var lit := _mat(Color(1.0, 0.85, 0.6), 0.5, 0.0, 1.5)
	for r in arena.def.roofs:
		var w := float(r.x1) - float(r.x0)
		var d := float(r.z1) - float(r.z0)
		var top := float(r.top)
		_box(Vector3(w, top, d), Vector3((float(r.x0) + float(r.x1)) / 2.0, top / 2.0, (float(r.z0) + float(r.z1)) / 2.0), facade)
		var zc := (float(r.z0) + float(r.z1)) / 2.0
		for fl in int(top / 3.2):
			for k in int(w / 4.0):
				if _rng.randf() < 0.55:
					_box(Vector3(1.6, 1.2, 0.05), Vector3(float(r.x0) + 2.0 + k * 4.0, 2.0 + fl * 3.2, float(r.z0) - 0.03 if zc < 0 else float(r.z1) + 0.03), lit)

func _roofs() -> void:
	var wet := _mat(look.roof, 0.25, 0.1)
	var trim_k := 0
	for r in arena.def.roofs:
		var w := float(r.x1) - float(r.x0)
		var d := float(r.z1) - float(r.z0)
		var c := Vector3((float(r.x0) + float(r.x1)) / 2.0, float(r.top), (float(r.z0) + float(r.z1)) / 2.0)
		_box(Vector3(w, 0.3, d), c + Vector3(0, -0.15, 0), wet)
		# seams between the roof panels, catching the sign light
		var seam := _mat(Color(0.2, 0.2, 0.24), 0.2, 0.2)
		var sx := float(r.x0) + 4.0
		while sx < float(r.x1) - 0.5:
			_box(Vector3(0.08, 0.02, d), Vector3(sx, float(r.top) + 0.01, c.z), seam)
			sx += 4.0
		var sz := float(r.z0) + 4.0
		while sz < float(r.z1) - 0.5:
			_box(Vector3(w, 0.02, 0.08), Vector3(c.x, float(r.top) + 0.01, sz), seam)
			sz += 4.0
		# parapets as drawn walls where the data puts them; neon trim along every edge
		var neon: Color = look.trim[trim_k % (look.trim as Array).size()]
		trim_k += 1
		for edge in [[Vector3(c.x, 0, float(r.z0)), Vector3(w, 0.05, 0.08)], [Vector3(c.x, 0, float(r.z1)), Vector3(w, 0.05, 0.08)], [Vector3(float(r.x0), 0, c.z), Vector3(0.08, 0.05, d)], [Vector3(float(r.x1), 0, c.z), Vector3(0.08, 0.05, d)]]:
			var mi := _box(edge[1], Vector3((edge[0] as Vector3).x, float(r.top) + 1.1, (edge[0] as Vector3).z), _mat(neon, 0.4, 0.0, 3.5))
			signs.append(mi)
	for b in arena.boxes():
		# the parapets and ledges from the data, drawn as concrete
		if b.size.y > 0.9 and (b.size.x < 0.5 or b.size.z < 0.5) and b.size.y < 5.0:
			_box(b.size, b.get_center(), _mat(Color(0.3, 0.3, 0.33), 0.8))

func _walks() -> void:
	var steel := _mat(Color(0.35, 0.37, 0.4), 0.5, 0.6)
	var grate := _mat(Color(0.22, 0.23, 0.26), 0.6, 0.4)
	for w in arena.def.walks:
		var q := Arena._walk_rect(w)
		var lo := float(w.top)
		var hi := float(w.topB)
		var c := Vector3(q.get_center().x, (lo + hi) / 2.0, q.get_center().y)
		var mi := _box(Vector3(q.size.x, 0.25, q.size.y), c, grate)
		var rise := hi - lo
		var run := q.size.y if w.along == "z" else q.size.x
		if absf(rise) > 0.01:
			var ang := atan2(rise, run)
			mi.rotation = Vector3(-ang, 0, 0) if w.along == "z" else Vector3(0, 0, ang)
		if w.rails:
			for s: float in [-1.0, 1.0]:
				var rp := c + (Vector3(s * q.size.x / 2.0, 0.6, 0) if w.along == "z" else Vector3(0, 0.6, s * q.size.y / 2.0))
				var rail := _box(Vector3(0.06, 0.06, run) if w.along == "z" else Vector3(run, 0.06, 0.06), rp, steel)
				rail.rotation = mi.rotation

func _cover() -> void:
	var mats := { "hvac": _mat(Color(0.6, 0.62, 0.65), 0.5, 0.5), "tank": _mat(Color(0.5, 0.35, 0.25), 0.7), "vent": _mat(Color(0.4, 0.42, 0.45), 0.6, 0.5), "crate": _mat(Color(0.45, 0.4, 0.3), 0.8), "sign": _mat(Color(0.15, 0.15, 0.18), 0.5, 0.3), "container": _mat(Color(0.2, 0.35, 0.5), 0.6, 0.4), "console": _mat(Color(0.18, 0.2, 0.25), 0.4, 0.6), "barrier": _mat(Color(0.85, 0.3, 0.2), 0.7) }
	for c in arena.def.cover:
		var top: float = arena.surface_at(float(c.x), float(c.z))
		if top == -INF:
			top = 0.0
		var m: Material = mats.get(String(c.kind), mats.crate)
		if c.kind == "tank":
			var mi := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = float(c.w) / 2.0
			cm.bottom_radius = float(c.w) / 2.0
			cm.height = float(c.h)
			mi.mesh = cm
			mi.position = Vector3(float(c.x), top + float(c.h) / 2.0, float(c.z))
			mi.material_override = m
			world.add_child(mi)
		else:
			_box(Vector3(float(c.w), float(c.h), float(c.d)), Vector3(float(c.x), top + float(c.h) / 2.0, float(c.z)), m)
			if c.kind == "sign":
				var face := _box(Vector3(float(c.w) - 0.4, float(c.h) - 0.4, 0.05), Vector3(float(c.x), top + float(c.h) / 2.0, float(c.z) + float(c.d) / 2.0 + 0.03), _mat(look.trim[1], 0.4, 0.0, 3.0))
				signs.append(face)

## the arena's sign over the north roof, the sign lights
func _signs() -> void:
	var r: Dictionary = arena.def.roofs[0]
	for cand in arena.def.roofs:
		if float(cand.z1) > float(r.z1) or (float(cand.z1) == float(r.z1) and absf(float(cand.x0) + float(cand.x1)) < absf(float(r.x0) + float(r.x1))):
			r = cand
	var mi := _box(Vector3(26, 6, 0.4), Vector3((float(r.x0) + float(r.x1)) / 2.0, float(r.top) + 8.0, float(r.z1) + 0.5), _mat(Color(0.08, 0.08, 0.1), 0.5, 0.3))
	var face := _box(Vector3(25, 5, 0.1), mi.position + Vector3(0, 0, -0.3), _mat(look.sign_color, 0.4, 0.0, 3.5))
	signs.append(face)
	var l3 := Label3D.new()
	l3.text = String(look.sign)
	l3.font_size = 220 if String(look.sign).length() <= 6 else 120
	l3.pixel_size = 0.02
	l3.modulate = Color(1, 1, 1)
	l3.shaded = false
	l3.position = face.position + Vector3(0, 0, -0.2)
	l3.rotation_degrees.y = 180.0
	world.add_child(l3)
	for i in 4:
		var l := OmniLight3D.new()
		l.light_color = look.trim[i % (look.trim as Array).size()]
		l.light_energy = 2.5
		l.omni_range = 40.0
		l.position = Vector3(-30.0 + i * 20.0, 26.0, 0.0)
		world.add_child(l)
		sign_lights.append(l)

## the moving cover: data pillars (Fracture Floor) / glass walls (Killbox Prime) that stand in one phase of the event
func _shifters() -> void:
	var glass := _mat(Color(0.5, 0.85, 1.0, 0.4), 0.1, 0.2, 0.25)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	for sh in arena.def.get("shifters", []):
		var top: float = arena.surface_at(float(sh.x), float(sh.z))
		if top == -INF:
			top = 0.0
		var h := float(sh.h)
		var up := String(sh.phase) == "up"
		var mi := _box(Vector3(float(sh.w), h, float(sh.d)), Vector3(float(sh.x), top + h / 2.0, float(sh.z)), glass)
		var lid := _box(Vector3(float(sh.w), 0.06, float(sh.d)), Vector3(0, h / 2.0, 0), _mat(look.trim[0], 0.4, 0.0, 2.5))
		lid.reparent(mi)
		lid.position = Vector3(0, h / 2.0, 0)
		var down_y := top - h / 2.0 - 0.1
		if not up:
			mi.position.y = down_y
		_shifter_nodes.append({ "node": mi, "up_y": top + h / 2.0, "down_y": down_y, "up": up })

## the capture zones (Dominion's A / B / C) drawn as faint rings on the decks — a landmark for every mode
func _zones() -> void:
	for z in arena.def.get("zones", []):
		var x := float(z.dx)
		var zz := float(z.dz)
		var top: float = arena.surface_at(x, zz)
		if top == -INF:
			continue
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 3.6
		tm.outer_radius = 4.0
		ring.mesh = tm
		ring.position = Vector3(x, top + 0.05, zz)
		ring.material_override = _mat(look.trim[1], 0.5, 0.0, 1.5)
		world.add_child(ring)
		var l3 := Label3D.new()
		l3.text = String(z.id)
		l3.font_size = 160
		l3.pixel_size = 0.01
		l3.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l3.modulate = look.trim[1]
		l3.position = Vector3(x, top + 3.0, zz)
		world.add_child(l3)

## the fracture event on / off: the signs go dark where the event dims visibility (Billboard Blackout); the shifters swap
func _set_event(on: bool) -> void:
	_blackout = on
	var f: Dictionary = arena.def.fracture
	if float(f.get("visibility", 1.0)) < 1.0:
		for s in signs:
			(s as MeshInstance3D).visible = not on
		for l in sign_lights:
			(l as OmniLight3D).light_energy = 0.3 if on else 2.5
	if not _shifter_nodes.is_empty():
		_shifted = on
		var nb: Array[AABB] = arena.boxes(on)
		operator.obstacles.clear()
		operator.obstacles.append_array(nb)
	controls.toast((String(f.name).to_upper() + " — " + String(f.brief)) if on else "The %s ends" % String(f.name))

func _slide_shifters(dt: float) -> void:
	for sh in _shifter_nodes:
		var mi: MeshInstance3D = sh.node
		var standing: bool = (sh.up as bool) != _shifted
		var want: float = (sh.up_y as float) if standing else (sh.down_y as float)
		mi.position.y = move_toward(mi.position.y, want, 2.5 * dt)

# --------------------------------------------------------------------------------------------- the match
func _on_bot_down(e: RefCounted, _by_team: int, by_player: bool) -> void:
	if (e as Enemies.Enemy).team == 0:
		match_state.score(1, by_player)
	else:
		match_state.score(0)
	_respawn_bot(e)

func _respawn_bot(e: RefCounted) -> void:
	var en := e as Enemies.Enemy
	var threats: Array = []
	for o in enemies.enemies:
		if o.team != en.team and o.target.alive():
			threats.append(o.mover.position)
	if en.team == 0:
		threats.append(operator.position)
	en.spawn = arena.spawn("us" if en.team == 1 else "them", threats)
	en.timer = 4.0

func _on_operator_down() -> void:
	match_state.score(0)
	match_state.player_died()
	_respawn_t = 4.0

func _process(dt: float) -> void:
	if not match_state:
		return
	dt = minf(dt, 0.05)
	match_state.tick(dt)
	enemies.step(dt)
	controls.show_hull(enemies.hull / enemies.hull_max, enemies.hurt, enemies.down)
	if _respawn_t > 0.0:
		_respawn_t -= dt
		if _respawn_t <= 0.0:
			var threats: Array = []
			for o in enemies.enemies:
				if o.team == 0 and o.target.alive():
					threats.append(o.mover.position)
			operator.position = arena.spawn("us", threats)
			operator.velocity = Vector3.ZERO
	# the fall
	if operator.position.y < arena.kill_plane() and enemies.down <= 0.0:
		enemies.hull = 0.0
		enemies.down = 4.0
		enemies.deaths += 1
		_on_operator_down()
		controls.toast("You fell to the street")
	for e in enemies.enemies:
		if e.state == Enemies.State.PATROL:
			e.state = Enemies.State.ENGAGE
		if e.state != Enemies.State.DOWN and e.mover.position.y < arena.kill_plane():
			e.target.hp = 0.0
	if not match_state.over:
		operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
		if controls.take_next():
			gunplay.next_weapon()
		gunplay.step(dt, cam, controls.fire, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
	# the fracture event
	var f: Dictionary = arena.def.fracture
	var t := match_state.clock
	var since := t - float(f.first)
	var running := since >= 0.0 and fmod(since, float(f.every)) < float(f.length)
	if running != _blackout:
		_set_event(running)
	_slide_shifters(dt)
	var g = gunplay.gun()
	controls.weapon_name.text = g.display_name()
	controls.ammo.text = ("RELOADING" if g.reloading > 0.0 else g.ammo_text())
	hud.text = "US %d   THEM %d   ·   %s" % [match_state.us, match_state.them, match_state.clock_text()]
	board.text = "%s · first to %d\nyou: %d kills · %d deaths" % [String(match_state.mode.name), match_state.target(), match_state.player_kills, match_state.player_deaths]
	if match_state.over and not _paid:
		_finish()

func _finish() -> void:
	_paid = true
	var won := match_state.winner == "us"
	var nex := 400 if won else 150
	var xp := 300 if won else 120
	var p := Gear.profile_load()
	p.nex = int(p.nex) + nex
	p.xp = int(p.xp) + xp
	while int(p.xp) >= int(p.level) * 1000:
		p.level = int(p.level) + 1
	Gear.profile_save(p)
	_done_panel = PanelContainer.new()
	_done_panel.set_anchors_preset(Control.PRESET_CENTER)
	_done_panel.position = Vector2(-170, -90)
	var v := VBoxContainer.new()
	_done_panel.add_child(v)
	var t := Label.new()
	t.text = "%s\n%d – %d\n+%d Nex   +%d XP" % ["VICTORY" if won else ("DRAW" if match_state.winner == "draw" else "DEFEAT"), match_state.us, match_state.them, nex, xp]
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_font_size_override("font_size", 24)
	v.add_child(t)
	var b := Button.new()
	b.text = "LEAVE THE KILLBOX"
	b.custom_minimum_size = Vector2(300, 48)
	b.pressed.connect(func(): closed.emit())
	v.add_child(b)
	add_child(_done_panel)
