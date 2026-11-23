extends "res://scripts/net/online_coop.gd"
## An online raid fireteam (Nov 22; TASKBOARD "online raid fireteams"): Raid 01 played by the players in the encounter's
## room "raid:hollow-star:<encounter>", the bots filling the empty slots of six. The shared part — who leads, the other
## players' bodies, the troopers drawn from the leader's field, hits and hurt — is online_coop.gd; here the raid's own:
##   * the leader benches one bot per other player, and spawns them all when the lead is decided or passes to it;
##   * the state carries the raid's numbers (lives, clock, pylons, wave, the star's hull and phase, the conduits, the
##     overload, the split side);
##   * the star's beams and rings go out as "beam" / "ring" when they start (every screen runs them against its own
##     operator), a wipe as "wipe"; followers send their rounds on the star as "boss" and their downs as "down" (the
##     leader spends the shared life).
## If the leader leaves, the next one in leads and the encounter starts over from its checkpoint.

const HollowStar := preload("res://scripts/raid/hollow_star.gd")

func room_name() -> String:
	return "raid:%s:%s" % [HollowStar.ID, String(view.start_at)]

func _spawn_at() -> Vector3:
	return view.spawn_point

func _on_lead(first: bool) -> void:
	if leader:
		view.spawn_bots()
	if first:
		view.controls.toast("Online fireteam · %s" % ("you lead · %d player%s" % [count(), "" if count() == 1 else "s"] if leader else "%s leads" % name_of(leader_id)))
	elif leader:
		# the leader left: this screen runs the encounter now, from its start
		view.raid.begin(view.raid.encounter)
		view._wiped("The leader left the fireteam")

func _puppet_made(e: RefCounted) -> void:
	if e.team == 0 and e.mover.rig:
		view.enemies._tint(e, view.VOID_TINT)

## the leader benches a bot for each other player (six in all) and brings one back when a player goes
func _leader_step(_dt: float) -> void:
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

func _extra_state() -> Dictionary:
	var r: RefCounted = view.raid
	return { "lv": r.lives, "ti": snappedf(r.time, 0.1), "pl": r.pylons.map(func(x): return snappedf(x, 0.001)), "wv": r.wave,
		"hp": snappedf(r.boss_hp, 0.01), "ph": r.phase, "cd": r.conduits.map(func(x): return snappedf(x, 0.001)), "ov": snappedf(r.overload, 0.001),
		"ck": snappedf(r.clock, 0.1), "sh": r.shielded, "cl": r.cleared, "dn": r.done, "ss": view._split_side }

func _apply_extra(s: Dictionary) -> void:
	var r: RefCounted = view.raid
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

func _on_event(event: String, d: Dictionary, from: String) -> void:
	match event:
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
