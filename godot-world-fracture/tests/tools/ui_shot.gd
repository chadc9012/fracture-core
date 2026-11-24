extends SceneTree
## Look-dev shots of the Destiny-style screens (scripts/ui/ui_theme.gd). Opens the Character screen with a stocked bag.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/ui_shot.gd -- out.png [main|weapon|armor]
const InventoryView := preload("res://scripts/gear/inventory_view.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
var frames := 0
var view: Control
var mode := "main"
var out := "user://ui.png"

static func stocked() -> Dictionary:
	var g := Gear.fresh()
	var ws: Array = Gear.data().weapons
	var picks := {}
	for w in ws:
		var k := "%s-%s" % [w.slot, w.get("rarity", "common")]
		if picks.has(k):
			continue
		picks[k] = true
		g.items.append({ "id": "s-" + String(w.id), "name": w.name, "slot": w.slot, "power": 120 + (picks.size() * 7) % 90, "level": 1, "element": w.element, "frame": w.frame, "cls": w.cls, "rarity": w.get("rarity", "common"), "source": "Drop" })
	var sets: Array = Gear.data().armorSets
	for slot in Gear.ARMOR_SLOTS:
		for k in 3:
			var s: Dictionary = sets[(k * 7 + Gear.ARMOR_SLOTS.find(slot)) % sets.size()]
			g.items.append({ "id": "a-%s-%d" % [slot, k], "name": s.pieces[slot], "slot": slot, "power": 140 + k * 11, "level": 1, "element": s.element, "set": s.id, "frame": "", "cls": "" })
	# wear a legendary auto rifle, an exotic power weapon, and three pieces of one set
	for it in g.items:
		if it.slot == "primary" and it.get("rarity", "") == "epic":
			g.equipped.primary = it.id
		if it.slot == "heavy" and it.get("rarity", "") == "exotic":
			g.equipped.heavy = it.id
		if it.slot == "secondary" and it.get("rarity", "") == "rare":
			g.equipped.secondary = it.id
	for slot in ["helmet", "chest", "legs"]:
		g.equipped[slot] = "a-%s-0" % slot
	return g

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	if args.size() > 1:
		mode = args[1]
	view = InventoryView.new()
	view.gear = stocked()
	view.level = 12
	view.profile = { "nex": 48250 }
	get_root().add_child(view)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 8 and mode != "main":
		view._open("primary" if mode == "weapon" else "chest")
	if frames == 40:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
