extends Node3D
## The super (owner Nov 18, interfaceingame.com Destiny 2 "Super charged" / "Super ability"): a meter that fills with
## time and faster with kills and headshots, and one big ability per frame, fired with V / the SUPER button when full.
##   TITAN   (goliath)  FRACTURE SLAM  a ground slam: everything within 9 m takes heavy damage and is thrown back; the
##                                     operator's shield refills
##   HUNTER  (nyx)      GOLDEN GUN     the next three shots of the gun in hand hit ×6 (10 s to use them)
##   WARLOCK (cipher)   NOVA BOMB      a void blast thrown along the crosshair, bursting 7 m wide where it lands (≤ 22 m)
## Damage goes through gunplay.grenade_hit, so kills, tallies, drops and the HUD's markers follow as for a grenade.
## Pure numbers in SUPERS / CHARGE; gunplay owns one of these like it owns the grenades.

const CharacterStore := preload("res://scripts/character/character_store.gd")
const Sound := preload("res://scripts/audio/sound.gd")

const SUPERS := {
	"goliath": { "name": "FRACTURE SLAM", "class": "TITAN", "kind": "slam", "radius": 9.0, "damage": 900.0, "push": 6.0, "color": Color(1.0, 0.62, 0.25) },
	"nyx": { "name": "GOLDEN GUN", "class": "HUNTER", "kind": "gun", "shots": 3, "mult": 6.0, "window": 10.0, "color": Color(1.0, 0.82, 0.3) },
	"cipher": { "name": "NOVA BOMB", "class": "WARLOCK", "kind": "nova", "radius": 7.0, "damage": 1100.0, "range": 22.0, "push": 4.0, "color": Color(0.72, 0.45, 1.0) },
}
## charge per second, per kill, per headshot (fractions of a full meter)
const CHARGE := { "time": 0.008, "kill": 0.09, "head": 0.015 }

var gunplay: Node3D
var frame := "goliath"
var charge := 0.0
var shots_left := 0       # Golden Gun shots still empowered
var window := 0.0         # seconds left to use them
var _ready_said := false
var _casting := false     # the super's own kills don't charge it

func setup(g: Node3D) -> void:
	gunplay = g
	top_level = true
	var look: Dictionary = {}
	if g.player and g.player.get("rig") and g.player.rig and g.player.rig.get("look") is Dictionary:
		look = g.player.rig.look
	frame = str(look.get("frame", CharacterStore.load_look().get("frame", "goliath")))
	if not SUPERS.has(frame):
		frame = "goliath"
	g.hit.connect(func(_t, _d, head: bool): if head: add(CHARGE.head))
	g.killed.connect(func(t):
		if not (t.has_meta("cover_box") or t.has_meta("prop")):
			add(CHARGE.kill))

func def() -> Dictionary:
	return SUPERS[frame]

func add(n: float) -> void:
	if _casting or shots_left > 0:
		return
	charge = minf(1.0, charge + n)

func full() -> bool:
	return charge >= 1.0

## the HUD's read-out: {name, class, charge 0..1, active, color}
func hud() -> Dictionary:
	var d := def()
	return { "name": d.name, "class": d.class, "charge": charge, "active": shots_left > 0, "shots": shots_left, "color": d.color }

## the damage multiplier for the next shot (gunplay._fire_one asks once per shot and the shot spends it)
func shot_mult() -> float:
	if shots_left <= 0:
		return 1.0
	shots_left -= 1
	if shots_left == 0:
		window = 0.0
	return float(def().mult)

func step(dt: float, cam: Camera3D, fire := false) -> void:
	var p: Node3D = gunplay.player
	if p and p.get("rig") and p.rig and p.rig.get("look") is Dictionary:
		var f := str((p.rig.look as Dictionary).get("frame", frame))
		if f != frame and SUPERS.has(f):
			frame = f
	if shots_left > 0:
		window -= dt
		if window <= 0.0:
			shots_left = 0
	elif not full():
		add(CHARGE.time * dt)
	if full() and not _ready_said:
		_ready_said = true
		Sound.sfx("capture", -8.0)
	if fire:
		if not full():
			Sound.sfx("dry", -6.0)
			return
		cast(cam)

## fires the super now (the meter must be full; tests call it straight)
func cast(cam: Camera3D) -> void:
	if not full():
		return
	charge = 0.0
	_ready_said = false
	_casting = true
	var d := def()
	var gr: Node = gunplay.grenades
	var at: Vector3 = gunplay.player.position if gunplay.player else Vector3.ZERO
	match String(d.kind):
		"slam":
			_area(at, float(d.radius), float(d.damage), float(d.push))
			if gr:
				gr._burst(at, float(d.radius), d.color)
			var roster: Node = _roster()
			if roster and roster.get("shield_max") != null:
				roster.shield = roster.shield_max
		"gun":
			shots_left = int(d.shots)
			window = float(d.window)
			Sound.sfx("capture", -4.0)
		"nova":
			var dir := Vector3.FORWARD
			if cam:
				dir = -(cam.global_transform if cam.is_inside_tree() else cam.transform).basis.z
			var flat := Vector3(dir.x, 0, dir.z).normalized()
			var land := at + flat * float(d.range)
			# it bursts on the first obstacle along the throw, or at its full range
			for b in gunplay.obstacles:
				var hit: Variant = (b as AABB).intersects_segment(at + Vector3(0, 1.2, 0), land + Vector3(0, 1.2, 0))
				if hit != null and at.distance_to(hit) < at.distance_to(land):
					land = Vector3((hit as Vector3).x, at.y, (hit as Vector3).z) - flat * 0.5
			_area(land, float(d.radius), float(d.damage), float(d.push))
			if gr:
				gr._burst(land, float(d.radius), d.color)
	_casting = false
	var c: Node = gunplay.controls if gunplay.get("controls") else null
	if c == null and gunplay.is_inside_tree():
		c = gunplay.get_tree().get_first_node_in_group("touch_controls")
	if c and c.has_method("toast"):
		c.toast("%s  ·  %s" % [String(d.class), String(d.name)])

func _area(at: Vector3, r: float, dmg: float, push: float) -> void:
	var gr: Node = gunplay.grenades
	if not gr:
		return
	for t in gr._near(at, r):
		var dist: float = gr._flat(t, at)
		var falloff := 1.0 - 0.5 * clampf(dist / r, 0.0, 1.0)
		gunplay.grenade_hit(t, dmg * falloff, at)
		if push > 0.0:
			var away: Vector3 = gr._feet(t) - at
			away.y = 0.0
			gr._move(t, away.normalized() * push * (1.0 - dist / r))

func _roster() -> Node:
	for t in gunplay.targets:
		if t.has_meta("roster"):
			return t.get_meta("roster")
	return null
