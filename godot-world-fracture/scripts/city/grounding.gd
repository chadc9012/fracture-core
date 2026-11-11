extends RefCounted
## Contact shading for the phone renderer (GTA pass, owner Nov 11: "at least GTA 5 visual quality", phone first, the Nexus
## street first). The mobile renderer has no screen-space ambient occlusion, so cars, props, people and the foot of every
## facade floated on the paving. These are the cheap stand-ins GTA-era games used: a soft darkening quad under each thing
## (multiplied onto whatever is beneath, so it works on asphalt, paving and the wet overlay alike) and a strip of shade
## along the base of the building line. One shared material per strength, so the static batcher merges a tile's quads.

const Y := 0.035

static var _mats := {}

static func _mat(strength: float, kind: int) -> ShaderMaterial:
	var key := "%d:%.2f" % [kind, strength]
	if _mats.has(key):
		return _mats[key]
	var sh := Shader.new()
	# kind 0: a rounded-rectangle blob (cars, props, people); kind 1: a strip darkest along UV.y = 0 (the wall)
	sh.code = """
shader_type spatial;
render_mode unshaded, blend_mul, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform float strength = 0.6;
uniform int kind = 0;
void fragment() {
	float d;
	if (kind == 0) {
		vec2 q = abs(UV - 0.5) * 2.0;
		// a box core with a soft rim: 0 inside the footprint, 1 at the quad's edge
		d = smoothstep(0.0, 1.0, length(max(q - 0.5, 0.0)) / 0.5);
	} else {
		d = smoothstep(0.0, 1.0, UV.y);
		d = sqrt(d);
	}
	ALBEDO = vec3(mix(1.0 - strength, 1.0, clamp(d, 0.0, 1.0)));
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("strength", strength)
	m.set_shader_parameter("kind", kind)
	m.render_priority = -1
	_mats[key] = m
	return m

## a soft shadow pool under a thing of footprint `size` (x, z in the parent's frame), centred under the parent
static func blob(parent: Node3D, size: Vector2, strength := 0.55, offset := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(size.x * 1.35 + 0.6, size.y * 1.25 + 0.6)
	mi.mesh = pm
	mi.material_override = _mat(strength, 0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = offset + Vector3(0, Y, 0)
	mi.name = "contact"
	parent.add_child(mi)
	# undo a scaled parent so the pool keeps its size in metres
	var s := parent.global_transform.basis.get_scale() if parent.is_inside_tree() else parent.scale
	if s.x > 0.0001 and absf(s.x - 1.0) > 0.001:
		mi.scale = Vector3(1.0 / s.x, 1.0 / s.y, 1.0 / s.z)
	return mi

## a strip of shade on the ground along a wall: `along` the wall's direction (unit, horizontal), `from` its start point on
## the ground, `length` metres, `out` the direction away from the wall, `width` how far the shade reaches
static func wall_strip(parent: Node3D, from: Vector3, along: Vector3, length: float, out: Vector3, width := 1.4, strength := 0.5, y := Y) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var a := from + Vector3(0, y, 0)
	var b := a + along * length
	var c := b + out * width
	var d := a + out * width
	for v in [[a, Vector2(0, 0)], [b, Vector2(1, 0)], [c, Vector2(1, 1)], [a, Vector2(0, 0)], [c, Vector2(1, 1)], [d, Vector2(0, 1)]]:
		st.set_normal(Vector3.UP)
		st.set_uv(v[1])
		st.add_vertex(v[0])
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _mat(strength, 1)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.name = "wall_shade"
	parent.add_child(mi)
	return mi

## the dark pool under a car's body, from its meshes' bounds (it rides along when the car is driven)
static func car(node: Node3D) -> void:
	var out := AABB()
	var first := true
	for c in node.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var t := Transform3D.IDENTITY
		var p: Node = mi
		while p != node and p is Node3D:
			t = (p as Node3D).transform * t
			p = p.get_parent()
		var a := t * mi.get_aabb()
		out = a if first else out.merge(a)
		first = false
	if first or out.size.x < 0.1:
		return
	var ctr := out.get_center()
	blob(node, Vector2(out.size.x * 0.9, out.size.z * 0.92), 0.72, Vector3(ctr.x, 0.0, ctr.z))
