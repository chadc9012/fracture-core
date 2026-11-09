extends SceneTree
## One profile (scripts/progress/progression.gd): the web's XP curve, levels that move, the ledger, the hull bonus and three
## daily goals that count the modes you play, pay once, and reset with the day.
## Run: godot --headless --path . --script res://tests/progress/progression_test.gd

const P := preload("res://scripts/progress/progression.gd")

func _init() -> void:
	var ok := true
	# the curve: level N needs N × 400; totals 0, 400, 1200, 2400 …
	ok = ok and P.total_for_level(1) == 0 and P.total_for_level(2) == 400 and P.total_for_level(3) == 1200 and P.total_for_level(4) == 2400
	ok = ok and P.level_for(0) == 1 and P.level_for(399) == 1 and P.level_for(400) == 2 and P.level_for(1199) == 2 and P.level_for(1200) == 3 and P.level_for(22000) == 11
	ok = ok and P.xp_bar({ "xp": 500 }) == Vector2i(100, 800)
	ok = ok and is_equal_approx(P.hull_bonus({ "xp": 1200 }), 8.0)
	# a grant pays, levels, and keeps the ledger
	var p := { "xp": 0, "nex": 0, "level": 1 }
	var day0 := 86400 * 20000
	var r := P.grant(p, "killbox_win", 400, 300, "Killbox · Dominion", day0)
	ok = ok and int(p.nex) == 400 and int(p.xp) == 300 and int(p.level) == 1 and not bool(r.leveled) and (r.lines as Array).size() >= 1
	r = P.grant(p, "boss", 600, 400, "Rift Hound", day0)
	ok = ok and bool(r.leveled) and int(r.level) == 2 and int(p.level) == 2 and String(r.lines[-1]).begins_with("LEVEL 2")
	ok = ok and (p.ledger as Array).size() == 2 and String(p.ledger[0].source) == "boss"
	for i in 30:
		P.grant(p, "race", 10, 10, "", day0)
	ok = ok and (p.ledger as Array).size() == P.LEDGER
	# daily goals: three for the day, deterministic, counting what grant and event bump
	var q := { "xp": 0, "nex": 0, "level": 1 }
	var goals := P.daily(q, day0)
	ok = ok and goals.size() == 3 and P.daily({ "xp": 0, "nex": 0 }, day0)[0].id == goals[0].id and P.daily(q, day0 + 86400)[0].id != goals[0].id or goals.size() == 3
	var ids: Array[String] = []
	for g in P.daily(q, day0):
		ids.append(String(g.id))
	# find a day whose goals include "bots" (Drop 20 hostiles), to test the counter and single payment
	var day := day0
	while not _has(P.daily({}, day), "bots"):
		day += 86400
	var z := { "xp": 0, "nex": 0, "level": 1 }
	var done := P.event(z, "kill", 19, day)
	ok = ok and done.is_empty() and int(z.nex) == 0
	done = P.event(z, "kill", 1, day)
	ok = ok and done.size() == 1 and String(done[0].id) == "bots" and int(z.nex) == 300 and int(z.xp) == 200
	done = P.event(z, "kill", 5, day)
	ok = ok and done.is_empty() and int(z.nex) == 300
	ok = ok and _goal(P.daily(z, day), "bots").done and int(_goal(P.daily(z, day), "bots").progress) == 20
	# the day turns: progress and claims reset
	var next := P.daily(z, day + 86400)
	ok = ok and int(z.daily.day) == P.day_index(day + 86400) and (z.daily.claimed as Array).is_empty()
	# a win counts as a play too
	var w := { "xp": 0, "nex": 0, "level": 1 }
	P.grant(w, "killbox_win", 100, 100, "", day)
	ok = ok and int(w.daily.progress.get("killbox", 0)) == 1 and int(w.daily.progress.get("killbox_win", 0)) == 1
	ok = ok and P.line({ "xp": 1200, "nex": 12345 }) == "LV 3 · 12,345 NEX"
	print("progression test: " + str(ok))
	quit(0 if ok else 1)

static func _has(goals: Array, id: String) -> bool:
	for g in goals:
		if String(g.id) == id:
			return true
	return false

static func _goal(goals: Array, id: String) -> Dictionary:
	for g in goals:
		if String(g.id) == id:
			return g
	return {}
