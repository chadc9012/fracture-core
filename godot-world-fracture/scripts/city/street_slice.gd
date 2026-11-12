extends Control
const Progression := preload("res://scripts/progress/progression.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const Settings := preload("res://scripts/front/settings_store.gd")
const Radio := preload("res://scripts/audio/radio.gd")
const Phone := preload("res://scripts/phone.gd")
const WetNight := preload("res://scripts/city/wet_night.gd")
## Nexus City street slice: one block of a Nexus avenue at golden hour, built to chase the owner's concept frames (wet
## reflective asphalt, palms and planters, a café terrace, mid-rise apartments over shopfronts, glass towers behind, warm
## low sun through haze). Meshy-generated props from res://models/city/, the fleet cars parked at the kerb.
## Forward+ gets SDFGI bounce light, screen-space reflections, SSAO/SSIL and volumetric fog; the mobile renderer
## quietly drops what it can't do and keeps the rest.
signal closed
signal toggle_night
signal toggle_style
## a hub door the operator walked up to and entered: "modes", "skyways", "rift", "descent", "apartment", "airport" (main.gd opens the
## view over the street); the garage, mall, casino and sports doors open their own overlays here
signal door(id: String)
## the hub block's doors (step 7 of the schedule): where each stands on the Nexus block and what it says
const DOORS := [
	{ "id": "apartment", "label": "APARTMENT 12-04", "x": -1.0, "z": 52.0, "color": Color(1.0, 0.85, 0.5), "kind": "door" },
	{ "id": "modes", "label": "KILLBOX TERMINAL", "x": -1.0, "z": -42.0, "color": Color(1.0, 0.3, 0.7), "kind": "kiosk" },
	{ "id": "skyways", "label": "SKYWAYS SHUTTLE", "x": 1.0, "z": -74.0, "color": Color(0.3, 0.9, 1.0), "kind": "stop" },
	{ "id": "descent", "label": "CRASH-SITE TRANSPORT", "x": 1.0, "z": 78.0, "color": Color(0.95, 0.8, 0.4), "kind": "stop" },
	{ "id": "rift", "label": "RIFT GATE", "x": -1.0, "z": 110.0, "color": Color(0.75, 0.4, 1.0), "kind": "portal" },
	{ "id": "garage", "label": "GARAGE", "x": 1.0, "z": 8.0, "color": Color(0.3, 0.9, 1.0), "kind": "none", "style": "any" },
	{ "id": "mall", "label": "GALLERIA MALL", "x": -1.0, "z": -100.0, "color": Color(1.0, 0.6, 0.9), "kind": "door" },
	# the casino is Neon City's alone (owner, Nov 9): the Neon City Grand Casino; its door is set at the podium in _buildings
	{ "id": "casino", "label": "NEON CITY GRAND CASINO", "x": -1.0, "z": -82.0, "color": Color(0.95, 0.72, 0.32), "kind": "door", "style": "neon" },
	# Nexus City International / Neon City International (main.gd opens the street's own city's airport)
	{ "id": "airport", "label": "AIRPORT EXPRESS", "x": 1.0, "z": -40.0, "color": Color(0.55, 0.8, 1.0), "kind": "stop", "style": "any" },
	{ "id": "sports", "label": "SPORTS DISTRICT", "x": -1.0, "z": 20.0, "color": Color(0.1, 0.85, 1.0), "kind": "door" },
	# a clothing store on the avenue (owner, Nov 11: "make clothing stores so user can buy stuff"; clothing_store.gd)
	{ "id": "block", "label": "BLOCK SUPPLY · CLOTHING", "x": 1.0, "z": 62.0, "color": Color(0.35, 1.0, 0.75), "kind": "door", "style": "any" },
	# buildings you walk into (owner's pick, Nov 11: "City interiors"; interiors.gd), on the blocks either side of the hub,
	# clear of the Nexus side courts (|z - k·260| < 62)
	{ "id": "hospital", "label": "MERIDIAN GENERAL HOSPITAL", "x": -1.0, "z": 165.0, "color": Color(0.3, 1.0, 0.6), "kind": "door", "style": "any" },
	{ "id": "police", "label": "POLICE · PRECINCT 7", "x": 1.0, "z": 165.0, "color": Color(0.35, 0.55, 1.0), "kind": "door", "style": "any" },
	{ "id": "restaurant", "label": "EMBER & OAK GRILL", "x": -1.0, "z": 185.0, "color": Color(1.0, 0.6, 0.25), "kind": "door", "style": "any" },
	{ "id": "fire", "label": "FIRE STATION 12", "x": 1.0, "z": 345.0, "color": Color(1.0, 0.3, 0.2), "kind": "door", "style": "any" },
	{ "id": "school", "label": "NEXUS ACADEMY", "x": -1.0, "z": 345.0, "color": Color(0.4, 0.6, 1.0), "kind": "door", "style": "any" },
	{ "id": "hotel", "label": "THE AURELIAN HOTEL", "x": -1.0, "z": -165.0, "color": Color(1.0, 0.8, 0.4), "kind": "door", "style": "any" },
	{ "id": "office", "label": "HELIX SYSTEMS", "x": 1.0, "z": -165.0, "color": Color(0.3, 0.85, 1.0), "kind": "door", "style": "any" },
	{ "id": "nightclub", "label": "NIGHTCLUB", "x": 1.0, "z": -345.0, "color": Color(1.0, 0.2, 0.65), "kind": "door", "style": "any" },
	# the city parking garage's door, at its lot (infrastructure.gd LOTS "parkade", block -2)
	{ "id": "parking", "label": "UNDERGROUND PARKING", "x": -1.0, "z": -615.0, "color": Color(1.0, 0.85, 0.2), "kind": "door", "style": "any" },
	# the metro: a glass entrance pavilion on the walk, down to the Central Line platform (interiors.gd "metro")
	{ "id": "metro", "label": "METRO · CENTRAL LINE", "x": 1.0, "z": -118.0, "color": Color(0.3, 0.75, 1.0), "kind": "metro", "style": "any" },
]
var _door_spots: Array = []     # [{id, label, pos}]
const Infra := preload("res://scripts/city/infrastructure.gd")
## the crossings' signal heads on loaded blocks and the construction crane tops (infrastructure.gd runs them)
var signals: Array = []
var cranes: Array = []
var deck_cars: Array = []
var _infra_t := 0.0
const Interiors := preload("res://scripts/city/interiors.gd")
var _radio_button: Button
var _menu_btn: Button
var _menu: PanelContainer
var _topbar: Container
var _drive_m := 0.0
var _near_door := ""
var _near_npc := ""


const ROAD_W := 16.0          # kerb to kerb
const WALK_W := 7.0           # each sidewalk
const LENGTH := 260.0         # street length (z)
const MODELS := "res://models/city/"
const FLEET := "res://models/fleet/"

## night: the Las Vegas / New York version — lit towers, neon blade signs and billboards, lamps on, wet street mirroring it all
var night := false
## "nexus": New York density and Las Vegas glitz; "neon": Neon City, Hollywood and Long Beach after dark, palms under
## neon; "coast": Miami Art Deco and Caribbean resort, pastel and palm-lined
var style := "nexus"
const STYLES := ["nexus", "neon", "coast"]
const STYLE_NAMES := { "nexus": "NEXUS CITY", "neon": "NEON CITY", "coast": "MIAMI COAST" }
## each city's car garage (catalog.gd shop ids)
const CITY_GARAGE := { "nexus": "nexus-customs", "neon": "neon-performance", "coast": "sunset-kustoms" }
const Catalog = preload("res://scripts/garage/catalog.gd")
const GarageView = preload("res://scripts/garage/garage_view.gd")
const Mall = preload("res://scripts/city/mall_interior.gd")
const ClothingStore = preload("res://scripts/city/clothing_store.gd")
const Casino = preload("res://scripts/city/casino_interior.gd")
const Sports = preload("res://scripts/city/sports_district.gd")
const OperatorPlayer = preload("res://scripts/player/operator_player.gd")
const TouchControls = preload("res://scripts/player/touch_controls.gd")
const Gunplay = preload("res://scripts/combat/gunplay.gd")
const Enemies = preload("res://scripts/combat/enemies.gd")
const Gear = preload("res://scripts/gear/gear_store.gd")
const StreetCar = preload("res://scripts/driving/street_car.gd")
const Traffic = preload("res://scripts/driving/traffic.gd")
var traffic: Node3D
const StreetLife = preload("res://scripts/racing/street_life.gd")
var life: Node
## district streaming (district.gd): the authored slice is tile 0 and stays; the blocks either way along the avenue are
## built when Active, kept as boxes when Simulated, parked when Frozen. Each tile's meshes hang under one root node at
## z = k * TILE, so the builders below work in tile-local coordinates (`_tile_root` set while a tile is being built).
const District = preload("res://scripts/city/district.gd")
const Civilians = preload("res://scripts/city/civilians.gd")
const NpcStreet = preload("res://scripts/npc/npc_street.gd")
const Crowd = preload("res://scripts/city/crowd.gd")
var crowd: MultiMeshInstance3D
const StaticBatch = preload("res://scripts/static_batch.gd")
## Nexus City's district courts off the avenue (nexus_districts.gd): built with their tile, the Central Tower with the hub
const Nexus = preload("res://scripts/city/nexus_districts.gd")
const ShopView = preload("res://scripts/gear/shop_view.gd")
var shop_overlay: Control
## the operator carries a weapon on the street only once Mission 01's Fracture has armed them (the story starts unarmed in
## the apartment); before that the street is calm: no troopers. Tests and perf tools set `force_armed`.
static var force_armed := false
var armed := true
var _area := ""
var _casino_at := Vector3.INF
var civilians: Node3D
## the city's named people (scripts/npc/: tier 2 / 3 NPCs with jobs, schedules and memory); Nexus and Neon City
var npcs: Node3D
var _shots_seen := 0
var district: RefCounted
var tiles := {}                 # k -> { "root": Node3D or null, "slots": Array[int] }
var _free_slots: Array[int] = []
var _tile_root: Node3D = null
var _tile_k := 0
const PARKED_BOX := AABB(Vector3(0, -1000, 0), Vector3(0.1, 0.1, 0.1))
const DriveProfile = preload("res://scripts/driving/drive_profile.gd")
const GarageState = preload("res://scripts/garage/garage_state.gd")
const CarDetail := preload("res://scripts/driving/car_detail.gd")
## the parked cars you can take (phase 5): each fleet file's vehicle id for the garage build it drives with
const CAR_IDS := { "street-racer-lod.glb": "street-racer", "muscle-car-lod.glb": "muscle-car", "security-suv.glb": "security-suv", "tuner.glb": "tuner", "offroad-truck.glb": "offroad-truck", "goliath-tank.glb": "goliath-tank", "hover-car.glb": "hover-car" }
## the hulls that are not garage cars drive on vehicle_handling.gd's numbers (web vehicle-handling.ts): max speed from the
## base 62 m/s × profile top × fleet speed, braking / acceleration from the profile; the tank pivots on the spot
const Handling := preload("res://scripts/driving/vehicle_handling.gd")
static func hull_perf(id: String) -> Dictionary:
	var kind := Handling.kind_of(id)
	var p: Dictionary = Handling.profile(kind)
	var fleet := float(Handling.FLEET_SPEED.get(id, 1.0))
	return { "max_speed": Handling.BASE_SPEED * float(p.top) * fleet * 0.55, "acceleration": float(p.accel) * 0.35, "steering": float(p.steer), "braking": float(p.brake) * 0.4, "pivot": bool(p.pivot), "hover": kind == "RACER" and id.contains("hover") }
var parked: Array[Node3D] = []
var driving_car: RefCounted
var _near_car: Node3D
const InventoryView = preload("res://scripts/gear/inventory_view.gd")
const ProfileView := preload("res://scripts/progress/profile_view.gd")
const CivicProps := preload("res://scripts/city/civic_props.gd")
const OutfitLook = preload("res://scripts/gear/outfit_look.gd")
var wallet: Dictionary = {}   # the profile (xp, nex, level) while the street is open; mission_01.gd has its own `profile`
var gear: Dictionary = {}
var inventory_overlay: Control
var gunplay: Node3D
var enemies: Node3D
var _spawn := Vector3.ZERO
## on foot (phase 2 of the Dec 4 plan): the saved operator walks the block with a chase camera; off for look-dev shots
var walk := true
var operator: Node3D
var controls: Control
var mall_overlay: Control
var casino_overlay: Control
var sports_overlay: Control
var _vp: SubViewport
var garage_overlay: Control
const GARAGE_Z := 8.0
## original in-world brands (no real names or logos): what fills the blank shopfronts and signs
const BRANDS := ["LUMA CAFE", "NEXA BANK", "BYTEBURGER", "VOLTA MOBILE", "IRONCLAD ARMS", "FADE & CO", "HAVEN HOME",
	"PULSE GYM", "KAIJU RAMEN", "ORBIT TICKETS", "VELVET SALON", "AXIOM ARMOR", "SOLACE SPA", "GRIDLINE TAXI", "NOVA THREADS",
	"CROWN CASINO", "MERIDIAN HOTEL", "QUANTA ELECTRONICS"]
const NEON := [Color(1.0, 0.18, 0.62), Color(0.15, 0.85, 1.0), Color(0.62, 0.3, 1.0), Color(1.0, 0.62, 0.15), Color(0.25, 1.0, 0.55)]
var cam: Camera3D
var world: Node3D
var _rng := RandomNumberGenerator.new()
var _cache := {}

func _ready() -> void:
	_rng.seed = 2207
	if style == "neon":
		night = true
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
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(vp)
	_vp = vp
	world = Node3D.new()
	vp.add_child(world)
	_environment()
	_street()
	if night:
		_wet_night()
	# the sidewalk crowd (crowd.gd): one MultiMesh walking in the shader, denser on a desktop; the district narrows it
	if style != "coast":
		crowd = Crowd.new()
		world.add_child(crowd)
		crowd.setup(90 if Phone.on_phone() else 160, -LENGTH * 0.5, LENGTH * 0.5, ROAD_W * 0.5 + WALK_W * 0.5, WALK_W)
	_buildings()
	_skyline()
	_props()
	_cars()
	_garage_front()
	_dressing()
	_street_set()
	_hub_dressing()
	if style != "coast":
		_doors()
	_civic_life()
	Infra.build(self, 0, world)    # the hub block's crossing (infrastructure.gd)
	if night:
		_neon()
		if style == "neon":
			_neon()   # Neon City: twice the signage
	# the phone's draw budget: the block's static pieces folded into a few meshes per cell (static_batch.gd)
	StaticBatch.batch(world)
	cam = Camera3D.new()
	cam.fov = 58.0
	cam.near = 0.05
	cam.far = 1500.0
	world.add_child(cam)
	cam.current = true
	look_from(Vector3(ROAD_W * 0.5 + 3.4, 1.7, 30.0), Vector3(ROAD_W * 0.5 - 3.0, 4.0, -40.0))
	if walk:
		_spawn_player()
	sound_on()
	var back := Button.new()
	back.text = "← BACK"
	back.pressed.connect(func(): closed.emit())
	_bar().add_child(back)
	_radio_button = Button.new()
	_radio_button.text = "RADIO"
	_radio_button.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_radio_button.position = Vector2(-240, 12)
	_radio_button.custom_minimum_size = Vector2(150, 44)
	_radio_button.add_theme_font_size_override("font_size", 13)
	_radio_button.visible = false
	_radio_button.pressed.connect(_radio_next)
	add_child(_radio_button)
	var tod := Button.new()
	tod.text = "DAY" if night else "NIGHT"
	tod.pressed.connect(func(): toggle_night.emit())
	_bar().add_child(tod)
	var sty := Button.new()
	sty.text = STYLE_NAMES[STYLES[(STYLES.find(style) + 1) % STYLES.size()]]
	sty.pressed.connect(func(): toggle_style.emit())
	_bar().add_child(sty)
	var shop := Catalog.shop(CITY_GARAGE[style])
	var enter := Button.new()
	enter.text = "ENTER " + String(shop.name).to_upper()
	enter.add_theme_color_override("font_color", Color(String(shop.accent)))
	enter.pressed.connect(open_garage)
	_bar().add_child(enter)
	var mall := Button.new()
	mall.text = "ENTER GALLERIA MALL"
	mall.pressed.connect(open_mall)
	_bar().add_child(mall)
	var clothes := Button.new()
	clothes.text = "CLOTHING STORE"
	clothes.add_theme_color_override("font_color", Color(0.35, 1.0, 0.75))
	clothes.pressed.connect(func(): open_clothes("block"))
	_bar().add_child(clothes)
	var casino := Button.new()
	casino.text = "ENTER NEON CITY GRAND CASINO"
	casino.visible = style == "neon"
	casino.add_theme_color_override("font_color", Color(0.95, 0.72, 0.32))
	casino.pressed.connect(open_casino)
	_bar().add_child(casino)
	var sports := Button.new()
	sports.text = "SPORTS DISTRICT"
	sports.add_theme_color_override("font_color", Color(0.1, 0.85, 1.0))
	sports.pressed.connect(open_sports)
	_bar().add_child(sports)
	_bar().move_child(back, 0)
	move_child(_menu_btn, -1)   # over the touch controls, which fill the screen
	move_child(_menu, -1)
	if style != "nexus":
		tod.visible = style != "neon"   # Neon City is always night

## a fixed camera for look-dev shots (held every frame over the follow camera)
var _look_pts: Array = []
func look_from(from: Vector3, at: Vector3) -> void:
	_look_pts = [from, at]
	cam.position = from
	cam.look_at(at)

# --------------------------------------------------------------------------------------------- on foot
## the street's menu (owner, Nov 11: "remove clutter from screen"): one ☰ button at the top right; the places, the
## inventory, the operator, day / night, the city and the screen's turn open in a list under it and close on a pick.
## (It used to be a wall of buttons across the top of the screen.)
func _bar() -> Container:
	if _topbar:
		return _topbar
	_menu_btn = Button.new()
	_menu_btn.text = "☰"
	_menu_btn.custom_minimum_size = Vector2(64, 56)
	_menu_btn.add_theme_font_size_override("font_size", 26)
	_menu_btn.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_menu_btn.position = Vector2(-78, 12)
	_menu_btn.pressed.connect(func(): _menu.visible = not _menu.visible)
	add_child(_menu_btn)
	_menu = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.02, 0.05, 0.09, 0.92)
	sb.border_color = Color(0.3, 0.8, 1.0, 0.5)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(10)
	_menu.add_theme_stylebox_override("panel", sb)
	_menu.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_menu.position = Vector2(-330, 76)
	_menu.custom_minimum_size = Vector2(316, 0)
	_menu.visible = false
	add_child(_menu)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.custom_minimum_size = Vector2(296, 0)
	_menu.add_child(scroll)
	_topbar = VBoxContainer.new()
	_topbar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_topbar.add_theme_constant_override("separation", 6)
	scroll.add_child(_topbar)
	# every entry closes the menu once it is picked; the list stays inside the screen
	_topbar.child_entered_tree.connect(func(n: Node) -> void:
		if n is Button:
			(n as Button).custom_minimum_size = Vector2(0, 46)
			(n as Button).pressed.connect(func(): _menu.visible = false))
	resized.connect(_fit_menu)
	_fit_menu.call_deferred()
	return _topbar

func _fit_menu() -> void:
	if _menu:
		var h := get_viewport_rect().size.y
		(_menu.get_child(0) as Control).custom_minimum_size.y = clampf(h - 110.0, 200.0, 560.0)

func _spawn_player() -> void:
	controls = TouchControls.new()
	add_child(controls)
	operator = OperatorPlayer.new()
	world.add_child(operator)
	var half := ROAD_W * 0.5
	var x0 := half + WALK_W
	district = District.new(-3, 3)
	var span: Vector2 = district.span()
	# out to the garage's forecourt and the lots' backs (infrastructure.gd); the facade line keeps you off the rest
	var reach := x0 + Infra.LOT_D + 0.5
	operator.bounds = Rect2(-reach, span.x + 1.0, reach * 2.0, span.y - span.x - 2.0)
	if style == "nexus":
		# the district courts (nexus_districts.gd) open off the avenue: their walls and the facade line keep the operator in
		operator.bounds = Rect2(-(Nexus.COURT_OUT + 2.0), span.x + 1.0, (Nexus.COURT_OUT + 2.0) * 2.0, span.y - span.x - 2.0)
	operator.ground_at = func(x: float, z: float) -> float:
		if x > x0 and absf(z - GARAGE_Z) < 11.0:
			return 0.23     # the garage workshop floor
		return 0.18 if absf(x) > half + 0.15 else 0.0
	operator.obstacles = _obstacles()
	operator.position = Vector3(half + 3.4, 0.18, 30.0)
	operator.heading = PI
	operator.build()
	operator.attach_camera(cam)
	gunplay = Gunplay.new()
	world.add_child(gunplay)
	gunplay.setup(operator, operator.obstacles)
	_spawn = operator.position
	armed = force_armed or story_armed()
	# two practice dummies by the garage, and the block's cyber troopers (enemies.gd) further down
	for spot in [Vector3(half + 1.6, 0.18, 19.0), Vector3(half + 4.5, 0.18, -2.0)]:
		gunplay.add_dummy(spot)
	enemies = Enemies.new()
	world.add_child(enemies)
	enemies.setup(operator, gunplay)
	enemies.goal_done.connect(func(line: String): controls.toast(line))
	if armed:
		_troopers(half)
	enemies.operator_down.connect(func(): _respawn_timer = 5.0)
	_after_enemies()

## the block's cyber troopers (only once the operator is armed)
func _troopers(half: float) -> void:
	_cover(half)
	enemies.spawn("scout", Vector3(-(half + 3.0), 0.18, -10.0), [Vector3(-(half + 3.0), 0.18, -10.0), Vector3(-(half + 3.0), 0.18, -40.0)])
	enemies.spawn("elite", Vector3(half + 3.5, 0.18, -48.0), [Vector3(half + 3.5, 0.18, -48.0), Vector3(half + 3.5, 0.18, -30.0)])
	enemies.spawn("executor", Vector3(-2.0, 0.0, -70.0), [Vector3(-2.0, 0.0, -70.0), Vector3(3.0, 0.0, -56.0)])
	enemies.spawn("marksman", Vector3(-(half + 4.0), 0.18, -95.0), [Vector3(-(half + 4.0), 0.18, -95.0), Vector3(-(half + 4.0), 0.18, -85.0)])
	enemies.spawn("drone", Vector3(0.0, 4.0, -25.0), [Vector3(0.0, 4.0, -25.0), Vector3(0.0, 4.0, -60.0)])

## destructible cover where the troopers fight (asset catalog §5): crates and concrete barriers on the walks, solid boxes
## in the shared obstacle list that bolts chip and break into debris (gunplay.add_cover). Gone for the visit once broken.
const COVER := [
	["barrier", -1.0, 2.2, -18.0], ["crate", 1.0, 2.0, -26.0], ["barrier", 1.0, 2.6, -31.0],
	["crate", -1.0, 1.8, -52.0], ["barrier", -1.0, 2.4, -66.0], ["crate", 1.0, 2.2, -86.0],
]
func _cover(half: float) -> void:
	var concrete := flat(Color(0.5, 0.5, 0.48), 0.85)
	var wood := flat(Color(0.42, 0.3, 0.18), 0.9)
	var band := flat(Color(0.95, 0.7, 0.1), 0.6)
	for c in COVER:
		var crate: bool = c[0] == "crate"
		var size := Vector3(1.2, 1.05, 1.2) if crate else Vector3(0.65, 0.95, 2.6)
		var at := Vector3(float(c[1]) * (half + float(c[2])), 0.18, float(c[3]))
		var node := Node3D.new()
		node.position = at
		world.add_child(node)
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = size
		mi.mesh = bm
		mi.material_override = wood if crate else concrete
		mi.position.y = size.y * 0.5
		node.add_child(mi)
		# a crate's slats / a barrier's hazard band
		var trim := MeshInstance3D.new()
		var tm := BoxMesh.new()
		tm.size = Vector3(size.x + 0.02, 0.12, size.z + 0.02) if crate else Vector3(size.x + 0.02, 0.16, size.z * 0.98)
		trim.mesh = tm
		trim.material_override = flat(Color(0.3, 0.2, 0.12), 0.9) if crate else band
		trim.position.y = size.y * (0.5 if crate else 0.72)
		node.add_child(trim)
		var box := AABB(at - Vector3(size.x * 0.5, 0, size.z * 0.5), size)
		operator.obstacles.append(box)
		gunplay.add_cover(box, node, 90.0 if crate else 220.0, operator.obstacles.size() - 1, Color(0.42, 0.3, 0.18) if crate else Color(0.5, 0.5, 0.48))

## Mission 01 has reached the Surge (the operator's powers and the rifle): from then on the street is walked armed
static func story_armed() -> bool:
	var f := FileAccess.open("user://mission01.json", FileAccess.READ)
	if not f:
		return false
	var d: Variant = JSON.parse_string(f.get_as_text())
	return d is Dictionary and String(d.get("phase", "")) in ["SURGE", "ANCHOR", "CLEAR", "DONE"]

func _after_enemies() -> void:
	# the gear (gear_store.gd): the worn weapons become the gun list; kills roll drops into the bag
	gear = Gear.load_save()
	wallet = Gear.profile_load()
	_fit_gear()
	# traffic (traffic.gd): eight civilian cars on the block's two lanes, sharing the obstacle list
	traffic = Traffic.new()
	world.add_child(traffic)
	traffic.setup(world, operator.obstacles, operator.bounds, operator.ground_at, LENGTH, maxi(3, int(round(8 * Phone.crowd()))), 5)
	# civilians (civilians.gd): sixteen walkers dressed from the NPC lineup on the sidewalks of the active blocks
	civilians = Civilians.new()
	world.add_child(civilians)
	# the district's first update has to come before the walkers are placed: before it every tile is frozen, the active
	# span is (INF, -INF) and every walker spawned at z = NaN (the renderer then rejected their transforms every frame)
	var first_plan: Dictionary = district.update(operator.position.z, true)
	var act0: Vector2 = district.extent(District.State.ACTIVE)
	civilians.setup(operator, operator.obstacles, operator.bounds, operator.ground_at, act0.x, act0.y, maxi(2, int(round(float(OS.get_environment("WF_WALKERS")) if OS.has_environment("WF_WALKERS") else 16 * Phone.crowd()))), 9)
	if crowd:
		crowd.set_span(act0.x, act0.y)
	if style == "nexus" or style == "neon":
		npcs = NpcStreet.new()
		world.add_child(npcs)
		npcs.setup(operator, controls, self, operator.obstacles, operator.bounds, operator.ground_at, 11.5, Vector2(-128.0, 128.0), style)
	_apply_district(first_plan)
	# street racing life (street_life.gd): the city's race meets on the avenue, challenges, the police
	life = StreetLife.new()
	add_child(life)
	life.setup(self)
	gunplay.killed.connect(func(t: Variant) -> void:
		var e: Variant = t.get_meta("enemy") if t.has_meta("enemy") else null
		var source := "enemy"
		if e != null and e.type == "elite":
			source = "elite"
		var it := Gear.roll_drop(gear, source, randf(), Gear.operator_power(gear), randi())
		if not it.is_empty():
			Gear.save(gear)
			controls.toast("Picked up %s · %d" % [it.name, int(it.power)]))
	var inv := Button.new()
	inv.text = "INVENTORY"
	inv.pressed.connect(open_inventory)
	_bar().add_child(inv)
	var op := Button.new()
	op.text = "OPERATOR"
	op.pressed.connect(open_profile)
	_bar().add_child(op)
	# turn the screen without the phone's rotation lock in the way: AUTO → LANDSCAPE → PORTRAIT
	var rot := Button.new()
	rot.text = "⟳ " + String(Settings.get_value("orientation")).to_upper()
	rot.pressed.connect(func(): rot.text = "⟳ " + Settings.cycle_orientation().to_upper())
	_bar().add_child(rot)

var profile_overlay: Control
## the operator panel (progress/profile_view.gd) over the street; the wallet reloads on close since goals may have paid
func open_profile() -> void:
	if profile_overlay:
		return
	profile_overlay = ProfileView.new()
	profile_overlay.closed.connect(func():
		profile_overlay.queue_free()
		profile_overlay = null
		wallet = Gear.profile_load())
	add_child(profile_overlay)

func _fit_gear() -> void:
	gunplay.set_loadout(Gear.loadout(gear))
	gunplay.set_holstered(not armed)
	if controls:
		controls.set_armed(armed)
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	if enemies:
		enemies.hull_max = Enemies.HULL_MAX + Gear.hull_bonus(gear) + Progression.hull_bonus(Gear.profile_load())   # armour and level
		enemies.hull = minf(enemies.hull, enemies.hull_max)

func open_inventory() -> void:
	if inventory_overlay:
		return
	inventory_overlay = InventoryView.new()
	inventory_overlay.gear = gear
	inventory_overlay.closed.connect(close_inventory)
	inventory_overlay.changed.connect(func(): Gear.save(gear); _fit_gear())
	add_child(inventory_overlay)
	controls.visible = false

func close_inventory() -> void:
	if inventory_overlay:
		inventory_overlay.queue_free()
		inventory_overlay = null
	controls.visible = true

## world boxes the operator slides around: the props and buildings (`size` meta from prop()), the parked cars, and the
## facade line where no building stands (the block's ends); the garage lot stays open
func _obstacles() -> Array[AABB]:
	var out: Array[AABB] = []
	for c in world.get_children():
		var n := c as Node3D
		if not n:
			continue
		if n.has_meta("size"):
			var sz: Vector3 = n.get_meta("size")
			var file := String(n.get_meta("file")) if n.has_meta("file") else ""
			if file.contains("palm") or file.begins_with("street-lamp"):
				sz = Vector3(0.6, sz.y, 0.6)   # the trunk, not the fronds
			out.append(_world_box(n.transform, Vector3(-sz.x * 0.5, 0, -sz.z * 0.5), Vector3(sz.x * 0.5, sz.y, sz.z * 0.5)))
		elif n.has_meta("car"):
			var a := _aabb(n)
			n.set_meta("box_index", out.size())
			out.append(_world_box(n.transform, a.position, a.end))
	var x0 := ROAD_W * 0.5 + WALK_W
	out.append(AABB(Vector3(-x0 - 0.5, 0, -LENGTH * 0.5), Vector3(0.5, 12.0, LENGTH)))
	out.append(AABB(Vector3(x0, 0, -LENGTH * 0.5), Vector3(0.5, 12.0, GARAGE_Z - 11.0 + LENGTH * 0.5)))
	out.append(AABB(Vector3(x0, 0, GARAGE_Z + 11.0), Vector3(0.5, 12.0, LENGTH * 0.5 - GARAGE_Z - 11.0)))
	# the garage shell (_garage_front): its two side walls, the back wall, the door jambs, the lift and the tool wall
	out.append(AABB(Vector3(x0, 0, GARAGE_Z - 11.2), Vector3(16.4, 9.0, 0.4)))
	out.append(AABB(Vector3(x0, 0, GARAGE_Z + 10.8), Vector3(16.4, 9.0, 0.4)))
	out.append(AABB(Vector3(x0 + 15.8, 0, GARAGE_Z - 11.0), Vector3(0.6, 9.0, 22.0)))
	out.append(AABB(Vector3(x0, 0, GARAGE_Z - 11.0), Vector3(0.5, 9.0, 3.0)))
	out.append(AABB(Vector3(x0, 0, GARAGE_Z + 8.0), Vector3(0.5, 9.0, 3.0)))
	out.append(AABB(Vector3(x0 + 6.5, 0, GARAGE_Z - 5.2), Vector3(5.0, 1.5, 2.4)))
	out.append(AABB(Vector3(x0 + 15.45, 0, GARAGE_Z - 2.0), Vector3(0.3, 3.0, 10.0)))
	return out

static func _world_box(t: Transform3D, lo: Vector3, hi: Vector3) -> AABB:
	var box := AABB(lo, hi - lo)
	var w := AABB(t * box.position, Vector3.ZERO)
	for i in 8:
		w = w.expand(t * box.get_endpoint(i))
	return w

# --------------------------------------------------------------------------------------------- district streaming
## apply the tiles whose state changed (district.update): build, keep as boxes, or park
func _apply_district(changes: Dictionary) -> void:
	for k in changes:
		if k == 0:
			continue     # the authored hub block is always there
		var want: int = changes[k]
		if not tiles.has(k):
			tiles[k] = { "root": null, "slots": [] }
		var t: Dictionary = tiles[k]
		if want == District.State.ACTIVE:
			var fresh: bool = t.root == null
			if fresh:
				t.root = _build_tile(k)
			if (t.slots as Array).is_empty():
				_slot_boxes(t, _tile_boxes(k, t.root))
			elif fresh:
				_tile_boxes(k, t.root)     # same build, same order: only marks the cars' box slots
			if fresh:
				for c in (t.root as Node3D).get_children():
					if c.has_meta("car") and c.has_meta("box_slot"):
						c.set_meta("box_index", int(t.slots[int(c.get_meta("box_slot"))]))
						parked.append(c as Node3D)
		elif want == District.State.SIMULATED:
			if (t.slots as Array).is_empty():
				# coming from frozen: the boxes come from a build that is dropped straight away
				var root := _build_tile(k)
				_slot_boxes(t, _tile_boxes(k, root))
				root.queue_free()
			elif t.root:
				(t.root as Node3D).queue_free()
			t.root = null
		else:
			if t.root:
				(t.root as Node3D).queue_free()
				t.root = null
			for i in t.slots:
				operator.obstacles[i] = PARKED_BOX
				_free_slots.append(i)
			t.slots = []
	if traffic:
		var sim: Vector2 = district.extent(District.State.SIMULATED)
		var act: Vector2 = district.extent(District.State.ACTIVE)
		traffic.set_span(sim.x, sim.y, act.x, act.y)
	if civilians:
		var act2: Vector2 = district.extent(District.State.ACTIVE)
		civilians.set_span(act2.x, act2.y)
		if crowd:
			crowd.set_span(act2.x, act2.y)

## one block of the avenue at z = k * TILE, deterministic per tile, built with the same builders as the hub block
func _build_tile(k: int) -> Node3D:
	var root := Node3D.new()
	root.position = Vector3(0, 0, District.tile_z(k))
	root.name = "tile_%d" % k
	world.add_child(root)
	_tile_root = root
	_tile_k = k
	var keep_seed := _rng.seed
	_rng.seed = 2207 + k * 101
	_street()
	_buildings()
	_props()
	_cars()
	_dressing()
	_street_set()
	_civic_life()
	Infra.build(self, k, root)
	if night:
		_neon()
	if style == "nexus":
		for sd: float in [-1.0, 1.0]:
			Nexus.new(self, k, sd).build()
		if k == district.min_k:
			Nexus.north_gate(self, -LENGTH * 0.5 + 0.5)
		if k == district.max_k:
			Nexus.south_quay(self, LENGTH * 0.5 - 0.5)
		Nexus.tile_skyline(self, _rng)
	StaticBatch.batch(root)
	_rng.seed = keep_seed
	_tile_root = null
	_tile_k = 0
	return root

## the tile's obstacle boxes in world space: its props, buildings and parked cars, and both facade lines
func _tile_boxes(k: int, root: Node3D) -> Array[AABB]:
	var out: Array[AABB] = []
	for c in root.get_children():
		var n := c as Node3D
		if not n or not n.has_meta("size"):
			continue
		var sz: Vector3 = n.get_meta("size")
		if n.has_meta("car"):
			n.set_meta("box_slot", out.size())     # where its box lands in the tile's slots (enter_car parks it)
		var file := String(n.get_meta("file")) if n.has_meta("file") else ""
		if file.contains("palm") or file.begins_with("street-lamp"):
			sz = Vector3(0.6, sz.y, 0.6)
		out.append(_world_box(root.transform * n.transform, Vector3(-sz.x * 0.5, 0, -sz.z * 0.5), Vector3(sz.x * 0.5, sz.y, sz.z * 0.5)))
	var x0 := ROAD_W * 0.5 + WALK_W
	var z0 := District.tile_z(k) - LENGTH * 0.5
	for sd: float in [-1.0, 1.0]:
		var xf := x0 if sd > 0.0 else -x0 - 0.5
		# the facade line, open at a Nexus side street's mouth and at a lot's frontage (infrastructure.gd)
		var zc := District.tile_z(k)
		var open: Array = []
		if style == "nexus" and Nexus.has_court(k, sd):
			open.append(Vector2(zc - Nexus.MOUTH_HALF, zc + Nexus.MOUTH_HALF))
		for g: Vector2 in Infra.gaps(k, sd):
			open.append(Vector2(zc + g.x, zc + g.y))
		open.sort_custom(func(a: Vector2, b: Vector2) -> bool: return a.x < b.x)
		var at := z0
		for o: Vector2 in open:
			if o.x > at:
				out.append(AABB(Vector3(xf, 0, at), Vector3(0.5, 12.0, o.x - at)))
			at = maxf(at, o.y)
		if at < z0 + LENGTH:
			out.append(AABB(Vector3(xf, 0, at), Vector3(0.5, 12.0, z0 + LENGTH - at)))
	return out

## boxes into the shared obstacle list through index-stable slots (traffic and the driven car hold indexes)
func _slot_boxes(t: Dictionary, boxes: Array[AABB]) -> void:
	var slots: Array = []
	for b in boxes:
		if _free_slots.is_empty():
			slots.append(operator.obstacles.size())
			operator.obstacles.append(b)
		else:
			var i: int = _free_slots.pop_back()
			operator.obstacles[i] = b
			slots.append(i)
	t.slots = slots

var _respawn_timer := 0.0
func _process(dt: float) -> void:
	WetNight.follow(_rain, cam)
	if not operator or not controls:
		return
	if mall_overlay or casino_overlay or sports_overlay or garage_overlay or inventory_overlay or shop_overlay:
		return
	if enemies:
		enemies.step(minf(dt, 0.05))
		controls.show_hull(enemies.hull / enemies.hull_max, enemies.hurt, enemies.down, enemies.shield_frac())
		if _respawn_timer > 0.0:
			_respawn_timer -= dt
			if _respawn_timer <= 0.0:
				operator.position = _spawn
				operator.velocity = Vector3.ZERO
	if district:
		var focus: Vector3 = driving_car.node.position if driving_car else operator.position
		var ch: Dictionary = district.update(focus.z)
		if not ch.is_empty():
			_apply_district(ch)
	_step_dressing(minf(dt, 0.05))
	if crowd and operator:
		crowd.set_player(operator.position)
	if civilians:
		civilians.step(minf(dt, 0.05))
		if gunplay and gunplay.shots_fired != _shots_seen:
			_shots_seen = gunplay.shots_fired
			civilians.scatter(operator.position)
			if npcs:
				npcs.gunfire(operator.position)
	_infra_t += minf(dt, 0.05)
	Infra.step(self, _infra_t)
	if traffic:
		traffic.watch_point = operator.position
		traffic.watch_box = driving_car.box() if driving_car else AABB()
		traffic.step(minf(dt, 0.05))
	if driving_car:
		_drive(minf(dt, 0.05))
		if life:
			life.step(minf(dt, 0.05))
		return
	if life:
		life.step(minf(dt, 0.05))
	if npcs:
		npcs.step(minf(dt, 0.05))
		if npcs.busy:
			# in a conversation: the operator stands still and nothing else takes input
			operator.step(minf(dt, 0.05), Vector2.ZERO, Vector2.ZERO, false, false)
			return
	operator.step(minf(dt, 0.05), controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
	if not _look_pts.is_empty():
		cam.position = _look_pts[0]
		cam.look_at(_look_pts[1])
	if style == "nexus":
		# entering a district court (or the plaza) names it once
		var area := Nexus.area_at(operator.position)
		if area != _area:
			_area = area
			if area != "" and area != "NEXUS AVENUE":
				controls.toast(area)
	# a parked car within reach: the prompt, and ENTER / E takes it (a tile's cars leave the list when the tile goes)
	var near: Node3D = null
	var gone := false
	for c in parked:
		if not is_instance_valid(c) or c.is_queued_for_deletion():
			gone = true
			continue
		if c.visible and c.global_position.distance_to(operator.position) < 3.2:
			near = c
			break
	if gone:
		var keep: Array[Node3D] = []
		for c in parked:
			if is_instance_valid(c) and not c.is_queued_for_deletion():
				keep.append(c)
		parked = keep
	# a hub door within reach outranks a car
	var door_id := ""
	var door_label := ""
	for d in _door_spots:
		if Vector2(operator.position.x - (d.pos as Vector3).x, operator.position.z - (d.pos as Vector3).z).length() < 3.6:
			door_id = String(d.id)
			door_label = String(d.label)
			break
	# a named person within reach comes after a door, before a car
	var npc_id: String = npcs.near(operator.position) if npcs and door_id == "" else ""
	if door_id != _near_door or near != _near_car or npc_id != _near_npc:
		_near_door = door_id
		_near_car = near
		_near_npc = npc_id
		controls.prompt(("ENTER " + door_label) if door_id != "" else (npcs.label_for(npc_id) if npc_id != "" else (((("LOCKED · " if bool(near.get_meta("locked", false)) else "ENTER ") + _car_name(near))) if near else "")))
	# one ENTER press, read once: a door within reach takes it, else a car (reading it twice ate every press on the way
	# to the car check, so no car could be entered once the hub doors arrived)
	var pressed_enter: bool = controls.take_enter()
	if pressed_enter and door_id != "":
		_enter_door(door_id)
		return
	if pressed_enter and npc_id != "":
		controls.prompt("")
		_near_npc = ""
		npcs.talk(npc_id)
		return
	if pressed_enter and near:
		if bool(near.get_meta("locked", false)):
			# someone's car: the door will not open, the alarm goes off (owner, Nov 11)
			CarDetail.alarm(near, operator.position)
			controls.toast("Locked — this " + _car_name(near).to_lower() + " belongs to someone. Find an unlocked car, or take one of yours from the garage.")
			return
		enter_car(near)
		return
	if gunplay:
		if controls.take_next():
			gunplay.next_weapon()
		gunplay.step(minf(dt, 0.05), cam, controls.fire, controls.take_reload(), Vector2(operator.velocity.x, operator.velocity.z).length())
		var g = gunplay.gun()
		controls.weapon_name.text = g.display_name() if armed else "UNARMED"
		controls.ammo.text = "" if not armed else ("RELOADING" if g.reloading > 0.0 else g.ammo_text())

# --------------------------------------------------------------------------------------------- light, sky, haze
func _environment() -> void:
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.78, 0.55)
	sun.light_energy = 2.6
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 220.0
	Phone.fit_sun(sun)
	sun.light_angular_distance = 1.2
	sun.rotation_degrees = Vector3(-11.0, 148.0, 0.0)   # low sun ahead and to the right, long shadows across the street
	sun.light_volumetric_fog_energy = 1.6
	world.add_child(sun)
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.29, 0.43, 0.66)
	sky_mat.sky_horizon_color = Color(0.98, 0.72, 0.50)
	sky_mat.ground_horizon_color = Color(0.70, 0.55, 0.45)
	sky_mat.ground_bottom_color = Color(0.18, 0.17, 0.17)
	sky_mat.sun_angle_max = 20.0
	sky_mat.sun_curve = 0.08
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.55
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.05
	env.ssr_enabled = Data.forward_plus()
	env.ssr_max_steps = 96
	env.ssr_fade_in = 0.1
	env.ssr_fade_out = 2.5
	env.ssao_enabled = Data.forward_plus()
	env.ssao_radius = 1.4
	env.ssao_intensity = 1.6
	env.ssil_enabled = Data.forward_plus()
	var lite := OS.get_environment("SLICE_LITE")   # "gi" drops SDFGI, "fog" drops volumetric fog, "all" both
	# SDFGI stalls the software Vulkan used for testing; opt in with SLICE_GI=1 on a real GPU
	env.sdfgi_enabled = Data.forward_plus() and OS.get_environment("SLICE_GI") == "1" and lite != "gi" and lite != "all"
	env.sdfgi_use_occlusion = true
	env.sdfgi_cascades = 4
	env.sdfgi_min_cell_size = 0.25
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 1.1
	env.fog_enabled = true
	env.fog_light_color = Color(0.92, 0.72, 0.55)
	env.fog_density = 0.0016
	env.fog_sun_scatter = 0.35
	env.fog_aerial_perspective = 0.55
	env.volumetric_fog_enabled = Data.forward_plus() and lite != "fog" and lite != "all"
	env.volumetric_fog_density = 0.006
	env.volumetric_fog_albedo = Color(0.95, 0.85, 0.75)
	env.volumetric_fog_anisotropy = 0.55
	env.volumetric_fog_length = 160.0
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.06
	env.adjustment_saturation = 1.12
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	if style == "nexus" and not night:
		# Nexus City by day (owner's street frame, Nov 11): late-morning sun high over the towers, a deep blue sky with
		# white cumulus, bright clean air — not the old golden-hour haze. The pavers carry a polished sheen (`_day_sheen`).
		sun.light_color = Color(1.0, 0.95, 0.86)
		sun.light_energy = 2.3
		sun.rotation_degrees = Vector3(-46.0, 152.0, 0.0)
		sun.light_volumetric_fog_energy = 0.6
		sky.sky_material = day_sky()
		sky.process_mode = Sky.PROCESS_MODE_INCREMENTAL
		sky.radiance_size = Sky.RADIANCE_SIZE_128
		env.ambient_light_energy = 1.05
		env.tonemap_exposure = 1.06
		env.glow_intensity = 0.45
		env.glow_hdr_threshold = 1.3
		env.fog_light_color = Color(0.70, 0.80, 0.95)
		env.fog_density = 0.0007
		env.fog_sun_scatter = 0.12
		env.fog_aerial_perspective = 0.8
		env.volumetric_fog_density = 0.0015
		env.volumetric_fog_albedo = Color(0.85, 0.9, 1.0)
		env.adjustment_contrast = 1.08
		env.adjustment_saturation = 1.2
		_day_probe()
	if night:
		sun.light_color = Color(0.55, 0.62, 0.9)
		sun.light_energy = 0.22
		sun.rotation_degrees = Vector3(-38.0, 120.0, 0.0)
		sun.light_volumetric_fog_energy = 0.3
		sky_mat.sky_top_color = Color(0.02, 0.025, 0.06)
		sky_mat.sky_horizon_color = Color(0.22, 0.12, 0.28)
		sky_mat.ground_horizon_color = Color(0.12, 0.08, 0.14)
		sky_mat.ground_bottom_color = Color(0.02, 0.02, 0.03)
		sky_mat.sun_angle_max = 2.0
		# the owner's references are a lit night: a violet-cyan city bounce, not crushed darks (AGENTS: Neon City's
		# cyberpunk comes from colour), so the ambient is a fixed colour at full energy and the moon is stronger
		env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.ambient_light_color = Color(0.42, 0.32, 0.62)
		env.ambient_light_energy = 1.25
		sun.light_energy = 0.55
		env.tonemap_exposure = 1.5
		env.glow_intensity = 1.1
		env.glow_bloom = 0.16
		env.glow_hdr_threshold = 0.85
		env.fog_light_color = Color(0.3, 0.22, 0.42)
		env.fog_density = 0.0022
		env.fog_sun_scatter = 0.05
		env.volumetric_fog_density = 0.012
		env.volumetric_fog_albedo = Color(0.7, 0.7, 0.9)

## the day sky over Nexus City: a deep zenith blue to a pale horizon, white cumulus drifting slowly (two fbm octave
## sets, lit on the sun side), the sun disc. Cheap: a few noise taps per sky pixel, and the radiance map is small.
static func day_sky() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type sky;
uniform vec3 zenith : source_color = vec3(0.13, 0.34, 0.72);
uniform vec3 horizon : source_color = vec3(0.62, 0.78, 0.95);
uniform vec3 ground : source_color = vec3(0.30, 0.31, 0.33);
uniform float cover = 0.48;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5; float v = 0.0; for (int k = 0; k < 5; k++) { v += a * n(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
void sky() {
	vec3 d = EYEDIR;
	if (d.y < 0.0) { COLOR = mix(horizon * 0.8, ground, clamp(-d.y * 4.0, 0.0, 1.0)); }
	else {
		float t = pow(1.0 - d.y, 3.0);
		vec3 c = mix(zenith, horizon, t);
		vec3 sd = LIGHT0_DIRECTION;
		float sun = max(dot(d, sd), 0.0);
		c += LIGHT0_COLOR * (pow(sun, 900.0) * 30.0 + pow(sun, 8.0) * 0.18);
		// clouds on a plane above: denser toward the horizon, thinned overhead
		vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(TIME * 0.004, TIME * 0.002);
		float cl = smoothstep(cover, cover + 0.22, fbm(uv));
		float shade = fbm(uv + sd.xz * 0.25);
		vec3 cc = mix(vec3(1.0), vec3(0.72, 0.76, 0.84), clamp((shade - cl * 0.4) * 1.2, 0.0, 1.0));
		cl *= smoothstep(0.0, 0.08, d.y);
		COLOR = mix(c, cc * (1.0 + 0.25 * sun), cl * 0.9);
	}
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	return m

# --------------------------------------------------------------------------------------------- materials
static func _noise_tex(freq: float, octaves: int, size := 1024, normal := false, seamless := true) -> NoiseTexture2D:
	var n := FastNoiseLite.new()
	n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n.frequency = freq
	n.fractal_octaves = octaves
	var t := NoiseTexture2D.new()
	t.width = size
	t.height = size
	t.seamless = seamless
	t.noise = n
	if normal:
		t.as_normal_map = true
		t.bump_strength = 6.0
	return t

## wet asphalt: dark, with puddles where the roughness noise drops low enough to mirror the sky and the buildings
static func asphalt() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform sampler2D puddle_noise : hint_default_white, repeat_enable;
uniform sampler2D grain : hint_default_white, repeat_enable;
uniform sampler2D grain_n : hint_normal, repeat_enable;
uniform float wet = 0.75;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wpos.xz;
	float g = dot(texture(grain, p * 0.28).rgb, vec3(0.33)) * 1.6;
	float puddle = smoothstep(0.52, 0.62, texture(puddle_noise, p * 0.018).r * 0.8 + texture(puddle_noise, p * 0.07).r * 0.3);
	float wetness = clamp(wet * 0.55 + puddle * wet, 0.0, 1.0);
	vec3 base = vec3(0.075, 0.078, 0.085) * (0.75 + 0.5 * g);
	ALBEDO = mix(base, base * 0.55, wetness);
	ROUGHNESS = mix(0.86, 0.05, wetness);
	SPECULAR = mix(0.4, 0.75, wetness);
	NORMAL_MAP = mix(texture(grain_n, p * 0.28).xyz, vec3(0.5, 0.5, 1.0), puddle);
	NORMAL_MAP_DEPTH = 0.8;
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("puddle_noise", _noise_tex(0.004, 4, 512))
	# real asphalt (Poly Haven asphalt_02) for the grain and its bump; noise if the set is missing
	if ResourceLoader.exists("res://textures/pbr/asphalt_02_diff.jpg"):
		m.set_shader_parameter("grain", load("res://textures/pbr/asphalt_02_diff.jpg"))
		m.set_shader_parameter("grain_n", load("res://textures/pbr/asphalt_02_nor.jpg"))
	else:
		m.set_shader_parameter("grain", _noise_tex(0.09, 3, 512))
		m.set_shader_parameter("grain_n", _noise_tex(0.09, 3, 512, true))
	return m

## pale stone paving in 0.6 m slabs, damp in the joints
static func paving() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform sampler2D grain : hint_default_white, repeat_enable;
uniform sampler2D grain_n : hint_normal, repeat_enable;
uniform bool has_n = false;
uniform vec3 lo_col = vec3(0.60, 0.55, 0.49);
uniform vec3 hi_col = vec3(0.70, 0.65, 0.57);
uniform float wet = 0.0;   // night rain: darker stone, glossy, puddles in the low spots
uniform sampler2D puddle_noise : hint_default_white, repeat_enable;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wpos.xz / vec2(0.6, 0.6);
	vec2 f = abs(fract(p) - 0.5);
	float joint = 1.0 - smoothstep(0.46, 0.49, max(f.x, f.y));
	vec2 id = floor(p);
	float tint = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
	float g = texture(grain, wpos.xz * 0.6).r;
	vec3 stone = mix(lo_col, hi_col, tint) * (0.88 + 0.2 * g);
	float puddle = wet * smoothstep(0.52, 0.64, texture(puddle_noise, wpos.xz * 0.02).r * 0.8 + texture(puddle_noise, wpos.xz * 0.08).r * 0.3);
	float damp = clamp(wet * 0.6 + puddle, 0.0, 1.0);
	ALBEDO = mix(stone * 0.62, stone, joint) * mix(1.0, 0.45, damp);
	ROUGHNESS = mix(mix(0.35, 0.78 + 0.08 * tint, joint), 0.08, damp);
	SPECULAR = mix(0.5, 0.8, damp);
	if (has_n) { NORMAL_MAP = texture(grain_n, wpos.xz * 0.5).xyz; NORMAL_MAP_DEPTH = 0.6; }
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("grain", _noise_tex(0.12, 3, 256))
	if ResourceLoader.exists("res://textures/pbr/brushed_concrete_nor.jpg"):
		m.set_shader_parameter("grain_n", load("res://textures/pbr/brushed_concrete_nor.jpg"))
		m.set_shader_parameter("has_n", true)
	return m

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

func _box(size: Vector3, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.position = pos
	mi.material_override = mat
	(parent if parent else _root()).add_child(mi)
	return mi

func _root() -> Node3D:
	return _tile_root if _tile_root else world

# --------------------------------------------------------------------------------------------- street
func _street() -> void:
	var half := ROAD_W * 0.5
	_box(Vector3(ROAD_W, 0.1, LENGTH), Vector3(0, -0.05, 0), asphalt())
	var pave := paving()
	_pavings.append(pave)
	if night:
		_wet_paving(pave)
	elif style == "nexus":
		_day_sheen(pave)
	if style == "coast":
		# pink and sand terrazzo for the Art Deco strip
		pave.set_shader_parameter("lo_col", Vector3(0.78, 0.62, 0.58))
		pave.set_shader_parameter("hi_col", Vector3(0.86, 0.78, 0.66))
	var kerb := flat(Color(0.62, 0.61, 0.58), 0.6)
	for side: float in [-1.0, 1.0]:
		_box(Vector3(WALK_W, 0.18, LENGTH), Vector3(side * (half + WALK_W * 0.5), 0.09, 0), pave)
		_box(Vector3(0.3, 0.2, LENGTH), Vector3(side * (half + 0.15), 0.1, 0), kerb)
	# lane paint, worn, and a pedestrian crossing at the end of the block
	var paint := flat(Color(0.85, 0.85, 0.82), 0.5)
	var z := -LENGTH * 0.5 + 4.0
	while z < LENGTH * 0.5 - 4.0:
		_box(Vector3(0.15, 0.012, 3.0), Vector3(0, 0.006, z), paint)
		z += 9.0
	for side: float in [-1.0, 1.0]:
		_box(Vector3(0.15, 0.012, LENGTH), Vector3(side * (half - 0.6), 0.006, 0), paint)
	var x := -half + 1.0
	while x < half - 0.5:
		_box(Vector3(0.9, 0.012, 4.0), Vector3(x, 0.006, -62.0), paint)
		x += 1.8

## the rain-soaked night of the owner's renders (scripts/city/wet_night.gd): the walks go dark and glossy, a mirror
## overlay on the road and both walks, rain round the camera
var _rain: GPUParticles3D
## every paving material this slice made (tiles stream in later), so the night can wet them all
var _pavings: Array[ShaderMaterial] = []

func _wet_paving(sm: ShaderMaterial) -> void:
	sm.set_shader_parameter("wet", 0.9)
	sm.set_shader_parameter("puddle_noise", _noise_tex(0.004, 4, 512))
	sm.set_shader_parameter("lo_col", Vector3(0.17, 0.17, 0.2))
	sm.set_shader_parameter("hi_col", Vector3(0.24, 0.24, 0.28))

## Nexus by day: polished pale pavers, freshly hosed — a light sheen everywhere and shallow glossy patches that
## catch the towers and the sky (owner's street frame)
func _day_sheen(sm: ShaderMaterial) -> void:
	sm.set_shader_parameter("wet", 0.32)
	sm.set_shader_parameter("puddle_noise", _noise_tex(0.004, 4, 512))
	sm.set_shader_parameter("lo_col", Vector3(0.55, 0.54, 0.52))
	sm.set_shader_parameter("hi_col", Vector3(0.66, 0.64, 0.60))

## one reflection probe over the block, baked once: the mobile renderer has no SSR, so the glossy pavers and glass
## would otherwise mirror only the sky
func _day_probe() -> void:
	var rp := ReflectionProbe.new()
	rp.update_mode = ReflectionProbe.UPDATE_ONCE
	rp.size = Vector3(80.0, 60.0, LENGTH)
	rp.position = Vector3(0.0, 8.0, 0.0)
	rp.origin_offset = Vector3(0.0, -6.0, 0.0)
	rp.box_projection = true
	rp.max_distance = 400.0
	rp.intensity = 0.9
	world.add_child(rp)

func _wet_night() -> void:
	var half := ROAD_W * 0.5
	for sm: ShaderMaterial in _pavings:
		_wet_paving(sm)
	if WetNight.supported():
		var road := WetNight.overlay_material(0.95, 0.55)
		WetNight.overlay(world, Vector2(ROAD_W, LENGTH), Vector3(0, 0.0, 0), road)
		var walks := WetNight.overlay_material(0.7, 0.35)
		for side: float in [-1.0, 1.0]:
			WetNight.overlay(world, Vector2(WALK_W, LENGTH), Vector3(side * (half + WALK_W * 0.5), 0.18, 0), walks)
	_rain = WetNight.rain(world, 700 if Phone.on_phone() else 1400)

# --------------------------------------------------------------------------------------------- loading models
## a Meshy prop scaled so its height is `height` metres, base on the ground, centred on x/z
## Meshy props whose meshes are torn (open faces, glass panes in shards): left out until they are remade; every caller
## builds without them (owner's phone test, Nov 9)
const SHATTERED := ["planter.glb", "bus-shelter.glb", "apartment.glb", "brick.glb", "office.glb", "deco.glb", "villa.glb"]
func prop(file: String, height: float, pos: Vector3, yaw_deg := 0.0) -> Node3D:
	if file.get_file() in SHATTERED:
		return null
	var path := MODELS + file
	if not ResourceLoader.exists(path):
		push_warning("street slice: missing " + path)
		return null
	if not _cache.has(path):
		_cache[path] = load(path)
	var node := (_cache[path] as PackedScene).instantiate() as Node3D
	var holder := Node3D.new()
	holder.add_child(node)
	var aabb := _aabb(node)
	var s := height / maxf(aabb.size.y, 0.001)
	node.scale = Vector3.ONE * s
	node.position = Vector3(-(aabb.position.x + aabb.size.x * 0.5) * s, -aabb.position.y * s, -(aabb.position.z + aabb.size.z * 0.5) * s)
	holder.position = pos
	holder.rotation_degrees.y = yaw_deg
	holder.set_meta("size", aabb.size * s)
	holder.set_meta("file", file)
	_root().add_child(holder)
	return holder

## scale a hull's children so its longest axis is `length` metres, resting on y = 0
static func _fit_length(hull: Node3D, length: float) -> void:
	var a := _aabb(hull)
	var longest := maxf(a.size.x, a.size.z)
	if longest < 0.01:
		return
	var k := length / longest
	for ch in hull.get_children():
		if ch is Node3D:
			(ch as Node3D).scale *= k
			(ch as Node3D).position = (ch as Node3D).position * k - Vector3(0, a.position.y * k, 0)

static func _aabb(n: Node) -> AABB:
	var out := AABB()
	var first := true
	for c in n.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var t := Transform3D.IDENTITY
		var p: Node = mi
		while p != n and p is Node3D:
			t = (p as Node3D).transform * t
			p = p.get_parent()
		var a := t * mi.get_aabb()
		out = a if first else out.merge(a)
		first = false
	return out

# --------------------------------------------------------------------------------------------- buildings
func _buildings() -> void:
	var half := ROAD_W * 0.5 + WALK_W
	# which blocks line the street, and how tall each kind stands (m). The Meshy blocks (office, brick, deco, villa,
	# apartment, riverdale) are out (bug sweep and the owner's phone test, Nov 9): their meshes are torn, their facades
	# crinkle like foil and simplified for the phone they shatter; the fleet's own towers stand in.
	var kinds: Array = [["../buildings/nexus-civic-b.glb", 22.0], ["../buildings/nexus-civic-a.glb", 22.0], ["../buildings/nexus-civic-c.glb", 34.0], ["../buildings/nexus-terrace-a.glb", 18.0], ["../buildings/nexus-terrace-b.glb", 16.0], ["../buildings/nexus-civic-a.glb", 24.0], ["../buildings/nexus-spire.glb", 40.0], ["../buildings/nexus-civic-b.glb", 26.0]]
	if style == "coast":
		kinds = [["../buildings/nexus-terrace-a.glb", 15.0], ["../buildings/nexus-terrace-b.glb", 14.0], ["../buildings/neon-v-F.glb", 18.0], ["../buildings/nexus-terrace-b.glb", 12.0]]
	elif style == "neon":
		kinds = [["../buildings/neon-v-D.glb", 22.0], ["../buildings/neon-v-A.glb", 24.0], ["../buildings/neon-v-E.glb", 26.0], ["../buildings/neon-block-a.glb", 24.0], ["../buildings/neon-v-C.glb", 30.0], ["../buildings/neon-tower-a.glb", 34.0], ["../buildings/neon-block-b.glb", 22.0], ["../buildings/neon-tower-b.glb", 36.0]]
	var k := 0
	for side: float in [-1.0, 1.0]:
		var z := -LENGTH * 0.5 + 6.0
		while z < LENGTH * 0.5 - 10.0:
			if _tile_k == 0 and side > 0 and absf(z + 9.0 - GARAGE_Z) < 12.0:
				z += 22.0     # the city garage takes this lot
				continue
			if _court_here(side) and z + 18.0 > -Nexus.COURT_HALF and z < Nexus.COURT_HALF:
				z = Nexus.COURT_HALF + 0.5     # a district court's own blocks front the avenue here
				continue
			if _tile_root != null and _lot_cut(side, z) > -INF:
				z = _lot_cut(side, z) + 0.5     # past the lot (infrastructure.gd)
				continue
			var pick: Array = kinds[(k * 7 + int(side + 1.0)) % kinds.size()]
			# the casino podium on the far side of the Neon City hub, at the head of the block (Neon City's alone)
			if _tile_k == 0 and _tile_root == null and style == "neon" and side < 0 and k == 2:
				pick = ["casino.glb", 14.0]
			var h: float = float(pick[1]) * _rng.randf_range(0.92, 1.1)
			# Meshy models face +z; turning by -90 * side faces them across the street
			var b := prop(String(pick[0]), h, Vector3(side * half, 0.0, z), -90.0 * side)
			var width := 18.0
			if b:
				var size: Vector3 = b.get_meta("size")
				width = size.x
				b.position.x = side * (half + size.z * 0.5)     # the facade sits on the back of the sidewalk
				b.position.z = z + width * 0.5
				if String(pick[0]) == "casino.glb":
					_casino_at = b.position
				if style == "nexus" and String(pick[0]) == "apartment.glb":
					# street-level shops on the apartment blocks
					prop("shopfront.glb", 5.2, Vector3(side * (half + 4.0), 0.18, b.position.z), -90.0 * side)
			z += width + _rng.randf_range(0.0, 1.5)
			k += 1

## a Nexus district court opens on this side of the tile being built (never on the hub, never in the other cities)
func _court_here(side: float) -> bool:
	return style == "nexus" and _tile_root != null and Nexus.has_court(_tile_k, side)

## the side street's mouth (and a lot's frontage, infrastructure.gd): nothing stands on the walk or the facade line there
func _in_mouth(side: float, z: float) -> bool:
	if _tile_root != null and Infra.lot_at(_tile_k, side, z, 2.5) != "":
		return true
	return _court_here(side) and absf(z) < Nexus.MOUTH_HALF + 2.5

## a building that would stand over a lot (gas station, bus terminal, building site, parking garage) isn't built:
## the lot's far end to carry on from, or -INF where there's no lot
func _lot_cut(side: float, z: float) -> float:
	for g: Vector2 in Infra.gaps(_tile_k, side):
		if z + 18.0 > g.x and z < g.y:
			return g.y
	return -INF

## glass towers rising behind the street wall: the skyline in the concept frames
func _skyline() -> void:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform vec3 glass : source_color = vec3(0.32, 0.42, 0.52);
uniform vec3 frame : source_color = vec3(0.16, 0.17, 0.19);
uniform float floor_h = 3.3;
uniform float bay_w = 1.5;
uniform float lit = 0.25;
uniform float glow = 0.35;
varying vec3 wpos;
varying vec3 wnrm;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 9137.7); }
void fragment() {
	vec2 uv = vec2(abs(wnrm.x) > 0.5 ? wpos.z : wpos.x, wpos.y);
	vec2 cell = uv / vec2(bay_w, floor_h);
	vec2 f = fract(cell);
	float mullion = step(0.93, f.x) + step(0.88, f.y);
	float on = step(1.0 - lit, h21(floor(cell))) * (1.0 - mullion);
	vec3 g = glass * (0.8 + 0.4 * h21(floor(cell) * 0.37));
	ALBEDO = mix(g, frame, clamp(mullion, 0.0, 1.0));
	METALLIC = mix(0.85, 0.3, clamp(mullion, 0.0, 1.0));
	ROUGHNESS = mix(0.06, 0.5, clamp(mullion, 0.0, 1.0));
	EMISSION = vec3(1.0, 0.82, 0.6) * on * glow;
}
"""
	if style == "coast":
		return     # the resort strip has no glass skyline: open sky over the palms
	for k in 26:
		var m := ShaderMaterial.new()
		m.shader = sh
		var tint := _rng.randf()
		m.set_shader_parameter("glass", Color(0.25 + 0.1 * tint, 0.36 + 0.08 * tint, 0.48 + 0.08 * tint))
		if style == "nexus" and not night:
			# by day the curtain walls read as bright sky-blue mirrors (owner's street frame)
			m.set_shader_parameter("glass", Color(0.42 + 0.1 * tint, 0.58 + 0.08 * tint, 0.74 + 0.06 * tint))
		m.set_shader_parameter("lit", _rng.randf_range(0.16, 0.3) if night else _rng.randf_range(0.02, 0.1))
		m.set_shader_parameter("glow", 0.9 if night else 0.35)
		var w := _rng.randf_range(18.0, 34.0)
		var h := _rng.randf_range(60.0, 190.0)
		var side := -1.0 if k % 2 == 0 else 1.0
		var x := side * _rng.randf_range(50.0, 120.0)
		if style == "nexus":
			x = side * _rng.randf_range(175.0, 260.0)     # behind the district courts
		var z := _rng.randf_range(-LENGTH * 0.7, LENGTH * 0.2) - 60.0
		_box(Vector3(w, h, w * _rng.randf_range(0.8, 1.3)), Vector3(x, h * 0.5, z), m)
	if style == "nexus":
		# the landmark is the Tech Faction Central Tower, 420 m, in the Spire end's west court (nexus_districts.gd)
		world.add_child(Nexus.central_tower(self, world))
		return
	# a landmark at the end of the avenue
	var lm := ShaderMaterial.new()
	lm.shader = sh
	lm.set_shader_parameter("glass", Color(0.36, 0.48, 0.62))
	lm.set_shader_parameter("lit", 0.3 if night else 0.08)
	lm.set_shader_parameter("glow", 1.6 if night else 0.35)
	_box(Vector3(30, 260, 30), Vector3(-62, 130, -LENGTH * 0.5 - 70.0), lm)
	_box(Vector3(18, 60, 18), Vector3(-62, 290, -LENGTH * 0.5 - 70.0), lm)

# --------------------------------------------------------------------------------------------- street furniture
func _props() -> void:
	var half := ROAD_W * 0.5
	for side: float in [-1.0, 1.0]:
		var z := -LENGTH * 0.5 + 8.0
		var i := 0
		while z < LENGTH * 0.5 - 6.0:
			var edge := side * (half + 1.3)
			if i % 2 == 0 or style != "nexus":
				if style == "coast" and ResourceLoader.exists(MODELS + "../foliage/palm-a.glb"):
					# the web build's three authored palms on the resort strip
					prop("../foliage/palm-%s.glb" % ["a", "b", "c"][(i + int(side + 1.0)) % 3], _rng.randf_range(8.5, 11.5), Vector3(edge, 0.18, z), _rng.randf() * 360.0)
				elif ResourceLoader.exists(MODELS + "palm.glb"):
					prop("palm.glb", _rng.randf_range(8.5, 11.0), Vector3(edge, 0.18, z), _rng.randf() * 360.0)
				else:
					_palm_fallback(Vector3(edge, 0.18, z))
			elif ResourceLoader.exists(MODELS + "street-lamp.glb"):
				prop("street-lamp.glb", 6.5, Vector3(edge, 0.18, z), 90.0 * side + 180.0)
				if night:
					var lamp := OmniLight3D.new()
					lamp.light_color = Color(1.0, 0.82, 0.62)
					lamp.light_energy = 2.6
					lamp.omni_range = 15.0
					lamp.position = Vector3(edge - side * 1.2, 6.0, z)
					_root().add_child(lamp)
			else:
				_lamp_fallback(Vector3(edge, 0.18, z), side)
			if i % 3 == 1:
				prop("planter.glb", 2.2, Vector3(edge, 0.18, z + 5.5), 0.0)
			z += 12.0
			i += 1
		# a café terrace along the shopfronts on the near side (the hub block only)
	if _tile_k != 0:
		return
	for k in 5:
		prop("cafe-set.glb", 0.95, Vector3(half + WALK_W - 2.4, 0.18, 6.0 - k * 3.2), _rng.randf_range(-20.0, 20.0))
	prop("bus-shelter.glb", 2.8, Vector3(-(half + 2.4), 0.18, 12.0), 90.0)

func _palm_fallback(at: Vector3) -> void:
	var trunk := flat(Color(0.45, 0.38, 0.3), 0.9)
	_box(Vector3(0.35, 8.0, 0.35), at + Vector3(0, 4.0, 0), trunk)

func _lamp_fallback(at: Vector3, side: float) -> void:
	var metal := flat(Color(0.12, 0.12, 0.13), 0.35, 0.7)
	_box(Vector3(0.18, 6.5, 0.18), at + Vector3(0, 3.25, 0), metal)
	_box(Vector3(1.6, 0.12, 0.3), at + Vector3(-side * 0.7, 6.4, 0), metal)
	_box(Vector3(1.2, 0.04, 0.2), at + Vector3(-side * 0.7, 6.33, 0), flat(Color(1.0, 0.9, 0.75), 0.4, 0.0, 3.0))

# --------------------------------------------------------------------------------------------- parked cars
func _cars() -> void:
	var files := ["street-racer-lod.glb", "muscle-car-lod.glb", "security-suv.glb", "tuner.glb", "offroad-truck.glb"]
	var half := ROAD_W * 0.5
	var z := -LENGTH * 0.5 + 20.0
	var i := 0
	if _tile_root == null:
		# the hub block: the Goliath tank and the hover-car wait across from the garage (asset catalog: Vehicles)
		for spec in [["goliath-tank.glb", Vector3(-(half - 2.6), 0.0, GARAGE_Z + 30.0), 8.0], ["hover-car.glb", Vector3(-(half - 1.6), 0.0, GARAGE_Z + 44.0), 5.0]]:
			var f2 := String(spec[0])
			if not ResourceLoader.exists(FLEET + f2):
				continue
			var hull := (load(FLEET + f2) as PackedScene).instantiate() as Node3D
			hull.position = spec[1]
			hull.rotation_degrees.y = 180.0
			StreetCar.face_forward(hull)
			_fit_length(hull, float(spec[2]))
			hull.set_meta("car", true)
			hull.set_meta("vehicle", CAR_IDS.get(f2, ""))
			hull.set_meta("locked", false)    # put out for the operator (asset catalog), never locked
			world.add_child(hull)
			parked.append(hull)
	while z < LENGTH * 0.5 - 20.0:
		var side := 1.0 if i % 2 == 0 else -1.0
		var f: String = files[i % files.size()]
		if ResourceLoader.exists(FLEET + f):
			var car := (load(FLEET + f) as PackedScene).instantiate() as Node3D
			car.position = Vector3(side * (half - 1.4), 0.0, z + _rng.randf_range(-2.0, 2.0))
			car.rotation_degrees.y = 0.0 if side > 0 else 180.0
			StreetCar.face_forward(car)
			# a fleet car is ~40 draws (21 material pieces, 5 per wheel): past 110 m it is a few pixels, so it fades out,
			# and the wheels leave their shadow to the body's
			for g in car.find_children("*", "GeometryInstance3D", true, false):
				var gi := g as GeometryInstance3D
				gi.visibility_range_end = 110.0
				gi.visibility_range_end_margin = 15.0
				gi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
				var up: Node = gi
				while up != car:
					if String(up.name).begins_with("Steer") or String(up.name).containsn("wheel"):
						gi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
						break
					up = up.get_parent()
			StaticBatch.compact(car)   # ~40 draws a car down to one per look
			# its own paint and a clear coat; most belong to someone and are locked (car_detail.gd), decided by where they
			# stand (and which block), so a block's cars are the same every visit
			var spot := car.position + Vector3(0.0, 0.0, float(_tile_k) * 997.0 if _tile_root else 0.0)
			CarDetail.dress(car, CarDetail.paint_at(spot))
			car.set_meta("locked", CarDetail.locked_at(spot))
			if Phone.car_range() > 0.0:
				for gi in car.find_children("*", "GeometryInstance3D", true, false):
					(gi as GeometryInstance3D).visibility_range_end = Phone.car_range()
					(gi as GeometryInstance3D).visibility_range_end_margin = 12.0
					(gi as GeometryInstance3D).visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			if _tile_root:
				var a := _aabb(car)
				car.set_meta("size", Vector3(a.size.x, a.size.y, a.size.z))
				# any parked car can be taken, not only the hub's (owner, Nov 9): it joins `parked` once its box has a slot
				car.set_meta("car", true)
				car.set_meta("vehicle", CAR_IDS.get(f, ""))
				_tile_root.add_child(car)
			else:
				car.set_meta("car", true)
				car.set_meta("vehicle", CAR_IDS.get(f, ""))
				world.add_child(car)
				parked.append(car)
		z += _rng.randf_range(9.0, 16.0)
		i += 1

# --------------------------------------------------------------------------------------------- night: neon and billboards
func _neon_mat(c: Color, strength := 4.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c * 0.3
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = strength
	return m

func _sign(text: String, c: Color, pos: Vector3, yaw_deg: float, vertical: bool) -> void:
	var holder := Node3D.new()
	holder.position = pos
	holder.rotation_degrees.y = yaw_deg
	_root().add_child(holder)
	var w := 0.9 if vertical else maxf(3.0, text.length() * 0.55)
	var h := maxf(2.6, text.length() * 0.5) if vertical else 1.1
	_box(Vector3(w + 0.2, h + 0.2, 0.25), Vector3.ZERO, flat(Color(0.05, 0.05, 0.06), 0.4, 0.6), holder)
	_box(Vector3(w + 0.26, 0.06, 0.06), Vector3(0, h * 0.5 + 0.13, 0.14), _neon_mat(c, 6.0), holder)
	_box(Vector3(w + 0.26, 0.06, 0.06), Vector3(0, -h * 0.5 - 0.13, 0.14), _neon_mat(c, 6.0), holder)
	var label := Label3D.new()
	label.text = "\n".join(text.split("")) if vertical else text
	label.font_size = 64
	label.pixel_size = 0.0075 if vertical else 0.009
	label.outline_size = 0
	label.modulate = c * 3.0
	label.position = Vector3(0, 0, 0.14)
	label.shaded = false
	holder.add_child(label)
	# a glow light only where no other sign has one within 14 m: a light per sign was ~190 lights a night street, and
	# the phone's renderer pays for every one (and lights a mesh with 8 at most); the emissive neon and the glow carry the rest
	var at := pos + Basis(Vector3.UP, deg_to_rad(yaw_deg)) * Vector3(0, 0, 1.2)
	var lit: Array = _root().get_meta("sign_lights", [])
	for q: Vector3 in lit:
		if q.distance_to(at) < 14.0:
			return
	lit.append(at)
	_root().set_meta("sign_lights", lit)
	var glow := OmniLight3D.new()
	glow.light_color = c
	glow.light_energy = 2.0
	glow.omni_range = 9.0
	glow.position = Vector3(0, 0, 1.2)
	holder.add_child(glow)

## blade signs on every block, a shop sign over each awning, and video billboards high on the towers
func _neon() -> void:
	var half := ROAD_W * 0.5 + WALK_W
	var k := 0
	for side: float in [-1.0, 1.0]:
		var z := -LENGTH * 0.5 + 14.0
		while z < LENGTH * 0.5 - 10.0:
			if _tile_k == 0 and side > 0 and absf(z - GARAGE_Z) < 16.0:
				z += 22.0     # the garage carries its own sign
				k += 1
				continue
			if _in_mouth(side, z + 6.0) or _in_mouth(side, z - 2.0):
				z += 22.0
				k += 1
				continue
			var c: Color = NEON[k % NEON.size()]
			var brand: String = BRANDS[k % BRANDS.size()]
			# a vertical blade sign sticking out from the facade, readable down the street
			_sign(brand, c, Vector3(side * (half - 0.9), 9.0 + (k % 3) * 1.5, z + 6.0), 90.0 if side < 0 else -90.0, true)
			# the shop's own sign above the awning, facing the street
			_sign(BRANDS[(k + 7) % BRANDS.size()], NEON[(k + 2) % NEON.size()], Vector3(side * (half - 0.05), 6.1, z - 2.0), 90.0 if side < 0 else -90.0, false)
			z += 22.0
			k += 1
	# video billboards on the towers: big emissive panels in gradients
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded;
uniform vec3 a : source_color = vec3(1.0, 0.2, 0.6);
uniform vec3 b : source_color = vec3(0.2, 0.8, 1.0);
void fragment() {
	float t = UV.x * 0.7 + UV.y * 0.3;
	float scan = 0.85 + 0.15 * sin(UV.y * 240.0);
	float frame = step(0.03, UV.x) * step(UV.x, 0.97) * step(0.04, UV.y) * step(UV.y, 0.96);
	ALBEDO = mix(a, b, t) * scan * (0.15 + 0.85 * frame) * 2.2;
}
"""
	for i in 6:
		var m := ShaderMaterial.new()
		m.shader = sh
		m.set_shader_parameter("a", NEON[i % NEON.size()])
		m.set_shader_parameter("b", NEON[(i + 2) % NEON.size()])
		var side := -1.0 if i % 2 == 0 else 1.0
		var q := QuadMesh.new()
		q.size = Vector2(_rng.randf_range(14.0, 22.0), _rng.randf_range(8.0, 12.0))
		var mi := MeshInstance3D.new()
		mi.mesh = q
		mi.material_override = m
		mi.position = Vector3(side * (half + 0.3), _rng.randf_range(24.0, 34.0), -40.0 - i * 26.0)
		mi.rotation_degrees.y = 90.0 if side < 0 else -90.0
		_root().add_child(mi)

# --------------------------------------------------------------------------------------------- the street set
## The Meshy street set from the owner's Nov 8 renders (docs/reference/NEXUS_STREET_SET.md; models/city/street): neon
## benches by the shopfronts, holo info kiosks on the walks, drinks machines against the buildings, superbikes parked
## up on the pavement, and on the hub block the NEXUS CITY · CENTRAL DISTRICT arch over the avenue. Per tile, seeded;
## each piece is a prop (so it blocks the operator); the arch blocks only at its two pillars.
const SET := "street/"

func _street_set() -> void:
	if style == "coast":
		return
	var half := ROAD_W * 0.5
	var z0 := -LENGTH * 0.5
	var k := 0
	# benches by the building line, facing the road
	var z := z0 + 30.0
	while z < LENGTH * 0.5 - 10.0:
		var side := 1.0 if k % 2 == 0 else -1.0
		if not (_tile_k == 0 and side > 0.0 and absf(z - GARAGE_Z) < 16.0) and not _in_mouth(side, z):
			prop(SET + "bench-neon.glb", 1.0, Vector3(side * (half + WALK_W - 1.1), 0.18, z), -90.0 * side)
		z += 46.0
		k += 1
	# holo kiosks out on the walk, two per block
	for at: Vector2 in [Vector2(1.0, z0 + 74.0), Vector2(-1.0, z0 + 168.0)]:
		if _tile_k == 0 and at.x > 0.0 and absf(at.y - GARAGE_Z) < 16.0:
			continue
		prop(SET + "kiosk.glb", 2.4, Vector3(at.x * (half + 3.2), 0.18, at.y), -90.0 * at.x)
	# drinks machines against the buildings
	k = 0
	z = z0 + 52.0
	while z < LENGTH * 0.5 - 10.0:
		var side2 := -1.0 if k % 2 == 0 else 1.0
		if not (_tile_k == 0 and side2 > 0.0 and absf(z - GARAGE_Z) < 16.0) and not _in_mouth(side2, z):
			prop(SET + "vending.glb", 2.0, Vector3(side2 * (half + WALK_W - 0.55), 0.18, z), -90.0 * side2)
		z += 64.0
		k += 1
	# superbikes parked up on the pavement by the kerb, angled
	for at2: Vector2 in [Vector2(-1.0, z0 + 40.0), Vector2(1.0, z0 + 112.0), Vector2(-1.0, z0 + 200.0)]:
		if _tile_k == 0 and at2.x > 0.0 and absf(at2.y - GARAGE_Z) < 16.0:
			continue
		prop(SET + "motorbike.glb", 1.15, Vector3(at2.x * (half + 1.9), 0.18, at2.y), 30.0 * at2.x)
	# the gateway over the avenue at the far end of the hub block
	if _tile_k == 0:
		var arch := prop(SET + "plaza-arch.glb", 22.0, Vector3(0, 0.0, z0 + 14.0), 0.0)
		if arch:
			var sz: Vector3 = arch.get_meta("size")
			arch.remove_meta("size")
			# its two pillars, about a sixth of the span each, are the solid parts
			var pw := sz.x * 0.17
			for sd: float in [-1.0, 1.0]:
				var pillar := Node3D.new()
				pillar.position = arch.position + Vector3(sd * (sz.x * 0.5 - pw * 0.5), 0, 0)
				pillar.set_meta("size", Vector3(pw, sz.y, sz.z))
				pillar.set_meta("file", "arch-pillar")
				_root().add_child(pillar)
			# the name across the gateway, hung under the header on both faces
			for face: float in [1.0, -1.0]:
				var title := Label3D.new()
				title.text = "NEXUS CITY"
				title.font_size = 200
				title.outline_size = 0
				title.pixel_size = 0.012
				title.modulate = Color(0.85, 0.97, 1.0) * 1.8
				title.shaded = false
				title.double_sided = false
				title.position = arch.position + Vector3(0, sz.y * 0.6, face * (sz.z * 0.5 + 0.3))
				title.rotation.y = 0.0 if face > 0.0 else PI
				_root().add_child(title)
				var sub := title.duplicate() as Label3D
				sub.text = "CENTRAL DISTRICT"
				sub.font_size = 90
				sub.modulate = Color(0.45, 0.9, 1.0) * 1.6
				sub.position.y -= 1.7
				_root().add_child(sub)
			var glow := OmniLight3D.new()
			glow.light_color = Color(0.2, 0.9, 1.0)
			glow.light_energy = 3.0
			glow.omni_range = 22.0
			glow.position = arch.position + Vector3(0, sz.y * 0.55, 3.0)
			_root().add_child(glow)

# --------------------------------------------------------------------------------------------- the reference dressing
## Nexus City as the owner's Nov 8 references draw it: cyan bollard lights along the kerbs, WORLD FRACTURE banners on the
## lamp posts, cherry-blossom trees between the palms, and the monorail on its pylons over the far lane. Built per tile.
## everyday life on the sidewalks (civic_props.gd): vending machines, ATMs, food stalls, café seating, parcels — on
## every tile, kept clear of the hub's doors; each carries a `size` meta so the obstacle passes take its footprint
func _civic_life() -> void:
	if style == "coast":
		return
	# clear of the doors on this block and of a lot's frontage (infrastructure.gd), in the block's own z
	var avoid: Array = []
	var zc := 0.0 if _tile_root == null else District.tile_z(_tile_k)
	for d in _door_spots:
		var p: Vector3 = d.pos
		if absf(p.z - zc) < LENGTH * 0.5 + 8.0:
			avoid.append(Vector3(p.x, 0, p.z - zc))
	if _tile_root != null:
		for sd: float in [-1.0, 1.0]:
			for g: Vector2 in Infra.gaps(_tile_k, sd):
				var zz := g.x
				while zz <= g.y:
					avoid.append(Vector3(sd, 0, zz))
					zz += 6.0
	CivicProps.dress(_root(), LENGTH, style, _rng, avoid)

func _dressing() -> void:
	var half := ROAD_W * 0.5
	var cyan := Color(0.2, 0.9, 1.0)
	var violet := Color(0.6, 0.3, 1.0)
	var post := flat(Color(0.1, 0.1, 0.12), 0.4, 0.6)
	var glow := _neon_mat(cyan if style != "coast" else Color(1.0, 0.6, 0.3), 3.0)
	# bollard lights: a short post with a lit band, every 6 m along both kerbs
	var z := -LENGTH * 0.5 + 3.0
	while z < LENGTH * 0.5 - 3.0:
		for side: float in [-1.0, 1.0]:
			var x := side * (half + 0.9)
			_box(Vector3(0.22, 0.9, 0.22), Vector3(x, 0.18 + 0.45, z), post)
			_box(Vector3(0.24, 0.12, 0.24), Vector3(x, 0.18 + 0.78, z), glow)
		z += 6.0
	if style == "coast":
		return
	# banners on the lamp posts (lamps stand every 24 m, see _props): a violet drop with the WF mark and the game's name
	var cloth := flat(Color(0.16, 0.06, 0.3), 0.7)
	var zb := -LENGTH * 0.5 + 8.0 + 12.0
	var i := 1
	while zb < LENGTH * 0.5 - 6.0:
		for side: float in [-1.0, 1.0]:
			if (i % 2 == 1 or style != "nexus"):
				var edge := side * (half + 1.3)
				var holder := Node3D.new()
				holder.position = Vector3(edge - side * 0.75, 4.9, zb)
				holder.rotation_degrees.y = 90.0 if side < 0 else -90.0
				_root().add_child(holder)
				_box(Vector3(1.0, 2.6, 0.04), Vector3.ZERO, cloth, holder)
				_box(Vector3(1.06, 0.05, 0.05), Vector3(0, 1.32, 0), _neon_mat(violet, 4.0), holder)
				var mark := Label3D.new()
				mark.text = "▽"
				mark.font_size = 120
				mark.pixel_size = 0.006
				mark.modulate = Color(0.75, 0.5, 1.0) * 2.0
				mark.position = Vector3(0, 0.55, 0.03)
				mark.shaded = false
				holder.add_child(mark)
				var txt := Label3D.new()
				txt.text = "WORLD\nFRACTURE"
				txt.font_size = 48
				txt.pixel_size = 0.006
				txt.modulate = Color(1, 1, 1)
				txt.position = Vector3(0, -0.45, 0.03)
				txt.shaded = false
				holder.add_child(txt)
		zb += 24.0
		i += 1
	# cherry blossoms on the Nexus strip: a dark trunk and a cloud of pink, between the palms
	if style == "nexus":
		var bark := flat(Color(0.16, 0.12, 0.1), 0.9)
		var bloom := flat(Color(0.98, 0.55, 0.75), 0.9, 0.0, 0.25)
		var zt := -LENGTH * 0.5 + 20.0
		var k := 0
		while zt < LENGTH * 0.5 - 10.0:
			var side := -1.0 if k % 2 == 0 else 1.0
			if (_tile_k == 0 and side > 0 and absf(zt - GARAGE_Z) < 16.0) or _in_mouth(side, zt):
				zt += 36.0
				k += 1
				continue
			var at := Vector3(side * (half + WALK_W - 1.9), 0.18, zt)
			_box(Vector3(0.35, 2.8, 0.35), at + Vector3(0, 1.4, 0), bark)
			for b in 4:
				var mi := MeshInstance3D.new()
				var sm := SphereMesh.new()
				sm.radius = _rng.randf_range(1.1, 1.7)
				sm.height = sm.radius * 1.8
				sm.radial_segments = 10
				sm.rings = 5
				mi.mesh = sm
				mi.material_override = bloom
				mi.position = at + Vector3(_rng.randf_range(-1.0, 1.0), 3.1 + _rng.randf_range(0.0, 1.2), _rng.randf_range(-1.0, 1.0))
				_root().add_child(mi)
			zt += 36.0
			k += 1
	# the monorail: a beam at 13 m over the far lane on pylons every 30 m (the train runs on the hub block)
	var steel := flat(Color(0.75, 0.78, 0.82), 0.35, 0.7)
	var beam_x := -(half - 3.0)
	_box(Vector3(2.2, 0.8, LENGTH), Vector3(beam_x, 13.0, 0), steel)
	_box(Vector3(2.4, 0.08, LENGTH), Vector3(beam_x, 13.44, 0), _neon_mat(cyan, 2.5))
	var zp := -LENGTH * 0.5 + 15.0
	while zp < LENGTH * 0.5:
		_box(Vector3(1.2, 12.6, 1.2), Vector3(beam_x, 6.3, zp), steel)
		zp += 30.0

## the hub block only: the holo rings on the landmark spire, the district sign, billboards with the owner's art, the train
var _rings: Array = []
var _train: Node3D
func _hub_dressing() -> void:
	if style == "coast":
		return
	var cyan := Color(0.2, 0.9, 1.0)
	# three tilted rings round the spire's crown (it stands behind the far facades at the head of the avenue)
	var spire := Vector3(-62, 250, -LENGTH * 0.5 - 70.0)
	if style == "nexus":
		spire = Nexus.TOWER_POS + Vector3(0, 372.0, 0)
	for i in 3:
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 30.0 + i * 9.0
		tm.outer_radius = tm.inner_radius + 1.4
		tm.rings = 48
		tm.ring_segments = 6
		ring.mesh = tm
		ring.material_override = _neon_mat(cyan if i != 1 else Color(0.75, 0.4, 1.0), 2.0)
		ring.position = spire + Vector3(0, 10.0 - i * 14.0, 0)
		ring.rotation_degrees = Vector3(8.0 * (i - 1), 0, 6.0 * (1 - i))
		ring.set_meta("dynamic", true)   # turns every frame
		world.add_child(ring)
		_rings.append(ring)
	# the district sign by the spawn: where the shops, the armoury, the garage, the arena and the apartments are
	var sign := Node3D.new()
	sign.position = Vector3(ROAD_W * 0.5 + 1.0, 2.6, 36.0)
	sign.rotation_degrees.y = -90.0
	world.add_child(sign)
	_box(Vector3(2.4, 2.2, 0.12), Vector3.ZERO, flat(Color(0.04, 0.05, 0.07), 0.4, 0.5), sign)
	_box(Vector3(2.5, 0.05, 0.14), Vector3(0, 1.12, 0), _neon_mat(cyan, 4.0), sign)
	_box(Vector3(0.14, 2.6, 0.14), Vector3(0, -1.6, -0.1), flat(Color(0.1, 0.1, 0.12), 0.4, 0.6), sign)
	var lines := Label3D.new()
	lines.text = "DISTRICT 03\nTRADING HUB  →\nARMORY  →\nGARAGE  →\nARENA  →\nAPARTMENTS  →"
	if style == "nexus":
		lines.text = "CENTRAL TRANSIT PLAZA\n◀ CENTRAL TOWER · APEX GEAR\n◀ SPIRE · CITADEL · NORTH GATE\nRUSTY TRIGGER · CYLINDER & CO ▶\nWARRENS · BAZAAR · DOCKS ▶"
	lines.font_size = 40
	lines.pixel_size = 0.0065
	lines.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	lines.modulate = cyan * 2.2
	lines.position = Vector3(-1.05, 0.0, 0.07)
	lines.shaded = false
	sign.add_child(lines)
	# billboards with the owner's concept art high on the facades
	var art := ["wf-nexus", "enlist", "vyrak", "nova-tech", "arc-face"]
	for i in art.size():
		var path := "res://textures/billboards/%s.jpg" % art[i]
		if not ResourceLoader.exists(path):
			continue
		var tex: Texture2D = load(path)
		var m := StandardMaterial3D.new()
		m.albedo_texture = tex
		m.emission_enabled = true
		m.emission_texture = tex
		m.emission_energy_multiplier = 1.6 if night else 0.6
		m.roughness = 0.4
		var q := QuadMesh.new()
		var h := 12.0 if i == 0 else 9.0
		q.size = Vector2(h * float(tex.get_width()) / float(tex.get_height()), h)
		var mi := MeshInstance3D.new()
		mi.mesh = q
		mi.material_override = m
		var side := 1.0 if i % 2 == 0 else -1.0
		var xw := ROAD_W * 0.5 + WALK_W
		mi.position = Vector3(side * (xw + 0.35), 15.0 + (i % 3) * 3.0, 60.0 - i * 38.0)
		mi.rotation_degrees.y = 90.0 if side < 0 else -90.0
		world.add_child(mi)
		var frame := _box(Vector3(q.size.x + 0.5, q.size.y + 0.5, 0.2), mi.position + Vector3(side * 0.2, 0, 0), flat(Color(0.05, 0.05, 0.06), 0.4, 0.6))
		frame.rotation_degrees.y = mi.rotation_degrees.y
	# the train: three cars on the beam, running +z and looping
	_train = Node3D.new()
	_train.set_meta("dynamic", true)   # runs the length of the street
	_train.position = Vector3(-(ROAD_W * 0.5 - 3.0), 14.4, -LENGTH * 0.5)
	world.add_child(_train)
	var shell := flat(Color(0.9, 0.92, 0.95), 0.3, 0.6)
	var glass := flat(Color(0.2, 0.5, 0.8), 0.1, 0.4, 0.3)
	for c in 3:
		var zc := c * 9.5
		_box(Vector3(2.6, 2.4, 9.0), Vector3(0, 1.2, zc), shell, _train)
		_box(Vector3(2.7, 0.7, 8.4), Vector3(0, 1.5, zc), glass, _train)
		_box(Vector3(2.7, 0.06, 9.0), Vector3(0, 0.1, zc), _neon_mat(cyan, 3.0), _train)

func _step_dressing(dt: float) -> void:
	for i in _rings.size():
		(_rings[i] as MeshInstance3D).rotation.y += dt * (0.12 + 0.05 * i) * (1.0 if i % 2 == 0 else -1.0)
	if _train:
		_train.position.z += 22.0 * dt
		var span: Vector2 = district.span() if district else Vector2(-LENGTH * 0.5, LENGTH * 0.5)
		if _train.position.z > span.y:
			_train.position.z = span.x

# --------------------------------------------------------------------------------------------- the hub's doors
## every door stands on the sidewalk of its side, drawn as what it is (a lit doorway, a kiosk, a shuttle stop, the
## portal), with its name over it; walking up shows ENTER <name>
func _doors() -> void:
	var half := ROAD_W * 0.5
	if style == "nexus":
		# the court shops (nexus_districts.gd builds their fronts with the tile)
		_door_spots.append_array(Nexus.door_spots())
	for d in DOORS:
		var only := String(d.get("style", "nexus"))
		if only != "any" and only != style:
			continue
		var side := float(d.x)
		var pos := Vector3(side * (half + WALK_W - 2.2), 0.18, float(d.z))
		if String(d.id) == "nightclub" or String(d.id) == "police":
			d = d.duplicate()
			d.label = Interiors.title_of(String(d.id), style)
		if String(d.id) == "casino" and _casino_at != Vector3.INF:
			pos.z = _casino_at.z     # at the casino podium's door
		var col: Color = d.color
		var kind := String(d.kind)
		if kind == "none":
			pos = Vector3(side * (half + WALK_W + 4.0), 0.18, float(d.z))   # the garage's forecourt
		_door_spots.append({ "id": String(d.id), "label": String(d.label), "pos": pos })
		var holder := Node3D.new()
		holder.position = pos
		holder.rotation.y = PI * 0.5 if side < 0 else -PI * 0.5
		world.add_child(holder)
		match kind:
			"door":
				_box(Vector3(2.2, 3.2, 0.3), Vector3(0, 1.6, -1.0), flat(Color(0.08, 0.08, 0.1), 0.5, 0.3), holder)
				_box(Vector3(1.6, 2.6, 0.08), Vector3(0, 1.3, -0.85), _neon_mat(col * 0.6, 1.2), holder)
			"kiosk":
				_box(Vector3(1.2, 2.0, 0.7), Vector3(0, 1.0, 0), flat(Color(0.1, 0.1, 0.14), 0.4, 0.6), holder)
				_box(Vector3(1.0, 0.7, 0.05), Vector3(0, 1.45, 0.37), _neon_mat(col, 3.0), holder)
			"stop":
				_box(Vector3(0.12, 3.2, 0.12), Vector3(-1.4, 1.6, 0), flat(Color(0.3, 0.32, 0.35), 0.4, 0.7), holder)
				_box(Vector3(0.12, 3.2, 0.12), Vector3(1.4, 1.6, 0), flat(Color(0.3, 0.32, 0.35), 0.4, 0.7), holder)
				_box(Vector3(3.2, 0.1, 1.6), Vector3(0, 3.2, 0), flat(Color(0.2, 0.22, 0.25), 0.4, 0.5), holder)
				_box(Vector3(2.6, 0.5, 0.06), Vector3(0, 2.75, 0.6), _neon_mat(col, 2.5), holder)
			"metro":
				# a glass pavilion over the stairs down, the M on a lit totem beside it
				var gl := flat(Color(0.55, 0.75, 0.9), 0.1, 0.4)
				gl.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				gl.albedo_color.a = 0.35
				_box(Vector3(3.6, 0.15, 5.0), Vector3(0, 3.0, -0.6), flat(Color(0.2, 0.22, 0.25), 0.4, 0.6), holder)
				for sx: float in [-1.75, 1.75]:
					_box(Vector3(0.08, 3.0, 5.0), Vector3(sx, 1.5, -0.6), gl, holder)
				_box(Vector3(3.6, 3.0, 0.08), Vector3(0, 1.5, -3.1), gl, holder)
				_box(Vector3(3.0, 0.05, 4.4), Vector3(0, 0.05, -0.8), flat(Color(0.05, 0.05, 0.06), 0.9), holder)
				_box(Vector3(0.5, 3.6, 0.5), Vector3(2.4, 1.8, 0.8), flat(Color(0.12, 0.13, 0.15), 0.4, 0.6), holder)
				_box(Vector3(0.6, 0.6, 0.6), Vector3(2.4, 3.9, 0.8), _neon_mat(col, 3.0), holder)
				var mlab := Label3D.new()
				mlab.text = "M"
				mlab.font_size = 96
				mlab.pixel_size = 0.008
				mlab.position = Vector3(2.4, 3.9, 1.12)
				mlab.shaded = false
				holder.add_child(mlab)
			"portal":
				# the Rift Gate: a ring standing on the walk with a live vortex in it (scripts/vfx/fx.gd)
				holder.add_child(preload("res://scripts/vfx/fx.gd").portal(1.7, col))
		if kind != "none":
			var name_l := Label3D.new()
			name_l.text = String(d.label)
			name_l.font_size = 64
			name_l.pixel_size = 0.008
			name_l.modulate = col * 1.6
			name_l.position = Vector3(0, 2.5 if kind == "kiosk" else (4.8 if kind == "portal" else 3.7), 0)
			name_l.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
			name_l.shaded = false
			holder.add_child(name_l)

## back up from the metro at the far end of the avenue: on the walk there, facing back up it
func come_up_at(p: Vector3) -> void:
	if driving_car:
		return
	operator.position = p
	operator.velocity = Vector3.ZERO
	operator.heading = 0.0 if p.z > 0.0 else PI
	operator.cam_yaw = operator.heading + PI
	if district:
		_apply_district(district.update(p.z, true))
	controls.toast("METRO · %s" % ("SOUTH END" if p.z > 0.0 else "NORTH END"))

func _enter_door(id: String) -> void:
	controls.prompt("")
	Sound.sfx("portal" if id == "rift" else "door", -4.0)
	match id:
		"garage":
			open_garage()
		"mall":
			open_mall()
		"casino":
			open_casino()
		"sports":
			open_sports()
		"apex", "rusty":
			open_shop(id)
		"block":
			open_clothes("block")
		"cylinder":
			open_garage("ironworks")     # Cylinder & Co: heavy, off-road and armour work
		_:
			door.emit(id)

# --------------------------------------------------------------------------------------------- the city garage
## a drive-in garage on the near side: a wide roll-up door open onto a lit workshop, the shop's sign in its accent
## colour, a car on the apron. ENTER opens the real garage (garage_view.gd) for this city's shop.
func _garage_front() -> void:
	var shop := Catalog.shop(CITY_GARAGE[style])
	var accent := Color(String(shop.accent))
	var x0 := ROAD_W * 0.5 + WALK_W
	var g := Node3D.new()
	g.position = Vector3(x0, 0, GARAGE_Z)
	world.add_child(g)
	var wall := flat(Color(0.16, 0.17, 0.19), 0.6, 0.3)
	var trim := flat(Color(0.08, 0.08, 0.09), 0.4, 0.7)
	# the shell: 22 m wide, 9 m tall, 16 m deep, open at the street
	_box(Vector3(16.0, 0.4, 22.0), Vector3(8.0, 9.0, 0), wall, g)
	_box(Vector3(0.4, 9.0, 22.0), Vector3(16.0, 4.5, 0), wall, g)
	for zz: float in [-11.0, 11.0]:
		_box(Vector3(16.0, 9.0, 0.4), Vector3(8.0, 4.5, zz), wall, g)
	# the street face around the door, with a header band carrying the sign
	_box(Vector3(0.5, 9.0, 3.0), Vector3(0.25, 4.5, -9.5), trim, g)
	_box(Vector3(0.5, 9.0, 3.0), Vector3(0.25, 4.5, 9.5), trim, g)
	_box(Vector3(0.6, 2.4, 22.0), Vector3(0.3, 7.8, 0), trim, g)
	_box(Vector3(0.1, 0.12, 16.0), Vector3(-0.05, 6.55, 0), _neon_mat(accent, 5.0), g)
	var sign := Label3D.new()
	sign.text = String(shop.name).to_upper()
	sign.font_size = 120
	sign.pixel_size = 0.012
	sign.modulate = accent * (3.0 if night else 1.6)
	sign.shaded = false
	sign.position = Vector3(-0.05, 7.8, 0)
	sign.rotation_degrees.y = -90.0
	g.add_child(sign)
	# the workshop inside: epoxy floor, a ramp lift, tool walls and strip lights
	_box(Vector3(15.6, 0.05, 21.4), Vector3(8.0, 0.2, 0), flat(Color(0.22, 0.23, 0.25), 0.25, 0.2), g)
	for zz: float in [-6.0, 0.0, 6.0]:
		_box(Vector3(12.0, 0.08, 0.3), Vector3(8.0, 8.7, zz), _neon_mat(Color(0.9, 0.95, 1.0), 3.5), g)
	_box(Vector3(5.0, 0.3, 2.4), Vector3(9.0, 1.3, -4.0), flat(Color(0.75, 0.2, 0.15), 0.5, 0.6), g)
	for zz: float in [-5.0, -3.0]:
		_box(Vector3(0.3, 1.3, 0.3), Vector3(9.0, 0.65, zz), flat(Color(0.3, 0.3, 0.32), 0.4, 0.8), g)
	_box(Vector3(0.3, 3.0, 10.0), Vector3(15.6, 2.5, 3.0), flat(Color(0.12, 0.13, 0.14), 0.7), g)
	_box(Vector3(0.1, 0.1, 10.0), Vector3(15.4, 4.1, 3.0), _neon_mat(accent, 2.5), g)
	var inside := OmniLight3D.new()
	inside.light_color = Color(0.92, 0.95, 1.0)
	inside.light_energy = 2.2
	inside.omni_range = 16.0
	inside.position = Vector3(8.0, 7.0, 0)
	g.add_child(inside)
	var glow := OmniLight3D.new()
	glow.light_color = accent
	glow.light_energy = 1.5
	glow.omni_range = 10.0
	glow.position = Vector3(-2.0, 7.0, 0)
	g.add_child(glow)
	# a car up on the ramp and one waiting on the apron
	for spec in [["tuner.glb", Vector3(x0 + 9.0, 1.45, GARAGE_Z - 4.0), 90.0], ["muscle-car-lod.glb", Vector3(x0 - 2.5, 0.18, GARAGE_Z + 4.0), 30.0]]:
		if ResourceLoader.exists(FLEET + String(spec[0])):
			var car := (load(FLEET + String(spec[0])) as PackedScene).instantiate() as Node3D
			car.position = spec[1]
			car.rotation_degrees.y = float(spec[2])
			car.set_meta("car", true)
			StaticBatch.compact(car)
			world.add_child(car)

func open_garage(shop_id := "") -> void:
	if garage_overlay:
		return
	garage_overlay = GarageView.new()
	garage_overlay.shop_id = shop_id if shop_id != "" else String(CITY_GARAGE[style])
	garage_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	garage_overlay.closed.connect(close_garage)
	add_child(garage_overlay)

func close_garage() -> void:
	if garage_overlay:
		garage_overlay.queue_free()
		garage_overlay = null

func open_mall() -> void:
	if mall_overlay or garage_overlay:
		return
	mall_overlay = Mall.new()
	if not gear.is_empty():
		wallet = Gear.profile_load()
		mall_overlay.gear = gear
		mall_overlay.profile = wallet
		mall_overlay.look_changed.connect(redress)
		mall_overlay.shop_changed.connect(func():
			Gear.save(gear)
			for g in Progression.event(wallet, "shop", 1):
				controls.toast("DAILY GOAL · %s — +%d Nex" % [String(g.label), int(g.nex)])
			Gear.profile_save(wallet)
			_fit_gear())
	mall_overlay.closed.connect(close_mall)
	add_child(mall_overlay)
	_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED

func close_mall() -> void:
	if mall_overlay:
		mall_overlay.queue_free()
		mall_overlay = null
		_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS

func open_casino() -> void:
	if casino_overlay or mall_overlay or garage_overlay or sports_overlay:
		return
	if style != "neon":
		return     # the Neon City Grand Casino is Neon City's alone
	casino_overlay = Casino.new()
	casino_overlay.closed.connect(close_casino)
	add_child(casino_overlay)
	_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED   # the street isn't seen while inside

func close_casino() -> void:
	if casino_overlay:
		casino_overlay.queue_free()
		casino_overlay = null
		_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS

## a court shop on the Nexus avenue (Apex Gear, Rusty Trigger): shop_view.gd over the gear save and the wallet
func open_shop(id: String) -> void:
	if shop_overlay or casino_overlay or mall_overlay or garage_overlay or sports_overlay:
		return
	if gear.is_empty():
		gear = Gear.load_save()
	wallet = Gear.profile_load()
	shop_overlay = ShopView.new()
	shop_overlay.shop = id
	shop_overlay.gear = gear
	shop_overlay.profile = wallet
	shop_overlay.op_power = Gear.operator_power(gear, int(wallet.get("level", 1)))
	shop_overlay.back_label = "← STREET"
	shop_overlay.changed.connect(func(): Gear.save(gear); Gear.profile_save(wallet); if gunplay: _fit_gear())
	shop_overlay.closed.connect(close_shop)
	add_child(shop_overlay)
	if controls:
		controls.visible = false
	_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED

## a clothing store's dressing room (clothing_store.gd): Block Supply on the avenue
func open_clothes(id: String) -> void:
	if shop_overlay or casino_overlay or mall_overlay or garage_overlay or sports_overlay:
		return
	wallet = Gear.profile_load()
	shop_overlay = ClothingStore.new()
	shop_overlay.store = id
	shop_overlay.profile = wallet
	shop_overlay.back_label = "← STREET"
	shop_overlay.changed.connect(_bought_clothes)
	shop_overlay.look_changed.connect(redress)
	shop_overlay.closed.connect(close_shop)
	add_child(shop_overlay)
	if controls:
		controls.visible = false
	_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED

func _bought_clothes() -> void:
	for g in Progression.event(wallet, "shop", 1):
		controls.toast("DAILY GOAL · %s — +%d Nex" % [String(g.label), int(g.nex)])
	Gear.profile_save(wallet)

## the operator in what they now have on (a clothing store changed it): a new rig, the guns hung back on it
func redress() -> void:
	if not operator:
		return
	operator.build()
	if gunplay:
		gunplay.remount()
	_fit_gear()

func close_shop() -> void:
	if shop_overlay:
		shop_overlay.queue_free()
		shop_overlay = null
		if controls:
			controls.visible = true
		_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS

## puts the operator at a Nexus district court's entrance, facing in (the --shot hook and tests)
func go_to_court(id: String, want_side := 0.0) -> bool:
	for k in Nexus.COURTS:
		for i in 2:
			var sd := -1.0 if i == 0 else 1.0
			if String(Nexus.COURTS[k][i]) != id or (want_side != 0.0 and want_side != sd):
				continue
			var p := Vector3(sd * (Nexus.MOUTH_OUT + 6.0), 0.18, District.tile_z(k))
			if operator:
				operator.position = p
				operator.heading = PI * 0.5 * sd     # the body faces +z at heading 0: into the court
				operator.cam_yaw = operator.heading + PI
				operator.velocity = Vector3.ZERO
				_apply_district(district.update(p.z, true))
			return true
	return false

func open_sports() -> void:
	if casino_overlay or mall_overlay or garage_overlay or sports_overlay:
		return
	sports_overlay = Sports.new()
	sports_overlay.closed.connect(close_sports)
	add_child(sports_overlay)
	_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED

func close_sports() -> void:
	if sports_overlay:
		sports_overlay.queue_free()
		sports_overlay = null
		_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS

# --------------------------------------------------------------------------------------------- driving
func _car_name(c: Node3D) -> String:
	var id := String(c.get_meta("vehicle", ""))
	var v := Catalog.vehicle(id)
	if v.is_empty():
		return { "goliath-tank": "GOLIATH HEAVY TANK", "hover-car": "HOVER-CAR" }.get(id, "CAR")
	return String(v.get("name", "CAR")).to_upper()

## the operator gets in: the car drives with its garage build, the operator rides along (hidden) so the enemies and the
## camera follow the car; the car's box stops being an obstacle to itself
func enter_car(c: Node3D) -> void:
	if c.get_parent() != world:
		# a car from a streamed block: it leaves the block (which may unload behind it) and gets a box slot of its own
		var old := int(c.get_meta("box_index", -1))
		if old >= 0:
			operator.obstacles[old] = PARKED_BOX
		c.reparent(world, true)
		c.remove_meta("size")
		c.set_meta("box_index", operator.obstacles.size())
		operator.obstacles.append(PARKED_BOX)
	var id := String(c.get_meta("vehicle", ""))
	var state := GarageState.load_or_fresh()
	var perf: Dictionary = DriveProfile.performance(state, id) if id != "" else { "max_speed": 28.0, "acceleration": 7.0, "steering": 1.0, "braking": 12.0 }
	if Handling.kind_of(id) != "OFFROAD" or perf.is_empty():
		perf = hull_perf(id) if Handling.BY_ID.has(id) else perf
	var car := StreetCar.new(c, id, perf)
	controls.set_nitro(float(perf.get("nos", 0.0)) > 0.0)
	car.bounds = operator.bounds
	car.ground_at = operator.ground_at
	var own := int(c.get_meta("box_index", -1))
	car.obstacles = operator.obstacles
	car.skip = own
	# the driven car is no obstacle to the camera or the troopers while it moves; its box comes back where it parks
	if own >= 0:
		operator.obstacles[own] = AABB(c.position + Vector3(0, -50, 0), Vector3(0.01, 0.01, 0.01))
	driving_car = car
	# lights on while it is driven: dipped beams and tail lamps by day, full at night
	CarDetail.set_lamps(c, 2.4 if night else 0.8)
	Sound.sfx("car_chirp", -10.0)
	if operator.rig:
		operator.rig.visible = false
	operator.cam_dist = 14.0 if Handling.BY_ID.has(id) else 9.0
	operator.cam_pivot = Vector3(0, 3.2 if Handling.BY_ID.has(id) else 2.4, 0)
	operator.cam_yaw = c.rotation.y
	controls.set_mode("drive")
	controls.prompt("")
	controls.toast("Driving " + _car_name(c) + " · hold BRAKE to stop, EXIT to get out")
	Sound.sfx("click", -6.0)
	Sound.loop("engine", "hover" if bool(perf.get("hover", false)) else "engine", -9.0, 0.5 if Handling.kind_of(id) == "TANK" else 0.8)
	var saved := String(Settings.get_value("radio"))
	if saved != "" and Radio.station_def(saved).size() > 0:
		Sound.radio_on(saved)
	_radio_button.visible = true
	if controls.touch_ui and controls._enter_button:
		controls._enter_button.text = "EXIT"
		controls._enter_button.visible = true

func exit_car() -> void:
	if life:
		life.on_exit()
	var car: RefCounted = driving_car
	driving_car = null
	var c: Node3D = car.node
	CarDetail.set_lamps(c, 0.0)
	var f: Vector3 = car.forward()
	var side := Vector3(f.z, 0, -f.x)
	# the car's box takes its new place; the operator steps out on the kerb side (the right of the car), clear of it
	var own := int(c.get_meta("box_index", -1))
	if own >= 0:
		operator.obstacles[own] = car.box()
	operator.position = c.position + side * -2.3
	operator.position.y = operator.ground_at.call(operator.position.x, operator.position.z)
	operator.velocity = Vector3.ZERO
	operator.heading = c.rotation.y + PI   # the body faces +z at heading 0; the car's nose is -z
	if operator.rig:
		operator.rig.visible = true
	operator.cam_dist = 4.2
	operator.cam_pivot = Vector3(0, 1.55, 0)
	controls.set_mode("foot")
	controls.prompt("")
	Sound.loop_stop("engine")
	Sound.radio_off()
	_radio_button.visible = false

## the car radio: the dial steps through the owner's stations and off; the station is remembered
func _radio_next() -> void:
	Sound.radio_next()
	Settings.set_value("radio", Sound.radio_station())
	Sound.sfx("click", -8.0)

## the street's sound: the city bed (main.gd calls this again when a door's system closes and the street comes back)
func sound_on() -> void:
	Sound.ambience(Sound.bed_for(style), -12.0 if night else -10.0)

func sound_off() -> void:
	Sound.loop_stop("engine")
	Sound.radio_off()

func _exit_tree() -> void:
	sound_off()

func _drive(dt: float) -> void:
	var car: RefCounted = driving_car
	# ENTER at a race meet (or on a racer's challenge) starts the race; otherwise, stopped, it gets you out
	if life and life.offer != "" and not life.busy():
		if controls.take_enter() and life.take_offer():
			return
	if controls.take_enter() and absf(car.speed) < 2.0:
		exit_car()
		return
	var throttle: float = 1.0 if controls.gas() else controls.move.y
	var steer: float = -controls.move.x
	if not controls.touch_ui and not controls.scripted:
		throttle = (1.0 if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP) else 0.0) - (1.0 if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN) else 0.0)
		steer = (1.0 if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT) else 0.0) - (1.0 if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT) else 0.0)
	var nos_was: bool = car.boosting
	car.step(dt, throttle, steer, controls.brake(), controls.nitro())
	if car.boosting and not nos_was:
		Sound.sfx("nitro", -4.0)
	if car.nos_tank <= 0.02:
		controls.nitro_off()
	car.nitro_fx()
	var c: Node3D = car.node
	# the operator rides inside: enemies aim at the car, the chase camera follows it from behind
	operator.position = c.position
	operator.velocity = car.forward() * car.speed
	var look: Vector2 = controls.take_look()
	operator.cam_yaw -= look.x * 0.0045
	operator.cam_yaw = lerp_angle(operator.cam_yaw, c.rotation.y, minf(1.0, 2.5 * dt) if look.x == 0.0 else 0.0)
	operator._place_camera(dt)
	controls.weapon_name.text = _car_name(c)
	controls.ammo.text = "%d km/h" % int(absf(car.speed) * 3.6)
	if float(car.profile.get("nos", 0.0)) > 0.0:
		controls.ammo.text += "   NOS %d%%" % int(car.nos_tank * 100.0)
	if float(car.profile.get("telemetry", 0.0)) > 0.0:
		controls.ammo.text += "   top %d · slip %d°" % [int(car.top_speed * 3.6), int(rad_to_deg(car.slip_angle()))]
	_drive_m += absf(car.speed) * dt
	if _drive_m >= 100.0:
		var pr := Gear.profile_load()
		for g in Progression.event(pr, "drive_m", int(_drive_m)):
			controls.toast("DAILY GOAL · %s — +%d Nex" % [String(g.label), int(g.nex)])
		Gear.profile_save(pr)
		_drive_m = 0.0
	var top: float = maxf(float(car.profile.get("max_speed", 28.0)), 1.0)
	var k := clampf(absf(car.speed) / top, 0.0, 1.0)
	Sound.loop_set("engine", (0.5 if Handling.kind_of(String(c.get_meta("vehicle", ""))) == "TANK" else 0.8) + k * 1.1, -12.0 + k * 6.0)
	_radio_button.text = Sound.radio_line()

