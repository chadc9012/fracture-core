extends Node3D
## The story's sets (owner, Nov 22: "Stage everything"): each chapter of a campaign story names a `stage` — the overturned
## bus, the checkpoint, the medical centre, the lab, the briefing room, Haven-01's walls, the crater, the Ashen Archive …
## — and this node dresses it where the scene plays, stands the people who speak in it, and frames every line on whoever
## says it. Sets are built from the build's own models (city / foliage / boss GLBs, burnt fleet cars, the VFX kits) and
## plain boxes for walls, floors, barriers and tents; vehicles are fleet models only. Solid pieces go into the shared
## obstacle list in slots that are parked (never removed: gunplay, enemies and the boss hold indexes) when the set goes.
##
##   play(set_id, anchor, fwd, speakers, talker)  dress the set (or keep it if it is already up nearby), stand the cast
##   shot(line_id, i)                              the camera for a line: on the speaker, from over the listener
##   act(name)                                     a staged moment a line triggers (Cole's truck, the seal, …)
##   operator_mark()                               where the operator stands in the set
## The campaign runner (campaign.gd) owns one per world and calls it for every opening and closing.

const Burnt := preload("res://scripts/fx/burnt.gd")
const Fx := preload("res://scripts/vfx/fx.gd")
const FractureSet := preload("res://scripts/vfx/fracture_set.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const People := preload("res://scripts/npc/people.gd")
const NpcStreet := preload("res://scripts/npc/npc_street.gd")
const Lines := preload("res://scripts/cinema/lines.gd")
const Catalog := preload("res://scripts/garage/catalog.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")

const PARKED := AABB(Vector3(0, -1000, 0), Vector3(0.1, 0.1, 0.1))
const CITY := "res://models/city/"
const FLEET := "res://models/fleet/"
const FOLIAGE := "res://models/foliage/"
const BOSSES := "res://models/bosses/"

## the sets that are rooms: the operator is stood inside them and they are floored flat
const ROOMS := ["astryan_hall", "council", "stacks", "pods", "heart", "forge", "cathedral", "underground", "station", "observatory", "ice_cave", "throne", "citadel", "dome", "farms", "tubes", "ring", "pool", "garden", "palace", "backroom", "vault", "engine", "transport", "tower", "sanctuary", "lodge", "map_room", "murals", "lab", "lab_red", "recording", "chamber", "briefing", "subway", "shaft", "archive", "memory", "hq_hall", "balcony"]
## sets hung in the sky (the dimensional structure the two figures speak from)
const SKY := ["void"]

## who speaks without a body in the scene (a radio, a broadcast, a voice in the dark): the camera holds the set
const VOICES := ["MILITARY RADIO", "UNKNOWN VOICE", "GLOBAL BROADCAST", "ARCHIVE RECORDING", "MEMORY", "ENGINE VOICE", "COUNCILLOR"]
## the people of the story with a roster row (people.gd) — they wear their own look
const ROSTER := ["VOSS", "SERAPHINE", "RAINER", "WARD", "KAEL", "COLE"]
## the looks of everyone else who speaks or stands in a scene: outfit, body, build, scale, and a whole-character model
## for the three Operators (Goliath, Nyx, Cipher wear the class bodies)
const EXTRAS := {
	"BOY": ["npc-hoodie-backpack", "male", "slim", 0.66], "DANIEL": ["npc-hoodie-backpack", "male", "slim", 0.7],
	"MAN": ["npc-business", "male", "athletic", 1.0], "OFFICER": ["npc-swat", "female", "athletic", 1.0],
	"SOLDIER": ["npc-swat", "male", "heavy", 1.0], "SCIENTIST": ["npc-doctor", "male", "slim", 1.0],
	"DR. CROSS": ["npc-doctor", "male", "athletic", 1.0], "CIVILIAN": ["npc-tee-jeans", "female", "slim", 1.0],
	"MEDIC": ["npc-paramedic", "female", "athletic", 1.0], "CRANE": ["npc-beige-suit", "male", "slim", 1.0],
	"OREN VASQ": ["npc-all-black", "male", "athletic", 1.0], "ILYRA SEN": ["npc-summer", "female", "slim", 1.0],
	"AUREN THALE": ["npc-elder", "male", "heavy", 1.0], "ELDER MAREN": ["npc-hunter", "female", "heavy", 1.0],
	"TRADER": ["npc-apron", "male", "heavy", 1.0], "RANGER": ["npc-hunter", "male", "athletic", 1.0],
	"GOLIATH": ["", "male", "heavy", 1.0, "titan"], "NYX": ["", "female", "slim", 1.0, "hunter"],
	"CIPHER": ["", "male", "slim", 1.0, "warlock"], "COLLECTOR": ["npc-all-black", "male", "athletic", 1.0],
	"VESPER": ["npc-leather", "female", "slim", 1.0], "EXECUTOR": ["npc-all-black", "male", "heavy", 1.0],
	"CHIEF ODA": ["npc-engineer", "female", "heavy", 1.0], "HIEROPHANT": ["npc-elder", "male", "slim", 1.0],
	"DR. HALVARD": ["npc-hivis", "male", "heavy", 1.0], "TALLIS": ["npc-shirtless", "male", "athletic", 1.0],
	"RAIDER": ["npc-tank-cargo", "male", "athletic", 1.0], "PHANTOM CHILD": ["npc-summer", "female", "slim", 0.6],
	"ASTRYAN MAKER": ["npc-doctor", "female", "slim", 1.0],
}

## the look a speaker wears: their people.gd row when they have one, else their EXTRAS row (a civilian for anyone else)
static func look_of(s: String) -> Dictionary:
	var pid := s.to_lower().get_slice(" ", s.get_slice_count(" ") - 1)
	if s in ROSTER:
		var row: Dictionary = People.by_id(pid)
		if not row.is_empty():
			return NpcStreet.look_for(row)
	var e: Array = EXTRAS.get(s, ["npc-tee-jeans", "female" if hash(s) % 2 == 0 else "male", "athletic", 1.0])
	var look := { "frame": { "slim": "nyx", "athletic": "cipher", "heavy": "goliath" }.get(String(e[2]), "cipher"), "body": String(e[1]) }
	if String(e[0]) != "":
		look.outfit = String(e[0])
	if e.size() > 4:
		look.model = String(e[4])
	return CharacterStore.clean(look)

static func scale_of(s: String) -> float:
	var e: Array = EXTRAS.get(s, [])
	return float(e[3]) if e.size() > 3 else 1.0

static func is_operator(s: String) -> bool:
	var e: Array = EXTRAS.get(s, [])
	return e.size() > 4

## the figures beyond the Fracture and the things that fight you: a model, its height, a glow
const FIGURES := {
	"UNKNOWN FIGURE": ["dark-knight.glb", 3.2, Color(0.6, 0.3, 1.0)], "SECOND FIGURE": ["dark-knight.glb", 2.9, Color(0.9, 0.3, 0.5)],
	"UNKNOWN RULER": ["dark-knight.glb", 4.2, Color(1.0, 0.75, 0.35)], "THE HARBINGER": ["aberration-boss.glb", 5.0, Color(0.7, 0.2, 1.0)],
	"ENEMY COMMANDER": ["aberration-elite.glb", 3.4, Color(0.9, 0.3, 0.3)], "FRACTURE INFILTRATOR": ["aberration-elite.glb", 2.4, Color(0.5, 0.9, 1.0)],
	"ARCHIVE WARDEN": ["guardian-boss.glb", 6.0, Color(1.0, 0.8, 0.45)],
}
## recordings play as holograms
const HOLO := ["SCIENTIST", "DR. CROSS", "PHANTOM CHILD", "ASTRYAN MAKER"]

var region: Control           # region_3d.gd (ground, world)
var operator: Node3D
var obstacles: Array
var boss: Node3D              # the chapter's boss, when it is up (speaks as itself)
var set_id := ""
var anchor := Vector3.ZERO
var fwd := Vector3(0, 0, -1)
var right := Vector3(1, 0, 0)
var floor_y := 0.0
var cast: Dictionary = {}     # speaker -> Node3D
var _root: Node3D
var _slots: Array[int] = []   # obstacle indexes this set holds
var _free_slots: Array[int] = []
var _focus := Vector3.ZERO    # what a voice without a body is framed on
var _wide := Vector3(8, 4, 10)  # the wide shot, in set space
var _talker: Node3D
var _nova: Node3D
var _last_listener := ""
var _acts: Dictionary = {}    # name -> Node3D the act moves
var _mats: Dictionary = {}

func setup(r: Control, op: Node3D, obs: Array) -> void:
	region = r
	operator = op
	obstacles = obs

# --------------------------------------------------------------------------------------------- set space
## a point in set space (x right, y up, z forward) on the ground — flat at the floor in a room or the sky
func p(x: float, y: float, z: float, flat := false) -> Vector3:
	var w := anchor + right * x + fwd * z
	var gy := floor_y if (flat or set_id in ROOMS or set_id in SKY) else _ground(w.x, w.z)
	return Vector3(w.x, gy + y, w.z)

func _ground(x: float, z: float) -> float:
	return float(region.ground(x, z)) if region and region.has_method("ground") else 0.0

func yaw_of(deg: float) -> float:
	# the set's forward is +z in set space: a node turned `deg` from it
	return atan2(fwd.x, fwd.z) + deg_to_rad(deg)

func mat(c: Color, rough := 0.85, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var key := "%s|%s|%s|%s" % [c.to_html(), rough, metal, emit]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if c.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	_mats[key] = m
	return m

## a box in set space: size (x across, y up, z along), its base centre at (x, y, z), turned `deg`
func box(size: Vector3, x: float, y: float, z: float, m: Material, solid := true, deg := 0.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = m
	_root.add_child(mi)
	var at := p(x, y, z)
	mi.global_position = at + Vector3(0, size.y * 0.5, 0)
	mi.rotation.y = yaw_of(deg)
	if solid and size.y > 0.4:
		var c := cos(mi.rotation.y)
		var s := sin(mi.rotation.y)
		var ex := absf(size.x * 0.5 * c) + absf(size.z * 0.5 * s)
		var ez := absf(size.x * 0.5 * s) + absf(size.z * 0.5 * c)
		_solid(AABB(Vector3(at.x - ex, at.y, at.z - ez), Vector3(ex * 2.0, size.y, ez * 2.0)))
	return mi

func cyl(r: float, h: float, x: float, y: float, z: float, m: Material, solid := true, r_top := -1.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.bottom_radius = r
	cm.top_radius = r if r_top < 0.0 else r_top
	cm.height = h
	cm.radial_segments = 20
	mi.mesh = cm
	mi.material_override = m
	_root.add_child(mi)
	var at := p(x, y, z)
	mi.global_position = at + Vector3(0, h * 0.5, 0)
	if solid and h > 0.4:
		_solid(AABB(Vector3(at.x - r, at.y, at.z - r), Vector3(r * 2.0, h, r * 2.0)))
	return mi

## a tent: a box body under a pitched roof
func tent(x: float, z: float, w: float, d: float, c: Color, deg := 0.0, label_text := "") -> void:
	box(Vector3(w, 2.1, d), x, 0, z, mat(c, 0.95), true, deg)
	var mi := MeshInstance3D.new()
	var pm := PrismMesh.new()
	pm.size = Vector3(w + 0.3, 1.3, d + 0.3)
	mi.mesh = pm
	mi.material_override = mat(c.darkened(0.12), 0.95)
	_root.add_child(mi)
	mi.global_position = p(x, 2.1 + 0.65, z)
	mi.rotation.y = yaw_of(deg + 90.0)
	if label_text != "":
		label(label_text, x, 2.3, z - d * 0.5 - 0.02, Color(0.85, 0.1, 0.1), 96, deg + 180.0, false)

func light(x: float, y: float, z: float, c: Color, energy := 1.6, range_m := 16.0) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.light_color = c
	l.light_energy = energy
	l.omni_range = range_m
	l.shadow_enabled = false
	_root.add_child(l)
	l.global_position = p(x, y, z)
	return l

func label(text: String, x: float, y: float, z: float, c: Color, size := 64, deg := 180.0, lit := true) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.006
	l.modulate = c
	l.outline_size = 0 if lit else 8
	l.shaded = not lit
	_root.add_child(l)
	l.global_position = p(x, y, z)
	l.rotation.y = yaw_of(deg)
	return l

## a model from the build, its longest side fitted to `fit` metres, standing on its base
func model(path: String, x: float, y: float, z: float, fit: float, deg := 0.0, solid := true) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	var ps := load(path) as PackedScene
	if ps == null:
		return null
	var holder := Node3D.new()
	_root.add_child(holder)
	var n := ps.instantiate() as Node3D
	holder.add_child(n)
	var b := _bounds(n)
	var longest := maxf(b.size.x, maxf(b.size.y, b.size.z))
	var s := fit / longest if longest > 0.01 else 1.0
	n.scale = Vector3.ONE * s
	n.position = Vector3(-(b.position.x + b.size.x * 0.5) * s, -b.position.y * s, -(b.position.z + b.size.z * 0.5) * s)
	holder.global_position = p(x, y, z)
	holder.rotation.y = yaw_of(deg)
	if solid:
		var sx := b.size.x * s
		var sz := b.size.z * s
		var c := absf(cos(holder.rotation.y))
		var sn := absf(sin(holder.rotation.y))
		var ex := (sx * c + sz * sn) * 0.5
		var ez := (sx * sn + sz * c) * 0.5
		var at := holder.global_position
		_solid(AABB(Vector3(at.x - ex, at.y, at.z - ez), Vector3(ex * 2.0, b.size.y * s, ez * 2.0)))
	return holder

## a fleet vehicle (the fleet's own models only), nose along the set's `deg`
func vehicle(file: String, x: float, z: float, deg := 0.0, solid := true) -> Node3D:
	var path := FLEET + file
	if not ResourceLoader.exists(path):
		return null
	var car := (load(Catalog.street_cut(path)) as PackedScene).instantiate() as Node3D
	var holder := Node3D.new()
	_root.add_child(holder)
	holder.add_child(car)
	StreetCar.face_forward(car)
	holder.global_position = p(x, 0.0, z)
	holder.rotation.y = yaw_of(deg)
	if solid:
		_solid(_global_bounds(holder))
	return holder

func burnt(seed: int, x: float, z: float, deg := 0.0, burning := true) -> Node3D:
	var car := Burnt.burnt_car(seed, burning)
	_root.add_child(car)
	car.global_position = p(x, 0.0, z)
	car.rotation.y = yaw_of(deg)
	_solid(_global_bounds(car))
	return car

func fire(x: float, z: float, s := 1.0) -> void:
	var f := Burnt.fire(s)
	_root.add_child(f)
	f.global_position = p(x, 0.0, z)

func rocks(x: float, z: float, fit := 2.0, deg := 0.0) -> void:
	model(FOLIAGE + ("boulder.glb" if int(absf(x * 7.0 + z * 3.0)) % 2 == 0 else "rocks.glb"), x, -0.2, z, fit, deg, fit > 1.2)

## a walled room: floor, four walls with a doorway front and back, a ceiling, lights along it
func room(w: float, d: float, h: float, floor_c: Color, wall_c: Color, lamp: Color, door := 5.0, ceiling := true) -> void:
	box(Vector3(w, 0.2, d), 0, -0.2, d * 0.5 - 3.0, mat(floor_c, 0.6), false)
	var wall := mat(wall_c, 0.85)
	box(Vector3(0.3, h, d), -w * 0.5, 0, d * 0.5 - 3.0, wall)
	box(Vector3(0.3, h, d), w * 0.5, 0, d * 0.5 - 3.0, wall)
	var side := (w - door) * 0.5
	for zz: float in [-3.0, d - 3.0]:
		box(Vector3(side, h, 0.3), -(door * 0.5 + side * 0.5), 0, zz, wall)
		box(Vector3(side, h, 0.3), door * 0.5 + side * 0.5, 0, zz, wall)
		box(Vector3(door, h - 3.0, 0.3), 0, 3.0, zz, wall, false)
	if ceiling:
		box(Vector3(w, 0.25, d), 0, h, d * 0.5 - 3.0, mat(wall_c.darkened(0.25), 0.9), false)
	var zz2 := -1.0
	while zz2 < d - 4.0:
		box(Vector3(1.4, 0.06, 0.35), 0, h - 0.08, zz2, mat(lamp, 0.4, 0.0, 3.0), false)
		light(0, h - 0.6, zz2, lamp, 1.1, 12.0)
		zz2 += 6.0

# --------------------------------------------------------------------------------------------- the sets
func play(sid: String, at: Vector3, forward: Vector3, speakers: Array, talker: Node3D = null) -> void:
	_talker = talker
	var f := Vector3(forward.x, 0, forward.z)
	if f.length() < 0.01:
		f = Vector3(0, 0, -1)
	f = f.normalized()
	if sid == set_id and _root and at.distance_to(anchor) < 30.0:
		_cast(speakers)
		return
	clear()
	set_id = sid
	fwd = f
	right = f.cross(Vector3.UP).normalized()   # x to the right when facing +fwd
	anchor = at
	if sid in SKY:
		anchor = at + Vector3(0, 90, 0)
	floor_y = anchor.y if sid in SKY else _ground(at.x, at.z)
	_root = Node3D.new()
	_root.name = "Set_" + sid
	add_child(_root)
	_focus = p(0, 1.5, 6)
	_wide = Vector3(7, 3.5, -5)
	if has_method("_set_" + sid):
		call("_set_" + sid)
	_cast(speakers)
	if OS.has_environment("STAGE_DEBUG"):
		print("STAGE ", sid, " anchor ", anchor, " fwd ", fwd, " op ", operator.global_position, " kids ", _root.get_child_count())
		for k in cast:
			print("  cast ", k, " ", cast[k].global_position, " scale ", cast[k].scale)

func clear() -> void:
	for i in _slots:
		if i < obstacles.size():
			obstacles[i] = PARKED
		_free_slots.append(i)
	_slots.clear()
	if _root:
		_root.queue_free()
		_root = null
	cast.clear()
	_acts.clear()
	_nova = null
	set_id = ""

func _solid(b: AABB) -> void:
	if obstacles == null:
		return
	var i: int
	if not _free_slots.is_empty():
		i = _free_slots.pop_back()
		obstacles[i] = b
	else:
		obstacles.append(b)
		i = obstacles.size() - 1
	_slots.append(i)

static func _bounds(n: Node) -> AABB:
	var out := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		var t := _rel(m, n)
		var a := t * m.get_aabb()
		if first:
			out = a
			first = false
		else:
			out = out.merge(a)
	return out

static func _rel(m: Node3D, top: Node) -> Transform3D:
	var t := Transform3D.IDENTITY
	var c: Node = m
	while c and c != top:
		if c is Node3D:
			t = (c as Node3D).transform * t
		c = c.get_parent()
	return t

func _global_bounds(n: Node3D) -> AABB:
	var b := _bounds(n)
	var t := n.global_transform
	var out := t * b
	return out

func operator_mark() -> Vector3:
	return p(0, 0, 0)

## the opening street after the event: wrecks burning, rubble, smoke over the block
func _set_street() -> void:
	burnt(0, -4.5, 9.0, 30.0)
	burnt(2, 5.0, 16.0, -70.0)
	fire(1.5, 22.0, 1.6)
	for i in 6:
		rocks(-7.0 + i * 2.8, 12.0 + float(i % 3) * 3.0, 1.2 + float(i % 2) * 0.8, i * 50.0)
	model(CITY + "street-lamp.glb", -6.0, 0, 4.0, 6.0, 0.0)
	_wide = Vector3(9, 3.0, -6)

## the overturned bus: the fleet's transport on its side across the road, a car burning, Daniel's father trapped
func _set_bus() -> void:
	var bus := vehicle("tech-transport.glb", 3.5, 7.0, 90.0, false)
	if bus:
		bus.rotation.z = deg_to_rad(88.0)
		bus.global_position += Vector3(0, 1.2, 0)
		_solid(_global_bounds(bus))
	burnt(1, -5.0, 12.0, 20.0)
	fire(-5.0, 12.0, 1.4)
	fire(5.5, 9.5, 0.8)
	for i in 5:
		rocks(-2.0 + i * 1.8, 4.0 + float(i % 2) * 1.5, 0.8, i * 70.0)
	_focus = p(3.5, 1.0, 7.0)
	_wide = Vector3(8, 3.0, -3)

## the evacuation checkpoint: concrete barriers, sandbags, the FDI's vehicles, floodlights, soldiers on the line
func _set_checkpoint() -> void:
	var concrete := mat(Color(0.62, 0.61, 0.58), 0.95)
	var sand := mat(Color(0.55, 0.48, 0.34), 1.0)
	for i in 7:
		box(Vector3(2.6, 1.0, 0.6), -9.0 + i * 3.0, 0, 12.0, concrete, true, 0.0 if i != 3 else 12.0)
	for i in 4:
		box(Vector3(3.0, 1.1, 0.9), -7.5 + i * 5.0, 0, 15.0, sand)
	vehicle("security-suv.glb", -8.0, 18.0, 90.0)
	vehicle("security-suv.glb", 8.0, 19.0, -80.0)
	vehicle("goliath-tank.glb", 0.5, 22.0, 180.0)
	for x: float in [-11.0, 11.0]:
		cyl(0.12, 6.0, x, 0, 13.5, mat(Color(0.3, 0.3, 0.32), 0.5, 0.7))
		box(Vector3(1.2, 0.5, 0.4), x, 6.0, 13.5, mat(Color(1.0, 0.97, 0.85), 0.3, 0.0, 4.0), false)
		light(x, 5.6, 12.5, Color(1.0, 0.95, 0.85), 2.4, 22.0)
	label("FRONTIER DEFENSE INITIATIVE\nEVACUATION CHECKPOINT 3", 0, 2.6, 11.6, Color(1.0, 0.85, 0.3), 64)
	_extras(["SOLDIER", "SOLDIER", "SOLDIER", "SOLDIER"], [Vector3(-6, 0, 13.6), Vector3(-2.5, 0, 13.4), Vector3(4.5, 0, 13.6), Vector3(9, 0, 16)], 180.0)
	_focus = p(0, 1.6, 12)
	_wide = Vector3(10, 3.6, 2)

## the temporary medical evacuation centre: tents with red crosses, cots, crates, medics and the wounded
func _set_medical() -> void:
	var white := Color(0.9, 0.9, 0.88)
	tent(-6.0, 10.0, 5.0, 6.0, white, 0.0, "✚")
	tent(0.5, 13.0, 5.0, 6.0, white, 0.0, "✚")
	tent(7.0, 10.5, 5.0, 6.0, white, 0.0, "✚  TRIAGE")
	for i in 4:
		model(CITY + "bed.glb", -6.5 + i * 4.2, 0, 4.5 + float(i % 2), 2.0, 90.0)
	for i in 3:
		box(Vector3(0.9, 0.7, 0.9), 9.5, float(i) * 0.0, 2.0 + i * 1.1, mat(Color(0.3, 0.36, 0.26), 0.9), true)
	model(CITY + "street-lamp.glb", -9.5, 0, 6.0, 6.0)
	light(0, 4.0, 6.0, Color(1.0, 0.96, 0.9), 2.0, 20.0)
	_extras(["MEDIC", "MEDIC", "CIVILIAN", "CIVILIAN", "MAN"], [Vector3(-4.5, 0, 5.2), Vector3(4.0, 0, 7.5), Vector3(-8.0, 0, 3.0), Vector3(2.5, 0, 9.0), Vector3(7.5, 0, 4.0)], 200.0)
	_wide = Vector3(9, 3.4, -4)

## a lab of Research Complex 09: white walls, desks and screens, shelving, the containment tank glowing in the middle
func _set_lab() -> void:
	_lab(Color(0.85, 0.93, 1.0), false)

## the lab after the breach: red emergency light, a screen dead, the tank cracked
func _set_lab_red() -> void:
	_lab(Color(1.0, 0.22, 0.18), true)

func _lab(lamp: Color, broken: bool) -> void:
	room(16.0, 18.0, 4.6, Color(0.75, 0.77, 0.8), Color(0.88, 0.9, 0.92), lamp)
	for i in 3:
		model(CITY + "office-desk.glb", -5.5, 0, 1.0 + i * 3.4, 2.2, 90.0)
		model(CITY + "office-desk.glb", 5.5, 0, 1.0 + i * 3.4, 2.2, -90.0)
	model(CITY + "shelving.glb", -7.2, 0, 11.0, 2.6, 90.0)
	model(CITY + "tv-wall.glb", 0, 1.0, 14.6, 4.5, 180.0, false)
	# the containment tank
	cyl(1.3, 0.5, 0, 0, 7.0, mat(Color(0.25, 0.27, 0.3), 0.4, 0.8))
	var glass := cyl(1.15, 3.2, 0, 0.5, 7.0, mat(Color(0.55, 0.85, 1.0, 0.22), 0.05, 0.0), true)
	cyl(0.9, 2.6, 0, 0.7, 7.0, mat(Color(0.25, 0.95, 0.8, 0.35) if not broken else Color(0.6, 0.15, 0.9, 0.35), 0.2, 0.0, 2.2), false)
	cyl(1.3, 0.4, 0, 3.7, 7.0, mat(Color(0.25, 0.27, 0.3), 0.4, 0.8), false)
	light(0, 2.2, 7.0, Color(0.3, 1.0, 0.85) if not broken else Color(0.6, 0.2, 1.0), 1.8, 10.0)
	label("RESEARCH COMPLEX 09\nCONTAINMENT · LEVEL 4", 0, 3.6, 14.2, Color(0.4, 0.9, 1.0), 56)
	if broken:
		glass.material_override = mat(Color(0.55, 0.85, 1.0, 0.1), 0.05)
		for i in 5:
			rocks(-3.0 + i * 1.6, 3.0 + float(i % 2) * 6.0, 0.5, i * 40.0)
	_focus = p(0, 1.8, 7.0)
	_wide = Vector3(6.5, 3.2, -2)

## a security recording: a dark room, the recording standing in the projector's light
func _set_recording() -> void:
	room(12.0, 12.0, 4.0, Color(0.12, 0.13, 0.15), Color(0.18, 0.2, 0.23), Color(0.3, 0.6, 1.0))
	var h := Fx.hologram("emblem", Color(0.35, 0.8, 1.0), 2.0)
	_root.add_child(h)
	h.global_position = p(3.5, 0, 5.0)
	model(CITY + "office-desk.glb", -3.0, 0, 6.0, 2.2, 0.0)
	_focus = p(0, 1.6, 4.0)
	_wide = Vector3(5, 2.6, -2)

## the central research chamber: a ring of conduits round the breach the lab tore open
func _set_chamber() -> void:
	room(22.0, 24.0, 7.0, Color(0.2, 0.21, 0.24), Color(0.26, 0.28, 0.32), Color(0.6, 0.35, 1.0), 6.0)
	var portal := Fx.portal(3.4, Color(0.7, 0.35, 1.0))
	_root.add_child(portal)
	portal.global_position = p(0, 0.2, 11.0)
	portal.rotation.y = yaw_of(0.0)
	for i in 6:
		var a := TAU * float(i) / 6.0
		var from := p(cos(a) * 9.0, 0.5, 11.0 + sin(a) * 9.0)
		FractureSet.conduit(_root, from, p(0, 3.4, 11.0), Color(0.7, 0.4, 1.0), 0.14)
	light(0, 4.0, 11.0, Color(0.7, 0.35, 1.0), 3.0, 22.0)
	_focus = p(0, 3.2, 11.0)
	_wide = Vector3(8, 3.5, -1)

## the surface after the lab: smoke over a broken street, a tear in the sky where the figures watch from
func _set_surface() -> void:
	_set_street()
	var tear := Fx.portal(9.0, Color(0.6, 0.3, 1.0))
	_root.add_child(tear)
	tear.global_position = p(0, 38.0, 70.0, true) + Vector3(0, _ground(anchor.x, anchor.z), 0)
	tear.rotation.y = yaw_of(0.0)
	_focus = tear.global_position
	_wide = Vector3(4, 2.0, -8)

## the FDI's headquarters forecourt: barriers, the motor pool, flags, a guard post
func _set_hq() -> void:
	var concrete := mat(Color(0.6, 0.6, 0.58), 0.95)
	for i in 5:
		box(Vector3(2.6, 1.0, 0.6), -10.0 + i * 5.0, 0, 16.0, concrete)
	vehicle("security-suv.glb", -7.0, 8.0, 0.0)
	vehicle("security-suv.glb", -3.6, 8.0, 0.0)
	vehicle("tech-transport.glb", 6.0, 9.0, 180.0)
	for x: float in [-4.0, 4.0]:
		cyl(0.08, 8.0, x, 0, 18.0, mat(Color(0.8, 0.8, 0.82), 0.3, 0.8))
		box(Vector3(1.6, 1.0, 0.04), x + 0.8, 6.8, 18.0, mat(Color(0.12, 0.2, 0.4), 0.9), false)
	label("FRONTIER DEFENSE INITIATIVE\nHEADQUARTERS · NEXUS", 0, 3.4, 17.0, Color(0.85, 0.92, 1.0), 80)
	_extras(["SOLDIER", "SOLDIER", "OFFICER"], [Vector3(-9, 0, 14), Vector3(9, 0, 14), Vector3(3.5, 0, 4.0)], 180.0)
	_wide = Vector3(9, 3.2, -4)

## the headquarters inside: a hall with screens and a long desk
func _set_hq_hall() -> void:
	room(20.0, 16.0, 5.0, Color(0.32, 0.34, 0.37), Color(0.5, 0.53, 0.56), Color(0.85, 0.92, 1.0))
	model(CITY + "reception.glb", 0, 0, 8.0, 4.5, 180.0)
	model(CITY + "tv-wall.glb", -4.0, 1.0, 12.6, 4.0, 180.0, false)
	model(CITY + "tv-wall.glb", 4.0, 1.0, 12.6, 4.0, 180.0, false)
	label("FDI", 0, 3.8, 12.7, Color(0.5, 0.8, 1.0), 160)
	_extras(["OFFICER", "SOLDIER"], [Vector3(-7, 0, 9), Vector3(7, 0, 4)], 180.0)

## an observation balcony over the city at dusk: a rail, the drop, the skyline beyond
func _set_balcony() -> void:
	box(Vector3(10.0, 0.25, 7.0), 0, -0.25, 1.0, mat(Color(0.4, 0.42, 0.45), 0.6), false)
	box(Vector3(10.0, 1.05, 0.12), 0, 0, 4.5, mat(Color(0.7, 0.85, 1.0, 0.3), 0.1), true)
	box(Vector3(10.0, 0.08, 0.2), 0, 1.05, 4.5, mat(Color(0.75, 0.77, 0.8), 0.3, 0.8), false)
	light(0, 3.0, 1.0, Color(1.0, 0.85, 0.6), 1.2, 10.0)
	_focus = p(0, 1.5, 40.0)
	_wide = Vector3(4, 2.0, -3)

## the briefing room: a long table round a holographic map of the city, screens on the wall
func _set_briefing() -> void:
	room(16.0, 14.0, 4.2, Color(0.22, 0.23, 0.26), Color(0.3, 0.32, 0.36), Color(0.75, 0.85, 1.0))
	box(Vector3(3.0, 0.85, 7.0), 0, 0, 5.0, mat(Color(0.12, 0.13, 0.15), 0.3, 0.6))
	var map := Fx.hologram("globe", Color(0.3, 0.85, 1.0), 2.0)
	_root.add_child(map)
	map.global_position = p(0, 0.85, 5.0)
	model(CITY + "tv-wall.glb", 0, 0.8, 10.5, 5.0, 180.0, false)
	label("OPERATION · EASTERN NEXUS", 0, 3.5, 10.6, Color(0.5, 0.85, 1.0), 64)
	_focus = p(0, 1.6, 5.0)
	_wide = Vector3(6.5, 3.0, 0)

## the eastern streets under attack: barricades across the road, burning cars, soldiers in cover
func _set_street_battle() -> void:
	var concrete := mat(Color(0.6, 0.6, 0.58), 0.95)
	for i in 4:
		box(Vector3(2.6, 1.0, 0.6), -6.0 + i * 4.0, 0, 6.0, concrete, true, 8.0 * float(i % 2))
	burnt(3, -7.0, 14.0, 60.0)
	burnt(0, 6.5, 18.0, -30.0)
	fire(0.0, 24.0, 1.8)
	vehicle("security-suv.glb", 8.0, 3.0, 100.0)
	_extras(["SOLDIER", "SOLDIER", "SOLDIER"], [Vector3(-5, 0, 5), Vector3(-1, 0, 5), Vector3(4, 0, 5)], 0.0)
	_wide = Vector3(9, 3.0, -4)

## the abandoned subway station: a long dark hall of pillars, the platform edge, failing lights
func _set_subway() -> void:
	room(14.0, 30.0, 5.0, Color(0.36, 0.36, 0.34), Color(0.45, 0.47, 0.44), Color(0.9, 0.95, 0.7), 6.0)
	box(Vector3(4.0, 0.0, 30.0), 5.0, -0.2, 12.0, mat(Color(0.05, 0.05, 0.06), 1.0), false)
	box(Vector3(0.25, 0.05, 30.0), 3.0, 0.0, 12.0, mat(Color(1.0, 0.8, 0.1), 0.6), false)
	for i in 4:
		cyl(0.4, 5.0, -2.5, 0, 2.0 + i * 6.5, mat(Color(0.55, 0.55, 0.52), 0.9))
	label("OLD QUARTER · LINE 4", -6.8, 2.8, 10.0, Color(1.0, 1.0, 1.0), 64, -90.0)
	_wide = Vector3(5, 2.8, -2)

## the eastern command post: tents, a map table, the vehicles, floodlights
func _set_command_post() -> void:
	tent(-6.0, 9.0, 6.0, 5.0, Color(0.36, 0.4, 0.3), 0.0)
	tent(6.0, 10.0, 6.0, 5.0, Color(0.36, 0.4, 0.3), 0.0)
	box(Vector3(2.4, 0.9, 1.4), 0, 0, 4.5, mat(Color(0.2, 0.22, 0.2), 0.8))
	var map := Fx.hologram("globe", Color(0.3, 0.85, 1.0), 1.2)
	_root.add_child(map)
	map.global_position = p(0, 0.9, 4.5)
	vehicle("security-suv.glb", -9.0, 2.0, 30.0)
	vehicle("offroad-truck.glb", 9.0, 3.0, -40.0)
	light(0, 4.0, 5.0, Color(1.0, 0.95, 0.85), 2.0, 18.0)
	_extras(["SOLDIER", "SOLDIER"], [Vector3(-3.5, 0, 9.5), Vector3(3.0, 0, 11.0)], 180.0)
	_focus = p(0, 1.4, 4.5)
	_wide = Vector3(8, 3.2, -3)

## the dimensional structure the figures speak from: broken slabs hanging in a violet dark, high over the city
func _set_void() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 1806
	box(Vector3(10.0, 0.6, 10.0), 0, -0.6, 6.0, mat(Color(0.14, 0.12, 0.17), 0.9), false)
	FractureSet.floating_ruins(_root, p(0, 0, 6.0), 22.0, 26, rng)
	FractureSet.crystals(_root, p(0, 0, 6.0), 4.5, 10, Color(0.7, 0.35, 1.0), rng)
	light(0, 6.0, 6.0, Color(0.6, 0.3, 1.0), 3.0, 30.0)
	_focus = p(0, 2.0, 6.0)
	_wide = Vector3(9, 2.5, -4)

## the old transit terminal at night: a canopy on steel posts, benches, the dead departures board, lamps in the rain
func _set_terminal() -> void:
	var steel := mat(Color(0.4, 0.42, 0.45), 0.4, 0.8)
	for i in 4:
		for x: float in [-5.0, 5.0]:
			cyl(0.18, 4.6, x, 0, -2.0 + i * 6.0, steel)
	box(Vector3(12.0, 0.25, 22.0), 0, 4.6, 7.0, mat(Color(0.55, 0.7, 0.8, 0.45), 0.1), false)
	box(Vector3(11.0, 0.3, 20.0), 0, -0.25, 7.0, mat(Color(0.5, 0.5, 0.48), 0.9), false)
	for i in 3:
		box(Vector3(0.6, 0.45, 2.2), -3.6, 0, 1.0 + i * 6.0, mat(Color(0.3, 0.2, 0.12), 0.7))
	box(Vector3(3.6, 1.3, 0.25), 2.0, 2.2, 12.0, mat(Color(0.03, 0.04, 0.05), 0.4), false)
	label("DEPARTURES\nSERVICE SUSPENDED", 2.0, 2.85, 11.85, Color(1.0, 0.55, 0.15), 48)
	label("OLD NEXUS CITY TRANSIT", 0, 5.4, -2.2, Color(0.4, 0.9, 1.0), 96)
	model(CITY + "street-lamp.glb", -7.0, 0, 4.0, 6.0)
	model(CITY + "street-lamp.glb", 7.0, 0, 10.0, 6.0)
	light(0, 4.0, 4.0, Color(1.0, 0.8, 0.5), 1.6, 14.0)
	_wide = Vector3(7, 3.0, -4)

## Haven-01: walls round the settlement with four gaps, watchtowers, the shelters, floodlights, soldiers and civilians
func _set_haven() -> void:
	var wall := mat(Color(0.5, 0.49, 0.46), 0.95)
	var r := 34.0
	var segs := 28
	for i in segs:
		var a0 := TAU * float(i) / float(segs)
		var gap := false
		for g in 4:
			if absf(wrapf(a0 - TAU * float(g) / 4.0 - PI * 0.5, -PI, PI)) < 0.12:
				gap = true
		if gap:
			continue
		var x := cos(a0) * r
		var z := sin(a0) * r + 10.0
		box(Vector3(7.8, 5.0, 1.2), x, 0, z, wall, true, rad_to_deg(a0) - 90.0)
	for g in 4:
		var a := TAU * float(g) / 4.0 + PI * 0.25
		var x2 := cos(a) * (r - 1.0)
		var z2 := sin(a) * (r - 1.0) + 10.0
		box(Vector3(3.2, 9.0, 3.2), x2, 0, z2, mat(Color(0.38, 0.38, 0.36), 0.9))
		box(Vector3(1.4, 0.5, 0.5), x2, 9.0, z2, mat(Color(1.0, 0.95, 0.8), 0.3, 0.0, 4.0), false)
		light(x2, 8.4, z2, Color(1.0, 0.92, 0.75), 2.2, 30.0)
	for i in 6:
		tent(-14.0 + float(i % 3) * 9.0, 4.0 + float(i / 3) * 10.0, 5.0, 4.0, Color(0.42, 0.45, 0.38), float(i * 7))
	vehicle("goliath-tank.glb", 12.0, 24.0, 0.0)
	vehicle("security-suv.glb", -12.0, 22.0, 20.0)
	label("HAVEN-01", 0, 6.5, 10.0 + r - 0.8, Color(1.0, 0.85, 0.4), 160, 180.0)
	_extras(["SOLDIER", "SOLDIER", "SOLDIER", "CIVILIAN", "CIVILIAN", "MEDIC"],
		[Vector3(-6, 0, 30), Vector3(6, 0, 30), Vector3(15, 0, 20), Vector3(-9, 0, 8), Vector3(-3, 0, 14), Vector3(5, 0, 6)], 180.0)
	_wide = Vector3(12, 5.0, -6)

## the northern observation tower at Haven-01: a platform up on legs looking out at the storm
func _set_tower() -> void:
	floor_y = _ground(anchor.x, anchor.z) + 12.0
	var steel := mat(Color(0.35, 0.36, 0.38), 0.5, 0.7)
	for x: float in [-4.0, 4.0]:
		for z: float in [-2.0, 6.0]:
			var leg := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.25
			cm.bottom_radius = 0.3
			cm.height = 12.0
			leg.mesh = cm
			leg.material_override = steel
			_root.add_child(leg)
			leg.global_position = p(x, -6.0, z, true)
	box(Vector3(10.0, 0.3, 10.0), 0, -0.3, 2.0, steel, false)
	box(Vector3(10.0, 1.1, 0.1), 0, 0, 7.0, mat(Color(0.7, 0.85, 1.0, 0.3), 0.1), false)
	var storm := Fx.portal(14.0, Color(0.6, 0.25, 1.0))
	_root.add_child(storm)
	storm.global_position = p(0, 14.0, 120.0, true)
	storm.rotation.y = yaw_of(0.0)
	light(0, 3.0, 2.0, Color(0.7, 0.8, 1.0), 1.2, 12.0)
	_focus = storm.global_position
	_wide = Vector3(5, 2.0, -3)

func operator_floor() -> float:
	return floor_y

## a battlefield: scorched craters, burning wrecks, crystals breaking through the road
func _set_battlefield() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 606
	for i in 4:
		cyl(3.0 + float(i), 0.05, -12.0 + i * 8.0, 0.02, 14.0 + float(i % 2) * 8.0, mat(Color(0.08, 0.07, 0.07), 1.0), false)
	burnt(1, -6.0, 9.0, 40.0)
	burnt(2, 7.0, 13.0, -50.0)
	vehicle("goliath-tank.glb", -12.0, 18.0, 70.0)
	fire(2.0, 20.0, 2.0)
	FractureSet.crystals(_root, p(0, 0, 26.0), 9.0, 14, Color(0.7, 0.3, 1.0), rng, func(x: float, z: float) -> float: return _ground(x, z))
	_wide = Vector3(11, 4.0, -6)

## the eastern evacuation corridor: civilians running for the transport, Cole's truck at the breach
func _set_corridor() -> void:
	_set_battlefield()
	var truck := vehicle("war-rig.glb", -4.0, 6.0, 0.0, false)
	_acts["truck"] = truck
	vehicle("tech-transport.glb", 6.0, -6.0, 180.0)
	_extras(["CIVILIAN", "CIVILIAN", "MAN", "CIVILIAN"], [Vector3(4, 0, -2), Vector3(5.5, 0, 0), Vector3(3, 0, 1.5), Vector3(7, 0, 2)], 180.0)

## the global broadcast: a screen over the plaza, the Harbinger's emblem on it
func _set_broadcast() -> void:
	model(CITY + "tv-wall.glb", 0, 3.0, 16.0, 12.0, 180.0, false)
	var h := Fx.hologram("emblem", Color(0.75, 0.3, 1.0), 3.0)
	_root.add_child(h)
	h.global_position = p(0, 0, 12.0)
	label("GLOBAL EMERGENCY BROADCAST", 0, 9.6, 15.6, Color(1.0, 0.3, 0.25), 120)
	_extras(["CIVILIAN", "CIVILIAN", "MAN", "SOLDIER"], [Vector3(-3, 0, 5), Vector3(-1, 0, 6), Vector3(2, 0, 5.5), Vector3(4, 0, 4)], 0.0)
	_focus = p(0, 6.0, 16.0)
	_wide = Vector3(4, 2.0, -6)

## the Old Quarter crater: a scorched bowl ringed with rubble, the FDI parked at its lip, the stair cut down into it
func _set_crater() -> void:
	cyl(14.0, 0.06, 0, 0.02, 16.0, mat(Color(0.09, 0.08, 0.08), 1.0), false)
	for i in 14:
		var a := TAU * float(i) / 14.0
		rocks(cos(a) * 15.0, 16.0 + sin(a) * 15.0, 2.0 + float(i % 3), float(i * 37))
	for i in 6:
		box(Vector3(2.4, 0.25, 1.0), 0, -0.25 - i * 0.35, 6.0 + i * 1.0, mat(Color(0.4, 0.38, 0.35), 0.95), false)
	vehicle("security-suv.glb", -8.0, 1.0, 40.0)
	vehicle("offroad-truck.glb", 8.0, 0.0, -30.0)
	fire(4.0, 18.0, 1.2)
	light(0, 2.0, 16.0, Color(0.7, 0.4, 1.0), 2.0, 18.0)
	_extras(["SOLDIER", "SOLDIER"], [Vector3(-5, 0, 2), Vector3(6, 0, 2.5)], 180.0)
	_focus = p(0, 0.5, 16.0)
	_wide = Vector3(9, 4.0, -4)

## the access shaft down: rough stone, markings glowing in groups of five
func _set_shaft() -> void:
	room(8.0, 22.0, 4.0, Color(0.26, 0.24, 0.22), Color(0.32, 0.3, 0.28), Color(1.0, 0.75, 0.4), 4.0)
	for i in 5:
		label("◇ ◇ ◇ ◇ ◇", -3.8, 2.0, 2.0 + i * 3.6, Color(1.0, 0.75, 0.35), 48, -90.0)
	_wide = Vector3(3, 2.4, -2)

## the Ashen Archive: a pillared hall, five statues on plinths round the dais and a sixth standing apart
func _set_archive() -> void:
	_archive(false)

## the archive's memory: the same hall, its keepers lit as the recording plays
func _set_memory() -> void:
	_archive(true)

func _archive(lit: bool) -> void:
	room(26.0, 30.0, 10.0, Color(0.3, 0.27, 0.24), Color(0.36, 0.33, 0.3), Color(1.0, 0.78, 0.45), 6.0)
	var stone := mat(Color(0.5, 0.47, 0.43), 0.95)
	for i in 5:
		for x: float in [-10.0, 10.0]:
			cyl(0.9, 10.0, x, 0, 1.0 + i * 5.5, stone)
	cyl(4.0, 0.6, 0, 0, 14.0, stone)
	cyl(2.6, 0.4, 0, 0.6, 14.0, stone, false)
	for i in 5:
		var a := -PI * 0.5 + TAU * float(i) / 5.0
		var x := cos(a) * 7.0
		var z := 14.0 + sin(a) * 7.0
		box(Vector3(1.6, 1.0, 1.6), x, 0, z, stone)
		_statue(x, 1.0, z, rad_to_deg(atan2(x, 14.0 - z)), lit)
	box(Vector3(1.6, 1.0, 1.6), 9.0, 0, 25.0, stone)
	_statue(9.0, 1.0, 25.0, 200.0, lit)
	if lit:
		var h := Fx.hologram("figure", Color(1.0, 0.8, 0.45), 3.0)
		_root.add_child(h)
		h.global_position = p(0, 1.0, 14.0)
	light(0, 6.0, 14.0, Color(1.0, 0.75, 0.4), 2.4, 30.0)
	_focus = p(0, 2.5, 14.0)
	_wide = Vector3(9, 3.6, 1)

func _statue(x: float, y: float, z: float, deg: float, lit: bool) -> void:
	var b := Player.new()
	_root.add_child(b)
	b.civilian = true
	b.build(CharacterStore.clean({ "frame": "cipher", "body": "male" if int(x) % 2 == 0 else "female" }))
	b.global_position = p(x, y, z)
	b.heading = yaw_of(deg)
	b.rig.rotation.y = b.heading
	b.scale = Vector3.ONE * 1.35
	var stone := mat(Color(0.62, 0.58, 0.52), 0.95) if not lit else mat(Color(1.0, 0.82, 0.5), 0.5, 0.0, 1.2)
	for mi in b.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).material_override = stone
	for ap in b.find_children("*", "AnimationPlayer", true, false):
		(ap as AnimationPlayer).pause()


# --------------------------------------------------------------------------------------------- Chapter 1 (8–10), Chapter 2 sets
## the first sanctuary on Aetherion, as the archive remembers it: a white plaza, the great gate, five pedestals
func _set_sanctuary() -> void:
	var white := mat(Color(0.86, 0.84, 0.78), 0.7)
	box(Vector3(36.0, 0.3, 36.0), 0, -0.3, 12.0, white, false)
	for x: float in [-6.0, 6.0]:
		box(Vector3(2.2, 14.0, 2.2), x, 0, 22.0, white)
	box(Vector3(14.4, 2.0, 2.4), 0, 14.0, 22.0, white, false)
	var gate := Fx.portal(5.2, Color(1.0, 0.85, 0.45))
	_root.add_child(gate)
	gate.global_position = p(0, 1.2, 22.0)
	gate.rotation.y = yaw_of(0.0)
	for i in 5:
		var a := PI + PI * float(i) / 4.0
		box(Vector3(1.4, 1.1, 1.4), cos(a) * 9.0, 0, 12.0 + sin(a) * -6.0, white)
		light(cos(a) * 9.0, 1.6, 12.0 + sin(a) * -6.0, Color(1.0, 0.85, 0.5), 1.4, 8.0)
	for x: float in [-15.0, 15.0]:
		for z: float in [2.0, 12.0, 22.0]:
			cyl(0.7, 9.0, x, 0, z, white)
	light(0, 6.0, 18.0, Color(1.0, 0.85, 0.55), 3.0, 34.0)
	_focus = p(0, 4.0, 22.0)
	_wide = Vector3(10, 4.0, -2)

## a camp: tents, a fire ring, crates, a truck
func _set_camp() -> void:
	tent(-5.0, 7.0, 4.0, 4.0, Color(0.35, 0.38, 0.3), 10.0)
	tent(4.5, 8.0, 4.0, 4.0, Color(0.38, 0.33, 0.26), -15.0)
	for i in 6:
		var a := TAU * float(i) / 6.0
		rocks(cos(a) * 1.1, 4.0 + sin(a) * 1.1, 0.4, i * 60.0)
	fire(0.0, 4.0, 0.6)
	for i in 3:
		box(Vector3(0.9, 0.7, 0.9), 7.5, 0, 2.0 + i * 1.0, mat(Color(0.3, 0.36, 0.26), 0.9))
	vehicle("offroad-truck.glb", -8.5, 2.0, 30.0)
	_focus = p(0, 1.0, 4.0)
	_wide = Vector3(7, 3.0, -4)

## a ranger village: timber huts under steep roofs, lanterns, a fence, villagers about
func _set_village() -> void:
	var wood := Color(0.36, 0.26, 0.17)
	tent(-7.0, 9.0, 5.0, 5.0, wood, 5.0)
	tent(0.0, 13.0, 6.0, 5.0, wood, 0.0)
	tent(7.5, 9.0, 5.0, 5.0, wood, -8.0)
	for i in 7:
		box(Vector3(2.4, 0.9, 0.12), -9.0 + i * 3.0, 0, 3.0, mat(wood.darkened(0.2), 0.9), true)
	for x: float in [-3.0, 3.0]:
		cyl(0.08, 2.6, x, 0, 6.0, mat(wood, 0.8))
		box(Vector3(0.3, 0.4, 0.3), x, 2.6, 6.0, mat(Color(1.0, 0.75, 0.4), 0.4, 0.0, 3.0), false)
		light(x, 2.7, 6.0, Color(1.0, 0.72, 0.4), 1.4, 9.0)
	_extras(["RANGER", "RANGER", "CIVILIAN"], [Vector3(-5, 0, 6), Vector3(5, 0, 7), Vector3(2, 0, 10)], 180.0)
	_wide = Vector3(8, 3.0, -4)

## deep forest: big trees close in, fallen logs, boulders
func _set_forest() -> void:
	for i in 8:
		var a := TAU * float(i) / 8.0 + 0.3
		model(FOLIAGE + ("conifer.glb" if i % 2 == 0 else "broadleaf.glb"), cos(a) * 11.0, 0, 8.0 + sin(a) * 11.0, 14.0 + float(i % 3) * 3.0, float(i * 40), true)
	model(FOLIAGE + "tree-dead.glb", -3.0, 0, 9.0, 7.0, 80.0, false)
	for i in 4:
		rocks(-5.0 + i * 3.5, 5.0 + float(i % 2) * 5.0, 1.4, i * 45.0)
	light(0, 6.0, 8.0, Color(0.7, 0.9, 0.7), 1.0, 20.0)
	_wide = Vector3(7, 2.6, -4)

## the falls: a curtain of falling water over a stone lip, the pool, wet rocks and the singer's hollow behind
func _set_falls() -> void:
	box(Vector3(14.0, 10.0, 3.0), 0, 0, 16.0, mat(Color(0.32, 0.33, 0.31), 0.95))
	box(Vector3(8.0, 9.0, 0.3), 0, 0.2, 14.2, mat(Color(0.75, 0.9, 1.0, 0.45), 0.05, 0.0, 0.8), false)
	cyl(7.0, 0.08, 0, 0.02, 10.0, mat(Color(0.2, 0.45, 0.55, 0.75), 0.05), false)
	for i in 8:
		rocks(-7.0 + i * 2.0, 6.0 + float(i % 3) * 1.5, 1.2 + float(i % 2), i * 33.0)
	for x: float in [-9.0, 9.0]:
		model(FOLIAGE + "broadleaf.glb", x, 0, 11.0, 12.0, x * 5.0)
	light(0, 3.0, 12.0, Color(0.6, 0.85, 1.0), 1.6, 16.0)
	_focus = p(0, 4.0, 14.0)
	_wide = Vector3(7, 2.4, -2)

## the ranger lodge at night: timber walls, a long table, a hearth's light
func _set_lodge() -> void:
	room(12.0, 12.0, 3.6, Color(0.3, 0.22, 0.15), Color(0.38, 0.28, 0.19), Color(1.0, 0.7, 0.4))
	box(Vector3(1.6, 0.8, 5.0), 0, 0, 4.0, mat(Color(0.3, 0.2, 0.12), 0.8))
	box(Vector3(2.4, 1.6, 0.8), -5.4, 0, 6.0, mat(Color(0.3, 0.29, 0.27), 0.95))
	light(-4.6, 0.8, 6.0, Color(1.0, 0.55, 0.25), 2.6, 10.0)
	model(CITY + "shelving.glb", 5.6, 0, 6.0, 2.4, -90.0)
	_wide = Vector3(4.5, 2.4, -1)

## the standing stones above the shrine: a ring of tall stones, the glyphs in their faces waking
func _set_stones() -> void:
	var stone := mat(Color(0.45, 0.46, 0.44), 0.95)
	for i in 7:
		var a := TAU * float(i) / 7.0
		var x := cos(a) * 8.0
		var z := 10.0 + sin(a) * 8.0
		box(Vector3(1.2, 4.2 + float(i % 3) * 0.8, 0.8), x, 0, z, stone, true, rad_to_deg(a) - 90.0)
		label("◇", x, 2.4, z, Color(0.5, 1.0, 0.7), 96, rad_to_deg(a) + 90.0)
	FractureSet.relic_container(_root, p(0, 0, 10.0), Color(0.5, 1.0, 0.7))
	light(0, 2.0, 10.0, Color(0.5, 1.0, 0.7), 2.0, 16.0)
	model(FOLIAGE + "conifer.glb", -12.0, 0, 16.0, 16.0, 0.0)
	model(FOLIAGE + "conifer.glb", 12.0, 0, 4.0, 15.0, 0.0)
	_focus = p(0, 1.5, 10.0)
	_wide = Vector3(9, 3.0, -2)

## a desert camp: sand-coloured tents, the buggies, crates and panels
func _set_desert_camp() -> void:
	var sand := Color(0.74, 0.62, 0.44)
	tent(-6.0, 8.0, 4.5, 4.0, sand, 0.0)
	tent(5.0, 10.0, 4.5, 4.0, sand.darkened(0.1), 20.0)
	vehicle("raider-buggy.glb", -9.0, 2.0, 60.0)
	vehicle("offroad-truck.glb", 9.0, 3.0, -50.0)
	for i in 4:
		box(Vector3(2.0, 0.08, 1.2), -3.0 + i * 2.2, 1.0, 15.0, mat(Color(0.1, 0.16, 0.3), 0.2, 0.6), false, 0.0)
		cyl(0.05, 1.0, -3.0 + i * 2.2, 0, 15.0, mat(Color(0.5, 0.5, 0.5), 0.5, 0.8), false)
	for i in 3:
		box(Vector3(0.9, 0.7, 0.9), 2.0 + i * 1.0, 0, 3.0, mat(Color(0.42, 0.36, 0.26), 0.9))
	_wide = Vector3(8, 3.0, -4)

## a desert road: rocks, a burnt-out car, the old barriers half buried
func _set_desert_road() -> void:
	for i in 6:
		rocks(-9.0 + i * 3.6, 10.0 + float(i % 3) * 3.0, 2.0 + float(i % 2) * 1.5, i * 50.0)
	burnt(3, 5.0, 14.0, 40.0, false)
	for i in 3:
		box(Vector3(2.6, 0.8, 0.6), -4.0 + i * 3.0, -0.3, 7.0, mat(Color(0.7, 0.66, 0.6), 0.95), true, 6.0 * float(i))
	_wide = Vector3(8, 3.0, -5)

## a market: stall canopies in faded colours, crates, a café table, lanterns, traders
func _set_market() -> void:
	var colours := [Color(0.7, 0.25, 0.2), Color(0.2, 0.45, 0.6), Color(0.75, 0.6, 0.2), Color(0.3, 0.5, 0.3)]
	for i in 4:
		var x := -9.0 + float(i) * 6.0
		for px: float in [-1.4, 1.4]:
			cyl(0.06, 2.4, x + px, 0, 10.0, mat(Color(0.4, 0.3, 0.2), 0.8))
		box(Vector3(3.2, 0.08, 2.4), x, 2.4, 10.0, mat(colours[i], 0.9), false)
		box(Vector3(2.8, 0.9, 1.0), x, 0, 10.6, mat(Color(0.4, 0.3, 0.2), 0.8))
	model(CITY + "cafe-set.glb", 4.0, 0, 4.0, 2.4)
	for i in 5:
		box(Vector3(0.8, 0.6, 0.8), -10.0 + i * 0.9, 0, 4.0, mat(Color(0.45, 0.36, 0.24), 0.9))
	box(Vector3(30.0, 4.0, 1.0), 0, 0, 20.0, mat(Color(0.8, 0.77, 0.7), 0.95))
	light(0, 3.0, 8.0, Color(1.0, 0.78, 0.5), 1.8, 18.0)
	_extras(["TRADER", "CIVILIAN", "CIVILIAN", "MAN"], [Vector3(-9, 0, 11.6), Vector3(-3, 0, 8), Vector3(3, 0, 11.6), Vector3(8, 0, 7)], 180.0)
	_wide = Vector3(9, 3.2, -3)

## the Ascendancy's dig: a pit, scaffold, floodlights, shielded crates
func _set_dig() -> void:
	cyl(7.0, 0.05, 0, 0.02, 12.0, mat(Color(0.18, 0.14, 0.1), 1.0), false)
	var steel := mat(Color(0.5, 0.52, 0.55), 0.4, 0.8)
	for x: float in [-5.0, 5.0]:
		for z: float in [7.0, 17.0]:
			cyl(0.08, 5.0, x, 0, z, steel)
	box(Vector3(10.4, 0.15, 10.4), 0, 5.0, 12.0, steel, false)
	for x: float in [-8.0, 8.0]:
		cyl(0.1, 6.0, x, 0, 4.0, steel)
		box(Vector3(1.0, 0.5, 0.4), x, 6.0, 4.0, mat(Color(1.0, 0.97, 0.85), 0.3, 0.0, 4.0), false)
		light(x, 5.6, 5.0, Color(1.0, 0.95, 0.85), 2.2, 22.0)
	for i in 4:
		box(Vector3(1.2, 0.9, 1.0), 9.0, 0, 8.0 + i * 1.4, mat(Color(0.85, 0.86, 0.9), 0.4, 0.2))
	label("ASCENDANCY · SITE 7", 0, 5.8, 6.8, Color(0.9, 0.8, 1.0), 72)
	_wide = Vector3(9, 4.0, -3)

## the glass map room: a vault of buried stone round a sheet of glass four metres across, drawing
func _set_map_room() -> void:
	room(16.0, 16.0, 6.0, Color(0.42, 0.36, 0.28), Color(0.5, 0.43, 0.33), Color(1.0, 0.85, 0.55))
	box(Vector3(5.0, 0.12, 3.2), 0, 1.0, 7.0, mat(Color(0.55, 0.85, 1.0, 0.35), 0.05, 0.0, 1.5), false)
	box(Vector3(5.2, 1.0, 3.4), 0, 0, 7.0, mat(Color(0.3, 0.26, 0.2), 0.9))
	label("· ◇  ·  ◇\n◇  ·  · ◇ ·\n·  ◇  ·", 0, 1.2, 7.0, Color(0.6, 0.9, 1.0), 64, 180.0)
	light(0, 2.5, 7.0, Color(0.5, 0.85, 1.0), 2.0, 12.0)
	_focus = p(0, 1.2, 7.0)
	_wide = Vector3(6, 3.4, -1)

## the Ribcage: the bones of something enormous arching out of the sand, a cartographer's fire beneath them
func _set_ribcage() -> void:
	var bone := mat(Color(0.86, 0.82, 0.72), 0.8)
	for i in 6:
		var z := 4.0 + float(i) * 4.0
		for side: float in [-1.0, 1.0]:
			var mi := MeshInstance3D.new()
			var tm := TorusMesh.new()
			tm.inner_radius = 9.0 - float(i) * 0.4
			tm.outer_radius = tm.inner_radius + 0.7
			mi.mesh = tm
			mi.material_override = bone
			_root.add_child(mi)
			mi.global_position = p(0, 0, z)
			mi.rotation = Vector3(0, yaw_of(0.0), PI * 0.5)
			if side > 0.0:
				break
	fire(0.0, 10.0, 0.6)
	rocks(1.4, 10.0, 0.6, 0.0)
	_focus = p(0, 1.0, 10.0)
	_wide = Vector3(10, 3.0, -4)

## the dragon wall: a canyon shrine of painted panels — dragons beside people, one figure scraped and repainted
func _set_murals() -> void:
	room(14.0, 14.0, 7.0, Color(0.5, 0.38, 0.26), Color(0.62, 0.46, 0.3), Color(1.0, 0.75, 0.45), 6.0, false)
	var paints := [Color(0.7, 0.3, 0.15), Color(0.25, 0.3, 0.45), Color(0.8, 0.65, 0.3), Color(0.35, 0.2, 0.15)]
	for i in 4:
		box(Vector3(2.6, 3.2, 0.05), -5.0 + float(i) * 3.3, 1.2, 10.7, mat(paints[i], 0.9, 0.0, 0.25), false)
	label("DRAGON · KEEPER · DRAGON · KEEPER", 0, 4.8, 10.6, Color(1.0, 0.85, 0.6), 72)
	box(Vector3(1.0, 2.4, 0.05), 6.2, 1.4, 10.7, mat(Color(0.95, 0.95, 0.9), 0.6, 0.0, 0.6), false)
	_focus = p(0, 2.5, 10.7)
	_wide = Vector3(4, 2.6, 1)


# --------------------------------------------------------------------------------------------- Chapter 3 sets
## a Neon City street at night: wet road, signs in violet and cyan, parked tuners, a food stall
func _set_neon_street() -> void:
	vehicle("tuner.glb", -6.5, 6.0, 0.0)
	vehicle("street-racer.glb", 6.5, 9.0, 180.0)
	var glow := [Color(0.85, 0.3, 1.0), Color(0.2, 0.95, 1.0), Color(1.0, 0.35, 0.55)]
	for i in 3:
		box(Vector3(3.0, 0.9, 0.1), -6.0 + float(i) * 6.0, 4.0, 15.0, mat(glow[i], 0.4, 0.0, 3.5), false)
		light(-6.0 + float(i) * 6.0, 3.5, 14.0, glow[i], 1.8, 12.0)
	label("NOODLES · 24H", 6.0, 3.0, 13.0, Color(1.0, 0.4, 0.7), 72)
	model(CITY + "street-lamp.glb", -8.5, 0, 12.0, 6.0)
	_extras(["CIVILIAN", "MAN", "CIVILIAN"], [Vector3(-3, 0, 12), Vector3(4, 0, 12), Vector3(8, 0, 5)], 180.0)
	_wide = Vector3(7, 3.0, -4)

## a back room in the Underground: a desk under a hanging lamp, screens, crates of other people's secrets
func _set_backroom() -> void:
	room(8.0, 9.0, 3.2, Color(0.12, 0.1, 0.12), Color(0.2, 0.16, 0.2), Color(1.0, 0.5, 0.8))
	model(CITY + "office-desk.glb", 0, 0, 3.6, 2.2, 180.0)
	model(CITY + "tv-wall.glb", 0, 0.9, 5.7, 3.2, 180.0, false)
	model(CITY + "sofa.glb", -2.8, 0, 1.0, 2.2, 90.0)
	for i in 3:
		box(Vector3(0.8, 0.7, 0.8), 3.0, 0, 1.0 + float(i) * 0.9, mat(Color(0.25, 0.22, 0.2), 0.9))
	_wide = Vector3(3, 2.2, -1)

## the Vault Under the Grid: old concrete and older stone beneath it, a round door, the record's cradle
func _set_vault() -> void:
	room(14.0, 16.0, 5.0, Color(0.3, 0.3, 0.32), Color(0.4, 0.4, 0.42), Color(0.75, 0.6, 1.0))
	cyl(2.2, 0.4, 0, 0, 11.0, mat(Color(0.25, 0.25, 0.27), 0.5, 0.8))
	FractureSet.relic_container(_root, p(0, 0.4, 11.0), Color(0.75, 0.5, 1.0))
	var door := cyl(2.6, 0.5, 0, 0, -2.6, mat(Color(0.45, 0.46, 0.5), 0.35, 0.9), false)
	door.rotation.x = PI * 0.5
	door.global_position = p(-4.0, 2.6, -2.6)
	model(CITY + "shelving.glb", 6.2, 0, 6.0, 2.6, -90.0)
	_focus = p(0, 1.4, 11.0)
	_wide = Vector3(5, 2.8, 0)

## the harbour: container stacks, a crane leg, bollards and the black water
func _set_docks() -> void:
	var cols := [Color(0.6, 0.15, 0.12), Color(0.12, 0.3, 0.55), Color(0.2, 0.45, 0.25), Color(0.7, 0.55, 0.15)]
	for i in 6:
		box(Vector3(2.5, 2.6, 6.1), -10.0 + float(i % 3) * 3.0, float(i / 3) * 2.6, 12.0, mat(cols[i % 4], 0.7, 0.3), i < 3)
	for i in 4:
		box(Vector3(2.5, 2.6, 6.1), 8.0, float(i % 2) * 2.6, 6.0 + float(i / 2) * 6.5, mat(cols[(i + 1) % 4], 0.7, 0.3), i % 2 == 0)
	box(Vector3(30.0, 0.1, 10.0), 0, -0.5, 26.0, mat(Color(0.03, 0.05, 0.08, 0.9), 0.05, 0.3), false)
	for i in 5:
		cyl(0.25, 0.6, -8.0 + float(i) * 4.0, 0, 20.5, mat(Color(0.2, 0.2, 0.22), 0.6, 0.8))
	model(CITY + "street-lamp.glb", 3.0, 0, 18.0, 6.0)
	_wide = Vector3(6, 3.0, -4)

## the abbey on the isle: weathered walls, an arch, banners of the Continuum's broken circle
func _set_abbey() -> void:
	var stone := mat(Color(0.62, 0.6, 0.56), 0.95)
	for x: float in [-9.0, 9.0]:
		box(Vector3(1.4, 8.0, 18.0), x, 0, 12.0, stone)
	box(Vector3(18.0, 8.0, 1.4), 0, 0, 21.0, stone)
	for x: float in [-2.6, 2.6]:
		box(Vector3(1.6, 6.0, 1.6), x, 0, 3.0, stone)
	box(Vector3(7.0, 1.4, 1.6), 0, 6.0, 3.0, stone, false)
	for x: float in [-5.0, 5.0]:
		box(Vector3(1.4, 3.0, 0.05), x, 3.5, 20.2, mat(Color(0.08, 0.08, 0.1), 0.9), false)
		label("◯", x, 5.0, 20.1, Color(0.9, 0.9, 1.0), 96)
	light(0, 5.0, 12.0, Color(0.85, 0.9, 1.0), 2.0, 22.0)
	_wide = Vector3(7, 3.4, -4)

## the Continuity Engine: a ring of conduits round an Astryan core, predictions written in light on the walls
func _set_engine() -> void:
	room(20.0, 20.0, 8.0, Color(0.16, 0.17, 0.2), Color(0.22, 0.23, 0.27), Color(0.6, 0.8, 1.0), 6.0)
	cyl(2.4, 1.0, 0, 0, 10.0, mat(Color(0.3, 0.32, 0.36), 0.4, 0.8))
	var core := Fx.hologram("globe", Color(0.55, 0.8, 1.0), 3.0)
	_root.add_child(core)
	core.global_position = p(0, 1.0, 10.0)
	for i in 8:
		var a := TAU * float(i) / 8.0
		FractureSet.conduit(_root, p(cos(a) * 8.0, 0.4, 10.0 + sin(a) * 8.0), p(0, 3.0, 10.0), Color(0.55, 0.8, 1.0), 0.12)
	for i in 3:
		label("◇ → ◇ → ◇ → ·", -9.6, 3.0 + float(i) * 1.2, 4.0 + float(i) * 4.0, Color(0.6, 0.85, 1.0), 64, -90.0)
	light(0, 4.0, 10.0, Color(0.55, 0.8, 1.0), 3.0, 22.0)
	_focus = p(0, 2.5, 10.0)
	_wide = Vector3(7, 3.2, 0)

## inside a transport: benches down both sides, red cabin light, the hum of the engines
func _set_transport() -> void:
	room(4.2, 10.0, 2.6, Color(0.2, 0.21, 0.22), Color(0.3, 0.31, 0.32), Color(1.0, 0.3, 0.25), 2.0)
	for x: float in [-1.7, 1.7]:
		box(Vector3(0.6, 0.45, 7.0), x, 0, 3.0, mat(Color(0.22, 0.24, 0.2), 0.8))
	_wide = Vector3(1.4, 2.0, -1.8)


# --------------------------------------------------------------------------------------------- Chapter 4 sets (Thalassia)
## under the sea: a glass dome on ribs, the deep blue beyond, kelp light moving
func _undersea(w: float, d: float, h: float) -> void:
	room(w, d, h, Color(0.22, 0.28, 0.32), Color(0.2, 0.42, 0.5, 0.55), Color(0.4, 0.85, 1.0), 6.0, false)
	for i in 5:
		var z := -2.0 + float(i) * d / 5.0
		var mi := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = w * 0.5 - 0.2
		tm.outer_radius = w * 0.5
		mi.mesh = tm
		mi.material_override = mat(Color(0.75, 0.8, 0.82), 0.3, 0.8)
		_root.add_child(mi)
		mi.global_position = p(0, 0, z)
		mi.rotation = Vector3(PI * 0.5, yaw_of(90.0), 0)
	light(0, h - 1.0, d * 0.4, Color(0.3, 0.7, 1.0), 2.0, 26.0)

func _set_dome() -> void:
	_undersea(18.0, 22.0, 9.0)
	for i in 4:
		model(CITY + "planter.glb", -6.0 + float(i) * 4.0, 0, 9.0, 1.6)
	model(CITY + "cafe-set.glb", 5.0, 0, 4.0, 2.4)
	_extras(["CIVILIAN", "MAN", "CIVILIAN"], [Vector3(-4, 0, 10), Vector3(3, 0, 12), Vector3(6, 0, 7)], 180.0)
	_wide = Vector3(6, 3.2, -1)

func _set_farms() -> void:
	_undersea(18.0, 24.0, 7.0)
	for i in 6:
		box(Vector3(2.0, 0.8, 8.0), -7.0 + float(i) * 2.8, 0, 10.0, mat(Color(0.18, 0.4, 0.3), 0.9))
		box(Vector3(1.8, 0.4, 7.8), -7.0 + float(i) * 2.8, 0.8, 10.0, mat(Color(0.25, 0.75, 0.45), 0.8, 0.0, 0.6), false)
	_wide = Vector3(6, 3.0, -1)

func _set_tubes() -> void:
	_undersea(7.0, 28.0, 4.5)
	box(Vector3(1.2, 0.2, 26.0), -1.6, 0, 11.0, mat(Color(0.6, 0.62, 0.66), 0.4, 0.8), false)
	box(Vector3(1.2, 0.2, 26.0), 1.6, 0, 11.0, mat(Color(0.6, 0.62, 0.66), 0.4, 0.8), false)
	_wide = Vector3(2, 2.2, -2)

## the containment ring: thick bulkheads, warning light, the inner wall humming with the voice
func _set_ring() -> void:
	room(16.0, 20.0, 7.0, Color(0.18, 0.19, 0.2), Color(0.3, 0.31, 0.32), Color(1.0, 0.55, 0.2), 4.0)
	for i in 4:
		box(Vector3(16.0, 7.0, 0.6), 0, 0, 2.0 + float(i) * 4.5, mat(Color(0.4, 0.38, 0.32), 0.5, 0.8), false)
	label("CONTAINMENT RING · DO NOT OPEN", 0, 5.2, 15.6, Color(1.0, 0.55, 0.2), 72)
	light(0, 3.5, 14.0, Color(0.5, 0.8, 1.0), 2.0, 14.0)
	_focus = p(0, 2.0, 16.0)
	_wide = Vector3(5, 2.6, -1)

## the still pool: a dark round chamber of liquid memory, faint lights drifting in it
func _set_pool() -> void:
	room(20.0, 20.0, 9.0, Color(0.12, 0.13, 0.16), Color(0.16, 0.18, 0.22), Color(0.4, 0.8, 1.0), 4.0)
	cyl(7.0, 0.1, 0, 0.02, 10.0, mat(Color(0.25, 0.6, 0.85, 0.7), 0.02, 0.2, 1.2), false)
	var rng := RandomNumberGenerator.new()
	rng.seed = 2707
	FractureSet.crystals(_root, p(0, 0, 10.0), 6.0, 9, Color(0.45, 0.85, 1.0), rng)
	light(0, 1.0, 10.0, Color(0.4, 0.8, 1.0), 3.0, 18.0)
	_focus = p(0, 0.8, 10.0)
	_wide = Vector3(7, 3.0, 0)

func _set_garden() -> void:
	_undersea(20.0, 22.0, 10.0)
	for i in 6:
		model(FOLIAGE + ("palm-a.glb" if i % 2 == 0 else "broadleaf.glb"), -8.0 + float(i) * 3.2, 0, 13.0 + float(i % 2) * 3.0, 5.0 + float(i % 3), float(i * 30), false)
	for i in 3:
		model(CITY + "planter.glb", -4.0 + float(i) * 4.0, 0, 7.0, 1.8)
	_wide = Vector3(7, 3.2, -1)

## the drowned palace: tall columns, a throne dais, the Astryan antenna above it
func _set_palace() -> void:
	room(22.0, 24.0, 12.0, Color(0.3, 0.33, 0.36), Color(0.4, 0.46, 0.5), Color(0.6, 0.9, 1.0), 6.0)
	for i in 4:
		for x: float in [-8.0, 8.0]:
			cyl(0.9, 12.0, x, 0, 2.0 + float(i) * 5.0, mat(Color(0.7, 0.75, 0.78), 0.5, 0.2))
	box(Vector3(6.0, 1.0, 4.0), 0, 0, 17.0, mat(Color(0.55, 0.6, 0.62), 0.6))
	cyl(0.2, 8.0, 0, 1.0, 18.0, mat(Color(0.7, 0.8, 0.9), 0.3, 0.9))
	var h := Fx.hologram("emblem", Color(0.5, 0.9, 1.0), 2.0)
	_root.add_child(h)
	h.global_position = p(0, 1.0, 16.0)
	_focus = p(0, 3.0, 17.0)
	_wide = Vector3(8, 3.6, 0)

## the sea at night: a port platform over black water, the Witness's light standing on the waves
func _set_sea() -> void:
	box(Vector3(14.0, 0.4, 10.0), 0, -0.4, 2.0, mat(Color(0.35, 0.36, 0.38), 0.7, 0.4), false)
	box(Vector3(80.0, 0.05, 80.0), 0, -1.2, 40.0, mat(Color(0.02, 0.05, 0.09, 0.95), 0.04, 0.3), false)
	var w := Fx.hologram("figure", Color(1.0, 0.97, 0.9), 4.0)
	_root.add_child(w)
	w.global_position = p(0, -1.2, 24.0, true)
	light(0, 3.0, 24.0, Color(1.0, 0.97, 0.9), 3.0, 30.0)
	_focus = p(0, 1.5, 24.0, true)
	_wide = Vector3(3, 2.0, -4)


# --------------------------------------------------------------------------------------------- Chapter 5 sets (Frostveil)
## a cold camp on the ice: tents, a tracked truck, flare stakes, snowbanks
func _set_snow_camp() -> void:
	var snow := mat(Color(0.88, 0.92, 0.96), 0.9)
	tent(-6.0, 8.0, 4.0, 4.0, Color(0.7, 0.2, 0.15), 0.0)
	tent(5.0, 9.0, 4.0, 4.0, Color(0.75, 0.55, 0.15), 15.0)
	vehicle("offroad-truck.glb", -9.0, 2.0, 40.0)
	for i in 6:
		box(Vector3(3.0, 0.9, 1.6), -10.0 + float(i) * 4.0, -0.3, 16.0 + float(i % 2), snow, false, float(i * 9))
	for x: float in [-3.0, 3.0]:
		cyl(0.05, 1.4, x, 0, 4.0, mat(Color(0.4, 0.4, 0.4), 0.6))
		box(Vector3(0.15, 0.2, 0.15), x, 1.4, 4.0, mat(Color(1.0, 0.3, 0.2), 0.4, 0.0, 4.0), false)
		light(x, 1.6, 4.0, Color(1.0, 0.35, 0.2), 1.4, 8.0)
	_wide = Vector3(7, 3.0, -4)

## the research station inside: steel walls, frosted windows, bunks and consoles
func _set_station() -> void:
	room(14.0, 14.0, 3.6, Color(0.35, 0.37, 0.4), Color(0.6, 0.63, 0.66), Color(0.9, 0.95, 1.0))
	for i in 3:
		model(CITY + "office-desk.glb", -5.0, 0, 2.0 + float(i) * 3.0, 2.2, 90.0)
		model(CITY + "bed.glb", 5.0, 0, 2.0 + float(i) * 3.0, 2.0, -90.0)
	box(Vector3(4.0, 1.4, 0.06), 0, 1.4, 10.8, mat(Color(0.8, 0.9, 1.0, 0.45), 0.1), false)
	_wide = Vector3(4.5, 2.4, -1)

## the star readers' observatory: a round hall, the great lens tilted at the sky, the aurora beyond
func _set_observatory() -> void:
	room(18.0, 18.0, 10.0, Color(0.3, 0.3, 0.34), Color(0.4, 0.4, 0.46), Color(0.6, 1.0, 0.75), 5.0, false)
	cyl(2.0, 1.2, 0, 0, 9.0, mat(Color(0.35, 0.36, 0.4), 0.4, 0.8))
	var lens := cyl(1.8, 0.3, 0, 4.0, 9.0, mat(Color(0.6, 0.9, 1.0, 0.5), 0.05, 0.0, 1.5), false)
	lens.rotation.x = deg_to_rad(55.0)
	cyl(0.35, 4.0, 0, 1.2, 9.0, mat(Color(0.5, 0.5, 0.55), 0.4, 0.8), false)
	light(0, 5.0, 9.0, Color(0.5, 1.0, 0.7), 2.4, 20.0)
	_focus = p(0, 4.2, 9.0)
	_wide = Vector3(6, 3.0, 0)

## the ice cavern: blue walls closing in, frozen pillars, a faint light under the floor
func _set_ice_cave() -> void:
	room(14.0, 22.0, 8.0, Color(0.6, 0.75, 0.85), Color(0.55, 0.75, 0.9, 0.85), Color(0.6, 0.85, 1.0), 4.0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 3434
	FractureSet.crystals(_root, p(0, 0, 10.0), 6.0, 12, Color(0.65, 0.9, 1.0), rng)
	_wide = Vector3(4, 2.6, -1)

## the chair of ice: a throne on a dais, the crown on its seat, the veiled woman preserved in the wall behind
func _set_throne() -> void:
	room(18.0, 20.0, 9.0, Color(0.6, 0.75, 0.85), Color(0.55, 0.75, 0.9, 0.85), Color(0.7, 0.85, 1.0), 4.0)
	var ice := mat(Color(0.75, 0.9, 1.0, 0.75), 0.05, 0.0, 0.4)
	box(Vector3(6.0, 0.8, 4.0), 0, 0, 12.0, ice)
	box(Vector3(1.8, 1.0, 1.4), 0, 0.8, 12.6, ice)
	box(Vector3(1.8, 2.6, 0.4), 0, 1.8, 13.2, ice)
	var crown := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.18
	tm.outer_radius = 0.26
	crown.mesh = tm
	crown.material_override = mat(Color(0.9, 0.95, 1.0), 0.2, 0.9, 1.5)
	_root.add_child(crown)
	crown.global_position = p(0, 1.95, 12.5)
	_acts["crown"] = crown
	var veiled := Player.new()
	_root.add_child(veiled)
	veiled.civilian = true
	veiled.build(look_of("SERAPHINE"))
	veiled.global_position = p(0, 0.8, 15.5)
	veiled.heading = yaw_of(180.0)
	veiled.rig.rotation.y = veiled.heading
	_holo(veiled, Color(0.8, 0.9, 1.0))
	for ap in veiled.find_children("*", "AnimationPlayer", true, false):
		(ap as AnimationPlayer).pause()
	cast["VEILED SOVEREIGN"] = veiled
	box(Vector3(5.0, 4.0, 0.3), 0, 0.8, 15.0, mat(Color(0.7, 0.85, 1.0, 0.35), 0.05), false)
	light(0, 3.0, 12.5, Color(0.75, 0.9, 1.0), 2.2, 16.0)
	_focus = p(0, 2.0, 12.5)
	_wide = Vector3(6, 3.0, 2)

## the Architect's citadel: black stone and white light, long and high and very still
func _set_citadel() -> void:
	room(20.0, 26.0, 14.0, Color(0.08, 0.08, 0.1), Color(0.12, 0.12, 0.15), Color(0.95, 0.95, 1.0), 6.0)
	for i in 4:
		for x: float in [-7.0, 7.0]:
			box(Vector3(1.2, 14.0, 1.2), x, 0, 2.0 + float(i) * 5.5, mat(Color(0.15, 0.15, 0.18), 0.3, 0.6))
			box(Vector3(0.15, 12.0, 0.15), x * 0.93, 1.0, 2.0 + float(i) * 5.5, mat(Color(0.95, 0.95, 1.0), 0.3, 0.0, 3.0), false)
	box(Vector3(5.0, 0.6, 4.0), 0, 0, 19.0, mat(Color(0.2, 0.2, 0.24), 0.3, 0.6))
	label("◯", 0, 8.0, 22.6, Color(0.95, 0.95, 1.0), 240)
	_focus = p(0, 2.0, 19.0)
	_wide = Vector3(7, 3.6, 0)


# --------------------------------------------------------------------------------------------- Chapter 6 sets
## the Obsidian Reach: black rock, lava light, an ash-grey camp
func _set_lava_camp() -> void:
	tent(-5.0, 8.0, 4.0, 4.0, Color(0.3, 0.3, 0.3), 0.0)
	vehicle("war-rig.glb", 7.0, 6.0, -20.0)
	for i in 6:
		model(FOLIAGE + "rocks.glb", -10.0 + float(i) * 4.0, -0.2, 16.0 + float(i % 2) * 3.0, 3.0, float(i * 50), true)
	box(Vector3(12.0, 0.05, 2.0), 0, 0.02, 20.0, mat(Color(1.0, 0.35, 0.05), 0.6, 0.0, 4.0), false)
	light(0, 1.0, 20.0, Color(1.0, 0.4, 0.1), 3.0, 22.0)
	_wide = Vector3(8, 3.0, -4)

## the Astryan foundry: a great hall of black iron, forge chambers glowing along the walls
func _set_forge() -> void:
	room(22.0, 26.0, 12.0, Color(0.14, 0.12, 0.11), Color(0.2, 0.17, 0.15), Color(1.0, 0.5, 0.2), 6.0)
	for i in 4:
		for x: float in [-9.0, 9.0]:
			box(Vector3(3.0, 5.0, 3.0), x, 0, 2.0 + float(i) * 5.5, mat(Color(0.25, 0.22, 0.2), 0.5, 0.7))
			box(Vector3(2.0, 2.0, 0.1), x * 0.84, 1.5, 2.0 + float(i) * 5.5, mat(Color(1.0, 0.45, 0.1), 0.6, 0.0, 4.0), false)
	cyl(3.0, 2.0, 0, 0, 16.0, mat(Color(0.3, 0.26, 0.22), 0.4, 0.8))
	FractureSet.conduit(_root, p(0, 2.0, 16.0), p(0, 11.0, 16.0), Color(1.0, 0.5, 0.15), 0.3)
	light(0, 4.0, 16.0, Color(1.0, 0.5, 0.15), 3.0, 26.0)
	_focus = p(0, 2.5, 16.0)
	_wide = Vector3(8, 3.6, 0)

## Obsidian Ridge: a black spine of rock, and on it a door standing in the air
func _set_ridge() -> void:
	for i in 8:
		model(FOLIAGE + "boulder.glb", -14.0 + float(i) * 4.0, -0.4, 14.0 + float(i % 3) * 2.0, 3.0 + float(i % 2) * 2.0, float(i * 40), true)
	var door := Fx.portal(4.0, Color(0.55, 0.2, 0.9))
	_root.add_child(door)
	door.global_position = p(0, 0.5, 18.0)
	door.rotation.y = yaw_of(0.0)
	light(0, 4.0, 18.0, Color(0.6, 0.25, 1.0), 3.0, 24.0)
	_focus = p(0, 3.0, 18.0)
	_wide = Vector3(9, 3.4, -4)

## Old Harrow: timber-framed houses round a market square, a well, lanterns
func _set_harrow() -> void:
	var wood := Color(0.42, 0.3, 0.2)
	var plaster := Color(0.85, 0.8, 0.7)
	for i in 3:
		box(Vector3(6.0, 5.0, 5.0), -10.0 + float(i) * 10.0, 0, 16.0, mat(plaster, 0.9))
		tent(-10.0 + float(i) * 10.0, 16.0, 6.0, 5.0, wood, 0.0)
	cyl(1.0, 0.9, 0, 0, 8.0, mat(Color(0.5, 0.48, 0.44), 0.95))
	for x: float in [-4.0, 4.0]:
		cyl(0.08, 3.0, x, 0, 5.0, mat(wood, 0.8))
		light(x, 3.0, 5.0, Color(1.0, 0.75, 0.4), 1.4, 10.0)
	_extras(["CIVILIAN", "MAN"], [Vector3(-5, 0, 10), Vector3(6, 0, 11)], 180.0)
	_wide = Vector3(8, 3.0, -4)

## the cathedral: a nave of grey stone, candles, a rose window glowing at the end
func _set_cathedral() -> void:
	room(14.0, 30.0, 14.0, Color(0.4, 0.38, 0.35), Color(0.55, 0.52, 0.48), Color(1.0, 0.8, 0.55), 4.0)
	for i in 5:
		for x: float in [-4.5, 4.5]:
			cyl(0.7, 14.0, x, 0, 1.0 + float(i) * 5.0, mat(Color(0.55, 0.52, 0.48), 0.9))
	for i in 4:
		box(Vector3(3.0, 0.5, 0.6), -1.8, 0, 3.0 + float(i) * 2.5, mat(Color(0.32, 0.22, 0.14), 0.8))
		box(Vector3(3.0, 0.5, 0.6), 1.8 + 0.0, 0, 3.0 + float(i) * 2.5, mat(Color(0.32, 0.22, 0.14), 0.8))
	cyl(3.0, 0.1, 0, 7.0, 26.6, mat(Color(0.7, 0.4, 0.8, 0.8), 0.3, 0.0, 2.0), false).rotation.x = PI * 0.5
	light(0, 6.0, 22.0, Color(1.0, 0.75, 0.5), 2.0, 24.0)
	_focus = p(0, 7.0, 26.6)
	_wide = Vector3(4, 3.4, 0)

## the Wastelands: cracked highway, scrap, a burnt rig, dust
func _set_wasteland() -> void:
	burnt(2, -7.0, 10.0, 30.0)
	burnt(1, 8.0, 16.0, -60.0, false)
	vehicle("raider-buggy.glb", 4.0, 4.0, -120.0)
	for i in 5:
		model(FOLIAGE + "rocks.glb", -12.0 + float(i) * 6.0, -0.2, 22.0, 3.0, float(i * 70), true)
	model(FOLIAGE + "tree-dead.glb", -4.0, 0, 18.0, 6.0, 30.0, false)
	_wide = Vector3(9, 3.2, -5)

## the Underground's gate: a blast door in a cliff, floodlights, a queue of the desperate
func _set_vault_gate() -> void:
	box(Vector3(26.0, 14.0, 3.0), 0, 0, 20.0, mat(Color(0.45, 0.38, 0.3), 0.95))
	var door := cyl(5.0, 0.6, 0, 0, 18.4, mat(Color(0.5, 0.52, 0.55), 0.35, 0.9), false)
	door.rotation.x = PI * 0.5
	door.global_position = p(0, 5.0, 18.4)
	for x: float in [-9.0, 9.0]:
		box(Vector3(1.0, 0.6, 0.4), x, 8.0, 18.2, mat(Color(1.0, 0.95, 0.8), 0.3, 0.0, 4.0), false)
		light(x, 7.5, 16.0, Color(1.0, 0.95, 0.8), 2.4, 22.0)
	_extras(["CIVILIAN", "CIVILIAN", "MAN", "CIVILIAN", "MEDIC"], [Vector3(-6, 0, 8), Vector3(-3, 0, 9), Vector3(0, 0, 8), Vector3(3, 0, 9.5), Vector3(6, 0, 8)], 0.0)
	_focus = p(0, 5.0, 18.4)
	_wide = Vector3(8, 3.4, -4)

## the Underground City: a vault hall turned into a town — stalls, bunks, cables and warm light
func _set_underground() -> void:
	room(20.0, 22.0, 8.0, Color(0.3, 0.28, 0.25), Color(0.36, 0.33, 0.3), Color(1.0, 0.8, 0.5), 5.0)
	for i in 3:
		box(Vector3(3.0, 0.08, 2.0), -6.0 + float(i) * 6.0, 2.2, 12.0, mat(Color(0.6, 0.3, 0.2), 0.9), false)
		box(Vector3(2.6, 0.9, 0.9), -6.0 + float(i) * 6.0, 0, 12.6, mat(Color(0.35, 0.26, 0.18), 0.8))
	box(Vector3(2.6, 0.8, 4.0), 0, 0, 5.0, mat(Color(0.3, 0.22, 0.15), 0.8))
	_extras(["CIVILIAN", "MAN", "TRADER"], [Vector3(-6, 0, 11), Vector3(0, 0, 11), Vector3(6, 0, 11)], 180.0)
	_wide = Vector3(7, 3.0, -1)


# --------------------------------------------------------------------------------------------- Chapter 7 sets (the Origin Engine)
## an Astryan hall: pale stone and gold light, glyph-lit terminals, the far wall open on a folded sky
func _astryan(w: float, d: float, h: float, lamp: Color) -> void:
	room(w, d, h, Color(0.82, 0.8, 0.74), Color(0.88, 0.86, 0.8), lamp, 6.0)
	for i in int(d / 6.0):
		for x: float in [-w * 0.5 + 1.2, w * 0.5 - 1.2]:
			cyl(0.5, h, x, 0, float(i) * 6.0, mat(Color(0.9, 0.88, 0.82), 0.6))
			box(Vector3(0.1, h * 0.8, 0.1), x * 0.9, 0.5, float(i) * 6.0, mat(Color(1.0, 0.85, 0.5), 0.4, 0.0, 2.5), false)

func _set_astryan_hall() -> void:
	_astryan(18.0, 24.0, 10.0, Color(1.0, 0.88, 0.6))
	for i in 3:
		box(Vector3(1.2, 1.4, 0.6), -4.0 + float(i) * 4.0, 0, 12.0, mat(Color(0.75, 0.73, 0.68), 0.4, 0.6))
		box(Vector3(1.0, 0.7, 0.05), -4.0 + float(i) * 4.0, 1.4, 11.7, mat(Color(0.5, 0.85, 1.0), 0.3, 0.0, 3.0), false)
	_wide = Vector3(7, 3.4, -1)

## the Celestial Capital: a street held in one moment — set tables, open doors, banners mid-flutter
func _set_capital() -> void:
	var white := mat(Color(0.88, 0.86, 0.8), 0.6)
	for i in 3:
		for x: float in [-11.0, 11.0]:
			box(Vector3(6.0, 9.0 + float(i % 2) * 3.0, 6.0), x, 0, 4.0 + float(i) * 8.0, white)
	for i in 3:
		model(CITY + "cafe-set.glb", -3.0 + float(i) * 3.0, 0, 9.0, 2.4)
	for x: float in [-6.0, 6.0]:
		box(Vector3(1.4, 4.0, 0.05), x, 4.0, 14.0, mat(Color(0.9, 0.7, 0.3), 0.8, 0.0, 0.4), false)
	light(0, 8.0, 10.0, Color(1.0, 0.9, 0.7), 2.4, 30.0)
	_wide = Vector3(8, 3.6, -4)

## the Council Hall: a ring of seats round a floor of light where the vote is replayed
func _set_council() -> void:
	_astryan(24.0, 24.0, 12.0, Color(1.0, 0.9, 0.7))
	for i in 9:
		var a := PI + PI * float(i) / 8.0
		box(Vector3(1.6, 1.2, 1.2), cos(a) * 9.0, 0, 12.0 - sin(a) * 9.0, mat(Color(0.7, 0.66, 0.58), 0.6))
	cyl(4.0, 0.08, 0, 0.02, 12.0, mat(Color(1.0, 0.85, 0.5), 0.4, 0.0, 2.0), false)
	_focus = p(0, 1.5, 12.0)
	_wide = Vector3(8, 4.0, 0)

## the Eternal Archives: stacks of crystal records rising into the dark
func _set_stacks() -> void:
	room(20.0, 26.0, 14.0, Color(0.15, 0.15, 0.2), Color(0.2, 0.2, 0.26), Color(0.6, 0.8, 1.0), 4.0)
	for i in 4:
		for x: float in [-6.0, 6.0]:
			box(Vector3(2.0, 12.0, 4.0), x, 0, 2.0 + float(i) * 6.0, mat(Color(0.3, 0.32, 0.4), 0.4, 0.6))
			box(Vector3(2.1, 11.0, 0.1), x, 0.5, 4.05 + float(i) * 6.0, mat(Color(0.5, 0.75, 1.0), 0.3, 0.0, 1.6), false)
	_wide = Vector3(3, 3.0, -1)

## the Living Gardens: terraces of green under a gold sky, a fountain, the dragon arch
func _set_gardens() -> void:
	box(Vector3(30.0, 0.2, 30.0), 0, -0.2, 12.0, mat(Color(0.3, 0.45, 0.25), 0.9), false)
	cyl(2.4, 0.8, 0, 0, 8.0, mat(Color(0.85, 0.83, 0.78), 0.6))
	cyl(2.0, 0.1, 0, 0.8, 8.0, mat(Color(0.4, 0.7, 0.9, 0.7), 0.05), false)
	for x: float in [-4.0, 4.0]:
		box(Vector3(1.2, 9.0, 1.2), x, 0, 18.0, mat(Color(0.85, 0.83, 0.78), 0.6))
	box(Vector3(9.2, 1.4, 1.4), 0, 9.0, 18.0, mat(Color(0.85, 0.83, 0.78), 0.6), false)
	label("ASHEN · STORM · TIDE · EMBER · DAWN", 0, 9.7, 17.2, Color(1.0, 0.85, 0.5), 64)
	for i in 8:
		model(FOLIAGE + ("broadleaf.glb" if i % 2 == 0 else "birch.glb"), -12.0 + float(i) * 3.4, 0, 22.0 + float(i % 2) * 3.0, 8.0, float(i * 45), false)
	light(0, 6.0, 10.0, Color(1.0, 0.9, 0.65), 2.4, 30.0)
	_wide = Vector3(8, 3.2, -4)

## the Continuum Chamber: rows of pods, each with a light in it — the sixth's other lives
func _set_pods() -> void:
	room(20.0, 24.0, 8.0, Color(0.1, 0.1, 0.12), Color(0.14, 0.14, 0.17), Color(0.9, 0.9, 1.0), 6.0)
	var pods: Array = []
	for row in 3:
		for i in 6:
			var x := -7.5 + float(i) * 3.0
			var z := 4.0 + float(row) * 5.0
			cyl(0.7, 0.3, x, 0, z, mat(Color(0.2, 0.2, 0.24), 0.4, 0.8))
			var glass := cyl(0.6, 2.2, x, 0.3, z, mat(Color(0.6, 0.85, 1.0, 0.25), 0.05), false)
			var glow := cyl(0.25, 0.25, x, 1.2, z, mat(Color(0.95, 0.95, 1.0), 0.3, 0.0, 4.0), false)
			pods.append(glow)
	_acts["pods"] = pods
	_wide = Vector3(7, 3.4, -1)

## the Heart of Origin: the Engine's core, rings of gold turning round a white light
func _set_heart() -> void:
	room(26.0, 26.0, 16.0, Color(0.85, 0.82, 0.74), Color(0.9, 0.88, 0.82), Color(1.0, 0.92, 0.7), 6.0)
	for i in 3:
		var mi := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 3.0 + float(i) * 1.6
		tm.outer_radius = tm.inner_radius + 0.25
		mi.mesh = tm
		mi.material_override = mat(Color(1.0, 0.82, 0.45), 0.3, 0.9, 1.5)
		_root.add_child(mi)
		mi.global_position = p(0, 6.0, 14.0)
		mi.rotation = Vector3(float(i) * 0.6, float(i) * 0.9, 0.3)
	var core := Fx.hologram("globe", Color(1.0, 0.95, 0.8), 3.0)
	_root.add_child(core)
	core.global_position = p(0, 4.5, 14.0)
	light(0, 6.0, 14.0, Color(1.0, 0.95, 0.8), 4.0, 30.0)
	_focus = p(0, 6.0, 14.0)
	_wide = Vector3(9, 4.0, 0)

# --------------------------------------------------------------------------------------------- the cast
## the speakers of the scene stand in an arc in front of the operator, facing in; the unnamed wear stand-in looks
func _cast(speakers: Array) -> void:
	var slots := [Vector3(-1.6, 0, 3.2), Vector3(1.7, 0, 3.4), Vector3(-3.2, 0, 2.2), Vector3(3.3, 0, 2.4), Vector3(0.1, 0, 4.4), Vector3(-4.6, 0, 3.6)]
	if set_id in SKY:
		slots = [Vector3(-2.2, 0, 7.0), Vector3(2.2, 0, 7.4), Vector3(0, 0, 9.5)]
	var n := 0
	for sp in speakers:
		var s := String(sp)
		if s == "PLAYER" or s in VOICES or (cast.has(s) and is_instance_valid(cast[s])):
			continue
		if s == "NOVA":
			_make_nova()
			continue
		if boss and is_instance_valid(boss) and boss.rules and s == String(boss.rules.def.name).to_upper():
			cast[s] = boss
			continue
		if _talker and is_instance_valid(_talker) and String(_talker.get_meta("who", "")) == s and _talker.global_position.distance_to(anchor) < 25.0:
			cast[s] = _talker
			continue
		var at: Vector3 = slots[mini(n, slots.size() - 1)]
		n += 1
		var body := _figure(s, at) if FIGURES.has(s) else _person(s, at)
		if body:
			cast[s] = body
	# the operator stands at the set's mark facing the cast
	if operator and not (set_id in SKY):
		var mark := operator_mark()
		operator.global_position = Vector3(mark.x, floor_y if set_id in ROOMS else _ground(mark.x, mark.z), mark.z)
		operator.heading = atan2(fwd.x, fwd.z)
		if operator.rig:
			operator.rig.rotation.y = operator.heading

func _person(s: String, at: Vector3) -> Node3D:
	var b := Player.new()
	_root.add_child(b)
	b.civilian = not is_operator(s)
	var sc := scale_of(s)
	b.build(look_of(s))
	b.scale = Vector3.ONE * sc
	var w := p(at.x, at.y, at.z)
	b.global_position = w
	var to_op := (operator.global_position if operator else anchor) - w
	b.heading = atan2(to_op.x, to_op.z)
	b.rig.rotation.y = b.heading
	if s == "MAN" and set_id == "bus":
		# Daniel's father, pinned by the bus
		b.global_position = p(1.4, 0.25, 6.0)
		b.rig.rotation = Vector3(-PI * 0.5, yaw_of(90.0), 0)
	if s in HOLO:
		_holo(b, Color(0.35, 0.8, 1.0))
	b.set_meta("who", s)
	return b

func _figure(s: String, at: Vector3) -> Node3D:
	var f: Array = FIGURES[s]
	var n := model(BOSSES + String(f[0]), at.x, at.y, at.z, float(f[1]), 180.0, false)
	if n == null:
		return _person("SOLDIER", at)
	var l := OmniLight3D.new()
	l.light_color = f[2]
	l.light_energy = 2.0
	l.omni_range = 6.0
	n.add_child(l)
	l.position = Vector3(0, float(f[1]) * 0.6, 1.0)
	n.set_meta("height", float(f[1]))
	return n

## NOVA: the standard interface — a small blue-white figure of light at the operator's shoulder
func _make_nova() -> void:
	if _nova or operator == null:
		return
	var b := Player.new()
	_root.add_child(b)
	b.civilian = true
	b.build(CharacterStore.clean({ "frame": "nyx", "body": "female" }))
	b.scale = Vector3.ONE * 0.32
	var side := right * 0.75 + fwd * 0.5
	b.global_position = operator.global_position + side + Vector3(0, 1.5, 0)
	var to_op := operator.global_position - b.global_position
	b.heading = atan2(to_op.x, to_op.z) + 0.6
	b.rig.rotation.y = b.heading
	_holo(b, Color(0.55, 0.85, 1.0))
	var l := OmniLight3D.new()
	l.light_color = Color(0.5, 0.85, 1.0)
	l.light_energy = 1.0
	l.omni_range = 3.0
	b.add_child(l)
	l.position = Vector3(0, 0.9, 0)
	_nova = b
	cast["NOVA"] = b

func _holo(b: Node3D, c: Color) -> void:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(c.r, c.g, c.b, 0.42)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = 1.4
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	for mi in b.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).material_override = m

## background people of a set: soldiers on the line, the wounded, the crowd — standing, facing `deg`
func _extras(kinds: Array, at: Array, deg: float) -> void:
	for i in mini(kinds.size(), at.size()):
		var v: Vector3 = at[i]
		var b := _person(String(kinds[i]), v)
		if b:
			b.heading = yaw_of(deg + float(i * 17 % 40) - 20.0)
			b.rig.rotation.y = b.heading
			b.set_meta("who", "")

# --------------------------------------------------------------------------------------------- the camera
## the head of whoever speaks (a figure's chest, the boss's upper body)
func _head(n: Node3D) -> Vector3:
	if n is Player and (n as Player).rig and (n as Player).rig.has_method("head_world"):
		return (n as Player).rig.head_world() + Vector3(0, 0.08 * n.scale.y, 0)
	if n == boss:
		return n.global_position + Vector3(0, 3.2, 0)
	if n.has_meta("height"):
		return n.global_position + Vector3(0, float(n.get_meta("height")) * 0.8, 0)
	return n.global_position + Vector3(0, 1.62 * n.scale.y, 0)

## the shot for a line: alternating a close single on the speaker and an over-the-shoulder from the listener; a voice
## without a body holds the set (its focus) from the wide
func shot(line_id: String, i: int) -> Dictionary:
	var sh := _shot(line_id, i)
	# a camera inside a building or a set wall looks at concrete: pull it toward what it frames until it is clear
	var look: Vector3 = sh.look
	for key in ["from", "from1"]:
		var f: Vector3 = sh[key]
		for step in 12:
			if not _blocked(f):
				break
			f = f.lerp(look, 0.18)
		sh[key] = f
	return sh

func _blocked(at: Vector3) -> bool:
	for b in obstacles:
		var bb: AABB = b
		if bb.size.y > 1.6 and bb.grow(0.25).has_point(at):
			return true
	return false

func _shot(line_id: String, i: int) -> Dictionary:
	var s := Lines.speaker(line_id)
	var me: Node3D = operator
	var who: Node3D = null
	if s == "PLAYER":
		who = operator
	elif cast.has(s) and is_instance_valid(cast[s]):
		who = cast[s]
		_last_listener = s
	if OS.has_environment("STAGE_WIDE"):
		who = null
	if who == null:
		var w := p(_wide.x, _wide.y, _wide.z)
		if set_id in SKY:
			w = anchor + right * _wide.x + Vector3(0, _wide.y, 0) + fwd * _wide.z
		return { "look": _focus, "look_up": 0.0, "from": w, "from1": w + (_focus - w).normalized() * 1.2 }
	var head := _head(who)
	# the one listening: the operator, or the last one who spoke to the operator
	var other: Node3D = me
	if who == operator:
		if _last_listener != "" and cast.has(_last_listener) and is_instance_valid(cast[_last_listener]):
			other = cast[_last_listener]
		else:
			for k in cast:
				if is_instance_valid(cast[k]):
					other = cast[k]
					break
	var o_head := _head(other) if other != who else head + (fwd * -2.5)
	var axis := head - o_head
	axis.y = 0.0
	if axis.length() < 0.2:
		axis = -fwd
	axis = axis.normalized()
	var side := Vector3(axis.z, 0, -axis.x)
	var big := 1.0 if who != boss and not who.has_meta("height") else 2.6
	if who == _nova:
		big = 0.5
		var f0 := head - axis * 0.0 + side * 1.0 - axis * -1.4 + Vector3(0, 0.1, 0)
		return { "look": head, "look_up": 0.0, "from": f0, "from1": f0 + (head - f0) * 0.15 }
	if i % 3 != 1:
		# over the listener's shoulder
		var f1 := o_head - axis * 1.0 * big + side * 0.55 * big + Vector3(0, 0.12, 0)
		return { "look": head, "look_up": -0.05, "from": f1, "from1": f1 + side * 0.25 }
	# a single on the speaker, easing in
	var f2 := head - axis * 2.4 * big + side * 0.7 * big + Vector3(0, -0.05, 0)
	return { "look": head, "look_up": -0.03, "from": f2, "from1": head - axis * 2.0 * big + side * 0.55 * big }

# --------------------------------------------------------------------------------------------- staged moments
func act(name: String) -> void:
	match name:
		"cole_drive":
			# Cole takes the rig into the breach: it drives off up the corridor and goes up in fire
			var truck: Node3D = _acts.get("truck")
			if truck == null or not is_instance_valid(truck):
				return
			var body: Node3D = cast.get("COLE")
			if body and is_instance_valid(body):
				body.visible = false
			var tw := create_tween()
			var to := p(-2.0, 0, 46.0)
			tw.tween_property(truck, "global_position", to, 4.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
			tw.tween_callback(func() -> void:
				var f := Burnt.fire(3.0)
				_root.add_child(f)
				f.global_position = to
				Burnt.char_car(truck)
				var l := OmniLight3D.new()
				l.light_color = Color(1.0, 0.6, 0.3)
				l.light_energy = 8.0
				l.omni_range = 40.0
				_root.add_child(l)
				l.global_position = to + Vector3(0, 3, 0)
				create_tween().tween_property(l, "light_energy", 1.5, 2.5))
		"seal":
			# the seal recognises the sixth bearer: the dais lights
			light(0, 1.5, 14.0, Color(1.0, 0.85, 0.5), 6.0, 24.0)
		"release":
			# the pods let their memories go: each light rises and fades
			for g in _acts.get("pods", []):
				var n: Node3D = g
				if is_instance_valid(n):
					var tw := create_tween()
					tw.tween_property(n, "global_position", n.global_position + Vector3(0, 7.0, 0), 3.0 + randf())
					tw.tween_property(n, "scale", Vector3.ZERO, 0.6)
		"collapse":
			# the hall shifts: rubble comes down
			for i in 6:
				rocks(-6.0 + i * 2.4, 4.0 + float(i % 3) * 4.0, 1.5, i * 30.0)
