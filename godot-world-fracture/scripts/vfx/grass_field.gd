extends MultiMeshInstance3D
## Real grass round the camera (owner, Nov 23: "make the grass look real … fix to whole game"): clumps of tapered blades
## that sway in the wind, grown on every grassy cover of a region (meadow, grass, scrub, forest floor, crops) and kept
## off roads, paving and water. One MultiMesh: the clumps sit on a fixed jittered grid (so they never swim as you move),
## refilled when the camera has moved a few metres; past the edge of the field the blades shrink into the ground, and the
## terrain shader's grass carries on beyond. Budget from Phone (radius / spacing per tier; off on LOW).
##   var g := GrassField.new(); add_child(g); g.setup(can_grow, ground, base_col, tip_col)
## can_grow(lx, lz) -> bool and ground(lx, lz) -> float are the host's (region_3d.gd).

const Phone := preload("res://scripts/phone.gd")

var can_grow: Callable
var ground: Callable
var radius := 26.0
var spacing := 0.75
var _last := Vector3(INF, 0, INF)
var _mat: ShaderMaterial

const SHADER := """
shader_type spatial;
render_mode cull_disabled, shadows_disabled;
uniform vec3 base_col : source_color = vec3(0.12, 0.2, 0.06);
uniform vec3 tip_col : source_color = vec3(0.55, 0.62, 0.28);
uniform vec3 dry_col : source_color = vec3(0.62, 0.56, 0.3);
uniform float radius = 26.0;
uniform vec3 centre = vec3(0.0);
uniform float wind = 1.0;
varying float vh;
varying float vtint;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void vertex() {
	vec3 root = MODEL_MATRIX[3].xyz;
	vh = UV.y;
	// shrink toward the edge of the field so it melts into the painted ground
	float d = length(root.xz - centre.xz);
	float grow = 1.0 - smoothstep(radius * 0.65, radius, d);
	VERTEX.y *= grow;
	VERTEX.xz *= mix(0.4, 1.0, grow);
	// wind: gusts rolling across the field, more at the tips
	float gust = vnoise(root.xz * 0.06 + vec2(TIME * 0.35, TIME * 0.2));
	float sway = (sin(TIME * 2.1 + root.x * 0.7 + root.z * 0.5) * 0.35 + gust * 1.2) * wind;
	VERTEX.x += sway * 0.22 * vh * vh;
	VERTEX.z += sway * 0.12 * vh * vh;
	vtint = hash(root.xz) * 0.6 + vnoise(root.xz * 0.05) * 0.8;
}
void fragment() {
	vec3 c = mix(base_col, tip_col, smoothstep(0.0, 1.0, vh));
	c = mix(c, dry_col * mix(0.6, 1.0, vh), smoothstep(0.75, 1.15, vtint) * 0.7);
	c *= 0.75 + 0.4 * fract(vtint * 7.3);
	ALBEDO = c;
	ROUGHNESS = 0.75;
	SPECULAR = 0.3;
	BACKLIGHT = vec3(0.35, 0.45, 0.15) * vh;   // sun through the blades
	AO = mix(0.45, 1.0, vh);
	AO_LIGHT_AFFECT = 0.6;
}
"""

func setup(grow: Callable, ground_at: Callable, base: Color, tip: Color, dry := Color(0.62, 0.56, 0.3)) -> void:
	can_grow = grow
	ground = ground_at
	var tier := Phone.tier()
	if tier == "low":
		visible = false
		set_process(false)
		return
	radius = 34.0 if tier in ["high", "ultra"] else 24.0
	spacing = 0.62 if tier in ["high", "ultra"] else 0.8
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_mat = ShaderMaterial.new()
	_mat.shader = Shader.new()
	_mat.shader.code = SHADER
	_mat.set_shader_parameter("base_col", base)
	_mat.set_shader_parameter("tip_col", tip)
	_mat.set_shader_parameter("dry_col", dry)
	_mat.set_shader_parameter("radius", radius)
	material_override = _mat
	multimesh = MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.mesh = clump()
	multimesh.instance_count = 0
	name = "GrassField"

## five tapered blades leaning out from a point, 0.35-0.6 m tall (UV.y = height along the blade)
static func clump() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for k in 5:
		var a := k * TAU / 5.0 + 0.4 * k
		var h := 0.38 + 0.05 * ((k * 7) % 5)
		var lean := Vector3(cos(a), 0, sin(a)) * (0.08 + 0.03 * (k % 3))
		var side := Vector3(-sin(a), 0, cos(a)) * 0.022
		var off := Vector3(cos(a), 0, sin(a)) * 0.04
		var p0 := off - side
		var p1 := off + side
		var m0 := off - side * 0.6 + lean * 0.5 + Vector3(0, h * 0.55, 0)
		var m1 := off + side * 0.6 + lean * 0.5 + Vector3(0, h * 0.55, 0)
		var tip := off + lean + Vector3(0, h, 0)
		var n := Vector3(cos(a), 0.6, sin(a)).normalized()
		for v in [[p0, 0.0], [p1, 0.0], [m1, 0.55], [p0, 0.0], [m1, 0.55], [m0, 0.55], [m0, 0.55], [m1, 0.55], [tip, 1.0]]:
			st.set_normal(n)
			st.set_uv(Vector2(0.5, float(v[1])))
			st.add_vertex(v[0])
	return st.commit()

func _process(_dt: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam == null or multimesh == null:
		return
	var c := cam.global_position
	# from high up (city view, flying) the blades would be a few pixels: leave the field empty
	var g: float = ground.call(c.x, c.z)
	if c.y - g > 30.0:
		if multimesh.instance_count > 0:
			multimesh.instance_count = 0
		_last = Vector3(INF, 0, INF)
		return
	_mat.set_shader_parameter("centre", c)
	if Vector2(c.x - _last.x, c.z - _last.z).length() < radius * 0.18:
		return
	_last = c
	_fill(c)

func _fill(c: Vector3) -> void:
	var xfs: Array[Transform3D] = []
	var i0 := floori((c.x - radius) / spacing)
	var i1 := ceili((c.x + radius) / spacing)
	var j0 := floori((c.z - radius) / spacing)
	var j1 := ceili((c.z + radius) / spacing)
	var r2 := radius * radius
	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			var hsh := _hash(i, j)
			var x := (i + fmod(hsh * 13.7, 1.0)) * spacing
			var z := (j + fmod(hsh * 71.3, 1.0)) * spacing
			if (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) > r2:
				continue
			if not can_grow.call(x, z):
				continue
			var s := 0.55 + fmod(hsh * 5.1, 1.0) * 0.65
			var b := Basis(Vector3.UP, hsh * TAU).scaled(Vector3(s, s * (0.8 + fmod(hsh * 3.3, 1.0) * 0.5), s))
			xfs.append(Transform3D(b, Vector3(x, ground.call(x, z) - 0.02, z)))
	multimesh.instance_count = xfs.size()
	for k in xfs.size():
		multimesh.set_instance_transform(k, xfs[k])

static func _hash(i: int, j: int) -> float:
	var h := (i * 73856093) ^ (j * 19349663)
	h = (h ^ (h >> 13)) * 1274126177
	return float((h ^ (h >> 16)) & 0xFFFFFF) / float(0x1000000)
