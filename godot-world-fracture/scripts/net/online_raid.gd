extends Node
## An online raid fireteam (Nov 22; TASKBOARD "online raid fireteams"): Raid 01 played by the players in the encounter's
## room "raid:hollow-star:<encounter>", the bots filling the empty slots of six.
##
## One client leads: the first one in (presence `t`, the time each joined; ties by id). The leader's raid_view runs as
## it always has — the rules (hollow_star.gd), the void army and the bots (enemies.gd), the star's attacks — and here:
##   * every other player is a body on the leader's field, an enemies.gd mover on the fireteam's team marked "puppet"
##     (moved from the network, never by the AI) and "remote": the void shoots at it, and a hit on it goes to that
##     player ("hurt"); it holds pylons and conduits like anyone; one bot is benched for each other player;
##   * ten times a second it sends "st": the raid's numbers and every bot and void trooper (id, type, team, where,
##     facing, speed, standing or not), with the bots' bolts for tracers;
##   * the star's beams and rings go out as "beam" / "ring" when they start; a wipe as "wipe".
## Everyone else's raid_view draws that state: the troopers as puppets (the same bodies, tinted the same), the raid's
## numbers on the HUD, the beams and rings run on their own screen against their own operator. Their rounds on a void
## puppet go to the leader as "hit" (the leader's trooper takes it), on the star as "boss"; going down sends "down" (the
## leader spends the shared life). Every client sends "pos" for its operator and "shot" for its tracers.
## If the leader leaves, the next one in leads and the encounter starts over from its checkpoint.

const Online := preload("res://scripts/net/online.gd")
const Player := preload("res://scripts/player/operator_player.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const HollowStar := preload("res://scripts/raid/hollow_star.gd")
const SEND_EVERY := 0.1
const STATE_EVERY := 0.1
const STALE := 8.0

var view: Control         # raid_view.gd
var net: Node
var room: RefCounted
var joined_at := 0.0
var leader := false
var leader_id := ""
var decided := false
var _settle := 0.8
## the other players: id -> {name, look, body, enemy (the leader's stand-in) / null, to, yaw, spd, seen, dn, tag}
var players := {}
## network id -> enemies.gd Enemy: the leader's own troopers and bots, or the puppets drawn here
var by_nid := {}
var _nid := 0
var _send_t := 0.0
var _state_t := 0.0
var _shots_seen := 0
var _bolts: Array = []

func setup(v: Control, use_net: Node = null) -> bool:
	view = v
	net = use_net if use_net else Online.shared(v.get_tree())
	room = net.room("raid:%s:%s" % [HollowStar.ID, String(v.start_at)])
	if room == null:
		return false
	joined_at = Time.get_unix_time_from_system()
	room.track({ "name": net.display, "look": CharacterStore.load_look(), "t": joined_at })
	room.message.connect(_on_message)
	room.joined.connect(func(k: String, meta: Dictionary): _ensure(k, meta))
	room.left.connect(_drop)
	v.gunplay.hit.connect(_on_hit)
	v.enemies.remote_hit.connect(_on_remote_hit)
	v.enemies.shot.connect(_on_bolt)
	return true

func _exit_tree() -> void:
	if room:
		room.leave()
		room = null

func send(event: String, data: Dictionary) -> void:
	if room:
		room.send(event, data)

## who leads: the first in (their `t`), ties by id
func leader_of() -> String:
	var best: String = net.id
	var best_t := joined_at
	for k in room.members:
		var t := float(room.members[k].get("t", INF))
		if t < best_t or (t == best_t and String(k) < best):
			best = String(k)
			best_t = t
	return best

func count() -> int:
	return players.size() + 1

func hud_lines() -> String:
	var s := "\nONLINE · %d player%s%s" % [count(), "" if count() == 1 else "s", "" if not decided else ("  ·  you lead" if leader else "  ·  %s leads" % name_of(leader_id))]
	for id in players:
		s += "\n%s  %s" % [String(players[id].name), "✕ down" if bool(players[id].dn) else "▮"]
	return s

func name_of(id: String) -> String:
	if id == net.id:
		return net.display
	return String(players.get(id, {}).get("name", room.members.get(id, {}).get("name", "Player")))

# --------------------------------------------------------------------------------------------- who leads
func _take_lead(id: String) -> void:
	var was := leader
	var first := not decided
	decided = true
	leader_id = id
	leader = id == net.id
	if first:
		if leader:
			view.spawn_bots()
		for pid in players.keys():
			_rebody(pid)
		view.controls.toast("Online fireteam · %s" % ("you lead · %d player%s" % [count(), "" if count() == 1 else "s"] if leader else "%s leads" % name_of(id)))
		return
	if leader and not was:
		# the leader left: this screen runs the encounter now, from its start
		for nid in by_nid.keys():
			_free_puppet(nid)
		view.spawn_bots()
		for pid in players.keys():
			_rebody(pid)
		view.raid.begin(view.raid.encounter)
		view._wiped("%s left the fireteam" % "The leader")

# --------------------------------------------------------------------------------------------- the other players
func _ensure(id: String, meta: Dictionary) -> Dictionary:
	if not players.has(id):
		players[id] = { "name": String(meta.get("name", "Player")), "look": meta.get("look", {}), "body": null, "enemy": null,
			"tag": null, "to": view.spawn_point, "yaw": 0.0, "spd": 0.0, "seen": 0.0, "dn": false, "fresh": true }
		if decided:
			_rebody(id)
	elif meta.has("name"):
		players[id].name = String(meta.name)
		players[id].look = meta.get("look", players[id].look)
		if players[id].tag != null and is_instance_valid(players[id].tag):
			(players[id].tag as Label3D).text = String(meta.name)
	return players[id]

func _drop(id: String) -> void:
	var p: Dictionary = players.get(id, {})
	if p.is_empty():
		return
	_unbody(p)
	players.erase(id)

## a player's body here: on the leader's field an enemies.gd stand-in the void can fight; elsewhere just their body
func _rebody(id: String) -> void:
	var p: Dictionary = players[id]
	_unbody(p)
	var look: Dictionary = p.look if p.look is Dictionary and not (p.look as Dictionary).is_empty() else {}
	if leader:
		var e: RefCounted = view.enemies.spawn("elite", p.to, [], 1)
		e.set_meta("puppet", true)
		e.set_meta("remote", true)
		e.set_meta("pid", id)
		e.set_meta("name", String(p.name))
		if e.held and is_instance_valid(e.held):
			e.held.queue_free()
		e.held = null
		e.mover.civilian = false
		e.mover.build(look)
		e.mover.rig.scale = Vector3.ONE
		p.enemy = e
		p.body = e.mover
	else:
		var b := Player.new()
		b.civilian = false
		view.world.add_child(b)
		b.build(look)
		b.position = p.to
		p.body = b
	var tag := Label3D.new()
	tag.text = String(p.name)
	tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	tag.fixed_size = true
	tag.pixel_size = 0.002
	tag.font_size = 22
	tag.outline_size = 6
	tag.modulate = Color(0.55, 0.85, 1.0)
	tag.position.y = 2.3
	(p.body as Node3D).add_child(tag)
	p.tag = tag
	p.fresh = true

func _unbody(p: Dictionary) -> void:
	if p.enemy != null:
		var e: RefCounted = p.enemy
		view.gunplay.targets.erase(e.target)
		view.enemies.enemies.erase(e)
		if is_instance_valid(e.mover):
			e.mover.queue_free()
	elif p.body != null and is_instance_valid(p.body):
		(p.body as Node).queue_free()
	p.enemy = null
	p.body = null
	p.tag = null

## the leader benches a bot for each other player (six in all) and brings one back when a player goes
func _bench() -> void:
	var want := maxi(0, view.allies.size() - players.size())
	for i in view.allies.size():
		var a: RefCounted = view.allies[i]
		var bench: bool = i >= want
		if bench and not a.has_meta("benched"):
			a.set_meta("benched", true)
			a.set_meta("puppet", true)
			a.target.hp = 0.0
			a.mover.visible = false
		elif not bench and a.has_meta("benched"):
			a.remove_meta("benched")
			a.remove_meta("puppet")
			a.target.hp = a.target.max_hp
			a.state = view.Enemies.State.PATROL
			a.mover.position = view.spawn_point
			a.mover.visible = true

# --------------------------------------------------------------------------------------------- each frame
func step(dt: float) -> void:
	if room == null:
		return
	if not decided:
		if room.is_joined:
			_settle -= dt
			if _settle <= 0.0:
				_take_lead(leader_of())
		return
	var lid := leader_of()
	if lid != leader_id:
		_take_lead(lid)
	if leader:
		_bench()
	_send_t -= dt
	if _send_t <= 0.0 and net.online():
		_send_t = SEND_EVERY
		var o: Node3D = view.operator
		send("pos", { "p": [snappedf(o.position.x, 0.01), snappedf(o.position.y, 0.01), snappedf(o.position.z, 0.01)],
			"y": snappedf(float(o.heading), 0.001), "s": snappedf(Vector2(o.velocity.x, o.velocity.z).length(), 0.1), "dn": view.enemies.down > 0.0 })
	if view.gunplay.shots_fired != _shots_seen and net.online():
		_shots_seen = view.gunplay.shots_fired
		var a: Vector3 = view.gunplay.muzzle()
		var b: Vector3 = view.gunplay.aim_point(view.cam)
		send("shot", { "a": _v3(a), "b": _v3(b) })
	if leader:
		_state_t -= dt
		if _state_t <= 0.0 and net.online():
			_state_t = STATE_EVERY
			send("st", _state())
	else:
		for nid in by_nid:
			var e: RefCounted = by_nid[nid]
			var to: Vector3 = e.get_meta("to", e.mover.position)
			e.mover.position = to if e.mover.position.distance_to(to) > 10.0 else e.mover.position.lerp(to, minf(1.0, dt * 10.0))
			if e.mover.rig:
				e.mover.rig.rotation.y = lerp_angle(e.mover.rig.rotation.y, float(e.get_meta("yaw", 0.0)), minf(1.0, dt * 10.0))
			if e.mover.has_method("_animate"):
				e.mover._animate(float(e.get_meta("spd", 0.0)), float(e.get_meta("spd", 0.0)) > 5.0)
	for id in players.keys():
		var p: Dictionary = players[id]
		p.seen = float(p.seen) + dt
		if float(p.seen) > STALE:
			_drop(id)
			continue
		if p.body == null or not is_instance_valid(p.body):
			continue
		var body: Node3D = p.body
		if bool(p.fresh) or body.position.distance_to(p.to) > 12.0:
			body.position = p.to
			p.fresh = false
		else:
			body.position = body.position.lerp(p.to, minf(1.0, dt * 12.0))
		body.visible = not bool(p.dn)
		body.set("heading", float(p.yaw))
		if body.get("rig"):
			(body.get("rig") as Node3D).rotation.y = lerp_angle((body.get("rig") as Node3D).rotation.y, float(p.yaw), minf(1.0, dt * 12.0))
		if body.has_method("_animate"):
			body.call("_animate", float(p.spd), float(p.spd) > 5.0)
		if p.enemy != null:
			# a downed player is out of the fight until they're back up
			var t: RefCounted = (p.enemy as RefCounted).target
			t.hp = 0.0 if bool(p.dn) else t.max_hp

static func _v3(v: Vector3) -> Array:
	return [snappedf(v.x, 0.01), snappedf(v.y, 0.01), snappedf(v.z, 0.01)]

# --------------------------------------------------------------------------------------------- the leader's state
func _state() -> Dictionary:
	var r: RefCounted = view.raid
	var ents: Array = []
	for e in view.enemies.enemies:
		if e.has_meta("remote") or e.has_meta("benched") or e.has_meta("gone"):
			continue
		if not e.has_meta("nid"):
			_nid += 1
			e.set_meta("nid", _nid)
			by_nid[_nid] = e
		var m: Node3D = e.mover
		ents.append([int(e.get_meta("nid")), String(e.type), int(e.team), snappedf(m.position.x, 0.01), snappedf(m.position.y, 0.01), snappedf(m.position.z, 0.01),
			snappedf(m.rig.rotation.y if m.rig else m.rotation.y, 0.01), snappedf(Vector2(m.velocity.x, m.velocity.z).length(), 0.1), e.target.alive(), String(e.get_meta("name", ""))])
	var st := { "r": { "lv": r.lives, "ti": snappedf(r.time, 0.1), "pl": r.pylons.map(func(x): return snappedf(x, 0.001)), "wv": r.wave,
		"hp": snappedf(r.boss_hp, 0.01), "ph": r.phase, "cd": r.conduits.map(func(x): return snappedf(x, 0.001)), "ov": snappedf(r.overload, 0.001),
		"ck": snappedf(r.clock, 0.1), "sh": r.shielded, "cl": r.cleared, "dn": r.done, "ss": view._split_side }, "e": ents }
	if not _bolts.is_empty():
		st.tr = _bolts.duplicate()
		_bolts.clear()
	return st

func _on_bolt(from: Vector3, to: Vector3, team: int) -> void:
	if leader and _bolts.size() < 10:
		_bolts.append(_v3(from) + _v3(to) + [team])

## the void's round landed on another player's body here: it's theirs to take
func _on_remote_hit(e: RefCounted, damage: float) -> void:
	if leader and e.has_meta("pid"):
		send("hurt", { "to": String(e.get_meta("pid")), "d": snappedf(damage, 0.1) })

## your round landed on a void puppet: the leader's trooper takes it (the puppet here stays whole)
func _on_hit(t: RefCounted, damage: float, head: bool) -> void:
	if leader or not t.has_meta("enemy"):
		return
	var e: RefCounted = t.get_meta("enemy")
	if not e.has_meta("nid") or e.team != 0:
		return
	send("hit", { "n": int(e.get_meta("nid")), "d": snappedf(damage, 0.1), "h": head })
	t.hp = t.max_hp
	t.shield = t.shield_max

# --------------------------------------------------------------------------------------------- incoming
func _on_message(event: String, d: Dictionary, from: String) -> void:
	match event:
		"pos":
			var p := _ensure(from, room.members.get(from, {}))
			var a: Array = d.get("p", [0, 0, 0])
			p.to = Vector3(float(a[0]), float(a[1]), float(a[2]))
			p.yaw = float(d.get("y", 0.0))
			p.spd = float(d.get("s", 0.0))
			p.dn = bool(d.get("dn", false))
			p.seen = 0.0
		"shot":
			var a: Array = d.get("a", [])
			var b: Array = d.get("b", [])
			if a.size() == 3 and b.size() == 3:
				view.gunplay.tracer(Vector3(a[0], a[1], a[2]), Vector3(b[0], b[1], b[2]), Color(0.55, 0.85, 1.0))
		"st":
			if not leader and from == leader_id:
				_apply_state(d)
		"hit":
			if leader:
				var e: RefCounted = by_nid.get(int(d.get("n", -1)))
				if e != null and e.target.alive() and not e.has_meta("gone"):
					var res: Dictionary = e.target.take(float(d.get("d", 0.0)))
					if float(res.get("shield", 0.0)) > 0.0:
						view.gunplay._shield_flash(e.target, bool(res.get("broke", false)))
					view.enemies._last_hitter[e] = 1
		"boss":
			if leader:
				var dealt: float = view.raid.hit_boss(float(d.get("d", 0.0)) / view.BOSS_HP_EQUIV)
				if dealt > 0.0:
					view._flash = 0.6
		"down":
			if leader:
				if view.raid.lose_life():
					view._wiped("The fireteam is out of lives")
				else:
					view.controls.toast("%s is down · %d lives left" % [name_of(from), view.raid.lives])
		"hurt":
			if String(d.get("to", "")) == net.id and view.enemies.down <= 0.0:
				view.enemies._hit_operator(float(d.get("d", 0.0)))
		"wipe":
			if not leader and from == leader_id:
				view._wiped(String(d.get("why", "")))
		"beam":
			if not leader and from == leader_id:
				var f: Array = d.get("f", [0, 0])
				var dd: Array = d.get("d", [0, 1])
				view.beam_start(Vector3(float(f[0]), 0.06, float(f[1])), Vector3(float(dd[0]), 0, float(dd[1])).normalized())
		"ring":
			if not leader and from == leader_id:
				view.ring_start()

## the leader's numbers and field, drawn here
func _apply_state(d: Dictionary) -> void:
	var r: RefCounted = view.raid
	var s: Dictionary = d.get("r", {})
	r.lives = int(s.get("lv", r.lives))
	r.time = float(s.get("ti", r.time))
	r.pylons = (s.get("pl", r.pylons) as Array).map(func(x): return float(x))
	r.wave = int(s.get("wv", r.wave))
	r.boss_hp = float(s.get("hp", r.boss_hp))
	r.phase = int(s.get("ph", r.phase))
	r.conduits = (s.get("cd", r.conduits) as Array).map(func(x): return float(x))
	r.overload = float(s.get("ov", r.overload))
	r.clock = float(s.get("ck", r.clock))
	r.shielded = bool(s.get("sh", r.shielded))
	r.cleared = bool(s.get("cl", r.cleared))
	r.done = bool(s.get("dn", r.done))
	var ss := float(s.get("ss", view._split_side))
	if ss != view._split_side and view._boss():
		view._split_side = ss
		view.split_plane.position = Vector3(0, 0.05, view.ARENA_R * 0.5 * ss)
		if r.phase == 2:
			view.controls.toast("Reality shifts — get to the %s side" % ("north" if ss > 0.0 else "south"))
	var seen := {}
	for row in d.get("e", []):
		var a: Array = row
		if a.size() < 10:
			continue
		var nid := int(a[0])
		seen[nid] = true
		var e: RefCounted = by_nid.get(nid)
		var at := Vector3(float(a[3]), float(a[4]), float(a[5]))
		if e == null:
			e = view.enemies.spawn(String(a[1]), at, [], 1 if int(a[2]) == 1 else -1)
			e.team = int(a[2])
			if e.team == 0 and e.mover.rig:
				view.enemies._tint(e, view.VOID_TINT)
			e.set_meta("puppet", true)
			e.set_meta("nid", nid)
			e.set_meta("name", String(a[9]))
			by_nid[nid] = e
		e.set_meta("to", at)
		e.set_meta("yaw", float(a[6]))
		e.set_meta("spd", float(a[7]))
		var up := bool(a[8])
		e.target.hp = e.target.max_hp if up else 0.0
		e.mover.visible = up
	for nid in by_nid.keys():
		if not seen.has(nid):
			_free_puppet(nid)
	for t in d.get("tr", []):
		var b: Array = t
		if b.size() == 7:
			view.gunplay.tracer(Vector3(b[0], b[1], b[2]), Vector3(b[3], b[4], b[5]), Color(0.4, 0.9, 1.0) if int(b[6]) == 0 else Color(1.0, 0.75, 0.3))

func _free_puppet(nid: int) -> void:
	var e: RefCounted = by_nid.get(nid)
	by_nid.erase(nid)
	if e == null:
		return
	view.gunplay.targets.erase(e.target)
	view.enemies.enemies.erase(e)
	if is_instance_valid(e.mover):
		e.mover.queue_free()
