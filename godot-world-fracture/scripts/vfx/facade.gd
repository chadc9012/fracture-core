extends RefCounted
## A tower facade for skyline boxes: a grid of glass windows in world space (floors 3.4 m, bays 2.4 m), some lit warm or
## cool, mullions and floor slabs, a sky-tinted sheen on the glass that grows toward grazing angles. One material for a
## whole skyline, so the boxes merge into a single mesh (MeshMerge with a large cell) and cost one draw on the phone.
##
##   var mat := Facade.material({"lit": 0.35, "glass": Color(...), "frame": Color(...)})
## `lit` is the share of lit windows (dusk 0.3, night 0.6, day 0.05); `glow` their brightness.

const SHADER := """
shader_type spatial;
render_mode cull_back;
uniform vec3 frame_color : source_color = vec3(0.16, 0.17, 0.2);
uniform vec3 glass_color : source_color = vec3(0.12, 0.18, 0.26);
uniform vec3 sky_tint : source_color = vec3(0.95, 0.75, 0.55);
uniform vec3 warm : source_color = vec3(1.0, 0.78, 0.48);
uniform vec3 cool : source_color = vec3(0.55, 0.8, 1.0);
uniform float lit = 0.3;
uniform float glow = 2.2;
uniform float floor_h = 3.4;
uniform float bay_w = 2.4;
varying vec3 wpos;
varying vec3 wnorm;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnorm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	if (abs(wnorm.y) > 0.6) {
		// roofs: dark membrane with a little plant
		ALBEDO = frame_color * 0.8;
		ROUGHNESS = 0.9;
	} else {
		float u = abs(wnorm.x) > abs(wnorm.z) ? wpos.z : wpos.x;
		vec2 cell = vec2(u / bay_w, wpos.y / floor_h);
		vec2 f = fract(cell);
		vec2 id = floor(cell);
		float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.3, f.y) * step(f.y, 0.86);
		// a vertical fin every other bay and a darker band every floor slab: depth without geometry
		float fin = step(0.94, fract(cell.x * 0.5));
		float side = dot(wnorm, vec3(0.3, 0.0, 0.7));
		float h = hash(vec3(id, floor(side * 4.0) + floor(wpos.x * 0.02) * 7.0 + floor(wpos.z * 0.02) * 13.0));
		float on = step(1.0 - lit, h) * win;
		vec3 light = mix(warm, cool, step(0.7, fract(h * 13.7)));
		// glass: dark with the sky's sheen, stronger at grazing angles (the Fresnel look of a curtain wall)
		float fres = pow(1.0 - clamp(dot(normalize(VIEW), NORMAL), 0.0, 1.0), 3.0);
		vec3 glass = mix(glass_color, sky_tint * 0.7, fres * 0.8 + 0.08);
		ALBEDO = mix(frame_color * (1.0 - fin * 0.4), glass, win);
		ROUGHNESS = mix(0.75, 0.12, win);
		METALLIC = win * 0.3;
		EMISSION = light * on * glow * (0.6 + 0.4 * fract(h * 7.3));
	}
}
"""

static var _shader: Shader

static func material(o := {}) -> ShaderMaterial:
	if _shader == null:
		_shader = Shader.new()
		_shader.code = SHADER
	var m := ShaderMaterial.new()
	m.shader = _shader
	m.set_shader_parameter("frame_color", o.get("frame", Color(0.16, 0.17, 0.2)))
	m.set_shader_parameter("glass_color", o.get("glass", Color(0.12, 0.18, 0.26)))
	m.set_shader_parameter("sky_tint", o.get("sky", Color(0.95, 0.75, 0.55)))
	m.set_shader_parameter("lit", o.get("lit", 0.3))
	m.set_shader_parameter("glow", o.get("glow", 2.2))
	if o.has("cool"):
		m.set_shader_parameter("cool", o.cool)
	return m

## a ring of towers (boxes with setback crowns) round `centre`, merged into one mesh under `parent`
static func skyline(parent: Node3D, centre: Vector3, r_min: float, r_max: float, count: int, mat: Material, seed := 7, arc := TAU, arc_from := 0.0, h_min := 50.0, h_max := 170.0) -> MeshInstance3D:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for k in count:
		var a := arc_from + arc * (k + rng.randf_range(0.0, 0.9)) / count
		var r := rng.randf_range(r_min, r_max)
		var w := rng.randf_range(16.0, 34.0)
		var d := rng.randf_range(16.0, 34.0)
		var h := rng.randf_range(h_min, h_max) * (1.0 if rng.randf() < 0.8 else 1.6)
		var base := centre + Vector3(cos(a) * r, 0, sin(a) * r)
		var yaw := rng.randf() * TAU
		_box(st, base, Vector3(w, h, d), yaw)
		# setbacks: one or two narrower tiers on top
		var tiers := rng.randi_range(0, 2)
		var y := h
		for t in tiers:
			w *= rng.randf_range(0.6, 0.8)
			d *= rng.randf_range(0.6, 0.8)
			var th := rng.randf_range(10.0, 35.0)
			_box(st, base + Vector3(0, y, 0), Vector3(w, th, d), yaw)
			y += th
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

static func _box(st: SurfaceTool, base: Vector3, size: Vector3, yaw: float) -> void:
	var b := Basis(Vector3.UP, yaw)
	var hx := size.x * 0.5
	var hz := size.z * 0.5
	var c := [Vector3(-hx, 0, -hz), Vector3(hx, 0, -hz), Vector3(hx, 0, hz), Vector3(-hx, 0, hz)]
	var p := []
	for v in c:
		p.append(base + b * v)
	for v in c:
		p.append(base + b * v + Vector3(0, size.y, 0))
	# four walls and the roof (no floor), wound to face outward
	var faces := [[0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0], [4, 7, 6, 5]]
	for f in faces:
		var q: Array = f
		st.add_vertex(p[q[0]]); st.add_vertex(p[q[1]]); st.add_vertex(p[q[2]])
		st.add_vertex(p[q[0]]); st.add_vertex(p[q[2]]); st.add_vertex(p[q[3]])
