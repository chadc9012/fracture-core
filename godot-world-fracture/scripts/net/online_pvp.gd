extends Node
## An online Killbox match (Nov 18, online play): Clash between players, no bots (the owner: bots are PvP's own VS BOTS
## mode). Everyone in the arena's room "pvp:<arena>:<mode>" is a fighter; you take the side with fewer players (A spawns
## on the arena's "us" roof, B on "them"), tracked in presence. Each client sends where it is ten times a second and draws
## the others as their operators in their look, with tracers when they fire. Hits are the shooter's: your rounds landing
## on another player's body send them "hit" with the damage; their own client takes it off their hull (and shield), and
## when they go down they say so ("down", with who shot them last) — every client scores that kill for the killer's side.
## arena_view.gd owns it when `online` is on: setup(view), step(dt), my_down(), side.

const Online := preload("res://scripts/net/online.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const SEND_EVERY := 0.1
const BODY := Vector3(0.9, 1.9, 0.9)
const HP := 100.0

var view: Control
var net: Node
var room: RefCounted
## "A" or "B": your side of the arena
var side := "A"
var fighters := {}     # id -> {name, team, body, target, to, yaw, spd, seen, last_by}
var last_hit_by := ""
var _send_t := 0.0
var _shots_seen := 0
## seconds in the room before the side is picked (the presence list arrives just after the join)
var _settle := 0.6
var sided := false

func setup(v: Control, use_net: Node = null) -> void:
	view = v
	net = use_net if use_net else Online.shared(v.get_tree())
	room = net.room("pvp:%s:%s" % [String(v.arena_id), String(v.mode_id)])
	if room == null:
		return
	# the side is picked once the room has told us who's in it (_pick_side)
	room.message.connect(_on_message)
	room.joined.connect(func(k: String, meta: Dictionary): _ensure(k, meta))
	room.left.connect(_drop)
	view.gunplay.hit.connect(_on_hit)

## where your side spawns on the arena
func spawn_side() -> String:
	return "us" if side == "A" else "them"

func players() -> int:
	return room.members.size() + 1 if room else 1

func _exit_tree() -> void:
	if room:
		room.leave()
		room = null

func _ensure(id: String, meta: Dictionary) -> Dictionary:
	if not fighters.has(id):
		var body := Player.new()
		body.civilian = false
		view.world.add_child(body)
		body.build(meta.get("look", {}) if meta.get("look", {}) is Dictionary else {})
		body.position = Vector3(0, -200, 0)
		var t := Gunplay.Target.new(AABB(Vector3(0, -200, 0), BODY), HP, body)
		view.gunplay.targets.append(t)
		var tag := Label3D.new()
		tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		tag.fixed_size = true
		tag.pixel_size = 0.002
		tag.font_size = 22
		tag.outline_size = 6
		body.add_child(tag)
		tag.position.y = 2.3
		fighters[id] = { "name": String(meta.get("name", "Player")), "team": String(meta.get("team", "")), "body": body, "target": t,
			"tag": tag, "to": Vector3(0, -200, 0), "yaw": 0.0, "spd": 0.0, "seen": 0.0, "fresh": true }
	var f: Dictionary = fighters[id]
	if meta.has("team"):
		f.team = String(meta.team)
	if meta.has("name"):
		f.name = String(meta.name)
	(f.tag as Label3D).text = String(f.name)
	(f.tag as Label3D).modulate = Color(0.45, 0.75, 1.0) if String(f.team) == side else Color(1.0, 0.4, 0.4)
	return f

func _drop(id: String) -> void:
	var f: Dictionary = fighters.get(id, {})
	if f.is_empty():
		return
	view.gunplay.targets.erase(f.target)
	(f.body as Node).queue_free()
	fighters.erase(id)

func ally(id: String) -> bool:
	return String(fighters.get(id, {}).get("team", "")) == side

# --------------------------------------------------------------------------------------------- hits
## your round landed on someone: if it's another player, it's theirs to take — the damage goes to them, and their body
## here is topped back up (their hull lives on their phone)
func _on_hit(t: RefCounted, damage: float, head: bool) -> void:
	for id in fighters:
		var f: Dictionary = fighters[id]
		if f.target == t:
			t.hp = HP
			t.shield = 0.0
			if ally(id):
				return      # no friendly fire
			room.send("hit", { "to": id, "d": snappedf(damage, 0.1), "h": head })
			return

func _on_message(event: String, d: Dictionary, from: String) -> void:
	match event:
		"pos":
			var f := _ensure(from, room.members.get(from, {}))
			var p: Array = d.get("p", [0, 0, 0])
			f.to = Vector3(float(p[0]), float(p[1]), float(p[2]))
			f.yaw = float(d.get("y", 0.0))
			f.spd = float(d.get("s", 0.0))
			f.seen = 0.0
			(f.body as Node3D).visible = not bool(d.get("dn", false))
		"shot":
			var a: Array = d.get("a", [])
			var b: Array = d.get("b", [])
			if a.size() == 3 and b.size() == 3:
				view.gunplay.tracer(Vector3(a[0], a[1], a[2]), Vector3(b[0], b[1], b[2]), Color(1.0, 0.5, 0.45) if not ally(from) else Color(0.55, 0.8, 1.0))
		"hit":
			if String(d.get("to", "")) == net.id and view.enemies.down <= 0.0 and not ally(from):
				last_hit_by = from
				view.enemies._hit_operator(float(d.get("d", 0.0)))
		"down":
			# a player went down: the killer's side scores (you were the killer: it's your kill)
			var by := String(d.get("by", ""))
			if by == net.id:
				view.match_state.score(1, true)
				view.controls.toast("You took down %s" % String(fighters.get(from, {}).get("name", "a player")))
			elif by != "" and ally(by):
				view.match_state.score(1)
			elif by != "":
				view.match_state.score(0)

## you went down: say who did it (every client scores it)
func my_down() -> void:
	room.send("down", { "by": last_hit_by })
	if last_hit_by != "":
		view.controls.toast("%s took you down" % String(fighters.get(last_hit_by, {}).get("name", "A player")))
	last_hit_by = ""

# --------------------------------------------------------------------------------------------- each frame
## the side with fewer players (ties go to A); you move to its spawn
func _pick_side() -> void:
	var a := 0
	var b := 0
	for k in room.members:
		if String(room.members[k].get("team", "")) == "A":
			a += 1
		elif String(room.members[k].get("team", "")) == "B":
			b += 1
	side = "A" if a <= b else "B"
	sided = true
	room.track({ "name": net.display, "team": side, "look": CharacterStore.load_look() })
	view.operator.position = view.arena.spawn(spawn_side())
	view.operator.heading = PI if side == "A" else 0.0
	for id in fighters:
		_ensure(id, {})
	view.controls.toast("Online · you're on side %s · %d player%s here" % [side, players(), "" if players() == 1 else "s"])

func step(dt: float) -> void:
	if room == null:
		return
	if not sided:
		if room.is_joined:
			_settle -= dt
			if _settle <= 0.0:
				_pick_side()
		return
	_send_t -= dt
	var op: Node3D = view.operator
	if _send_t <= 0.0 and net.online():
		_send_t = SEND_EVERY
		room.send("pos", { "p": [snappedf(op.position.x, 0.01), snappedf(op.position.y, 0.01), snappedf(op.position.z, 0.01)],
			"y": snappedf(float(op.get("heading")), 0.001), "s": snappedf(Vector2(op.velocity.x, op.velocity.z).length(), 0.1), "dn": view.enemies.down > 0.0 })
	# your shots: a tracer for the others to see
	if view.gunplay.shots_fired != _shots_seen and net.online():
		_shots_seen = view.gunplay.shots_fired
		var a: Vector3 = view.gunplay.muzzle()
		var b: Vector3 = view.gunplay.aim_point(view.cam)
		room.send("shot", { "a": [snappedf(a.x, 0.01), snappedf(a.y, 0.01), snappedf(a.z, 0.01)], "b": [snappedf(b.x, 0.01), snappedf(b.y, 0.01), snappedf(b.z, 0.01)] })
	for id in fighters.keys():
		var f: Dictionary = fighters[id]
		f.seen = float(f.seen) + dt
		if float(f.seen) > 8.0:
			_drop(id)
			continue
		var body: Node3D = f.body
		if bool(f.fresh) or body.position.distance_to(f.to) > 12.0:
			body.position = f.to
			f.fresh = false
		else:
			body.position = body.position.lerp(f.to, minf(1.0, dt * 12.0))
		body.set("heading", float(f.yaw))
		if body.get("rig"):
			(body.get("rig") as Node3D).rotation.y = lerp_angle((body.get("rig") as Node3D).rotation.y, float(f.yaw), minf(1.0, dt * 12.0))
		if body.has_method("_animate"):
			body.call("_animate", float(f.spd), float(f.spd) > 5.0)
		(f.target as RefCounted).box = AABB(body.position - Vector3(BODY.x * 0.5, 0, BODY.z * 0.5), BODY) if body.visible else AABB(Vector3(0, -200, 0), BODY)

## the board's lines: everyone in the match by side
func board_lines() -> Array:
	var out: Array = ["ONLINE · %d players" % players()]
	for id in fighters:
		var f: Dictionary = fighters[id]
		out.append("%s %s" % ["■" if ally(id) else "□", String(f.name)])
	return out
