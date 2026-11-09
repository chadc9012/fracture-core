extends RefCounted
## The asset catalog's VFX gaps (docs/asset-catalog.md, "Effects": rift / portal, hologram, energy field), as reusable
## nodes any scene can drop in: the region 3D views place them at their landmarks (region_flora.gd `landmark_fx`), the
## Nexus hub's RIFT GATE is a portal. Everything is shader work on primitive meshes — no textures to import — and runs
## on the mobile renderer (the energy field's ground-contact glow reads the depth buffer; gl_compatibility skips it).
##
##   portal(radius, color)       a stone-and-metal ring standing upright, a swirling vortex inside it pulling sparks in
##   hologram(kind, color, h)    a projector, its light cone and a slowly turning figure ("globe", "emblem", "figure")
##   energy_field(radius, color) a hex-plated dome with a bright rim, rising pulses and a glow where it meets the ground

# ---------------------------------------------------------------- portal

const VORTEX := """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec3 col = vec3(0.7, 0.35, 1.0);
uniform float speed = 1.0;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	if (r > 1.0) discard;
	float a = atan(p.y, p.x);
	// a spiral: the angle twisted by the radius, scrolled inward over time
	float sw = a + 3.5 / (r + 0.25) + TIME * 1.6 * speed;
	float arms = n(vec2(sw * 2.0, r * 6.0 - TIME * 2.0 * speed)) * 0.7 + n(vec2(sw * 5.0, r * 14.0 - TIME * 3.0 * speed)) * 0.3;
	float core = smoothstep(0.45, 0.0, r);
	float rim = smoothstep(0.75, 1.0, r) * smoothstep(1.0, 0.92, r);
	float body = smoothstep(1.0, 0.6, r) * (0.15 + arms * 0.75) * smoothstep(0.0, 0.5, r + arms * 0.3);
	vec3 c = col * body * 0.8 + mix(col, vec3(1.0), 0.5) * core * 0.9 + col * rim * 1.2;
	ALBEDO = c * (0.9 + 0.1 * sin(TIME * 7.0));
}"""

static func portal(radius := 2.0, col := Color(0.7, 0.35, 1.0)) -> Node3D:
	var root := Node3D.new()
	root.name = "Portal"
	# the frame: a heavy dark ring with a glowing inner lip, on two footings
	var frame := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = radius * 1.02
	tm.outer_radius = radius * 1.28
	tm.rings = 32
	tm.ring_segments = 8
	frame.mesh = tm
	frame.rotation.x = PI * 0.5
	frame.position = Vector3(0, radius * 1.15, 0)
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.11, 0.1, 0.13)
	fm.metallic = 0.6
	fm.roughness = 0.45
	fm.rim_enabled = true
	fm.rim = 0.4
	frame.material_override = fm
	root.add_child(frame)
	var lip := MeshInstance3D.new()
	var lt := TorusMesh.new()
	lt.inner_radius = radius * 0.98
	lt.outer_radius = radius * 1.05
	lt.rings = 32
	lt.ring_segments = 6
	lip.mesh = lt
	lip.rotation.x = PI * 0.5
	lip.position = frame.position
	var lm := StandardMaterial3D.new()
	lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	lm.albedo_color = col.lightened(0.3)
	lm.emission_enabled = true
	lm.emission = col
	lm.emission_energy_multiplier = 3.0
	lip.material_override = lm
	root.add_child(lip)
	for sx in [-1.0, 1.0]:
		var foot := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(radius * 0.5, radius * 0.45, radius * 0.6)
		foot.mesh = bm
		foot.position = Vector3(sx * radius * 0.85, radius * 0.18, 0)
		foot.material_override = fm
		root.add_child(foot)
	# the vortex: one quad, both faces
	var disc := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(radius * 2.0, radius * 2.0)
	disc.mesh = q
	disc.position = frame.position
	var vm := ShaderMaterial.new()
	vm.shader = _shader(VORTEX)
	vm.set_shader_parameter("col", Vector3(col.r, col.g, col.b))
	disc.material_override = vm
	disc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(disc)
	# sparks drawn into the centre
	var gp := GPUParticles3D.new()
	gp.amount = 90
	gp.lifetime = 1.6
	gp.preprocess = 1.6
	gp.local_coords = true
	gp.position = frame.position
	gp.visibility_aabb = AABB(Vector3.ONE * -radius * 2.0, Vector3.ONE * radius * 4.0)
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_RING
	pm.emission_ring_axis = Vector3(0, 0, 1)
	pm.emission_ring_radius = radius * 1.6
	pm.emission_ring_inner_radius = radius * 1.1
	pm.emission_ring_height = radius * 0.4
	pm.gravity = Vector3.ZERO
	pm.radial_accel_min = -radius * 2.2
	pm.radial_accel_max = -radius * 1.4
	pm.tangential_accel_min = radius * 0.8
	pm.tangential_accel_max = radius * 1.4
	pm.scale_min = 0.6
	pm.scale_max = 1.2
	gp.process_material = pm
	var sq := QuadMesh.new()
	sq.size = Vector2.ONE * maxf(0.06, radius * 0.025)
	var sm := StandardMaterial3D.new()
	sm.albedo_texture = _dot()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	sm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	sm.albedo_color = col.lightened(0.4)
	sq.material = sm
	gp.draw_pass_1 = sq
	root.add_child(gp)
	var light := OmniLight3D.new()
	light.light_color = col
	light.light_energy = 3.0
	light.omni_range = radius * 5.0
	light.position = frame.position + Vector3(0, 0, radius * 0.3)
	root.add_child(light)
	_dynamic(root)
	return root

# ---------------------------------------------------------------- hologram

const HOLO := """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec3 col = vec3(0.3, 0.9, 1.0);
uniform float spin = 0.4;
uniform float lines = 0.0;   // 1: draw latitude/longitude lines (the globe)
varying vec3 lp;
void vertex() {
	float a = TIME * spin;
	VERTEX.xz = mat2(vec2(cos(a), -sin(a)), vec2(sin(a), cos(a))) * VERTEX.xz;
	NORMAL.xz = mat2(vec2(cos(a), -sin(a)), vec2(sin(a), cos(a))) * NORMAL.xz;
	lp = VERTEX;
}
void fragment() {
	float fres = pow(1.0 - abs(dot(normalize(NORMAL), normalize(VIEW))), 2.0);
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float scan = 0.55 + 0.45 * smoothstep(0.3, 0.0, abs(fract(wp.y * 3.0 - TIME * 1.2) - 0.5));
	float grid = 0.0;
	if (lines > 0.5) {
		float lat = asin(clamp(normalize(lp).y, -1.0, 1.0));
		float lon = atan(lp.z, lp.x);
		grid = smoothstep(0.06, 0.0, abs(fract(lat * 3.0) - 0.5) - 0.44) + smoothstep(0.06, 0.0, abs(fract(lon * 2.0) - 0.5) - 0.44);
	}
	float flick = 0.85 + 0.15 * step(0.5, fract(sin(floor(TIME * 12.0)) * 431.7));
	float band = step(0.97, fract(wp.y * 0.6 + TIME * 0.35));   // a brighter band sweeping up now and then
	ALBEDO = col * (0.18 + fres * 1.2 + grid * 0.9 + band * 0.6) * scan * flick;
}"""

const BEAM := """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec3 col = vec3(0.3, 0.9, 1.0);
void fragment() {
	// UV.y runs down the cone: bright at the projector, gone at the top
	float edge = pow(1.0 - abs(dot(normalize(NORMAL), normalize(VIEW))), 1.5);
	float fall = smoothstep(0.0, 1.0, UV.y);
	ALBEDO = col * fall * (0.06 + edge * 0.25);
}"""

static func hologram(kind := "globe", col := Color(0.3, 0.9, 1.0), h := 3.0) -> Node3D:
	var root := Node3D.new()
	root.name = "Hologram"
	var s := h / 3.0
	var base := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.45 * s
	cm.bottom_radius = 0.6 * s
	cm.height = 0.3 * s
	cm.radial_segments = 12
	base.mesh = cm
	base.position.y = 0.15 * s
	var bm := StandardMaterial3D.new()
	bm.albedo_color = Color(0.12, 0.13, 0.16)
	bm.metallic = 0.7
	bm.roughness = 0.35
	bm.emission_enabled = true
	bm.emission = col
	bm.emission_energy_multiplier = 0.4
	base.material_override = bm
	root.add_child(base)
	var cone := MeshInstance3D.new()
	var co := CylinderMesh.new()
	co.top_radius = 1.2 * s
	co.bottom_radius = 0.25 * s
	co.height = 2.2 * s
	co.radial_segments = 16
	co.cap_top = false
	co.cap_bottom = false
	cone.mesh = co
	cone.position.y = 0.3 * s + 1.1 * s
	var cmat := ShaderMaterial.new()
	cmat.shader = _shader(BEAM)
	cmat.set_shader_parameter("col", Vector3(col.r, col.g, col.b))
	cone.material_override = cmat
	cone.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(cone)
	var fig := MeshInstance3D.new()
	var hm := ShaderMaterial.new()
	hm.shader = _shader(HOLO)
	hm.set_shader_parameter("col", Vector3(col.r, col.g, col.b))
	match kind:
		"globe":
			var sp := SphereMesh.new()
			sp.radius = 0.9 * s
			sp.height = 1.8 * s
			sp.radial_segments = 24
			sp.rings = 12
			fig.mesh = sp
			fig.position.y = 2.4 * s
			hm.set_shader_parameter("lines", 1.0)
		"figure":
			# a standing person, a little larger than life
			var st := SurfaceTool.new()
			st.begin(Mesh.PRIMITIVE_TRIANGLES)
			var body := CapsuleMesh.new()
			body.radius = 0.3 * s
			body.height = 1.5 * s
			st.append_from(body, 0, Transform3D(Basis(), Vector3(0, 0.75 * s, 0)))
			var head := SphereMesh.new()
			head.radius = 0.2 * s
			head.height = 0.4 * s
			st.append_from(head, 0, Transform3D(Basis(), Vector3(0, 1.75 * s, 0)))
			for sx in [-1.0, 1.0]:
				var arm := CapsuleMesh.new()
				arm.radius = 0.09 * s
				arm.height = 0.9 * s
				st.append_from(arm, 0, Transform3D(Basis(Vector3.BACK, sx * 0.25), Vector3(sx * 0.42 * s, 1.0 * s, 0)))
			fig.mesh = st.commit()
			fig.position.y = 0.35 * s
			hm.set_shader_parameter("spin", 0.25)
		_:
			# an emblem: two crossed rings round a core (the World Fracture shard)
			var st2 := SurfaceTool.new()
			st2.begin(Mesh.PRIMITIVE_TRIANGLES)
			for k in 2:
				var t := TorusMesh.new()
				t.inner_radius = 0.8 * s
				t.outer_radius = 0.9 * s
				t.rings = 32
				t.ring_segments = 6
				st2.append_from(t, 0, Transform3D(Basis(Vector3.RIGHT, PI * 0.5).rotated(Vector3.UP, k * PI * 0.5), Vector3.ZERO))
			var core := CylinderMesh.new()
			core.top_radius = 0.0
			core.bottom_radius = 0.4 * s
			core.height = 1.2 * s
			core.radial_segments = 4
			st2.append_from(core, 0, Transform3D(Basis(), Vector3(0, 0.3 * s, 0)))
			st2.append_from(core, 0, Transform3D(Basis(Vector3.RIGHT, PI), Vector3(0, -0.3 * s, 0)))
			fig.mesh = st2.commit()
			fig.position.y = 2.4 * s
			hm.set_shader_parameter("spin", 0.6)
	fig.material_override = hm
	fig.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(fig)
	var light := OmniLight3D.new()
	light.light_color = col
	light.light_energy = 1.2
	light.omni_range = 5.0 * s
	light.position.y = 2.0 * s
	root.add_child(light)
	_dynamic(root)
	return root

# ---------------------------------------------------------------- energy field

const FIELD := """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec3 col = vec3(0.35, 0.75, 1.0);
uniform float radius = 30.0;
uniform float contact = 1.0;   // 0 on gl_compatibility (no depth read)
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
varying vec3 lp;
void vertex() { lp = VERTEX; }
float hexd(vec2 p) {
	// distance to the nearest hex cell edge
	vec2 s = vec2(1.0, 1.7320508);
	vec2 a = mod(p, s) - s * 0.5;
	vec2 b = mod(p - s * 0.5, s) - s * 0.5;
	vec2 g = dot(a, a) < dot(b, b) ? a : b;
	vec2 q = abs(g);
	return 0.5 - max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
}
void fragment() {
	vec3 d = normalize(lp);
	// hex plates mapped over the dome (longitude x latitude), sized so a plate is ~2 m
	vec2 uvh = vec2(atan(d.z, d.x) * radius * sqrt(max(1.0 - d.y * d.y, 0.05)), asin(clamp(d.y, -1.0, 1.0)) * radius) / 3.0;
	float e = hexd(uvh);
	float line = smoothstep(0.06, 0.0, e);
	float cellid = fract(sin(dot(floor(uvh * 0.7), vec2(12.9898, 78.233))) * 43758.5453);
	float shimmer = step(0.93, fract(cellid + TIME * 0.15)) * 0.5;
	float fres = pow(1.0 - abs(dot(normalize(NORMAL), normalize(VIEW))), 2.5);
	// pulses climbing from the ground to the crown
	float pulse = smoothstep(0.05, 0.0, abs(fract(d.y * 1.5 - TIME * 0.4) - 0.5) - 0.45);
	float glow = 0.0;
	if (contact > 0.5) {
		float sd = texture(depth_tex, SCREEN_UV).r;
		vec4 sv = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, sd, 1.0);
		float gap = abs(sv.z / sv.w - VERTEX.z);
		glow = smoothstep(2.0, 0.0, gap);
	}
	float a = 0.015 + fres * 0.35 + line * (0.06 + fres * 0.4) + shimmer * 0.15 + pulse * 0.1 + glow * 0.9;
	ALBEDO = col * a;
}"""

static func energy_field(radius := 20.0, col := Color(0.35, 0.75, 1.0)) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.name = "EnergyField"
	var sp := SphereMesh.new()
	sp.radius = radius
	sp.height = radius * 2.0
	sp.radial_segments = 48
	sp.rings = 16
	sp.is_hemisphere = true
	mi.mesh = sp
	var mat := ShaderMaterial.new()
	mat.shader = _shader(FIELD)
	mat.set_shader_parameter("col", Vector3(col.r, col.g, col.b))
	mat.set_shader_parameter("radius", radius)
	mat.set_shader_parameter("contact", 0.0 if RenderingServer.get_current_rendering_method() == "gl_compatibility" else 1.0)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.set_meta("dynamic", true)
	return mi

# ---------------------------------------------------------------- shared

## a soft round dot for sparks
static var _dot_tex: GradientTexture2D
static func _dot() -> GradientTexture2D:
	if _dot_tex == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		_dot_tex = GradientTexture2D.new()
		_dot_tex.gradient = g
		_dot_tex.fill = GradientTexture2D.FILL_RADIAL
		_dot_tex.fill_from = Vector2(0.5, 0.5)
		_dot_tex.fill_to = Vector2(0.5, 0.0)
		_dot_tex.width = 32
		_dot_tex.height = 32
	return _dot_tex

static var _shaders := {}
static func _shader(code: String) -> Shader:
	if not _shaders.has(code):
		var sh := Shader.new()
		sh.code = code
		_shaders[code] = sh
	return _shaders[code]

## animated: keep scripts/static_batch.gd from merging these into the static batches
static func _dynamic(n: Node) -> void:
	n.set_meta("dynamic", true)
	for c in n.get_children():
		_dynamic(c)
