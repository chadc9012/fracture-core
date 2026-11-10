extends RefCounted
## Mission 01's cinematics, "The Day the World Fractured" (the owner's cinematic script, Nov 9), staged in the mission's
## own world on scripts/cinema/cutscene.gd:
##   1  The Ordinary World   sunrise over Nexus City, traffic, the radio            (new game, before the apartment)
##   2  Apartment 12-04      the phone alarm, the radio, the room, the player     (then the playable morning)
##   3  First Disturbance    the news, the rumble, the lights, purple cracks in the glass
##   4  The Fracture         the sky splits over the city, the building shakes
##   5  NOVA Awakens         a holographic interface opens in front of the player; NOVA's first words
##      (the door buckles, purple light floods the hall — cut to gameplay: the escape)
##   7  First Power          the blocked stairwell on 12 (the campaign draft's Missions 01–02): a mother, her daughter
##                          behind a fallen slab, the player's hands answering
##   8  The New World        after the Breach: the camera climbs over the changed skyline; the title
## (6, the escape, is played: the alarm, the corridor, the stairs, the Sky Lounge, the lobby.)
## Every function takes the mission (mission_01.gd) and returns a shot list, building what the scene needs first.

const Fx := preload("res://scripts/vfx/fx.gd")
const Materials := preload("res://scripts/city/materials.gd")
const PURPLE := Color(0.62, 0.32, 1.0)
const NOVA_COL := Color(0.45, 0.8, 1.0)

const TEAR := """
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;
uniform float open = 0.0;
float h(float x) { return fract(sin(x * 127.1) * 43758.5); }
float n1(float x) { float i = floor(x); float f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void fragment() {
	float y = UV.y;
	float cx = 0.5 + (n1(y * 6.0) - 0.5) * 0.3 + (n1(y * 21.0 + 4.0) - 0.5) * 0.08;
	float w = (0.015 + 0.16 * sin(y * 3.14159) * (0.7 + 0.3 * n1(y * 9.0 + TIME * 1.5))) * open;
	float d = abs(UV.x - cx) / max(w, 0.0001);
	float core = smoothstep(1.0, 0.15, d);
	float halo = smoothstep(4.0, 0.5, d) * 0.4;
	vec3 c = mix(vec3(0.55, 0.2, 1.0), vec3(1.0, 0.92, 1.0), core);
	ALBEDO = c * (core * 3.0 + halo * 1.2) * open;
}"""

# ---------------------------------------------------------------- props

## purple cracks across the apartment's glass, hidden until the disturbance
static func window_cracks(m: Node) -> Node3D:
	var root := Node3D.new()
	root.visible = false
	m.int_root.add_child(root)
	var c: Vector3 = m.APT
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.55, 0.3, 0.95)
	mat.emission_enabled = true
	mat.emission = PURPLE
	mat.emission_energy_multiplier = 6.0
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var rng := RandomNumberGenerator.new()
	rng.seed = 1204
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# three impact points, each throwing six to nine jagged branches across the pane
	for hit in [Vector2(-3.0, 1.9), Vector2(1.8, 1.4), Vector2(5.2, 2.3)]:
		for b in 6 + rng.randi() % 4:
			var a := rng.randf() * TAU
			var p: Vector2 = hit
			var w := 0.016
			for s in 7:
				a += rng.randf_range(-0.6, 0.6)
				var q := p + Vector2(cos(a), sin(a)) * rng.randf_range(0.18, 0.42)
				var n := (q - p).normalized().orthogonal() * w
				var z := -5.38
				st.add_vertex(Vector3(p.x - n.x, p.y - n.y, z))
				st.add_vertex(Vector3(p.x + n.x, p.y + n.y, z))
				st.add_vertex(Vector3(q.x + n.x * 0.6, q.y + n.y * 0.6, z))
				st.add_vertex(Vector3(p.x - n.x, p.y - n.y, z))
				st.add_vertex(Vector3(q.x + n.x * 0.6, q.y + n.y * 0.6, z))
				st.add_vertex(Vector3(q.x - n.x * 0.6, q.y - n.y * 0.6, z))
				p = q
				w *= 0.78
				if p.y < 0.1 or p.y > 3.1:
					break
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.position = c
	root.add_child(mi)
	var glow := OmniLight3D.new()
	glow.light_color = PURPLE
	glow.light_energy = 1.6
	glow.omni_range = 7.0
	glow.position = c + Vector3(1.0, 1.8, -4.6)
	root.add_child(glow)
	return root

## the split in the sky north of the Residences, seen through the glass (closed until `open` rises)
static func sky_tear(m: Node) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(140.0, 520.0)
	mi.mesh = q
	var sh := Shader.new()
	sh.code = TEAR
	var mat := ShaderMaterial.new()
	mat.shader = sh
	mi.material_override = mat
	mi.position = m.APT + Vector3(-30.0, 170.0, -420.0)
	mi.rotation.z = 0.18
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.visible = false
	m.int_root.add_child(mi)
	return mi

## NOVA's interface: an emblem turning in a ring of light, her name, and three thin panels of scrolling readouts
static func nova_ui(m: Node, at: Vector3) -> Node3D:
	var root := Node3D.new()
	root.position = at
	root.visible = false
	m.int_root.add_child(root)
	var em := Fx.hologram("emblem", NOVA_COL, 1.6)
	em.position = Vector3(0, -0.15, 0)
	root.add_child(em)
	var name_l := Label3D.new()
	name_l.text = "N O V A"
	name_l.font_size = 64
	name_l.pixel_size = 0.0024
	name_l.modulate = NOVA_COL * 2.2
	name_l.shaded = false
	name_l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	name_l.position = Vector3(0, 1.98, 0)
	root.add_child(name_l)
	var sub := Label3D.new()
	sub.text = "NEURAL SYNCHRONIZATION · 97%"
	sub.font_size = 32
	sub.pixel_size = 0.0018
	sub.modulate = NOVA_COL * 1.6
	sub.shaded = false
	sub.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sub.position = Vector3(0, 1.86, 0)
	root.add_child(sub)
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec3 col = vec3(0.45, 0.8, 1.0);
void fragment() {
	float rows = step(0.55, fract(UV.y * 14.0)) * step(0.15, UV.x) * step(UV.x, 0.15 + 0.75 * fract(sin(floor(UV.y * 14.0 + TIME * 2.0)) * 437.5));
	float frame = max(step(UV.x, 0.02) + step(0.98, UV.x), step(UV.y, 0.03) + step(0.97, UV.y));
	float scan = 0.6 + 0.4 * smoothstep(0.2, 0.0, abs(fract(UV.y - TIME * 0.3) - 0.5));
	ALBEDO = col * (rows * 0.55 + frame * 0.8 + 0.04) * scan;
}"""
	for k in 3:
		var p := MeshInstance3D.new()
		var qm := QuadMesh.new()
		qm.size = Vector2(0.55, 0.75)
		p.mesh = qm
		var pm := ShaderMaterial.new()
		pm.shader = sh
		pm.set_shader_parameter("col", Vector3(NOVA_COL.r, NOVA_COL.g, NOVA_COL.b))
		p.material_override = pm
		var a := -0.9 + k * 0.9
		p.position = Vector3(sin(a) * 1.0, 1.35 + (0.12 if k == 1 else 0.0), cos(a) * 0.35)
		p.rotation.y = a
		p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(p)
	var l := OmniLight3D.new()
	l.light_color = NOVA_COL
	l.light_energy = 1.4
	l.omni_range = 4.0
	l.position = Vector3(0, 1.4, 0)
	root.add_child(l)
	return root

## the stairwell on 12: a fallen slab across the door, a mother on this side, her daughter (shown later) beyond it
static func stairwell(m: Node) -> Dictionary:
	var c: Vector3 = m.HALL
	var concrete: Material = Materials.pbr("brushed_concrete", Color(0.42, 0.41, 0.42), 1.2, 0.95)
	var slab := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(3.0, 0.45, 2.4)
	slab.mesh = bm
	slab.material_override = concrete
	slab.position = c + Vector3(0.0, 1.0, -12.0)
	slab.rotation = Vector3(0.95, 0.35, 0.22)
	# rebar sticking out of the broken edge, and a purple seam of the Fracture through it
	var steel := StandardMaterial3D.new()
	steel.albedo_color = Color(0.25, 0.2, 0.18)
	steel.metallic = 0.7
	for k in 5:
		var r := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.018
		cm.bottom_radius = 0.018
		cm.height = randf_range(0.5, 1.1)
		r.mesh = cm
		r.material_override = steel
		r.position = Vector3(-1.2 + k * 0.6, 0.0, 1.2)
		r.rotation = Vector3(PI / 2 + randf_range(-0.4, 0.4), 0, randf_range(-0.3, 0.3))
		slab.add_child(r)
	var seam := MeshInstance3D.new()
	var sb := BoxMesh.new()
	sb.size = Vector3(2.4, 0.47, 0.04)
	seam.mesh = sb
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.albedo_color = Color(0.8, 0.55, 1.0)
	sm.emission_enabled = true
	sm.emission = PURPLE
	sm.emission_energy_multiplier = 3.0
	seam.material_override = sm
	seam.rotation.y = 0.3
	slab.add_child(seam)
	m.int_root.add_child(slab)
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(3.0, 2.2, 1.2)
	cs.shape = bs
	body.add_child(cs)
	body.position = c + Vector3(0, 1.1, -12.2)
	m.int_root.add_child(body)
	var bits: Array = []
	for k in 7:
		var d := MeshInstance3D.new()
		var b2 := BoxMesh.new()
		b2.size = Vector3(randf_range(0.2, 0.6), randf_range(0.1, 0.3), randf_range(0.2, 0.5))
		d.mesh = b2
		d.material_override = concrete
		d.position = c + Vector3(randf_range(-1.3, 1.3), 0.12, -11.3 + randf_range(-0.6, 0.6))
		d.rotation = Vector3(randf(), randf() * PI, randf())
		m.int_root.add_child(d)
		bits.append(d)
	m._npc("m01_mother", "f-athletic", "female", "nyx", c + Vector3(-1.05, 0, -9.6), PI * 0.85)
	m._npc("m01_child", "f-athletic", "female", "nyx", c + Vector3(0.3, 0, -12.6), 0.0)
	var child: Node3D = m._npcs.get("m01_child")
	if child:
		child.scale = Vector3.ONE * 0.62
		child.visible = false
	var mother: Node3D = m._npcs.get("m01_mother")
	if mother:
		mother.visible = false
	return { "slab": slab, "body": body, "bits": bits, "mother": mother, "child": child }

# ---------------------------------------------------------------- the shots

static func _head(m: Node) -> Vector3:
	return m.op.global_position + Vector3(0, 1.62, 0)

## 1 + 2: the city at sunrise, then the apartment
static func opening(m: Node) -> Array:
	var c: Vector3 = m.APT
	return [
		{ "dur": 9.0, "fade_in": 2.0, "music": "dawn", "music_db": -4.0,
			"pos": [Vector3(3.0, 26.0, 78.0), Vector3(1.0, 15.0, 40.0)], "look": [Vector3(-2.0, 10.0, -80.0), Vector3(-4.0, 5.0, -50.0)], "fov": [44.0, 50.0],
			"on": [[0.0, func() -> void: m._set_world(true); m._cine_cam.current = true]],
			"title": ["NEXUS CITY", "06 : 47  ·  THE LAST ORDINARY MORNING"], "title_at": 1.6, "title_for": 5.5,
			"lines": ["M01X_RADIO_01"], "line_at": 2.2 },
		{ "dur": 6.0, "pos": [Vector3(-6.0, 9.0, 34.0), Vector3(-9.5, 6.0, 8.0)], "look": [Vector3(-14.2, 8.0, -18.0), Vector3(-14.2, 14.0, -22.0)], "fov": 46.0,
			"fade_out": 0.8 },
		{ "dur": 7.5, "fade_in": 0.8,
			"on": [[0.0, func() -> void: m._set_world(false); m._cine_cam.current = true]],
			"sfx": [[0.2, "phone_alarm", -6.0]],
			"pos": [c + Vector3(6.4, 2.3, 4.4), c + Vector3(1.5, 1.9, 1.4)], "look": [c + Vector3(-1.0, 1.2, -2.0), func() -> Vector3: return _head(m)], "fov": [52.0, 44.0],
			"title": ["APARTMENT 12-04", "NEXUS CITY RESIDENCES"], "title_at": 2.2, "title_for": 4.0,
			"lines": ["M01X_RADIO_02"], "line_at": 1.6 },
		{ "dur": 4.5, "pos": [func() -> Vector3: return _head(m) + Vector3(0.9, 0.05, 1.6), func() -> Vector3: return _head(m) + Vector3(0.6, 0.1, 1.1)],
			"look": [func() -> Vector3: return _head(m), func() -> Vector3: return _head(m) + Vector3(-0.4, 0.2, -6.0)], "fov": 40.0 },
	]

## 3 + 4 + 5: the news, the disturbance, the Fracture, NOVA. `props` holds what window_cracks / sky_tear / nova_ui built
static func fracture(m: Node, props: Dictionary) -> Array:
	var c: Vector3 = m.APT
	var tv := c + Vector3(7.6, 1.6, -0.5)
	var cracks: Node3D = props.cracks
	var tear: MeshInstance3D = props.tear
	var nova: Node3D = props.nova
	var flicker := func(n: int) -> void:
		for k in n:
			for l in m.int_root.find_children("*", "OmniLight3D", true, false):
				(l as OmniLight3D).visible = k % 2 == 1
			await m.get_tree().create_timer(0.07 + randf() * 0.09).timeout
		for l in m.int_root.find_children("*", "OmniLight3D", true, false):
			(l as OmniLight3D).visible = true
	var open_tear := func() -> void:
		tear.visible = true
		var tw := m.create_tween()
		tw.tween_method(func(v: float) -> void: (tear.material_override as ShaderMaterial).set_shader_parameter("open", v), 0.0, 1.0, 2.2).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	return [
		# 3 — the news; something under it
		{ "dur": 6.0, "music": "disturb", "music_db": -9.0,
			"pos": [c + Vector3(4.3, 1.8, 0.9), c + Vector3(5.0, 1.72, 0.45)], "look": tv, "fov": [46.0, 40.0],
			"lines": ["CINE_00"], "line_at": 0.6 },
		{ "dur": 3.6, "pos": [tv + Vector3(-0.4, -0.05, 1.3), tv + Vector3(-0.5, -0.08, 1.0)], "look": [func() -> Vector3: return _head(m), func() -> Vector3: return _head(m)], "fov": 38.0,
			"sfx": [[0.0, "rumble", -2.0], [0.3, "glass_rattle", -4.0], [0.9, "flicker", -8.0]], "shake": 0.6,
			"on": [[0.8, func() -> void: flicker.call(7)], [1.2, func() -> void: cracks.visible = true]],
			"lines": ["CINE_01"], "line_at": 1.0 },
		{ "dur": 2.4, "pos": [c + Vector3(1.8, 1.5, -2.6), c + Vector3(2.2, 1.55, -3.6)], "look": c + Vector3(2.0, 1.7, -5.5), "fov": 42.0 },
		{ "dur": 5.0, "pos": [tv + Vector3(-1.4, 0.0, 0.25), tv + Vector3(-1.1, 0.0, 0.2)], "look": tv, "fov": 34.0,
			"lines": ["CINE_02"], "line_at": 0.2,
			"sfx": [[4.3, "static", -6.0]], "on": [[4.3, func() -> void: m._news_mat().set_shader_parameter("noise", 1.0)]] },
		# 4 — the Fracture: the sky splits
		{ "dur": 6.5, "music": "fracture", "music_db": -3.0,
			"pos": [c + Vector3(1.2, 1.55, -1.4), c + Vector3(0.6, 1.35, -3.4)], "look": [c + Vector3(-10.0, 30.0, -200.0), c + Vector3(-25.0, 140.0, -420.0)], "fov": [50.0, 56.0],
			"sfx": [[0.0, "tv_cut", -3.0], [1.0, "blast", 0.0], [1.1, "glass_rattle", 0.0]],
			"on": [[1.0, open_tear], [1.0, func() -> void: m._alarm_on()]], "shake": 2.2, "shake_at": 1.0, "flash": false,
			"lines": ["CINE_03"], "line_at": 2.6 },
		# 5 — NOVA
		{ "dur": 4.0, "music": "nova", "music_db": -7.0,
			"pos": [func() -> Vector3: return _head(m) + Vector3(-0.9, -0.05, 1.0), func() -> Vector3: return _head(m) + Vector3(-0.7, -0.08, 0.7)],
			"look": [func() -> Vector3: return nova.global_position + Vector3(0, 1.5, 0), func() -> Vector3: return nova.global_position + Vector3(0, 1.5, 0)], "fov": 44.0,
			"sfx": [[0.2, "surge", -8.0]], "on": [[0.3, func() -> void: nova.visible = true]],
			"lines": ["CINE_04"], "line_at": 1.0 },
		{ "dur": 2.4, "pos": func() -> Vector3: return nova.global_position + Vector3(-0.2, 1.55, 0.4), "look": func() -> Vector3: return _head(m), "fov": 36.0,
			"lines": ["CINE_05"], "line_at": 0.2 },
		{ "dur": 4.6, "pos": [func() -> Vector3: return _head(m) + Vector3(0.6, 0.0, 0.8), func() -> Vector3: return _head(m) + Vector3(0.5, 0.0, 0.6)],
			"look": func() -> Vector3: return nova.global_position + Vector3(0, 1.4, 0), "fov": 40.0,
			"lines": ["CINE_06"], "line_at": 0.2 },
		{ "dur": 2.0, "pos": func() -> Vector3: return nova.global_position + Vector3(0.3, 1.5, 0.5), "look": func() -> Vector3: return _head(m), "fov": 34.0,
			"lines": ["CINE_07"], "line_at": 0.1, "sfx": [[0.6, "rumble", -6.0]], "shake": 0.5 },
		{ "dur": 4.8, "pos": [func() -> Vector3: return nova.global_position + Vector3(0.0, 1.6, 2.6), func() -> Vector3: return nova.global_position + Vector3(0.0, 1.6, 1.8)],
			"look": func() -> Vector3: return nova.global_position + Vector3(0, 1.4, 0), "fov": 38.0,
			"lines": ["CINE_08"], "line_at": 0.2 },
		# the door buckles; purple light floods in
		{ "dur": 5.2, "pos": [c + Vector3(3.6, 1.7, -0.6), c + Vector3(3.0, 1.6, 1.0)], "look": c + Vector3(1.0, 1.25, 5.4), "fov": 46.0,
			"sfx": [[0.3, "door_buckle", 0.0], [0.4, "rumble", -4.0]], "shake": 1.0, "shake_at": 0.3,
			"on": [[0.4, func() -> void: _buckle_door(m)]],
			"lines": ["CINE_09"], "line_at": 1.6 },
		{ "dur": 4.2, "flash": true, "pos": c + Vector3(-4.0, 1.7, 3.2), "look": c + Vector3(1.0, 1.4, 5.4), "fov": 50.0,
			"title": ["THE FRACTURE", "CHAPTER ONE"], "title_at": 0.4, "title_for": 3.4, "sfx": [[0.0, "title_hit", -2.0]], "fade_out": 0.6 },
	]

static func _buckle_door(m: Node) -> void:
	var c: Vector3 = m.APT
	for n in m.int_root.get_children():
		if n is MeshInstance3D and (n as MeshInstance3D).position.distance_to(c + Vector3(1.0, 1.15, 5.42)) < 0.05:
			var tw := m.create_tween()
			tw.tween_property(n, "rotation", Vector3(0.06, 0.32, 0.05), 0.25).set_trans(Tween.TRANS_BACK)
	var l := OmniLight3D.new()
	l.light_color = PURPLE
	l.light_energy = 0.0
	l.omni_range = 8.0
	l.position = c + Vector3(1.0, 1.4, 4.9)
	m.int_root.add_child(l)
	m.create_tween().tween_property(l, "light_energy", 3.5, 0.6)

## 7 — the broken stairwell: the first power
static func first_power(m: Node, sw: Dictionary) -> Array:
	var c: Vector3 = m.HALL
	var slab: MeshInstance3D = sw.slab
	var mother: Node3D = sw.mother
	var child: Node3D = sw.child
	var blow := func() -> void:
		m._burst(m.op.global_position + Vector3(0, 1.2, -0.6), Color(0.35, 0.85, 1.0), 40)
		m._burst(slab.global_position, Color(0.65, 0.35, 1.0), 30)
		var tw := m.create_tween().set_parallel(true)
		tw.tween_property(slab, "position", slab.position + Vector3(0.4, 1.4, -2.6), 0.5).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
		tw.tween_property(slab, "rotation", slab.rotation + Vector3(1.4, 0.4, 0.6), 0.5)
		tw.chain().tween_callback(func() -> void: slab.visible = false)
		(sw.body as Node).queue_free()
		for b in sw.bits:
			var bt := m.create_tween()
			bt.tween_property(b, "position", (b as Node3D).position + Vector3(randf_range(-1.5, 1.5), randf_range(0.5, 1.8), randf_range(-2.5, -0.5)), 0.6).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	var show_mother := func() -> void:
		if mother:
			mother.visible = true
	var show_child := func() -> void:
		if child:
			child.visible = true
	var hide_them := func() -> void:
		if mother:
			mother.visible = false
		if child:
			child.visible = false
	var hands := func() -> void:
		m._burst(m.op.global_position + Vector3(0.25, 1.05, -0.3), Color(0.35, 0.85, 1.0), 10)
		m._burst(m.op.global_position + Vector3(-0.25, 1.05, -0.3), Color(0.35, 0.85, 1.0), 10)
	return [
		{ "dur": 4.0, "music": "disturb", "music_db": -10.0, "pos": [c + Vector3(1.2, 2.3, -4.0), c + Vector3(0.8, 2.0, -6.5)], "look": c + Vector3(0, 1.0, -12.0), "fov": 48.0,
			"on": [[0.0, show_mother]],
			"lines": ["M01_012", "M02_001"], "line_at": 0.4 },
		{ "dur": 3.5, "pos": [func() -> Vector3: return _head(m) + Vector3(-0.8, -0.1, -1.4), func() -> Vector3: return _head(m) + Vector3(-0.6, -0.1, -1.1)], "look": func() -> Vector3: return _head(m), "fov": 38.0,
			"lines": ["M02_002", "M02_003"], "line_at": 0.3, "sfx": [[2.0, "rumble", -6.0]], "shake": 0.4, "shake_at": 2.0 },
		{ "dur": 4.0, "music": "nova", "music_db": -9.0, "pos": [func() -> Vector3: return _head(m) + Vector3(0.7, -0.2, 1.4), func() -> Vector3: return _head(m) + Vector3(0.5, -0.3, 1.0)],
			"look": c + Vector3(0, 1.0, -12.0), "fov": 42.0,
			"lines": ["M01_013", "M02_004"], "line_at": 0.3, "on": [[3.0, hands]] },
		{ "dur": 3.0, "pos": [func() -> Vector3: return _head(m) + Vector3(0.2, -0.75, -0.7), func() -> Vector3: return _head(m) + Vector3(0.15, -0.8, -0.55)],
			"look": func() -> Vector3: return _head(m) + Vector3(0, -0.4, 0), "fov": 34.0,
			"lines": ["M02_005"], "line_at": 0.2, "sfx": [[0.4, "surge", -4.0]] },
		{ "dur": 4.5, "music": "power", "music_db": -3.0, "pos": [func() -> Vector3: return _head(m) + Vector3(0.9, -1.1, 2.0), func() -> Vector3: return _head(m) + Vector3(1.2, -0.9, 2.6)],
			"look": c + Vector3(0, 1.2, -12.0), "fov": [40.0, 50.0],
			"lines": ["M02_006"], "line_at": 0.1, "on": [[1.4, blow]], "sfx": [[1.4, "blast", -1.0]], "shake": 2.0, "shake_at": 1.4, "flash": false },
		{ "dur": 3.4, "pos": [c + Vector3(-1.6, 1.3, -9.0), c + Vector3(-1.4, 1.2, -9.6)], "look": c + Vector3(0.3, 0.8, -12.6), "fov": 40.0,
			"on": [[0.0, show_child]],
			"lines": ["M02_007", "M02_008"], "line_at": 0.5 },
		{ "dur": 3.0, "pos": [func() -> Vector3: return _head(m) + Vector3(-0.7, 0.0, -1.2), func() -> Vector3: return _head(m) + Vector3(-0.5, 0.0, -1.0)], "look": func() -> Vector3: return _head(m), "fov": 38.0,
			"lines": ["M02_009"], "line_at": 0.2 },
		{ "dur": 5.0, "pos": [c + Vector3(0.0, 2.4, -5.0), c + Vector3(0.0, 2.2, -6.6)], "look": func() -> Vector3: return _head(m), "fov": 46.0,
			"lines": ["M02_010", "M02_011"], "line_at": 0.4, "fade_out": 0.5,
			"on": [[4.2, hide_them]] },
	]

## 8 — the new world, after the Breach: the camera climbs over the changed skyline, NOVA, the title
static func new_world(m: Node) -> Array:
	var p: Vector3 = m.op.global_position
	# the reveal needs to see the skyline: the Fracture's violet haze thins as the camera climbs
	var clear := func() -> void:
		var env: Environment = m.fracture_env
		if env and env.fog_enabled:
			m.create_tween().tween_property(env, "fog_density", env.fog_density * 0.25, 6.0)
	return [
		{ "dur": 7.0, "music": "title", "music_db": -3.0, "fade_in": 0.6,
			"pos": [p + Vector3(2.4, 1.6, 3.2), p + Vector3(6.0, 9.0, 14.0)], "look": [p + Vector3(0, 1.5, 0), p + Vector3(0, 12.0, -60.0)], "fov": [46.0, 54.0],
			"lines": ["M01X_WORLD_1"], "line_at": 1.0, "on": [[0.5, clear]] },
		{ "dur": 8.0, "pos": [p + Vector3(6.0, 9.0, 14.0), Vector3(12.0, 48.0, 90.0)], "look": [p + Vector3(0, 12.0, -60.0), Vector3(-10.0, 45.0, -420.0)], "fov": [54.0, 50.0],
			"lines": ["M01X_WORLD_2", "M01X_WORLD_3"], "line_at": 1.2 },
		{ "dur": 9.0, "pos": [Vector3(12.0, 48.0, 90.0), Vector3(16.0, 58.0, 110.0)], "look": [Vector3(-10.0, 45.0, -420.0), Vector3(-10.0, 60.0, -440.0)], "fov": 50.0,
			"title": ["WORLD FRACTURE", "CHAPTER ONE  ·  COMPLETE"], "title_at": 1.4, "title_for": 6.6, "sfx": [[1.4, "title_hit", -2.0]], "fade_out": 1.2 },
	]
