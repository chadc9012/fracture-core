extends RefCounted
## Folds a built scene's static geometry into few draws, for the phone (the Nexus street measured ~1,700 draw calls and
## 1.3 M triangles a frame at night; a phone wants a few hundred draws).
##
## Two kinds of static geometry are folded, both kept local in CELL-metre ground cells so frustum culling still works and
## the Mobile renderer's 8-lights-per-mesh limit still sees only nearby lamps:
##   - primitive pieces (BoxMesh, CylinderMesh, ... — kerbs, lane paint, awnings, sign frames, neon strips): merged into
##     one mesh per look per cell. Looks are matched by what they draw (colour, roughness, metal, emission, textures,
##     transparency), not by material object, because the builders make a fresh material for every box.
##   - an authored model used three or more times in the same root (lamps, palms, planters, benches, bollards, parked
##     cars of one kind): one MultiMesh per mesh per cell instead of one draw per piece per copy.
## Everything else stays as it is: skinned or animated models, anything under a node with a script or with meta
## "dynamic" (things that move or are looked up later), labels, lights, particles and physics bodies. The nodes that held
## the folded meshes stay too (they carry each prop's size and place for the obstacle boxes); only the meshes go.

const Phone := preload("res://scripts/phone.gd")
const CELL := 48.0
const COPY_CELL := 130.0      # repeated models batch over wider cells: a cell of a tile has too few copies of each
const MIN_COPIES := 3
const FLAT := 0.35            # merged pieces lower than this (lane paint, kerbs, puddles) cast no shadow

## the merge cell by tier: a phone takes fewer, bigger merged meshes (fewer draws) over finer culling
static func cell_for_tier() -> float:
	match Phone.tier():
		"low":
			return 130.0
		"medium":
			return 96.0
	return CELL

static func batch(root: Node3D, cell := -1.0) -> Dictionary:
	if cell <= 0.0:
		cell = cell_for_tier()
	var prims := {}      # look key + cell -> { mat, cast, list: [[mesh, surface, xf]] }
	var copies := {}     # mesh + overrides + cell -> { mi0, list: [xf], nodes: [mi] }
	var by_mesh := {}    # mesh rid -> count in this root (only meshes used MIN_COPIES+ times are instanced)
	var candidates: Array[MeshInstance3D] = []
	var inv := root.global_transform.affine_inverse()
	_collect(root, root, candidates)
	for mi in candidates:
		if not (mi.mesh is PrimitiveMesh):
			var rid := mi.mesh.get_rid()
			by_mesh[rid] = int(by_mesh.get(rid, 0)) + 1
	var removed: Array[MeshInstance3D] = []
	var lean := {}
	for mi in candidates:
		var xf := inv * mi.global_transform
		var at := Vector2i(floori(xf.origin.x / cell), floori(xf.origin.z / cell))
		var at2 := Vector2i(floori(xf.origin.x / COPY_CELL), floori(xf.origin.z / COPY_CELL))
		if mi.mesh is PrimitiveMesh and mi.visibility_range_end > 0.0:
			continue   # a ranged primitive keeps its own fade
		if mi.mesh is PrimitiveMesh:
			for s in mi.mesh.get_surface_count():
				var mat := mi.get_active_material(s)
				if mat == null:
					continue
				var key := "%s|%d|%d|%d" % [_look(mat), at.x, at.y, int(mi.cast_shadow)]
				if not prims.has(key):
					prims[key] = { "mat": mat, "cast": mi.cast_shadow, "list": [] }
				prims[key].list.append([_lean(mi.mesh, lean), s, xf])
			removed.append(mi)
		elif int(by_mesh.get(mi.mesh.get_rid(), 0)) >= MIN_COPIES:
			# copies group by what their materials look like, not which material object they hold: a tinted prop made
			# from its own StandardMaterial3D instance still batches with every copy tinted the same
			var over := ""
			for s in mi.mesh.get_surface_count():
				var o := mi.get_surface_override_material(s)
				over += ":" + (_look(o) if o else "")
			var mo := mi.material_override
			var key2 := "%d|%s|%s|%d|%d|%d|%d" % [mi.mesh.get_rid().get_id(), over, _look(mo) if mo else "", at2.x, at2.y, int(mi.cast_shadow), int(mi.visibility_range_end)]
			if not copies.has(key2):
				copies[key2] = { "mi0": mi, "list": [] }
			copies[key2].list.append(xf)
			removed.append(mi)
	var draws_before := 0
	for mi in candidates:
		draws_before += mi.mesh.get_surface_count()
	var made := 0
	# primitives: one merged mesh per look per cell
	var merged_nodes := 0
	for key in prims:
		var g: Dictionary = prims[key]
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for e in g.list:
			st.append_from(e[0], e[1], e[2])
		var out := MeshInstance3D.new()
		out.mesh = st.commit()
		out.material_override = g.mat
		out.cast_shadow = g.cast
		# paint, kerbs and puddles throw no shadow worth a second draw in every cascade
		if out.mesh.get_aabb().size.y < FLAT:
			out.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		out.name = "batch_%d" % merged_nodes
		root.add_child(out)
		merged_nodes += 1
		made += 1
	# repeated models: one multimesh per mesh per cell
	for key2 in copies:
		var c: Dictionary = copies[key2]
		var mi0: MeshInstance3D = c.mi0
		if c.list.size() < 2:
			# one copy in this cell: a one-instance multimesh draws the same and costs a node; keep the original
			removed.erase(mi0)
			made += mi0.mesh.get_surface_count()
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mi0.mesh
		mm.instance_count = c.list.size()
		for i in c.list.size():
			mm.set_instance_transform(i, c.list[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = mi0.material_override
		mmi.cast_shadow = mi0.cast_shadow
		# a multimesh takes no per-surface overrides: copies with overrides keep them by baking them into a mesh copy
		if mi0.get_surface_override_material_count() > 0:
			var any := false
			for s in mi0.mesh.get_surface_count():
				if mi0.get_surface_override_material(s):
					any = true
			if any:
				var dup := (mi0.mesh as Mesh).duplicate() as Mesh
				if dup is ArrayMesh:
					for s in dup.get_surface_count():
						var o := mi0.get_surface_override_material(s)
						if o:
							(dup as ArrayMesh).surface_set_material(s, o)
					mm.mesh = dup
		# small things fade out with distance (a lamp or a planter is a few pixels past ~140 m)
		var size := mi0.get_aabb().size * mi0.global_transform.basis.get_scale()
		if maxf(size.x, maxf(size.y, size.z)) < Phone.shadowless_below():
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if mi0.visibility_range_end > 0.0:
			mmi.visibility_range_end = minf(mi0.visibility_range_end, Phone.dressing_range()) if mi0.visibility_range_end <= 140.0 else mi0.visibility_range_end
			mmi.visibility_range_end_margin = mi0.visibility_range_end_margin
			mmi.visibility_range_fade_mode = mi0.visibility_range_fade_mode
		elif maxf(size.x, maxf(size.y, size.z)) < 6.0:
			mmi.visibility_range_end = Phone.dressing_range()
			mmi.visibility_range_end_margin = 20.0
			mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		root.add_child(mmi)
		made += mi0.mesh.get_surface_count()
	for mi in removed:
		mi.get_parent().remove_child(mi)
		mi.queue_free()
	var draws_after := made
	for mi in candidates:
		if not removed.has(mi):
			draws_after += mi.mesh.get_surface_count()
	_fade_lights(root)
	return { "before": draws_before, "after": draws_after, "folded": removed.size() }

## street lamps and sign glows switch off with distance (they light nothing you can make out past ~90 m), so the phone
## only shades the lights near the camera
static func _fade_lights(root: Node) -> void:
	for n in root.find_children("*", "OmniLight3D", true, false):
		var l := n as OmniLight3D
		if not l.distance_fade_enabled:
			l.distance_fade_enabled = true
			l.distance_fade_begin = 70.0
			l.distance_fade_length = 20.0
			l.distance_fade_shadow = 40.0

## One model (a fleet car: 21 material pieces plus five per wheel, ~40 draws) folded into one mesh per look, in the
## model's own space, so it still moves as one node (driving moves the car's root; nothing moves its pieces). Call it
## after anything that rearranges the model's children (StreetCar.face_forward). Visibility range and shadow carry over.
static var _compacted := {}   # model file -> [[mesh, material, cast, range, margin, fade]]: one set of meshes per model

static func compact(model: Node3D) -> void:
	var file := "%s|%s" % [model.scene_file_path, str(model.get_meta("faced", false))]
	if model.scene_file_path != "" and _compacted.has(file):
		# the same model again: reuse its folded meshes, so copies share them (and a batch can instance them)
		for mi in model.find_children("*", "MeshInstance3D", true, false):
			mi.get_parent().remove_child(mi)
			mi.free()
		for e in _compacted[file]:
			var o := MeshInstance3D.new()
			o.mesh = e[0]
			o.material_override = e[1]
			o.cast_shadow = e[2]
			o.visibility_range_end = e[3]
			o.visibility_range_end_margin = e[4]
			o.visibility_range_fade_mode = e[5]
			model.add_child(o)
		return
	var made: Array = []
	var groups := {}
	var list: Array[MeshInstance3D] = []
	for n in model.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		if mi.mesh == null or mi.skin != null or not mi.is_visible_in_tree() and mi.is_inside_tree():
			continue
		list.append(mi)
	if list.size() < 2:
		return
	var inv := Transform3D.IDENTITY
	for mi in list:
		# the piece's transform relative to the model root (works before the model is in the tree)
		var t := Transform3D.IDENTITY
		var p: Node = mi
		while p != model and p is Node3D:
			t = (p as Node3D).transform * t
			p = p.get_parent()
		for s in mi.mesh.get_surface_count():
			var mat := mi.get_active_material(s)
			if mat == null:
				continue
			var key := "%s|%d" % [_look(mat), int(mi.cast_shadow)]
			if not groups.has(key):
				groups[key] = { "mat": mat, "mi": mi, "parts": [] }
			groups[key].parts.append([mi.mesh, s, t])
	for key in groups:
		var g: Dictionary = groups[key]
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for e in g.parts:
			st.append_from(e[0], e[1], e[2])
		var out := MeshInstance3D.new()
		out.mesh = st.commit()
		out.material_override = g.mat
		var src: MeshInstance3D = g.mi
		out.cast_shadow = src.cast_shadow
		out.visibility_range_end = src.visibility_range_end
		out.visibility_range_end_margin = src.visibility_range_end_margin
		out.visibility_range_fade_mode = src.visibility_range_fade_mode
		model.add_child(out)
		made.append([out.mesh, out.material_override, out.cast_shadow, out.visibility_range_end, out.visibility_range_end_margin, out.visibility_range_fade_mode])
	for mi in list:
		mi.get_parent().remove_child(mi)
		mi.free()
	if model.scene_file_path != "":
		_compacted[file] = made

## Godot's primitives default to film detail (a SphereMesh is 64 x 32 segments, ~4,000 triangles; a CylinderMesh 64 sides):
## a crowd head, a bollard or a lamp globe drawn that way costs a phone more than the building behind it. Folded pieces
## get the detail their size needs (the shape is the same; only the segment count drops).
static func _lean(m: Mesh, cache: Dictionary) -> Mesh:
	if cache.has(m):
		return cache[m]
	var out: Mesh = m
	if m is SphereMesh and (m as SphereMesh).radial_segments >= 32:
		var sp := (m as SphereMesh).duplicate() as SphereMesh
		var big := sp.radius > 2.0
		sp.radial_segments = 24 if big else 12
		sp.rings = 12 if big else 6
		out = sp
	elif m is CylinderMesh and (m as CylinderMesh).radial_segments >= 32:
		var cy := (m as CylinderMesh).duplicate() as CylinderMesh
		var r := maxf(cy.top_radius, cy.bottom_radius)
		cy.radial_segments = 24 if r > 2.0 else (14 if r > 0.4 else 10)
		cy.rings = mini(cy.rings, 1)
		out = cy
	elif m is CapsuleMesh and (m as CapsuleMesh).radial_segments >= 32:
		var ca := (m as CapsuleMesh).duplicate() as CapsuleMesh
		ca.radial_segments = 12
		ca.rings = 4
		out = ca
	cache[m] = out
	return out

## static meshes under `n` that are safe to fold
static func _collect(n: Node, root: Node, out: Array[MeshInstance3D]) -> void:
	for c in n.get_children():
		if c.has_meta("dynamic") or c.has_meta("car") or (c != root and c.get_script() != null) or c is AnimationPlayer or c is PhysicsBody3D or c is Skeleton3D:
			continue
		if c is Node3D and not (c as Node3D).visible:
			continue
		# an animated model (an AnimationPlayer among its children) stays whole
		var animated := false
		for g in c.get_children():
			if g is AnimationPlayer or g is Skeleton3D:
				animated = true
				break
		if animated:
			continue
		if c is MeshInstance3D:
			var mi := c as MeshInstance3D
			if mi.mesh != null and mi.skin == null and mi.get_child_count() == 0 and mi.mesh.get_surface_count() > 0:
				out.append(mi)
				continue
		_collect(c, root, out)

## what a material draws, as a key: two materials with the same key look the same
static func _look(m: Material) -> String:
	if m is StandardMaterial3D:
		var s := m as StandardMaterial3D
		var tex := func(t: Texture2D) -> int: return t.get_rid().get_id() if t else 0
		return "S%s|%.3f|%.3f|%d|%s|%.3f|%d|%d|%d|%d|%d|%d|%s|%s|%d|%d" % [s.albedo_color.to_html(), s.roughness, s.metallic, int(s.emission_enabled), s.emission.to_html(), s.emission_energy_multiplier,
			s.transparency, s.shading_mode, s.cull_mode, tex.call(s.albedo_texture), tex.call(s.normal_texture), tex.call(s.roughness_texture), str(s.uv1_scale), str(s.uv1_offset), int(s.uv1_triplanar), int(s.vertex_color_use_as_albedo)]
	return "M%d" % m.get_instance_id()
