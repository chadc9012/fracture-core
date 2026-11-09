extends RefCounted
## One profile (schedule step 10: economy and progression). Every mode pays through `grant`: Nex and XP go on the operator's
## profile (gear_store.gd PROFILE: user://profile.json, cloud-merged), the level follows the web game's curve (xp.ts: level N
## needs N × 400 XP to clear, so the total to reach level L is 400 · L(L−1)/2 — the campaign ends near level 11), each
## level is worth +2 operator power (gear_store.operator_power) and +4 hull (`hull_bonus`), the last twenty payments are
## kept as a ledger, and three **daily goals** picked from the pool by the day (UTC) count the modes you play and pay a
## bonus once each. Pure and headless-testable: nothing here touches a scene; the views toast what `grant` returns.

const XP_PER_LEVEL := 400
const HULL_PER_LEVEL := 4.0
const LEDGER := 20
const GOALS_PER_DAY := 3

## the goal pool: `kind` is the counter a mode bumps (grant's source, or `event`), `target` the count, reward Nex / XP
const GOALS := [
	{ "id": "kb-play", "label": "Play a Killbox match", "kind": "killbox", "target": 1, "nex": 250, "xp": 150 },
	{ "id": "kb-win", "label": "Win a Killbox match", "kind": "killbox_win", "target": 1, "nex": 450, "xp": 250 },
	{ "id": "bots", "label": "Drop 20 hostiles", "kind": "kill", "target": 20, "nex": 300, "xp": 200 },
	{ "id": "boss", "label": "Clear a Fracture boss at the Rift Gate", "kind": "boss", "target": 1, "nex": 600, "xp": 400 },
	{ "id": "quest", "label": "Finish a Descent quest", "kind": "quest", "target": 1, "nex": 350, "xp": 200 },
	{ "id": "race", "label": "Finish a race", "kind": "race", "target": 1, "nex": 300, "xp": 150 },
	{ "id": "rings", "label": "Fly 10 Skyways rings", "kind": "ring", "target": 10, "nex": 300, "xp": 150 },
	{ "id": "drive", "label": "Drive 2 km in Nexus City", "kind": "drive_m", "target": 2000, "nex": 200, "xp": 100 },
	{ "id": "shop", "label": "Buy something at the Galleria", "kind": "shop", "target": 1, "nex": 150, "xp": 80 },
	{ "id": "headshots", "label": "Land 8 headshots", "kind": "headshot", "target": 8, "nex": 350, "xp": 200 },
]

static func total_for_level(level: int) -> int:
	return XP_PER_LEVEL * (level - 1) * level / 2

static func level_for(xp_total: int) -> int:
	var l := 1
	while total_for_level(l + 1) <= xp_total and l < 200:
		l += 1
	return l

## XP into the current level and the level's size, for a bar
static func xp_bar(p: Dictionary) -> Vector2i:
	var l := level_for(int(p.get("xp", 0)))
	return Vector2i(int(p.get("xp", 0)) - total_for_level(l), l * XP_PER_LEVEL)

static func hull_bonus(p: Dictionary) -> float:
	return HULL_PER_LEVEL * (level_for(int(p.get("xp", 0))) - 1)

static func day_index(now_unix: int = -1) -> int:
	var t := now_unix if now_unix >= 0 else int(Time.get_unix_time_from_system())
	return t / 86400

## the three goals of the day with progress; resets the counters when the day turns
static func daily(p: Dictionary, now_unix: int = -1) -> Array:
	var day := day_index(now_unix)
	var d: Dictionary = p.get("daily", {})
	if int(d.get("day", -1)) != day:
		d = { "day": day, "progress": {}, "claimed": [] }
		p.daily = d
	var r := RandomNumberGenerator.new()
	r.seed = day * 7919
	var idx: Array = range(GOALS.size())
	var picked: Array = []
	for i in GOALS_PER_DAY:
		var k := r.randi() % idx.size()
		picked.append(GOALS[idx[k]])
		idx.remove_at(k)
	var out: Array = []
	for g in picked:
		var prog := int((d.progress as Dictionary).get(g.kind, 0))
		out.append({ "id": g.id, "label": g.label, "target": int(g.target), "progress": mini(prog, int(g.target)), "nex": int(g.nex), "xp": int(g.xp), "done": g.id in d.claimed })
	return out

## a counter without pay (kills, metres driven, rings); returns the goals it completed (already paid into p)
static func event(p: Dictionary, kind: String, n := 1, now_unix: int = -1) -> Array:
	daily(p, now_unix)
	var d: Dictionary = p.daily
	var prog: Dictionary = d.progress
	prog[kind] = int(prog.get(kind, 0)) + n
	return _claim(p, now_unix)

static func _claim(p: Dictionary, now_unix: int) -> Array:
	var done: Array = []
	var d: Dictionary = p.daily
	for g in daily(p, now_unix):
		if g.done or int(g.progress) < int(g.target):
			continue
		(d.claimed as Array).append(g.id)
		p.nex = int(p.get("nex", 0)) + int(g.nex)
		p.xp = int(p.get("xp", 0)) + int(g.xp)
		done.append(g)
	return done

## a payment from a mode. `source` is the counter it bumps (killbox / killbox_win / boss / quest / race / mission / ring /
## shop / skyways). Returns what to show: {nex, xp, level, leveled, lines: [toast lines], goals: [completed goals]}
static func grant(p: Dictionary, source: String, nex: int, xp: int, note := "", now_unix: int = -1) -> Dictionary:
	var before := level_for(int(p.get("xp", 0)))
	p.nex = int(p.get("nex", 0)) + nex
	p.xp = int(p.get("xp", 0)) + xp
	var ledger: Array = p.get("ledger", [])
	ledger.push_front({ "source": source, "nex": nex, "xp": xp, "note": note, "at": now_unix if now_unix >= 0 else int(Time.get_unix_time_from_system()) })
	while ledger.size() > LEDGER:
		ledger.pop_back()
	p.ledger = ledger
	var goals := event(p, source, 1, now_unix)
	if source.ends_with("_win"):
		goals.append_array(event(p, source.trim_suffix("_win"), 1, now_unix))
	var after := level_for(int(p.get("xp", 0)))
	p.level = after
	var lines: Array[String] = []
	lines.append("%s+%d Nex · +%d XP" % [(note + " — ") if note != "" else "", nex, xp])
	for g in goals:
		lines.append("DAILY GOAL · %s — +%d Nex, +%d XP" % [String(g.label), int(g.nex), int(g.xp)])
	if after > before:
		lines.append("LEVEL %d — +%d power, +%d hull" % [after, 2 * (after - before), int(HULL_PER_LEVEL * (after - before))])
	return { "nex": nex, "xp": xp, "level": after, "leveled": after > before, "lines": lines, "goals": goals }

## one line for a HUD or the title: "LV 4 · 1,250 NEX"
static func line(p: Dictionary) -> String:
	return "LV %d · %s NEX" % [level_for(int(p.get("xp", 0))), _thousands(int(p.get("nex", 0)))]

static func _thousands(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "," + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out
