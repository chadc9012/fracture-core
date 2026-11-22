extends RefCounted
## The airports dressed to the owner's boards (Nov 18, "Global Airports" and the Nexus City International sheet: "design
## the airports to match my reference images detail by detail"). airport_view.gd builds the plan (hall, security, gates,
## apron, runway, hangars); this lays over it what the boards show, airport by airport:
##   the portal   Nexus / Neon: a tall glass barrel arch on white ribs over the doors, the name and the plane mark lit
##                on its face; Thalassia / Frostveil: a white swooping shell; Solmara: a sandstone arch with a lattice
##                face; Eldergrove / Verdant: a timber A-frame with its glass gable
##   landside     the drop-off canopy along the kerb, a second carriageway past a planted median (palms, flowers, the
##                airport's banners on poles), cars at the kerb (fleet models only), the monument sign on its stone base
##                with a fountain and flower beds, the multi-storey car park (P PARKING) beside the forecourt
##   inside       DEPARTURES / ARRIVALS boards hung inside the doors, the yellow-on-black wayfinding sign, the LED column
##                with its halo rings (Nexus, Neon), check-in desks with screens, self check-in kiosks, belted queue lanes,
##                numbered security lanes with tray tables, the VIP lounge's marble desk and logo wall, a lit hangar with
##                work platforms and tool carts
##   airside      baggage trains of ULD containers, service vans at the stands, blue taxiway edge lights, the "27" and
##                touchdown marks on the runway
##   the setting  Thalassia's underwater city glowing offshore, Eldergrove's waterfall off the cliff, Solmara's mesas,
##                Frostveil's ice sculptures and fireplace lounge, Neon's gaming zone
## Every vehicle placed is a fleet model (never one built from shapes: the owner, Nov 15). Static pieces go under the
## view's static_root, so StaticBatch folds them with the rest.

const Air := preload("res://scripts/airport/airport.gd")
const Materials := preload("res://scripts/city/materials.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const Phone := preload("res://scripts/phone.gd")
const Fx := preload("res://scripts/vfx/fx.gd")

## the portal each style wears (airport.gd AIRPORTS style)
const PORTAL := { "nexus": "arch", "neon": "arch", "arctic": "swoop", "coastal": "swoop", "desert": "lattice", "forest": "aframe", "verdant": "aframe", "skyhaven": "swoop", "aurora": "swoop" }

var v: Control          # airport_view.gd
var style := ""
var portal := ""

static func has_portal(style_id: String) -> bool:
	return PORTAL.has(style_id)

func dress(view: Control) -> void:
	v = view
	style = String(Air.AIRPORTS[v.code].style)
	portal = String(PORTAL.get(style, ""))
	match portal:
		"arch": _arch(false)
		"swoop": _arch(true)
		"lattice": _lattice()
		"aframe": _aframe()
	_wings()
	_canopy()
	_carriageway()
	_monument()
	if style in ["nexus", "neon", "desert", "coastal", "arctic", "forest"]:
		_parking()
	_signs()
	_hall_glow()
	_mezzanine()
	_checkin()
	_security()
	if style in ["nexus", "neon"]:
		_column()
	_vip()
	_gate_seats()
	if style in ["nexus", "neon"]:
		_city_backdrop()
	_apron_kit()
	_hangar()
	_airside()
	match style:
		"coastal":
			_thalassia()
			_jellyfish()
		"forest", "verdant":
			_waterfall()
			_indoor_trees()
		"desert":
			_mesas()
			_market()
		"arctic", "aurora": _frost_lounge()
		"neon": _gaming()

# --------------------------------------------------------------------------------------------- helpers
## one of the view's plan constants (VIP, LANES, SECURITY_Z, HANGAR_X, RUNWAY_Z)
func _k(name: String) -> Variant:
	return v.get_script().get_script_constant_map()[name]

func _name_lines() -> Array:
	var a: Dictionary = Air.AIRPORTS[v.code]
	var city := String(a.city).to_upper()
	var rest := String(a.name).trim_prefix(String(a.city)).strip_edges().to_upper()
	if rest == "":
		rest = "AIRPORT"
	return [city, rest]

func _lit_name(at: Vector3, size: int, yaw := 0.0, parent: Node3D = null) -> void:
	var lines := _name_lines()
	v._text("✈", at + Vector3(0, size * 0.0125, 0), int(size * 0.9), v.accent.lerp(Color.WHITE, 0.55), yaw, parent)
	v._text(String(lines[0]), at, size, Color(0.97, 0.98, 1.0), yaw, parent)
	v._text(String(lines[1]), at - Vector3(0, size * 0.0085, 0), int(size * 0.45), Color(0.9, 0.94, 1.0), yaw, parent)

func _flowers(c: Vector3, half: Vector2, colours: Array, n: int) -> void:
	# a bed of small blooms: one MultiMesh of low spheres in a few colours
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var sm := SphereMesh.new()
	sm.radius = 0.28
	sm.height = 0.4
	sm.radial_segments = 6
	sm.rings = 3
	mm.mesh = sm
	mm.instance_count = n
	var rng := RandomNumberGenerator.new()
	rng.seed = int(c.x * 13.0 + c.z * 7.0)
	for i in n:
		var p := c + Vector3(rng.randf_range(-half.x, half.x), 0.5 + rng.randf() * 0.15, rng.randf_range(-half.y, half.y))
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ONE * rng.randf_range(0.7, 1.3)), p))
		mm.set_instance_color(i, colours[i % colours.size()])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 0.8
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	v.world.add_child(mi)
	# the bed: dark soil in a stone kerb
	v._box(Vector3(half.x * 2.0 + 0.6, 0.45, half.y * 2.0 + 0.6), c + Vector3(0, 0.22, 0), v._mat(Color(0.7, 0.7, 0.72), 0.6))
	v._box(Vector3(half.x * 2.0, 0.08, half.y * 2.0), c + Vector3(0, 0.46, 0), v._mat(Color(0.18, 0.13, 0.09), 0.95))
	v.obstacles.append(AABB(c - Vector3(half.x + 0.3, 0, half.y + 0.3), Vector3(half.x * 2.0 + 0.6, 0.6, half.y * 2.0 + 0.6)))

func _car(file: String, at: Vector3, yaw: float) -> void:
	var c: Node3D = v._model("res://models/fleet/" + file)
	if c == null:
		c = v._model("res://models/fleet/street/" + file)
	if c == null:
		return
	StreetCar.face_forward(c)
	c.position = at
	c.rotation.y = yaw
	v.static_root.add_child(c)
	v.obstacles.append(AABB(at - Vector3(1.3, 0, 1.3), Vector3(2.6, 1.6, 2.6)))

func _flowers_palette() -> Array:
	match style:
		"desert": return [Color(0.95, 0.55, 0.2), Color(0.98, 0.85, 0.3), Color(0.85, 0.3, 0.25)]
		"arctic", "aurora": return [Color(0.92, 0.95, 1.0), Color(0.75, 0.85, 1.0), Color(0.6, 0.75, 0.95)]
		"forest", "verdant": return [Color(0.95, 0.85, 0.35), Color(0.9, 0.5, 0.75), Color(0.98, 0.98, 0.95)]
		"neon": return [Color(0.9, 0.3, 0.95), Color(0.4, 0.85, 1.0), Color(0.95, 0.4, 0.6)]
	return [Color(0.62, 0.35, 0.85), Color(0.85, 0.35, 0.65), Color(0.98, 0.95, 0.98), Color(0.55, 0.3, 0.75)]

# --------------------------------------------------------------------------------------------- the portal
## the barrel arch over the doors: legs at x ±R, spring 6 m up, the crown above the roof; glass on white ribs (the arch)
## or a white shell with a glass face (the swoop)
func _arch(shell: bool) -> void:
	var R := 19.0 if not shell else 25.0
	var yk := 1.0 if not shell else 0.72
	var z0 := 24.0
	var z1 := 37.0
	var spring := 6.0
	var rib: Material = v._mat(Color(0.95, 0.96, 0.98) if not v.night else Color(0.75, 0.75, 0.82), 0.3, 0.45)
	var glass: Material = v._glass(v.look.get("glass", Color(0.55, 0.75, 0.95)))
	var skin: Material = glass
	if shell:
		skin = v._mat(Color(0.96, 0.97, 0.98) if style != "aurora" else Color(0.85, 0.9, 0.96), 0.25, 0.2)
	var N := 28
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pt := func(i: int, z: float) -> Vector3:
		var th := PI * float(i) / N
		return Vector3(R * cos(th), spring + R * yk * sin(th), z)
	for i in N:
		var a: Vector3 = pt.call(i, z0)
		var b: Vector3 = pt.call(i + 1, z0)
		var c: Vector3 = pt.call(i + 1, z1)
		var d: Vector3 = pt.call(i, z1)
		for q in [a, b, c, a, c, d]:
			st.set_uv(Vector2(q.x / 6.0, q.z / 6.0))
			st.add_vertex(q)
	st.generate_normals()
	var vault := MeshInstance3D.new()
	vault.mesh = st.commit()
	vault.material_override = skin
	(v.static_root if shell else v.world).add_child(vault)
	# the face at z1: glass in a fan, mullions up it; the swoop's face is glass under its shell's lip
	var fs := SurfaceTool.new()
	fs.begin(Mesh.PRIMITIVE_TRIANGLES)
	var ctr := Vector3(0, spring, z1)
	for i in N:
		for q in [ctr, pt.call(i, z1), pt.call(i + 1, z1)]:
			fs.add_vertex(q)
	fs.generate_normals()
	var face := MeshInstance3D.new()
	face.mesh = fs.commit()
	face.material_override = glass
	v.world.add_child(face)
	# under the spring line the face is the hall's glass front: a glass wall with the doors open in the middle
	for side in [-1.0, 1.0]:
		v._box(Vector3(R - 7.0, spring, 0.25), Vector3(side * (7.0 + (R - 7.0) * 0.5), spring * 0.5, z1), glass, null, true)
	v._box(Vector3(14.0, spring - 4.0, 0.25), Vector3(0, 4.0 + (spring - 4.0) * 0.5, z1), glass)
	v._box(Vector3(14.4, 0.4, 0.5), Vector3(0, 4.0, z1), rib)
	# ribs: arcs at each bay and on the face, square tubes segment by segment
	var bays := 5
	for k in bays + 1:
		var z := lerpf(z0, z1, float(k) / bays)
		for i in N:
			var a2: Vector3 = pt.call(i, z)
			var b2: Vector3 = pt.call(i + 1, z)
			var mid := (a2 + b2) * 0.5
			var seg: MeshInstance3D = v._box(Vector3(0.45, a2.distance_to(b2) + 0.08, 0.6 if k == bays else 0.35), mid, rib)
			seg.rotation.z = atan2(b2.y - a2.y, b2.x - a2.x) - PI * 0.5
	# purlins along the vault and the face's mullions
	for i in range(2, N, 3):
		var a3: Vector3 = pt.call(i, z0)
		v._box(Vector3(0.22, 0.22, z1 - z0), Vector3(a3.x, a3.y, (z0 + z1) * 0.5), rib)
	for xm in [-14.0, -9.0, -4.5, 4.5, 9.0, 14.0]:
		if absf(xm) >= R - 0.5:
			continue
		var top := spring + R * yk * sqrt(maxf(0.0, 1.0 - pow(xm / R, 2.0)))
		v._box(Vector3(0.22, top - 4.0, 0.3), Vector3(xm, 4.0 + (top - 4.0) * 0.5, z1 + 0.05), rib)
	# the legs: white columns down to the plaza
	for side in [-1.0, 1.0]:
		for z in [z0 + 0.5, z1]:
			v._box(Vector3(1.2, spring, 1.2), Vector3(side * R, spring * 0.5, z), rib, null, true)
	# the name and the plane mark lit on the face, a blue line along its crown
	_lit_name(Vector3(0, spring + R * yk * 0.62, z1 + 0.25), 260 if not shell else 300)
	v._box(Vector3(R * 1.6, 0.18, 0.18), Vector3(0, spring + R * yk * 0.42, z1 + 0.2), v._glow(v.accent, 3.0))
	if shell:
		# the swoop: its wings sweep down the facade either side, low white shells
		for side in [-1.0, 1.0]:
			var w: MeshInstance3D = v._box(Vector3(30.0, 0.6, 9.0), Vector3(side * (R + 13.0), 9.0, 30.0), skin)
			w.rotation.z = side * -0.18
			for k in 3:
				v._box(Vector3(0.5, 8.0 - k * 1.6, 0.5), Vector3(side * (R + 4.0 + k * 10.0), (8.0 - k * 1.6) * 0.5, 34.0), rib)

## Solmara: a sandstone arch, a geometric lattice over its glass face, warm light behind
func _lattice() -> void:
	var stone: Material = Materials.pbr("brick_4", Color(0.86, 0.72, 0.52), 2.0)
	var R := 17.0
	var spring := 7.0
	var z := 34.0
	var N := 20
	for i in N:
		var t0 := PI * float(i) / N
		var t1 := PI * float(i + 1) / N
		var a := Vector3(R * cos(t0), spring + R * 0.85 * sin(t0), z)
		var b := Vector3(R * cos(t1), spring + R * 0.85 * sin(t1), z)
		var seg: MeshInstance3D = v._box(Vector3(2.2, a.distance_to(b) + 0.2, 3.0), (a + b) * 0.5, stone)
		seg.rotation.z = atan2(b.y - a.y, b.x - a.x) - PI * 0.5
	for side in [-1.0, 1.0]:
		v._box(Vector3(2.4, spring, 3.0), Vector3(side * R, spring * 0.5, z), stone, null, true)
		v._box(Vector3(2.0, 0.25, 8.0), Vector3(side * R, spring + 0.1, z - 4.0), stone)
	# the lattice: diamonds of thin sandstone bars over warm glass
	var warm: Material = v._glow(Color(1.0, 0.78, 0.45), 0.9)
	v._box(Vector3(R * 2.0 - 3.0, spring + R * 0.85 - 1.0, 0.2), Vector3(0, (spring + R * 0.85 - 1.0) * 0.5, z - 1.4), v._glass(Color(1.0, 0.82, 0.55)))
	for i in range(-7, 8):
		for j in 9:
			var p := Vector3(i * 2.0, 4.5 + j * 2.0, z - 1.2)
			if absf(p.x) > R * sqrt(maxf(0.0, 1.0 - pow((p.y - spring) / (R * 0.85), 2.0))) - 1.5 and p.y > spring:
				continue
			if p.y < 4.6 and absf(p.x) < 7.0:
				continue     # the doors
			var d: MeshInstance3D = v._box(Vector3(0.18, 2.0, 0.18), p, stone)
			d.rotation.z = PI * 0.25
			var d2: MeshInstance3D = v._box(Vector3(0.18, 2.0, 0.18), p, stone)
			d2.rotation.z = -PI * 0.25
			if (i + j) % 5 == 0:
				v._box(Vector3(0.35, 0.35, 0.1), p, warm)
	_lit_name(Vector3(0, spring + R * 0.85 + 2.6, z + 1.6), 220)

## Eldergrove / Verdant: a steep timber A-frame over the doors, glulam beams, its gable glass
func _aframe() -> void:
	var timber: Material = Materials.pbr("brown_planks_03", Color(0.62, 0.45, 0.3), 2.0)
	var beam: Material = v._mat(Color(0.45, 0.3, 0.18), 0.6)
	var H := 26.0
	var W := 20.0
	var z0 := 27.0     # in front of the hall's facade (z 26): the A-frame is a porch, not a lid inside the hall
	var z1 := 38.0
	var ang := atan2(H, W)
	var L := sqrt(H * H + W * W)
	for side in [-1.0, 1.0]:
		# each slope runs from the ridge (0, H) down to the eave (±W, 0): a box along x turned down by the pitch
		var roof: MeshInstance3D = v._box(Vector3(L + 2.0, 0.6, z1 - z0 + 3.0), Vector3(side * W * 0.5, H * 0.5, (z0 + z1) * 0.5 + 1.0), timber)
		roof.rotation.z = -side * ang
		# the green roof edge (the board's planted eaves)
		var eave: MeshInstance3D = v._box(Vector3(L + 2.0, 0.3, 1.0), Vector3(side * W * 0.5, H * 0.5 + 0.35, z1 + 2.4), v._mat(Color(0.25, 0.42, 0.2), 0.9))
		eave.rotation.z = -side * ang
	for k in 5:
		var z := lerpf(z0, z1, float(k) / 4.0)
		for side in [-1.0, 1.0]:
			var b: MeshInstance3D = v._box(Vector3(L, 0.7, 0.7), Vector3(side * W * 0.5, H * 0.5 - 0.6, z), beam)
			b.rotation.z = -side * ang
		v._box(Vector3(W * 0.9, 0.5, 0.5), Vector3(0, H * 0.55, z), beam)
	# the gable: glass in a triangle, mullions
	var fs := SurfaceTool.new()
	fs.begin(Mesh.PRIMITIVE_TRIANGLES)
	for q in [Vector3(-W, 0, z1), Vector3(0, H, z1), Vector3(W, 0, z1)]:
		fs.add_vertex(q)
	fs.generate_normals()
	var face := MeshInstance3D.new()
	face.mesh = fs.commit()
	face.material_override = v._glass(v.look.get("glass", Color(0.6, 0.85, 0.7)))
	v.world.add_child(face)
	for xm in [-12.0, -6.0, 6.0, 12.0]:
		var top := H * (1.0 - absf(xm) / W)
		v._box(Vector3(0.35, top, 0.35), Vector3(xm, top * 0.5, z1 + 0.05), beam, null, absf(xm) > 9.0)
	for side in [-1.0, 1.0]:
		v._box(Vector3(W - 7.0, 4.0, 0.25), Vector3(side * (7.0 + (W - 7.0) * 0.5), 2.0, z1), v._glass(Color(0.6, 0.85, 0.7)), null, true)
	_lit_name(Vector3(0, 12.0, z1 + 0.3), 200)

# --------------------------------------------------------------------------------------------- the wings
## the boards' terminal runs long: a glass concourse wing west of the hall, behind the VIP lounge (z -44 .. -30; east is
## the hangars' apron), under a barrel roof of glass on white ribs, a lit band along its eaves, and more of
## the airline's planes at its jet bridges (HIGH / MEDIUM tiers). Seen and walked round, not walked through.
func _wings() -> void:
	var rib: Material = v._mat(Color(0.95, 0.96, 0.98) if not v.night else Color(0.7, 0.7, 0.78), 0.3, 0.45)
	var glass: Material = v._glass(v.look.get("glass", Color(0.55, 0.75, 0.95)))
	var solid: Material = v._mat((v.look.wall as Color), 0.6)
	var z0 := -44.0
	var z1 := -30.0
	var H := 7.0
	for side in [-1.0]:     # west: the east side is the hangars' apron (a wing there shut their doors)
		var xa: float = side * 52.0
		var xb: float = side * 196.0
		var L := absf(xb - xa)
		var cx: float = (xa + xb) * 0.5
		# the walls: glass on both long sides over a stone plinth, the far end solid
		v._box(Vector3(L, 1.0, 0.4), Vector3(cx, 0.5, z0), solid)
		v._box(Vector3(L, H - 1.0, 0.2), Vector3(cx, 1.0 + (H - 1.0) * 0.5, z0), glass)
		v._box(Vector3(L, H, 0.2), Vector3(cx, H * 0.5, z1), glass)
		v._box(Vector3(0.4, H, z1 - z0), Vector3(xb, H * 0.5, (z0 + z1) * 0.5), solid)
		v.obstacles.append(AABB(Vector3(minf(xa, xb), 0, z0), Vector3(L, H + 4.0, z1 - z0)))
		# the barrel roof (axis along x), glass, ribs every 8 m, mullions on the long walls
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var N := 14
		var R := (z1 - z0) * 0.5 + 0.6
		var zc := (z0 + z1) * 0.5
		for i in N:
			var t0 := PI * float(i) / N
			var t1 := PI * float(i + 1) / N
			var a := Vector3(xa, H + R * 0.45 * sin(t0), zc + R * cos(t0))
			var b := Vector3(xa, H + R * 0.45 * sin(t1), zc + R * cos(t1))
			var c := Vector3(xb, b.y, b.z)
			var d := Vector3(xb, a.y, a.z)
			for q in [a, b, c, a, c, d]:
				st.set_uv(Vector2(q.x / 6.0, q.z / 6.0))
				st.add_vertex(q)
		st.generate_normals()
		var roof := MeshInstance3D.new()
		roof.mesh = st.commit()
		var rm: Material = glass.duplicate()
		(rm as BaseMaterial3D).cull_mode = BaseMaterial3D.CULL_DISABLED
		roof.material_override = rm
		v.world.add_child(roof)
		var x: float = xa + side * 4.0
		while absf(x) < absf(xb) - 2.0:
			for i in N:
				var t0 := PI * float(i) / N
				var t1 := PI * float(i + 1) / N
				var a2 := Vector3(x, H + R * 0.45 * sin(t0), zc + R * cos(t0))
				var b2 := Vector3(x, H + R * 0.45 * sin(t1), zc + R * cos(t1))
				var seg: MeshInstance3D = v._box(Vector3(0.3, 0.3, a2.distance_to(b2) + 0.05), (a2 + b2) * 0.5, rib)
				seg.rotation.x = -atan2(b2.y - a2.y, b2.z - a2.z)
			v._box(Vector3(0.25, H, 0.3), Vector3(x, H * 0.5, z0 - 0.05), rib)
			v._box(Vector3(0.25, H, 0.3), Vector3(x, H * 0.5, z1 + 0.05), rib)
			x += side * 8.0
		v._box(Vector3(L, 0.25, 0.3), Vector3(cx, H + 0.05, z0 - 0.1), v._glow(v.accent, 2.6))
		v._box(Vector3(L, 0.4, 0.5), Vector3(cx, H, z1 + 0.1), rib)
		# inside, seen through the glass: warm light and rows of seats
		v._box(Vector3(L - 2.0, 0.08, 0.3), Vector3(cx, H - 0.4, zc), v._glow(Color(1.0, 0.88, 0.7), 2.0))
		for k in int(L / 12.0):
			var sx: float = xa + side * (6.0 + k * 12.0)
			v._box(Vector3(5.0, 0.9, 0.7), Vector3(sx, 0.45, zc - 2.0), v._mat(Color(0.15, 0.16, 0.2), 0.6))
		# gate numbers along the apron wall
		for k in 3:
			var gx: float = xa + side * (22.0 + k * 40.0)
			v._box(Vector3(5.0, 1.2, 0.2), Vector3(gx, H - 1.4, z0 - 0.2), v._mat(Color(0.05, 0.05, 0.06), 0.4))
			v._text("GATE %s%d" % ["C" if side < 0 else "D", k + 1], Vector3(gx, H - 1.4, z0 - 0.33), 70, Color(1.0, 0.85, 0.3), PI)
	_wing_planes()

## more of the airline's planes at the wings' bridges (east, clear of the hangars' aprons, and west to the remote stand)
func _wing_planes() -> void:
	if Phone.tier() == "low":
		return
	var jb: Material = v._mat(Color(0.82, 0.84, 0.87) if not v.night else Color(0.32, 0.32, 0.4), 0.4, 0.5)
	var spots := [Vector3(-96, 0, -70), Vector3(-130, 0, -72)]
	for i in spots.size():
		var p: Vector3 = spots[i]
		var plane: Node3D = v._airliner(v.accent if i % 2 == 0 else v.accent2, String(v.look.airline))
		plane.position = p
		plane.rotation.y = PI
		v.static_root.add_child(plane)
		v.obstacles.append(AABB(Vector3(p.x - 2.6, 0, p.z - 20.0), Vector3(5.2, 7.0, 40.0)))
		v.obstacles.append(AABB(Vector3(p.x - 17.5, 0, p.z - 6.0), Vector3(35.0, 4.0, 9.0)))
		# its bridge from the wing's apron wall to the front door
		var from := Vector3(p.x - 4.0, 0, -44.0)
		var door := Vector3(p.x + 2.25, 0, p.z + 14.4)
		var span := Vector2(door.x - from.x, door.z - from.z)
		var br := Node3D.new()
		br.position = Vector3((from.x + door.x) * 0.5, 4.4, (from.z + door.z) * 0.5)
		br.rotation.y = atan2(-span.x, -span.y)
		v.static_root.add_child(br)
		v._box(Vector3(2.7, 2.7, span.length()), Vector3.ZERO, jb, br)
		v._box(Vector3(2.9, 0.12, span.length()), Vector3(0, 1.42, 0), v._glow(v.accent, 1.4), br)
		v._box(Vector3(0.5, 3.0, 0.5), door + Vector3(0, 1.5, 4.0), jb)

# --------------------------------------------------------------------------------------------- landside
## the drop-off canopy along the kerb: a thin glass roof on slender columns, a light line under its edge
func _canopy() -> void:
	var col: Material = v._mat(Color(0.88, 0.9, 0.93) if not v.night else Color(0.3, 0.3, 0.38), 0.3, 0.6)
	var roof: Material = v._glass(Color(0.8, 0.9, 1.0))
	for side in [-1.0, 1.0]:
		var cx: float = side * 39.0
		v._box(Vector3(34, 0.25, 7.0), Vector3(cx, 6.0, 41.5), roof)
		v._box(Vector3(34.4, 0.35, 0.35), Vector3(cx, 5.9, 45.0), col)
		v._box(Vector3(34.4, 0.35, 0.35), Vector3(cx, 5.9, 38.0), col)
		v._box(Vector3(34, 0.1, 0.2), Vector3(cx, 5.7, 45.1), v._glow(v.accent, 2.5))
		for k in 5:
			var x: float = cx - 16.0 + k * 8.0
			v._box(Vector3(0.35, 5.9, 0.35), Vector3(x, 2.95, 44.6), col)
			v.obstacles.append(AABB(Vector3(x - 0.2, 0, 44.4), Vector3(0.4, 5.9, 0.4)))

## the second carriageway past a planted median: palms, flower beds and the airport's banners on poles, lane paint,
## cars at the kerb and along the road (fleet models), the forecourt's boundary as low hedges instead of grey walls
func _carriageway() -> void:
	var asphalt: Material = Materials.pbr("asphalt_02", Color(0.42, 0.42, 0.44) if not v.night else Color(0.2, 0.18, 0.24), 6.0, 0.6)
	var paint: Material = v._mat(Color(0.95, 0.95, 0.9), 0.6)
	v._box(Vector3(260, 0.1, 11), Vector3(0, 0.02, 70.5), asphalt)
	for x in range(-120, 121, 12):
		v._box(Vector3(5, 0.04, 0.25), Vector3(x, 0.09, 70.5), paint)
	v._box(Vector3(260, 0.04, 0.25), Vector3(0, 0.09, 65.6), v._mat(Color(0.95, 0.8, 0.2), 0.6))
	# the median: a raised verge with palms, flowers and banner poles
	v._box(Vector3(118, 0.5, 6.6), Vector3(0, 0.25, 61.5), v._mat(Color(0.72, 0.72, 0.74), 0.6))
	v._box(Vector3(117, 0.1, 6.0), Vector3(0, 0.52, 61.5), Materials.surface("brushed_concrete", Color(0.28, 0.45, 0.22), 4.0, 1.0))
	var pal := _flowers_palette()
	for x in [-45.0, -15.0, 15.0, 45.0]:
		_flowers(Vector3(x, 0.3, 61.5), Vector2(5.5, 1.8), pal, 70)
	for x in [-56.0, -30.0, 0.0, 30.0, 56.0]:
		v._palm(Vector3(x, 0.5, 61.5), int(x) + 11)
		if String(v.look.tree) != "palm" and v.static_root.get_child_count() > 0:
			# the forest airports' median trees: young ones (a full-grown pine filled the forecourt)
			var t: Node = v.static_root.get_child(v.static_root.get_child_count() - 1)
			if t is Node3D and not (t is MeshInstance3D):
				(t as Node3D).scale = Vector3.ONE * 0.45
	var pole: Material = v._mat(Color(0.75, 0.77, 0.8), 0.3, 0.8)
	for x in range(-52, 53, 13):
		if x % 2 == 0:
			continue
		v._cyl(0.12, 8.0, Vector3(x, 4.0, 59.2), pole, null, -1, 8)
		var flag: MeshInstance3D = v._box(Vector3(1.4, 3.0, 0.06), Vector3(x + 0.8, 5.8, 59.2), v._mat(v.accent.darkened(0.25), 0.6))
		v._text("✈", Vector3(x + 0.8, 6.2, 59.26), 110, Color.WHITE)
		v._text("✈", Vector3(x + 0.8, 6.2, 59.14), 110, Color.WHITE, PI)
		flag.set_meta("banner", true)
	# the boundary: the grey walls read as a pen; hedges in planters keep the same line
	var hedge: Material = v._mat(Color(0.2, 0.36, 0.18) if style not in ["arctic", "aurora", "desert", "volcanic", "expedition"] else (v.look.wall as Color).darkened(0.1), 0.9)
	v._box(Vector3(120, 1.3, 1.6), Vector3(0, 0.65, 79.5), hedge)
	for side in [-1.0, 1.0]:
		v._box(Vector3(1.6, 1.3, 54), Vector3(side * 59.6, 0.65, 53), hedge)
	# cars: at the kerb under the canopy and on the carriageways (HIGH and MEDIUM; the low tier keeps the one sedan)
	if Phone.tier() != "low":
		var cars := [["city-pod.glb", Vector3(-22, 0.1, 47.5), PI * 0.5], ["street/service-van.glb", Vector3(20, 0.1, 47.5), PI * 0.5],
			["tuner.glb", Vector3(-48, 0.1, 54.5), -PI * 0.5], ["luxury-sedan.glb", Vector3(36, 0.1, 68.0), PI * 0.5],
			["street-racer-lod.glb", Vector3(-12, 0.1, 73.0), -PI * 0.5], ["street/security-suv.glb", Vector3(64, 0.1, 73.0), -PI * 0.5]]
		for c in cars:
			_car(String(c[0]), c[1], float(c[2]))

## the monument sign: a stone base, the airport's name and mark on a dark panel, a fountain pool before it, flower beds
func _monument() -> void:
	var at := Vector3(-44, 0, 36)
	if style in ["nexus", "neon"]:
		at = Vector3(44, 0, 36)     # Nexus's globe fountain stands on the west plaza
	var stone: Material = v._mat((v.look.wall as Color).darkened(0.35), 0.5, 0.2)
	v._box(Vector3(9.0, 1.2, 2.2), at + Vector3(0, 0.6, 0), stone, null, true)
	var panel: MeshInstance3D = v._box(Vector3(8.0, 3.0, 0.5), at + Vector3(0, 2.7, 0), v._mat(Color(0.06, 0.07, 0.1), 0.25, 0.6))
	panel.rotation.x = -0.08
	v._box(Vector3(8.1, 0.12, 0.55), at + Vector3(0, 4.25, 0), v._glow(v.accent, 3.0))
	var lines := _name_lines()
	v._text("✈ " + String(lines[0]), at + Vector3(0, 3.1, 0.3), 90, Color(0.97, 0.98, 1.0))
	v._text(String(lines[1]), at + Vector3(0, 2.25, 0.3), 54, v.accent.lerp(Color.WHITE, 0.5))
	# the pool in front, lit, three low jets
	v._box(Vector3(9.0, 0.5, 3.0), at + Vector3(0, 0.25, 2.8), v._mat(Color(0.7, 0.72, 0.76), 0.3, 0.3))
	v._box(Vector3(8.4, 0.06, 2.4), at + Vector3(0, 0.52, 2.8), v._glow(Color(0.3, 0.7, 1.0), 0.9))
	for k in 3:
		v._cyl(0.08, 1.6, at + Vector3(-3.0 + k * 3.0, 1.2, 2.8), v._glow(Color(0.7, 0.9, 1.0), 1.4), null, 0.02, 6)
	v.obstacles.append(AABB(at + Vector3(-4.5, 0, 1.3), Vector3(9.0, 0.6, 3.0)))
	_flowers(at + Vector3(-7.5, 0, 1.0), Vector2(1.8, 2.6), _flowers_palette(), 40)
	_flowers(at + Vector3(7.5, 0, 1.0), Vector2(1.8, 2.6), _flowers_palette(), 40)

## the multi-storey car park west of the forecourt: four decks on columns, parapets, the ramp, P PARKING on its corner
func _parking() -> void:
	var c := Vector3(-100, 0, 54)
	var conc: Material = Materials.surface("brushed_concrete", Color(0.7, 0.71, 0.73) if not v.night else Color(0.3, 0.29, 0.34), 4.0, 0.9)
	var w := 46.0
	var d := 40.0
	for k in 4:
		var y := 0.2 + k * 3.6
		v._box(Vector3(w, 0.45, d), c + Vector3(0, y + 3.2, 0), conc)
		v._box(Vector3(w, 1.1, 0.3), c + Vector3(0, y + 3.95, d * 0.5), conc)
		v._box(Vector3(w, 1.1, 0.3), c + Vector3(0, y + 3.95, -d * 0.5), conc)
		v._box(Vector3(0.3, 1.1, d), c + Vector3(w * 0.5, y + 3.95, 0), conc)
		v._box(Vector3(w, 0.12, 0.2), c + Vector3(0, y + 4.55, d * 0.5 + 0.1), v._glow(v.accent, 1.4))
	for i in 5:
		for j in 4:
			v._box(Vector3(0.7, 14.6, 0.7), c + Vector3(-w * 0.5 + 2.0 + i * (w - 4.0) / 4.0, 7.3, -d * 0.5 + 2.0 + j * (d - 4.0) / 3.0), conc)
	v.obstacles.append(AABB(c - Vector3(w * 0.5, 0, d * 0.5), Vector3(w, 16.0, d)))
	# the P sign: a blue box with a white P, PARKING under it, on the corner tower
	var tower := c + Vector3(w * 0.5 - 2.0, 0, d * 0.5 - 2.0)
	v._box(Vector3(5.0, 18.0, 5.0), tower + Vector3(0, 9.0, 0), conc)
	v._box(Vector3(4.2, 4.2, 0.3), tower + Vector3(0, 13.5, 2.6), v._glow(Color(0.12, 0.35, 0.85), 1.6))
	v._text("P", tower + Vector3(0, 13.6, 2.8), 380, Color.WHITE)
	v._text("PARKING", tower + Vector3(0, 10.6, 2.8), 90, Color.WHITE)
	# cars on the decks (HIGH only: each is a model)
	if Phone.tier() == "high":
		var files := ["city-pod.glb", "tuner.glb", "luxury-sedan.glb", "street-racer-lod.glb"]
		for k in 3:
			for i in 3:
				_car(String(files[(k + i) % files.size()]), c + Vector3(-15.0 + i * 12.0, 0.2 + k * 3.6 + 3.45, 12.0), 0.0)

# --------------------------------------------------------------------------------------------- inside
## the hall's signs: DEPARTURES / ARRIVALS hung inside the doors (yellow on black, arrows), the wayfinding sign
func _signs() -> void:
	var black: Material = v._mat(Color(0.04, 0.04, 0.05), 0.35, 0.4)
	var yel := Color(1.0, 0.82, 0.18)
	for k in 2:
		var at := Vector3(-11.0 + k * 22.0, 6.4, 23.0)
		v._box(Vector3(9.0, 1.4, 0.2), at, black)
		v._box(Vector3(0.06, 3.0, 0.06), at + Vector3(-3.5, 2.2, 0), black)
		v._box(Vector3(0.06, 3.0, 0.06), at + Vector3(3.5, 2.2, 0), black)
		v._box(Vector3(1.0, 0.8, 0.05), at + Vector3(-3.6, 0, -0.13), v._glow(yel, 1.6))
		v._text("✈", at + Vector3(-3.6, 0.0, -0.17), 70, Color(0.05, 0.05, 0.05), PI)
		v._text("DEPARTURES   →" if k == 0 else "ARRIVALS   →", at + Vector3(0.6, 0, -0.12), 70, yel, PI)
		v._text("DEPARTURES   →" if k == 0 else "ARRIVALS   →", at + Vector3(0.6, 0, 0.12), 70, yel)
	# the wayfinding board on its post in the middle of the hall
	var sg := Vector3(8.0, 0, 12.0)
	v._box(Vector3(0.3, 3.6, 0.3), sg + Vector3(0, 1.8, 0), v._mat(Color(0.3, 0.3, 0.32), 0.4, 0.8), null, true)
	v._box(Vector3(3.6, 3.4, 0.25), sg + Vector3(0, 4.9, 0), black)
	var rows := ["Check-in        →", "Security        ↑", "All Gates       ↑", "Baggage Claim   →", "Ground Transport ↓"]
	for i in rows.size():
		v._box(Vector3(0.36, 0.36, 0.05), sg + Vector3(-1.45, 6.1 - i * 0.6, 0.14), v._glow(yel, 1.4))
		v._text(String(rows[i]), sg + Vector3(0.25, 6.1 - i * 0.6, 0.15), 36, yel)
		v._text(String(rows[i]), sg + Vector3(0.25, 6.1 - i * 0.6, -0.15), 36, yel, PI)

## the hall's own warm light: four real lights under the roof (no shadows), a warm line along the foot of each wall, and
## glowing columns' collars — so the hall reads lit from within, as on the boards
func _hall_glow() -> void:
	if v.night:
		return
	for at in [Vector3(-24, 9.0, 12), Vector3(18, 9.0, 12), Vector3(-24, 9.0, -16), Vector3(18, 9.0, -16)]:
		var o := OmniLight3D.new()
		o.position = at
		o.light_color = Color(1.0, 0.82, 0.6)
		o.light_energy = 1.1
		o.omni_range = 26.0
		o.omni_attenuation = 1.2
		o.shadow_enabled = false
		v.world.add_child(o)
	var warm: Material = v._glow(Color(1.0, 0.8, 0.55), 1.8)
	for side in [-1.0, 1.0]:
		v._box(Vector3(0.12, 0.1, 54.0), Vector3(side * 47.6, 0.12, -2.0), warm)
	v._box(Vector3(94.0, 0.1, 0.12), Vector3(0, 0.12, -29.6), warm)

## the upper level the boards' halls have: a gallery along each side wall at 6.5 m on a lit slab, a glass balustrade, and
## its row of shopfronts glowing warm behind (seen from the hall; nobody walks up there)
func _mezzanine() -> void:
	var slab: Material = v._mat(Color(0.9, 0.9, 0.92) if not v.night else Color(0.32, 0.28, 0.38), 0.4, 0.2)
	var glass: Material = v._glass(Color(0.75, 0.88, 1.0))
	var frame: Material = v._mat(Color(0.12, 0.12, 0.14), 0.35, 0.6)
	var warm := [Color(1.0, 0.8, 0.55), Color(0.95, 0.9, 0.8), Color(1.0, 0.7, 0.45), Color(0.85, 0.9, 1.0)]
	var names := ["DUTY FREE", "CAFÉ", "BOOKS", "TECH", "FASHION", "LOUNGE BAR"]
	for side in [-1.0, 1.0]:
		var x_wall: float = side * 47.8
		var x_edge: float = side * 41.8
		var x_mid: float = (x_wall + x_edge) * 0.5
		v._box(Vector3(6.0, 0.5, 44.0), Vector3(x_mid, 6.5, -2.0), slab)
		v._box(Vector3(0.12, 0.1, 44.0), Vector3(x_edge, 6.2, -2.0), v._glow(Color(1.0, 0.88, 0.7), 2.4))
		v._box(Vector3(0.06, 1.1, 44.0), Vector3(x_edge, 7.3, -2.0), glass)
		v._box(Vector3(0.12, 0.08, 44.0), Vector3(x_edge, 7.88, -2.0), frame)
		for k in 6:
			var z := 16.0 - k * 7.0
			var c: Color = warm[(k + (1 if side > 0 else 0)) % warm.size()]
			v._box(Vector3(0.1, 3.0, 6.2), Vector3(x_wall + side * -0.02, 8.3, z), frame)
			v._box(Vector3(0.06, 2.6, 5.6), Vector3(x_wall - side * 0.06, 8.2, z), v._glow(c, 0.9))
			v._text(String(names[(k + (3 if side > 0 else 0)) % names.size()]), Vector3(x_wall - side * 0.12, 9.55, z), 46, Color(0.08, 0.08, 0.1), -side * PI * 0.5)
		for k in 4:
			v._box(Vector3(0.5, 6.25, 0.5), Vector3(x_edge + side * 0.4, 3.12, 17.0 - k * 13.0), frame, null, true)

## check-in: a screen over every desk position, the header with the mark, a row of self check-in kiosks, belted lanes
func _checkin() -> void:
	var dark: Material = v._mat(Color(0.06, 0.07, 0.1), 0.3, 0.5)
	var screen: Material = v._glow(v.accent.lerp(Color(0.2, 0.45, 1.0), 0.5), 1.4)
	for i in 2:
		var z := 16.0 - i * 13.0
		for k in 4:
			var pz := z - 3.6 + k * 2.4
			v._box(Vector3(0.1, 0.55, 0.9), Vector3(-32.9, 1.75, pz), dark)
			v._box(Vector3(0.04, 0.45, 0.8), Vector3(-32.84, 1.75, pz), screen)
			v._box(Vector3(0.12, 0.7, 1.1), Vector3(-35.25, 4.3, pz), dark)
			v._box(Vector3(0.04, 0.6, 1.0), Vector3(-35.15, 4.3, pz), screen)
		# the queue: chrome posts in two lines with blue belts between them (seen, not walls)
		var post: Material = v._mat(Color(0.8, 0.82, 0.85), 0.2, 0.9)
		var belt: Material = v._mat(Color(0.1, 0.3, 0.85), 0.5)
		for line in [-27.4, -25.9]:
			for k in 6:
				var pz := z - 5.5 + k * 2.2
				v._cyl(0.05, 0.95, Vector3(line, 0.48, pz), post, null, -1, 6)
				v._cyl(0.16, 0.04, Vector3(line, 0.02, pz), post, null, -1, 10)
				if k < 5:
					v._box(Vector3(0.03, 0.06, 2.2), Vector3(line, 0.9, pz + 1.1), belt)
	v._box(Vector3(0.3, 1.6, 12.0), Vector3(-35.3, 7.0, 9.5), dark)
	v._text("✈  CHECK-IN", Vector3(-35.1, 7.0, 9.5), 120, Color(0.95, 0.97, 1.0), PI * 0.5)
	# the kiosks: slim white pillars with a lit screen, facing the hall
	var white: Material = v._mat(Color(0.94, 0.95, 0.97), 0.3, 0.2)
	for k in 12:
		var at := Vector3(-24.0 if k < 6 else -20.5, 0, 22.5 - (k % 6) * 1.8)
		v._box(Vector3(0.6, 1.5, 0.5), at + Vector3(0, 0.75, 0), white, null, true)
		var sc: MeshInstance3D = v._box(Vector3(0.52, 0.42, 0.05), at + Vector3(0.24, 1.42, 0), screen)
		sc.rotation.y = PI * 0.5
		sc.rotation.z = 0.3

## security: a lit number box over each lane, the tray tables before the scanners, the X-ray tunnel's hood
func _security() -> void:
	var lanes: Array = _k("LANES")
	var dark: Material = v._mat(Color(0.08, 0.09, 0.12), 0.35, 0.5)
	for i in lanes.size():
		var x: float = lanes[i]
		v._box(Vector3(1.0, 1.0, 0.3), Vector3(x, 4.4, _k("SECURITY_Z") + 0.4), dark)
		v._text(str(i + 1), Vector3(x, 4.4, _k("SECURITY_Z") + 0.58), 110, Color(0.95, 0.97, 1.0))
		v._box(Vector3(1.05, 0.08, 0.32), Vector3(x, 4.95, _k("SECURITY_Z") + 0.4), v._glow(v.accent, 2.4))
		# the tray table and its trays
		v._box(Vector3(1.0, 0.85, 3.2), Vector3(x + 2.3, 0.42, _k("SECURITY_Z") + 5.4), v._mat(Color(0.7, 0.72, 0.75), 0.3, 0.8), null, true)
		for t in 3:
			v._box(Vector3(0.6, 0.12, 0.8), Vector3(x + 2.3, 0.92, _k("SECURITY_Z") + 4.4 + t * 0.95), v._mat(Color(0.2, 0.22, 0.26), 0.5))
		# the X-ray tunnel's hood over the belt
		v._box(Vector3(1.2, 1.0, 1.4), Vector3(x + 2.3, 1.4, _k("SECURITY_Z") + 2.4), dark)
		v._box(Vector3(1.22, 0.1, 0.1), Vector3(x + 2.3, 1.9, _k("SECURITY_Z") + 3.1), v._glow(Color(0.3, 1.0, 0.5), 2.0))
	v._box(Vector3(14, 1.0, 0.3), Vector3(0, 5.8, _k("SECURITY_Z") + 0.4), dark)
	v._text("SECURITY CHECKPOINT", Vector3(0, 5.8, _k("SECURITY_Z") + 0.58), 80, Color(0.95, 0.97, 1.0))

## the hall's centre: the LED column with its rings of light, the round sofa and palms round it (Nexus, Neon)
func _column() -> void:
	var at := Vector3(-6, 0, 15.5)
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded;
uniform vec4 a : source_color;
uniform vec4 b : source_color;
void fragment() {
	float band = 0.5 + 0.5 * sin(UV.y * 18.0 - TIME * 1.6);
	float towers = step(fract(UV.x * 24.0), 0.55) * step(UV.y, 0.25 + 0.2 * fract(sin(floor(UV.x * 24.0) * 12.9) * 43.7));
	vec3 c = mix(b.rgb, a.rgb, band * 0.6) * 1.4;
	c = mix(c, vec3(0.9, 0.95, 1.0), towers * 0.7);
	ALBEDO = c;
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("a", v.accent)
	m.set_shader_parameter("b", Color(0.03, 0.06, 0.16) if style == "nexus" else Color(0.12, 0.02, 0.18))
	var col := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 1.7
	cm.bottom_radius = 1.7
	cm.height = 9.0
	cm.radial_segments = 32
	col.mesh = cm
	col.material_override = m
	col.position = at + Vector3(0, 5.3, 0)
	v.world.add_child(col)
	v._cyl(1.85, 0.4, at + Vector3(0, 0.6, 0), v._mat(Color(0.85, 0.86, 0.9), 0.3, 0.6), null, -1, 32)
	v._cyl(1.85, 0.3, at + Vector3(0, 9.95, 0), v._mat(Color(0.85, 0.86, 0.9), 0.3, 0.6), null, -1, 32)
	# the halo: three rings of light round the head, tilted
	for k in 3:
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 3.6 + k * 1.3
		tm.outer_radius = 3.8 + k * 1.3
		tm.rings = 48
		tm.ring_segments = 6
		ring.mesh = tm
		ring.material_override = v._glow(v.accent.lerp(Color.WHITE, 0.4), 3.0)
		ring.position = at + Vector3(0, 11.0 + k * 0.6, 0)
		ring.rotation = Vector3(0.12 * (k - 1), k * 0.7, 0.08 * k)
		ring.set_meta("dynamic", true)
		v.world.add_child(ring)
	# the round sofa and its palms
	var sofa: Material = v._mat(Color(0.82, 0.78, 0.72) if style == "nexus" else Color(0.3, 0.18, 0.38), 0.8)
	for k in 10:
		var a := k * TAU / 10.0
		var p := at + Vector3(cos(a) * 3.4, 0, sin(a) * 3.4)
		var s: MeshInstance3D = v._box(Vector3(1.9, 0.45, 0.9), p + Vector3(0, 0.25, 0), sofa)
		s.rotation.y = -a
		var bk: MeshInstance3D = v._box(Vector3(1.9, 0.6, 0.25), p + Vector3(cos(a) * 0.45, 0.6, sin(a) * 0.45), sofa)
		bk.rotation.y = -a
	for k in 4:
		var a2 := PI * 0.25 + k * PI * 0.5
		v._palm(at + Vector3(cos(a2) * 6.2, 0, sin(a2) * 6.2), k + 40)

## the gate lounges: rows of seats facing the windows between the gate desks, a planter at each row's end
func _gate_seats() -> void:
	for i in 6:
		var x := -32.0 + i * 16.0
		if x > 44.0:
			break
		for k in 2:
			v._bench(Vector3(x - 2.0 + k * 4.0, 0, -22.6), PI)
		# a white pot with a young tree (the city planter model's leaves broke into speckles at this size)
		v._cyl(0.6, 0.9, Vector3(x + 4.6, 0.45, -22.6), v._mat(Color(0.92, 0.93, 0.95), 0.3, 0.2), null, 0.5, 16)
		var tr: Node3D = v._model("res://models/foliage/broadleaf.glb")
		if tr:
			tr.position = Vector3(x + 4.6, 0.85, -22.6)
			tr.scale = Vector3.ONE * 0.2
			v.static_root.add_child(tr)
		v.obstacles.append(AABB(Vector3(x + 3.9, 0, -23.3), Vector3(1.4, 1.0, 1.4)))

## the VIP lounge: a marble reception desk, the logo wall behind it, lamps, sofas
func _vip() -> void:
	var r: Rect2 = _k("VIP")
	var c := Vector3(r.position.x + r.size.x * 0.5, 0, r.position.y + r.size.y * 0.5)
	var marble: Material = Materials.pbr("marble_01", Color(0.95, 0.94, 0.92), 1.0, 0.25)
	var back := Vector3(r.position.x + 1.2, 0, c.z)
	v._box(Vector3(0.4, 4.2, 9.0), back + Vector3(0, 2.1, 0), v._mat(Color(0.08, 0.07, 0.07), 0.3, 0.5), null, true)
	v._text("✈", back + Vector3(0.25, 3.1, 0), 160, Color(0.95, 0.85, 0.6), PI * 0.5)
	v._text("%s VIP LOUNGE" % String(_name_lines()[0]), back + Vector3(0.25, 2.0, 0), 60, Color(0.95, 0.88, 0.7), PI * 0.5)
	v._box(Vector3(1.2, 1.1, 5.0), back + Vector3(3.0, 0.55, 0), marble, null, true)
	v._box(Vector3(1.3, 0.08, 5.1), back + Vector3(3.0, 1.12, 0), v._glow(Color(1.0, 0.85, 0.6), 1.2))
	for k in 3:
		var lamp := back + Vector3(6.0 + k * 5.0, 0, r.position.y + r.size.y - c.z - 1.6)
		v._cyl(0.06, 1.6, lamp + Vector3(0, 0.8, 0), v._mat(Color(0.75, 0.6, 0.35), 0.3, 0.9), null, -1, 8)
		v._cyl(0.35, 0.45, lamp + Vector3(0, 1.75, 0), v._glow(Color(1.0, 0.85, 0.6), 1.6), null, 0.25, 12)
	var sofa: Node3D = v._model("res://models/city/sofa.glb")
	for k in 2:
		if sofa == null:
			break
		var s: Node3D = sofa if k == 0 else v._model("res://models/city/sofa.glb")
		s.position = c + Vector3(2.0, 0, -4.0 + k * 8.0)
		s.rotation.y = PI * 0.5 if k == 0 else -PI * 0.5
		v.static_root.add_child(s)

## the hangars lit and fitted: white lining, a ring of light panels under the roof, yellow work platforms, tool carts
func _hangar() -> void:
	var lining: Material = v._mat(Color(0.88, 0.89, 0.9), 0.5, 0.2)
	var panel: Material = v._glow(Color(1.0, 0.98, 0.92), 2.2)
	var yellow: Material = v._mat(Color(0.95, 0.75, 0.12), 0.5, 0.4)
	var red: Material = v._mat(Color(0.75, 0.12, 0.1), 0.4, 0.5)
	for cx in _k("HANGAR_X"):
		v._box(Vector3(27.0, 8.0, 0.2), Vector3(cx, 4.0, 15.6), lining)
		v._text("✈", Vector3(cx, 6.2, 15.45), 260, v.accent, PI)
		# a white ceiling under the barrel roof (its plate texture read black from inside) and the light panels in it
		var ceil: Material = v._glow(Color(0.86, 0.88, 0.9), 0.35)
		v._box(Vector3(27.4, 0.12, 29.0), Vector3(cx, 9.75, 1.0), ceil)
		for k in 3:
			v._box(Vector3(22.0, 0.15, 1.2), Vector3(cx, 9.6, -6.0 + k * 8.0), panel)
		# the work platform: a deck on four legs with a stair and rails, by the side wall
		var pf := Vector3(cx + 10.5, 0, 6.0)
		v._box(Vector3(3.0, 0.2, 5.0), pf + Vector3(0, 3.0, 0), yellow)
		for lx in [-1.3, 1.3]:
			for lz in [-2.3, 2.3]:
				v._box(Vector3(0.15, 3.0, 0.15), pf + Vector3(lx, 1.5, lz), yellow)
			v._box(Vector3(0.08, 1.0, 5.0), pf + Vector3(lx, 3.6, 0), yellow)
		var stair: MeshInstance3D = v._box(Vector3(1.2, 0.15, 4.4), pf + Vector3(0, 1.5, -4.4), yellow)
		stair.rotation.x = 0.68
		v.obstacles.append(AABB(pf - Vector3(1.5, 0, 2.5), Vector3(3.0, 3.2, 5.0)))
		# tool carts
		for k in 2:
			var tc := Vector3(cx - 4.0 + k * 3.0, 0, 8.0)
			v._box(Vector3(1.2, 1.0, 0.6), tc + Vector3(0, 0.55, 0), red)
			v._box(Vector3(1.25, 0.06, 0.65), tc + Vector3(0, 1.08, 0), v._mat(Color(0.3, 0.3, 0.32), 0.4, 0.8))
		var lamp := OmniLight3D.new()
		lamp.position = Vector3(cx, 7.5, -4.0)
		lamp.omni_range = 20.0
		lamp.light_energy = 1.4
		v.world.add_child(lamp)

# --------------------------------------------------------------------------------------------- airside
## baggage trains of ULD containers by the stands, service vans at two stands, blue taxiway edge lights, the runway's
## touchdown marks
func _airside() -> void:
	var uld: Material = v._mat(Color(0.82, 0.84, 0.86), 0.4, 0.7)
	var cart: Material = v._mat(Color(0.12, 0.12, 0.14), 0.7)
	for g in 3:
		var base := Vector3(-60.0 + g * 40.0, 0, -44.0)
		for k in 4:
			var p := base + Vector3(k * 2.4, 0, 0)
			v._box(Vector3(2.0, 0.35, 1.6), p + Vector3(0, 0.35, 0), cart)
			v._box(Vector3(1.6, 1.5, 1.5), p + Vector3(0, 1.3, 0), uld)
			v._box(Vector3(1.62, 0.08, 1.52), p + Vector3(0, 1.0, 0), v._mat(v.accent.darkened(0.2), 0.5))
		v.obstacles.append(AABB(base - Vector3(1.2, 0, 0.9), Vector3(9.6, 2.1, 1.8)))
	if Phone.tier() != "low":
		_car("street/service-van.glb", Vector3(-26, 0, -52), PI * 0.5)
		_car("street/cargo-hauler.glb", Vector3(12, 0, -50), -PI * 0.5)
	# taxiway edge lights in blue along both edges of the parallel taxiway
	var blue: Material = v._glow(Color(0.25, 0.45, 1.0), 3.0)
	for x in range(-200, 281, 16):
		for side in [-1.0, 1.0]:
			v._box(Vector3(0.3, 0.3, 0.3), Vector3(x, 0.15, -100.0 + side * 12.6), blue)
	# touchdown zone and aiming point blocks past each threshold
	var paint: Material = v._mat(Color(0.96, 0.96, 0.94), 0.6)
	for side in [-1.0, 1.0]:
		for k in 3:
			for lane in [-1.0, 1.0]:
				v._box(Vector3(22.0, 0.03, 1.8), Vector3(side * (300.0 - k * 45.0), 0.085, _k("RUNWAY_Z") + lane * (7.0 + k * 0.0)), paint)
		for lane in [-1.0, 1.0]:
			v._box(Vector3(45.0, 0.03, 3.6), Vector3(side * 160.0, 0.085, _k("RUNWAY_Z") + lane * 8.5), paint)

# --------------------------------------------------------------------------------------------- the settings
## Thalassia: the underwater city glowing offshore (a lit dome on the sea, its spires), a pier bridge out to it
func _thalassia() -> void:
	var at := Vector3(380, -2, 260)
	var dome := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 70.0
	sm.height = 70.0
	sm.is_hemisphere = true
	dome.mesh = sm
	var gm: StandardMaterial3D = v._glass(Color(0.3, 0.75, 1.0)).duplicate()
	gm.emission_enabled = true
	gm.emission = Color(0.2, 0.6, 1.0)
	gm.emission_energy_multiplier = 0.8
	dome.material_override = gm
	dome.position = at
	v.world.add_child(dome)
	var rng := RandomNumberGenerator.new()
	rng.seed = 61
	for k in 9:
		var h := rng.randf_range(25, 60)
		v._cyl(rng.randf_range(3, 6), h, at + Vector3(rng.randf_range(-35, 35), h * 0.5, rng.randf_range(-35, 35)), v._glow(Color(0.5, 0.85, 1.0), 1.4), null, 0.6, 8)
	# the pier: a deck on piles from the forecourt's east edge out over the water
	var deck: Material = v._mat(Color(0.88, 0.9, 0.92), 0.4, 0.3)
	for k in 14:
		var p := Vector3(70.0 + k * 20.0, 0, 60.0 + k * 14.0)
		var seg: MeshInstance3D = v._box(Vector3(22.0, 0.6, 5.0), p + Vector3(0, 2.0, 0), deck)
		seg.rotation.y = -atan2(14.0, 20.0)
		v._box(Vector3(0.8, 6.0, 0.8), p + Vector3(0, -1.0, 0), deck)
		v._box(Vector3(0.2, 0.2, 0.2), p + Vector3(0, 3.0, 2.4), v._glow(Color(0.4, 0.85, 1.0), 2.5))

## Eldergrove / Verdant: the falls down the cliff north of the field, a lit pool at their foot
func _waterfall() -> void:
	var at := Vector3(-330, 0, -420)
	var rock: Material = v._mat(Color(0.32, 0.33, 0.3), 0.95)
	v._box(Vector3(160, 110, 40), at + Vector3(0, 55, -20), rock)
	var fall := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(22, 104)
	fall.mesh = qm
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded, cull_disabled;
void fragment() {
	float s = fract(UV.y * 3.0 - TIME * 1.4 + sin(UV.x * 30.0) * 0.08);
	float streak = smoothstep(0.0, 0.5, s) * (0.6 + 0.4 * sin(UV.x * 80.0));
	ALBEDO = mix(vec3(0.75, 0.85, 0.9), vec3(1.0), streak);
	ALPHA = 0.75 + 0.2 * streak;
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	fall.material_override = m
	fall.position = at + Vector3(0, 55, 0.6)
	v.world.add_child(fall)
	v._box(Vector3(40, 0.4, 20), at + Vector3(0, 0.3, 10), v._glow(Color(0.5, 0.75, 0.85), 0.5))

## Solmara: red mesas on the horizon past the dunes
func _mesas() -> void:
	var rock: Material = v._mat(Color(0.62, 0.36, 0.24), 0.95)
	var cap: Material = v._mat(Color(0.72, 0.46, 0.3), 0.9)
	for k in 5:
		var at := Vector3(-700.0 + k * 330.0, 0, -900.0 - (k % 2) * 140.0)
		var w := 180.0 + (k % 3) * 60.0
		var h := 70.0 + (k % 2) * 40.0
		v._cyl(w * 0.5, h, at + Vector3(0, h * 0.5, 0), rock, null, w * 0.42, 9)
		v._cyl(w * 0.43, 6.0, at + Vector3(0, h + 3.0, 0), cap, null, w * 0.4, 9)

## Frostveil / Aurora: ice sculptures by the doors and a fireplace lounge with armchairs
func _frost_lounge() -> void:
	var ice: Material = v._mat(Color(0.75, 0.92, 1.0), 0.05, 0.1)
	for k in 3:
		var at := Vector3(18.0 + k * 6.0, 0, 18.0)
		v._cyl(0.9, 0.5, at + Vector3(0, 0.25, 0), v._mat(Color(0.9, 0.93, 0.98), 0.3), null, -1, 12)
		var s: MeshInstance3D = v._cyl(0.8, 3.5 + k, at + Vector3(0, 2.2 + k * 0.5, 0), ice, null, 0.05, 6)
		s.rotation.y = k * 0.6
		v.obstacles.append(AABB(at - Vector3(0.9, 0, 0.9), Vector3(1.8, 3.0, 1.8)))
	var fp := Vector3(-20, 0, -26.5)
	v._box(Vector3(5.0, 3.6, 1.0), fp + Vector3(0, 1.8, 0), Materials.pbr("brick_4", Color(0.5, 0.48, 0.46), 1.0), null, true)
	v._box(Vector3(2.6, 1.2, 0.2), fp + Vector3(0, 0.9, 0.45), v._glow(Color(1.0, 0.5, 0.15), 3.5))
	var o := OmniLight3D.new()
	o.position = fp + Vector3(0, 1.2, 1.4)
	o.light_color = Color(1.0, 0.6, 0.3)
	o.light_energy = 1.6
	o.omni_range = 9.0
	v.world.add_child(o)
	for k in 3:
		var ch := fp + Vector3(-3.0 + k * 3.0, 0, 3.6)
		v._box(Vector3(1.2, 0.5, 1.1), ch + Vector3(0, 0.35, 0), v._mat(Color(0.45, 0.25, 0.18), 0.7), null, true)
		v._box(Vector3(1.2, 0.9, 0.25), ch + Vector3(0, 0.8, 0.45), v._mat(Color(0.45, 0.25, 0.18), 0.7))

## Neon: the gaming and entertainment zone — a row of lit arcade cabinets and a big screen wall
func _gaming() -> void:
	var cab: Material = v._mat(Color(0.06, 0.05, 0.1), 0.3, 0.5)
	for k in 6:
		var at := Vector3(12.0 + k * 2.2, 0, 21.5)
		v._box(Vector3(1.4, 2.0, 1.0), at + Vector3(0, 1.0, 0), cab, null, true)
		v._box(Vector3(1.1, 0.8, 0.05), at + Vector3(0, 1.5, -0.52), v._glow(Color(0.3, 0.85, 1.0) if k % 2 == 0 else Color(0.95, 0.3, 0.9), 2.2))
		v._box(Vector3(1.42, 0.12, 1.02), at + Vector3(0, 2.05, 0), v._glow(Color(0.95, 0.3, 0.9), 3.0))
	v._box(Vector3(14, 3.0, 0.3), Vector3(17.5, 5.0, 23.5), v._glow(Color(0.35, 0.15, 0.6), 1.6))
	v._text("GAMING ZONE", Vector3(17.5, 5.0, 23.3), 120, Color(0.4, 0.95, 1.0), PI)

## Thalassia's marine terminal: jellyfish of light drifting under the roof (a glowing bell, trailing threads)
func _jellyfish() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	for k in 9:
		var at := Vector3(rng.randf_range(-36, 30), rng.randf_range(8.0, 11.5), rng.randf_range(-24, 20))
		var col := Color(0.4, 0.85, 1.0) if k % 3 else Color(0.85, 0.5, 1.0)
		var bell := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 1.1
		sm.height = 1.1
		sm.is_hemisphere = true
		bell.mesh = sm
		var m: StandardMaterial3D = v._glass(col).duplicate()
		m.emission_enabled = true
		m.emission = col
		m.emission_energy_multiplier = 1.4
		bell.material_override = m
		bell.position = at
		v.world.add_child(bell)
		for t in 6:
			var a := t * TAU / 6.0
			v._cyl(0.03, 2.6, at + Vector3(cos(a) * 0.6, -1.3, sin(a) * 0.6), v._glow(col, 1.8), null, 0.01, 4)

## Eldergrove / Verdant: trees growing in the hall, in round timber planters
func _indoor_trees() -> void:
	for at in [Vector3(-14, 0, 4), Vector3(14, 0, 3)]:
		v._cyl(2.4, 0.8, at + Vector3(0, 0.4, 0), Materials.pbr("brown_planks_03", Color(0.62, 0.45, 0.3), 1.0), null, -1, 16)
		v._cyl(2.2, 0.08, at + Vector3(0, 0.82, 0), v._mat(Color(0.2, 0.15, 0.1), 0.95), null, -1, 16)
		v.obstacles.append(AABB(at - Vector3(2.4, 0, 2.4), Vector3(4.8, 2.0, 4.8)))
		var t: Node3D = v._model("res://models/foliage/broadleaf.glb")
		if t:
			t.position = at + Vector3(0, 0.8, 0)
			t.scale = Vector3.ONE * 0.55
			v.static_root.add_child(t)

## Solmara's local market past security: stalls under striped awnings, goods lit on their counters
func _market() -> void:
	var wood: Material = v._mat(Color(0.55, 0.38, 0.22), 0.7)
	var stripes := [Color(0.85, 0.3, 0.2), Color(0.95, 0.75, 0.3), Color(0.2, 0.55, 0.6)]
	for k in 3:
		var at := Vector3(12.0 + k * 7.0, 0, -10.0)
		v._box(Vector3(5.0, 1.0, 1.6), at + Vector3(0, 0.5, 0), wood, null, true)
		for c in 4:
			v._box(Vector3(0.6, 0.35, 0.6), at + Vector3(-1.8 + c * 1.2, 1.18, 0), v._glow((stripes[(k + c) % 3] as Color).lightened(0.3), 0.5))
		for px in [-2.4, 2.4]:
			v._box(Vector3(0.12, 3.2, 0.12), at + Vector3(px, 1.6, -0.8), wood)
		for st in 5:
			var awn: MeshInstance3D = v._box(Vector3(1.0, 0.06, 2.6), at + Vector3(-2.0 + st * 1.0, 3.1, 0.2), v._mat(stripes[k % 3] if st % 2 == 0 else Color(0.96, 0.94, 0.88), 0.8))
			awn.rotation.x = -0.25
	v._text("LOCAL MARKET & DINING", Vector3(19.0, 4.6, -10.0), 70, Color(1.0, 0.85, 0.5), 0.0, null, true)

## the boards' city behind the field: a second, taller row of towers beyond the first (the downtown, tallest in the
## middle), a cluster off to the west as the Nexus sheet has it, and a blue-hazed ridge of hills behind it all.
## Building models only (models/buildings), each stood on the ground at its own proportions.
func _city_backdrop() -> void:
	var files := ["nexus-spire", "nexus-civic-a", "nexus-civic-b", "nexus-civic-c", "nexus-terrace-a", "nexus-terrace-b"] if style == "nexus" else \
		["neon-tower-a", "neon-tower-b", "neon-tower-c", "neon-v-A", "neon-v-B", "neon-v-C"]
	var rng := RandomNumberGenerator.new()
	rng.seed = 211
	var n := 22 if Phone.tier() == "high" else (12 if Phone.tier() == "medium" else 0)
	var spots: Array = []
	for k in n:
		var t := float(k) / maxf(1.0, n - 1)
		# a downtown: tallest at its middle, thinning out to its edges
		var x := lerpf(-620.0, 620.0, t) + rng.randf_range(-25, 25)
		var tall := 1.0 + 1.1 * exp(-pow((x - 80.0) / 260.0, 2.0))
		spots.append([Vector3(x, 0, -1040.0 - rng.randf_range(0, 180)), rng.randf_range(2.8, 3.4) * tall])
	for k in (8 if Phone.tier() == "high" else (4 if Phone.tier() == "medium" else 0)):
		spots.append([Vector3(-760.0 - rng.randf_range(0, 220), 0, -260.0 - k * 70.0), rng.randf_range(2.6, 3.6)])
	for i in spots.size():
		var m: Node3D = v._model("res://models/buildings/%s.glb" % files[(i * 5) % files.size()])
		if m == null:
			continue
		m.position = spots[i][0]
		m.rotation.y = rng.randf_range(0, TAU)
		var sc: float = spots[i][1]
		m.scale = Vector3(sc, sc, sc)
		m.set_meta("skyline", true)
		v.static_root.add_child(m)
		var low := INF
		for c in m.find_children("*", "MeshInstance3D", true, false):
			var mi := c as MeshInstance3D
			var b: AABB = mi.global_transform * mi.get_aabb()
			low = minf(low, b.position.y)
		if low < INF:
			m.position.y -= low
	# glaze every skyline tower: the models' pale concrete washed out across the field (Nov 21, the owner: "Fix")
	var glazed := {}
	for m2 in v.static_root.get_children():
		if m2 is Node3D and m2.has_meta("skyline"):
			_glaze(m2, glazed)
	# the hills behind, hazed blue by distance (no snow: the Nexus sheet's are green-grey, soft)
	var hill: Material = v._mat(Color(0.36, 0.44, 0.52) if style == "nexus" else Color(0.16, 0.12, 0.24), 0.95)
	for k in 11:
		var x2 := -1500.0 + k * 300.0 + rng.randf_range(-60, 60)
		var h := rng.randf_range(180, 360)
		var base := rng.randf_range(300, 460)
		var c2: MeshInstance3D = v._cyl(base, h, Vector3(x2, h * 0.5 - 4.0, -1700.0 - rng.randf_range(0, 250)), hill, null, base * 0.08, 9)
		c2.rotation.y = rng.randf() * TAU

## the apron at work around each parked plane: a ground power unit by the nose, cones at the wingtips and tail, chocks
## at the nose wheel, a trolley of bags, and more container trains on the service road behind the stands. Equipment
## only — the tugs and loaders wait for real models.
func _apron_kit() -> void:
	var cone: Material = v._mat(Color(1.0, 0.45, 0.08), 0.6)
	var white: Material = v._mat(Color(0.95, 0.95, 0.93), 0.5)
	var gpu: Material = v._mat(Color(0.92, 0.78, 0.15), 0.5, 0.3)
	var dark: Material = v._mat(Color(0.1, 0.1, 0.12), 0.7)
	var bags := [Color(0.15, 0.2, 0.45), Color(0.6, 0.12, 0.1), Color(0.12, 0.12, 0.14), Color(0.35, 0.5, 0.35), Color(0.75, 0.62, 0.4)]
	var gates: Array = Air.GATES
	var stands: Array = []
	for i in gates.size():
		if i % 2 == 0:
			var px := -40.0 + i * 16.0 + 4.0
			stands.append(Vector3(px, 0, -66.0 - (6.0 if i % 4 == 2 else 0.0)))
	stands.append(Vector3(-96, 0, -70))
	stands.append(Vector3(-130, 0, -72))
	for p in stands:
		var nose: Vector3 = p + Vector3(0, 0, 19.5)
		# the ground power unit and its cable to the nose
		v._box(Vector3(1.6, 1.2, 2.4), nose + Vector3(4.5, 0.6, -2.0), gpu)
		v._box(Vector3(1.62, 0.25, 2.42), nose + Vector3(4.5, 0.1, -2.0), dark)
		v._box(Vector3(3.2, 0.08, 0.08), nose + Vector3(2.9, 0.06, -2.0), dark)
		v.obstacles.append(AABB(nose + Vector3(3.7, 0, -3.2), Vector3(1.6, 1.3, 2.4)))
		# chocks at the nose wheel
		for dz in [-0.6, 0.6]:
			v._box(Vector3(0.9, 0.3, 0.3), nose + Vector3(0, 0.15, -4.2 + dz), gpu)
		# cones: at each wingtip, the tail and the nose
		for c in [Vector3(-17.5, 0, -6.0), Vector3(17.5, 0, -6.0), Vector3(0, 0, -22.0), Vector3(-2.5, 0, 2.0)]:
			var at: Vector3 = p + c + (Vector3(0, 0, 19.5) if c.z == 2.0 else Vector3.ZERO)
			v._cyl(0.22, 0.75, at + Vector3(0, 0.375, 0), cone, null, 0.03, 8)
			v._cyl(0.2, 0.12, at + Vector3(0, 0.5, 0), white, null, 0.12, 8)
			v._box(Vector3(0.45, 0.04, 0.45), at + Vector3(0, 0.02, 0), cone)
		# a bag trolley by the hold, its bags in a heap
		var tr: Vector3 = p + Vector3(-5.0, 0, 4.0)
		v._box(Vector3(2.4, 0.15, 1.5), tr + Vector3(0, 0.55, 0), dark)
		for w in [-1.0, 1.0]:
			v._box(Vector3(2.4, 0.9, 0.05), tr + Vector3(0, 0.95, w * 0.74), dark)
		for b in 6:
			var bag: MeshInstance3D = v._box(Vector3(0.7, 0.45, 0.35), tr + Vector3(-0.8 + (b % 3) * 0.8, 0.85 + (b / 3) * 0.45, -0.25 + (b % 2) * 0.5), v._mat(bags[b % bags.size()], 0.6))
			bag.rotation.y = 0.2 * (b - 3)
		v.obstacles.append(AABB(tr - Vector3(1.2, 0, 0.75), Vector3(2.4, 1.6, 1.5)))
	# container trains on the service road behind the stands (z -38), and a line of empty dollies
	var uld: Material = v._mat(Color(0.8, 0.82, 0.85), 0.4, 0.7)
	for g in 4:
		var base := Vector3(-150.0 + g * 52.0, 0, -37.5)
		if base.x < -50.0:
			base.z = -48.0     # the west wing stands on the road there
		for k in 5:
			var q := base + Vector3(k * 2.4, 0, 0)
			v._box(Vector3(2.0, 0.35, 1.6), q + Vector3(0, 0.35, 0), dark)
			if k < 3 + (g % 2):
				v._box(Vector3(1.6, 1.5, 1.5), q + Vector3(0, 1.3, 0), uld)
				v._box(Vector3(1.62, 0.08, 1.52), q + Vector3(0, 1.0, 0), v._mat(v.accent.darkened(0.2), 0.5))
		v.obstacles.append(AABB(base - Vector3(1.2, 0, 0.9), Vector3(12.0, 2.1, 1.8)))

## a tower's surfaces as the boards' glass city: darker, blue-grey, a glassy sheen that catches the sky; Neon's darker
## still and violet. Materials are shared, so each original is glazed once (`done` maps old -> new).
func _glaze(n: Node, done: Dictionary) -> void:
	var tint := Color(0.4, 0.5, 0.66) if style == "nexus" else Color(0.3, 0.24, 0.44)
	# the glaze goes into a copy of each mesh (StaticBatch folds meshes by their own surface materials, so an override
	# on the instance was lost when the field was batched)
	for c in n.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		if not (mi.mesh is ArrayMesh):
			continue
		if not done.has(mi.mesh):
			var am: ArrayMesh = (mi.mesh as ArrayMesh).duplicate()
			for i in am.get_surface_count():
				var src: Material = am.surface_get_material(i)
				if not (src is BaseMaterial3D):
					continue
				if not done.has(src):
					var g: BaseMaterial3D = (src as BaseMaterial3D).duplicate()
					g.albedo_color = g.albedo_color * tint
					# the models come fully metallic (1.0): a mirror of the pale sky at this distance, which is what read
					# washed out; dark tinted glass is a low-metal, fairly smooth dielectric
					g.roughness = 0.3
					g.metallic = 0.3
					g.metallic_specular = 0.45
					# the day haze lifted them to near-white at 700–1000 m; they keep their own haze-free tone (the hills behind
					# still fade), which is how a skyline reads against the sky
					g.disable_fog = true
					done[src] = g
				am.surface_set_material(i, done[src])
			done[mi.mesh] = am
		mi.mesh = done[mi.mesh]
		for i in mi.get_surface_override_material_count():
			mi.set_surface_override_material(i, null)
