extends Node3D
## Fracture Royale's loot (owner, Nov 22: "a battle royal like fortnight call of duty battle field"): you land with a
## sidearm and find the rest. Guns lie on the ground in five rarities (the colour of the light over them), with ammo,
## armour plates and med kits; chests hold a better gun and supplies; a supply drop comes down under a beam with the
## best of it; a squad you put down leaves what it carried. Walk over a thing to take it; a gun when your three slots
## are full is swapped for the one in your hands with ENTER.

const Weapons := preload("res://scripts/combat/weapons.gd")
const Sound := preload("res://scripts/audio/sound.gd")

const RARITIES := ["common", "uncommon", "rare", "epic", "legendary"]
const RARITY := {
	"common": { "name": "Common", "color": Color(0.72, 0.74, 0.78), "mult": 0.85 },
	"uncommon": { "name": "Uncommon", "color": Color(0.35, 0.9, 0.35), "mult": 1.0 },
	"rare": { "name": "Rare", "color": Color(0.3, 0.6, 1.0), "mult": 1.15 },
	"epic": { "name": "Epic", "color": Color(0.75, 0.35, 1.0), "mult": 1.3 },
	"legendary": { "name": "Legendary", "color": Color(1.0, 0.72, 0.2), "mult": 1.5 },
}
## what lies on the ground, and how often (weights)
const GROUND_FRAMES := { "AUTO": 5, "SMG": 5, "SHOTGUN": 4, "SIDEARM": 3, "SNIPER": 2, "LMG": 2, "FUSION": 2 }
const SUPPLY_FRAMES := ["SNIPER", "LMG", "FUSION", "AUTO"]
const SLOTS := 3
const PLATE := 50.0
const PLATES_MAX := 150.0
const MED := 50.0
const MEDS_MAX := 3
const PICK_R := 1.5
const CHEST_R := 2.2
const SEE := 90.0              # an item is drawn inside this range
const SUPPLY_FALL := 9.0
const SUPPLY_FROM := 110.0

class Item:
	var kind := ""               # gun | ammo | plate | med | chest | supply
	var frame := ""
	var rarity := "common"
	var node: Node3D
	var pos := Vector3.ZERO
	var falling := false
	var spin := 0.0
	var opened := false

var items: Array[Item] = []
var meds := 0
var opened := 0
var picked := 0
var ground_at: Callable
var _rng := RandomNumberGenerator.new()
var _models := {}
var _beams := {}

func _init() -> void:
	_rng.seed = 90210

static func rarity_color(r: String) -> Color:
	return (RARITY.get(r, RARITY.common) as Dictionary).color

static func roll_rarity(rng: RandomNumberGenerator, lift := 0) -> String:
	# ground loot: mostly common and uncommon; a chest (lift 1) and a supply drop (lift 3) roll higher
	var t := rng.randf()
	var i := 0 if t < 0.42 else (1 if t < 0.72 else (2 if t < 0.9 else (3 if t < 0.975 else 4)))
	return RARITIES[mini(i + lift, 4)]

static func roll_frame(rng: RandomNumberGenerator) -> String:
	var total := 0
	for k in GROUND_FRAMES:
		total += int(GROUND_FRAMES[k])
	var t := rng.randi() % total
	for k in GROUND_FRAMES:
		t -= int(GROUND_FRAMES[k])
		if t < 0:
			return String(k)
	return "AUTO"

## a gun as the operator carries it
static func make_gun(frame: String, rarity: String) -> Weapons.Gun:
	var g := Weapons.Gun.new(frame)
	var r: Dictionary = RARITY[rarity]
	g.label = "%s %s" % [String(r.name), String(Weapons.FRAMES[frame].name)]
	g.mult = float(r.mult)
	g.rarity = rarity
	g.reserve = g.mag * 2          # found guns come with two spare magazines; the rest is ammo off the ground
	return g

func _mat(c: Color, emit := 0.0, alpha := 1.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(c.r, c.g, c.b, alpha)
	m.roughness = 0.6
	if alpha < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m

func _mesh(parent: Node3D, mesh: Mesh, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.visibility_range_end = SEE
	parent.add_child(mi)
	return mi

func _box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b

## the light over an item: a thin column in its colour and a disc on the ground, so loot reads from across a field
func _marker(parent: Node3D, col: Color, h: float, r := 0.09) -> void:
	var c := CylinderMesh.new()
	c.top_radius = r * 0.3
	c.bottom_radius = r
	c.height = h
	c.radial_segments = 8
	c.rings = 1
	c.cap_top = false
	c.cap_bottom = false
	var beam := _mesh(parent, c, Vector3(0, h * 0.5, 0), _mat(col, 2.0, 0.45))
	beam.visibility_range_end = SEE * 2.5 if h > 10.0 else SEE
	var d := CylinderMesh.new()
	d.top_radius = 0.55
	d.bottom_radius = 0.55
	d.height = 0.02
	d.radial_segments = 20
	_mesh(parent, d, Vector3(0, 0.03, 0), _mat(col, 1.6, 0.5))

func _gun_node(frame: String, rarity: String) -> Node3D:
	var n := Node3D.new()
	var col := rarity_color(rarity)
	_marker(n, col, 2.6)
	var holder := Node3D.new()
	holder.name = "spin"
	holder.position.y = 0.75
	n.add_child(holder)
	var path := "res://models/weapons/" + String(Weapons.FRAMES[frame].model)
	if not _models.has(frame) and ResourceLoader.exists(path):
		_models[frame] = load(path)
	if _models.has(frame):
		var m := (_models[frame] as PackedScene).instantiate() as Node3D
		holder.add_child(m)
		for mi in m.find_children("*", "MeshInstance3D", true, false):
			(mi as MeshInstance3D).visibility_range_end = SEE * 0.6
			(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	else:
		_mesh(holder, _box(Vector3(0.12, 0.2, 0.8)), Vector3.ZERO, _mat(Color(0.15, 0.15, 0.17)))
	return n

func _small(kind: String) -> Node3D:
	var n := Node3D.new()
	match kind:
		"ammo":
			_marker(n, Color(1.0, 0.85, 0.3), 1.4, 0.06)
			_mesh(n, _box(Vector3(0.42, 0.26, 0.26)), Vector3(0, 0.16, 0), _mat(Color(0.3, 0.36, 0.2)))
			_mesh(n, _box(Vector3(0.44, 0.05, 0.28)), Vector3(0, 0.26, 0), _mat(Color(1.0, 0.85, 0.3), 1.2))
		"plate":
			_marker(n, Color(0.3, 0.7, 1.0), 1.8, 0.07)
			var hex := CylinderMesh.new()
			hex.top_radius = 0.26
			hex.bottom_radius = 0.26
			hex.height = 0.07
			hex.radial_segments = 6
			var p := _mesh(n, hex, Vector3(0, 0.5, 0), _mat(Color(0.3, 0.7, 1.0), 1.8))
			p.rotation.x = PI * 0.5
			p.name = "spin"
		"med":
			_marker(n, Color(0.4, 1.0, 0.5), 1.8, 0.07)
			_mesh(n, _box(Vector3(0.4, 0.3, 0.2)), Vector3(0, 0.2, 0), _mat(Color(0.92, 0.92, 0.9)))
			_mesh(n, _box(Vector3(0.22, 0.07, 0.21)), Vector3(0, 0.2, 0), _mat(Color(0.2, 0.85, 0.35), 1.5))
			_mesh(n, _box(Vector3(0.07, 0.22, 0.21)), Vector3(0, 0.2, 0), _mat(Color(0.2, 0.85, 0.35), 1.5))
	return n

func _chest_node(supply: bool) -> Node3D:
	var n := Node3D.new()
	var gold := Color(1.0, 0.72, 0.2)
	var body := Color(0.2, 0.32, 0.5) if supply else Color(0.26, 0.2, 0.14)
	var s := 1.5 if supply else 1.0
	_mesh(n, _box(Vector3(1.1, 0.6, 0.7) * s), Vector3(0, 0.3 * s, 0), _mat(body))
	var lid := _mesh(n, _box(Vector3(1.14, 0.16, 0.74) * s), Vector3(0, 0.66 * s, 0), _mat(body.lightened(0.15)))
	lid.name = "lid"
	for x: float in [-0.4, 0.4]:
		_mesh(n, _box(Vector3(0.1, 0.64, 0.74) * s), Vector3(x * s, 0.31 * s, 0), _mat(gold, 1.6))
	_mesh(n, _box(Vector3(0.16, 0.16, 0.06) * s), Vector3(0, 0.5 * s, 0.36 * s), _mat(gold, 3.0))
	_marker(n, Color(0.3, 0.8, 1.0) if supply else gold, 160.0 if supply else 5.0, 0.5 if supply else 0.12)
	return n

func _ground(x: float, z: float) -> float:
	return float(ground_at.call(x, z)) if ground_at.is_valid() else 0.0

func add(kind: String, at: Vector3, frame := "", rarity := "common") -> Item:
	var it := Item.new()
	it.kind = kind
	it.frame = frame
	it.rarity = rarity
	it.pos = at
	it.spin = _rng.randf() * TAU
	it.node = _gun_node(frame, rarity) if kind == "gun" else (_chest_node(kind == "supply") if kind in ["chest", "supply"] else _small(kind))
	it.node.position = at
	add_child(it.node)
	items.append(it)
	return it

func _free_spot(p: Vector2, obstacles: Array) -> bool:
	for b: AABB in obstacles:
		if p.x > b.position.x - 0.8 and p.x < b.end.x + 0.8 and p.y > b.position.z - 0.8 and p.y < b.end.z + 0.8:
			return false
	return true

## the field's loot at the start: guns, ammo, plates and med kits spread through the first circle, and chests
func scatter(centre: Vector2, radius: float, obstacles: Array, guns := 46, smalls := 60, chests := 14) -> void:
	var placed := 0
	var tries := 0
	while placed < guns + smalls + chests and tries < 2000:
		tries += 1
		var a := _rng.randf() * TAU
		var r := sqrt(_rng.randf()) * (radius - 6.0)
		var p := centre + Vector2(cos(a), sin(a)) * r
		if not _free_spot(p, obstacles):
			continue
		var at := Vector3(p.x, _ground(p.x, p.y), p.y)
		if placed < guns:
			add("gun", at, roll_frame(_rng), roll_rarity(_rng))
		elif placed < guns + smalls:
			add(["ammo", "ammo", "plate", "med"][_rng.randi() % 4], at)
		else:
			add("chest", at)
		placed += 1

## a supply drop: a crate that comes down under a beam and lands at `p`
func supply(p: Vector2) -> Item:
	var y := _ground(p.x, p.y)
	var it := add("supply", Vector3(p.x, y + SUPPLY_FROM, p.y))
	it.falling = true
	it.pos = Vector3(p.x, y, p.y)
	return it

## what a rival carried, left where it fell
func death_drop(at: Vector3) -> void:
	var g := Vector3(at.x, _ground(at.x, at.z), at.z)
	add("gun", g, roll_frame(_rng), roll_rarity(_rng))
	add("ammo", g + Vector3(0.9, 0, 0.3))
	if _rng.randf() < 0.5:
		add(["plate", "med"][_rng.randi() % 2], g + Vector3(-0.6, 0, 0.8))

func _spill(it: Item) -> void:
	var lift := 3 if it.kind == "supply" else 1
	var frame: String = SUPPLY_FRAMES[_rng.randi() % SUPPLY_FRAMES.size()] if it.kind == "supply" else roll_frame(_rng)
	var n := 5 if it.kind == "supply" else 3
	add("gun", it.pos + Vector3(1.3, 0, 0), frame, roll_rarity(_rng, lift))
	for k in n:
		var a := 1.2 + k * TAU / float(n + 1)
		var p := it.pos + Vector3(cos(a), 0, sin(a)) * 1.4
		p.y = _ground(p.x, p.z)
		add(["ammo", "plate", "med", "plate", "ammo"][k % 5], p)

func _remove(it: Item) -> void:
	items.erase(it)
	if is_instance_valid(it.node):
		it.node.queue_free()

## one frame. `gunplay` and `enemies` are the operator's (their guns, hull and shield are what the loot changes);
## `take` is the ENTER press this frame. Returns { prompt, toast } for the HUD.
func step(dt: float, me: Vector3, gunplay: Node3D, enemies: Node3D, take: bool) -> Dictionary:
	var out := { "prompt": "", "toast": "" }
	var nearest_gun: Item = null
	var nearest_d := PICK_R
	for it: Item in items.duplicate():
		if not is_instance_valid(it.node):
			continue
		if it.falling:
			it.node.position.y = maxf(it.pos.y, it.node.position.y - SUPPLY_FALL * dt)
			if it.node.position.y <= it.pos.y + 0.01:
				it.falling = false
				Sound.sfx("land", -2.0)
			continue
		var d := Vector2(me.x - it.pos.x, me.z - it.pos.z).length()
		if d > SEE:
			continue
		it.spin += dt * 1.6
		var sp := it.node.get_node_or_null("spin") as Node3D
		if sp:
			sp.rotation.y = it.spin
		if absf(me.y - it.pos.y) > 3.0:
			continue
		match it.kind:
			"chest", "supply":
				if d < CHEST_R and not it.opened:
					it.opened = true
					opened += 1
					var lid := it.node.get_node_or_null("lid") as Node3D
					if lid:
						lid.rotation.x = -1.1
						lid.position += Vector3(0, 0.25, -0.3)
					_spill(it)
					Sound.sfx("confirm", -6.0)
					out.toast = "SUPPLY DROP OPENED" if it.kind == "supply" else "Chest opened"
			"ammo":
				if d < PICK_R:
					for g in gunplay.guns:
						g.reserve += g.mag * 2
					_take(it, out, "+ Ammo")
			"plate":
				if d < PICK_R and enemies.shield < PLATES_MAX - 0.5:
					enemies.shield = minf(PLATES_MAX, enemies.shield + PLATE)
					_take(it, out, "+ Armour plate")
			"med":
				if d < PICK_R and meds < MEDS_MAX:
					meds += 1
					_take(it, out, "+ Med kit")
			"gun":
				if d < nearest_d:
					nearest_d = d
					nearest_gun = it
	if nearest_gun != null:
		var col_name := String(RARITY[nearest_gun.rarity].name)
		var gname := String(Weapons.FRAMES[nearest_gun.frame].name)
		if gunplay.guns.size() < SLOTS:
			_give(nearest_gun, gunplay, false)
			out.toast = "%s %s" % [col_name, gname]
		elif _better(nearest_gun, gunplay) and not take:
			out.prompt = "SWAP for %s %s" % [col_name, gname]
		elif take:
			_give(nearest_gun, gunplay, true)
			out.toast = "%s %s" % [col_name, gname]
		else:
			out.prompt = "SWAP for %s %s" % [col_name, gname]
	return out

func _better(_it: Item, _gunplay: Node3D) -> bool:
	return true

func _take(it: Item, out: Dictionary, text: String) -> void:
	picked += 1
	out.toast = text
	Sound.sfx("click", -4.0)
	_remove(it)

## the gun goes into a free slot, or takes the place of the one in your hands (which is left on the ground)
func _give(it: Item, gunplay: Node3D, swap: bool) -> void:
	var g := make_gun(it.frame, it.rarity)
	var at := it.pos
	picked += 1
	_remove(it)
	if swap and gunplay.guns.size() >= SLOTS:
		var old: Weapons.Gun = gunplay.guns[gunplay.current]
		gunplay.guns[gunplay.current] = g
		add("gun", at, old.frame, old.rarity if RARITY.has(old.rarity) else "common")
	else:
		gunplay.guns.append(g)
		gunplay.current = gunplay.guns.size() - 1
	g.draw()
	gunplay._show_current()
	Sound.sfx("capture", -6.0)

## a med kit used: half the hull back. False when there is none or the hull is full.
func heal(enemies: Node3D) -> bool:
	if meds <= 0 or enemies.hull >= enemies.hull_max - 0.5 or enemies.down > 0.0:
		return false
	meds -= 1
	enemies.hull = minf(enemies.hull_max, enemies.hull + MED)
	Sound.sfx("confirm", -8.0)
	return true
