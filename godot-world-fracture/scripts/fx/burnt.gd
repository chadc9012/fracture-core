extends RefCounted
## Burnt-out cars (owner, Nov 13: "the way cars looked when destroyed"). The street's wreck model (models/city/wreck.glb)
## read as a cloud of loose orange triangles, and a blown-up traffic car only went see-through grey. Now a wreck is one of
## the fleet's own cars, burnt: a soot overlay multiplies its paint down to charred black with rust and ash patches, the
## lamps are dead, it sits low on burst tyres, and a fire burns in it with smoke above.
##  - `char_car(node)` / `unchar(node)`: the soot on any car (traffic wrecks use it and wash it off when towed)
##  - `fire(scale)`: flames over a hot core and a smoke column (particles; cheap enough for the phone)
##  - `burnt_car(file, burning)`: a burnt fleet car, standing at the origin, length along z

const FLEET := "res://models/fleet/"
## the fleet cars a wreck can be (the everyday ones; the supercar and the tank never burn out on the kerb)
const WRECKS := ["muscle-car-lod.glb", "security-suv.glb", "tuner.glb", "offroad-truck.glb"]

static var _overlay: ShaderMaterial

static func char_overlay() -> ShaderMaterial:
	if _overlay:
		return _overlay
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode blend_mul, unshaded, depth_draw_never, cull_back;
varying vec3 p;
void vertex() { p = VERTEX; }
float h(vec3 q) { return fract(sin(dot(q, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 q) {
	vec3 i = floor(q); vec3 f = fract(q); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void fragment() {
	float n = n3(p * 2.5) * 0.6 + n3(p * 9.0) * 0.4;
	vec3 soot = vec3(0.16, 0.145, 0.13);
	vec3 rust = vec3(0.62, 0.34, 0.16);
	vec3 ash = vec3(0.75, 0.72, 0.68);
	vec3 c = mix(soot, rust, smoothstep(0.45, 0.7, n));
	c = mix(c, ash, smoothstep(0.74, 0.88, n) * 0.7);
	ALBEDO = c;
}
"""
	_overlay = ShaderMaterial.new()
	_overlay.shader = sh
	return _overlay

static func char_car(n: Node3D) -> void:
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).material_overlay = char_overlay()
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

static func unchar(n: Node3D) -> void:
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		if (mi as MeshInstance3D).material_overlay == _overlay:
			(mi as MeshInstance3D).material_overlay = null

static var _soft: ImageTexture
static func _soft_tex() -> ImageTexture:
	if _soft == null:
		var img := Image.create(32, 32, false, Image.FORMAT_RGBA8)
		for y in 32:
			for x in 32:
				var d := Vector2(x - 15.5, (y - 15.5) * 0.85).length() / 16.0
				img.set_pixel(x, y, Color(1, 1, 1, clampf(1.0 - d, 0.0, 1.0) ** 1.6))
		_soft = ImageTexture.create_from_image(img)
	return _soft

## flames licking up out of a burnt car, and the dark smoke column over it; `scale` 1 is a car fire
static func fire(scale := 1.0) -> Node3D:
	var root := Node3D.new()
	root.name = "Fire"
	var flame := GPUParticles3D.new()
	flame.amount = 48
	flame.lifetime = 0.8
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(0.6, 0.15, 1.2) * scale
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 12.0
	pm.initial_velocity_min = 1.0 * scale
	pm.initial_velocity_max = 2.2 * scale
	pm.gravity = Vector3(0, 1.2, 0)
	pm.scale_min = 0.7
	pm.scale_max = 1.3
	var cv := Curve.new()
	cv.add_point(Vector2(0, 0.5))
	cv.add_point(Vector2(0.3, 1.0))
	cv.add_point(Vector2(1, 0.0))
	var ct := CurveTexture.new()
	ct.curve = cv
	pm.scale_curve = ct
	var grad := Gradient.new()
	grad.set_color(0, Color(1.0, 0.85, 0.45, 1.0))
	grad.add_point(0.45, Color(1.0, 0.45, 0.1, 0.8))
	grad.set_color(grad.get_point_count() - 1, Color(0.5, 0.1, 0.02, 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	pm.color_ramp = gt
	flame.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.6, 0.8) * scale
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_texture = _soft_tex()
	q.material = m
	flame.draw_pass_1 = q
	flame.position.y = 0.7 * scale
	root.add_child(flame)
	var smoke := GPUParticles3D.new()
	smoke.amount = 36
	smoke.lifetime = 4.5
	var sp := ParticleProcessMaterial.new()
	sp.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	sp.emission_sphere_radius = 0.8 * scale
	sp.direction = Vector3(0, 1, 0)
	sp.spread = 10.0
	sp.initial_velocity_min = 1.0
	sp.initial_velocity_max = 1.6
	sp.gravity = Vector3(0.35, 0.4, 0)
	sp.scale_min = 2.0 * scale
	sp.scale_max = 3.6 * scale
	sp.scale_curve = ct
	var sg := Gradient.new()
	sg.set_color(0, Color(0.12, 0.1, 0.1, 0.55))
	sg.set_color(1, Color(0.18, 0.17, 0.18, 0.0))
	var st := GradientTexture1D.new()
	st.gradient = sg
	sp.color_ramp = st
	smoke.process_material = sp
	var sq := QuadMesh.new()
	sq.size = Vector2(1.0, 1.0)
	var smm := m.duplicate() as StandardMaterial3D
	smm.blend_mode = BaseMaterial3D.BLEND_MODE_MIX
	sq.material = smm
	smoke.draw_pass_1 = sq
	smoke.position.y = 1.6 * scale
	root.add_child(smoke)
	var glow := OmniLight3D.new()
	glow.light_color = Color(1.0, 0.5, 0.18)
	glow.light_energy = 2.2
	glow.omni_range = 7.0 * scale
	glow.position.y = 1.0
	root.add_child(glow)
	# and you hear it: a roar under crackles, from where it burns (tools/make_sfx.py "fire")
	var w: AudioStreamWAV = load("res://audio/sfx/fire.wav")
	if w:
		w = w.duplicate() as AudioStreamWAV
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = w.data.size() / 2
		var snd := AudioStreamPlayer3D.new()
		snd.name = "Crackle"
		snd.stream = w
		snd.bus = "SFX"
		snd.unit_size = 5.0 * scale
		snd.max_distance = 45.0
		snd.volume_db = -4.0
		snd.autoplay = true
		snd.position.y = 0.8
		root.add_child(snd)
	return root

## a burnt-out fleet car (no model of its own: one of the everyday cars, charred), resting on burst tyres, burning if asked
static func burnt_car(seed := 0, burning := true) -> Node3D:
	var holder := Node3D.new()
	holder.name = "BurntCar"
	var file: String = WRECKS[posmod(seed, WRECKS.size())]
	if not ResourceLoader.exists(FLEET + file):
		return holder
	var car := (load(FLEET + file) as PackedScene).instantiate() as Node3D
	holder.add_child(car)
	var StreetCar = load("res://scripts/driving/street_car.gd")
	StreetCar.face_forward(car)
	char_car(car)
	# sat down on burst tyres, listing a little
	car.position.y = -0.12
	car.rotation_degrees.z = 2.5 if seed % 2 == 0 else -2.0
	if burning:
		holder.add_child(fire(1.0))
	holder.set_meta("size", Vector3(2.0, 1.5, 4.6))
	return holder
