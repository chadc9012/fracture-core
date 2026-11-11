extends RefCounted
## Draws a car's paint, finish and parts (catalog.gd `look`) on a fleet model. The fleet GLBs name their materials (Paint, Rim,
## Caliper, Glass...) and wheels (WheelFL...), so paint, rims, calipers and glass recolour those materials, and body-kit pieces
## (splitter, skirts, wing, scoop, bull bar, roof rack, armour plates) are built to fit the car's own bounding box, front and
## rear taken from where its wheels are. `apply` is idempotent: it clears the previous kit and re-applies from the parts given,
## which is how the garage previews an order before it is bought.

const Catalog := preload("res://scripts/garage/catalog.gd")
const KIT := "GarageKit"

## the car's frame in its own space: centre, forward / right / up, half length / width / height, floor height, deck height
static func frame(car: Node3D) -> Dictionary:
	var box := AABB()
	var first := true
	for mi in _meshes(car):
		var b: AABB = _rel(car, mi) * mi.get_aabb()
		box = b if first else box.merge(b)
		first = false
	var front := Vector3.ZERO
	var rear := Vector3.ZERO
	var nf := 0
	var nr := 0
	for n in _all(car):
		var name := String(n.name)
		if not name.begins_with("Wheel") or not (n is Node3D):
			continue
		var p: Vector3 = _rel(car, n).origin
		if name.substr(5, 1) == "F":
			front += p; nf += 1
		elif name.substr(5, 1) == "R":
			rear += p; nr += 1
	var fwd := Vector3(0, 0, 1)
	if nf > 0 and nr > 0:
		var d := front / nf - rear / nr
		d.y = 0
		if d.length() > 0.1:
			fwd = d.normalized()
	# snap to the box's long axis so pieces line up with the body
	fwd = Vector3(signf(fwd.x), 0, 0) if absf(fwd.x) > absf(fwd.z) else Vector3(0, 0, signf(fwd.z))
	var right := Vector3.UP.cross(fwd).normalized()
	var half := box.size * 0.5
	var c := box.get_center()
	var hl := absf(half.dot(fwd))
	var hw := absf(half.dot(right))
	return { "c": c, "fwd": fwd, "right": right, "hl": hl, "hw": hw, "hh": half.y, "floor": box.position.y, "top": box.end.y,
		"wheel_y": (front / maxi(nf, 1)).y if nf > 0 else box.position.y + 0.35 }

## re-apply paint, finish and parts to a car (parts: slot -> item id, paint/finish included); `base_paint` when unpainted
static func apply(car: Node3D, parts: Dictionary, base_paint: String, tune := {}) -> void:
	var old := car.get_node_or_null(KIT)
	if old:
		car.remove_child(old)
		old.free()
	_reset_materials(car)
	var kit := Node3D.new()
	kit.name = KIT
	car.add_child(kit)
	var f := frame(car)
	# paint and finish
	var paint := Color(base_paint)
	if parts.has("paint"):
		paint = Color(Catalog.item(parts.paint).look.color)
	var fin: Dictionary = Catalog.item(parts.get("finish", "finish-gloss")).get("look", {})
	var paint_mat := StandardMaterial3D.new()
	paint_mat.albedo_color = paint
	paint_mat.metallic = float(fin.get("metal", 0.15))
	paint_mat.roughness = float(fin.get("rough", 0.32))
	paint_mat.clearcoat_enabled = float(fin.get("coat", 1.0)) > 0.0
	paint_mat.clearcoat = float(fin.get("coat", 1.0))
	paint_mat.clearcoat_roughness = 0.08
	if parts.get("finish", "") == "finish-pearl":
		paint_mat.rim_enabled = true
		paint_mat.rim = 0.6
		paint_mat.rim_tint = 0.2
	_override(car, ["Paint", "paint"], func(_m): return paint_mat)
	# body pieces share the paint; carbon pieces their own weave-dark gloss
	var carbon := StandardMaterial3D.new()
	carbon.albedo_color = Color("#16181b")
	carbon.metallic = 0.3
	carbon.roughness = 0.28
	carbon.clearcoat_enabled = true
	carbon.clearcoat = 1.0
	var steel := StandardMaterial3D.new()
	steel.albedo_color = Color("#3b3f44")
	steel.metallic = 0.85
	steel.roughness = 0.45
	for slot in parts:
		if slot == "paint" or slot == "finish":
			continue
		var it := Catalog.item(parts[slot])
		var look: Dictionary = it.get("look", {})
		match String(look.get("kind", "")):
			"splitter": _splitter(kit, f, look, carbon if look.get("carbon", false) else paint_mat)
			"skirts": _skirts(kit, f, look, carbon if look.get("carbon", false) else paint_mat)
			"spoiler": _spoiler(kit, f, look, carbon if look.get("carbon", false) else paint_mat)
			"hood": _hood(kit, f, carbon)
			"diffuser": _diffuser(kit, f, look, carbon if look.get("carbon", false) else paint_mat)
			"fenders": _fenders(kit, f, paint_mat, carbon)
			"exhaust": _exhaust(kit, f, look)
			"bullbar": _bullbar(kit, f, steel)
			"roof": _roof(kit, f, steel)
			"plates": _plates(kit, f, look, steel)
			"underglow": _underglow(kit, f, Color(look.color))
			"core": _core(kit, f, Color(look.color))
			"shield": _shield(kit, f, Color(look.color))
			"rims": _recolor(car, ["Rim", "WHEEL", "Wheel"], Color(look.color), float(look.metal), float(look.rough))
			"calipers": _recolor(car, ["Caliper"], Color(look.color), 0.2, 0.4)
			"glass": _glass(car, Color(look.color))
			"ride": _ride(car, float(look.drop))
			"aero": _aero(kit, f, look, carbon if look.get("carbon", false) else paint_mat)
			"decal": _decal(kit, f, String(look.style), Catalog.tune_clean(tune))
			"cage": _cage(kit, f, steel)
	# the free tuning: ride height on top of any suspension drop, rim size and camber on the wheels
	var t := Catalog.tune_clean(tune)
	if int(t.ride) != 0:
		var body := car.find_child("Body", true, false)
		if body is Node3D:
			if not body.has_meta("ride0"):
				body.set_meta("ride0", body.position.y)
			body.position.y += float(t.ride) / 1000.0
	_wheels(car, float(t.rim), float(t.camber))

# ---------------------------------------------------------------- pieces
static func _box(parent: Node3D, f: Dictionary, size: Vector3, at: Vector3, mat: Material) -> MeshInstance3D:
	## size and position in the car frame: x = right, y = up, z = forward
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	var basis := Basis(f.right, Vector3.UP, f.fwd)
	mi.transform = Transform3D(basis, f.c + f.right * at.x + Vector3.UP * (at.y - f.c.y) + f.fwd * at.z)
	parent.add_child(mi)
	return mi

static func _tube(parent: Node3D, f: Dictionary, a: Vector3, b: Vector3, r: float, mat: Material) -> void:
	var pa: Vector3 = f.c + f.right * a.x + Vector3.UP * (a.y - f.c.y) + f.fwd * a.z
	var pb: Vector3 = f.c + f.right * b.x + Vector3.UP * (b.y - f.c.y) + f.fwd * b.z
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r; cm.bottom_radius = r; cm.height = pa.distance_to(pb); cm.radial_segments = 12
	mi.mesh = cm
	mi.material_override = mat
	var d := (pb - pa).normalized()
	var up := d
	var side := up.cross(Vector3.FORWARD if absf(up.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT).normalized()
	mi.transform = Transform3D(Basis(side, up, side.cross(up)), (pa + pb) * 0.5)
	parent.add_child(mi)

static func _splitter(kit: Node3D, f: Dictionary, look: Dictionary, mat: Material) -> void:
	var d := float(look.get("depth", 0.15))
	_box(kit, f, Vector3(f.hw * 1.85, 0.035, d + 0.1), Vector3(0, f.floor + 0.1, f.hl + d * 0.5 - 0.08), mat)

static func _skirts(kit: Node3D, f: Dictionary, look: Dictionary, mat: Material) -> void:
	var wide: bool = look.get("wide", false)
	for s in [-1.0, 1.0]:
		_box(kit, f, Vector3(0.06 if wide else 0.04, 0.1, f.hl * 1.1), Vector3(s * (f.hw + (0.03 if wide else 0.0)), f.floor + 0.18, 0), mat)
		if wide:
			for z in [f.hl * 0.62, -f.hl * 0.6]:  # arch flares over each wheel
				_box(kit, f, Vector3(0.08, 0.06, f.hl * 0.42), Vector3(s * (f.hw + 0.035), f.wheel_y + 0.36, z), mat)

static func _spoiler(kit: Node3D, f: Dictionary, look: Dictionary, mat: Material) -> void:
	var h := float(look.get("height", 0.1))
	var deck: float = f.floor + f.hh * 2.0 * 0.62
	var z: float = -f.hl + 0.22
	if h < 0.1:  # a ducktail lip on the deck edge
		_box(kit, f, Vector3(f.hw * 1.7, 0.05, 0.16), Vector3(0, deck + 0.04, z - 0.05), mat)
		return
	_box(kit, f, Vector3(f.hw * 1.8, 0.035, 0.3), Vector3(0, deck + h, z), mat)
	for s in [-1.0, 1.0]:
		_box(kit, f, Vector3(0.025, h, 0.12), Vector3(s * f.hw * 0.55, deck + h * 0.5, z), mat)
		_box(kit, f, Vector3(0.02, 0.14, 0.34), Vector3(s * f.hw * 0.9, deck + h + 0.04, z), mat)  # end plates

static func _diffuser(kit: Node3D, f: Dictionary, look: Dictionary, mat: Material) -> void:
	var z: float = -f.hl - 0.04
	_box(kit, f, Vector3(f.hw * 1.7, 0.05, 0.32), Vector3(0, f.floor + 0.14, z + 0.1), mat)
	var n := int(look.get("fins", 3))
	for k in n:
		var x: float = -f.hw * 0.7 + k * (f.hw * 1.4 / maxf(1.0, n - 1.0))
		_box(kit, f, Vector3(0.02, 0.14, 0.3), Vector3(x, f.floor + 0.2, z + 0.08), mat)

static func _fenders(kit: Node3D, f: Dictionary, body: Material, vent: Material) -> void:
	for s in [-1.0, 1.0]:
		_box(kit, f, Vector3(0.05, 0.2, f.hl * 0.36), Vector3(s * (f.hw + 0.015), f.wheel_y + 0.42, f.hl * 0.58), body)
		for k in 3:  # louvres behind the front wheel
			_box(kit, f, Vector3(0.02, 0.025, 0.2), Vector3(s * (f.hw + 0.045), f.wheel_y + 0.36 + k * 0.05, f.hl * 0.33), vent)

static func _exhaust(kit: Node3D, f: Dictionary, look: Dictionary) -> void:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(look.get("color", "#d6dade"))
	m.metallic = 1.0
	m.roughness = 0.15
	var inner := StandardMaterial3D.new()
	inner.albedo_color = Color("#050505")
	var n := int(look.get("n", 2))
	for k in n:
		var side := -1.0 if k < n / 2 else 1.0
		var x: float = side * (f.hw * 0.55 + (k % 2) * 0.12)
		var y: float = f.floor + 0.3
		_tube(kit, f, Vector3(x, y, -f.hl - 0.12), Vector3(x, y, -f.hl + 0.05), 0.055, m)
		_box(kit, f, Vector3(0.08, 0.08, 0.01), Vector3(x, y, -f.hl - 0.125), inner)

static func _hood(kit: Node3D, f: Dictionary, mat: Material) -> void:
	var y: float = f.floor + f.hh * 2.0 * 0.6
	_box(kit, f, Vector3(f.hw * 0.55, 0.07, f.hl * 0.35), Vector3(0, y, f.hl * 0.55), mat)
	for s in [-1.0, 1.0]:
		_box(kit, f, Vector3(f.hw * 0.22, 0.02, f.hl * 0.18), Vector3(s * f.hw * 0.5, y - 0.01, f.hl * 0.45), mat)

static func _bullbar(kit: Node3D, f: Dictionary, mat: Material) -> void:
	var z: float = f.hl + 0.12
	var lo: float = f.floor + 0.3
	var hi: float = f.floor + f.hh * 2.0 * 0.55
	for s in [-1.0, 1.0]:
		_tube(kit, f, Vector3(s * f.hw * 0.55, lo, z), Vector3(s * f.hw * 0.55, hi, z), 0.035, mat)
	_tube(kit, f, Vector3(-f.hw * 0.75, hi, z), Vector3(f.hw * 0.75, hi, z), 0.035, mat)
	_tube(kit, f, Vector3(-f.hw * 0.8, lo + 0.12, z + 0.04), Vector3(f.hw * 0.8, lo + 0.12, z + 0.04), 0.04, mat)

static func _roof(kit: Node3D, f: Dictionary, mat: Material) -> void:
	var y: float = f.top + 0.08
	for s in [-1.0, 1.0]:
		_tube(kit, f, Vector3(s * f.hw * 0.7, y, -f.hl * 0.35), Vector3(s * f.hw * 0.7, y, f.hl * 0.25), 0.025, mat)
	for z in [-f.hl * 0.3, 0.0, f.hl * 0.2]:
		_tube(kit, f, Vector3(-f.hw * 0.7, y, z), Vector3(f.hw * 0.7, y, z), 0.02, mat)
	var lamp := StandardMaterial3D.new()
	lamp.albedo_color = Color("#fff6e0")
	lamp.emission_enabled = true
	lamp.emission = Color("#fff1d0")
	lamp.emission_energy_multiplier = 3.0
	_box(kit, f, Vector3(f.hw * 1.3, 0.08, 0.1), Vector3(0, y + 0.06, f.hl * 0.27), mat)
	for k in 5:
		_box(kit, f, Vector3(0.12, 0.06, 0.02), Vector3(-f.hw * 0.52 + k * f.hw * 0.26, y + 0.06, f.hl * 0.27 + 0.055), lamp)

static func _plates(kit: Node3D, f: Dictionary, look: Dictionary, mat: Material) -> void:
	var heavy: bool = look.get("heavy", false)
	var rivet := StandardMaterial3D.new()
	rivet.albedo_color = Color("#8d9196")
	rivet.metallic = 1.0
	rivet.roughness = 0.3
	for s in [-1.0, 1.0]:
		var h: float = f.hh * 2.0 * (0.42 if heavy else 0.3)
		var y: float = f.floor + 0.25 + h * 0.5
		_box(kit, f, Vector3(0.05, h, f.hl * (1.3 if heavy else 0.9)), Vector3(s * (f.hw + 0.03), y, 0.0), mat)
		for k in (7 if heavy else 5):
			var z: float = -f.hl * (0.6 if heavy else 0.42) + k * f.hl * (0.2 if heavy else 0.21)
			_box(kit, f, Vector3(0.02, 0.03, 0.03), Vector3(s * (f.hw + 0.06), y + h * 0.4, z), rivet)
			_box(kit, f, Vector3(0.02, 0.03, 0.03), Vector3(s * (f.hw + 0.06), y - h * 0.4, z), rivet)
	if heavy:  # a ram plate across the nose and window grilles
		_box(kit, f, Vector3(f.hw * 1.9, f.hh * 0.5, 0.06), Vector3(0, f.floor + 0.35, f.hl + 0.05), mat)

static func _underglow(kit: Node3D, f: Dictionary, col: Color) -> void:
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.emission_enabled = true
	m.emission = col
	m.emission_energy_multiplier = 6.0
	for s in [-1.0, 1.0]:
		_box(kit, f, Vector3(0.03, 0.02, f.hl * 1.4), Vector3(s * f.hw * 0.8, f.floor + 0.06, 0), m)
	var l := OmniLight3D.new()
	l.light_color = col
	l.light_energy = 3.0
	l.omni_range = f.hl * 2.2
	l.position = f.c + Vector3.UP * (f.floor - f.c.y + 0.05)
	kit.add_child(l)

static func _core(kit: Node3D, f: Dictionary, col: Color) -> void:
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.emission_enabled = true
	m.emission = col
	m.emission_energy_multiplier = 5.0
	for s in [-1.0, 1.0]:  # twin phase thrusters at the rear
		var mi := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.08; tm.outer_radius = 0.13
		mi.mesh = tm
		mi.material_override = m
		mi.transform = Transform3D(Basis(f.right, f.fwd, -Vector3.UP), f.c + f.right * s * f.hw * 0.5 + Vector3.UP * (f.floor + 0.4 - f.c.y) - f.fwd * (f.hl + 0.03))
		kit.add_child(mi)
	var l := OmniLight3D.new()
	l.light_color = col
	l.light_energy = 2.0
	l.omni_range = 3.0
	l.position = f.c - f.fwd * (f.hl + 0.3) + Vector3.UP * (f.floor + 0.4 - f.c.y)
	kit.add_child(l)

static func _shield(kit: Node3D, f: Dictionary, col: Color) -> void:
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.albedo_color = Color(col, 0.05)
	m.rim_enabled = false
	m.emission_enabled = true
	m.emission = col
	m.emission_energy_multiplier = 0.25
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 1.0; sm.height = 2.0
	mi.mesh = sm
	mi.material_override = m
	mi.transform = Transform3D(Basis(f.right * (f.hw + 0.35), Vector3.UP * (f.hh + 0.3), f.fwd * (f.hl + 0.35)), f.c)
	kit.add_child(mi)

## a node's transform in the car's own space (works before the car is in the scene tree)
static func _rel(car: Node3D, n: Node) -> Transform3D:
	var t := Transform3D.IDENTITY
	var cur := n
	while cur != null and cur != car:
		if cur is Node3D:
			t = (cur as Node3D).transform * t
		cur = cur.get_parent()
	return t

# ---------------------------------------------------------------- materials
static func _meshes(n: Node) -> Array:
	var out := []
	for c in _all(n):
		if c is MeshInstance3D and c.mesh and not String(c.get_parent().name) == KIT:
			out.append(c)
	return out

static func _all(n: Node) -> Array:
	var out := [n]
	var i := 0
	while i < out.size():
		for c in out[i].get_children():
			if String(c.name) != KIT:
				out.append(c)
		i += 1
	return out

## override every surface whose material name starts with one of `names` with `make(original)`
static func _override(car: Node3D, names: Array, make: Callable) -> void:
	for mi in _meshes(car):
		for i in mi.mesh.get_surface_count():
			var mat: Material = mi.mesh.surface_get_material(i)
			if mat == null:
				continue
			for n in names:
				if mat.resource_name.begins_with(n):
					mi.set_surface_override_material(i, make.call(mat))
					break

static func _recolor(car: Node3D, names: Array, col: Color, metal: float, rough: float) -> void:
	_override(car, names, func(orig: Material):
		var m: StandardMaterial3D = (orig.duplicate() if orig is StandardMaterial3D else StandardMaterial3D.new())
		m.albedo_color = col
		m.albedo_texture = null
		m.metallic = metal
		m.roughness = rough
		return m)

static func _glass(car: Node3D, col: Color) -> void:
	_override(car, ["Glass", "Black_Glass"], func(orig: Material):
		var m: StandardMaterial3D = (orig.duplicate() if orig is StandardMaterial3D else StandardMaterial3D.new())
		m.albedo_color = Color(col, maxf(0.85, m.albedo_color.a))
		m.roughness = 0.05
		m.metallic = 0.3
		return m)

static func _ride(car: Node3D, drop: float) -> void:
	var body := car.find_child("Body", true, false)
	if body is Node3D:
		if not body.has_meta("ride0"):
			body.set_meta("ride0", body.position.y)
		body.position.y = float(body.get_meta("ride0")) + drop

static func _reset_materials(car: Node3D) -> void:
	for mi in _meshes(car):
		for i in mi.mesh.get_surface_count():
			mi.set_surface_override_material(i, null)
	var body := car.find_child("Body", true, false)
	if body is Node3D and body.has_meta("ride0"):
		body.position.y = float(body.get_meta("ride0"))

# ---------------------------------------------------------------- the owner's garage file (Nov 11)
## canards on the front corners; the full package adds a deep splitter and a rear wing on tall struts
static func _aero(kit: Node3D, f: Dictionary, look: Dictionary, mat: Material) -> void:
	for s in [-1.0, 1.0]:
		for k in 2:
			var fin := _box(kit, f, Vector3(0.18, 0.012, 0.12), Vector3(s * (f.hw * 0.92), f.floor + 0.32 + k * 0.08, f.hl - 0.12), mat)
			fin.rotate_object_local(Vector3.FORWARD, s * 0.25)
	if look.get("full", false):
		_box(kit, f, Vector3(f.hw * 2.0, 0.03, 0.42), Vector3(0, f.floor + 0.08, f.hl + 0.12), mat)
		var deck: float = f.floor + f.hh * 2.0 * 0.62
		_box(kit, f, Vector3(f.hw * 1.9, 0.04, 0.34), Vector3(0, deck + 0.42, -f.hl + 0.2), mat)
		for s in [-1.0, 1.0]:
			_box(kit, f, Vector3(0.025, 0.42, 0.1), Vector3(s * f.hw * 0.45, deck + 0.21, -f.hl + 0.22), mat)

## decals in the tuned colour, laid on the body's own surface (the car's vertices are sampled along its length, so a
## stripe follows the hood, roof and deck instead of floating flat over them): twin stripes over the top; street graphics
## (slashes down the flanks and the custom text on the doors); a full livery (stripes, a flank band, text and number)
static func _decal(kit: Node3D, f: Dictionary, style: String, t: Dictionary) -> void:
	var col := Color(String(t.decal_color))
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = 0.35
	var pts := _surface_points(kit.get_parent(), f)
	# the pieces are built under a holder and merged into one mesh at the end (one draw, not a hundred)
	var holder := Node3D.new()
	kit.add_child(holder)
	var into := kit
	kit = holder
	var seg: float = f.hl * 2.0 / 16.0
	if style == "stripes" or style == "livery":
		for x in [-f.hw * 0.2, f.hw * 0.2]:
			var prev := Vector3.INF
			for k in 17:
				var z: float = -f.hl * 0.92 + k * (f.hl * 1.84 / 16.0)
				var y: float = _top_at(pts, x, z, seg * 0.6, f.hw * 0.1)
				if is_nan(y):
					prev = Vector3.INF
					continue
				var here := Vector3(x, y + 0.012, z)
				if prev != Vector3.INF:
					var mid := (prev + here) * 0.5
					var len: float = prev.distance_to(here)
					var piece := _box(kit, f, Vector3(f.hw * 0.16, 0.008, len + 0.01), mid, m)
					piece.rotate_object_local(Vector3.RIGHT, -atan2(here.y - prev.y, here.z - prev.z))
				prev = here
	if style == "stripes":
		_merge(holder, into, m)
		return
	for s in [-1.0, 1.0]:
		# above the wheel arches, where the flank runs straight
		var band_y: float = f.wheel_y + 0.44
		var xs: Array = []
		for k in 15:
			var z: float = -f.hl * 0.85 + k * (f.hl * 1.7 / 14.0)
			xs.append(_side_at(pts, s, band_y, z, seg * 0.6))
		var flank: Array = xs.filter(func(v): return not is_nan(v))
		flank.sort()
		var mid: float = flank[flank.size() / 2] if not flank.is_empty() else s * f.hw
		for k in 15:
			var z: float = -f.hl * 0.85 + k * (f.hl * 1.7 / 14.0)
			var x: float = xs[k]
			if is_nan(x) or absf(x - mid) > 0.06:
				continue
			if style == "livery":
				_box(kit, f, Vector3(0.006, 0.1, f.hl * 1.7 / 14.0 + 0.01), Vector3(x + s * 0.008, band_y, z), m)
			elif k % 4 == 1 and k < 13:
				var sl := _box(kit, f, Vector3(0.006, 0.05, f.hl * 0.3), Vector3(x + s * 0.008, band_y + 0.05 + (k / 4) * 0.08, z), m)
				sl.rotate_object_local(Vector3.RIGHT, 0.35)
		var dx: float = _side_at(pts, s, f.floor + 0.66, 0.0, seg)
		var l := Label3D.new()
		l.text = String(t.text) + ("  07" if style == "livery" else "")
		l.font_size = 64
		l.pixel_size = 0.006
		l.outline_size = 6
		l.modulate = col
		l.double_sided = false
		# on the door, facing out of the flank
		var off: float = (dx if not is_nan(dx) else s * f.hw) + s * 0.02
		var at: Vector3 = f.c + f.right * off + Vector3.UP * (f.floor + 0.66 - f.c.y)
		l.transform = Transform3D(Basis(f.fwd * -s, Vector3.UP, f.right * s), at)
		into.add_child(l)
	_merge(holder, into, m)

## every box under `holder` into one mesh on `into` (the holder goes)
static func _merge(holder: Node3D, into: Node3D, mat: Material) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var any := false
	for ch in holder.get_children():
		var mi := ch as MeshInstance3D
		if mi and mi.mesh:
			st.append_from(mi.mesh, 0, mi.transform)
			any = true
	holder.get_parent().remove_child(holder)
	holder.free()
	if not any:
		return
	var out := MeshInstance3D.new()
	out.mesh = st.commit()
	out.material_override = mat
	out.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	into.add_child(out)

## the car's vertices in its frame (x right, y up, z forward, from the frame's centre), at most ~6k of them
static func _surface_points(car: Node3D, f: Dictionary) -> PackedVector3Array:
	var out := PackedVector3Array()
	var total := 0
	for mi in _meshes(car):
		for i in mi.mesh.get_surface_count():
			total += (mi.mesh.surface_get_arrays(i)[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var step := maxi(1, total / 4000)     # ~4k points: the decal samples stay a few ms on a phone
	for mi in _meshes(car):
		var xf := _rel(car, mi)
		for i in mi.mesh.get_surface_count():
			var arr: Array = mi.mesh.surface_get_arrays(i)
			var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			for k in range(0, verts.size(), step):
				var p: Vector3 = xf * verts[k] - f.c
				out.append(Vector3(p.dot(f.right), p.y + f.c.y, p.dot(f.fwd)))
	return out

## the body's top at (x, z): the highest vertex near it (NAN where there is none)
static func _top_at(pts: PackedVector3Array, x: float, z: float, dz: float, dx: float) -> float:
	var best := NAN
	for p in pts:
		if absf(p.z - z) < dz and absf(p.x - x) < dx and (is_nan(best) or p.y > best):
			best = p.y
	return best

## the body's flank at height y and z on side s: the outermost vertex near it (NAN where there is none)
static func _side_at(pts: PackedVector3Array, s: float, y: float, z: float, dz: float) -> float:
	var best := NAN
	for p in pts:
		if absf(p.z - z) < dz and absf(p.y - y) < 0.12 and p.x * s > 0.0 and (is_nan(best) or p.x * s > best * s):
			best = p.x
	return best

## a roll cage inside the cabin: hoops behind the seats and over the doors, seen through the glass
static func _cage(kit: Node3D, f: Dictionary, mat: Material) -> void:
	var lo: float = f.floor + 0.35
	var hi: float = f.top - 0.08
	for z in [-f.hl * 0.25, f.hl * 0.15]:
		_tube(kit, f, Vector3(-f.hw * 0.7, lo, z), Vector3(-f.hw * 0.62, hi, z), 0.022, mat)
		_tube(kit, f, Vector3(f.hw * 0.7, lo, z), Vector3(f.hw * 0.62, hi, z), 0.022, mat)
		_tube(kit, f, Vector3(-f.hw * 0.62, hi, z), Vector3(f.hw * 0.62, hi, z), 0.022, mat)
	_tube(kit, f, Vector3(-f.hw * 0.62, hi, -f.hl * 0.25), Vector3(f.hw * 0.62, hi, f.hl * 0.15), 0.02, mat)

## rim size and camber: each wheel scaled (19 in is the model's own) and tilted top-in by the camber
static func _wheels(car: Node3D, rim: float, camber: float) -> void:
	var k := 1.0 + (rim - 19.0) * 0.03
	for n in _all(car):
		if not (n is Node3D) or not String(n.name).begins_with("Wheel"):
			continue
		var w := n as Node3D
		if not w.has_meta("xf0"):
			w.set_meta("xf0", w.transform)
		var base: Transform3D = w.get_meta("xf0")
		var side := -1.0 if base.origin.x < 0.0 else 1.0
		# the wheels roll about x and the car runs along its model z, so camber is a tilt about z
		w.transform = Transform3D(Basis(Vector3(0, 0, 1), deg_to_rad(camber) * side) * base.basis.scaled(Vector3(k, k, k)), base.origin)
