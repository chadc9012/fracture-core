extends MultiMeshInstance3D
## The sidewalk crowd of the owner's Nexus City night renders (docs/reference/nexus-city-*.png): dozens of people on
## both walks, strolling, standing at the shopfronts, a few in jackets with lit trim. civilians.gd's ten walkers are full
## operator rigs (faces, collisions, scatter); this is the cheap background behind them — one MultiMesh, one draw call,
## everything moving in the vertex shader, so a phone can afford a hundred and more:
##
##   the figure   one small mesh built here (head, hair, torso, hips, jointed legs and arms, shoes, a trim strip),
##                its parts tagged in UV / UV2 (left/right leg, arms, the trim, skin) so the shader swings
##                the legs and arms round the hip and shoulder for the walk cycle and lights the trim
##   per person   CUSTOM = (phase, speed m/s, walk direction ±1, jacket index + trim); trousers and skin hash off the phase
##   the walk     z = start + speed·TIME wrapped inside the active span, faded out at the span ends; a speed of 0 is a
##                bystander who sways and looks about instead
##   room         within 2.4 m of the operator a person sidesteps toward the kerb or the shop line (uniform player)
##
## Not obstacles and not targets; street_slice.gd keeps `span` on the district's active blocks and `player` current.

const PALETTE := [Color(0.05, 0.05, 0.07), Color(0.12, 0.12, 0.16), Color(0.22, 0.2, 0.25), Color(0.4, 0.38, 0.42), Color(0.35, 0.08, 0.1),
	Color(0.06, 0.14, 0.3), Color(0.45, 0.38, 0.28), Color(0.7, 0.68, 0.72), Color(0.14, 0.2, 0.12), Color(0.38, 0.12, 0.35)]

const SHADER := """
shader_type spatial;
render_mode cull_back;
// CUSTOM0.x tags the hair
uniform vec2 span = vec2(-120.0, 120.0);   // active z range
uniform vec3 player = vec3(0.0, -100.0, 0.0);
uniform vec3 trim_a : source_color = vec3(0.2, 0.9, 1.0);
uniform vec3 trim_b : source_color = vec3(1.0, 0.25, 0.7);
uniform vec3 jackets[10];
uniform vec3 trousers[6];
uniform vec3 skins[5];
varying float trim;
varying vec3 cloth;
varying float fade;
varying float skin;
varying float part;          // 0 jacket, 1 trousers, 2 hair
varying vec3 c_jacket;
varying vec3 c_trousers;
varying vec3 c_skin;
mat3 rot_x(float a) { float c = cos(a), s = sin(a); return mat3(vec3(1, 0, 0), vec3(0, c, s), vec3(0, -s, c)); }
void vertex() {
	vec4 cd = INSTANCE_CUSTOM;
	float phase = cd.x * 6.2831;
	float speed = cd.y;
	float dir = cd.z;
	float t = TIME * speed * 1.9 + phase;            // stride frequency follows the pace
	float walking = step(0.05, speed);
	float leg = UV.x;                                 // 0 none, 0.5 left, 1 right
	float arm = UV.y;
	vec3 v = VERTEX;
	if (leg > 0.1) {
		float s = (leg > 0.75 ? 1.0 : -1.0);
		float a = sin(t) * 0.45 * s * walking;
		v = rot_x(a) * (v - vec3(0.0, 0.92, 0.0)) + vec3(0.0, 0.92, 0.0);
	}
	if (arm > 0.1) {
		float s = (arm > 0.75 ? 1.0 : -1.0);
		float a = -sin(t) * 0.35 * s * walking + (1.0 - walking) * sin(TIME * 0.7 + phase) * 0.06;
		v = rot_x(a) * (v - vec3(0.0, 1.42, 0.0)) + vec3(0.0, 1.42, 0.0);
	}
	// bob and sway
	v.y += abs(sin(t)) * 0.035 * walking;
	v.x += (1.0 - walking) * sin(TIME * 0.5 + phase) * 0.02 * v.y;
	// travel along the walk, wrapped inside the span
	vec3 origin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float len = max(span.y - span.x, 1.0);
	float z = origin.z + dir * speed * TIME;
	z = span.x + mod(z - span.x, len);
	float ends = smoothstep(span.x, span.x + 6.0, z) * (1.0 - smoothstep(span.y - 6.0, span.y, z));
	fade = ends;
	// face the way it walks (instances are built facing +z; dir -1 turns them round)
	if (dir < 0.0) { v.xz = -v.xz; }
	vec3 world = (MODEL_MATRIX * vec4(v, 1.0)).xyz;
	world.z += z - origin.z;
	// sidestep the operator
	float near = 1.0 - smoothstep(0.8, 2.4, length(vec2(origin.x - player.x, z - player.z)));
	world.x += sign(origin.x - player.x + 0.001) * near * 1.2;
	// shrink into the ground at the span ends so nobody pops
	world.y = mix(origin.y - 2.0, world.y, ends);
	VERTEX = (inverse(MODEL_MATRIX) * vec4(world, 1.0)).xyz;
	trim = UV2.x;
	skin = UV2.y;
	part = leg > 0.1 ? 1.0 : (CUSTOM0.x > 0.5 ? 2.0 : 0.0);
	int idx = int(floor(cd.w));
	float lit = fract(cd.w);
	cloth = lit > 0.6 ? trim_b : trim_a;
	trim *= step(0.25, lit);
	float hsh = fract(sin(cd.x * 91.7) * 43758.5);
	c_jacket = jackets[idx % 10];
	c_trousers = trousers[int(hsh * 6.0) % 6];
	c_skin = skins[int(fract(hsh * 7.31) * 5.0) % 5];
}
void fragment() {
	vec3 col = part > 1.5 ? vec3(0.04, 0.03, 0.03) : (part > 0.5 ? c_trousers : c_jacket);
	ALBEDO = mix(col, c_skin, skin);
	ROUGHNESS = mix(part > 0.5 && part < 1.5 ? 0.85 : 0.6, 0.5, skin);
	SPECULAR = 0.4;
	EMISSION = cloth * trim * 3.0;
}
"""

var _mat: ShaderMaterial

## build `count` people spread along both sidewalks; walk_x is the sidewalk centre from the road's middle, walk_w its width
func setup(count: int, span_lo: float, span_hi: float, walk_x: float, walk_w: float, seed := 41) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = figure()
	mm.instance_count = count
	for i in count:
		var side := -1.0 if i % 2 == 0 else 1.0
		var standing := rng.randf() < 0.22
		# standers keep to the shop line, walkers to two lanes of the walk
		var lane := walk_x + (walk_w * 0.38 if standing else rng.randf_range(-walk_w * 0.3, walk_w * 0.25)) * side
		var z := rng.randf_range(span_lo, span_hi)
		var h := rng.randf_range(0.92, 1.08)
		var dir := 1.0 if rng.randf() < 0.5 else -1.0
		var basis := Basis.from_scale(Vector3(h * rng.randf_range(0.92, 1.1), h, h))
		if standing:
			basis = Basis(Vector3.UP, rng.randf_range(0.0, TAU)) * basis
		mm.set_instance_transform(i, Transform3D(basis, Vector3(side * lane, 0.18, z)))
		# w: the jacket's palette index, plus .3 for cyan trim or .7 for magenta (about half have none)
		var trimv := 0.0 if rng.randf() < 0.5 else (0.3 if rng.randf() < 0.6 else 0.7)
		mm.set_instance_custom_data(i, Color(rng.randf(), 0.0 if standing else rng.randf_range(1.1, 1.6), dir, float(rng.randi() % PALETTE.size()) + trimv))
	multimesh = mm
	var sh := Shader.new()
	sh.code = SHADER
	_mat = ShaderMaterial.new()
	_mat.shader = sh
	_mat.set_shader_parameter("jackets", PackedVector3Array(PALETTE.map(func(c: Color) -> Vector3: return Vector3(c.r, c.g, c.b))))
	_mat.set_shader_parameter("trousers", PackedVector3Array([Vector3(0.05, 0.05, 0.06), Vector3(0.1, 0.14, 0.24), Vector3(0.2, 0.2, 0.22), Vector3(0.08, 0.08, 0.1), Vector3(0.3, 0.27, 0.22), Vector3(0.14, 0.1, 0.08)]))
	_mat.set_shader_parameter("skins", PackedVector3Array([Vector3(0.62, 0.45, 0.36), Vector3(0.42, 0.28, 0.2), Vector3(0.25, 0.16, 0.11), Vector3(0.7, 0.55, 0.45), Vector3(0.5, 0.36, 0.27)]))
	material_override = _mat
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the people travel in the shader, so the culling box covers the whole span
	custom_aabb = AABB(Vector3(-walk_x - walk_w, -1, span_lo - 10.0), Vector3((walk_x + walk_w) * 2.0, 4.0, span_hi - span_lo + 20.0))
	set_span(span_lo, span_hi)

func set_span(lo: float, hi: float) -> void:
	if _mat:
		_mat.set_shader_parameter("span", Vector2(lo, hi))
		var a := custom_aabb
		custom_aabb = AABB(Vector3(a.position.x, a.position.y, lo - 10.0), Vector3(a.size.x, a.size.y, hi - lo + 20.0))

func set_player(p: Vector3) -> void:
	if _mat:
		_mat.set_shader_parameter("player", p)

# --------------------------------------------------------------------------------------------- the figure
## one person, ~1.75 m, facing +z, feet at y 0. Each part is tagged (the Color passed to _capsule): r = leg (0.5 left,
## 1 right), g = arm (0.5 / 1), b = lit trim, a = 0 for skin (face and hands)
static func figure() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_custom_format(0, SurfaceTool.CUSTOM_RGBA8_UNORM)
	# torso (jacket), hips, neck, head, hair
	_capsule(st, Vector3(0, 1.22, 0), Vector3(0.36, 0.56, 0.22), Color(0, 0, 0, 1))
	_capsule(st, Vector3(0, 0.95, 0), Vector3(0.32, 0.18, 0.2), Color(0, 0, 0, 1))
	_capsule(st, Vector3(0, 1.55, 0), Vector3(0.1, 0.1, 0.1), Color(0, 0, 0, 0))
	_capsule(st, Vector3(0, 1.66, 0.01), Vector3(0.19, 0.23, 0.21), Color(0, 0, 0, 0))
	_capsule(st, Vector3(0, 1.72, -0.02), Vector3(0.2, 0.14, 0.2), Color(0, 0, 0, 1), true)
	# a lit strip down the jacket front and across the shoulders
	_capsule(st, Vector3(0.08, 1.24, 0.11), Vector3(0.03, 0.42, 0.02), Color(0, 0, 1, 1))
	# legs: thigh, shin, shoe, each side
	for s: float in [-1.0, 1.0]:
		var tag := Color(1.0 if s > 0.0 else 0.5, 0, 0, 1)
		_capsule(st, Vector3(s * 0.09, 0.7, 0), Vector3(0.15, 0.46, 0.16), tag)
		_capsule(st, Vector3(s * 0.09, 0.3, -0.01), Vector3(0.12, 0.44, 0.13), tag)
		_capsule(st, Vector3(s * 0.09, 0.05, 0.05), Vector3(0.11, 0.09, 0.25), tag)
	# arms: upper, fore, hand
	for s: float in [-1.0, 1.0]:
		var tag2 := Color(0, 1.0 if s > 0.0 else 0.5, 0, 1)
		_capsule(st, Vector3(s * 0.23, 1.25, 0), Vector3(0.1, 0.34, 0.11), tag2)
		_capsule(st, Vector3(s * 0.25, 0.97, 0.02), Vector3(0.085, 0.3, 0.09), tag2)
		_capsule(st, Vector3(s * 0.25, 0.79, 0.03), Vector3(0.07, 0.09, 0.08), Color(0, tag2.g, 0, 0))
	st.generate_normals()
	return st.commit()

## an ellipsoid-ish lozenge: an 8-sided, 5-ring blob with the given extents, all one tag (UV = leg, arm; UV2 = trim,
## skin), the vertex colour white so the instance colour is the clothes
static func _capsule(st: SurfaceTool, c: Vector3, size: Vector3, tag: Color, hair := false) -> void:
	const SIDES := 8
	const RINGS := 5
	var pts: Array = []
	for r in RINGS + 1:
		var v := float(r) / RINGS
		var y := (v - 0.5) * size.y
		# round the ends, keep the middle full
		var rad := sqrt(maxf(0.0, 1.0 - pow(absf(v - 0.5) * 2.0, 3.0)))
		var ring: Array = []
		for k in SIDES:
			var a := TAU * k / SIDES
			ring.append(c + Vector3(cos(a) * size.x * 0.5 * rad, y, sin(a) * size.z * 0.5 * rad))
		pts.append(ring)
	for r in RINGS:
		for k in SIDES:
			var k2 := (k + 1) % SIDES
			var a: Vector3 = pts[r][k]
			var b: Vector3 = pts[r][k2]
			var c2: Vector3 = pts[r + 1][k2]
			var d: Vector3 = pts[r + 1][k]
			for p in [a, d, c2, a, c2, b]:
				st.set_color(Color.WHITE)
				st.set_uv(Vector2(tag.r, tag.g))
				st.set_uv2(Vector2(tag.b, 1.0 - tag.a))
				st.set_custom(0, Color(1.0 if hair else 0.0, 0, 0, 0))
				st.add_vertex(p)
