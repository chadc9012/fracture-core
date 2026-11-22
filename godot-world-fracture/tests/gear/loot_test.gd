extends SceneTree
## Looting, headless (owner, Nov 22: "Test looting"). Two halves:
##  1. the drop rules (gear_store.gd roll_drop): the chance per source (18% enemy / 40% elite / 100% boss), the pools
##     (enemies roll the loot weapons only; elites and bosses the boss weapons too), a third armour, the power band round
##     the operator's power, unique ids, every drop a real catalogue weapon or set piece, a drop equips and joins the guns
##  2. live, on the Nexus street with the real kill path (gunplay → killed → street_slice's drop): kills of each street
##     enemy type roll drops into the bag at about the right rate, every drop is saved and toasted, the inventory lists it,
##     a kill resupplies ammo, broken cover drops nothing, and the drop's power follows the operator's level
##   godot --headless --path godot-world-fracture --script res://tests/gear/loot_test.gd
## The real save (user://inventory.json, profile.json) is backed up first and put back after. Prints "loot test: N failed".

const Gear := preload("res://scripts/gear/gear_store.gd")
var failed := 0
var _backup := {}

func ok(cond: bool, what: String) -> void:
	print(("ok   " if cond else "FAIL ") + what)
	if not cond:
		failed += 1

func frames(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	_run.call_deferred()

func _keep(path: String) -> void:
	_backup[path] = FileAccess.get_file_as_string(path) if FileAccess.file_exists(path) else null

func _restore() -> void:
	for path in _backup:
		if _backup[path] == null:
			if FileAccess.file_exists(path):
				DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
		else:
			var f := FileAccess.open(path, FileAccess.WRITE)
			f.store_string(_backup[path])

func _run() -> void:
	_keep(Gear.PATH)
	_keep(Gear.PROFILE)
	_rules()
	await _live()
	_restore()
	print("loot test: %d failed" % failed)
	quit(0 if failed == 0 else 1)

# ---------------------------------------------------------------------------------------------- 1. the rules

func _rules() -> void:
	var cat: Dictionary = Gear.data()
	var weapons := {}
	for w in cat.get("weapons", []):
		weapons[w.name] = w
	var pieces := {}
	for s in cat.get("armorSets", []):
		for slot in s.pieces:
			pieces[s.pieces[slot]] = [s.id, slot]
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	for src in ["enemy", "elite", "boss"]:
		var d := Gear.fresh()
		var n0: int = d.items.size()
		var drops: Array = []
		const N := 4000
		for i in N:
			var it := Gear.roll_drop(d, src, rng.randf(), 150.0, 1000 + i)
			if not it.is_empty():
				drops.append(it)
		var want: float = {"enemy": 0.18, "elite": 0.4, "boss": 1.0}[src]
		var rate := float(drops.size()) / N
		ok(absf(rate - want) < 0.025, "%s: drops %.1f%% of kills (rule %d%%)" % [src, rate * 100.0, int(want * 100.0)])
		ok(d.items.size() == n0 + drops.size(), "%s: every drop lands in the bag (%d)" % [src, drops.size()])
		var ids := {}
		var armour := 0
		var boss_guns := 0
		var unknown: Array = []
		var lo := INF
		var hi := -INF
		for it in drops:
			ids[it.id] = true
			lo = minf(lo, float(it.power))
			hi = maxf(hi, float(it.power))
			if String(it.get("set", "")) != "":
				armour += 1
				if not pieces.has(it.name) or pieces[it.name][1] != it.slot:
					unknown.append(it.name)
			elif weapons.has(it.name):
				if weapons[it.name].via == "boss":
					boss_guns += 1
				if weapons[it.name].slot != it.slot or weapons[it.name].frame != it.frame:
					unknown.append(it.name)
			else:
				unknown.append(it.name)
		ok(ids.size() == drops.size(), "%s: every drop has its own id" % src)
		ok(unknown.is_empty(), "%s: every drop is a real catalogue weapon or set piece %s" % [src, str(unknown.slice(0, 3))])
		var ash := float(armour) / maxf(1.0, drops.size())
		ok(absf(ash - 0.33) < 0.04, "%s: about a third are armour (%.0f%%)" % [src, ash * 100.0])
		if src == "enemy":
			ok(boss_guns == 0, "enemy: never a boss-pool weapon")
		else:
			ok(boss_guns > 0, "%s: boss-pool weapons can drop (%d)" % [src, boss_guns])
		var bonus := 20.0 if src == "boss" else 0.0
		ok(lo >= 150.0 - 15.0 + bonus - 0.5 and hi <= 150.0 + 25.0 + bonus + 0.5, "%s: power within the band round the operator (%d-%d)" % [src, int(lo), int(hi)])
	# a weaker operator: the floor holds at 80
	var d2 := Gear.fresh()
	var low := INF
	for i in 300:
		var it := Gear.roll_drop(d2, "enemy", 0.0, 60.0, 9000 + i)
		low = minf(low, float(it.power))
	ok(low >= 80.0, "power never under 80 (%d)" % int(low))
	# a drop worn: a stronger primary raises the operator's power and fires from the gun list
	var d3 := Gear.fresh()
	var p0 := Gear.operator_power(d3)
	var gun := {}
	for i in 400:
		var it := Gear.roll_drop(d3, "boss", 0.0, 200.0, 20000 + i)
		if it.slot == "primary":
			gun = it
			break
	ok(not gun.is_empty() and Gear.equip(d3, gun.id), "a dropped primary equips")
	ok(Gear.operator_power(d3) > p0 and Gear.loadout(d3)[0].name == gun.get("name", ""), "it raises power (%d → %d) and is the first gun" % [int(p0), int(Gear.operator_power(d3))])

# ---------------------------------------------------------------------------------------------- 2. live on the street

func _live() -> void:
	# a clean bag and a level-20 operator, so the street's drops can be read
	var bag := Gear.fresh()
	Gear.save(bag)
	var prof := Gear.profile_load()
	prof.level = 20
	Gear.profile_save(prof)
	load("res://scripts/city/street_slice.gd").force_armed = true
	var main: Node = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await frames(20)
	if main.creator:
		main._close_creator()
	main._open_street(true, "nexus", true)
	await frames(12)
	var st = main.street
	ok(st != null and st.gunplay != null and st.enemies != null, "the Nexus street opens armed with its enemies")
	if st == null or st.gunplay == null:
		return
	st.controls.scripted = true
	var g = st.gunplay
	var en = st.enemies
	en.respawn_enabled = false
	seed(7)
	var toasts: Array = []
	st.controls.toast_hook = func(t: String) -> void: toasts.append(t)
	var n0: int = st.gear.items.size()
	# kill a run of each type through the real path (gunplay.grenade_hit: the bolt's hit / killed signals)
	var per := { "scout": 160, "elite": 90, "marksman": 40, "drone": 40, "executor": 40 }
	var killed := 0
	var counts := {}
	for type in per:
		var before: int = st.gear.items.size()
		for i in per[type]:
			var e = en.spawn(type, st.operator.position + Vector3(4, 0, -6))
			g.grenade_hit(e.target, 99999.0, e.target.box.get_center())
			if not e.target.alive():
				killed += 1
		counts[type] = st.gear.items.size() - before
	var total: int = st.gear.items.size() - n0
	ok(killed == 370, "every spawned enemy went down through the kill path (%d)" % killed)
	var sc: int = counts.scout
	var el: int = counts.elite
	ok(sc >= 16 and sc <= 44, "scouts drop about 18%% (%d of 160)" % sc)
	ok(el >= 24 and el <= 50, "elites drop about 40%% (%d of 90)" % el)
	print("     drops per type: ", counts)
	# every drop saved, and toasted
	var saved := Gear.load_save()
	ok(saved.items.size() == st.gear.items.size(), "every drop is saved to the bag on disk (%d in the bag, %d saved)" % [st.gear.items.size(), saved.items.size()])
	var picked := toasts.filter(func(t): return String(t).begins_with("Picked up"))
	ok(picked.size() == total, "every drop is toasted \"Picked up …\" (%d toasts, %d drops)" % [picked.size(), total])
	# the drops' power follows the operator's level (level 20: +38 over the worn average)
	var worn := Gear.operator_power(Gear.fresh())
	var at_level := Gear.operator_power(Gear.fresh(), 20)
	var mean := 0.0
	var dropped: Array = st.gear.items.slice(n0)
	for it in dropped:
		mean += float(it.power)
	mean /= maxf(1.0, dropped.size())
	ok(mean > at_level - 5.0, "street drops are rolled at the operator's level (mean %d; level-1 band centres %d, level-20 %d)" % [int(mean), int(worn + 5.0), int(at_level + 5.0)])
	# the inventory lists them
	st.open_inventory()
	await frames(3)
	var inv = st.inventory_overlay
	var listed := 0
	if inv:
		var labels: Array = inv.find_children("*", "Label", true, false) + inv.find_children("*", "Button", true, false)
		var text := ""
		for l in labels:
			text += String(l.text) + "\n"
		for it in dropped.slice(0, 5):
			if text.contains(String(it.name)):
				listed += 1
	ok(inv != null and listed > 0, "the inventory shows the drops (%d of the first 5 named on its page)" % listed)
	if inv:
		st.close_inventory()
	# a kill resupplies the guns (half a magazine to the reserve)
	var gn = g.gun()
	gn.reserve = 0
	var e2 = en.spawn("scout", st.operator.position + Vector3(4, 0, -6))
	g.grenade_hit(e2.target, 99999.0, e2.target.box.get_center())
	ok(int(gn.reserve) > 0, "a kill puts ammo back in the reserve (%d)" % int(gn.reserve))
	# broken cover drops nothing
	var covers: Array = g.targets.filter(func(t): return t.has_meta("cover_box") and t.alive())
	var b0: int = st.gear.items.size()
	var broke := 0
	for t in covers.slice(0, 6):
		t.hp = 0.001
		g._break_cover(t)
		broke += 1
	ok(st.gear.items.size() == b0, "breaking cover drops nothing (%d broken)" % broke)
	st.controls.toast_hook = Callable()
