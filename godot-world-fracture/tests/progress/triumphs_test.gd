extends SceneTree
## Triumphs and Collections rules (scripts/progress/triumphs.gd) and the lifetime counters Progression keeps for them.
const Triumphs := preload("res://scripts/progress/triumphs.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
var fails := 0

func ok(c: bool, what: String) -> void:
	if not c:
		fails += 1
	print(("ok   " if c else "FAIL ") + what)

func _init() -> void:
	var p := { "nex": 0, "xp": 0 }
	var st := { "bosses": 0, "level": 1, "raid_clears": 0, "street_tier": 0, "collection_pct": 0 }
	ok(Triumphs.check(p, st).is_empty(), "nothing met on a fresh profile")
	Progression.event(p, "kill", 1)
	ok(int(p.lifetime.kill) == 1, "events count for good beside the day's goals")
	var won := Triumphs.check(p, st)
	ok(won.size() == 1 and String(won[0].id) == "first-blood", "the first kill meets First Blood")
	ok(Triumphs.check(p, st).is_empty(), "a met triumph is met once")
	ok(Triumphs.score(p) == 5, "its score counts")
	Progression.event(p, "race", 1)
	Progression.event(p, "street_race", 1)
	var t25: Dictionary = Triumphs.TRIUMPHS.filter(func(x): return x.id == "race-25")[0]
	ok(Triumphs.progress(p, t25, st) == 2, "a triumph sums its counters (circuit and street races)")
	st.street_tier = 3
	ok(Triumphs.check(p, st).any(func(x): return x.id == "outlaw"), "stat rows read the saves' values (street tier)")
	var gear := Gear.fresh()
	var c := Triumphs.collections(p, gear)
	ok(int(c.total) > 100, "the collection book lists the catalogues (%d entries)" % int(c.total))
	ok(int(c.found) > 0, "what the operator owns is found (%d)" % int(c.found))
	var first := int(c.found)
	gear.items.clear()
	ok(int(Triumphs.collections(p, gear).found) == first, "found stays found after the item is gone")
	var g := Progression.grant(p, "killbox", 100, 100, "test")
	ok((g.lines as Array).any(func(l): return String(l).begins_with("TRIUMPH · Killbox Debut")), "a payment toasts what it met")
	print("triumphs test: %s" % ("true" if fails == 0 else "false (%d failed)" % fails))
	quit(0 if fails == 0 else 1)
