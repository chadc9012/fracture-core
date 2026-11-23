extends RefCounted
## The Neon City Grand Casino tower seen from the street (owner, Nov 9: Neon City's alone, 380 m, the second-tallest
## building; Nov 15 resort board docs/reference/nfs-night/ref-8: a rounded glass tower in gold frames, neon down every
## edge, rings of light up its height, the crown on top, lasers into the sky). Owner, Nov 22: "make the casino tower
## change colors" — every neon piece shares ONE shader material whose colour cycles violet → magenta → cyan → gold
## and back, with a pulse of light running up the strips and a slow sweep round the tower, so the whole tower changes
## together. The glass windows pick up a little of the same colour. ~8 draws for the whole tower.

const HEIGHT := 380.0
const RADIUS := 22.0
const CYCLE := 24.0          # seconds for one full colour loop

const NEON := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;
uniform float cycle = 24.0;
uniform float strength = 3.2;
uniform vec3 at = vec3(0.0);
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
vec3 palette(float t) {
	// violet, magenta, cyan, gold: the board's colours, eased between
	vec3 c0 = vec3(0.62, 0.22, 1.0);
	vec3 c1 = vec3(1.0, 0.2, 0.75);
	vec3 c2 = vec3(0.2, 0.8, 1.0);
	vec3 c3 = vec3(1.0, 0.72, 0.28);
	t = fract(t) * 4.0;
	float f = smoothstep(0.0, 1.0, fract(t));
	if (t < 1.0) return mix(c0, c1, f);
	if (t < 2.0) return mix(c1, c2, f);
	if (t < 3.0) return mix(c2, c3, f);
	return mix(c3, c0, f);
}
void fragment() {
	vec2 d = wpos.xz - at.xz;
	float ang = atan(d.y, d.x) / 6.28318;
	float t = TIME / cycle;
	vec3 c = palette(t + ang * 0.25);                                   // a slow sweep of colour round the tower
	float pulse = smoothstep(0.92, 1.0, fract(wpos.y / 380.0 - TIME * 0.18));   // light racing up the strips
	ALBEDO = c * strength * (1.0 + pulse * 1.6);
}
"""

const GLASS := """
shader_type spatial;
uniform float cycle = 24.0;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 palette(float t) {
	vec3 c0 = vec3(0.62, 0.22, 1.0); vec3 c1 = vec3(1.0, 0.2, 0.75); vec3 c2 = vec3(0.2, 0.8, 1.0); vec3 c3 = vec3(1.0, 0.72, 0.28);
	t = fract(t) * 4.0; float f = smoothstep(0.0, 1.0, fract(t));
	if (t < 1.0) return mix(c0, c1, f); if (t < 2.0) return mix(c1, c2, f); if (t < 3.0) return mix(c2, c3, f); return mix(c3, c0, f);
}
void fragment() {
	// floors 3.6 m, bays by angle round the tower; warm lit rooms, the rest dark glass tinted by the cycle
	float ang = atan(NORMAL.z, NORMAL.x);
	vec2 cell = vec2(floor(UV.x * 96.0), floor(wpos.y / 3.6));
	vec2 f = vec2(fract(UV.x * 96.0), fract(wpos.y / 3.6));
	float frame = step(0.12, f.x) * step(f.x, 0.88) * step(0.15, f.y) * step(f.y, 0.85);
	float lit = step(0.55, h(cell)) * frame;
	vec3 tint = palette(TIME / cycle);
	ALBEDO = vec3(0.02, 0.02, 0.035);
	METALLIC = 0.6;
	ROUGHNESS = 0.12;
	EMISSION = (vec3(1.0, 0.78, 0.5) * lit * (0.7 + 0.6 * h(cell + 3.3)) + tint * 0.08 * frame) * 1.4;
}
"""

## builds the tower with its foot at `at` (ground level); returns the root node
static func build(parent: Node3D, at: Vector3) -> Node3D:
	var root := Node3D.new()
	root.name = "CasinoTower"
	root.position = at
	parent.add_child(root)
	var neon := ShaderMaterial.new()
	neon.shader = Shader.new()
	neon.shader.code = NEON
	neon.set_shader_parameter("cycle", CYCLE)
	neon.set_shader_parameter("at", at)
	var glass := ShaderMaterial.new()
	glass.shader = Shader.new()
	glass.shader.code = GLASS
	glass.set_shader_parameter("cycle", CYCLE)
	var gold := StandardMaterial3D.new()
	gold.albedo_color = Color(0.95, 0.7, 0.32)
	gold.metallic = 1.0
	gold.roughness = 0.25
	gold.emission_enabled = true
	gold.emission = Color(0.95, 0.7, 0.32)
	gold.emission_energy_multiplier = 0.6
	# the glass shaft, a little narrower toward the top
	var shaft := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.bottom_radius = RADIUS
	cm.top_radius = RADIUS * 0.82
	cm.height = HEIGHT - 16.0
	cm.radial_segments = 40
	cm.rings = 1
	shaft.mesh = cm
	shaft.position = Vector3(0, (HEIGHT - 16.0) * 0.5, 0)
	shaft.material_override = glass
	root.add_child(shaft)
	# gold mullions and neon edge strips down the height: one MultiMesh each
	var bar := BoxMesh.new()
	var golds: Array[Transform3D] = []
	var strips: Array[Transform3D] = []
	var n := 16
	for k in n:
		var a := TAU * k / n
		var lean := (RADIUS - RADIUS * 0.82) / (HEIGHT - 16.0)
		var b := Basis(Vector3.UP, -a) * Basis(Vector3.FORWARD, 0.0)
		var tilt := Basis(Vector3(-sin(a), 0, cos(a)), -lean)
		var mid := Vector3(cos(a), 0, sin(a)) * (RADIUS * 0.91 + 0.35)
		var t := Transform3D((tilt * b).scaled(Vector3(0.9, HEIGHT - 16.0, 0.9)), mid + Vector3(0, (HEIGHT - 16.0) * 0.5, 0))
		if k % 2 == 0:
			strips.append(t)
		else:
			golds.append(t)
	_mm(root, bar, golds, gold)
	_mm(root, bar, strips, neon)
	# rings of light every 24 m
	var rings: Array[Transform3D] = []
	var ring := TorusMesh.new()
	ring.inner_radius = 1.0
	ring.outer_radius = 1.012
	ring.rings = 48
	ring.ring_segments = 6
	var y := 24.0
	while y < HEIGHT - 20.0:
		var r := lerpf(RADIUS, RADIUS * 0.82, y / (HEIGHT - 16.0)) + 0.5
		rings.append(Transform3D(Basis().scaled(Vector3(r, 30.0, r)), Vector3(0, y, 0)))
		y += 24.0
	_mm(root, ring, rings, neon)
	# the board's sign down the face toward the street
	var sign := Label3D.new()
	sign.text = "NEON CITY\nGRAND\nCASINO\nRESORT"
	sign.font_size = 220
	sign.pixel_size = 0.05
	sign.outline_size = 0
	sign.modulate = Color(1.0, 0.82, 0.45)
	sign.position = Vector3(RADIUS * 0.93 + 0.6, 230.0, 0)
	sign.rotation.y = PI * 0.5
	sign.shaded = false
	root.add_child(sign)
	# the crown: a ring band and five points with jewels, in gold edged with the cycling neon
	var top := HEIGHT - 16.0
	var band := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = RADIUS * 0.86
	bm.bottom_radius = RADIUS * 0.82
	bm.height = 6.0
	bm.radial_segments = 40
	band.mesh = bm
	band.position = Vector3(0, top + 3.0, 0)
	band.material_override = gold
	root.add_child(band)
	var spike := CylinderMesh.new()
	spike.top_radius = 0.0
	spike.bottom_radius = 3.2
	spike.height = 1.0
	spike.radial_segments = 4
	var spikes: Array[Transform3D] = []
	var jewels: Array[Transform3D] = []
	for k in 10:
		var a := TAU * k / 10.0
		var hh := 12.0 if k % 2 == 0 else 8.0
		var p := Vector3(cos(a), 0, sin(a)) * RADIUS * 0.82
		spikes.append(Transform3D(Basis().scaled(Vector3(1, hh, 1)), p + Vector3(0, top + 6.0 + hh * 0.5, 0)))
		jewels.append(Transform3D(Basis().scaled(Vector3.ONE * 1.4), p + Vector3(0, top + 6.0 + hh + 0.6, 0)))
	_mm(root, spike, spikes, gold)
	var ball := SphereMesh.new()
	ball.radius = 1.0
	ball.height = 2.0
	ball.radial_segments = 8
	ball.rings = 4
	_mm(root, ball, jewels, neon)
	var lip := TorusMesh.new()
	lip.inner_radius = 1.0
	lip.outer_radius = 1.02
	lip.rings = 48
	lip.ring_segments = 6
	_mm(root, lip, [Transform3D(Basis().scaled(Vector3(RADIUS * 0.87, 40.0, RADIUS * 0.87)), Vector3(0, top + 6.0, 0)), Transform3D(Basis().scaled(Vector3(RADIUS * 0.84, 40.0, RADIUS * 0.84)), Vector3(0, top, 0))] as Array[Transform3D], neon)
	# light the street below in the tower's colour (one light, its colour follows the cycle in step())
	var glow := OmniLight3D.new()
	glow.position = Vector3(RADIUS + 6.0, 18.0, 0)
	glow.omni_range = 60.0
	glow.light_energy = 2.0
	glow.shadow_enabled = false
	glow.name = "CycleLight"
	root.add_child(glow)
	root.set_meta("cycle_light", glow)
	return root

## keep the street light under the tower in step with the neon (call every frame with the scene's clock)
static func step(root: Node3D, t: float) -> void:
	if root == null or not root.has_meta("cycle_light"):
		return
	var l: OmniLight3D = root.get_meta("cycle_light")
	l.light_color = palette(t / CYCLE)

## the same palette as the shader, for the light
static func palette(t: float) -> Color:
	var cs := [Color(0.62, 0.22, 1.0), Color(1.0, 0.2, 0.75), Color(0.2, 0.8, 1.0), Color(1.0, 0.72, 0.28)]
	var x := fposmod(t, 1.0) * 4.0
	var i := int(x)
	var f := smoothstep(0.0, 1.0, x - i)
	return (cs[i] as Color).lerp(cs[(i + 1) % 4], f)

static func _mm(root: Node3D, mesh: Mesh, xfs: Array[Transform3D], mat: Material) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xfs.size()
	for i in xfs.size():
		mm.set_instance_transform(i, xfs[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)
