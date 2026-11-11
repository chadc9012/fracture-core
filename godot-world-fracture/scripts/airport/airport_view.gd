extends Control
## An international airport you walk through (owner, Nov 9, with three reference renders: Nexus City International (NXC) by
## day and Neon City International (NEC) at night). The rules are airport.gd; this is the place:
##   LANDSIDE  the forecourt (drop-off road, palms, the globe fountain, the airport's name over the doors), the check-in
##             hall with the TICKETS counter (buy / refund flights), the departures board, and the shops — Sky Duty Free
##             (outfits), Aero Gear (weapons and armour), Cloud Nine Café.
##   SECURITY  three scanner lanes across the hall. Through with a boarding pass from here or a hangar lease; otherwise
##             the lane gates stay shut.
##   AIRSIDE   the gate lounge (six gates, jet bridges out to the parked airliners; BOARD at your ticket's gate flies you
##             there), the apron door, the apron and runway, the control tower, and three private hangars on the apron.
## Weapons: holstered and unusable anywhere landside, in the terminal, the shops and the lounge; out on the airstrip
## (apron, taxiway, runway) and inside a hangar you lease — and only once the story has armed the operator (Mission 01's
## Surge, as on the street). A leased hangar keeps the aircraft you buy and has a target range at the back; FLY takes one
## out over the city (skyways_view.gd).
## Signals: `closed` (back to the street), `flew(code)` after a flight takes off (main.gd opens the destination).

signal closed
signal flew(code: String)
## walked out of a region's airport into the region (main.gd opens it on foot)
signal outside(code: String)

const Air := preload("res://scripts/airport/airport.gd")
const Phone := preload("res://scripts/phone.gd")
const Materials := preload("res://scripts/city/materials.gd")
const StaticBatch := preload("res://scripts/static_batch.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const OutfitLook := preload("res://scripts/gear/outfit_look.gd")
const ShopView := preload("res://scripts/gear/shop_view.gd")
const Crowd := preload("res://scripts/city/crowd.gd")
const Fx := preload("res://scripts/vfx/fx.gd")
const StreetSlice := preload("res://scripts/city/street_slice.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const FractureSet := preload("res://scripts/vfx/fracture_set.gd")

## which airport ("NXC" / "NEC") and whether you just flew in (you start in the arrivals hall, not on the forecourt)
var code := "NXC"
var arriving := false
## where the city sits (main.gd returns to that city's street when you leave)
var return_style := "nexus"

# the plan, in metres: x across, z along (the forecourt is +z, the airstrip -z)
const HALL := Rect2(-48, -30, 96, 56)          # the terminal's walls: x -48..48, z -30..26
const WALL_H := 14.0
const SECURITY_Z := -4.0
const LANES := [-8.0, 0.0, 8.0]
const APRON_DOOR := Vector2(-22.0, -15.0)     # the east wall's door to the apron spans these z
const SHOPS := [ # id, label, z centre, colour
	["nova", "SKY DUTY FREE", 18.0, Color(1.0, 0.55, 0.85)],
	["apex", "AERO GEAR", 8.0, Color(0.35, 1.0, 0.6)],
	["cafe", "CLOUD NINE CAFÉ", -0.5, Color(1.0, 0.8, 0.45)],
]
const HANGAR_X := [86.0, 122.0, 158.0]         # bay centres; each 30 m wide (x), 30 m deep (z -14..16), door at z -14
const RUNWAY_Z := -140.0
## each airport's look (airport.gd AIRPORTS style): sky, land, apron, walls, roof, accents, trees, what stands round it
const LOOKS := {
	"nexus": { "top": Color(0.22, 0.45, 0.82), "hor": Color(0.72, 0.82, 0.92), "fog": Color(0.75, 0.82, 0.9), "fogd": 0.0006,
		"land": Color(0.36, 0.5, 0.3), "apron": Color(0.62, 0.64, 0.67), "wall": Color(0.88, 0.89, 0.92), "roof": Color(0.92, 0.93, 0.95),
		"a1": Color(0.25, 0.6, 1.0), "a2": Color(1.0, 0.82, 0.35), "tree": "palm", "skyline": "nexus", "airline": "NEXUSAIR", "feature": "palms", "extras": [] },
	"neon": { "top": Color(0.03, 0.02, 0.08), "hor": Color(0.28, 0.1, 0.32), "fog": Color(0.25, 0.12, 0.3), "fogd": 0.0011,
		"land": Color(0.08, 0.06, 0.12), "apron": Color(0.3, 0.28, 0.36), "wall": Color(0.25, 0.22, 0.32), "roof": Color(0.18, 0.16, 0.24),
		"a1": Color(0.78, 0.35, 1.0), "a2": Color(0.25, 0.85, 1.0), "tree": "palm", "skyline": "neon", "airline": "NEONAIR", "floor": ["marble_01", Color(0.35, 0.3, 0.45)], "feature": "hologram", "extras": [] },
	# oceanfront runways, a seaplane pier, white resorts (owner: "luxury terminals, seaplanes, resort transportation")
	"tropical": { "top": Color(0.12, 0.45, 0.9), "hor": Color(0.62, 0.86, 0.95), "fog": Color(0.7, 0.88, 0.95), "fogd": 0.00025,
		"land": Color(0.78, 0.66, 0.45), "apron": Color(0.8, 0.8, 0.78), "wall": Color(0.97, 0.97, 0.95), "roof": Color(0.98, 0.98, 0.97),
		"a1": Color(0.1, 0.8, 0.78), "a2": Color(1.0, 0.55, 0.35), "tree": "palm", "skyline": "", "airline": "AZURE AIR", "roof_shape": "tent", "walls": "plaster", "frame": Color(0.95, 0.96, 0.97), "glass": Color(0.5, 0.9, 0.9), "hangar": Color(0.95, 0.95, 0.93), "floor": ["floor_tiles_06", Color(0.96, 0.92, 0.84)], "ceil": Color(0.92, 0.86, 0.74), "feature": "palms", "extras": ["ocean", "seaplanes", "resorts"] },
	# glaciers and snow peaks, heated (bare) runways, rescue orange (owner: "blizzards, difficult landings, rescue missions")
	"arctic": { "top": Color(0.45, 0.55, 0.68), "hor": Color(0.86, 0.89, 0.93), "fog": Color(0.86, 0.89, 0.93), "fogd": 0.0012,
		"land": Color(0.95, 0.97, 1.0), "apron": Color(0.66, 0.69, 0.73), "wall": Color(0.8, 0.84, 0.9), "roof": Color(0.95, 0.97, 1.0),
		"a1": Color(0.35, 0.8, 1.0), "a2": Color(1.0, 0.5, 0.15), "tree": "conifer", "skyline": "", "airline": "FROSTLINE", "roof_shape": "vault", "walls": "ice", "frame": Color(0.92, 0.95, 1.0), "glass": Color(0.7, 0.88, 1.0), "hangar": Color(0.85, 0.9, 0.96), "floor": ["marble_01", Color(0.85, 0.9, 0.98)], "ceil": Color(0.86, 0.93, 1.0), "feature": "ice", "extras": ["mountains", "snow"] },
	# sandstone and gold, solar roofs, dunes and mesas (owner: "sandstone architecture, solar roofs, desert airstrips")
	"desert": { "top": Color(0.2, 0.45, 0.85), "hor": Color(0.92, 0.76, 0.55), "fog": Color(0.92, 0.8, 0.62), "fogd": 0.00035,
		"land": Color(0.78, 0.56, 0.32), "apron": Color(0.74, 0.68, 0.6), "wall": Color(0.88, 0.7, 0.5), "roof": Color(0.1, 0.14, 0.28),
		"a1": Color(1.0, 0.72, 0.25), "a2": Color(0.3, 0.75, 1.0), "tree": "palm", "skyline": "", "airline": "SOLARA AIR", "roof_shape": "terraces", "walls": "sandstone", "frame": Color(0.72, 0.55, 0.35), "glass": Color(0.9, 0.75, 0.5), "hangar": Color(0.86, 0.72, 0.52), "floor": ["floor_tiles_06", Color(0.9, 0.74, 0.55)], "ceil": Color(0.95, 0.85, 0.68), "feature": "fountain", "extras": ["dunes", "solar"] },
	# the coast by the Verdant Forest: seaplanes, and the submarine dock down to underwater Thalassia
	"coastal": { "top": Color(0.18, 0.4, 0.62), "hor": Color(0.6, 0.76, 0.82), "fog": Color(0.62, 0.76, 0.8), "fogd": 0.0006,
		"land": Color(0.32, 0.46, 0.3), "apron": Color(0.6, 0.63, 0.65), "wall": Color(0.75, 0.86, 0.9), "roof": Color(0.85, 0.92, 0.95),
		"a1": Color(0.15, 0.75, 0.95), "a2": Color(0.95, 0.9, 0.55), "tree": "broadleaf", "skyline": "", "airline": "THALASSIA AIR", "roof_shape": "gull", "walls": "timber", "frame": Color(0.88, 0.9, 0.9), "glass": Color(0.55, 0.8, 0.9), "hangar": Color(0.7, 0.78, 0.82), "floor": ["wood_floor", Color(0.9, 0.85, 0.78)], "ceil": Color(0.88, 0.93, 0.95), "feature": "aquarium", "extras": ["ocean", "seaplanes", "subdock"] },
	# black basalt, lava, a smoking volcano, heavy cargo (owner: "volcanic landscape, heavy cargo aircraft, mining, military")
	"volcanic": { "top": Color(0.16, 0.11, 0.11), "hor": Color(0.55, 0.26, 0.16), "fog": Color(0.32, 0.2, 0.16), "fogd": 0.0014,
		"land": Color(0.13, 0.12, 0.12), "apron": Color(0.42, 0.4, 0.38), "wall": Color(0.32, 0.32, 0.34), "roof": Color(0.3, 0.29, 0.28),
		"a1": Color(1.0, 0.42, 0.1), "a2": Color(1.0, 0.8, 0.2), "tree": "", "skyline": "", "airline": "OBSIDIAN CARGO", "sun": 1.3, "roof_shape": "sawtooth", "walls": "basalt", "frame": Color(0.45, 0.22, 0.12), "glass": Color(0.9, 0.5, 0.3), "hangar": Color(0.3, 0.29, 0.28), "floor": ["brushed_concrete", Color(0.3, 0.29, 0.29)], "ceil": Color(0.45, 0.4, 0.38), "feature": "lava", "extras": ["volcano", "lava", "cargo"] },
	# a reinforced strip in the rifts: crystals, floating ruins, a storm with lightning (owner: "dangerous weather and Fracture activity")
	"expedition": { "top": Color(0.14, 0.12, 0.22), "hor": Color(0.46, 0.38, 0.56), "fog": Color(0.4, 0.34, 0.5), "fogd": 0.0012,
		"land": Color(0.3, 0.28, 0.34), "apron": Color(0.44, 0.44, 0.48), "wall": Color(0.36, 0.36, 0.4), "roof": Color(0.32, 0.32, 0.36),
		"a1": Color(0.72, 0.36, 1.0), "a2": Color(1.0, 0.7, 0.2), "tree": "", "skyline": "", "airline": "EXPEDITION AIR", "sun": 1.0, "roof_shape": "shards", "walls": "steel", "frame": Color(0.2, 0.2, 0.24), "glass": Color(0.6, 0.45, 0.9), "hangar": Color(0.38, 0.38, 0.42), "floor": ["metal_plate", Color(0.4, 0.4, 0.45)], "ceil": Color(0.5, 0.48, 0.58), "feature": "specimen", "extras": ["crystals", "ruins", "storm"] },
}
## the flight: take-off, then the cruise over the clouds, then `flew` (seconds)
const TAKEOFF_S := 8.0
const FLIGHT_S := 18.0
const CRUISE_Y := 1500.0
const CAFE := [["Flat white", 8], ["Cold brew", 9], ["Chicken wrap", 14], ["Fruit cup", 7]]

var night := false
var look: Dictionary
## a region's airport (not a city street's): you walk out of it into the region
var in_region := false
var accent := Color(0.4, 0.8, 1.0)
var accent2 := Color(1.0, 0.85, 0.4)
var profile: Dictionary
var gear: Dictionary
var world: Node3D
var static_root: Node3D
var cam: Camera3D
var operator: Node3D
var controls: Control
var gunplay: Node3D
var obstacles: Array[AABB] = []
var spots: Array = []            # [{id, label, pos: Vector3, r}]
var zone := ""
var armed_story := false
var _vp: SubViewport
var _lane_gates: Array = []      # obstacle indexes of the three lane gates
var _lane_bars: Array[Node3D] = []
var _shutters := {}              # bay -> { node, idx }
var _hangar_craft := {}          # bay -> Node3D shown inside
var _board_labels: Array[Label3D] = []
var _board_t := 0.0
var _near := ""
var _panel: Control
var _overlay: Control            # a shop or Skyways over the airport
var _flight: Dictionary = {}     # the take-off: { plane, t, to }
var _landing: Dictionary = {}    # flying in: { plane, t, nodes }
var _cls := "economy"
var _fade: ColorRect             # the ticket desk's class toggle
var _bags: Array[Node3D] = []     # suitcases riding the baggage carousel
var _bag_t := 0.0
var _taxi: Node3D                # an airliner forever taking off down the runway, for life
var _taxi_t := 0.0
var _crowds: Array = []
var _hud: Label
var _land: MeshInstance3D
var _snow: CPUParticles3D
var _flash: DirectionalLight3D     # the Shattered Expanse's lightning
var _flash_t := 4.0
var _look: Array = []            # [from, to] for a fixed look-dev camera (main.gd --shot airport:...)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var a: Dictionary = Air.AIRPORTS.get(code, Air.AIRPORTS.NXC)
	night = bool(a.night)
	look = LOOKS.get(String(a.style), LOOKS.nexus)
	in_region = not bool(a.get("street", true))
	return_style = "" if in_region else String(a.style)
	accent = look.a1
	accent2 = look.a2
	profile = Gear.profile_load()
	Air.air(profile)
	gear = Gear.load_save()
	armed_story = StreetSlice.force_armed or StreetSlice.story_armed()
	var svc := SubViewportContainer.new()
	svc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	add_child(svc)
	_vp = SubViewport.new()
	_vp.own_world_3d = true
	Phone.fit_viewport(_vp)
	_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	svc.add_child(_vp)
	world = Node3D.new()
	_vp.add_child(world)
	static_root = Node3D.new()
	static_root.name = "Static"
	world.add_child(static_root)
	_environment()
	_ground()
	_terminal()
	_forecourt()
	_checkin()
	_shops()
	_security()
	_gates()
	_vip_lounge()
	_baggage_claim()
	_travellers()
	_airstrip()
	_hangars()
	_cargo_terminal()
	_skyline()
	_extras()
	_people()
	# big cells: the airport is one open plain seen whole from the apron, so per-material batches across ~200 m cut the
	# draw calls far more than finer culling would save (Nov 11: ~700 → see README on the phone tier)
	StaticBatch.batch(static_root, 220.0)
	cam = Camera3D.new()
	cam.fov = 64.0
	cam.near = 0.05
	cam.far = 3000.0
	world.add_child(cam)
	cam.current = true
	controls = TouchControls.new()
	add_child(controls)
	operator = Player.new()
	world.add_child(operator)
	operator.bounds = Rect2(-200, -175, 420, 260)
	operator.obstacles = obstacles
	operator.position = Vector3(0, 0, 16.0) if arriving else Vector3(0, 0, 40.0)
	operator.heading = 0.0 if arriving else PI     # off the street: facing the terminal; off a plane: facing the way out
	operator.build()
	operator.attach_camera(cam)
	gunplay = Gunplay.new()
	world.add_child(gunplay)
	gunplay.setup(operator, obstacles)
	gunplay.set_loadout(Gear.loadout(gear))
	OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", ""))))
	for bay in Air.BAYS:   # the target range at the back of each hangar (only usable where weapons are allowed)
		var cx: float = HANGAR_X[Air.BAYS.find(bay)]
		for k in 3:
			gunplay.add_dummy(Vector3(cx - 8.0 + k * 8.0, 0, 13.0), 40.0)
	_apply_lanes()
	_apply_shutters()
	_head()
	_set_zone(_zone_at(operator.position), true)
	if arriving:
		_land_begin()
	else:
		controls.toast(String(a.name))
	Sound.loops_stop()
	Sound.ambience(Sound.bed_for(String(Air.AIRPORTS[code].region)), -14.0)

# --------------------------------------------------------------------------------------------- the frame
func _process(dt: float) -> void:
	dt = minf(dt, 0.05)
	_step_taxi(dt)
	if _snow and operator:
		_snow.global_position = operator.global_position + Vector3(0, 14, 0)
	if _flash:
		_flash_t -= dt
		if _flash_t <= 0.0:
			_flash_t = randf_range(5.0, 12.0)
		# lightning: two quick strokes in the last half second before each reset, dark otherwise
		_flash.light_energy = 4.0 if (_flash_t < 0.12 or (_flash_t > 0.3 and _flash_t < 0.4)) else 0.0
	if not _flight.is_empty():
		_step_flight(dt)
		return
	_step_bags(dt)
	if not _landing.is_empty():
		_step_landing(dt)
		return
	if _overlay or _panel:
		return
	_board_t -= dt
	if _board_t <= 0.0:
		_board_t = 5.0
		_refresh_board()
	operator.step(dt, controls.move, controls.take_look(), controls.take_jump(), controls.sprint)
	if not _look.is_empty():
		cam.position = _look[0]
		cam.look_at(_look[1])
	_security_check()
	var z := _zone_at(operator.position)
	if z != zone:
		_set_zone(z, false)
	for c in _crowds:
		c.set_player(operator.position)
	# the nearest thing to use
	var near := ""
	var label := ""
	for s in spots:
		var p: Vector3 = s.pos
		if Vector2(operator.position.x - p.x, operator.position.z - p.z).length() < float(s.get("r", 3.2)):
			near = String(s.id)
			label = String(s.label)
			break
	if near != _near:
		_near = near
		controls.prompt(label)
	if controls.take_enter() and near != "":
		_use(near)
		return
	if controls.take_next():
		gunplay.next_weapon()
	var armed := _armed_here()
	gunplay.step(dt, cam, controls.fire and armed, controls.take_reload() and armed, Vector2(operator.velocity.x, operator.velocity.z).length())
	var g = gunplay.gun()
	controls.weapon_name.text = g.display_name() if armed else "WEAPONS STOWED"
	controls.ammo.text = ("RELOADING" if g.reloading > 0.0 else g.ammo_text()) if armed else ""
	_hud.text = "%s · %s   %d Nex%s" % [code, _zone_name(zone), int(profile.get("nex", 0)), _pass_line()]

## a fixed camera for look-dev shots
func look_from(from: Vector3, to: Vector3) -> void:
	_look = [from, to]

func _armed_here() -> bool:
	return armed_story and Air.weapons_allowed(profile, code, zone)

func _pass_line() -> String:
	var t := Air.tickets_from(profile, code)
	if t.is_empty():
		return ""
	var x: Dictionary = t[0]
	return "   ✈ %s gate %s" % [String(Air.DESTINATIONS[x.to].name), Air.gate(code, String(x.to))]

## which part of the airport a point is in (airport.gd zone names)
## the VIP lounge: a glass pavilion off the airside's west wall
const VIP := Rect2(-72, -28, 22, 20)
const CAROUSEL := Vector3(17, 0, 14)

func _zone_at(p: Vector3) -> String:
	if VIP.has_point(Vector2(p.x, p.z)):
		return "vip"
	for i in HANGAR_X.size():
		if absf(p.x - float(HANGAR_X[i])) < 15.0 and p.z > -14.0 and p.z < 16.0:
			return "hangar:" + String(Air.BAYS[i])
	if HALL.has_point(Vector2(p.x, p.z)):
		if p.z <= SECURITY_Z:
			return "lounge"
		return "shops" if p.x > 30.0 else "terminal"
	if p.z > 26.0:
		return "landside"
	return "runway" if p.z < RUNWAY_Z + 30.0 else "apron"

func _zone_name(z: String) -> String:
	if z.begins_with("hangar:"):
		return "HANGAR " + z.substr(7) + (" (YOURS)" if Air.hangar_bay(profile, code) == z.substr(7) else "")
	return { "landside": "FORECOURT", "terminal": "CHECK-IN HALL", "shops": "SHOPS", "lounge": "GATE LOUNGE", "vip": "VIP LOUNGE", "apron": "APRON · AIRSIDE", "runway": "RUNWAY" }.get(z, z.to_upper())

func _set_zone(z: String, first: bool) -> void:
	var was := _armed_here()
	zone = z
	var now := _armed_here()
	gunplay.set_holstered(not now)
	controls.set_armed(now)
	if first:
		return
	if was and not now:
		controls.toast("Weapons stowed · no weapons inside the airport")
	elif now and not was:
		controls.toast("Airside · weapons allowed on the airstrip" if not z.begins_with("hangar:") else "Your hangar · weapons allowed")
	elif not armed_story and (z == "apron" or z.begins_with("hangar:")) and Air.weapons_allowed(profile, code, z):
		controls.toast("Weapons are allowed here — once you're carrying one")

## the lanes are open to a pass-holder; anyone else is held at the line (also catches a walk-through before the gates draw)
func _security_check() -> void:
	var p: Vector3 = operator.position
	if p.z < SECURITY_Z - 0.4 and p.z > SECURITY_Z - 3.0 and HALL.has_point(Vector2(p.x, p.z)) and not Air.can_go_airside(profile, code):
		operator.position.z = SECURITY_Z + 0.6
		operator.velocity = Vector3.ZERO
		controls.toast("Security: boarding pass or hangar lease needed past this point")

func _apply_lanes() -> void:
	var open := Air.can_go_airside(profile, code)
	for i in _lane_gates.size():
		var x: float = LANES[i]
		obstacles[_lane_gates[i]] = AABB(Vector3(x - 1.2, 0, SECURITY_Z - 0.3), Vector3(2.4, 1.2, 0.6)) if not open else AABB(Vector3(0, -900, 0), Vector3(0.1, 0.1, 0.1))
		_lane_bars[i].rotation.y = PI * 0.5 if open else 0.0

func _apply_shutters() -> void:
	var mine := Air.hangar_bay(profile, code)
	for bay in _shutters:
		var s: Dictionary = _shutters[bay]
		var open: bool = bay == mine
		(s.node as Node3D).position.y = 10.5 if open else 4.5
		var cx: float = HANGAR_X[Air.BAYS.find(bay)]
		obstacles[int(s.idx)] = AABB(Vector3(0, -900, 0), Vector3(0.1, 0.1, 0.1)) if open else AABB(Vector3(cx - 14.0, 0, -14.6), Vector3(28.0, 9.0, 0.6))
	for bay in _hangar_craft:
		(_hangar_craft[bay] as Node3D).queue_free()
	_hangar_craft.clear()
	if mine != "":
		var list := Air.aircraft_at(profile, code)
		var cx: float = HANGAR_X[Air.BAYS.find(mine)]
		for i in list.size():
			var m := _craft_model(String(list[i]), 13.0 if String(list[i]) != "leviathan" else 22.0)
			var paint := Air.paint_of(profile, String(list[i]))
			if paint != "factory":
				var over := StandardMaterial3D.new()
				over.albedo_color = Color(Air.PAINTS[paint], 0.62)
				over.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				over.metallic = 0.5
				over.roughness = 0.35
				for c in m.find_children("*", "MeshInstance3D", true, false):
					(c as MeshInstance3D).material_overlay = over
			m.position = Vector3(cx + (i - (list.size() - 1) * 0.5) * 9.0, 0, 1.0)
			m.rotation.y = PI
			world.add_child(m)
			_hangar_craft[mine + str(i)] = m
	# a lease can change what's allowed where you stand
	if operator:
		_set_zone(_zone_at(operator.position), false)

func _save() -> void:
	Gear.profile_save(profile)

# --------------------------------------------------------------------------------------------- using things
func _use(id: String) -> void:
	controls.prompt("")
	_near = ""
	Sound.sfx("door", -6.0)
	if id == "tickets":
		_tickets_panel()
	elif id == "nova" or id == "apex":
		_open_shop(id)
	elif id == "cafe":
		_cafe_panel()
	elif id.begins_with("gate:"):
		_gate_panel(id.substr(5))
	elif id.begins_with("hangar:"):
		_hangar_panel(id.substr(7))
	elif id.begins_with("craft:"):
		_aircraft_panel()
	elif id == "vip-in":
		if Air.vip(profile, code):
			operator.position = Vector3(VIP.position.x + 17.0, 0, VIP.position.y + 10.0)
			operator.velocity = Vector3.ZERO
			controls.toast("VIP Lounge · complimentary bar")
		else:
			controls.toast("VIP Lounge: First Class pass or hangar lease only")
	elif id == "vip-out":
		operator.position = Vector3(-44.0, 0, -12.0)
		operator.velocity = Vector3.ZERO
	elif id == "vip-bar":
		controls.toast(["Sparkling water, on the house.", "A Nexus Spritz, on the house.", "Espresso, on the house.", "Cold-pressed juice, on the house."][randi() % 4])
	elif id == "exit":
		if in_region:
			outside.emit(code)
		else:
			closed.emit()

func _panel_open(title: String, col: Color) -> VBoxContainer:
	_panel = Control.new()
	_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_panel)
	controls.visible = false
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.06, 0.94)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_panel.add_child(bg)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scroll.offset_left = 20
	scroll.offset_top = 20
	scroll.offset_right = -20
	scroll.offset_bottom = -20
	_panel.add_child(scroll)
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 8)
	scroll.add_child(box)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 14)
	box.add_child(head)
	var back := Button.new()
	back.text = "← BACK"
	back.custom_minimum_size = Vector2(100, 44)
	back.pressed.connect(_panel_close)
	head.add_child(back)
	var t := Label.new()
	t.text = title
	t.add_theme_font_size_override("font_size", 22)
	t.modulate = col
	head.add_child(t)
	var nex := Label.new()
	nex.name = "Nex"
	nex.text = "%d Nex" % int(profile.get("nex", 0))
	nex.add_theme_font_size_override("font_size", 18)
	head.add_child(nex)
	return box

func _panel_close() -> void:
	if _panel:
		_panel.queue_free()
		_panel = null
	controls.visible = true

func _line(box: VBoxContainer, text: String, size := 15, col := Color(0.75, 0.8, 0.88)) -> Label:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_font_size_override("font_size", size)
	l.modulate = col
	box.add_child(l)
	return l

func _row_button(box: VBoxContainer, text: String, col: Color, f: Callable, enabled := true) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 46)
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.add_theme_color_override("font_color", col)
	b.disabled = not enabled
	b.pressed.connect(f)
	box.add_child(b)
	return b

## re-open a panel after a purchase (its numbers changed)
func _redo(f: Callable, msg: String) -> void:
	_save()
	_panel_close()
	f.call()
	controls.toast(msg)
	if _panel:
		_line(_panel.get_child(1).get_child(0), msg, 16, Color(0.55, 1.0, 0.8)).move_to_front()

func _tickets_panel() -> void:
	var box := _panel_open("TICKETS · %s" % code, accent2)
	_line(box, "One way. Your boarding pass gets you through security; board at the gate shown. First Class (×%.1f) also opens the VIP lounge airside. Refunds pay back 90%%." % Air.FIRST_CLASS)
	var cls_row := HBoxContainer.new()
	cls_row.add_theme_constant_override("separation", 8)
	box.add_child(cls_row)
	for c in ["economy", "first"]:
		var b := Button.new()
		b.text = ("● " if _cls == c else "○ ") + ("ECONOMY" if c == "economy" else "FIRST CLASS")
		b.custom_minimum_size = Vector2(150, 42)
		b.pressed.connect(func(): _cls = c; _panel_close(); _tickets_panel())
		cls_row.add_child(b)
	var minute := _minute()
	var by_dest := {}
	for f in Air.departures(code, minute):
		by_dest[f.to] = f
	for to in Air.routes(code):
		var f: Dictionary = by_dest[to]
		_row_button(box, "%s  %s  ·  %s  ·  gate %s  ·  %d Nex" % [to, String(Air.DESTINATIONS[to].name).to_upper(), String(f.time), String(f.gate), Air.fare_for(to, _cls)],
			Color(1.0, 0.85, 0.5) if _cls == "first" else Color(0.85, 0.92, 1.0), func(): _redo(_tickets_panel, Air.buy_ticket(profile, code, to, _cls)); _apply_lanes())
	var mine := Air.tickets_from(profile, code)
	if not mine.is_empty():
		_line(box, "YOUR BOARDING PASSES", 17, accent2)
		for t in mine:
			var tid := String(t.id)
			_row_button(box, "✈ %s → %s · %s · gate %s   REFUND" % [code, String(Air.DESTINATIONS[t.to].name), "FIRST" if String(t.get("class", "economy")) == "first" else "economy", Air.gate(code, String(t.to))],
				Color(1.0, 0.7, 0.6), func(): _redo(_tickets_panel, Air.refund(profile, tid)); _apply_lanes())
	var later := Air.DESTINATIONS.keys().filter(func(c): return String(Air.DESTINATIONS[c].region) == "")
	_line(box, "Not open yet: " + ", ".join(later.map(func(c): return String(Air.DESTINATIONS[c].name))), 13, Color(0.55, 0.6, 0.68))

func _gate_panel(g: String) -> void:
	var box := _panel_open("GATE %s" % g, accent)
	var any := false
	for t in Air.tickets_from(profile, code):
		var to := String(t.to)
		any = true
		if Air.gate(code, to) == g:
			_row_button(box, "BOARD · %s → %s" % [code, String(Air.DESTINATIONS[to].name).to_upper()], Color(0.5, 1.0, 0.7), func(): _board(to))
		else:
			_line(box, "Your flight to %s boards at gate %s." % [String(Air.DESTINATIONS[to].name), Air.gate(code, to)])
	if not any:
		_line(box, "No boarding pass. Buy one at the TICKETS counter in the check-in hall.")
	var here := Air.departures(code, _minute()).filter(func(f): return f.gate == g and f.open)
	if not here.is_empty():
		_line(box, "From this gate: " + ", ".join(here.map(func(f): return "%s %s" % [f.time, f.name])), 13, Color(0.6, 0.66, 0.75))

func _cafe_panel() -> void:
	var box := _panel_open("CLOUD NINE CAFÉ", Color(1.0, 0.8, 0.45))
	for it in CAFE:
		var name := String(it[0])
		var price := int(it[1])
		_row_button(box, "%s · %d Nex" % [name, price], Color(1.0, 0.9, 0.75), func():
			if int(profile.nex) < price:
				_redo(_cafe_panel, "Needs %d Nex" % price)
			else:
				profile.nex = int(profile.nex) - price
				_redo(_cafe_panel, "%s, to go. Enjoy." % name))

func _hangar_panel(bay: String) -> void:
	var mine := Air.hangar_bay(profile, code)
	var box := _panel_open("PRIVATE HANGAR %s · %s" % [bay, code], accent2)
	if mine == bay:
		_line(box, "Your hangar. The door is open; your aircraft are inside. Weapons are allowed in here (target range at the back) and out on the airstrip.")
	elif mine != "":
		_line(box, "You lease hangar %s here. One hangar per airport." % mine)
	else:
		_line(box, "Lease this hangar: your own airside access (no ticket needed at security), a place to keep the aircraft you buy, and weapons allowed inside.")
		_row_button(box, "LEASE HANGAR %s · %d Nex" % [bay, Air.HANGAR_PRICE], Color(0.5, 1.0, 0.7), func():
			_redo(func(): _hangar_panel(bay), Air.buy_hangar(profile, code, bay))
			_apply_lanes()
			_apply_shutters())

func _aircraft_panel() -> void:
	var box := _panel_open("YOUR HANGAR · AIRCRAFT", accent2)
	var have := Air.aircraft_at(profile, code)
	for craft in Air.AIRCRAFT:
		var d: Dictionary = Air.AIRCRAFT[craft]
		if craft in have:
			_row_button(box, "FLY · %s" % String(d.name).to_upper(), Color(0.5, 1.0, 0.7), func(): _fly_craft(craft))
			_row_button(box, "   PAINT · %s (now %s)" % [String(d.name), Air.paint_of(profile, craft).capitalize()], Color(0.9, 0.8, 1.0), func(): _panel_close(); _paint_panel(craft))
		else:
			_row_button(box, "BUY · %s · %d Nex" % [String(d.name), int(d.price)], Color(0.85, 0.92, 1.0), func():
				_redo(_aircraft_panel, Air.buy_aircraft(profile, code, craft))
				_apply_shutters())
	_line(box, "Flying takes your aircraft out over %s; landing brings you back here." % String(Air.AIRPORTS[code].city), 13)

func _paint_panel(craft: String) -> void:
	var box := _panel_open("PAINT SHOP · %s" % String(Air.AIRCRAFT[craft].name).to_upper(), accent2)
	_line(box, "A respray is %d Nex; factory colours are free. It shows on the aircraft in your hangar." % Air.PAINT_PRICE)
	for name in Air.PAINTS:
		var col: Color = Air.PAINTS[name]
		var b := _row_button(box, ("● " if Air.paint_of(profile, craft) == name else "○ ") + String(name).capitalize(), col.lightened(0.3) if col.a > 0.0 else Color(0.85, 0.9, 1.0), func():
			_redo(func(): _paint_panel(craft), Air.paint(profile, code, craft, name))
			_apply_shutters())

func _open_shop(id: String) -> void:
	var v := ShopView.new()
	v.shop = id
	v.back_label = "← TERMINAL"
	v.gear = gear
	v.profile = profile
	v.op_power = Gear.operator_power(gear, int(profile.get("level", 1)))
	v.changed.connect(func():
		Gear.save(gear)
		_save()
		gunplay.set_loadout(Gear.loadout(gear))
		gunplay.set_holstered(not _armed_here())
		OutfitLook.apply(operator.rig, Gear.outfit(str(gear.get("outfit", "")))))
	_overlay_open(v)

func _fly_craft(craft: String) -> void:
	_panel_close()
	var SkywaysView := load("res://scripts/flying/skyways_view.gd")
	var v: Control = SkywaysView.new()
	v.craft_id = craft
	v.region_id = String(Air.AIRPORTS[code].region)
	_overlay_open(v)

func _overlay_open(v: Control) -> void:
	_overlay = v
	controls.visible = false
	_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	v.closed.connect(func():
		_overlay.queue_free()
		_overlay = null
		controls.visible = true
		_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		Sound.loops_stop()
		Sound.ambience(Sound.bed_for(String(Air.AIRPORTS[code].region)), -14.0))
	add_child(v)

# --------------------------------------------------------------------------------------------- the flight
## the ticket is used, the HUD goes, and the camera watches your airliner roll down the runway and climb away; then
## `flew(to)` (main.gd opens the destination)
func _board(to: String) -> void:
	if not Air.board(profile, code, to):
		return
	_save()
	_panel_close()
	controls.visible = false
	_hud.visible = false
	var plane := _airliner(accent, String(look.airline), Air.fare(to) >= 260)   # long-haul fares fly the wide-body
	plane.position = Vector3(-260, 0, RUNWAY_Z)
	plane.rotation.y = -PI * 0.5      # nose to +x
	world.add_child(plane)
	_flight = { "plane": plane, "t": 0.0, "to": to }
	Sound.sfx("door", -4.0)
	Sound.loop("jet", "jet", -8.0, 0.7)
	var l := Label.new()
	l.name = "FlightLine"
	l.text = "✈ %s → %s" % [code, String(Air.DESTINATIONS[to].name).to_upper()]
	l.add_theme_font_size_override("font_size", 24)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", 8)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	l.offset_top = 36
	add_child(l)
	var skip := Button.new()
	skip.name = "SkipFlight"
	skip.text = "SKIP ▸"
	skip.custom_minimum_size = Vector2(110, 44)
	skip.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	skip.offset_left = -130
	skip.offset_top = -64
	skip.pressed.connect(func(): if not _flight.is_empty(): _flight.t = FLIGHT_S)
	add_child(skip)

## flying in: the airliner comes down the glide path from the west, flares, touches down and rolls out while the camera
## watches from beside the runway; then you're in the arrivals hall. SKIP ends it.
const LAND_S := 9.0

func _land_begin() -> void:
	controls.visible = false
	_hud.visible = false
	var plane := _airliner(accent, String(look.airline), Air.fare(code) >= 260)
	plane.rotation.y = -PI * 0.5      # nose to +x
	world.add_child(plane)
	var l := Label.new()
	l.text = "✈ LANDING · %s" % String(Air.AIRPORTS[code].name).to_upper()
	l.add_theme_font_size_override("font_size", 24)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", 8)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	l.offset_top = 36
	add_child(l)
	var skip := Button.new()
	skip.text = "SKIP ▸"
	skip.custom_minimum_size = Vector2(110, 44)
	skip.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	skip.offset_left = -130
	skip.offset_top = -64
	skip.pressed.connect(func(): if not _landing.is_empty(): _landing.t = LAND_S)
	add_child(skip)
	_landing = { "plane": plane, "t": 0.0, "nodes": [plane, l, skip], "rough": look == LOOKS.expedition }
	Sound.loop("jet", "jet", -10.0, 0.9)
	_fade_to(1.0)
	if _taxi:
		_taxi.visible = false   # one airliner on the runway at a time
	_place_landing(0.0)

## where the airliner is t seconds into the landing: 3° glide to touchdown at x -330 (t 5.5), then braking to a stop
func _place_landing(t: float) -> void:
	var plane: Node3D = _landing.plane
	var x: float
	var y: float
	var pitch := 0.0
	if t < 5.5:
		x = -330.0 - (5.5 - t) * 75.0
		y = maxf(0.0, (5.5 - t) * 75.0 * 0.0524)          # tan 3°
		pitch = 0.05 + (0.04 if t > 4.6 else 0.0)        # nose up a touch, more in the flare
	else:
		var r := t - 5.5
		x = -330.0 + 75.0 * r - 0.5 * 17.0 * r * r        # braking from ~75 m/s
		y = 0.0
		pitch = maxf(0.0, 0.09 - r * 0.08)
	plane.position = Vector3(x, y, RUNWAY_Z)
	plane.rotation = Vector3(0, -PI * 0.5, pitch)
	# the camera keeps pace just ahead and to the side, then lets it roll past
	var lead := Vector3(48.0 - minf(t, LAND_S) * 6.0, maxf(3.0, y * 0.6 + 3.0), 46.0)
	cam.position = Vector3(minf(x, -330.0), 0, RUNWAY_Z) + lead
	cam.look_at(plane.position + Vector3(0, 3, 0))
	# out of the cloud: the white (or the night) clears over the first second and a half
	_fade_to(clampf(1.0 - t / 1.5, 0.0, 1.0))
	if t > 5.5:
		Sound.loop_set("jet", maxf(0.5, 0.9 - (t - 5.5) * 0.1), -10.0 - (t - 5.5) * 2.0)
	# the Shattered Expanse's reinforced strip: the touchdown bucks and throws up rift dust
	if bool(_landing.get("rough", false)) and t > 5.5:
		var bump := maxf(0.0, 1.0 - (t - 5.5) / 2.5)
		plane.position.y += absf(sin(t * 23.0)) * 0.35 * bump
		plane.rotation.x = sin(t * 17.0) * 0.03 * bump
		cam.position += Vector3(randf_range(-1, 1), randf_range(-1, 1), 0) * 0.35 * bump
		if not _landing.has("dust"):
			_landing.dust = _dust(Vector3(-330, 0.5, RUNWAY_Z))
			(_landing.nodes as Array).append(_landing.dust)

func _step_landing(dt: float) -> void:
	_landing.t = float(_landing.t) + dt
	var t: float = _landing.t
	if t < LAND_S:
		_place_landing(t)
		return
	for n in _landing.nodes:
		(n as Node).queue_free()
	_landing = {}
	Sound.loop_stop("jet")
	_fade_to(0.0)
	controls.visible = true
	_hud.visible = true
	operator.attach_camera(cam)
	controls.toast("Welcome to %s." % String(Air.AIRPORTS[code].city))

func _step_flight(dt: float) -> void:
	_flight.t = float(_flight.t) + dt
	var t: float = _flight.t
	var plane: Node3D = _flight.plane
	# 0..7 s: roll and rotate at ~5 s, climb out; the camera stands beside the runway, then follows
	var x := -260.0 + 4.0 * t * t * 1.6
	var y := 0.0 if t < 5.0 else pow(t - 5.0, 2.0) * 3.2
	plane.position = Vector3(x, y, RUNWAY_Z)
	plane.rotation.z = 0.0 if t < 5.0 else -minf(0.18, (t - 5.0) * 0.12)
	Sound.loop_set("jet", 0.7 + minf(t, TAKEOFF_S) * 0.06, -8.0 if t < TAKEOFF_S else -14.0)
	_fade_to(clampf((t - (FLIGHT_S - 1.2)) / 1.2, 0.0, 1.0))   # down through the cloud deck
	if t < TAKEOFF_S:
		cam.position = Vector3(-40, 6, RUNWAY_Z + 55)
		cam.look_at(plane.position + Vector3(0, 3, 0))
		return
	# the cruise: above the clouds, the camera riding alongside, the time to landing counting down
	if not _flight.has("cruise"):
		_flight.cruise = _cruise_build()
	var c := t - TAKEOFF_S
	plane.position = Vector3(c * 120.0, CRUISE_Y + sin(c * 0.6) * 1.5, 0)
	plane.rotation = Vector3(0, -PI * 0.5, sin(c * 0.4) * 0.05)
	var orbit := 0.35 + c * 0.05
	cam.position = plane.position + Vector3(-cos(orbit) * 70.0, 14.0 + c * 0.6, sin(orbit) * 55.0)
	cam.look_at(plane.position + Vector3(8, 2, 0))
	var line := get_node_or_null("FlightLine") as Label
	if line:
		line.text = "✈ %s → %s · cruising · landing in %ds" % [code, String(Air.DESTINATIONS[_flight.to].name).to_upper(), int(ceil(FLIGHT_S - t))]
	if t > FLIGHT_S:
		var to := String(_flight.to)
		_flight = {}
		Sound.loop_stop("jet")
		flew.emit(to)

## the cloud deck for the cruise: flattened puffs below and around the plane's path, tinted by the airport's sky
func _cruise_build() -> Node3D:
	var root := Node3D.new()
	root.set_meta("dynamic", true)
	world.add_child(root)
	var sm := SphereMesh.new()
	sm.radius = 1.0
	sm.height = 2.0
	sm.radial_segments = 12
	sm.rings = 6
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.86, 0.87, 0.9) if not night else Color(0.32, 0.26, 0.46)
	m.roughness = 1.0
	m.emission_enabled = true
	m.emission = (look.hor as Color).lerp(Color.WHITE, 0.3) if not night else Color(0.25, 0.15, 0.4)
	m.emission_energy_multiplier = 0.22 if not night else 0.35
	sm.material = m
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = sm
	mm.instance_count = int(220 * Phone.crowd()) + 80
	var rng := RandomNumberGenerator.new()
	rng.seed = 41
	for i in mm.instance_count:
		var b := Basis.from_scale(Vector3(rng.randf_range(40, 140), rng.randf_range(10, 26), rng.randf_range(30, 90))).rotated(Vector3.UP, rng.randf() * TAU)
		var high := rng.randf() < 0.12
		var y := CRUISE_Y + (rng.randf_range(60, 140) if high else -rng.randf_range(35, 90))
		mm.set_instance_transform(i, Transform3D(b, Vector3(rng.randf_range(-600, 2200), y, rng.randf_range(-900, 900))))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mmi)
	# no fog up here: the deck should read to the horizon
	for n in world.get_children():
		if n is WorldEnvironment:
			(n as WorldEnvironment).environment.fog_density *= 0.15
	cam.far = 6000.0
	return root

# --------------------------------------------------------------------------------------------- the board
func _minute() -> int:
	var d := Time.get_time_dict_from_system()
	return int(d.hour) * 60 + int(d.minute)

func _refresh_board() -> void:
	var rows: Array[String] = ["DEPARTURES                     GATE  STATUS"]
	for f in Air.departures(code, _minute()).slice(0, 9):
		rows.append("%s  %-3s %-18s  %-4s  %s" % [f.time, f.to, String(f.name).to_upper().left(18), f.gate if f.open else "--", f.status])
	var text := "\n".join(rows)
	for l in _board_labels:
		l.text = text

# --------------------------------------------------------------------------------------------- HUD
func _head() -> void:
	var row := HBoxContainer.new()
	row.position = Vector2(16, 16)
	row.add_theme_constant_override("separation", 8)
	add_child(row)
	var back := Button.new()
	back.text = "← STREET"
	back.custom_minimum_size = Vector2(96, 44)
	back.pressed.connect(func(): closed.emit())
	row.add_child(back)
	_hud = Label.new()
	_hud.add_theme_font_size_override("font_size", 16)
	_hud.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	_hud.add_theme_constant_override("outline_size", 6)
	_hud.modulate = accent2.lerp(Color.WHITE, 0.4)
	row.add_child(_hud)
	_refresh_board()

# --------------------------------------------------------------------------------------------- building helpers
## materials are shared by value: StaticBatch merges per material, so a fresh material per box (every suitcase, every
## container) was a draw call each — the Nov 11 pass took Nexus from ~700 to ~450 draws on the phone tier this way.
## Callers that change a material after taking it duplicate() it first.
var _mats := {}

func _mat(c: Color, rough := 0.6, metal := 0.0) -> StandardMaterial3D:
	var key := "m%s|%.2f|%.2f" % [c.to_html(), rough, metal]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	_mats[key] = m
	return m

func _glow(c: Color, energy := 2.5) -> StandardMaterial3D:
	var key := "g%s|%.2f" % [c.to_html(), energy]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	_mats[key] = m
	return m

func _glass(tint: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(tint.r, tint.g, tint.b, 0.28)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.metallic = 0.6
	m.roughness = 0.05
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

## a box; `solid` also makes it a wall for the operator (and the guns)
func _box(size: Vector3, pos: Vector3, mat: Material, parent: Node3D = null, solid := false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	(parent if parent else static_root).add_child(mi)
	if solid:
		obstacles.append(AABB(pos - size * 0.5, size))
	return mi

func _cyl(r: float, h: float, pos: Vector3, mat: Material, parent: Node3D = null, top := -1.0, seg := 16) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r if top < 0.0 else top
	cm.bottom_radius = r
	cm.height = h
	cm.radial_segments = seg
	mi.mesh = cm
	mi.material_override = mat
	mi.position = pos
	(parent if parent else static_root).add_child(mi)
	return mi

func _text(t: String, pos: Vector3, size: int, col: Color, yaw := 0.0, parent: Node3D = null, billboard := false) -> Label3D:
	var l := Label3D.new()
	l.text = t
	l.font_size = size
	l.pixel_size = 0.01
	l.modulate = col
	l.outline_size = 10
	l.outline_modulate = Color(0, 0, 0, 0.7)
	l.position = pos
	l.rotation.y = yaw
	l.shaded = false
	l.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if billboard:
		l.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	(parent if parent else world).add_child(l)
	return l

func _spot(id: String, label: String, pos: Vector3, r := 3.2) -> void:
	spots.append({ "id": id, "label": label, "pos": pos, "r": r })

func _model(path: String) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	return (load(path) as PackedScene).instantiate() as Node3D

# --------------------------------------------------------------------------------------------- light and ground
func _environment() -> void:
	var sky := ProceduralSkyMaterial.new()
	if night:
		sky.sky_top_color = Color(0.03, 0.02, 0.08)
		sky.sky_horizon_color = Color(0.28, 0.1, 0.32)
		sky.ground_horizon_color = Color(0.2, 0.08, 0.22)
		sky.ground_bottom_color = Color(0.02, 0.01, 0.03)
		sky.sun_angle_max = 0.0
	else:
		sky.sky_top_color = look.top
		sky.sky_horizon_color = look.hor
		sky.ground_horizon_color = (look.hor as Color).darkened(0.15)
		sky.ground_bottom_color = Color(0.2, 0.2, 0.2)
		sky.sun_angle_max = 25.0
	var s := Sky.new()
	s.sky_material = sky
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = s
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR if night else Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_color = Color(0.45, 0.3, 0.6)
	env.ambient_light_energy = 0.75 if night else 0.85
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.0 if night else 1.05
	env.glow_enabled = true
	env.glow_intensity = 0.9 if night else 0.4
	env.glow_bloom = 0.1 if night else 0.02
	env.glow_hdr_threshold = 1.0
	env.fog_enabled = true
	env.fog_light_color = look.fog
	env.fog_density = look.fogd
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 145, 0) if not night else Vector3(-40, -130, 0)
	sun.light_energy = float(look.get("sun", 2.2)) if not night else 0.35
	sun.light_color = Color(1.0, 0.92, 0.8) if not night else Color(0.65, 0.6, 1.0)
	sun.shadow_enabled = not night
	sun.directional_shadow_max_distance = 120.0
	Phone.fit_sun(sun)
	world.add_child(sun)
	if night:
		var moon := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 30.0
		sm.height = 60.0
		moon.mesh = sm
		moon.material_override = _glow(Color(0.95, 0.95, 1.0), 2.2)
		moon.position = Vector3(500, 420, 1200)
		world.add_child(moon)
	# a few warm lights in the hall (the Mobile renderer takes 8 per mesh; these are few and far apart)
	for p in [Vector3(-24, 9, 12), Vector3(18, 9, 12), Vector3(0, 9, -18)]:
		var o := OmniLight3D.new()
		o.position = p
		o.omni_range = 30.0
		o.light_energy = 1.4 if night else 0.9
		o.light_color = accent.lerp(Color.WHITE, 0.6) if night else Color(1.0, 0.95, 0.85)
		world.add_child(o)

func _ground() -> void:
	# the land round the airport out to the city: grass verges by day, dark ground at night
	var land := MeshInstance3D.new()
	_land = land
	var pm := PlaneMesh.new()
	pm.size = Vector2(5000, 5000)
	land.mesh = pm
	land.position = Vector3(0, -0.25, -300)
	land.material_override = Materials.surface("rubber_tiles" if look.tree == "palm" and code in ["NXC", "NEC"] else "brushed_concrete", look.land, 12.0, 1.0)
	land.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(land)
	# the airstrip's concrete, everything outside the building
	# the airside concrete: apron, gates and hangar fronts (the runway and taxiway are asphalt over the land)
	_box(Vector3(440, 0.2, 210), Vector3(15, -0.1, -79), Materials.surface("brushed_concrete", (look.apron as Color).darkened(0.18), 6.0))
	_box(Vector3(130, 0.2, 60), Vector3(0, -0.1, 50), Materials.surface("brushed_concrete", (look.apron as Color).darkened(0.18), 6.0))
	# the terminal's floor
	var fl: Array = look.get("floor", ["marble_tiles", Color(0.92, 0.92, 0.94) if not night else Color(0.55, 0.5, 0.65)])
	_box(Vector3(96, 0.12, 56), Vector3(0, 0.0, -2), Materials.pbr(String(fl[0]), fl[1], 3.0, 0.5))
	# the forecourt plaza and the road
	_box(Vector3(120, 0.12, 18), Vector3(0, 0.0, 35), Materials.pbr("floor_tiles_06", Color(0.8, 0.8, 0.82) if not night else Color(0.6, 0.52, 0.75), 2.5))
	_box(Vector3(260, 0.1, 14), Vector3(0, 0.02, 51), Materials.pbr("asphalt_02", Color(0.5, 0.5, 0.52) if not night else Color(0.22, 0.2, 0.26), 6.0, 0.6))
	for x in range(-120, 121, 12):
		_box(Vector3(5, 0.04, 0.25), Vector3(x, 0.09, 51), _mat(Color(0.95, 0.95, 0.9)))
	_box(Vector3(120, 0.4, 0.5), Vector3(0, 0.2, 44), _mat(Color(0.6, 0.6, 0.62)))   # kerb

# --------------------------------------------------------------------------------------------- the terminal
func _terminal() -> void:
	var frame := _mat(look.get("frame", Color(0.78, 0.8, 0.84) if not night else Color(0.2, 0.2, 0.26)), 0.35, 0.8)
	var glass := _glass(look.get("glass", Color(0.55, 0.75, 0.95) if not night else Color(0.5, 0.3, 0.8)))
	var wall := _wall_mat()
	# the facade (z 26): a glass curtain wall on mullions, open at the doors (x -7..7)
	for side in [-1.0, 1.0]:
		var cx: float = side * 27.5
		_box(Vector3(41, WALL_H, 0.3), Vector3(cx, WALL_H * 0.5, 26), glass, null, true)
		for k in 8:
			_box(Vector3(0.35, WALL_H, 0.5), Vector3(side * (7.0 + k * 5.8), WALL_H * 0.5, 26), frame)
	_box(Vector3(14, WALL_H - 4.5, 0.3), Vector3(0, 4.5 + (WALL_H - 4.5) * 0.5, 26), glass)
	_box(Vector3(14.4, 0.5, 0.6), Vector3(0, 4.4, 26), frame)
	# the side walls and the back (airside) wall
	_box(Vector3(0.4, WALL_H, 56), Vector3(-48, WALL_H * 0.5, -2), glass, null, true)
	for k in 10:
		_box(Vector3(0.5, WALL_H, 0.35), Vector3(-48, WALL_H * 0.5, -29 + k * 6.2), frame)
	# east wall: solid with the apron door at z -22..-15
	_box(Vector3(0.4, WALL_H, 41), Vector3(48, WALL_H * 0.5, 5.5), wall, null, true)
	_box(Vector3(0.4, WALL_H, 8), Vector3(48, WALL_H * 0.5, -26), wall, null, true)
	_box(Vector3(0.4, WALL_H - 4.5, 7), Vector3(48, 4.5 + (WALL_H - 4.5) * 0.5, -18.5), wall)
	_box(Vector3(0.6, 0.3, 7.2), Vector3(48, 4.4, -18.5), _glow(accent2, 2.0))
	_text("APRON  ·  HANGARS  →", Vector3(47.6, 5.4, -18.5), 72, accent2, -PI * 0.5)
	_text("← APRON  ·  HANGARS", Vector3(48.4, 5.4, -18.5), 72, accent2, PI * 0.5)
	_box(Vector3(96, WALL_H, 0.4), Vector3(0, WALL_H * 0.5, -30), glass, null, true)
	for k in 16:
		_box(Vector3(0.35, WALL_H, 0.5), Vector3(-45 + k * 6.0, WALL_H * 0.5, -30), frame)
	# the roof: a wave over the whole hall, the light ceiling under it, neon at its edges
	_roof(frame)
	# the solid parts in the airport's own material: a plinth under the glass, a fascia band under the roof, corner pylons
	for z in [26.3, -30.3]:
		_box(Vector3(97, 1.2, 0.7), Vector3(0, 0.6, z), wall)
		_box(Vector3(97, 1.6, 0.8), Vector3(0, WALL_H - 0.4, z), wall)
	for x in [-48.3, 48.3]:
		_box(Vector3(0.7, 1.2, 57), Vector3(x, 0.6, -2), wall)
		_box(Vector3(0.8, 1.6, 57), Vector3(x, WALL_H - 0.4, -2), wall)
	for c in [Vector3(-48.5, 0, 26.5), Vector3(48.5, 0, 26.5), Vector3(-48.5, 0, -30.5), Vector3(48.5, 0, -30.5)]:
		_box(Vector3(3.2, WALL_H + 1.5, 3.2), c + Vector3(0, (WALL_H + 1.5) * 0.5, 0), wall, null, true)
		_box(Vector3(3.3, 0.25, 3.3), c + Vector3(0, WALL_H + 1.4, 0), _glow(accent, 2.5))
	# the name over the doors
	var a: Dictionary = Air.AIRPORTS[code]
	# under the canopy, over the doors
	_box(Vector3(40, 4.4, 0.8), Vector3(0, 10.6, 26.7), _mat(Color(0.06, 0.07, 0.1), 0.3, 0.7))
	_text(String(a.city).to_upper(), Vector3(0, 11.5, 27.2), 280, accent.lerp(Color.WHITE, 0.55))
	_text("%s (%s)" % [String(a.name).trim_prefix(String(a.city) + " ").to_upper(), code], Vector3(0, 9.6, 27.2), 140, Color(0.92, 0.95, 1.0))
	_box(Vector3(40, 0.2, 0.3), Vector3(0, 8.3, 27.1), _glow(accent, 3.0))
	_box(Vector3(40, 0.2, 0.3), Vector3(0, 12.9, 27.1), _glow(accent, 3.0))
	_text("DEPARTURES ↑  ·  ARRIVALS", Vector3(0, 5.6, 26.5), 90, accent2)
	# the control tower on the airside, west
	var tx := Vector3(-110, 0, -40)
	_cyl(4.5, 52, tx + Vector3(0, 26, 0), frame, null, 3.2)
	_cyl(8.5, 5.0, tx + Vector3(0, 54.5, 0), _glass(accent.lerp(Color.WHITE, 0.3)), null, 9.5)
	_cyl(9.6, 0.6, tx + Vector3(0, 51.8, 0), _glow(accent, 3.0))
	_cyl(10.2, 0.6, tx + Vector3(0, 57.3, 0), frame)
	_cyl(0.3, 8, tx + Vector3(0, 61.5, 0), frame)
	var beacon := OmniLight3D.new()
	beacon.position = tx + Vector3(0, 55, 0)
	beacon.light_color = accent
	beacon.light_energy = 2.0 if night else 0.6
	beacon.omni_range = 30
	world.add_child(beacon)

## the terminal's solid walls in the airport's own material (LOOKS "walls"): plaster, sandstone, ice, timber, basalt, steel
func _wall_mat() -> Material:
	match String(look.get("walls", "plaster")):
		"sandstone":
			return Materials.pbr("brick_4", look.wall, 3.0)
		"ice":
			var m: StandardMaterial3D = _mat(Color(0.72, 0.88, 1.0), 0.08, 0.15).duplicate()
			m.emission_enabled = true
			m.emission = Color(0.35, 0.6, 0.85)
			m.emission_energy_multiplier = 0.35
			return m
		"timber":
			return Materials.pbr("brown_planks_03", look.wall, 2.0)
		"basalt":
			return Materials.surface("brushed_concrete", Color(0.12, 0.11, 0.11), 2.0, 0.9)
		"steel":
			return Materials.surface("metal_plate", look.wall, 2.0, 0.5, 0.8)
	return Materials.pbr("painted_plaster_wall", look.wall, 3.0)

## the roof's height over the hall at z
func _roof_y(z: float) -> float:
	return _roof_t(inverse_lerp(31.0, -34.0, z))

## the roof's silhouette across the hall (t 0 forecourt edge .. 1 airside edge), one per airport (LOOKS "roof"):
##   wave      Nexus / Neon: a long wave with a ripple (the references' sweeping canopy)
##   tent      Azure Isles: three white tensile peaks
##   vault     Frostveil: one high ice vault
##   terraces  Solara: flat sandstone terraces stepping up to the middle
##   sawtooth  Obsidian Reach: industrial north-light sheds
##   shards    the Shattered Expanse: broken, uneven slabs
##   gull      Thalassia Coast: two wings lifting off a low spine
func _roof_t(t: float) -> float:
	match String(look.get("roof_shape", "wave")):
		"tent":
			return WALL_H + 0.3 + 9.0 * pow(absf(sin(PI * 3.0 * t)), 1.6)
		"vault":
			return WALL_H + 0.3 + 13.0 * sqrt(maxf(0.0, 1.0 - pow(2.0 * t - 1.0, 2.0)))
		"terraces":
			return WALL_H + 1.2 + (3.4 if t > 0.3 and t < 0.7 else 0.0) + (1.8 if t > 0.12 and t < 0.88 else 0.0)
		"sawtooth":
			return WALL_H + 0.3 + 6.0 * fmod(t * 4.0, 1.0)
		"shards":
			var k := floorf(t * 6.0)
			return WALL_H + 0.3 + (2.5 + 5.0 * absf(sin(k * 2.3 + 0.7))) * (0.6 + 0.4 * fmod(t * 6.0, 1.0))
		"gull":
			return WALL_H + 0.3 + 8.0 * pow(absf(2.0 * t - 1.0), 0.8) + 1.0
	return WALL_H + 0.3 + 7.5 * sin(PI * t) + 1.6 * sin(PI * 3.0 * t)

func _roof(frame: Material) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 60
	var x0 := -52.0
	var x1 := 52.0
	for i in n:
		var t0 := float(i) / n
		var t1 := float(i + 1) / n
		var z0 := lerpf(31.0, -34.0, t0)
		var z1 := lerpf(31.0, -34.0, t1)
		var y0 := _roof_t(t0)
		var y1 := _roof_t(t1)
		var a := Vector3(x0, y0, z0)
		var b := Vector3(x1, y0, z0)
		var c := Vector3(x1, y1, z1)
		var d := Vector3(x0, y1, z1)
		for v in [a, b, c, a, c, d]:
			st.set_uv(Vector2(v.x / 8.0, v.z / 8.0))
			st.add_vertex(v)
	# the gable ends: from the wall top up to the curve
	for x in [x0 * 0.925, x1 * 0.925]:
		for i in n:
			var t0 := float(i) / n
			var t1 := float(i + 1) / n
			var z0 := lerpf(31.0, -34.0, t0)
			var z1 := lerpf(31.0, -34.0, t1)
			var y0 := _roof_t(t0)
			var y1 := _roof_t(t1)
			if z0 > 26.0 or z1 < -30.0:
				continue
			for v in [Vector3(x, WALL_H, z0), Vector3(x, y0, z0), Vector3(x, y1, z1), Vector3(x, WALL_H, z0), Vector3(x, y1, z1), Vector3(x, WALL_H, z1)]:
				st.set_uv(Vector2(v.z / 8.0, v.y / 8.0))
				st.add_vertex(v)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m: StandardMaterial3D = _mat(look.roof, 0.25 if look == LOOKS.desert else 0.4, 0.85 if look == LOOKS.desert else 0.55).duplicate()   # Solara's roof is solar panels
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	world.add_child(mi)
	# the ceiling seen from the hall: the same wave 0.4 m lower, facing down, in pale timber slats (lit softly, so the hall
	# isn't a dark lid under the sun)
	var cs := SurfaceTool.new()
	cs.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in n:
		var t0 := float(i) / n
		var t1 := float(i + 1) / n
		var z0 := lerpf(26.0, -30.0, t0)
		var z1 := lerpf(26.0, -30.0, t1)
		var y0 := _roof_y(z0) - 0.4
		var y1 := _roof_y(z1) - 0.4
		var a := Vector3(-48, y0, z0)
		var b := Vector3(48, y0, z0)
		var c := Vector3(48, y1, z1)
		var d := Vector3(-48, y1, z1)
		for v in [a, c, b, a, d, c]:
			cs.set_uv(Vector2(v.x / 3.0, v.z / 3.0))
			cs.add_vertex(v)
	cs.generate_normals()
	var ceil := MeshInstance3D.new()
	ceil.mesh = cs.commit()
	var ceil_col: Color = look.get("ceil", Color(0.94, 0.95, 0.97) if not night else Color(0.3, 0.2, 0.42))
	var cm2: StandardMaterial3D = _mat(ceil_col, 0.7, 0.1).duplicate()
	cm2.emission_enabled = true
	cm2.emission = ceil_col.lightened(0.05) if not night else Color(0.4, 0.22, 0.6)
	cm2.emission_energy_multiplier = 0.55 if not night else 0.4
	cm2.cull_mode = BaseMaterial3D.CULL_DISABLED
	ceil.material_override = cm2
	ceil.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(ceil)
	# light strips along the ceiling and the neon edge of the canopy
	for k in 6:
		var z := 20.0 - k * 9.0
		_box(Vector3(80, 0.12, 0.7), Vector3(0, _roof_y(z) - 0.5, z), _glow(Color(1.0, 0.97, 0.9) if not night else accent.lerp(Color.WHITE, 0.4), 1.6))
	_box(Vector3(104, 0.3, 0.3), Vector3(0, WALL_H + 0.45, 31.0), _glow(accent, 4.0))
	_box(Vector3(104, 0.3, 0.3), Vector3(0, WALL_H + 0.45, -34.0), _glow(accent2, 3.0))

# --------------------------------------------------------------------------------------------- the forecourt
func _forecourt() -> void:
	# walls closing the forecourt off from the airstrip (the way airside is through security)
	for side in [-1.0, 1.0]:
		_box(Vector3(0.4, 3.0, 54), Vector3(side * 60.0, 1.5, 53), _mat(Color(0.3, 0.32, 0.36), 0.5, 0.5), null, true)
		_box(Vector3(152, 3.0, 0.4), Vector3(side * 124.0, 1.5, 26.0), _mat(Color(0.32, 0.34, 0.36), 0.6, 0.6), null, true)
	_box(Vector3(120, 3.0, 0.4), Vector3(0, 1.5, 80), _mat(Color(0.3, 0.32, 0.36), 0.5, 0.5), null, true)
	# the globe fountain: a round basin, jets, the holographic globe over it
	var fc := Vector3(-30, 0, 36)
	_cyl(6.5, 0.8, fc + Vector3(0, 0.4, 0), _mat(Color(0.7, 0.72, 0.76), 0.3, 0.4), null, -1, 32)
	_cyl(6.0, 0.1, fc + Vector3(0, 0.82, 0), _glow(accent.lerp(Color(0.2, 0.5, 1.0), 0.5), 0.8), null, -1, 32)
	obstacles.append(AABB(fc - Vector3(6.5, 0, 6.5), Vector3(13, 0.8, 13)))
	for k in 6:
		var a := k * TAU / 6.0
		_cyl(0.18, 3.0, fc + Vector3(cos(a) * 4.2, 2.3, sin(a) * 4.2), _glow(Color(0.6, 0.85, 1.0), 1.6), null, 0.04, 6)
	var globe := Fx.hologram("globe", accent.lerp(Color(0.3, 0.8, 1.0), 0.4), 6.0)
	globe.position = fc + Vector3(0, 0.8, 0)
	world.add_child(globe)
	# palms in planters along the plaza and the road
	for x in [-50.0, -38.0, -14.0, 14.0, 26.0, 38.0, 50.0]:
		_palm(Vector3(x, 0, 30.5), int(x))
		_palm(Vector3(x + 6.0, 0, 56.5), int(x) + 3)
	# the wayfinding sign on the kerb (the references' big board)
	var sg := Node3D.new()
	sg.position = Vector3(30, 0, 41.5)
	static_root.add_child(sg)
	_box(Vector3(0.3, 4.5, 0.3), Vector3(-2.2, 2.25, 0), _mat(Color(0.3, 0.3, 0.32), 0.4, 0.8), sg)
	_box(Vector3(0.3, 4.5, 0.3), Vector3(2.2, 2.25, 0), _mat(Color(0.3, 0.3, 0.32), 0.4, 0.8), sg)
	_box(Vector3(5.2, 3.0, 0.25), Vector3(0, 4.6, 0), _mat(Color(0.05, 0.06, 0.1), 0.3, 0.5), sg)
	_box(Vector3(5.3, 0.08, 0.3), Vector3(0, 6.1, 0), _glow(accent, 3.0), sg)
	_text("Departures  ↑\nArrivals  ↑\nCheck-in · Tickets  ↑\nShops · Duty Free  ↑\nGates · Hangars  ↑\n(weapons not permitted)", Vector3(0, 4.6, 0.16), 34, Color(0.95, 0.97, 1.0), 0.0, sg)
	_text("NO WEAPONS BEYOND THIS POINT", Vector3(0, 3.0, 26.4), 60, Color(1.0, 0.45, 0.35))
	# a car at the kerb and a shuttle back to the street
	var car: Node3D = _model("res://models/fleet/luxury-sedan.glb") if Phone.tier() == "high" else null   # 34 surfaces: HIGH only
	if car:
		StreetCar.face_forward(car)
		car.position = Vector3(-8, 0.1, 48)
		car.rotation.y = PI * 0.5
		static_root.add_child(car)
	_spot("exit", ("EXIT · %s ON FOOT" % String(Air.AIRPORTS[code].city).to_upper()) if in_region else "CITY SHUTTLE · BACK TO THE STREET", Vector3(8, 0, 43.0))
	_box(Vector3(3.2, 0.1, 1.6), Vector3(8, 3.2, 43.0), _mat(Color(0.2, 0.22, 0.25), 0.4, 0.5))
	_box(Vector3(2.6, 0.5, 0.06), Vector3(8, 2.75, 43.6), _glow(accent2, 2.4))
	_text("EXIT · %s" % String(Air.AIRPORTS[code].city).to_upper() if in_region else "CITY SHUTTLE", Vector3(8, 3.8, 43.0), 64, accent2, 0.0, null, true)

func _palm(at: Vector3, seed: int) -> void:
	if String(look.tree) == "":
		return   # nothing grows here (Obsidian Reach, the Shattered Expanse)
	var p := _model("res://models/foliage/%s.glb" % look.tree) if look.tree != "palm" else _model("res://models/foliage/palm-%s.glb" % ["a", "b", "c"][posmod(seed, 3)])
	_cyl(1.0, 0.7, at + Vector3(0, 0.35, 0), _mat(Color(0.5, 0.52, 0.55), 0.6, 0.3), null, 1.1)
	obstacles.append(AABB(at - Vector3(1.0, 0, 1.0), Vector3(2.0, 0.7, 2.0)))
	if p:
		p.position = at + Vector3(0, 0.6, 0)
		p.rotation.y = seed * 1.7
		static_root.add_child(p)

# --------------------------------------------------------------------------------------------- check-in and the board
func _checkin() -> void:
	var desk := _mat(Color(0.95, 0.95, 0.97) if not night else Color(0.12, 0.12, 0.16), 0.25, 0.3)
	# two check-in islands along the west side, the ticket desk at the first
	for i in 2:
		var z := 16.0 - i * 13.0
		_box(Vector3(2.0, 1.1, 10.0), Vector3(-32, 0.55, z), desk, null, true)
		_box(Vector3(2.1, 0.1, 10.1), Vector3(-32, 1.12, z), _glow(accent, 1.2))
		_box(Vector3(0.3, 3.6, 10.0), Vector3(-35.5, 1.8, z), _mat(Color(0.08, 0.09, 0.12), 0.4, 0.4), null, true)
		_box(Vector3(0.2, 1.4, 9.0), Vector3(-35.3, 3.0, z), _glow(accent.lerp(Color(0.1, 0.1, 0.2), 0.5), 1.0))
		_text("CHECK-IN · %s" % ("TICKETS" if i == 0 else "BAG DROP"), Vector3(-35.1, 3.0, z), 80, Color(0.95, 0.97, 1.0), PI * 0.5)
		# queue posts
		for k in 4:
			_cyl(0.06, 1.0, Vector3(-28.5, 0.5, z - 4.0 + k * 2.6), _mat(Color(0.7, 0.7, 0.72), 0.2, 0.9), null, -1, 8)
	_spot("tickets", "TICKETS · BUY A FLIGHT", Vector3(-29.8, 0, 16.0), 3.6)
	# the departures board over the security line, both faces
	for face in [1.0, -1.0]:
		var bz: float = SECURITY_Z + face * 0.2
		_box(Vector3(24, 6.4, 0.3), Vector3(0, 9.6, SECURITY_Z), _mat(Color(0.02, 0.025, 0.05), 0.3, 0.4))
		var l := _text("", Vector3(-11.4, 9.6, bz + face * 0.05), 46, Color(1.0, 0.85, 0.35), 0.0 if face > 0 else PI)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
		l.width = 2400
		l.autowrap_mode = TextServer.AUTOWRAP_OFF
		if face < 0:
			l.position.x = 11.4
		_board_labels.append(l)
	_box(Vector3(24.4, 0.15, 0.4), Vector3(0, 12.9, SECURITY_Z), _glow(accent, 3.0))
	_feature(Vector3(-6, 0, 15.5))
	# seating in the hall
	for k in 4:
		_bench(Vector3(-10.0 + (k % 2) * 20.0 - 6.0, 0, 12.0 + float(k / 2) * 7.0), 0.0)

func _bench(at: Vector3, yaw: float) -> void:
	var g := Node3D.new()
	g.position = at
	g.rotation.y = yaw
	static_root.add_child(g)
	var seat := _mat(Color(0.15, 0.17, 0.22) if not night else Color(0.25, 0.12, 0.3), 0.5, 0.2)
	for k in 5:
		_box(Vector3(0.6, 0.12, 0.6), Vector3(-1.4 + k * 0.7, 0.48, 0), seat, g)
		_box(Vector3(0.6, 0.6, 0.1), Vector3(-1.4 + k * 0.7, 0.8, -0.3), seat, g)
	_box(Vector3(3.6, 0.08, 0.12), Vector3(0, 0.38, 0), _mat(Color(0.7, 0.7, 0.72), 0.25, 0.9), g)
	obstacles.append(AABB(at - Vector3(1.8, 0, 0.4), Vector3(3.6, 0.9, 0.8)) if absf(yaw) < 0.1 else AABB(at - Vector3(0.4, 0, 1.8), Vector3(0.8, 0.9, 3.6)))

# --------------------------------------------------------------------------------------------- the shops
func _shops() -> void:
	for s in SHOPS:
		var id := String(s[0])
		var z: float = s[2]
		var col: Color = s[3]
		var g := Node3D.new()
		g.position = Vector3(40, 0, z)
		static_root.add_child(g)
		# the unit: back and side walls, a lit front band with the name, a counter and shelves inside
		_box(Vector3(0.3, 6, 8.6), Vector3(7.8, 3, 0), _mat(Color(0.12, 0.12, 0.15), 0.6), g, false)
		for zz in [-4.3, 4.3]:
			_box(Vector3(16, 6, 0.3), Vector3(0, 3, zz), _mat(Color(0.85, 0.86, 0.9) if not night else Color(0.14, 0.13, 0.18), 0.5), g)
			obstacles.append(AABB(g.position + Vector3(-8, 0, zz - 0.15), Vector3(16, 6, 0.3)))
		_box(Vector3(0.4, 1.2, 8.6), Vector3(-8.0, 6.6, 0), _mat(Color(0.05, 0.05, 0.07), 0.3, 0.6), g)
		_box(Vector3(0.1, 0.12, 8.4), Vector3(-8.25, 6.0, 0), _glow(col, 3.0), g)
		_text(String(s[1]), Vector3(-8.3, 6.6, 0), 90, col.lerp(Color.WHITE, 0.3), -PI * 0.5, g)
		_box(Vector3(1.2, 1.0, 4.0), Vector3(1.0, 0.5, 0), _mat(Color(0.9, 0.9, 0.92) if not night else Color(0.1, 0.1, 0.14), 0.3, 0.3), g)
		obstacles.append(AABB(g.position + Vector3(0.4, 0, -2.0), Vector3(1.2, 1.0, 4.0)))
		for k in 3:
			_box(Vector3(0.5, 3.2, 2.2), Vector3(6.8, 1.6, -2.6 + k * 2.6), _mat(Color(0.2, 0.2, 0.24), 0.5, 0.3), g)
			for sh in 3:
				_box(Vector3(0.45, 0.35, 1.8), Vector3(6.4, 0.7 + sh * 0.95, -2.6 + k * 2.6), _glow(col.lerp(Color(0.9, 0.9, 0.9), 0.5), 0.35 + 0.2 * sh), g)
		_spot(id, ("ENTER " if id != "cafe" else "ORDER AT ") + String(s[1]), Vector3(31.0, 0, z), 3.4)

# --------------------------------------------------------------------------------------------- security
func _security() -> void:
	var rail := _mat(Color(0.6, 0.62, 0.66), 0.25, 0.9)
	var post := _mat(Color(0.12, 0.13, 0.16), 0.4, 0.5)
	# the line: a glass screen across the hall but the three lanes
	var edges: Array[float] = [-48.0]
	for x in LANES:
		edges.append(x - 1.4)
		edges.append(x + 1.4)
	edges.append(48.0)
	for i in range(0, edges.size(), 2):
		var a: float = edges[i]
		var b: float = edges[i + 1]
		_box(Vector3(b - a, 2.4, 0.2), Vector3((a + b) * 0.5, 1.2, SECURITY_Z), _glass(Color(0.7, 0.8, 0.9)), null, true)
		_box(Vector3(b - a, 0.08, 0.25), Vector3((a + b) * 0.5, 2.42, SECURITY_Z), rail)
	for x in LANES:
		# the scanner arch and the lane gate
		_box(Vector3(0.3, 2.6, 1.0), Vector3(x - 1.3, 1.3, SECURITY_Z), post)
		_box(Vector3(0.3, 2.6, 1.0), Vector3(x + 1.3, 1.3, SECURITY_Z), post)
		_box(Vector3(2.9, 0.4, 1.0), Vector3(x, 2.8, SECURITY_Z), post)
		_box(Vector3(2.6, 0.08, 0.9), Vector3(x, 2.58, SECURITY_Z), _glow(Color(0.3, 1.0, 0.5), 2.0))
		_box(Vector3(1.0, 0.9, 2.6), Vector3(x + 2.3, 0.45, SECURITY_Z + 2.4), post)       # the bag belt
		_box(Vector3(0.9, 0.05, 2.5), Vector3(x + 2.3, 0.92, SECURITY_Z + 2.4), _mat(Color(0.05, 0.05, 0.05), 0.9))
		var bar := Node3D.new()
		bar.set_meta("dynamic", true)
		bar.position = Vector3(x - 1.1, 0.9, SECURITY_Z + 0.4)
		world.add_child(bar)
		_box(Vector3(2.2, 0.12, 0.12), Vector3(1.1, 0, 0), _glow(Color(1.0, 0.3, 0.25), 2.0), bar)
		_lane_bars.append(bar)
		_lane_gates.append(obstacles.size())
		obstacles.append(AABB())
	_text("SECURITY · BOARDING PASS OR HANGAR PASS · NO WEAPONS", Vector3(0, 3.6, SECURITY_Z + 0.3), 64, Color(0.95, 0.97, 1.0))

# --------------------------------------------------------------------------------------------- the gates
func _gates() -> void:
	var desk := _mat(Color(0.12, 0.13, 0.16), 0.3, 0.5)
	for i in Air.GATES.size():
		var g := String(Air.GATES[i])
		var x := -40.0 + i * 16.0
		_box(Vector3(3.2, 1.1, 1.0), Vector3(x, 0.55, -26.5), desk, null, true)
		_box(Vector3(3.3, 0.08, 1.1), Vector3(x, 1.12, -26.5), _glow(accent, 1.4))
		_box(Vector3(3.6, 1.4, 0.2), Vector3(x, 4.4, -29.6), _mat(Color(0.03, 0.03, 0.06), 0.3, 0.4))
		_text("GATE %s" % g, Vector3(x, 4.4, -29.45), 110, accent2)
		_spot("gate:" + g, "GATE %s · BOARD" % g, Vector3(x, 0, -24.6), 3.0)
		# an airliner at every other gate (a real gate pitch is ~45 m: wingtips overlap at 16), staggered so they clear,
		# its jet bridge swung out to the front door; the empty gates' bridges stand parked against the terminal
		var jb := _mat(Color(0.75, 0.77, 0.8) if not night else Color(0.22, 0.22, 0.28), 0.4, 0.7)
		var glazing := _glow(accent.lerp(Color(0.6, 0.8, 1.0), 0.4), 0.8)
		var parked := i % 2 == 0
		var px := x + 4.0
		var pz := -66.0 - (6.0 if i % 4 == 2 else 0.0)
		var door := Vector3(px + 2.25, 0, pz + 14.4) if parked else Vector3(x + 1.0, 0, -40.0)
		var from := Vector3(x, 0, -30.4)
		var span := Vector2(door.x - from.x, door.z - from.z)
		var bridge := Node3D.new()
		bridge.position = Vector3((from.x + door.x) * 0.5, 4.4, (from.z + door.z) * 0.5)
		bridge.rotation.y = atan2(-span.x, -span.y)
		static_root.add_child(bridge)
		_box(Vector3(2.7, 2.7, span.length()), Vector3.ZERO, jb, bridge)
		_box(Vector3(2.76, 0.5, span.length() - 0.6), Vector3(0, 0.45, 0), glazing, bridge)
		_box(Vector3(2.9, 0.12, span.length()), Vector3(0, 1.42, 0), _glow(accent, 1.4), bridge)
		_box(Vector3(3.4, 3.1, 2.4), Vector3(0, 0, -span.length() * 0.5), jb, bridge)       # the cab at the door
		# the drive leg with its wheels, under the cab
		var leg := door + Vector3(0, 0, 0) - Vector3(span.x, 0, span.y).normalized() * 2.0
		_box(Vector3(0.5, 3.0, 0.5), leg + Vector3(0, 1.5, 0), jb)
		_box(Vector3(2.4, 0.6, 1.0), leg + Vector3(0, 0.4, 0), _mat(Color(0.12, 0.12, 0.14), 0.7))
		if parked:
			var plane := _airliner(accent if i % 4 == 0 else accent2, String(look.airline))
			plane.position = Vector3(px, 0, pz)
			plane.rotation.y = PI     # nose to the terminal
			static_root.add_child(plane)
			obstacles.append(AABB(Vector3(px - 2.6, 0, pz - 20.0), Vector3(5.2, 7.0, 40.0)))      # fuselage
			obstacles.append(AABB(Vector3(px - 17.5, 0, pz - 6.0), Vector3(35.0, 4.0, 9.0)))      # wings and engines
	for k in 6:
		_bench(Vector3(-36.0 + k * 14.4, 0, -14.0), 0.0)
		_bench(Vector3(-36.0 + k * 14.4, 0, -19.0), PI)

## an airliner, procedural (no airliner model in the fleet yet): white fuselage, swept wings, two engines, tail in the
## airline's colour; nose toward -z, ~40 m long, wheels at y 0
func _airliner(tail: Color, name: String, wide := false) -> Node3D:
	# the authored airliner (scripts/build-airliner.py; `wide` is the ~62 m long-haul), repainted in the airline's colour;
	# the shapes below if it's missing
	var model := _model("res://models/fleet/airliner-wide.glb" if wide else "res://models/fleet/airliner.glb")
	var k := 1.55 if wide else 1.0
	if model:
		var wrap := Node3D.new()
		wrap.add_child(model)
		var paint := _mat(tail, 0.35, 0.15)
		for c in model.find_children("*", "MeshInstance3D", true, false):
			var mi := c as MeshInstance3D
			for i in mi.mesh.get_surface_count():
				var m := mi.mesh.surface_get_material(i)
				if m and m.resource_name == "Livery":
					mi.set_surface_override_material(i, paint)
		for side in [-1.0, 1.0]:
			var l := Label3D.new()
			l.text = name
			l.font_size = 130
			l.pixel_size = 0.01 * k
			l.modulate = tail.darkened(0.2)
			l.position = Vector3(side * 2.08, 4.25, -6.0) * k
			l.rotation.y = side * PI * 0.5
			l.double_sided = false
			wrap.add_child(l)
		return wrap
	var p := Node3D.new()
	var body := _mat(Color(0.95, 0.96, 0.98), 0.3, 0.2)
	var dark := _mat(Color(0.1, 0.12, 0.16), 0.2, 0.4)
	var tailm: StandardMaterial3D = _glow(tail, 0.9 if night else 0.25).duplicate()
	tailm.albedo_color = tail
	var fus := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 2.3
	cap.height = 40.0
	cap.radial_segments = 20
	cap.rings = 6
	fus.mesh = cap
	fus.material_override = body
	fus.rotation.x = PI * 0.5
	fus.position = Vector3(0, 4.2, 0)
	p.add_child(fus)
	_box(Vector3(4.66, 0.5, 30), Vector3(0, 4.9, 0), dark, p)                # the window band
	_box(Vector3(4.7, 0.25, 32), Vector3(0, 3.7, 0), tailm, p)              # cheat line
	for side in [-1.0, 1.0]:
		var w := Node3D.new()
		w.position = Vector3(side * 2.0, 3.2, 1.5)
		w.rotation.y = side * deg_to_rad(-28.0)
		p.add_child(w)
		_box(Vector3(17.0, 0.45, 5.0), Vector3(side * 8.5, 0, 0), body, w)
		_box(Vector3(0.4, 1.4, 1.2), Vector3(side * 17.0, 0.6, 1.0), tailm, w)     # winglet
		_cyl(1.25, 4.2, Vector3(side * 6.5, -1.4, -1.5), body, w).rotation.x = PI * 0.5
		_cyl(1.0, 0.1, Vector3(side * 6.5, -1.4, -3.65), dark, w).rotation.x = PI * 0.5
		var hs := Node3D.new()
		hs.position = Vector3(side * 1.2, 5.0, 17.0)
		hs.rotation.y = side * deg_to_rad(-30.0)
		p.add_child(hs)
		_box(Vector3(6.0, 0.3, 2.6), Vector3(side * 3.0, 0, 0), body, hs)
		_cyl(0.25, 3.2, Vector3(side * 2.0, 1.6, 2.0), dark, p)                # main gear
	var fin := Node3D.new()
	fin.position = Vector3(0, 6.2, 17.5)
	fin.rotation.x = deg_to_rad(-35.0)
	p.add_child(fin)
	_box(Vector3(0.45, 8.0, 4.5), Vector3(0, 3.6, 0), tailm, fin)
	_cyl(0.22, 2.4, Vector3(0, 1.2, -15.5), dark, p)                            # nose gear
	_box(Vector3(2.6, 0.7, 0.2), Vector3(0, 5.6, -19.6), dark, p)              # cockpit glass
	for side in [-1.0, 1.0]:
		var l := Label3D.new()
		l.text = name
		l.font_size = 140
		l.pixel_size = 0.01
		l.modulate = tail.darkened(0.15)
		l.position = Vector3(side * 2.36, 4.5, -4.0)
		l.rotation.y = side * PI * 0.5
		l.double_sided = false
		p.add_child(l)
	return p

# --------------------------------------------------------------------------------------------- the airstrip
func _airstrip() -> void:
	var asphalt := Materials.pbr("asphalt_02", Color(0.35, 0.35, 0.37) if not night else Color(0.14, 0.13, 0.17), 8.0, 0.7)
	var paint := _mat(Color(0.96, 0.96, 0.94), 0.6)
	var yellow := _mat(Color(0.95, 0.75, 0.15), 0.6)
	_box(Vector3(900, 0.06, 46), Vector3(0, 0.04, RUNWAY_Z), asphalt)
	for x in range(-420, 421, 30):
		_box(Vector3(14, 0.03, 0.8), Vector3(x, 0.08, RUNWAY_Z), paint)
	for side in [-1.0, 1.0]:
		_box(Vector3(900, 0.03, 0.6), Vector3(0, 0.08, RUNWAY_Z + side * 21.5), paint)
		for k in 8:   # threshold bars
			_box(Vector3(30, 0.03, 1.4), Vector3(side * 380.0, 0.08, RUNWAY_Z - 14.0 + k * 4.0), paint)
	_text("27R", Vector3(-340, 0.12, RUNWAY_Z), 1600, Color(0.96, 0.96, 0.94)).rotation = Vector3(-PI * 0.5, 0, PI * 0.5)
	_text("09L", Vector3(340, 0.12, RUNWAY_Z), 1600, Color(0.96, 0.96, 0.94)).rotation = Vector3(-PI * 0.5, 0, -PI * 0.5)
	# the taxiway and its centre line, a lead-in to every gate
	_box(Vector3(500, 0.05, 24), Vector3(40, 0.05, -100), asphalt)
	_box(Vector3(500, 0.03, 0.4), Vector3(40, 0.09, -100), yellow)
	for i in Air.GATES.size():
		_box(Vector3(0.4, 0.03, 30), Vector3(-34.0 + i * 16.0, 0.09, -73), yellow)
	# edge lights (glowing studs; no real lights)
	var stud := _glow(Color(0.35, 0.65, 1.0) if night else Color(1.0, 1.0, 0.95), 3.0 if night else 1.0)
	var green := _glow(Color(0.3, 1.0, 0.45), 2.6)
	for x in range(-420, 421, 20):
		for side in [-1.0, 1.0]:
			_box(Vector3(0.4, 0.25, 0.4), Vector3(x, 0.12, RUNWAY_Z + side * 23.5), stud)
		_box(Vector3(0.3, 0.2, 0.3), Vector3(x + 10, 0.12, -100), green)
	# the apron's own paint: hangar lead-ins and a helipad
	for x in HANGAR_X:
		_box(Vector3(0.4, 0.03, 70), Vector3(x, 0.09, -50), yellow)
	var hp := Vector3(-170, 0, 6)     # west of the terminal (the cargo terminal has the east apron)
	_cyl(11, 0.06, hp + Vector3(0, 0.07, 0), _mat(Color(0.25, 0.27, 0.3), 0.7), null, -1, 32)
	_cyl(10, 0.04, hp + Vector3(0, 0.1, 0), _glow(Color(1.0, 0.85, 0.2), 0.6), null, 9.6, 32)
	_text("H", hp + Vector3(0, 0.14, 0), 1200, Color(0.96, 0.96, 0.94)).rotation.x = -PI * 0.5
	var heli := _craft_model("rift-helicopter", 14.0)
	heli.position = hp
	heli.rotation.y = 0.6
	static_root.add_child(heli)
	obstacles.append(AABB(hp - Vector3(4, 0, 7), Vector3(8, 4, 14)))
	# ground equipment and cargo dollies by the gates
	for k in 10:
		var at := Vector3(-44.0 + k * 9.5, 0, -52.0 - (k % 3) * 2.0)
		_box(Vector3(2.0, 1.2, 3.0), at + Vector3(0, 0.75, 0), _mat(Color(0.95, 0.95, 0.92) if k % 2 == 0 else Color(0.9, 0.7, 0.15), 0.5, 0.2))
		_box(Vector3(1.9, 0.3, 2.9), at + Vector3(0, 0.15, 0), _mat(Color(0.08, 0.08, 0.08), 0.8))
	# the long-haul wide-body on a remote stand west of the gates
	var wb := _airliner(accent, String(look.airline), true)
	wb.position = Vector3(-172, 0, -64)
	wb.rotation.y = -PI * 0.5     # nose to +x
	static_root.add_child(wb)
	obstacles.append(AABB(Vector3(-204, 0, -68), Vector3(64, 9, 8)))       # fuselage
	obstacles.append(AABB(Vector3(-182, 0, -92), Vector3(18, 5, 56)))      # wings and engines
	# apron floodlight masts: a lit head on each (glow only) and a real light on a few
	var mast := _mat(Color(0.45, 0.46, 0.5), 0.4, 0.8)
	var head := _glow(Color(1.0, 0.95, 0.85) if not night else Color(0.85, 0.75, 1.0), 4.0)
	var lit := 0
	for at in [Vector3(-60, 0, -45), Vector3(0, 0, -48), Vector3(60, 0, -45), Vector3(104, 0, -26), Vector3(140, 0, -26), Vector3(176, 0, -26), Vector3(200, 0, -60)]:
		_cyl(0.3, 22, at + Vector3(0, 11, 0), mast, null, 0.2, 8)
		_box(Vector3(3.0, 0.6, 1.2), at + Vector3(0, 22.2, 0), head)
		obstacles.append(AABB(at - Vector3(0.4, 0, 0.4), Vector3(0.8, 22, 0.8)))
		if night and lit < 4 and at.x > 90.0:
			var o := OmniLight3D.new()
			o.position = at + Vector3(0, 18, -4)
			o.omni_range = 40.0
			o.light_energy = 2.2
			o.light_color = Color(0.9, 0.85, 1.0)
			world.add_child(o)
			lit += 1
	# the airliner on the runway (always rolling, for life)
	_taxi = _airliner(accent2, String(look.airline), true)
	_taxi.rotation.y = -PI * 0.5
	world.add_child(_taxi)

func _step_taxi(dt: float) -> void:
	if not _taxi:
		return
	_taxi_t = fmod(_taxi_t + dt, 60.0)
	var t := _taxi_t
	var x := -420.0 + 3.2 * t * t
	var y := 0.0 if t < 12.0 else pow(t - 12.0, 2.0) * 1.4
	_taxi.visible = t < 30.0 and _landing.is_empty()
	_taxi.position = Vector3(x, y, RUNWAY_Z + 8.0)
	_taxi.rotation.z = 0.0 if t < 12.0 else -minf(0.16, (t - 12.0) * 0.05)

# --------------------------------------------------------------------------------------------- the hangars
func _hangars() -> void:
	var shell := Materials.surface("metal_plate", look.get("hangar", Color(0.78, 0.8, 0.84) if not night else Color(0.26, 0.26, 0.34)), 3.0, 0.7, 0.75)
	for i in HANGAR_X.size():
		var bay := String(Air.BAYS[i])
		var cx: float = HANGAR_X[i]
		# the shell: sides, back, a barrel roof; the door (z -14) a shutter that lifts when it's yours
		for side in [-1.0, 1.0]:
			_box(Vector3(0.5, 10, 30), Vector3(cx + side * 14.0, 5, 1), shell, null, true)
		_box(Vector3(28.5, 10, 0.5), Vector3(cx, 5, 16), shell, null, true)
		var roof := _cyl(15.0, 30.0, Vector3(cx, 10, 1), shell, null, -1, 24)
		roof.rotation.x = PI * 0.5
		roof.scale = Vector3(1.0, 1.0, 0.35)
		_box(Vector3(28.5, 2.0, 0.6), Vector3(cx, 11.0, -14.2), _mat(Color(0.06, 0.07, 0.1), 0.3, 0.6))
		_text("PRIVATE HANGAR %s" % bay, Vector3(cx, 11.0, -14.6), 120, accent2, PI)
		_box(Vector3(28.5, 0.15, 0.3), Vector3(cx, 10.0, -14.55), _glow(accent, 3.0))
		# inside: floor paint, work benches, the target range at the back
		_box(Vector3(27, 0.03, 28), Vector3(cx, 0.06, 1), _mat(Color(0.32, 0.34, 0.38) if not night else Color(0.16, 0.15, 0.2), 0.3, 0.3))
		_box(Vector3(26, 0.04, 0.3), Vector3(cx, 0.09, 10.5), _mat(Color(1.0, 0.35, 0.2), 0.5))
		_box(Vector3(1.0, 1.0, 6.0), Vector3(cx - 12.5, 0.5, 4.0), _mat(Color(0.25, 0.25, 0.3), 0.5, 0.5), null, true)
		var lamp := OmniLight3D.new()
		lamp.position = Vector3(cx, 8.5, 1)
		lamp.omni_range = 18.0
		lamp.light_energy = 1.2
		lamp.light_color = Color(1.0, 0.95, 0.85)
		world.add_child(lamp)
		var sh := Node3D.new()
		sh.set_meta("dynamic", true)
		sh.position = Vector3(cx, 4.5, -14.3)
		world.add_child(sh)
		_box(Vector3(27.5, 9.0, 0.3), Vector3.ZERO, Materials.surface("metal_plate", Color(0.55, 0.57, 0.6) if not night else Color(0.22, 0.22, 0.28), 4.0, 0.5, 0.7), sh)   # one slab (the plate texture is the ribbing): 12 slat boxes were 12 draws a door

		_shutters[bay] = { "node": sh, "idx": obstacles.size() }
		obstacles.append(AABB())
		_spot("hangar:" + bay, "HANGAR %s" % bay, Vector3(cx + 9.0, 0, -17.0), 3.4)
		_spot("craft:" + bay, "YOUR AIRCRAFT", Vector3(cx - 10.0, 0, 4.0), 2.8)

func _craft_model(id: String, length: float) -> Node3D:
	var root := Node3D.new()
	var m := _model("res://models/fleet/%s.glb" % id)
	if not m:
		return root
	StreetCar.face_forward(m)
	root.add_child(m)
	var aabb := AABB()
	var first := true
	for c in m.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var t := Transform3D.IDENTITY
		var n: Node = mi
		while n != root and n is Node3D:
			t = (n as Node3D).transform * t
			n = n.get_parent()
		var a := t * mi.get_aabb()
		aabb = a if first else aabb.merge(a)
		first = false
	if not first:
		var k := length / maxf(0.01, maxf(aabb.size.z, aabb.size.x))
		m.scale *= k
		m.position = m.position * k - Vector3(0, aabb.position.y * k, 0)
	return root

# --------------------------------------------------------------------------------------------- the city behind and the people
func _skyline() -> void:
	if String(look.skyline) == "":
		return
	var files := ["nexus-spire", "nexus-civic-a", "nexus-civic-b", "nexus-civic-c", "nexus-terrace-a", "nexus-terrace-b"] if not night else \
		["neon-tower-a", "neon-tower-b", "neon-tower-c", "neon-v-A", "neon-v-B", "neon-v-C"]
	var rng := RandomNumberGenerator.new()
	rng.seed = 7 if night else 3
	for k in (14 if Phone.tier() == "high" else 8):
		var f: String = files[k % files.size()]
		var m := _model("res://models/buildings/%s.glb" % f)
		if not m:
			continue
		var x := -560.0 + k * (80.0 if Phone.tier() == "high" else 140.0) + rng.randf_range(-20, 20)
		m.position = Vector3(x, 0, -480.0 - rng.randf_range(0, 200))
		m.rotation.y = rng.randf_range(0, TAU)
		var s := rng.randf_range(2.2, 3.4)
		m.scale = Vector3(s, s * rng.randf_range(1.0, 1.6), s)
		static_root.add_child(m)
		# stand it on the ground whatever the model's origin
		var low := INF
		for c in m.find_children("*", "MeshInstance3D", true, false):
			var mi := c as MeshInstance3D
			var b: AABB = mi.global_transform * mi.get_aabb()
			low = minf(low, b.position.y)
		if low < INF:
			m.position.y -= low

func _people() -> void:
	var n := Phone.crowd()
	# landside hall, the forecourt and the gate lounge
	var specs := [[-2.0, 24.0, 10.0, 8.0, 41], [-28.0, -6.0, 14.0, 10.0, 43], [28.0, 42.0, 20.0, 14.0, 47]]
	for s in specs:
		var c: MultiMeshInstance3D = Crowd.new()
		world.add_child(c)
		c.setup(int(36 * n), float(s[0]), float(s[1]), float(s[2]), float(s[3]), int(s[4]))
		_crowds.append(c)

# --------------------------------------------------------------------------------------------- what stands round a region's airport
func _extras() -> void:
	var ex: Array = look.extras
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(code)
	if "ocean" in ex:
		# an island: the land stops short of the runway ends, which run out over the lagoon on piers
		(_land.mesh as PlaneMesh).size = Vector2(760, 620)
		_land.position = Vector3(0, -0.25, -120)
		var sea := MeshInstance3D.new()
		var pm := PlaneMesh.new()
		pm.size = Vector2(6000, 6000)
		sea.mesh = pm
		var w := StandardMaterial3D.new()
		w.albedo_color = Color(0.0, 0.4, 0.58)
		w.metallic = 0.4
		w.roughness = 0.06
		sea.material_override = w
		sea.position = Vector3(0, -0.7, -300)
		sea.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		world.add_child(sea)
		var shallows := MeshInstance3D.new()
		var sp := PlaneMesh.new()
		sp.size = Vector2(840, 700)
		shallows.mesh = sp
		shallows.material_override = _mat(Color(0.1, 0.62, 0.66), 0.1, 0.2)
		shallows.position = Vector3(0, -0.5, -120)
		world.add_child(shallows)
		for side in [-1.0, 1.0]:   # the runway's pier ends
			for k in 5:
				_cyl(1.2, 3.0, Vector3(side * (390.0 + k * 8.0), -1.5, RUNWAY_Z), _mat(Color(0.7, 0.7, 0.68), 0.6))
	if "seaplanes" in ex:
		var pier := Vector3(392, 0, -20)
		_box(Vector3(80, 0.5, 5), pier + Vector3(40, 0.1, 0), Materials.pbr("brown_planks_03", Color(0.9, 0.85, 0.75), 4.0))
		for k in 9:
			_cyl(0.3, 2.4, pier + Vector3(5.0 + k * 9.0, -1.0, 2.6), _mat(Color(0.4, 0.32, 0.25), 0.8), null, -1, 8)
			_cyl(0.3, 2.4, pier + Vector3(5.0 + k * 9.0, -1.0, -2.6), _mat(Color(0.4, 0.32, 0.25), 0.8), null, -1, 8)
		_text("SEAPLANE TERMINAL", pier + Vector3(6, 4.5, 0), 120, accent2, 0.0, null, true)
		for k in 3:
			var sp := _airliner(accent if k != 1 else accent2, String(look.airline))
			sp.scale = Vector3.ONE * 0.32
			sp.position = pier + Vector3(25.0 + k * 22.0, -0.3, 10.0 if k % 2 == 0 else -10.0)
			sp.rotation.y = PI * 0.5
			for side in [-1.0, 1.0]:   # floats
				var f := _cyl(0.6, 9.0, Vector3(side * 2.4, 0.4, 0), _mat(Color(0.95, 0.95, 0.95), 0.3), sp)
				f.rotation.x = PI * 0.5
			static_root.add_child(sp)
	if "resorts" in ex:
		for k in 7:
			var at := Vector3(-330.0 + k * 22.0, 0, -320.0 - (k % 3) * 18.0)
			var h := rng.randf_range(10, 26)
			_box(Vector3(18, h, 12), at + Vector3(0, h * 0.5, 0), _mat(Color(0.97, 0.97, 0.95), 0.5))
			for f in int(h / 3.2):
				_box(Vector3(18.2, 0.35, 12.2), at + Vector3(0, 2.2 + f * 3.2, 0), _mat(Color(0.2, 0.75, 0.75), 0.2, 0.3))
			_palm(at + Vector3(12, 0, 8), k)
		for k in 30:   # palms all over the island
			var at := Vector3(rng.randf_range(-360, 360), 0, rng.randf_range(-400, 170))
			if absf(at.z - RUNWAY_Z) < 40.0 or (at.z > -110.0 and at.z < 30.0 and at.x > -130.0 and at.x < 230.0) or (absf(at.x) < 70.0 and at.z > 20.0):
				continue
			_palm(at, k + 11)
	if "mountains" in ex:
		var rock := _mat(Color(0.45, 0.5, 0.58), 0.9)
		var snowcap := _mat(Color(0.95, 0.97, 1.0), 0.6)
		for k in 16:
			var a := -PI * 0.15 - k * PI * 0.7 / 15.0 - PI * 0.5
			var r := rng.randf_range(900, 1300)
			var at := Vector3(cos(a) * r, 0, sin(a) * r)
			var h := rng.randf_range(260, 520)
			var base := rng.randf_range(220, 380)
			_cyl(base, h, at + Vector3(0, h * 0.5, 0), rock, null, 0.0, 9).rotation.y = rng.randf() * TAU
			_cyl(base * 0.42, h * 0.42, at + Vector3(0, h * 0.79, 0), snowcap, null, 0.0, 9).rotation.y = rng.randf() * TAU
		for k in 40:   # pines in the snow beyond the fences
			var at := Vector3(rng.randf_range(-420, 420), 0, rng.randf_range(-440, 200))
			if absf(at.z - RUNWAY_Z) < 45.0 or (at.z > -120.0 and at.z < 30.0 and at.x > -140.0 and at.x < 230.0) or (absf(at.x) < 70.0 and at.z > 20.0):
				continue
			_palm(at, k)
	if "snow" in ex:
		_snow = CPUParticles3D.new()
		_snow.set_meta("dynamic", true)
		_snow.amount = int(900 * Phone.crowd()) + 200
		_snow.lifetime = 6.0
		_snow.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
		_snow.emission_box_extents = Vector3(45, 2, 45)
		_snow.direction = Vector3(0.3, -1, 0.1)
		_snow.spread = 12.0
		_snow.gravity = Vector3(0.4, -1.2, 0)
		_snow.initial_velocity_min = 1.2
		_snow.initial_velocity_max = 2.4
		_snow.local_coords = false
		var q := QuadMesh.new()
		q.size = Vector2(0.07, 0.07)
		var qm := StandardMaterial3D.new()
		qm.albedo_color = Color(1, 1, 1, 0.9)
		qm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		qm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		q.material = qm
		_snow.mesh = q
		world.add_child(_snow)
		# snow drifts along the walls and on the hangar roofs
		for x in HANGAR_X:
			_box(Vector3(26, 0.6, 12), Vector3(x, 15.0, 1), _mat(Color(0.97, 0.98, 1.0), 0.7))
		_box(Vector3(120, 0.5, 2.0), Vector3(0, 0.25, 79), _mat(Color(0.97, 0.98, 1.0), 0.7))
	if "dunes" in ex:
		var sand := _mat(Color(0.8, 0.58, 0.34), 0.95)
		for k in 26:
			var a := rng.randf() * TAU
			var r := rng.randf_range(520, 1400)
			var d := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 1.0
			sm.height = 2.0
			d.mesh = sm
			d.material_override = sand
			d.position = Vector3(cos(a) * r, -4.0, sin(a) * r - 150.0)
			d.scale = Vector3(rng.randf_range(80, 200), rng.randf_range(14, 40), rng.randf_range(40, 110))
			d.rotation.y = rng.randf() * TAU
			static_root.add_child(d)
		var mesa := _mat(Color(0.72, 0.4, 0.25), 0.95)
		for k in 7:
			var a := -PI * 0.5 + rng.randf_range(-1.2, 1.2)
			var r := rng.randf_range(900, 1500)
			var h := rng.randf_range(90, 180)
			var w := rng.randf_range(120, 260)
			_cyl(w, h, Vector3(cos(a) * r, h * 0.5, sin(a) * r), mesa, null, w * 0.82, 10)
	if "solar" in ex:
		# solar fields beside the forecourt and along the apron fence
		var panel := _mat(Color(0.06, 0.1, 0.24), 0.15, 0.85)
		var frame := _mat(Color(0.75, 0.75, 0.78), 0.4, 0.8)
		for row in 6:
			for side in [-1.0, 1.0]:
				var at := Vector3(side * (90.0 + row * 9.0), 1.4, 52.0)
				var p := _box(Vector3(5.0, 0.12, 40.0), at, panel)
				p.rotation.z = -0.45
				_box(Vector3(0.2, 1.4, 40.0), at + Vector3(0, -0.8, 0), frame)
		for k in 14:   # the gold-sandstone trim on the terminal's long walls
			_box(Vector3(0.5, 1.2, 0.5), Vector3(-45.0 + k * 7.0, WALL_H + 0.6, 26.4), _mat(Color(0.95, 0.75, 0.4), 0.5, 0.4))

	if "subdock" in ex:
		# the submarine dock: a glass dome on the water at the pier's end, a skiff alongside, the way down to Thalassia
		var dock := Vector3(500, 0, -20)
		var dome := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 16.0
		sm.height = 16.0
		sm.is_hemisphere = true
		dome.mesh = sm
		dome.material_override = _glass(Color(0.4, 0.85, 1.0))
		dome.position = dock + Vector3(0, -0.5, 0)
		static_root.add_child(dome)
		_cyl(16.6, 0.6, dock + Vector3(0, -0.3, 0), _glow(accent, 2.5), null, -1, 40)
		_cyl(3.0, 22.0, dock + Vector3(0, -11.0, 0), _glow(Color(0.2, 0.7, 1.0), 0.8), null, -1, 16)
		_text("THALASSIA · THE CITY UNDER THE SEA ↓", dock + Vector3(0, 20, 0), 140, accent2, 0.0, null, true)
		var sub := _craft_model("hydro-sub-skiff", 12.0)
		sub.position = dock + Vector3(-24, -0.6, 14)
		sub.rotation.y = PI * 0.5
		static_root.add_child(sub)
	if "volcano" in ex:
		var basalt := _mat(Color(0.1, 0.09, 0.09), 0.95)
		var glow := _glow(Color(1.0, 0.35, 0.05), 4.0)
		for k in 3:
			var at := Vector3(-700.0 + k * 650.0, 0, -1100.0 - k * 120.0)
			var h := 380.0 - k * 60.0
			_cyl(420.0 - k * 50.0, h, at + Vector3(0, h * 0.5, 0), basalt, null, 70.0, 12)
			_cyl(64.0, 6.0, at + Vector3(0, h + 1.0, 0), glow, null, 52.0, 12)
			var smoke := CPUParticles3D.new()
			smoke.set_meta("dynamic", true)
			smoke.position = at + Vector3(0, h + 10.0, 0)
			smoke.amount = 40
			smoke.lifetime = 14.0
			smoke.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
			smoke.emission_sphere_radius = 40.0
			smoke.direction = Vector3(0.3, 1, 0)
			smoke.spread = 20.0
			smoke.gravity = Vector3(2.0, 3.0, 0)
			smoke.initial_velocity_min = 6.0
			smoke.initial_velocity_max = 12.0
			smoke.scale_amount_min = 1.0
			smoke.scale_amount_max = 2.2
			var q := QuadMesh.new()
			q.size = Vector2(70, 70)
			var qm := StandardMaterial3D.new()
			qm.albedo_texture = Fx._dot()
			qm.albedo_color = Color(0.12, 0.1, 0.1, 0.55)
			qm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			qm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
			q.material = qm
			smoke.mesh = q
			world.add_child(smoke)
		var lava_light := OmniLight3D.new()
		lava_light.position = Vector3(0, 60, -700)
		lava_light.omni_range = 700.0
		lava_light.light_energy = 1.5
		lava_light.light_color = Color(1.0, 0.4, 0.1)
		world.add_child(lava_light)
	if "lava" in ex:
		# lava channels across the black land beyond the fences, and glowing cracks
		var lava := _glow(Color(1.0, 0.38, 0.05), 3.5)
		for river in 2:
			var z0 := -320.0 - river * 160.0
			var prev := Vector3(-700, 0.05, z0)
			for k in range(1, 30):
				var x := -700.0 + k * 50.0
				var p := Vector3(x, 0.05, z0 + sin(k * 0.55 + river * 2.0) * 50.0)
				var mid := (prev + p) * 0.5
				var seg := _box(Vector3((p - prev).length() + 2.0, 0.15, 7.0 - river * 2.0), mid, lava)
				seg.rotation.y = -atan2(p.z - prev.z, p.x - prev.x)
				prev = p
		for k in 30:
			var at := Vector3(rng.randf_range(-450, 450), 0.05, rng.randf_range(150, 300) * (1 if k % 2 == 0 else -1))
			if at.z < 0.0 and at.z > -200.0:
				continue
			var c := _box(Vector3(rng.randf_range(10, 40), 0.1, 0.6), at, lava)
			c.rotation.y = rng.randf() * PI
	if "cargo" in ex:
		# container stacks and the heavy-lift airship on the cargo apron
		var cols := [Color(0.75, 0.3, 0.12), Color(0.2, 0.35, 0.55), Color(0.85, 0.65, 0.15), Color(0.3, 0.32, 0.34)]
		for k in 24:
			var at := Vector3(184.0 + (k % 4) * 7.0, 1.4 + float(k / 12) * 2.8, -4.0 + float((k / 4) % 3) * 3.2)
			_box(Vector3(6.1, 2.6, 2.5), at, _mat(cols[k % cols.size()], 0.6, 0.4))
		obstacles.append(AABB(Vector3(180, 0, -6), Vector3(30, 6, 10)))
		var ship := _craft_model("leviathan", 46.0)
		ship.position = Vector3(30, 22, -125)
		ship.rotation.y = PI * 0.5
		static_root.add_child(ship)
		_text("HEAVY CARGO · MINING · NO PASSENGERS", Vector3(198, 9, -8), 90, accent2, PI, null, true)
	if "crystals" in ex:
		var col: Color = accent
		# giant crystal spires out in the rifts (the set's clusters scaled up ×7), and smaller ones by the fences
		for c in [Vector3(-320, 0, -330), Vector3(300, 0, -320), Vector3(-330, 0, 120), Vector3(320, 0, 130), Vector3(0, 0, -360), Vector3(-160, 0, 240), Vector3(220, 0, 230)]:
			var big := Node3D.new()
			big.position = c
			big.scale = Vector3.ONE * 7.0
			world.add_child(big)
			FractureSet.crystals(big, Vector3.ZERO, 12.0, int(8 * Phone.crowd()) + 4, col, rng)
		for c in [Vector3(-75, 0, 50), Vector3(75, 0, 50), Vector3(-60, 0, -190), Vector3(240, 0, 20)]:
			var near := Node3D.new()
			near.position = c
			near.scale = Vector3.ONE * 1.2
			world.add_child(near)
			FractureSet.crystals(near, Vector3.ZERO, 8.0, 10, col, rng)
		# glowing rift cracks in the ground beyond the fences
		var rift := _glow(Color(0.75, 0.35, 1.0), 4.0)
		for k in 22:
			var at := Vector3(rng.randf_range(-450, 450), 0.06, rng.randf_range(-420, 260))
			if (at.z > -200.0 and at.z < 90.0 and absf(at.x) < 260.0):
				continue
			var c := _box(Vector3(rng.randf_range(20, 70), 0.1, rng.randf_range(0.6, 2.0)), at, rift)
			c.rotation.y = rng.randf() * PI
	if "ruins" in ex:
		for c in [Vector3(-260, 60, -380), Vector3(240, 80, -420), Vector3(0, 110, -600)]:
			var holder := Node3D.new()
			holder.position = c
			holder.scale = Vector3.ONE * 4.0
			world.add_child(holder)
			FractureSet.floating_ruins(holder, Vector3.ZERO, 22.0, int(10 * Phone.crowd()) + 4, rng)
	if "storm" in ex:
		_flash = DirectionalLight3D.new()
		_flash.rotation_degrees = Vector3(-60, 30, 0)
		_flash.light_color = Color(0.85, 0.8, 1.0)
		_flash.light_energy = 0.0
		_flash.shadow_enabled = false
		world.add_child(_flash)

## the check-in hall's centrepiece, one per airport (LOOKS "feature")
func _feature(at: Vector3) -> void:
	var kind := String(look.get("feature", "palms"))
	var basin := _mat(Color(0.75, 0.76, 0.8) if not night else Color(0.2, 0.2, 0.26), 0.3, 0.5)
	obstacles.append(AABB(at - Vector3(2.6, 0, 2.6), Vector3(5.2, 2.0, 5.2)))
	match kind:
		"palms":
			_cyl(2.5, 0.8, at + Vector3(0, 0.4, 0), basin, null, -1, 24)
			_cyl(2.3, 0.1, at + Vector3(0, 0.82, 0), _mat(Color(0.25, 0.2, 0.15), 0.9), null, -1, 24)
			var p := _model("res://models/foliage/palm-a.glb")
			if p:
				p.position = at + Vector3(0, 0.8, 0)
				p.scale = Vector3.ONE * 0.8
				static_root.add_child(p)
		"hologram":
			_cyl(2.5, 0.5, at + Vector3(0, 0.25, 0), basin, null, -1, 24)
			_cyl(2.2, 0.06, at + Vector3(0, 0.52, 0), _glow(accent, 3.0), null, -1, 24)
			var h := Fx.hologram("globe", accent2, 3.5)
			h.position = at + Vector3(0, 0.6, 0)
			world.add_child(h)
		"ice":
			_cyl(2.5, 0.4, at + Vector3(0, 0.2, 0), _mat(Color(0.9, 0.95, 1.0), 0.2, 0.2), null, -1, 24)
			var ice := Node3D.new()
			ice.position = at + Vector3(0, 0.4, 0)
			ice.scale = Vector3.ONE * 0.9
			world.add_child(ice)
			var rng := RandomNumberGenerator.new()
			rng.seed = 5
			FractureSet.crystals(ice, Vector3.ZERO, 1.6, 9, Color(0.6, 0.9, 1.0), rng)
		"fountain":
			_cyl(2.6, 0.7, at + Vector3(0, 0.35, 0), Materials.pbr("brick_4", look.wall, 1.0), null, -1, 24)
			_cyl(2.3, 0.08, at + Vector3(0, 0.72, 0), _glow(Color(0.3, 0.75, 1.0), 0.8), null, -1, 24)
			_cyl(0.35, 2.2, at + Vector3(0, 1.4, 0), Materials.pbr("brick_4", look.wall, 1.0))
			_cyl(1.2, 0.2, at + Vector3(0, 2.5, 0), _mat(Color(0.95, 0.75, 0.4), 0.3, 0.7), null, 0.9, 20)
		"aquarium":
			_cyl(2.5, 0.4, at + Vector3(0, 0.2, 0), basin, null, -1, 24)
			_cyl(2.3, 6.0, at + Vector3(0, 3.4, 0), _glass(Color(0.2, 0.7, 0.95)), null, -1, 24)
			_cyl(2.1, 5.8, at + Vector3(0, 3.4, 0), _glow(Color(0.0, 0.5, 0.6), 0.35), null, -1, 24)
			for k in 8:   # fish, as bright darts
				var f := _box(Vector3(0.5, 0.2, 0.12), at + Vector3(cos(k * 0.8) * 1.3, 1.2 + k * 0.6, sin(k * 0.8) * 1.3), _glow(Color(1.0, 0.6, 0.2) if k % 2 == 0 else Color(0.9, 0.9, 0.3), 1.6))
				f.rotation.y = k * 0.8
			_cyl(2.5, 0.4, at + Vector3(0, 6.6, 0), basin, null, -1, 24)
		"lava":
			_cyl(2.6, 0.6, at + Vector3(0, 0.3, 0), _mat(Color(0.08, 0.07, 0.07), 0.9), null, -1, 20)
			_cyl(2.1, 0.08, at + Vector3(0, 0.62, 0), _glow(Color(1.0, 0.38, 0.05), 4.0), null, -1, 20)
			_cyl(2.4, 2.4, at + Vector3(0, 1.9, 0), _glass(Color(0.9, 0.5, 0.3)), null, -1, 24)
			var o := OmniLight3D.new()
			o.position = at + Vector3(0, 1.5, 0)
			o.light_color = Color(1.0, 0.45, 0.15)
			o.light_energy = 1.5
			o.omni_range = 9.0
			world.add_child(o)
		"specimen":
			_cyl(2.4, 1.0, at + Vector3(0, 0.5, 0), _mat(Color(0.18, 0.18, 0.22), 0.4, 0.7), null, -1, 8)
			_cyl(2.0, 3.0, at + Vector3(0, 2.5, 0), _glass(Color(0.7, 0.5, 1.0)), null, -1, 24)
			var c := Node3D.new()
			c.position = at + Vector3(0, 1.0, 0)
			world.add_child(c)
			var rng := RandomNumberGenerator.new()
			rng.seed = 9
			FractureSet.crystals(c, Vector3.ZERO, 1.0, 6, accent, rng)
			_text("RIFT SPECIMEN\nDO NOT TOUCH", at + Vector3(0, 4.6, 0), 40, accent2, 0.0, null, true)

# --------------------------------------------------------------------------------------------- the VIP lounge
func _vip_lounge() -> void:
	var r := VIP
	var c := Vector3(r.position.x + r.size.x * 0.5, 0, r.position.y + r.size.y * 0.5)
	var glass := _glass(accent2.lerp(Color.WHITE, 0.4))
	var frame := _mat(Color(0.15, 0.13, 0.12), 0.3, 0.8)
	_box(Vector3(r.size.x, 0.14, r.size.y), c + Vector3(0, 0.02, 0), Materials.pbr("wood_floor", Color(0.7, 0.55, 0.42), 2.0, 0.6))
	for z in [r.position.y, r.end.y]:
		_box(Vector3(r.size.x, 5.0, 0.3), Vector3(c.x, 2.5, z), glass, null, true)
	for x in [r.position.x, r.end.x]:
		_box(Vector3(0.3, 5.0, r.size.y), Vector3(x, 2.5, c.z), glass, null, true)
	_box(Vector3(r.size.x + 0.6, 0.5, r.size.y + 0.6), c + Vector3(0, 5.2, 0), frame)
	_box(Vector3(r.size.x + 0.7, 0.12, 0.2), Vector3(c.x, 4.9, r.end.y + 0.2), _glow(accent2, 2.5))
	_text("VIP LOUNGE", Vector3(c.x, 6.2, r.end.y + 0.3), 110, accent2, 0.0, null, true)
	# the door from the gate lounge: the terminal's west wall at z -12 (in) and its way back (out)
	_spot("vip-in", "VIP LOUNGE", Vector3(-45.6, 0, -12.0), 2.6)
	_box(Vector3(0.5, 3.4, 3.0), Vector3(-47.6, 1.7, -12.0), _glow(accent2, 0.6))
	_spot("vip-out", "BACK TO THE GATES", Vector3(r.end.x - 2.0, 0, c.z + 7.0), 2.4)
	# sofas, low tables, the bar, a living wall
	var sofa := _mat(Color(0.3, 0.2, 0.16) if not night else Color(0.25, 0.12, 0.3), 0.7)
	for k in 3:
		var at := Vector3(r.position.x + 4.0 + k * 6.0, 0, r.position.y + 5.0)
		_box(Vector3(3.6, 0.45, 1.2), at + Vector3(0, 0.3, 0), sofa)
		_box(Vector3(3.6, 0.7, 0.3), at + Vector3(0, 0.75, -0.5), sofa)
		_box(Vector3(1.6, 0.4, 0.9), at + Vector3(0, 0.2, 1.6), _mat(Color(0.12, 0.1, 0.09), 0.3, 0.4))
		obstacles.append(AABB(at - Vector3(1.8, 0, 0.7), Vector3(3.6, 1.0, 3.2)))
	var bar := Vector3(c.x, 0, r.end.y - 3.0)
	_box(Vector3(9.0, 1.1, 1.0), bar + Vector3(0, 0.55, 0), _mat(Color(0.14, 0.12, 0.1), 0.3, 0.5), null, true)
	_box(Vector3(9.1, 0.08, 1.1), bar + Vector3(0, 1.12, 0), _glow(accent2, 1.2))
	_box(Vector3(9.0, 2.2, 0.3), Vector3(c.x, 1.9, r.end.y - 0.6), _mat(Color(0.2, 0.45, 0.22), 0.9))   # the living wall
	_spot("vip-bar", "VIP BAR · COMPLIMENTARY", bar + Vector3(0, 0, -1.6), 2.4)
	var lamp := OmniLight3D.new()
	lamp.position = c + Vector3(0, 4.2, 0)
	lamp.light_color = Color(1.0, 0.85, 0.65)
	lamp.light_energy = 1.4
	lamp.omni_range = 16.0
	world.add_child(lamp)

# --------------------------------------------------------------------------------------------- baggage claim
func _baggage_claim() -> void:
	var c := CAROUSEL
	var steel := _mat(Color(0.7, 0.72, 0.75), 0.25, 0.9)
	var belt := _mat(Color(0.08, 0.08, 0.09), 0.8)
	# a stadium-shaped carousel: two straights and two round ends
	_box(Vector3(8.0, 0.7, 3.6), c + Vector3(0, 0.35, 0), steel)
	_box(Vector3(8.0, 0.06, 2.8), c + Vector3(0, 0.72, 0), belt)
	for side in [-1.0, 1.0]:
		_cyl(1.8, 0.7, c + Vector3(side * 4.0, 0.35, 0), steel, null, -1, 20)
		_cyl(1.4, 0.06, c + Vector3(side * 4.0, 0.72, 0), belt, null, -1, 20)
	_box(Vector3(7.0, 0.3, 1.0), c + Vector3(0, 0.85, 0), steel)
	obstacles.append(AABB(c - Vector3(6.0, 0, 2.0), Vector3(12.0, 1.0, 4.0)))
	_box(Vector3(6.0, 1.3, 0.2), c + Vector3(0, 4.6, -2.5), _mat(Color(0.03, 0.03, 0.06), 0.3, 0.4))
	_text("BAGGAGE CLAIM · ARRIVALS", c + Vector3(0, 4.6, -2.38), 56, accent2)
	_text("BAGGAGE CLAIM · ARRIVALS", c + Vector3(0, 4.6, -2.62), 56, accent2, PI)
	var cols := [Color(0.12, 0.12, 0.14), Color(0.55, 0.12, 0.12), Color(0.15, 0.3, 0.55), Color(0.75, 0.6, 0.2), Color(0.3, 0.32, 0.35), Color(0.2, 0.45, 0.3)]
	for k in 12:
		var bag := Node3D.new()
		bag.set_meta("dynamic", true)
		world.add_child(bag)
		_box(Vector3(0.7, 0.45, 0.32), Vector3(0, 0.98, 0), _mat(cols[k % cols.size()], 0.6, 0.1), bag)
		_box(Vector3(0.2, 0.06, 0.05), Vector3(0, 1.24, 0), _mat(Color(0.1, 0.1, 0.1), 0.5), bag)
		_bags.append(bag)
	_step_bags(0.0)

## the suitcases go round the stadium at walking pace
func _step_bags(dt: float) -> void:
	if _bags.is_empty():
		return
	_bag_t += dt * 0.5
	var straight := 8.0
	var rr := 1.6
	var perim := straight * 2.0 + TAU * rr
	for k in _bags.size():
		var s := fposmod(_bag_t + k * perim / _bags.size(), perim)
		var p := Vector3.ZERO
		var yaw := 0.0
		if s < straight:
			p = Vector3(-straight * 0.5 + s, 0, rr)
		elif s < straight + PI * rr:
			var a := (s - straight) / rr
			p = Vector3(straight * 0.5 + sin(a) * rr, 0, cos(a) * rr)
			yaw = a
		elif s < straight * 2.0 + PI * rr:
			p = Vector3(straight * 0.5 - (s - straight - PI * rr), 0, -rr)
			yaw = PI
		else:
			var a := (s - straight * 2.0 - PI * rr) / rr
			p = Vector3(-straight * 0.5 - sin(a) * rr, 0, -cos(a) * rr)
			yaw = PI + a
		_bags[k].position = CAROUSEL + p
		_bags[k].rotation.y = yaw

# --------------------------------------------------------------------------------------------- travellers
## people standing about with luggage: the bag-drop queue, a crowd waiting round the carousel and at every gate
func _travellers() -> void:
	var spots: Array = []
	var bags: Array = []
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(code) + 3
	for k in 7:   # the bag-drop queue, facing the desk (-x)
		var at := Vector3(-27.6, 0, -0.5 + k * 1.15)
		spots.append([at, -PI * 0.5])
		bags.append(at + Vector3(0.1, 0, 0.5))
	for k in 9:   # round the carousel, facing it
		var a := k * TAU / 9.0 + 0.3
		var at := CAROUSEL + Vector3(cos(a) * 7.6, 0, sin(a) * 3.6)
		if at.z < 11.0:
			continue
		spots.append([at, atan2(CAROUSEL.x - at.x, CAROUSEL.z - at.z)])
	for g in Air.GATES.size():   # each gate: a few waiting by the windows
		var gx := -40.0 + g * 16.0
		for k in 3:
			var at := Vector3(gx + rng.randf_range(-5.0, 5.0), 0, -22.0 - rng.randf_range(0.0, 3.0))
			if absf(at.x - gx) < 2.2:
				at.x += 3.0
			spots.append([at, PI + rng.randf_range(-0.6, 0.6)])
			if k != 1:
				bags.append(at + Vector3(0.45, 0, 0.1))
	var crowd: MultiMeshInstance3D = Crowd.new()
	world.add_child(crowd)
	crowd.place(spots, 61)
	_crowds.append(crowd)
	# their wheeled cases, handles up
	var cols := [Color(0.12, 0.12, 0.14), Color(0.5, 0.1, 0.12), Color(0.14, 0.28, 0.52), Color(0.7, 0.58, 0.22), Color(0.35, 0.36, 0.4)]
	for k in bags.size():
		var at: Vector3 = bags[k]
		_box(Vector3(0.42, 0.62, 0.26), at + Vector3(0, 0.35, 0), _mat(cols[k % cols.size()], 0.55, 0.1))
		_box(Vector3(0.04, 0.5, 0.04), at + Vector3(0, 0.9, -0.08), _mat(Color(0.6, 0.6, 0.62), 0.3, 0.9))

# --------------------------------------------------------------------------------------------- the cargo terminal
## east of the hangars: a long shed with dock doors onto the apron, freight containers on dollies, a tug, trucks behind
func _cargo_terminal() -> void:
	var c := Vector3(222, 0, -40)
	var shed := Materials.surface("metal_plate", look.get("hangar", Color(0.78, 0.8, 0.84)), 3.0, 0.7, 0.75)
	_box(Vector3(44, 11, 24), c + Vector3(0, 5.5, 0), shed, null, true)
	_box(Vector3(44.6, 0.6, 24.6), c + Vector3(0, 11.2, 0), _mat(Color(0.25, 0.26, 0.28), 0.5, 0.6))
	for k in 4:   # dock doors facing the apron (-z)
		var dx := -15.0 + k * 10.0
		_box(Vector3(6.0, 6.0, 0.2), c + Vector3(dx, 3.0, -12.1), _mat(Color(0.32, 0.34, 0.38), 0.5, 0.7))
		_box(Vector3(6.2, 0.2, 0.3), c + Vector3(dx, 6.2, -12.15), _glow(accent2, 2.0))
		_box(Vector3(6.0, 1.2, 2.0), c + Vector3(dx, 0.6, -13.2), _mat(Color(0.2, 0.2, 0.22), 0.8), null, true)
	_box(Vector3(30, 2.2, 0.4), c + Vector3(0, 9.0, -12.3), _mat(Color(0.05, 0.06, 0.1), 0.3, 0.6))
	_text("CARGO TERMINAL", c + Vector3(0, 9.0, -12.55), 150, accent2, PI)
	# freight: containers on dollies in trains, a tug at the head of each
	var cols := [Color(0.75, 0.75, 0.78), Color(0.6, 0.62, 0.66), Color(0.85, 0.55, 0.15)]
	for train in 2:
		var z := c.z - 20.0 - train * 6.0
		_box(Vector3(2.4, 1.4, 1.8), Vector3(c.x - 20.0, 0.9, z), _mat(Color(0.9, 0.75, 0.15), 0.5, 0.2))   # the tug
		for k in 5:
			var at := Vector3(c.x - 16.0 + k * 3.4, 0, z)
			_box(Vector3(2.8, 0.25, 2.2), at + Vector3(0, 0.45, 0), _mat(Color(0.2, 0.2, 0.22), 0.6, 0.5))
			_box(Vector3(2.6, 1.6, 2.0), at + Vector3(0, 1.4, 0), _mat(cols[(k + train) % cols.size()], 0.4, 0.6))
		obstacles.append(AABB(Vector3(c.x - 21.5, 0, z - 1.2), Vector3(21.0, 2.3, 2.4)))
	# trucks backed up to the far side
	for k in 3:
		var t := Vector3(c.x - 14.0 + k * 14.0, 0, c.z + 18.0)
		_box(Vector3(2.5, 3.0, 10.0), t + Vector3(0, 2.1, 1.0), _mat(Color(0.92, 0.92, 0.94), 0.5, 0.2))
		_box(Vector3(2.5, 2.6, 2.8), t + Vector3(0, 1.9, -5.5), _mat(Color(0.2, 0.35, 0.6) if k != 1 else Color(0.7, 0.15, 0.12), 0.4, 0.4))
		_box(Vector3(2.6, 0.9, 13.0), t + Vector3(0, 0.45, -1.0), _mat(Color(0.08, 0.08, 0.08), 0.8))

# --------------------------------------------------------------------------------------------- transitions
## a full-screen veil in the airport's cloud colour: 0 clear .. 1 solid (the cruise's descent, the landing's first second)
func _fade_to(a: float) -> void:
	if not _fade:
		if a <= 0.0:
			return
		_fade = ColorRect.new()
		_fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_fade.color = Color(0.9, 0.92, 0.95) if not night else Color(0.12, 0.08, 0.2)
		add_child(_fade)
	_fade.color.a = a
	_fade.visible = a > 0.0
	move_child(_fade, get_child_count() - 1)

## a puff of rift dust at the touchdown point
func _dust(at: Vector3) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.position = at
	p.amount = 60
	p.lifetime = 2.5
	p.one_shot = false
	p.explosiveness = 0.2
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = Vector3(30, 0.5, 5)
	p.direction = Vector3(0, 1, 0)
	p.spread = 50.0
	p.gravity = Vector3(0, -0.5, 0)
	p.initial_velocity_min = 2.0
	p.initial_velocity_max = 6.0
	p.scale_amount_min = 1.5
	p.scale_amount_max = 4.0
	var q := QuadMesh.new()
	q.size = Vector2(1.6, 1.6)
	var m := StandardMaterial3D.new()
	m.albedo_texture = Fx._dot()
	m.albedo_color = Color(accent.r * 0.6 + 0.3, accent.g * 0.5 + 0.3, accent.b * 0.6 + 0.3, 0.45)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	q.material = m
	p.mesh = q
	world.add_child(p)
	return p
