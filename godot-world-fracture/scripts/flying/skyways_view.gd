extends Control
const Progression := preload("res://scripts/progress/progression.gd")
const Sound := preload("res://scripts/audio/sound.gd")
## Skyways (asset catalog gap 3: vehicles beyond cars): fly the Rift-Jumper helicopter or the Resonant Strike jet, sail the
## Scrap-Iron patrol boat or dive the Hydro-Sub skiff over the exported Nexus City (region_3d.gd in PLAY mode), with the
## web game's handling rules (vehicle_handling.gd). Aircraft start on the Nexus airport apron, watercraft at the seaport.
## A ring course hangs over the city for aircraft (and lies along the water for boats): fly through all eight, the clock
## stops, the prize is Nex / XP into the profile. Buildings are solid (region building boxes): hitting one at speed is a
## crash that costs hull; running out of hull puts the craft back on its pad. Phone controls: the stick is throttle /
## steer, UP climbs (jets need takeoff speed first), DOWN descends; EXIT ends the flight when landed.

signal closed
## a hangar aircraft set down and left in another region that has an airport (world flight): that airport's code
signal arrived(code: String)

const Phone := preload("res://scripts/phone.gd")
const Region3D := preload("res://scripts/region_3d.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Handling := preload("res://scripts/driving/vehicle_handling.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const Facility := preload("res://scripts/garage/facility.gd")
const GarageState := preload("res://scripts/garage/garage_state.gd")
const Geo := preload("res://scripts/nav/world_geo.gd")
const Gps := preload("res://scripts/nav/gps.gd")
const REGION := "nexus"
const FLEET := "res://models/fleet/"
## the craft on offer: hull file, handling kind, display name, where it starts (poi), fleet speed multiplier
const CRAFT := {
	"rift-helicopter": { "name": "Rift-Jumper Attack Helicopter", "kind": "HELI", "poi": "nexus-airport", "length": 14.0 },
	"vanguard-jet": { "name": "F-39 Jupiter", "kind": "JET", "poi": "nexus-airport", "length": 17.0 },
	"leviathan": { "name": "Leviathan Cargo Airship", "kind": "AIRSHIP", "poi": "nexus-airport", "length": 42.0 },
	"scrap-patrol-boat": { "name": "Scrap-Iron Patrol Boat", "kind": "BOAT", "poi": "seaport:nexus", "length": 11.0 },
	"hydro-sub-skiff": { "name": "Nautilus Abyss-01", "kind": "SUB", "poi": "seaport:nexus", "length": 9.0 },
	# the owner's vehicle roster boards (Nov 15), made in Meshy (tools/vehicle_set.py); the jet and the sub above hold the
	# board's F-39 Jupiter and Nautilus Abyss models under their old ids
	"skyhawk": { "name": "Skyhawk", "kind": "JET", "poi": "nexus-airport", "length": 8.3, "model": "craft/skyhawk.glb" },
	"riftwing": { "name": "Riftwing", "kind": "JET", "poi": "nexus-airport", "length": 14.0, "model": "craft/riftwing.glb" },
	"solara-falcon": { "name": "Solara Falcon", "kind": "JET", "poi": "nexus-airport", "length": 15.0, "model": "craft/solara-falcon.glb" },
	"void-skimmer": { "name": "Void-Skimmer Prototype", "kind": "JET", "poi": "nexus-airport", "length": 14.0 },
	"thunderbolt-a7": { "name": "Thunderbolt A-7", "kind": "JET", "poi": "nexus-airport", "length": 16.0, "model": "craft/thunderbolt-a7.glb" },
	"valkyrie-vtol": { "name": "Valkyrie VTOL-MkII", "kind": "HELI", "poi": "nexus-airport", "length": 17.5, "model": "craft/valkyrie-vtol.glb" },
	"horizon-dropship": { "name": "Horizon Dropship", "kind": "HELI", "poi": "nexus-airport", "length": 20.0, "model": "craft/horizon-dropship.glb" },
	"nimbus-cargo": { "name": "Nimbus Cargo", "kind": "JET", "poi": "nexus-airport", "length": 30.0, "model": "craft/nimbus-cargo.glb" },
	"starliner-shuttle": { "name": "Starliner Shuttle", "kind": "JET", "poi": "nexus-airport", "length": 37.0, "model": "craft/starliner-shuttle.glb" },
	"corsair-speedboat": { "name": "Corsair Speedboat", "kind": "BOAT", "poi": "seaport:nexus", "length": 12.0, "model": "craft/corsair-speedboat.glb" },
	"leviathan-yacht": { "name": "Leviathan Yacht", "kind": "BOAT", "poi": "seaport:nexus", "length": 45.0, "model": "craft/leviathan-yacht.glb" },
	"abyssal-carrier": { "name": "Abyssal Carrier", "kind": "BOAT", "poi": "seaport:nexus", "length": 60.0, "model": "craft/abyssal-carrier.glb" },
	"deepfin-explorer": { "name": "Deepfin Explorer", "kind": "SUB", "poi": "seaport:nexus", "length": 10.0, "model": "craft/deepfin-explorer.glb" },
}

## a craft's model file (its own `model` under the fleet folder, else <id>.glb)
static func model_of(id: String) -> String:
	return FLEET + String(CRAFT[id].get("model", id + ".glb"))
const RINGS := 8
const RING_R := 9.0

var craft_id := ""
## the region flown over (an owned aircraft from a Neon City hangar flies over Neon City); the start is its airport if it has one
var region_id := REGION
var region: Control
var controls: Control
var hull: Node3D
var cam: Camera3D
var profile: Dictionary
var state: Handling.State
var top_speed := 62.0
var pad := Vector3.ZERO
var hull_hp := 1.0

## the region is lit for night (its style), where the craft's fill light is turned up
func region_night() -> bool:
	return region != null and region.is_night()

## the half-width of where a boat or sub may go (the region's water); aircraft have no limit (owner, Nov 18: the
## airspace edge "removed completely") — the region's sea and ground skirt travel with them instead
func airspace_half() -> float:
	if String(profile.mode) == "AIR":
		return INF
	return region.span() * 0.5 - 10.0
## how much of a crash / a hard landing the hull takes (Airframe Finish / Landing Gear at the Aviation Hangar)
var hull_take := 1.0
var land_take := 1.0
var rings: Array = []          # [{pos, node, hit}]
var next_ring := 0
var clock := 0.0
var finished := false
var _paid := false
var _picker: Control
var _hud: Label
var _boxes: Array[AABB] = []
var _cam_yaw := 0.0
var _prompt_t := 0.0
var _gear: Node3D          # the jets' undercarriage (none of the Meshy jets model one): down on the pad, folded in flight
var _gear_k := 1.0         # 1 down, 0 folded away
var _gear_wheels: Array[Node3D] = []
var _touch_puff: CPUParticles3D
var _was_airborne := false
var look_dev := Vector3.ZERO   # a fixed camera offset for the shot hook (zero: the chase camera)
## an aircraft out of your own hangar (airport_view _fly_craft): it takes off with its saved condition and tank
## (airport.gd upkeep), burns fuel with the throttle and brings both back to the profile when you land or wreck it
var from_hangar := false
var fuel := 100.0
var _fuel_warned := false
var _upkeep_saved := false
const Air := preload("res://scripts/airport/airport.gd")

# ------------------------------------------------------------------ world flight (owner, Nov 18: "fly around the world")
## Aircraft fly off their region and on round the planet (world_geo.gd puts every region map on the globe). The view
## works in one region's frame at a time (its anchor: a point on the sphere); flying into another region's reach
## (ARRIVE) builds that region under you and carries your place and heading into its frame; well clear of every region
## (LEAVE) the land is hidden and the frame follows you across the open sea, re-centred every RECENTRE metres.
const ARRIVE := 2600.0
const LEAVE := 4200.0
const RECENTRE := 2500.0
var start_region := ""
var _anchor := Vector3.ZERO     # the current frame's anchor on the unit sphere (Vector3.ZERO: no world flight)
var _site: Dictionary = {}      # the region map built under you ({} over the open sea)
var _world_t := 0.0
var touring := false            # left the starting region: the ring course is gone, the HUD shows where you are
var gps: Control

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	if craft_id == "":
		_pick()
	else:
		_start()

func _pick() -> void:
	_picker = Control.new()
	_picker.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_picker)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.06, 0.96)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_picker.add_child(bg)
	var box := VBoxContainer.new()
	box.position = Vector2(24, 80)
	box.custom_minimum_size = Vector2(492, 0)
	box.add_theme_constant_override("separation", 12)
	_picker.add_child(box)
	var title := Label.new()
	title.text = "SKYWAYS · NEXUS CITY"
	title.add_theme_font_size_override("font_size", 26)
	box.add_child(title)
	var sub := Label.new()
	sub.text = "Take a craft out over the city. Fly the eight rings for the prize; helicopters lift from a hover, the jet needs speed on the runway, the boat and the sub leave from the seaport."
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.custom_minimum_size = Vector2(492, 0)
	sub.modulate = Color(0.8, 0.85, 0.9)
	box.add_child(sub)
	# twenty craft: a scrolling two-column list, so the BACK button stays on screen
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(492, 360)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	box.add_child(scroll)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	scroll.add_child(grid)
	for id in CRAFT:
		var c: Dictionary = CRAFT[id]
		var b := Button.new()
		b.text = "%s\n%s" % [String(c.name).to_upper(), String(c.kind).capitalize()]
		b.custom_minimum_size = Vector2(238, 60)
		b.clip_text = true
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.disabled = not ResourceLoader.exists(model_of(id))
		b.pressed.connect(func(): craft_id = id; _picker.queue_free(); _picker = null; _start())
		grid.add_child(b)
	var back := Button.new()
	back.text = "← BACK"
	back.custom_minimum_size = Vector2(0, 48)
	back.pressed.connect(func(): closed.emit())
	box.add_child(back)

## the engine loop per craft kind (audio/sfx)
const ENGINE := { "HELI": "rotor", "JET": "jet", "AIRSHIP": "hover", "BOAT": "engine", "SUB": "hover" }

func _start() -> void:
	var c: Dictionary = CRAFT[craft_id]
	profile = Handling.profile(String(c.kind))
	Sound.loop("craft", String(ENGINE.get(String(c.kind), "engine")), -10.0, 0.9)
	Sound.loop("wind", "water" if String(c.kind) in ["BOAT", "SUB"] else "wind", -20.0, 1.0)
	top_speed = Handling.BASE_SPEED * float(Handling.FLEET_SPEED.get(craft_id, 1.0))
	# the Aviation Hangar's work on this aircraft (facility.gd): engine, avionics, gear, cockpit, airframe
	var fs := Facility.apply_flight(profile, top_speed, GarageState.load_or_fresh(), craft_id)
	profile = fs[0]
	top_speed = float(fs[1])
	hull_take = float(fs[2])
	land_take = 1.0 - 0.1 * Facility.level(GarageState.load_or_fresh(), craft_id, "gear")
	region = Region3D.new()
	region.set_anchors_preset(Control.PRESET_FULL_RECT)
	region.closed.connect(func(): closed.emit())
	add_child(region)
	var start := Vector2.ZERO
	for poi in Data.map(region_id).get("pois", []):
		if String(poi.id) == String(c.poi):
			start = Vector2(float(poi.x), float(poi.z))
	region.show_region(region_id, start, Region3D.Mode.PLAY)
	cam = region.camera()
	cam.current = true
	cam.far = 16000.0   # far enough that the sea runs into the haze, not into a dark band at 4 km
	_boxes = region.building_boxes()
	# the hull
	hull = (load(model_of(craft_id)) as PackedScene).instantiate() as Node3D
	StreetCar.face_forward(hull)
	region.world().add_child(hull)
	_fit_hull(float(c.length))
	if String(c.kind) == "JET":
		_build_gear(float(c.length))
	# a soft fill over the craft (Nov 18 flight test: at night over the dark sea the Rift-Jumper read as a black shape)
	# and a red / green pair of navigation lights at the wingtips
	var fill := OmniLight3D.new()
	fill.light_color = Color(0.85, 0.9, 1.0)
	fill.light_energy = 1.4 if region_night() else 0.5
	fill.omni_range = float(c.length) * 1.6
	fill.shadow_enabled = false
	fill.position = Vector3(0, float(c.length) * 0.45, float(c.length) * 0.3)
	hull.add_child(fill)
	for side in [-1.0, 1.0]:
		var nav := OmniLight3D.new()
		nav.light_color = Color(1.0, 0.1, 0.1) if side < 0.0 else Color(0.1, 1.0, 0.3)
		nav.light_energy = 2.0
		nav.omni_range = 3.0
		nav.position = Vector3(side * float(c.length) * 0.35, 0.3, 0.0)
		hull.add_child(nav)
	if from_hangar:
		var pr := Gear.profile_load()
		hull_hp = maxf(0.2, Air.condition(pr, craft_id) / 100.0)
		fuel = float(Air.fuel(pr, craft_id))
	var sp: Vector3 = region.stand_point()
	var water := String(profile.mode) == "WATER"
	pad = _clear_spot(sp, water)
	state = Handling.State.new()
	state.y = pad.y + (0.6 if water else Handling.RIDE)
	# face open water (boats) or the long way across the map (aircraft): the direction with the most clear run
	state.yaw = _open_heading(pad, water)
	hull.position = Vector3(pad.x, state.y, pad.z)
	hull.rotation.y = state.yaw
	_cam_yaw = state.yaw
	_course(water)
	controls = TouchControls.new()
	add_child(controls)
	controls.set_mode("fly")
	_hud = Label.new()
	_hud.position = Vector2(16, 60)
	_hud.add_theme_font_size_override("font_size", 20)
	_hud.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	add_child(_hud)
	var back := Button.new()
	back.text = "← EXIT"
	back.position = Vector2(16, 16)
	back.pressed.connect(_try_exit)
	add_child(back)
	start_region = region_id
	_site = Geo.site(region_id)
	_anchor = _site.v if not _site.is_empty() else Vector3.ZERO
	gps = Gps.new()
	gps.region = region
	gps.target = hull
	gps.world_mode = String(profile.mode) == "AIR"
	gps.ranges = [600.0, 1500.0, 4000.0] if gps.world_mode else [150.0, 350.0, 900.0]
	gps.world_pos = func() -> Vector3: return globe_pos()
	gps.place_name = func() -> String: return place_name()
	add_child(gps)
	controls.toast("%s · %s" % [String(c.name), "hold UP to lift off" if String(c.kind) in ["HELI", "AIRSHIP"] else ("throttle up the runway, then UP" if String(c.kind) == "JET" else "throttle out of the harbour")])

## the authored hulls come at odd sizes: scale to a real length along the nose axis, resting on the origin
func _fit_hull(length: float) -> void:
	var aabb := AABB()
	var first := true
	for c in hull.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var t := Transform3D.IDENTITY
		var p: Node = mi
		while p != hull and p is Node3D:
			t = (p as Node3D).transform * t
			p = p.get_parent()
		var a := t * mi.get_aabb()
		aabb = a if first else aabb.merge(a)
		first = false
	if first or aabb.size.z < 0.01:
		return
	var k := length / maxf(aabb.size.z, aabb.size.x)
	for ch in hull.get_children():
		if ch is Node3D:
			(ch as Node3D).scale *= k
			(ch as Node3D).position = (ch as Node3D).position * k - Vector3(0, aabb.position.y * k, 0)

## the undercarriage (asset catalog "landing gear"): a nose strut and two mains under the belly — the hull rests
## Handling.RIDE above the ground, so the struts span that gap — each with a tyre; folded into the hull once the jet
## has climbed clear, dropped again as it comes down (_step_gear)
func _build_gear(length: float) -> void:
	var aabb := AABB()
	var first := true
	for ch in hull.find_children("*", "MeshInstance3D", true, false):
		var mi := ch as MeshInstance3D
		var t := Transform3D.IDENTITY
		var pn: Node = mi
		while pn != hull and pn is Node3D:
			t = (pn as Node3D).transform * t
			pn = pn.get_parent()
		var a := t * mi.get_aabb()
		aabb = a if first else aabb.merge(a)
		first = false
	if first:
		return
	var k := length / 17.0
	var strut := StandardMaterial3D.new()
	strut.albedo_color = Color(0.75, 0.76, 0.78)
	strut.metallic = 0.8
	strut.roughness = 0.35
	var rubber := StandardMaterial3D.new()
	rubber.albedo_color = Color(0.06, 0.06, 0.065)
	rubber.roughness = 0.9
	_gear = Node3D.new()
	_gear.name = "gear"
	hull.add_child(_gear)
	_gear_wheels.clear()
	var wr := 0.34 * k
	var drop := Handling.RIDE - wr * 0.9     # the strut's length: belly to the tyre's axle
	# the nose is -z (StreetCar.face_forward); the nose leg a third of the way back from it, the mains behind the middle
	var nose_z := aabb.position.z + aabb.size.z * 0.3
	var main_z := aabb.position.z + aabb.size.z * 0.58
	var main_x := maxf(aabb.size.x * 0.16, 0.9 * k)
	for leg: Vector3 in [Vector3(0, 0, nose_z), Vector3(-main_x, 0, main_z), Vector3(main_x, 0, main_z)]:
		var l := Node3D.new()
		l.position = Vector3(leg.x, 0.25 * k, leg.z)   # a little into the belly, never floating under it
		_gear.add_child(l)
		var sm := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.09 * k
		cm.bottom_radius = 0.07 * k
		cm.height = drop
		cm.radial_segments = 8
		sm.mesh = cm
		sm.position = Vector3(0, -drop * 0.5, 0)
		sm.material_override = strut
		l.add_child(sm)
		var wide: bool = leg.x != 0.0
		for side in ([-1.0, 1.0] if wide else [0.0]):
			var hub := Node3D.new()   # spins about the axle (x); the tyre is a cylinder laid on its side inside it
			hub.position = Vector3(side * 0.14 * k, -drop, 0)
			l.add_child(hub)
			var w := MeshInstance3D.new()
			var wm := CylinderMesh.new()
			wm.top_radius = wr
			wm.bottom_radius = wr
			wm.height = 0.22 * k
			wm.radial_segments = 14
			w.mesh = wm
			w.rotation.z = PI * 0.5
			w.material_override = rubber
			hub.add_child(w)
			_gear_wheels.append(hub)
	_touch_puff = CPUParticles3D.new()
	_touch_puff.emitting = false
	_touch_puff.one_shot = true
	_touch_puff.explosiveness = 1.0
	_touch_puff.amount = 24
	_touch_puff.lifetime = 1.1
	_touch_puff.mesh = QuadMesh.new()
	(_touch_puff.mesh as QuadMesh).size = Vector2(0.9, 0.9) * k
	_touch_puff.direction = Vector3(0, 1, 0)
	_touch_puff.spread = 70.0
	_touch_puff.initial_velocity_min = 1.5
	_touch_puff.initial_velocity_max = 4.0
	_touch_puff.gravity = Vector3(0, 0.6, 0)
	_touch_puff.scale_amount_min = 1.0
	_touch_puff.scale_amount_max = 2.4
	_touch_puff.color = Color(0.85, 0.83, 0.8, 0.5)
	var pm := StandardMaterial3D.new()
	pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	pm.vertex_color_use_as_albedo = true
	pm.albedo_color = Color(1, 1, 1, 0.35)
	_touch_puff.mesh.surface_set_material(0, pm)
	_touch_puff.position = Vector3(0, 0.1, main_z)
	hull.add_child(_touch_puff)

## the gear folds once the jet is 8 m clear and climbing, drops when it sinks under 40 m or slows toward landing speed;
## the tyres spin with ground speed; the touchdown kicks up a puff
func _step_gear(dt: float, alt: float) -> void:
	if _gear == null:
		return
	var down := not state.airborne or alt < 8.0 or (alt < 40.0 and state.vy < 0.0) or absf(state.speed) < float(profile.takeoff) * 0.9
	_gear_k = move_toward(_gear_k, 1.0 if down else 0.0, dt * 0.9)
	_gear.scale.y = maxf(_gear_k, 0.02)
	_gear.visible = _gear_k > 0.03
	if not state.airborne and absf(state.speed) > 0.5:
		for w in _gear_wheels:
			w.rotation.x += state.speed * dt / 0.34
	if _was_airborne and not state.airborne and _touch_puff:
		_touch_puff.restart()
		_touch_puff.emitting = true
	_was_airborne = state.airborne

## the yaw (forward = -z rotated) whose run of 200 m ahead has the most water (boats) or the fewest buildings (aircraft)
func _open_heading(from: Vector3, water: bool) -> float:
	var best_yaw := 0.0
	var best := -INF
	for k in 16:
		var yaw := TAU * k / 16.0
		var fwd := Vector3(-sin(yaw), 0, -cos(yaw))
		var score := 0.0
		for step in range(1, 11):
			var p := from + fwd * (20.0 * step)
			var half: float = region.span() * 0.5 - 20.0
			if absf(p.x) > half or absf(p.z) > half:
				break
			if water:
				score += 1.0 if region.over_water(p.x, p.z) else -2.0
			else:
				score += 1.0
				for b in _boxes:
					if b.grow(4.0).has_point(Vector3(p.x, b.position.y + 1.0, p.z)):
						score -= 1.5
						break
		if score > best:
			best = score
			best_yaw = yaw
	return best_yaw

## a start spot clear of buildings (aircraft) or on the water (boats), searched outward from the poi
func _clear_spot(from: Vector3, water: bool) -> Vector3:
	var best := from
	for r in [0.0, 12.0, 24.0, 40.0, 60.0, 90.0, 130.0]:
		for k in 12:
			var a := TAU * k / 12.0
			var p := Vector3(from.x + cos(a) * r, 0, from.z + sin(a) * r)
			var on_water: bool = region.over_water(p.x, p.z)
			if water != on_water:
				continue
			var blocked := false
			for b in _boxes:
				if b.grow(6.0).has_point(Vector3(p.x, b.position.y + 1.0, p.z)):
					blocked = true
					break
			if not blocked:
				p.y = region.water_level() if water else region.ground(p.x, p.z)
				return p
	best.y = region.water_level() if water else region.ground(best.x, best.z)
	return best

## the ring course: a wide loop over the city at climbing heights (air) or along the water (boats / subs)
func _course(water: bool) -> void:
	var span: float = region.span() * 0.5 - 60.0
	for i in RINGS:
		var a := TAU * i / RINGS - PI * 0.5
		var r: float = minf(span, 180.0 + 40.0 * (i % 2))
		var p := Vector3(pad.x + cos(a) * r, 0, pad.z + sin(a) * r)
		if water:
			# keep water rings on the water: slide toward the pad until the ground is under the sea; too close and the
			# ring is pushed out along the open heading instead
			var tries := 0
			while not region.over_water(p.x, p.z) and tries < 20:
				p = p.lerp(Vector3(pad.x, 0, pad.z), 0.1)
				tries += 1
			if Vector2(p.x - pad.x, p.z - pad.z).length() < 40.0:
				var fwd := Vector3(-sin(state.yaw), 0, -cos(state.yaw))
				p = Vector3(pad.x, 0, pad.z) + fwd * (60.0 + 25.0 * i)
			p.y = region.water_level() + 2.0
		else:
			var g: float = region.ground(p.x, p.z)
			for b in _boxes:
				if Vector2(b.get_center().x - p.x, b.get_center().z - p.z).length() < 40.0:
					g = maxf(g, b.end.y)
			p.y = g + 25.0 + 12.0 * (i % 3)
		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = RING_R - 0.6
		tm.outer_radius = RING_R
		tm.rings = 32
		tm.ring_segments = 8
		ring.mesh = tm
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.2, 0.9, 1.0)
		m.emission_enabled = true
		m.emission = Color(0.2, 0.9, 1.0)
		m.emission_energy_multiplier = 2.5
		ring.material_override = m
		ring.position = p
		# face the ring toward the next one so you fly through it along the loop
		var nxt := TAU * (i + 1) / RINGS - PI * 0.5
		ring.rotation.y = -nxt - PI * 0.5
		ring.rotation.x = PI * 0.5
		region.world().add_child(ring)
		rings.append({ "pos": p, "node": ring, "hit": false })
	_mark_next()

func _mark_next() -> void:
	for i in rings.size():
		var m := (rings[i].node as MeshInstance3D).material_override as StandardMaterial3D
		var c := Color(0.3, 1.0, 0.5) if rings[i].hit else (Color(1.0, 0.8, 0.2) if i == next_ring else Color(0.2, 0.9, 1.0))
		m.albedo_color = c
		m.emission = c

func _try_exit() -> void:
	var ex := Handling.can_exit(profile, state, region.over_water(hull.position.x, hull.position.z) and String(profile.mode) != "WATER")
	if bool(ex.ok) and touring and String(profile.mode) == "AIR" and (_site.is_empty() or region.over_water(hull.position.x, hull.position.z)):
		ex = { "ok": false, "reason": "Out at sea — set it down on land to get out" }
	if bool(ex.ok) and from_hangar and region_id != start_region:
		# your own aircraft, landed in another region: it parks at that region's airport and you walk into its terminal
		var code := arrival_code(region_id)
		if code == "":
			controls.toast("No airfield in %s to leave it at — fly on to an airport" % place_name())
			return
		_save_upkeep()
		arrived.emit(code)
		return
	if bool(ex.ok) or finished:
		_save_upkeep()
		closed.emit()
	else:
		controls.toast(String(ex.reason))

## the airport of a region (airport.gd AIRPORTS), or ""
static func arrival_code(map_id: String) -> String:
	for code in Air.AIRPORTS:
		if String(Air.AIRPORTS[code].region) == map_id:
			return String(code)
	return ""

## where the craft is on the planet (a unit vector), or Vector3.ZERO when this region isn't on the globe
func globe_pos() -> Vector3:
	if _anchor == Vector3.ZERO or hull == null:
		return Vector3.ZERO
	return Geo.to_globe(_anchor, hull.position.x, hull.position.z)

## the region under you, or the open sea
func place_name() -> String:
	if _site.is_empty():
		return "Open sea"
	return String(_site.name)

## once every half second while flying: arrive at the nearest region when it is in reach, give up the land when every
## region is far behind, and keep the open-sea frame centred on the craft
func _world_tick() -> void:
	if _anchor == Vector3.ZERO or String(profile.mode) != "AIR":
		return
	var p := globe_pos()
	var best: Dictionary = {}
	var bd := INF
	for s in Geo.sites():
		var d := Geo.dist(p, s.v)
		if d < bd:
			bd = d
			best = s
	var here := Geo.dist(p, _site.v) if not _site.is_empty() else INF
	if not best.is_empty() and best != _site and bd < ARRIVE and bd < here - 300.0:
		_enter_site(best)
	elif not _site.is_empty() and here > LEAVE:
		_leave_land()
	elif _site.is_empty() and Vector2(hull.position.x, hull.position.z).length() > RECENTRE:
		_reanchor(p)

## builds the region `s` under the craft and carries its place, height above the sea and heading into that frame
func _enter_site(s: Dictionary) -> void:
	var rf := Geo.reframe(_anchor, s.v, hull.position.x, hull.position.z, state.yaw)
	var turn: float = angle_difference(state.yaw, float(rf[1]))
	var above_sea: float = hull.position.y - region.water_level()
	var cam_off := cam.position - hull.position if cam else Vector3.ZERO
	_drop_course()
	region.world().remove_child(hull)
	region_id = String(s.map)
	_site = s
	_anchor = s.v
	controls.toast("Entering %s airspace" % String(s.name))
	# built over a few frames while you fly on (the ground, sea and sky first): no freeze on arrival
	hull.set_meta("not_land", true)
	region.show_region(region_id, null, Region3D.Mode.PLAY, true)
	cam = region.camera()
	cam.current = true
	cam.far = 16000.0
	region.world().add_child(hull)
	_boxes = region.building_boxes()
	var l: Vector2 = rf[0]
	var y: float = region.water_level() + above_sea
	y = maxf(y, region.ground(l.x, l.y) + Handling.RIDE)
	for b in _boxes:
		if b.has_point(Vector3(l.x, b.position.y + 1.0, l.y)):
			y = maxf(y, b.end.y + 4.0)
	state.y = y
	state.yaw = float(rf[1])
	_cam_yaw += turn
	hull.position = Vector3(l.x, y, l.y)
	hull.rotation = Vector3(state.pitch, state.yaw, state.roll)
	cam.position = hull.position + cam_off.rotated(Vector3.UP, turn)
	region.follow_horizon(l.x, l.y)
	var settle := func() -> void:
		if is_instance_valid(self) and region.map_id == String(s.map):
			pad = _clear_spot(region.stand_point(), false)
			_boxes = region.building_boxes()
	if region.building:
		region.built.connect(settle, CONNECT_ONE_SHOT)
	else:
		settle.call()
	if gps:
		gps.region = region
		gps.refresh_map()

## every region far behind: hide the land and fly on over the open sea in a frame that follows the craft
func _leave_land() -> void:
	_drop_course()
	_site = {}
	region.set_open_sea(true)
	_boxes = []
	controls.toast("Open sea · %s" % Geo.lat_lon_text(Geo.vec_to_lat_lon(globe_pos())))
	_reanchor(globe_pos())
	if gps:
		gps.refresh_map()

## re-centres the open-sea frame on the craft: only the sea is drawn, so moving everything back to the origin is unseen
func _reanchor(p: Vector3) -> void:
	var rf := Geo.reframe(_anchor, p, hull.position.x, hull.position.z, state.yaw)
	var turn: float = angle_difference(state.yaw, float(rf[1]))
	var l: Vector2 = rf[0]
	var shift := Vector3(l.x - hull.position.x, 0.0, l.y - hull.position.z)
	var cam_off := cam.position - hull.position
	_anchor = p
	hull.position += shift
	state.yaw = float(rf[1])
	_cam_yaw += turn
	hull.rotation = Vector3(state.pitch, state.yaw, state.roll)
	cam.position = hull.position + cam_off.rotated(Vector3.UP, turn)
	region.follow_horizon(hull.position.x, hull.position.z)

## leaving the starting region ends the ring course (its rings belong to that region's frame)
func _drop_course() -> void:
	touring = true
	for r in rings:
		if is_instance_valid(r.node):
			r.node.queue_free()
	rings.clear()

func _process(dt: float) -> void:
	if not state:
		return
	dt = minf(dt, 0.05)
	var mv: Vector2 = controls.move
	var input := {
		"throttle": maxf(0.0, mv.y), "brake": maxf(0.0, -mv.y), "steer": -mv.x,
		"ascend": controls.ascend(), "descend": controls.descend(), "handbrake": false, "boost": false,
	}
	if from_hangar:
		# the tank: the throttle burns it (a full one lasts Air.TANK_MINUTES wide open); empty, there is no thrust
		fuel = maxf(0.0, fuel - float(input.throttle) * dt * 100.0 / (Air.TANK_MINUTES * 60.0))
		if fuel <= 0.0:
			input.throttle = 0.0
			input.ascend = 0.0 if String(profile.mode) == "AIR" and state.airborne else input.ascend
			if not _fuel_warned:
				_fuel_warned = true
				controls.toast("Out of fuel — glide it down")
		elif fuel < 15.0 and not _fuel_warned:
			_fuel_warned = true
			controls.toast("Fuel low (%d%%) — the bowser is by the hangars" % int(fuel))
	var px := hull.position.x
	var pz := hull.position.z
	var env := {
		"grip": 1.0, "slope": 0.0,
		"floor": region.terrain(px, pz) if String(profile.mode) == "WATER" else region.ground(px, pz),
		"water": region.water_level(), "over_water": region.over_water(px, pz),
	}
	# aircraft on the ground stand on building roofs too
	if String(profile.mode) == "AIR":
		for b in _boxes:
			if b.grow(1.0).has_point(Vector3(px, b.position.y + 0.5, pz)):
				env.floor = maxf(float(env.floor), b.end.y)
	Handling.step(profile, state, input, env, top_speed, dt)
	# move along the heading
	var fwd := Vector3(-sin(state.yaw), 0, -cos(state.yaw))
	var before := hull.position
	var want := before + fwd * state.speed * dt
	want.y = state.y
	# buildings are solid for anything below their roofs
	var crashed := false
	for b in _boxes:
		if b.has_point(Vector3(want.x, want.y - 1.0, want.z)):
			crashed = true
			break
	if crashed:
		var hit_speed := absf(state.speed)
		hull_hp -= clampf(hit_speed / 60.0, 0.05, 0.6) * hull_take
		state.speed = -state.speed * 0.2
		want = before
		controls.toast("Hit a building — hull %d%%" % int(hull_hp * 100))
		Sound.sfx("explosion" if hit_speed > 30.0 else "land", -4.0)
		if hull_hp <= 0.0:
			_reset("The craft is wrecked — back on the pad")
			return
	if state.hard_landing:
		hull_hp -= 0.25 * land_take
		controls.toast("Hard landing — hull %d%%" % int(hull_hp * 100))
		if hull_hp <= 0.0:
			_reset("The craft is wrecked — back on the pad")
			return
	# the edge: boats and subs keep to the region's water; aircraft fly on without any limit, and the region's sea and
	# ground skirt follow them so the horizon never shows an edge (owner, Nov 18: invisible wall, then "removed completely")
	if String(profile.mode) == "AIR":
		region.follow_horizon(want.x, want.z)
		_world_t += dt
		if _world_t > 0.5:
			_world_t = 0.0
			hull.position = want
			_world_tick()
			want = hull.position
	else:
		var half: float = airspace_half()
		want.x = clampf(want.x, -half, half)
		want.z = clampf(want.z, -half, half)
	hull.position = want
	hull.rotation = Vector3(state.pitch, state.yaw, state.roll)
	# rings
	if not finished and not rings.is_empty():
		if state.airborne or String(profile.mode) == "WATER":
			clock += dt
		var r: Dictionary = rings[next_ring]
		if hull.position.distance_to(r.pos) < RING_R:
			r.hit = true
			next_ring += 1
			Sound.sfx("capture", -6.0)
			var pr := Gear.profile_load()
			for g in Progression.event(pr, "ring", 1):
				controls.toast("DAILY GOAL · %s — +%d Nex" % [String(g.label), int(g.nex)])
			Gear.profile_save(pr)
			if next_ring >= rings.size():
				finished = true
				_finish()
			else:
				controls.toast("Ring %d of %d" % [next_ring, rings.size()])
			_mark_next()
	# chase camera: behind and above by the kind's distances, over the shoulder of the yaw
	var cd: Vector2 = Handling.camera(profile)
	var hull_len := float(CRAFT[craft_id].length)
	cd = Vector2(maxf(cd.x, hull_len * 1.15), cd.y + maxf(0.0, hull_len - 14.0) * 0.3)
	_cam_yaw = lerp_angle(_cam_yaw, state.yaw, minf(1.0, 3.0 * dt))
	var back := Vector3(sin(_cam_yaw), 0, cos(_cam_yaw))
	var cam_pos := hull.position + back * cd.x + Vector3(0, cd.y, 0)
	cam_pos.y = maxf(cam_pos.y, region.ground(cam_pos.x, cam_pos.z) + 2.0)
	if cam_pos.y > hull.position.y + cd.y + 10.0:
		# the ground behind rises into the camera: pull in toward the craft instead of looking from the hillside
		cam_pos = hull.position + back * cd.x * 0.4 + Vector3(0, cd.y, 0)
	if look_dev != Vector3.ZERO:
		# a look-dev camera (main.gd shot hook skyways:…:side): a fixed offset from the hull, looking at its middle
		cam.position = hull.position + look_dev
		cam.look_at(hull.position + Vector3(0, 0.8, 0), Vector3.UP)
	else:
		cam.position = cam.position.lerp(cam_pos, minf(1.0, 6.0 * dt))
		cam.look_at(hull.position + Vector3(0, 1.5, 0) + fwd * 6.0, Vector3.UP)
	controls.show_hull(hull_hp, 0.0, 0.0)
	var alt: float = hull.position.y - (region.water_level() if String(profile.mode) == "WATER" else region.ground(px, pz))
	_step_gear(dt, alt)
	var k := clampf(absf(state.speed) / maxf(top_speed, 1.0), 0.0, 1.0)
	Sound.loop_set("craft", 0.8 + k * 0.7, -12.0 + k * 6.0)
	Sound.loop_set("wind", 1.0 + k * 0.4, -26.0 + k * 14.0)
	var line3 := "rings %d / %d   %d:%02d" % [next_ring, rings.size(), int(clock / 60.0), int(fmod(clock, 60.0))]
	if touring:
		line3 = "%s   HDG %03d %s" % [place_name().to_upper(), int(rad_to_deg(Geo.yaw_to_heading(state.yaw))), Geo.compass(Geo.yaw_to_heading(state.yaw))]
	_hud.text = "%s\nSPD %3d m/s   ALT %4d m   HULL %d%%%s\n%s" % [String(CRAFT[craft_id].name), int(absf(state.speed)), int(maxf(0.0, alt)), int(hull_hp * 100), ("   FUEL %d%%" % int(ceil(fuel))) if from_hangar else "", line3]

## the hangar aircraft's condition and tank go back to the profile (once: on the exit, a wreck, or the view closing)
func _save_upkeep() -> void:
	if not from_hangar or _upkeep_saved:
		return
	_upkeep_saved = true
	var pr := Gear.profile_load()
	Air.set_condition(pr, craft_id, int(round(hull_hp * 100.0)))
	Air.set_fuel(pr, craft_id, int(floor(fuel)))
	Gear.profile_save(pr)

func _reset(why: String) -> void:
	state = Handling.State.new()
	state.y = pad.y + (0.6 if String(profile.mode) == "WATER" else Handling.RIDE)
	hull.position = Vector3(pad.x, state.y, pad.z)
	hull_hp = 0.35 if from_hangar else 1.0   # your own aircraft comes back to the pad patched, not new (the hangar repairs it)
	controls.toast(why)

func _finish() -> void:
	if _paid:
		return
	_paid = true
	var fast := clock < 150.0
	var nex := 350 if fast else 200
	var xp := 250 if fast else 150
	var p := Gear.profile_load()
	var res := Progression.grant(p, "skyways", nex, xp, "Skyways · %d:%02d" % [int(clock / 60.0), int(fmod(clock, 60.0))])
	Gear.profile_save(p)
	for l in res.lines:
		controls.toast(String(l))

func _exit_tree() -> void:
	_save_upkeep()
	Sound.loop_stop("craft")
	Sound.loop_stop("wind")
