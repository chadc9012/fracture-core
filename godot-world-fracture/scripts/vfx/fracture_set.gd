extends RefCounted
## The asset catalog's fantasy & dimensional set (docs/asset-catalog.md part 2 §9), as builders any scene drops in: the
## Rift Gate's boss arena and the Stitched Neon Core use them, the Shattered Expanse regions can. Procedural meshes and
## one small shader — nothing to import — sized for the phone (the crystals and pillars are one MultiMesh each, the
## shards a handful of nodes that drift).
##
##   crystals(parent, center, radius, count, color, rng)   a field of emissive prism clusters on the ground
##   floating_ruins(parent, center, radius, count, rng)    broken slabs and pillar stumps hanging in the air, drifting
##   conduit(parent, from, to, color)                      an energy conduit: a dark sheath with a scrolling glow core
##   relic_container(parent, at, color)                    a sealed relic case ringed with glowing inscriptions
##   arena_ring(parent, center, radius, color, rng, ground) boss arena structures: a ring of broken pillars, crystals
##                                                         between them, conduits running to the centre, ruins above

const GLOW := """shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, shadows_disabled;
uniform vec3 col = vec3(0.6, 0.3, 1.0);
uniform float speed = 1.0;
float h(float p) { return fract(sin(p * 127.1) * 43758.5453); }
void fragment() {
	float t = UV.y * 6.0 - TIME * speed;
	float pulse = smoothstep(0.35, 0.0, abs(fract(t) - 0.5)) * 0.8 + 0.25;
	float seg = h(floor(t)) * 0.4 + 0.6;
	ALBEDO = col * pulse * seg;
	ALPHA = 0.85;
}
"""

const GLYPHS := """shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;
uniform vec3 col = vec3(1.0, 0.8, 0.4);
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void fragment() {
	// a band of glyph-like cells, each lit on its own slow clock
	vec2 cell = floor(vec2(UV.x * 28.0, UV.y * 3.0));
	vec2 f = fract(vec2(UV.x * 28.0, UV.y * 3.0));
	float on = step(0.35, h(cell));
	float mark = step(0.2, f.x) * step(f.x, 0.8) * step(0.2, f.y) * step(f.y, 0.8);
	float blink = 0.55 + 0.45 * sin(TIME * (0.6 + h(cell + 7.0) * 1.2) + h(cell) * 6.28);
	ALBEDO = col * on * mark * blink;
	ALPHA = on * mark;
}
"""

static func _mat(c: Color, rough := 0.7, metal := 0.1, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

static func _shader(code: String, col: Color, speed := 1.0) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = code
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("col", Vector3(col.r, col.g, col.b))
	m.set_shader_parameter("speed", speed)
	return m

## a six-sided prism, pointed at the top, base at the origin
static func prism_mesh(r := 0.5, h := 2.0) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var tip := Vector3(0, h, 0)
	for i in 6:
		var a0 := TAU * i / 6.0
		var a1 := TAU * (i + 1) / 6.0
		var b0 := Vector3(cos(a0) * r, 0, sin(a0) * r)
		var b1 := Vector3(cos(a1) * r, 0, sin(a1) * r)
		var m0 := Vector3(cos(a0) * r * 1.1, h * 0.62, sin(a0) * r * 1.1)
		var m1 := Vector3(cos(a1) * r * 1.1, h * 0.62, sin(a1) * r * 1.1)
		for tri in [[b0, m0, m1], [b0, m1, b1], [m0, tip, m1]]:
			var n: Vector3 = (tri[1] - tri[0]).cross(tri[2] - tri[0]).normalized()
			for v in tri:
				st.set_normal(n)
				st.add_vertex(v)
	return st.commit()

static func crystals(parent: Node3D, center: Vector3, radius: float, count: int, col: Color, rng: RandomNumberGenerator, ground: Callable = Callable()) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = prism_mesh(0.5, 2.0)
	mm.instance_count = count * 3
	var n := 0
	for i in count:
		var a := rng.randf() * TAU
		var d := radius * (0.35 + rng.randf() * 0.65)
		var at := center + Vector3(cos(a) * d, 0, sin(a) * d)
		if ground.is_valid():
			at.y = float(ground.call(at.x, at.z))
		# a cluster: one tall spear and two leaning shards
		for k in 3:
			var s := (1.2 + rng.randf() * 1.3) if k == 0 else (0.5 + rng.randf() * 0.6)
			var tilt := Vector3(rng.randf() - 0.5, 0, rng.randf() - 0.5) * (0.15 if k == 0 else 0.7)
			var b := Basis().rotated(Vector3.UP, rng.randf() * TAU).rotated(Vector3.RIGHT, tilt.x).rotated(Vector3.BACK, tilt.z).scaled(Vector3(s * 0.6, s, s * 0.6))
			var off := Vector3(rng.randf() - 0.5, -0.1, rng.randf() - 0.5) * (0.0 if k == 0 else 1.2)
			mm.set_instance_transform(n, Transform3D(b, at + off))
			n += 1
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	# a dark glassy body with the glow in the emission, so the facets read instead of a flat bright shape
	var m := _mat(col.darkened(0.55), 0.12, 0.2, 0.0)
	m.emission_enabled = true
	m.emission = col
	m.emission_energy_multiplier = 0.55
	mmi.material_override = m
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mmi)
	return mmi

## broken slabs and pillar stumps in the air: a FloatingRuins node drifts them
static func floating_ruins(parent: Node3D, center: Vector3, radius: float, count: int, rng: RandomNumberGenerator, col := Color(0.28, 0.26, 0.3)) -> Node3D:
	var root := FloatingRuins.new()
	root.position = center
	parent.add_child(root)
	var stone := _mat(col, 0.9, 0.0)
	for i in count:
		var mi := MeshInstance3D.new()
		if rng.randf() < 0.5:
			var bm := BoxMesh.new()
			bm.size = Vector3(1.5 + rng.randf() * 2.5, 0.35 + rng.randf() * 0.4, 1.0 + rng.randf() * 2.0)
			mi.mesh = bm
		else:
			var cm := CylinderMesh.new()
			cm.top_radius = 0.35 + rng.randf() * 0.2
			cm.bottom_radius = cm.top_radius * 1.1
			cm.height = 1.2 + rng.randf() * 2.0
			cm.radial_segments = 8
			mi.mesh = cm
		mi.material_override = stone
		var a := rng.randf() * TAU
		var d := radius * (0.3 + rng.randf() * 0.7)
		mi.position = Vector3(cos(a) * d, 4.0 + rng.randf() * 7.0, sin(a) * d)
		mi.rotation = Vector3(rng.randf() - 0.5, rng.randf() * TAU, rng.randf() - 0.5)
		mi.set_meta("spin", Vector3(rng.randf() - 0.5, rng.randf() - 0.5, rng.randf() - 0.5) * 0.15)
		mi.set_meta("bob", rng.randf() * TAU)
		root.add_child(mi)
	return root

class FloatingRuins extends Node3D:
	var _t := 0.0
	func _process(dt: float) -> void:
		_t += dt
		for c in get_children():
			var n := c as Node3D
			n.rotation += Vector3(n.get_meta("spin", Vector3.ZERO)) * dt
			n.position.y += sin(_t * 0.6 + float(n.get_meta("bob", 0.0))) * dt * 0.25

## an energy conduit between two points: a dark sheath and a thin scrolling core
static func conduit(parent: Node3D, from: Vector3, to: Vector3, col: Color, radius := 0.18) -> Node3D:
	var root := Node3D.new()
	parent.add_child(root)
	var len := from.distance_to(to)
	if len < 0.01:
		return root
	var mid := (from + to) * 0.5
	root.position = mid
	var dir := (to - from).normalized()
	# the cylinder stands along Y: rotate Y onto the segment
	var axis := Vector3.UP.cross(dir)
	if axis.length() > 1e-4:
		root.basis = Basis(axis.normalized(), acos(clampf(Vector3.UP.dot(dir), -1.0, 1.0)))
	var sheath := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = radius
	cm.bottom_radius = radius
	cm.height = len
	cm.radial_segments = 8
	cm.rings = 1
	sheath.mesh = cm
	sheath.material_override = _mat(Color(0.1, 0.1, 0.13), 0.5, 0.7)
	root.add_child(sheath)
	var core := MeshInstance3D.new()
	var cc := CylinderMesh.new()
	cc.top_radius = radius * 0.55
	cc.bottom_radius = radius * 0.55
	cc.height = len * 1.002
	cc.radial_segments = 8
	cc.rings = 1
	core.mesh = cc
	core.material_override = _shader(GLOW, col, 1.4)
	core.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(core)
	# the rings every few metres
	var n := int(len / 4.0)
	for i in n:
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = radius * 1.1
		tm.outer_radius = radius * 1.6
		tm.rings = 6
		tm.ring_segments = 8
		ring.mesh = tm
		ring.rotation.x = PI * 0.5
		ring.position.y = -len * 0.5 + (i + 0.5) * len / n
		ring.material_override = _mat(Color(0.2, 0.2, 0.24), 0.4, 0.8)
		root.add_child(ring)
	return root

## a sealed relic case with inscriptions that come and go
static func relic_container(parent: Node3D, at: Vector3, col := Color(1.0, 0.8, 0.4)) -> Node3D:
	var root := Node3D.new()
	root.position = at
	parent.add_child(root)
	var body := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.4, 1.0, 0.9)
	body.mesh = bm
	body.position.y = 0.5
	body.material_override = _mat(Color(0.16, 0.14, 0.12), 0.45, 0.6)
	root.add_child(body)
	var band := MeshInstance3D.new()
	var bb := BoxMesh.new()
	bb.size = Vector3(1.42, 0.22, 0.92)
	band.mesh = bb
	band.position.y = 0.55
	band.material_override = _shader(GLYPHS, col)
	band.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(band)
	var light := OmniLight3D.new()
	light.light_color = col
	light.light_energy = 1.2
	light.omni_range = 5.0
	light.position.y = 1.2
	root.add_child(light)
	return root

## boss arena structures: a ring of broken pillars, crystals between them, conduits to the centre, ruins drifting above
static func arena_ring(parent: Node3D, center: Vector3, radius: float, col: Color, rng: RandomNumberGenerator, ground: Callable = Callable(), pillars := 8) -> Node3D:
	var root := Node3D.new()
	parent.add_child(root)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	var cm := CylinderMesh.new()
	cm.top_radius = 0.55
	cm.bottom_radius = 0.7
	cm.height = 1.0
	cm.radial_segments = 8
	cm.rings = 1
	mm.mesh = cm
	mm.instance_count = pillars
	var tops: Array[Vector3] = []
	for i in pillars:
		var a := TAU * i / pillars + rng.randf_range(-0.08, 0.08)
		var at := center + Vector3(cos(a) * radius, 0, sin(a) * radius)
		if ground.is_valid():
			at.y = float(ground.call(at.x, at.z))
		var h := 2.5 + rng.randf() * 4.5   # broken at different heights
		var lean := Vector3(rng.randf() - 0.5, 0, rng.randf() - 0.5) * 0.12
		var b := Basis().rotated(Vector3.RIGHT, lean.x).rotated(Vector3.BACK, lean.z).scaled(Vector3(1, h, 1))
		mm.set_instance_transform(i, Transform3D(b, at + Vector3(0, h * 0.5, 0)))
		tops.append(at + Vector3(0, h, 0))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = _mat(Color(0.24, 0.22, 0.26), 0.9, 0.0)
	root.add_child(mmi)
	# every other pillar feeds a ring hanging over the centre, so the cables run overhead and never across the fight
	var hub := center + Vector3(0, 9.0, 0)
	for i in range(0, pillars, 2):
		conduit(root, tops[i] - Vector3(0, 0.4, 0), hub, col)
	var halo := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 1.6
	tm.outer_radius = 2.2
	tm.rings = 8
	tm.ring_segments = 12
	halo.mesh = tm
	halo.position = hub
	halo.material_override = _mat(col, 0.3, 0.2, 1.2)
	halo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(halo)
	crystals(root, center, radius * 0.9, 10, col, rng, ground)
	floating_ruins(root, center + Vector3(0, 0, 0), radius * 0.8, 7, rng)
	return root
