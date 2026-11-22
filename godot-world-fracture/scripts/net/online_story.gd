extends "res://scripts/net/online_coop.gd"
## Story co-op (Nov 22, owner picked "Online story co-op"): the Fracture Descent and the campaign played together by the
## players on the same chapter — room "story:<chain>:<chapter id>", chain "descent" (Act 1, descent.gd) or "campaign"
## (missions 02–25, campaign.gd). The shared part — who leads, the other players' bodies, the troopers drawn from the
## leader's field, hits and hurt — is online_coop.gd; here the story's own:
##   * the leader's descent runs the chapter: the patrols, guards and waves, the counters and timers, the boss; any
##     player standing at a relay, the terminal, the core or the chapter's spot counts (`anyone_near`); the state carries
##     the chapter's progress, the waypoint and the boss (where, facing, hull, down);
##   * a follower's descent draws it: the HUD from the leader's progress, the leader's waypoint, the boss as an echo on
##     its own screen (it fights this player where the leader's stands, takes its hull from the leader, summons nothing)
##     — rounds on it go to the leader as "bh";
##   * the leader finishing the chapter sends "done": everyone finishes it with their own rewards and save, and moves on
##     to the next chapter's room together. Choices, talks and cutscenes are each player's own.
## If the leader leaves, the next one in leads and spawns the chapter's guards afresh where the counts stand.

func room_name() -> String:
	return "story:%s:%s" % [String(view.coop_chain()), String(view.quest.get("id", ""))]

func _world() -> Node3D:
	return view.region.world()

func _cam() -> Camera3D:
	return view.region.camera()

func _on_lead(first: bool) -> void:
	view.coop_ready(leader, first)

func _extra_state() -> Dictionary:
	var p: Dictionary = view.progress
	var x := { "q": String(view.quest.get("id", "")), "k": int(p.kills), "r": int(p.relay), "t": snappedf(float(p.timer), 0.1), "w": int(p.wave), "s": int(p.stage),
		"wp": _v3(view.waypoint), "won": view.waypoint_node != null and view.waypoint_node.visible }
	var b: Node3D = view.boss
	if b and b.rules:
		x.b = [snappedf(b.position.x, 0.01), snappedf(b.position.y, 0.01), snappedf(b.position.z, 0.01), snappedf(b.heading, 0.01), snappedf(b.rules.hull, 0.1), b.rules.dead]
	return x

func _apply_extra(x: Dictionary) -> void:
	if String(x.get("q", "")) != String(view.quest.get("id", "")):
		return
	var p: Dictionary = view.progress
	p.kills = int(x.get("k", p.kills))
	p.relay = int(x.get("r", p.relay))
	p.timer = float(x.get("t", p.timer))
	p.wave = int(x.get("w", p.wave))
	p.stage = int(x.get("s", p.stage))
	var wp: Array = x.get("wp", [])
	if wp.size() == 3:
		var at := Vector3(float(wp[0]), float(wp[1]), float(wp[2]))
		if at.distance_to(view.waypoint) > 1.0 or (view.waypoint_node != null and view.waypoint_node.visible) != bool(x.get("won", true)):
			view._set_waypoint(at, bool(x.get("won", true)))
	var bs: Array = x.get("b", [])
	if bs.size() == 6:
		view.coop_boss(Vector3(float(bs[0]), float(bs[1]), float(bs[2])), float(bs[3]), float(bs[4]), bool(bs[5]))

## your rounds on the boss's echo: the leader's boss takes them
func _on_hit(t: RefCounted, damage: float, head: bool) -> void:
	super(t, damage, head)
	if not leader and view.boss and t == view.boss.target:
		send("bh", { "d": snappedf(damage, 0.1), "h": head })

func _on_event(event: String, d: Dictionary, from: String) -> void:
	match event:
		"bh":
			if leader and view.boss and view.boss.rules and not view.boss.rules.dead:
				view.boss.rules.hit(float(d.get("d", 0.0)) * (1.3 if bool(d.get("h", false)) else 1.0))
		"done":
			if not leader and from == leader_id:
				view.coop_done(String(d.get("id", "")))
