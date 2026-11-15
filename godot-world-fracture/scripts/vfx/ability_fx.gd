extends RefCounted
## Ability visuals (owner, Nov 15: "the abilities look like shit — think Destiny, Ready Player One with a splash of
## anime"). Three looks in one: a Destiny super — the body lights up in its element while the charge gathers, then a
## shockwave with a hard rim, a pillar of light and a scorched glyph on the ground; Ready Player One's holographic
## grid — the pillar and the ring carry scanlines and the debris is neon voxels; anime's impact — a two-frame flash,
## radial speed lines, an impact star, a hit-stop. Everything is unshaded additive geometry, a shader or a
## GPUParticles3D, so the mobile renderer draws it in a handful of calls.
##   charge(rig, seconds, col)                    the wind-up: a rim-lit body shell and an orb gathering at the chest
##   blast(parent, at, radius, col, col2, ui, shake)   the release
##   dash(parent, rig, dir, col, ui)                   afterimages, a streak, speed lines
## `ui` is a Control to draw the flash and speed lines on (null skips them); `shake` a Callable(strength).

const RIM := "shader_type spatial; render_mode unshaded, blend_add, cull_disabled, depth_draw_never;
uniform vec4 col : source_color = vec4(0.4, 0.9, 1.0, 1.0); uniform float power = 1.0; uniform float width = 2.0;
void fragment() { float f = pow(1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0), width);
	float scan = 0.75 + 0.25 * sin(VERTEX.y * 60.0 + TIME * 24.0); float m = (0.3 + f) * power * scan; ALBEDO = col.rgb * m * 2.0; ALPHA = clamp(m, 0.0, 1.0); }"

const RING := "shader_type spatial; render_mode unshaded, blend_add, cull_disabled, depth_draw_never;
uniform vec4 col : source_color; uniform vec4 col2 : source_color; uniform float k = 0.0;
void fragment() { float r = length(UV - vec2(0.5)) * 2.0; float rim = smoothstep(0.78, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
	float body = smoothstep(0.55, 0.95, r) * 0.12; float scan = 0.6 + 0.4 * step(0.5, fract(r * 26.0 - TIME * 6.0));
	vec3 c = mix(col2.rgb, col.rgb, rim); float a = (rim * 3.0 + body * scan) * (1.0 - k); ALBEDO = c * a; ALPHA = clamp(a, 0.0, 1.0); }"

const PILLAR := "shader_type spatial; render_mode unshaded, blend_add, cull_disabled, depth_draw_never;
uniform vec4 col : source_color; uniform float k = 0.0;
void fragment() { float scan = 0.55 + 0.45 * step(0.5, fract(UV.y * 40.0 - TIME * 9.0)); float grid = 0.7 + 0.3 * step(0.92, fract(UV.x * 24.0));
	float fade = (1.0 - UV.y) * (1.0 - k); ALBEDO = col.rgb * scan * grid * fade * 1.2; ALPHA = fade * 0.7; }"

const GLYPH := "shader_type spatial; render_mode unshaded, blend_add, cull_disabled;
uniform vec4 col : source_color; uniform float k = 0.0;
void fragment() { vec2 p = UV - vec2(0.5); float r = length(p) * 2.0; float a = atan(p.y, p.x);
	float spokes = step(0.86, abs(sin(a * 6.0))) * step(0.25, r) * step(r, 0.92);
	float rings = step(0.93, abs(sin(r * 18.0))) * step(r, 0.95);
	float cracks = step(0.9, fract(sin(floor(a * 24.0) * 12.9898 + floor(r * 9.0) * 78.233) * 43758.5453)) * step(r, 0.9);
	float m = max(max(spokes, rings), cracks) * (1.0 - k) * (0.55 + 0.3 * sin(TIME * 9.0)); ALBEDO = col.rgb * m * 0.9; ALPHA = m * 0.8; }"

static var _shaders: Dictionary = {}

static func _shader(code: String) -> Shader:
	if not _shaders.has(code):
		var s := Shader.new()
		s.code = code
		_shaders[code] = s
	return _shaders[code]

static func _mat(code: String, params: Dictionary) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader(code)
	for k in params:
		m.set_shader_parameter(k, params[k])
	return m

static func _add(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = c
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

static func _free_later(n: Node, secs: float) -> void:
	if n.get_tree():
		n.get_tree().create_timer(secs).timeout.connect(n.queue_free)
	else:
		n.queue_free()

# ---------------------------------------------------------------------------------------------- the charge
## the body lights up in its element (a Fresnel shell over every skinned mesh, scanlined) while an orb gathers at the
## chest from a ring of motes; both die with the release
static func charge(rig: Node3D, seconds: float, col: Color) -> Node3D:
	var root := Node3D.new()
	root.name = "Charge"
	rig.add_child(root)
	var rim := _mat(RIM, { "col": col, "power": 0.0, "width": 2.2 })
	for ch in rig.find_children("*", "MeshInstance3D", true, false):
		var mi := ch as MeshInstance3D
		if mi.mesh == null or mi.get_parent() == null:
			continue
		var shell := MeshInstance3D.new()
		shell.mesh = mi.mesh
		shell.skeleton = mi.skeleton
		shell.skin = mi.skin
		shell.material_override = rim
		shell.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.get_parent().add_child(shell)
		shell.transform = mi.transform
		shell.set_meta("charge_shell", true)
		_free_later(shell, seconds + 0.35)
	var tw := root.create_tween()
	tw.tween_method(func(v: float) -> void: rim.set_shader_parameter("power", v), 0.0, 1.6, seconds)
	tw.tween_method(func(v: float) -> void: rim.set_shader_parameter("power", v), 1.6, 0.0, 0.3)
	# the orb: a core that grows and brightens, motes pulled in from a 1.5 m ring
	var orb := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.08
	sm.height = 0.16
	sm.radial_segments = 12
	sm.rings = 6
	orb.mesh = sm
	orb.material_override = _add(Color(col.r, col.g, col.b, 0.9))
	orb.position = Vector3(0, 1.25, 0.25)
	root.add_child(orb)
	orb.scale = Vector3.ONE * 0.2
	var tw2 := orb.create_tween()
	tw2.tween_property(orb, "scale", Vector3.ONE * 2.6, seconds).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	var light := OmniLight3D.new()
	light.light_color = col
	light.omni_range = 5.0
	light.light_energy = 0.0
	light.position = orb.position
	root.add_child(light)
	root.create_tween().tween_property(light, "light_energy", 6.0, seconds)
	var motes := GPUParticles3D.new()
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE_SURFACE
	pm.emission_sphere_radius = 1.5
	pm.radial_velocity_min = -4.0
	pm.radial_velocity_max = -2.5
	pm.gravity = Vector3.ZERO
	pm.scale_min = 0.5
	pm.scale_max = 1.0
	pm.color = col
	motes.process_material = pm
	var qm := QuadMesh.new()
	qm.size = Vector2(0.06, 0.06)
	motes.draw_pass_1 = qm
	motes.material_override = _add(col)
	(motes.material_override as StandardMaterial3D).billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	motes.amount = 48
	motes.lifetime = 0.5
	motes.explosiveness = 0.1
	motes.position = orb.position
	root.add_child(motes)
	motes.emitting = true
	_free_later(root, seconds + 0.1)
	return root

# ---------------------------------------------------------------------------------------------- the blast
## the release: the shockwave (a flat ring with a hard rim and scanlines), the pillar, the glyph on the ground, neon
## voxel debris, a two-frame flash with speed lines and an impact star on the screen, a hit-stop and a kick
static func blast(parent: Node3D, at: Vector3, radius: float, col: Color, col2: Color, ui: Control, shake: Callable) -> void:
	var ground := at - Vector3(0, 0.95, 0)
	# the shockwave
	var ring := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(2, 2)
	ring.mesh = pm
	var rm := _mat(RING, { "col": col, "col2": col2, "k": 0.0 })
	ring.material_override = rm
	parent.add_child(ring)
	ring.global_position = ground + Vector3(0, 0.08, 0)
	ring.scale = Vector3.ONE * 0.3
	var tw := ring.create_tween()
	tw.tween_property(ring, "scale", Vector3.ONE * radius * 1.35, 0.42).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_method(func(v: float) -> void: rm.set_shader_parameter("k", v), 0.0, 1.0, 0.5)
	_free_later(ring, 0.6)
	# a second, taller wave a beat later (anime's double hit)
	var ring2 := MeshInstance3D.new()
	ring2.mesh = pm
	var rm2 := _mat(RING, { "col": col2, "col2": col, "k": 0.0 })
	ring2.material_override = rm2
	parent.add_child(ring2)
	ring2.global_position = ground + Vector3(0, 0.9, 0)
	ring2.scale = Vector3.ONE * 0.2
	var tw2 := ring2.create_tween()
	tw2.tween_interval(0.08)
	tw2.tween_property(ring2, "scale", Vector3.ONE * radius * 0.9, 0.36).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tw2.parallel().tween_method(func(v: float) -> void: rm2.set_shader_parameter("k", v), 0.0, 1.0, 0.4)
	_free_later(ring2, 0.6)
	# the pillar
	var pillar := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 1.0
	cm.bottom_radius = 1.0
	cm.height = 1.0
	cm.radial_segments = 20
	cm.rings = 1
	cm.cap_top = false
	cm.cap_bottom = false
	pillar.mesh = cm
	var plm := _mat(PILLAR, { "col": col, "k": 0.0 })
	pillar.material_override = plm
	parent.add_child(pillar)
	pillar.global_position = ground + Vector3(0, 7.0, 0)
	pillar.scale = Vector3(0.2, 14.0, 0.2)
	var tw3 := pillar.create_tween()
	tw3.tween_property(pillar, "scale", Vector3(radius * 0.22, 14.0, radius * 0.22), 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw3.tween_method(func(v: float) -> void: plm.set_shader_parameter("k", v), 0.0, 1.0, 0.55)
	_free_later(pillar, 0.8)
	# the glyph scorched into the ground, lingering
	var glyph := MeshInstance3D.new()
	glyph.mesh = pm
	var gm := _mat(GLYPH, { "col": col2.lerp(col, 0.5), "k": 0.0 })
	glyph.material_override = gm
	parent.add_child(glyph)
	glyph.global_position = ground + Vector3(0, 0.04, 0)
	glyph.scale = Vector3.ONE * radius * 0.9
	var tw4 := glyph.create_tween()
	tw4.tween_interval(1.6)
	tw4.tween_method(func(v: float) -> void: gm.set_shader_parameter("k", v), 0.0, 1.0, 1.2)
	_free_later(glyph, 3.0)
	# neon voxels out of the centre, falling
	var vox := GPUParticles3D.new()
	var ppm := ParticleProcessMaterial.new()
	ppm.direction = Vector3(0, 1, 0)
	ppm.spread = 70.0
	ppm.initial_velocity_min = 7.0
	ppm.initial_velocity_max = 14.0
	ppm.gravity = Vector3(0, -18.0, 0)
	ppm.angular_velocity_min = -360.0
	ppm.angular_velocity_max = 360.0
	ppm.scale_min = 0.6
	ppm.scale_max = 1.4
	ppm.color = col.lerp(Color.WHITE, 0.3)
	vox.process_material = ppm
	var bm := BoxMesh.new()
	bm.size = Vector3(0.07, 0.07, 0.07)
	vox.draw_pass_1 = bm
	vox.material_override = _add(col)
	vox.amount = 60
	vox.lifetime = 0.9
	vox.one_shot = true
	vox.explosiveness = 1.0
	parent.add_child(vox)
	vox.global_position = ground + Vector3(0, 0.3, 0)
	vox.emitting = true
	_free_later(vox, 1.2)
	# the light
	var fl := OmniLight3D.new()
	fl.light_color = col
	fl.omni_range = radius * 2.5
	fl.light_energy = 14.0
	parent.add_child(fl)
	fl.global_position = at
	fl.create_tween().tween_property(fl, "light_energy", 0.0, 0.5)
	_free_later(fl, 0.6)
	# the screen: flash, speed lines, impact star; the hit-stop; the kick
	if ui:
		_impact_frame(ui, col, col2)
	hit_stop(parent, 0.11, 0.25)
	if shake.is_valid():
		shake.call(1.0)

## anime's impact frame on the screen: white then the element for a frame each, radial speed lines from the centre
## for a quarter second, a jagged impact star that pops and goes
static func _impact_frame(ui: Control, col: Color, col2: Color) -> void:
	var flash := ColorRect.new()
	flash.color = Color(1, 1, 1, 0.85)
	flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(flash)
	var tw := flash.create_tween()
	tw.tween_interval(0.03)
	tw.tween_property(flash, "color", Color(col.r, col.g, col.b, 0.5), 0.03)
	tw.tween_property(flash, "color", Color(col2.r, col2.g, col2.b, 0.0), 0.16)
	tw.tween_callback(flash.queue_free)
	var lines := SpeedLines.new()
	lines.col = col
	lines.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	lines.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(lines)
	lines.create_tween().tween_property(lines, "k", 1.0, 0.28).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_free_later(lines, 0.3)
	var star := ImpactStar.new()
	star.col = col
	star.col2 = col2
	star.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	star.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(star)
	star.create_tween().tween_property(star, "k", 1.0, 0.22).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_OUT)
	_free_later(star, 0.24)

## a hit-stop: the world at `scale` speed for `secs` of real time (anime's frozen hit), then back
static func hit_stop(n: Node, secs: float, scale: float) -> void:
	var tree := n.get_tree()
	if tree == null or Engine.time_scale < 1.0:
		return
	Engine.time_scale = scale
	tree.create_timer(secs, true, false, true).timeout.connect(func(): Engine.time_scale = 1.0)

# ---------------------------------------------------------------------------------------------- the dash
## the dash: three afterimages of the body left behind along the way (the rig's meshes in the element's rim shader,
## each fading over a third of a second), a streak, a short speed-line burst
static func dash(parent: Node3D, rig: Node3D, dir: Vector3, col: Color, ui: Control) -> void:
	# three afterimages, each left where the body is as it goes (the chase camera follows the body, so one left at
	# the start would sit in the camera's face; spaced over the dash they trail across the frame)
	for i in 3:
		var tree := parent.get_tree()
		if i == 0 or tree == null:
			_ghost(parent, rig, col)
		else:
			tree.create_timer(0.06 * i).timeout.connect(func(): if is_instance_valid(rig) and is_instance_valid(parent): _ghost(parent, rig, col))
	# the streak: a stretched quad along the dash, additive, gone in a quarter second
	var streak := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(0.5, 5.0)
	streak.mesh = qm
	var sm := _add(Color(col.r, col.g, col.b, 0.7))
	streak.material_override = sm
	parent.add_child(streak)
	streak.global_position = rig.global_position + Vector3(0, 1.0, 0) - dir * 2.0
	streak.look_at(streak.global_position + dir, Vector3.UP)
	streak.rotate_object_local(Vector3.RIGHT, PI * 0.5)
	var tw2 := streak.create_tween()
	tw2.tween_property(streak, "global_position", streak.global_position + dir * 4.0, 0.22)
	tw2.parallel().tween_property(sm, "albedo_color:a", 0.0, 0.22)
	tw2.tween_callback(streak.queue_free)
	if ui:
		var lines := SpeedLines.new()
		lines.col = col
		lines.k = 0.4
		lines.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		lines.mouse_filter = Control.MOUSE_FILTER_IGNORE
		ui.add_child(lines)
		lines.create_tween().tween_property(lines, "k", 1.0, 0.22)
		_free_later(lines, 0.24)

## one afterimage: the body's meshes in this frame's pose, in the element's rim, fading over half a second
static func _ghost(parent: Node3D, rig: Node3D, col: Color) -> void:
	var m := _mat(RIM, { "col": col, "power": 1.2, "width": 1.4 })
	var ghost := _snapshot(rig, m)
	if ghost == null:
		return
	parent.add_child(ghost)
	ghost.global_transform = rig.global_transform
	var tw := ghost.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("power", v), 1.2, 0.0, 0.5)
	tw.tween_callback(ghost.queue_free)

## a frozen copy of the rig's visible meshes (the skinned pose as it stands this frame, baked by the renderer's
## skeleton: the copy keeps the skeleton binding, so it moves with the rig until it is reparented — it is placed and
## left at once, so the pose is the dash's first frame)
static func _snapshot(rig: Node3D, mat: Material) -> Node3D:
	var root := Node3D.new()
	var any := false
	for ch in rig.find_children("*", "MeshInstance3D", true, false):
		var mi := ch as MeshInstance3D
		if mi.mesh == null or mi.has_meta("charge_shell") or mi.has_meta("ghost"):
			continue
		var copy := MeshInstance3D.new()
		# a skinned mesh is baked in this frame's pose (its own local space); a rigid one is used as it is. The bake
		# needs the skin registered with the renderer (a drawn frame): without one (headless) there is no afterimage
		# rather than a rest-pose one
		if mi.skeleton != NodePath("") and mi.get_node_or_null(mi.skeleton) != null:
			var baked: Mesh = mi.bake_mesh_from_current_skeleton_pose()
			if baked == null or baked.get_surface_count() == 0:
				copy.free()
				continue
			copy.mesh = baked
		else:
			copy.mesh = mi.mesh
		copy.set_meta("ghost", true)
		copy.material_override = mat
		copy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(copy)
		copy.transform = rig.global_transform.affine_inverse() * mi.global_transform
		any = true
	if not any:
		root.free()
		return null
	return root

# ---------------------------------------------------------------------------------------------- screen pieces
class SpeedLines extends Control:
	var col := Color(0.4, 0.9, 1.0)
	var k := 0.0:
		set(v):
			k = v
			queue_redraw()
	func _draw() -> void:
		var c := size * 0.5
		var n := 44
		var r_out := size.length() * 0.6
		for i in n:
			var a := TAU * (float(i) + 0.37 * sin(float(i) * 3.1)) / n
			var inner := r_out * (0.18 + 0.5 * k + 0.08 * sin(float(i) * 7.0))
			var outer := r_out * (0.6 + 0.4 * k)
			var w := 3.0 * (1.0 - k) + 0.5
			draw_line(c + Vector2(cos(a), sin(a)) * inner, c + Vector2(cos(a), sin(a)) * outer, Color(col.r, col.g, col.b, (1.0 - k) * 0.85), w)

class ImpactStar extends Control:
	var col := Color(0.4, 0.9, 1.0)
	var col2 := Color(0.8, 0.4, 1.0)
	var k := 0.0:
		set(v):
			k = v
			queue_redraw()
	func _draw() -> void:
		var c := size * 0.5
		var r := size.x * (0.08 + 0.3 * k)
		var pts := PackedVector2Array()
		for i in 16:
			var a := TAU * i / 16.0 - PI * 0.5
			var rr := r if i % 2 == 0 else r * (0.38 + 0.1 * sin(float(i) * 5.0))
			pts.append(c + Vector2(cos(a), sin(a)) * rr)
		var a_out := (1.0 - k)
		draw_colored_polygon(pts, Color(1, 1, 1, a_out * 0.9))
		draw_polyline(pts + PackedVector2Array([pts[0]]), Color(col.r, col.g, col.b, a_out), 4.0)
		draw_polyline(pts + PackedVector2Array([pts[0]]), Color(col2.r, col2.g, col2.b, a_out * 0.7), 9.0)
