extends Node
## Other players in the open world (Nov 18, online play): everyone in the same city's street shares the room
## "world:<city>". Each client tracks its presence (name, look) and broadcasts where it is eight times a second — on foot
## (position, heading, speed) or in a car (the car's model file, position, heading, speed). Here every other player is
## drawn as their operator in their own look, walking / running, or as the car they drive, slid smoothly between updates,
## with their name over them. Street races between players ride the same room (street_life.gd: race_open / race_join /
## race_go / race_pos / race_fin, challenge / challenge_ok). street_slice.gd owns it: setup(slice), step(dt).

const Online := preload("res://scripts/net/online.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const SEND_EVERY := 0.125
const STALE := 6.0
const DEFAULT_CAR := "res://models/fleet/street-racer-lod.glb"

signal message(event: String, data: Dictionary, from: String)

var slice: Control
var net: Node
var room: RefCounted
var players := {}      # id -> {name, look, body, car, car_file, tag, to, yaw, spd, seen, driving}
var _send_t := 0.0
var _hud: Label

func setup(s: Control, use_net: Node = null) -> void:
	slice = s
	net = use_net if use_net else Online.shared(s.get_tree())
	room = net.room("world:" + String(s.style))
	if room == null:
		return
	var look := CharacterStore.load_look()
	room.track({ "name": net.display, "look": look })
	room.message.connect(_on_message)
	room.joined.connect(func(k: String, meta: Dictionary): _ensure(k, meta))
	room.left.connect(_drop)
	_hud = Label.new()
	_hud.add_theme_font_size_override("font_size", 12)
	_hud.add_theme_color_override("font_color", Color(0.6, 1.0, 0.75))
	_hud.add_theme_constant_override("outline_size", 4)
	_hud.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	_hud.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_hud.position = Vector2(-150, 70)
	_hud.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_hud.custom_minimum_size = Vector2(140, 0)
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	s.add_child(_hud)

func _exit_tree() -> void:
	if room:
		room.leave()
		room = null

func send(event: String, data: Dictionary) -> void:
	if room:
		room.send(event, data)

## the other players in a car near `p` (within `r` m): [id, name, distance]
func drivers_near(p: Vector3, r: float) -> Array:
	var out: Array = []
	for id in players:
		var pl: Dictionary = players[id]
		if bool(pl.driving):
			var d := Vector2((pl.to as Vector3).x - p.x, (pl.to as Vector3).z - p.z).length()
			if d < r:
				out.append([id, String(pl.name), d])
	out.sort_custom(func(a, b): return float(a[2]) < float(b[2]))
	return out

func name_of(id: String) -> String:
	return String(players.get(id, {}).get("name", room.members.get(id, {}).get("name", "Player") if room else "Player"))

func count() -> int:
	return room.members.size() if room else 0

# --------------------------------------------------------------------------------------------- incoming
func _on_message(event: String, data: Dictionary, from: String) -> void:
	if event == "pos":
		var pl := _ensure(from, room.members.get(from, {}))
		var p: Array = data.get("p", [0, 0, 0])
		pl.to = Vector3(float(p[0]), float(p[1]), float(p[2]))
		pl.yaw = float(data.get("y", 0.0))
		pl.spd = float(data.get("s", 0.0))
		pl.seen = 0.0
		var car_file := String(data.get("c", ""))
		if car_file != String(pl.car_file):
			_set_car(pl, car_file)
		if pl.body == null and car_file == "":
			_set_body(pl)
		return
	message.emit(event, data, from)

func _ensure(id: String, meta: Dictionary) -> Dictionary:
	if not players.has(id):
		players[id] = { "name": String(meta.get("name", "Player")), "look": meta.get("look", {}), "body": null, "car": null,
			"car_file": "", "tag": null, "to": Vector3(0, -500, 0), "yaw": 0.0, "spd": 0.0, "seen": 0.0, "driving": false, "fresh": true }
	elif meta.has("name"):
		players[id].name = String(meta.name)
		players[id].look = meta.get("look", players[id].look)
	return players[id]

func _drop(id: String) -> void:
	var pl: Dictionary = players.get(id, {})
	if pl.is_empty():
		return
	for k in ["body", "car", "tag"]:
		if pl[k] and is_instance_valid(pl[k]):
			(pl[k] as Node).queue_free()
	players.erase(id)

func _set_body(pl: Dictionary) -> void:
	var b := Player.new()
	b.civilian = false
	slice.world.add_child(b)
	b.build(pl.look if pl.look is Dictionary else {})
	b.position = pl.to
	pl.body = b
	_tag(pl)

## their car: the model they drive, never a stand-in (an unknown file takes the street racer)
func _set_car(pl: Dictionary, file: String) -> void:
	if pl.car and is_instance_valid(pl.car):
		(pl.car as Node).queue_free()
	pl.car = null
	pl.car_file = file
	pl.driving = file != ""
	if file == "":
		return
	var path := file if file.begins_with("res://") and ResourceLoader.exists(file) else DEFAULT_CAR
	var n := (load(path) as PackedScene).instantiate() as Node3D
	StreetCar.face_forward(n)
	n.set_meta("dynamic", true)
	slice.world.add_child(n)
	n.position = pl.to
	pl.car = n
	if pl.body and is_instance_valid(pl.body):
		(pl.body as Node3D).visible = false
	_tag(pl)

func _tag(pl: Dictionary) -> void:
	if pl.tag and is_instance_valid(pl.tag):
		(pl.tag as Node).queue_free()
	var l := Label3D.new()
	l.text = String(pl.name)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = true
	l.pixel_size = 0.0022
	l.font_size = 22
	l.outline_size = 6
	l.modulate = Color(0.55, 1.0, 0.75)
	slice.world.add_child(l)
	pl.tag = l

# --------------------------------------------------------------------------------------------- each frame
func step(dt: float) -> void:
	if room == null:
		return
	_send_t -= dt
	if _send_t <= 0.0:
		_send_t = SEND_EVERY
		_send_me()
	for id in players.keys():
		var pl: Dictionary = players[id]
		pl.seen = float(pl.seen) + dt
		if float(pl.seen) > STALE:
			_drop(id)
			continue
		var node: Node3D = pl.car if pl.driving and pl.car and is_instance_valid(pl.car) else pl.body
		if node == null or not is_instance_valid(node):
			continue
		var to: Vector3 = pl.to
		if bool(pl.fresh) or node.position.distance_to(to) > 40.0:
			node.position = to
			pl.fresh = false
		else:
			node.position = node.position.lerp(to, minf(1.0, dt * 10.0))
		if pl.driving:
			node.rotation.y = lerp_angle(node.rotation.y, float(pl.yaw), minf(1.0, dt * 10.0))
			if pl.body and is_instance_valid(pl.body):
				(pl.body as Node3D).visible = false
		else:
			node.visible = true
			var b: Node3D = node
			b.set("heading", float(pl.yaw))
			if b.get("rig"):
				(b.get("rig") as Node3D).rotation.y = lerp_angle((b.get("rig") as Node3D).rotation.y, float(pl.yaw), minf(1.0, dt * 10.0))
			if b.has_method("_animate"):
				b.call("_animate", float(pl.spd), float(pl.spd) > 5.0)
		if pl.tag and is_instance_valid(pl.tag):
			(pl.tag as Node3D).position = node.position + Vector3(0, 2.6 if not pl.driving else 2.2, 0)
	if _hud:
		_hud.text = net.status(room)

func _send_me() -> void:
	if not net.online():
		return
	var car: RefCounted = slice.driving_car
	if car:
		var n: Node3D = car.node
		room.send("pos", { "p": [snappedf(n.position.x, 0.01), snappedf(n.position.y, 0.01), snappedf(n.position.z, 0.01)],
			"y": snappedf(n.rotation.y, 0.001), "s": snappedf(absf(car.speed), 0.1), "c": String(n.scene_file_path) if n.scene_file_path != "" else DEFAULT_CAR })
	else:
		var o: Node3D = slice.operator
		room.send("pos", { "p": [snappedf(o.position.x, 0.01), snappedf(o.position.y, 0.01), snappedf(o.position.z, 0.01)],
			"y": snappedf(float(o.get("heading")) if o.get("heading") != null else o.rotation.y, 0.001), "s": snappedf(Vector2(o.velocity.x, o.velocity.z).length(), 0.1), "c": "" })
