extends SceneTree
## Garage rules, run headless:  godot --headless --path godot-world-fracture --script res://tests/garage_test.gd
## Exits 0 when every check passes, 1 otherwise.

const Catalog := preload("res://scripts/garage/catalog.gd")
const State := preload("res://scripts/garage/garage_state.gd")
const Order := preload("res://scripts/garage/garage_order.gd")

var fails := 0
var checks := 0

func ok(cond: bool, what: String) -> void:
	checks += 1
	if not cond:
		fails += 1
		printerr("FAIL: ", what)

func _init() -> void:
	catalog()
	orders()
	saving()
	print("garage tests: %d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)

func catalog() -> void:
	var ids := {}
	for p in Catalog.PARTS:
		ok(not ids.has(p.id), "unique part id " + p.id)
		ids[p.id] = true
		ok(Catalog.SLOTS.has(p.slot), "part slot exists " + p.id)
		ok(p.price > 0, "part has a price " + p.id)
		for c in p.fits:
			ok(c in Catalog.ALL, "known class %s on %s" % [c, p.id])
	for s in Catalog.SHOPS:
		for slot in s.slots:
			ok(Catalog.SLOTS.has(slot), "shop slot exists %s/%s" % [s.id, slot])
			ok(Catalog.items_for_slot(slot).size() > 0, "shop sells something in %s/%s" % [s.id, slot])
	for v in Catalog.VEHICLES:
		ok(FileAccess.file_exists(v.model) or ResourceLoader.exists(v.model), "model exists " + v.model)
		ok(v.cls in Catalog.ALL, "vehicle class " + v.id)
	# every car has something to buy at every shop it can enter
	for v in Catalog.VEHICLES:
		var any := false
		for s in Catalog.SHOPS:
			for slot in s.slots:
				for it in Catalog.items_for_slot(slot):
					if Catalog.fits(it, v.cls):
						any = true
		ok(any, "something fits " + v.id)
	# stats: parts add, clamped to 0..100
	var base := Catalog.stats_with("tuner", {})
	var tuned := Catalog.stats_with("tuner", { "engine": "engine-2", "turbo": "turbo" })
	ok(tuned.speed == base.speed + 8 and tuned.accel == base.accel + 15, "stats add up")
	ok(Catalog.stats_with("security-suv", { "armor": "armor-2", "glass": "glass-armored", "shield": "shield-emitter" }).armor == 100, "stats clamp at 100")

func orders() -> void:
	var st = State.fresh()
	st.credits = 20000
	var o = Order.new("nexus-customs", "tuner")
	ok(o.add(st, "paint-red"), "paint sells at Nexus Customs")
	ok(o.add(st, "spoiler-duck"), "a ducktail fits a tuner")
	ok(not o.add(st, "engine-1"), "Nexus Customs doesn't do engines")
	ok(o.block_reason(st, "engine-1").contains("doesn't fit"), "and says so")
	ok(not o.add(st, "bullbar-steel"), "a bull bar doesn't fit a tuner")
	ok(o.add(st, "spoiler-gt"), "picking another spoiler swaps it in (rep 1 met)")
	ok(o.lines.spoiler == "spoiler-gt" and o.lines.size() == 2, "one part per slot")
	ok(o.set_repair(st, true), "the damaged tuner can be repaired")
	var expect: int = 1000 + 3200 + 35 * Catalog.REPAIR_PER_POINT
	ok(o.total(st) == expect, "total %d == %d" % [o.total(st), expect])
	ok(o.preview_parts(st).spoiler == "spoiler-gt", "preview shows the order")
	ok(o.checkout(st) == "", "checkout succeeds")
	ok(st.credits == 20000 - expect, "charged once")
	ok(st.car("tuner").paint == "paint-red" and st.car("tuner").parts.spoiler == "spoiler-gt" and st.car("tuner").damage == 0, "fitted and repaired")
	ok(o.is_empty(), "order cleared after checkout")
	ok(o.block_reason(st, "paint-red") == "Already fitted", "no paying twice for what's fitted")
	# all or nothing: too expensive -> nothing changes
	var o2 = Order.new("neon-performance", "street-racer")
	st.credits = 3000
	o2.add(st, "engine-2"); o2.add(st, "glow-cyan")
	var before := JSON.stringify(st.to_dict())
	ok(o2.checkout(st).begins_with("Need"), "not enough credits")
	ok(JSON.stringify(st.to_dict()) == before, "state untouched by a failed checkout")
	# reputation gates
	st.credits = 100000
	var o3 = Order.new("fracture-dynamics", "street-racer")
	o3.add(st, "fracture-phase")
	ok(o3.lines.is_empty(), "fracture core needs reputation")
	st.rep["fracture-dynamics"] = 2
	ok(o3.add(st, "fracture-phase"), "with reputation it sells")
	ok(o3.checkout(st) == "", "and checks out")
	ok(st.rep["fracture-dynamics"] == 3, "a big job earns standing")
	ok(not Order.new("fracture-dynamics", "tuner").set_repair(st, true), "Fracture Dynamics doesn't do repairs")
	# kit presets: every piece that fits goes in, the rest is skipped
	var st2 = State.fresh()
	var o4 = Order.new("neon-performance", "street-racer")
	ok(o4.add_preset(st2, "widebody") >= 7, "widebody kit fills the order on a supercar")
	ok(o4.lines.has("skirts") and o4.lines.skirts == "skirts-wide", "widebody arches in")
	var o5 = Order.new("nexus-customs", "offroad-truck")
	ok(o5.add_preset(st2, "racing") <= 2, "a racing kit barely fits a 4x4 (only what fits goes in)")
	for p in Catalog.PRESETS:
		for id in p.items:
			ok(not Catalog.item(id).is_empty(), "preset item exists " + id)
	# shop price levels
	ok(Order.new("neon-performance", "tuner").price_of("turbo") == int(round(5500 * 1.15)), "shop multiplier applies")

func saving() -> void:
	var st = State.fresh()
	st.credits = 1234
	st.cars["tuner"].parts["spoiler"] = "spoiler-gt"
	st.cars["tuner"].paint = "paint-cyan"
	var path := "user://garage_test.json"
	ok(st.save(path), "saves")
	var back = State.load_or_fresh(path)
	ok(back.credits == 1234 and back.car("tuner").parts.spoiler == "spoiler-gt" and back.car("tuner").paint == "paint-cyan", "loads what was saved")
	# a save from a newer build with unknown parts and cars loads what it can
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(JSON.stringify({ "version": 1, "credits": 5, "cars": { "tuner": { "parts": { "spoiler": "nope", "front": "front-street" }, "damage": 400 }, "ghost-car": {} } }))
	f.close()
	var odd = State.load_or_fresh(path)
	ok(not odd.car("tuner").parts.has("spoiler") and odd.car("tuner").parts.front == "front-street", "unknown parts dropped")
	ok(odd.car("tuner").damage == 100 and not odd.cars.has("ghost-car"), "damage clamped, unknown cars dropped")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
