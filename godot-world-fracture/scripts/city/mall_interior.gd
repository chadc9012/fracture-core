extends Control
const Phone := preload("res://scripts/phone.gd")
## The Nexus Galleria: a two-level mall the street's ENTER MALL button walks into. A skylit atrium with a fountain and
## palms; storefronts for the in-world brands on both levels (clothing, home furnishings, electronics, a barber, a hair
## salon, an armour and weapons dealer, a gym, a phone shop) each with its own window display and sign; and a food court
## at the far end with counters under lit menu boards and the café tables from the street. All original names.
signal closed
## the shops you can buy from (shop_view.gd): the scene that opens the mall sets `gear` / `profile` and hears `changed`
signal shop_changed
const ShopView := preload("res://scripts/gear/shop_view.gd")
var gear: Dictionary = {}
var profile: Dictionary = {}
var shop_overlay: Control

const MODELS := "res://models/city/"
const Materials := preload("res://scripts/city/materials.gd")
const L := 120.0        # mall length (z)
const W := 36.0         # width between shopfronts
const FLOOR_H := 7.0    # storey height
const SHOP_W := 12.0    # storefront width

## brand, what it sells, its colour; the shopfront display is built from `kind`
const SHOPS := [
	["NOVA THREADS", "clothing", Color(0.95, 0.35, 0.55)],
	["HAVEN HOME", "furnishings", Color(0.95, 0.75, 0.45)],
	["QUANTA ELECTRONICS", "electronics", Color(0.3, 0.8, 1.0)],
	["FADE & CO BARBERS", "barber", Color(0.95, 0.25, 0.25)],
	["VELVET SALON", "salon", Color(0.8, 0.45, 1.0)],
	["IRONCLAD ARMS & ARMOR", "arms", Color(1.0, 0.6, 0.2)],
	["PULSE GYM", "gym", Color(0.3, 1.0, 0.5)],
	["VOLTA MOBILE", "electronics", Color(0.4, 0.6, 1.0)],
	["LUMEN LUXE", "clothing", Color(1.0, 0.85, 0.4)],
	["CASA NOVA LIVING", "furnishings", Color(0.6, 0.9, 0.8)],
]
const FOOD := [["BYTEBURGER", Color(1.0, 0.45, 0.2)], ["KAIJU RAMEN", Color(1.0, 0.25, 0.35)], ["LUMA CAFE", Color(0.95, 0.8, 0.5)],
	["TACO NEXO", Color(0.4, 1.0, 0.4)], ["SAKURA BOWL", Color(1.0, 0.6, 0.8)], ["SLICE CITY PIZZA", Color(1.0, 0.8, 0.2)]]

var cam: Camera3D
var world: Node3D
var _rng := RandomNumberGenerator.new()
var _cache := {}
var _views := [
	[Vector3(0, 1.7, L * 0.5 - 4), Vector3(0, 5.0, -L * 0.5)],        # down the atrium from the entrance
	[Vector3(-12, 8.7, 10), Vector3(10, 2.0, -20)],                    # from the upper gallery
	[Vector3(6, 1.7, -L * 0.5 + 34), Vector3(-4, 2.5, -L * 0.5 + 4)],  # into the food court
]
var _view := 0

func _ready() -> void:
	_rng.seed = 41
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.06, 0.08)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	Phone.fit_viewport(vp)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	world = Node3D.new()
	vp.add_child(world)
	_environment()
	_shell()
	_atrium()
	_shops()
	_food_court()
	# nothing in the mall moves: fold its boxes, shopfront pieces and repeated fittings for the phone (static_batch.gd)
	preload("res://scripts/static_batch.gd").batch(world)
	cam = Camera3D.new()
	cam.fov = 62.0
	cam.near = 0.05
	world.add_child(cam)
	cam.current = true
	show_view(0)
	var back := Button.new()
	back.text = "← STREET"
	back.position = Vector2(16, 16)
	back.pressed.connect(func(): closed.emit())
	add_child(back)
	var next := Button.new()
	next.text = "NEXT VIEW"
	next.position = Vector2(120, 16)
	next.pressed.connect(func(): show_view(_view + 1))
	add_child(next)
	var nova := Button.new()
	nova.text = "NOVA THREADS"
	nova.add_theme_color_override("font_color", Color(0.95, 0.4, 0.75))
	nova.position = Vector2(230, 16)
	nova.pressed.connect(func(): open_shop("nova"))
	add_child(nova)
	var haven := Button.new()
	haven.text = "HAVEN HOME"
	haven.add_theme_color_override("font_color", Color(0.95, 0.75, 0.4))
	haven.position = Vector2(370, 16)
	haven.pressed.connect(func(): open_shop("haven"))
	add_child(haven)

func open_shop(which: String) -> void:
	if shop_overlay:
		return
	shop_overlay = ShopView.new()
	shop_overlay.shop = which
	shop_overlay.gear = gear
	shop_overlay.profile = profile
	shop_overlay.closed.connect(close_shop)
	shop_overlay.changed.connect(func(): shop_changed.emit())
	add_child(shop_overlay)

func close_shop() -> void:
	if shop_overlay:
		shop_overlay.queue_free()
		shop_overlay = null

func show_view(i: int) -> void:
	_view = i % _views.size()
	cam.position = _views[_view][0]
	cam.look_at(_views[_view][1])

# --------------------------------------------------------------------------------------------- helpers
static func flat(c: Color, rough := 0.8, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

static func glass() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.7, 0.8, 0.85, 0.1)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = 0.03
	m.metallic = 0.4
	return m

func _box(size: Vector3, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.position = pos
	mi.material_override = mat
	(parent if parent else world).add_child(mi)
	return mi

func _cyl(r: float, h: float, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r
	c.height = h
	mi.mesh = c
	mi.position = pos
	mi.material_override = mat
	(parent if parent else world).add_child(mi)
	return mi

func _label(text: String, pos: Vector3, yaw: float, c: Color, size := 96, parent: Node3D = null) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.008
	l.modulate = c * 2.4
	l.shaded = false
	l.position = pos
	l.rotation_degrees.y = yaw
	(parent if parent else world).add_child(l)
	return l

func _light(pos: Vector3, c: Color, energy: float, rng: float) -> void:
	var o := OmniLight3D.new()
	o.position = pos
	o.light_color = c
	o.light_energy = energy
	o.omni_range = rng
	world.add_child(o)

## a Meshy prop scaled to `height`, base on the floor
## Meshy props whose meshes are torn (open faces, glass panes in shards): left out until they are remade; every caller
## builds without them (owner's phone test, Nov 9)
const SHATTERED := ["planter.glb", "bus-shelter.glb", "apartment.glb", "brick.glb", "office.glb", "deco.glb", "villa.glb"]
func prop(file: String, height: float, pos: Vector3, yaw := 0.0) -> Node3D:
	if file.get_file() in SHATTERED:
		return null
	var path := MODELS + file
	if not ResourceLoader.exists(path):
		return null
	if not _cache.has(path):
		_cache[path] = load(path)
	var node := (_cache[path] as PackedScene).instantiate() as Node3D
	var holder := Node3D.new()
	holder.add_child(node)
	var aabb := AABB()
	var first := true
	for c in node.find_children("*", "MeshInstance3D", true, false):
		var a := (c as MeshInstance3D).get_aabb()
		aabb = a if first else aabb.merge(a)
		first = false
	var s := height / maxf(aabb.size.y, 0.001)
	node.scale = Vector3.ONE * s
	node.position = Vector3(-(aabb.position.x + aabb.size.x * 0.5) * s, -aabb.position.y * s, -(aabb.position.z + aabb.size.z * 0.5) * s)
	holder.position = pos
	holder.rotation_degrees.y = yaw
	world.add_child(holder)
	return holder

# --------------------------------------------------------------------------------------------- light
func _environment() -> void:
	var sky := ProceduralSkyMaterial.new()
	sky.sky_top_color = Color(0.45, 0.62, 0.85)
	sky.sky_horizon_color = Color(0.9, 0.85, 0.78)
	var s := Sky.new()
	s.sky_material = sky
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = s
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.95, 0.86, 0.75)
	env.ambient_light_energy = 0.45
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 0.8
	env.ssr_enabled = Data.forward_plus()
	env.ssao_enabled = Data.forward_plus()
	env.ssil_enabled = Data.forward_plus()
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_hdr_threshold = 1.2
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-62, 35, 0)   # high sun through the skylight
	sun.light_energy = 1.1
	sun.light_color = Color(1.0, 0.94, 0.86)
	sun.shadow_enabled = true
	world.add_child(sun)

# --------------------------------------------------------------------------------------------- building
func _shell() -> void:
	var stone: Material = Materials.pbr("floor_tiles_06", Color(1.05, 1.02, 0.98), 2.4, 0.35)     # polished stone tiles that mirror the shopfronts
	var white: Material = Materials.pbr("painted_plaster_wall", Color(0.95, 0.93, 0.9), 3.0)
	var steel := flat(Color(0.75, 0.77, 0.8), 0.25, 0.9)
	var D := W + 2.0 * 10.0     # shopfront to shopfront plus shop depth both sides
	_box(Vector3(D, 0.2, L), Vector3(0, -0.1, 0), stone)
	# floor pattern: darker inlay bands across the atrium
	var inlay := flat(Color(0.32, 0.3, 0.3), 0.15)
	var z := -L * 0.5 + 6.0
	while z < L * 0.5:
		_box(Vector3(W - 4.0, 0.02, 0.6), Vector3(0, 0.01, z), inlay)
		z += 12.0
	# upper gallery decks along both sides with glass balustrades and a steel handrail
	for side: float in [-1.0, 1.0]:
		_box(Vector3(7.0, 0.5, L), Vector3(side * (W * 0.5 - 3.5), FLOOR_H, 0), white)
		_box(Vector3(0.05, 1.1, L), Vector3(side * (W * 0.5 - 7.0), FLOOR_H + 0.8, 0), glass())
		_box(Vector3(0.12, 0.08, L), Vector3(side * (W * 0.5 - 7.0), FLOOR_H + 1.4, 0), steel)
		# columns
		z = -L * 0.5 + 6.0
		while z < L * 0.5:
			_cyl(0.35, FLOOR_H * 2.0, Vector3(side * (W * 0.5 - 7.3), FLOOR_H, z), white)
			z += 12.0
	# outer side walls the full length (the food court has no shops along its sides)
	for side: float in [-1.0, 1.0]:
		_box(Vector3(0.4, FLOOR_H * 2.2, L), Vector3(side * (D * 0.5), FLOOR_H * 1.1, 0), white)
		_box(Vector3(10.0, FLOOR_H * 2.2, 0.4), Vector3(side * (W * 0.5 + 5.0), FLOOR_H * 1.1, -L * 0.5 + 40.0), white)
	# end walls and a roof with a long glass skylight over the atrium
	_box(Vector3(D, FLOOR_H * 2.2, 0.4), Vector3(0, FLOOR_H * 1.1, -L * 0.5), white)
	for side: float in [-1.0, 1.0]:
		_box(Vector3(D * 0.5 - (W * 0.5 - 7.0), 0.4, L), Vector3(side * (D * 0.25 + (W * 0.5 - 7.0) * 0.5), FLOOR_H * 2.2, 0), white)
	var z2 := -L * 0.5
	while z2 <= L * 0.5:
		_box(Vector3(W - 14.0, 0.25, 0.25), Vector3(0, FLOOR_H * 2.2, z2), steel)
		z2 += 4.0
	# escalators between the levels, mid-atrium
	for side: float in [-1.0, 1.0]:
		var esc := Node3D.new()
		esc.position = Vector3(side * 3.0, FLOOR_H * 0.5, 8.0)
		esc.rotation_degrees.x = -side * 0.0
		world.add_child(esc)
		var ramp := _box(Vector3(1.4, 0.4, 14.0), Vector3.ZERO, steel, esc)
		ramp.rotation_degrees.x = rad_to_deg(atan2(FLOOR_H, 14.0)) * side
		for g: float in [-0.75, 0.75]:
			var rail := _box(Vector3(0.08, 1.0, 14.2), Vector3(g, 0.6, 0), glass(), esc)
			rail.rotation_degrees.x = ramp.rotation_degrees.x

func _atrium() -> void:
	# a fountain under the skylight, palms in planters around it
	var basin := flat(Color(0.25, 0.27, 0.3), 0.2, 0.3)
	_cyl(4.5, 0.6, Vector3(0, 0.3, -6.0), basin)
	var water := flat(Color(0.2, 0.45, 0.55), 0.02, 0.1)
	_cyl(4.2, 0.1, Vector3(0, 0.58, -6.0), water)
	_cyl(0.6, 2.2, Vector3(0, 1.4, -6.0), basin)
	_cyl(1.6, 0.2, Vector3(0, 2.5, -6.0), basin)
	for i in 4:
		var a := TAU * i / 4.0 + 0.4
		prop("planter.glb", 2.2, Vector3(cos(a) * 8.0, 0, -6.0 + sin(a) * 8.0), rad_to_deg(a))
		prop("palm.glb", 7.5, Vector3(cos(a + 0.8) * 9.0, 0, -6.0 + sin(a + 0.8) * 9.0), _rng.randf() * 360.0)
	# hanging banners down the atrium
	for i in 5:
		var c: Color = SHOPS[i * 2][2]
		var b := _box(Vector3(0.05, 4.0, 1.6), Vector3(0, FLOOR_H * 2.2 - 3.0, 20.0 - i * 14.0), flat(c, 0.7, 0, 0.6))
		b.rotation_degrees.y = 90.0

func _shops() -> void:
	var k := 0
	for level in 2:
		for side: float in [-1.0, 1.0]:
			var z := L * 0.5 - SHOP_W * 0.5 - 2.0
			while z > -L * 0.5 + 40.0:     # the far 40 m is the food court
				var spec: Array = SHOPS[k % SHOPS.size()]
				_storefront(String(spec[0]), String(spec[1]), spec[2] as Color, Vector3(side * W * 0.5, level * (FLOOR_H + 0.25), z), side)
				z -= SHOP_W
				k += 1

## one shop: lit interior box behind a glass front, its sign over the door, and a display for what it sells
func _storefront(brand: String, kind: String, c: Color, at: Vector3, side: float) -> void:
	var g := Node3D.new()
	g.position = at
	g.rotation_degrees.y = -90.0 * side     # local -x faces the atrium... local +z runs along the mall
	world.add_child(g)
	var depth := 10.0
	var h := FLOOR_H - 0.4
	var wall := flat(c.lerp(Color(0.16, 0.14, 0.13), 0.78), 0.7)   # deep, brand-tinted interiors so the displays glow
	var dark := flat(Color(0.1, 0.1, 0.11), 0.35, 0.5)
	# interior shell (local: x across the front, -z into the shop)
	_box(Vector3(SHOP_W - 0.4, h, 0.2), Vector3(0, h * 0.5, -depth), wall, g)
	_box(Vector3(0.2, h, depth), Vector3(-SHOP_W * 0.5, h * 0.5, -depth * 0.5), wall, g)
	_box(Vector3(SHOP_W, 0.2, depth), Vector3(0, h, -depth * 0.5), wall, g)
	_box(Vector3(SHOP_W - 0.4, 0.05, depth), Vector3(0, 0.03, -depth * 0.5), flat(c.lerp(Color(0.5, 0.48, 0.45), 0.75), 0.3), g)
	# glass front with a dark frame, a sign band in the brand colour
	_box(Vector3(SHOP_W - 0.4, h - 1.6, 0.05), Vector3(0, (h - 1.6) * 0.5, -0.1), glass(), g)
	_box(Vector3(SHOP_W, 1.4, 0.4), Vector3(0, h - 0.7, 0.0), dark, g)
	_box(Vector3(SHOP_W - 1.0, 0.06, 0.05), Vector3(0, h - 1.38, 0.22), flat(c, 0.4, 0, 5.0), g)
	_label(brand, Vector3(0, h - 0.7, 0.22), 0.0, c, 110 if brand.length() < 14 else 84, g)
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(0, h - 1.2, -depth * 0.5)
	lamp.light_color = Color(1.0, 0.95, 0.88)
	lamp.light_energy = 2.4
	lamp.light_color = Color(1.0, 0.88, 0.72)
	lamp.omni_range = 10.0
	g.add_child(lamp)
	_display(kind, c, g)

func _display(kind: String, c: Color, g: Node3D) -> void:
	var accent := flat(c, 0.5, 0.2)
	var steel := flat(Color(0.7, 0.72, 0.75), 0.3, 0.9)
	var wood := flat(Color(0.45, 0.32, 0.22), 0.6)
	match kind:
		"clothing":
			# mannequins on plinths and a rack of garments
			for x: float in [-3.0, 0.0, 3.0]:
				_box(Vector3(1.2, 0.3, 1.2), Vector3(x, 0.15, -2.5), flat(Color(0.15, 0.15, 0.16), 0.3), g)
				_cyl(0.18, 1.1, Vector3(x, 1.0, -2.5), flat(Color(0.9, 0.88, 0.85), 0.4), g)
				_box(Vector3(0.6, 0.8, 0.3), Vector3(x, 1.4, -2.5), accent, g)
				var head := MeshInstance3D.new(); var sp := SphereMesh.new(); sp.radius = 0.14; sp.height = 0.28; head.mesh = sp
				head.position = Vector3(x, 2.0, -2.5); head.material_override = flat(Color(0.9, 0.88, 0.85), 0.4); g.add_child(head)
			_box(Vector3(6.0, 0.05, 0.05), Vector3(0, 1.9, -7.5), steel, g)
			for i in 14:
				_box(Vector3(0.35, 1.0, 0.08), Vector3(-2.8 + i * 0.42, 1.35, -7.5), flat(Color.from_hsv(fmod(c.h + i * 0.07, 1.0), 0.6, 0.8), 0.8), g)
		"furnishings":
			# a sofa, coffee table, lamp and a rug
			_box(Vector3(4.0, 0.02, 3.0), Vector3(0, 0.06, -4.5), flat(c.lerp(Color(0.9, 0.85, 0.75), 0.5), 0.9), g)
			_box(Vector3(3.2, 0.5, 1.0), Vector3(0, 0.45, -6.0), flat(Color(0.35, 0.38, 0.42), 0.9), g)
			_box(Vector3(3.2, 0.8, 0.25), Vector3(0, 0.8, -6.4), flat(Color(0.35, 0.38, 0.42), 0.9), g)
			_box(Vector3(1.6, 0.4, 0.8), Vector3(0, 0.25, -4.3), wood, g)
			_cyl(0.04, 1.7, Vector3(2.4, 0.85, -6.2), steel, g)
			_cyl(0.3, 0.4, Vector3(2.4, 1.8, -6.2), flat(Color(1.0, 0.9, 0.7), 0.5, 0, 2.0), g)
		"electronics":
			# a long white counter with devices and a video wall behind
			_box(Vector3(7.0, 0.9, 1.2), Vector3(0, 0.45, -4.0), flat(Color(0.95, 0.95, 0.96), 0.2), g)
			for i in 6:
				_box(Vector3(0.5, 0.03, 0.8), Vector3(-2.6 + i * 1.05, 0.92, -4.0), flat(Color(0.05, 0.05, 0.06), 0.1, 0.5, 0.0), g)
			for i in 3:
				_box(Vector3(2.6, 1.6, 0.05), Vector3(-3.0 + i * 3.0, 2.8, -9.8), flat(Color.from_hsv(fmod(c.h + i * 0.15, 1.0), 0.6, 1.0), 0.2, 0, 2.2), g)
		"barber":
			# barber chairs facing mirrors, a striped pole at the door
			for x: float in [-3.5, 0.0, 3.5]:
				_box(Vector3(0.9, 0.5, 0.9), Vector3(x, 0.6, -6.5), flat(Color(0.12, 0.12, 0.13), 0.4, 0.4), g)
				_box(Vector3(0.9, 0.9, 0.2), Vector3(x, 1.2, -6.9), flat(Color(0.6, 0.12, 0.1), 0.5), g)
				_cyl(0.12, 0.5, Vector3(x, 0.25, -6.5), steel, g)
				_box(Vector3(1.4, 1.6, 0.05), Vector3(x, 1.9, -9.8), flat(Color(0.8, 0.85, 0.9), 0.02, 1.0), g)
			_cyl(0.12, 1.6, Vector3(SHOP_W * 0.5 - 0.6, 2.2, 0.3), flat(Color(0.95, 0.95, 0.95), 0.3, 0, 1.0), g)
			for i in 4:
				_cyl(0.13, 0.12, Vector3(SHOP_W * 0.5 - 0.6, 1.6 + i * 0.38, 0.3), flat(Color(0.9, 0.1, 0.1), 0.3, 0, 1.5), g)
		"salon":
			# styling stations with lit mirrors and a wash basin row
			for x: float in [-3.5, 0.0, 3.5]:
				_box(Vector3(0.8, 0.5, 0.8), Vector3(x, 0.55, -6.5), flat(Color(0.92, 0.9, 0.95), 0.4), g)
				_box(Vector3(1.2, 1.4, 0.05), Vector3(x, 1.9, -9.8), flat(Color(0.85, 0.85, 0.9), 0.02, 1.0), g)
				_box(Vector3(1.3, 0.06, 0.06), Vector3(x, 2.65, -9.7), flat(Color(1.0, 0.95, 0.9), 0.3, 0, 4.0), g)
			_box(Vector3(5.0, 0.9, 0.8), Vector3(0, 0.45, -2.5), flat(c.lerp(Color.WHITE, 0.5), 0.3), g)
		"arms":
			# armour suits on stands and lit weapon racks on the back wall
			for x: float in [-3.5, 3.5]:
				_box(Vector3(0.9, 1.3, 0.5), Vector3(x, 1.6, -3.0), flat(Color(0.25, 0.27, 0.3), 0.3, 0.9), g)
				_box(Vector3(0.6, 0.45, 0.5), Vector3(x, 2.5, -3.0), flat(Color(0.2, 0.22, 0.25), 0.25, 0.9), g)
				_box(Vector3(0.12, 0.06, 0.02), Vector3(x, 2.55, -2.74), flat(c, 0.3, 0, 6.0), g)
				for leg: float in [-0.22, 0.22]:
					_box(Vector3(0.28, 1.0, 0.3), Vector3(x + leg, 0.5, -3.0), flat(Color(0.22, 0.24, 0.27), 0.3, 0.9), g)
			_box(Vector3(9.0, 3.0, 0.1), Vector3(0, 2.2, -9.85), flat(Color(0.08, 0.08, 0.09), 0.5), g)
			for row in 3:
				_box(Vector3(8.6, 0.04, 0.04), Vector3(0, 1.2 + row * 0.9, -9.7), flat(c, 0.3, 0, 3.0), g)
				for i in 6:
					_box(Vector3(1.0, 0.18, 0.08), Vector3(-3.6 + i * 1.45, 1.4 + row * 0.9, -9.7), flat(Color(0.18, 0.19, 0.2), 0.35, 0.8), g)
		"gym":
			# a treadmill row, a bench and a dumbbell rack
			for x: float in [-3.5, -1.2, 1.2, 3.5]:
				_box(Vector3(0.8, 0.2, 1.8), Vector3(x, 0.15, -7.5), flat(Color(0.12, 0.12, 0.13), 0.5), g)
				_box(Vector3(0.8, 1.2, 0.08), Vector3(x, 0.8, -8.4), flat(Color(0.2, 0.2, 0.22), 0.4, 0.6), g)
				_box(Vector3(0.5, 0.3, 0.05), Vector3(x, 1.45, -8.35), flat(c, 0.3, 0, 2.5), g)
			_box(Vector3(1.6, 0.45, 0.4), Vector3(-2.0, 0.45, -3.5), flat(Color(0.1, 0.1, 0.1), 0.6), g)
			_box(Vector3(3.0, 0.8, 0.5), Vector3(2.2, 0.4, -3.0), steel, g)
			for i in 6:
				_cyl(0.1, 0.32, Vector3(1.0 + i * 0.48, 0.95, -3.0), flat(Color(0.1, 0.1, 0.1), 0.4, 0.5), g)

func _food_court() -> void:
	var z0 := -L * 0.5 + 2.0
	# counters along the back and side walls, each under its own lit menu board
	for i in FOOD.size():
		var spec: Array = FOOD[i]
		var c: Color = spec[1]
		var x := -15.0 + i * 6.0
		var g := Node3D.new()
		g.position = Vector3(x, 0, z0)
		world.add_child(g)
		_box(Vector3(5.4, 1.1, 1.2), Vector3(0, 0.55, 1.8), flat(Color(0.15, 0.15, 0.16), 0.3, 0.4), g)
		_box(Vector3(5.4, 0.06, 1.3), Vector3(0, 1.13, 1.8), flat(Color(0.85, 0.84, 0.82), 0.15), g)
		_box(Vector3(5.6, 3.2, 1.2), Vector3(0, 1.6, 0.2), flat(c.lerp(Color(0.12, 0.12, 0.13), 0.7), 0.6), g)
		_box(Vector3(5.0, 1.4, 0.06), Vector3(0, 3.6, 0.85), flat(c, 0.3, 0, 2.2), g)
		_label(String(spec[0]), Vector3(0, 4.8, 0.9), 0.0, c, 88, g)
		_box(Vector3(5.6, 0.1, 0.1), Vector3(0, 4.2, 0.9), flat(c, 0.3, 0, 5.0), g)
	# seating: café sets in rows, planters between
	for row in 3:
		for col in 5:
			prop("cafe-set.glb", 0.95, Vector3(-12.0 + col * 6.0 + (row % 2) * 3.0, 0, z0 + 10.0 + row * 7.0), _rng.randf_range(-30, 30))
	prop("planter.glb", 2.0, Vector3(-16.0, 0, z0 + 24.0))
	prop("planter.glb", 2.0, Vector3(16.0, 0, z0 + 24.0))
	for x: float in [-10.0, 0.0, 10.0]:
		_light(Vector3(x, 6.0, z0 + 14.0), Color(1.0, 0.9, 0.78), 2.0, 16.0)
