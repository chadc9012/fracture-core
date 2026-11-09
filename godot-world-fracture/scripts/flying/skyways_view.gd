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

const Phone := preload("res://scripts/phone.gd")
const Region3D := preload("res://scripts/region_3d.gd")
const TouchControls := preload("res://scripts/player/touch_controls.gd")
const Handling := preload("res://scripts/driving/vehicle_handling.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const REGION := "nexus"
const FLEET := "res://models/fleet/"
## the craft on offer: hull file, handling kind, display name, where it starts (poi), fleet speed multiplier
const CRAFT := {
	"rift-helicopter": { "name": "Rift-Jumper Attack Helicopter", "kind": "HELI", "poi": "nexus-airport", "length": 14.0 },
	"vanguard-jet": { "name": "Resonant Strike Jet", "kind": "JET", "poi": "nexus-airport", "length": 17.0 },
	"leviathan": { "name": "Leviathan Cargo Airship", "kind": "AIRSHIP", "poi": "nexus-airport", "length": 42.0 },
	"scrap-patrol-boat": { "name": "Scrap-Iron Patrol Boat", "kind": "BOAT", "poi": "seaport:nexus", "length": 11.0 },
	"hydro-sub-skiff": { "name": "Hydro-Sub Skiff", "kind": "SUB", "poi": "seaport:nexus", "length": 9.0 },
}
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
	for id in CRAFT:
		var c: Dictionary = CRAFT[id]
		var b := Button.new()
		b.text = "%s — %s" % [String(c.name).to_upper(), String(c.kind).capitalize()]
		b.custom_minimum_size = Vector2(0, 52)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.disabled = not ResourceLoader.exists(FLEET + id + ".glb")
		b.pressed.connect(func(): craft_id = id; _picker.queue_free(); _picker = null; _start())
		box.add_child(b)
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
	cam.far = 4000.0
	_boxes = region.building_boxes()
	# the hull
	hull = (load(FLEET + craft_id + ".glb") as PackedScene).instantiate() as Node3D
	StreetCar.face_forward(hull)
	region.world().add_child(hull)
	_fit_hull(float(c.length))
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
	if bool(ex.ok) or finished:
		closed.emit()
	else:
		controls.toast(String(ex.reason))

func _process(dt: float) -> void:
	if not state:
		return
	dt = minf(dt, 0.05)
	var mv: Vector2 = controls.move
	var input := {
		"throttle": maxf(0.0, mv.y), "brake": maxf(0.0, -mv.y), "steer": -mv.x,
		"ascend": controls.ascend(), "descend": controls.descend(), "handbrake": false, "boost": false,
	}
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
		hull_hp -= clampf(hit_speed / 60.0, 0.05, 0.6)
		state.speed = -state.speed * 0.2
		want = before
		controls.toast("Hit a building — hull %d%%" % int(hull_hp * 100))
		Sound.sfx("explosion" if hit_speed > 30.0 else "land", -4.0)
		if hull_hp <= 0.0:
			_reset("The craft is wrecked — back on the pad")
			return
	if state.hard_landing:
		hull_hp -= 0.25
		controls.toast("Hard landing — hull %d%%" % int(hull_hp * 100))
		if hull_hp <= 0.0:
			_reset("The craft is wrecked — back on the pad")
			return
	# the edge of the region
	var half: float = region.span() * 0.5 - 10.0
	want.x = clampf(want.x, -half, half)
	want.z = clampf(want.z, -half, half)
	hull.position = want
	hull.rotation = Vector3(state.pitch, state.yaw, state.roll)
	# rings
	if not finished:
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
	cam.position = cam.position.lerp(cam_pos, minf(1.0, 6.0 * dt))
	cam.look_at(hull.position + Vector3(0, 1.5, 0) + fwd * 6.0, Vector3.UP)
	controls.show_hull(hull_hp, 0.0, 0.0)
	var alt: float = hull.position.y - (region.water_level() if String(profile.mode) == "WATER" else region.ground(px, pz))
	var k := clampf(absf(state.speed) / maxf(top_speed, 1.0), 0.0, 1.0)
	Sound.loop_set("craft", 0.8 + k * 0.7, -12.0 + k * 6.0)
	Sound.loop_set("wind", 1.0 + k * 0.4, -26.0 + k * 14.0)
	_hud.text = "%s\nSPD %3d m/s   ALT %4d m   HULL %d%%\nrings %d / %d   %d:%02d" % [String(CRAFT[craft_id].name), int(absf(state.speed)), int(maxf(0.0, alt)), int(hull_hp * 100), next_ring, rings.size(), int(clock / 60.0), int(fmod(clock, 60.0))]

func _reset(why: String) -> void:
	state = Handling.State.new()
	state.y = pad.y + (0.6 if String(profile.mode) == "WATER" else Handling.RIDE)
	hull.position = Vector3(pad.x, state.y, pad.z)
	hull_hp = 1.0
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
	Sound.loop_stop("craft")
	Sound.loop_stop("wind")
