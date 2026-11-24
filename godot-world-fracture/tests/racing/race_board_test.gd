extends SceneTree
## The race leaderboard (scripts/ui/race_board.gd): where you land on it is the placing you were paid for, and the
## career keeps personal bests.
const RaceBoard := preload("res://scripts/ui/race_board.gd")
const Career := preload("res://scripts/racing/street_career.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

## street_life._clock_place, for a pace of `par`
func clock_place(t: float, par: float, prizes: int) -> int:
	var p := 1
	for k in [1.0, 1.06, 1.12]:
		if t > par * k:
			p += 1
	return mini(p, prizes)

func _rank(rows: Array) -> int:
	for r in rows:
		if r.you:
			return int(r.rank)
	return -1

func _init() -> void:
	var ev: Dictionary = Career.EVENTS["neon-ring"]
	var par := 120.0
	var agree := true
	for t in [100.0, 120.0, 121.0, 127.2, 128.0, 134.4, 135.0, 300.0]:
		var rows := RaceBoard.rows("neon-ring", ev, t, par)
		var want := clock_place(t, par, (ev.prize as Array).size())
		agree = agree and rows.any(func(r): return r.you) and rows.size() <= 8
		if want < 4:
			agree = agree and _rank(rows) == want
		else:
			agree = agree and _rank(rows) >= 4
	ok(agree, "on a timed race your rank on the board is your paid placing (and you're always on it)")
	var dr: Dictionary = Career.EVENTS["neon-drift"]
	var dagree := true
	for sc in [12000.0, 9000.0, 7000.0, 4000.0, 100.0]:
		var place := 1
		for k in dr.targets:
			if float(k) > sc:
				place += 1
		var rk := _rank(RaceBoard.rows("neon-drift", dr, sc, 0.0))
		dagree = dagree and (rk == place if place < 4 else rk >= 4)
	ok(dagree, "a drift battle ranks scores the same way")
	ok(RaceBoard.rows("neon-ring", ev, 130.0, par) == RaceBoard.rows("neon-ring", ev, 130.0, par), "the same event reads the same board")
	var c = Career.new()
	c.path = "user://race_board_test.json"
	var a: Dictionary = c.finish("neon-ring", 2, {}, 130.0)
	ok(a.pb and a.prev < 0.0, "a first time is a personal best")
	var b: Dictionary = c.finish("neon-ring", 1, {}, 118.5)
	ok(b.pb and is_equal_approx(float(b.prev), 130.0), "a faster one beats it")
	var d: Dictionary = c.finish("neon-ring", 3, {}, 140.0)
	ok(not d.pb and is_equal_approx(float(c.times["neon-ring"]), 118.5), "a slower one doesn't")
	var e: Dictionary = c.finish("neon-drift", 1, {}, 9500.0)
	var f: Dictionary = c.finish("neon-drift", 1, {}, 9800.0)
	ok(e.pb and f.pb, "drift bests go up, not down")
	var g = Career.new()
	g.from_dict(c.to_dict())
	ok(g.times.size() == 2, "bests survive the save")
	print("RACE BOARD %s (%d failed)" % ["PASS" if fails == 0 else "FAIL", fails])
	quit(1 if fails else 0)
