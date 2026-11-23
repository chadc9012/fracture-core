extends Node3D
## Close combat on foot (owner, Nov 21-22: "melee combos, heavy attacks and finishers; directional dodge; blocking and timed
## counters", Destiny gunplay with anime moves): the operator's melee, dodge, guard and parry, per class, played through
## the combat clips (combat_clips.gd via the rig's action layer). gunplay.gd owns and steps it, so every combat view has it.
##
##   MELEE (F / the phone's MELEE)  tap: the class's three-hit chain (tap again inside the window to carry on)
##                                  hold: the heavy (GOLIATH ground pound, NYX lunging stab, CIPHER charged palm)
##                                  near a staggered foe or one below a quarter hull: the finisher
##   DODGE (C or Ctrl / DODGE)      along the stick (back when it rests): GOLIATH charges, NYX rolls and flips, CIPHER
##                                  blinks; untouchable for the first part; GOLIATH one charge, NYX two
##   BLOCK (V / the phone's BLOCK)  held: the guard takes most of a frontal blow off a meter that refills; pressed just
##                                  before a blow lands it is a PARRY — nothing gets through, a melee attacker staggers,
##                                  and the next swing within COUNTER_S is a counter at double damage
## A lunge closes on the nearest foe in front before each swing. Damage lands through gunplay.melee_hit (the bolt's hit /
## killed path: kills, drops, goals and the boss's poise all follow). Worn melee weapons (gear meleeClass: sword, katana,
## greatsword …) scale damage, reach and speed, and a deflect after the swing.

const Sound := preload("res://scripts/audio/sound.gd")
const Clips := preload("res://scripts/character/combat_clips.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
const AbilityFx := preload("res://scripts/vfx/ability_fx.gd")
const Abilities := preload("res://scripts/combat/abilities.gd")

const HEAVY_HOLD := 0.32       # seconds MELEE is held before it is a heavy
const COMBO_GRACE := 0.35      # seconds after a swing ends that a press carries the chain on
const COUNTER_S := 1.5
const FINISH_REACH := 2.8
const FINISH_FRAC := 0.25      # a foe at or below this share of its hull can be finished
const GUARD_DELAY := 1.0       # seconds after the guard drops before it refills
const GUARD_RATE := 30.0
const GUARD_BROKEN_S := 3.0

## per class: the three light swings, the heavy, the finisher, the lunge, the dodge and the guard. Damage is in the hull
## units of enemies.gd (a scout has 30, an elite 60 + a 30 shield, an executor 50); `poise` feeds the stagger;
## `knock` is the shove in m/s; `arc` the swing's width in degrees (360: all round)
const KITS := {
	"goliath": {
		"light": [{ "dmg": 24.0, "reach": 2.3, "arc": 110.0, "knock": 1.5, "poise": 25.0 }, { "dmg": 26.0, "reach": 2.3, "arc": 120.0, "knock": 2.0, "poise": 25.0 }, { "dmg": 44.0, "reach": 2.6, "arc": 140.0, "knock": 5.5, "poise": 60.0, "heavy": true }],
		"heavy": { "dmg": 70.0, "reach": 3.6, "arc": 360.0, "knock": 7.5, "poise": 100.0, "heavy": true, "shake": 0.6 },
		"finisher": { "dmg": 260.0, "knock": 9.0 },
		"lunge": 4.5, "energy": false, "color": Color(1.0, 0.62, 0.2),
		"dodge": { "dist": 4.2, "time": 0.42, "iframes": 0.28, "cool": 2.2, "charges": 1 },
		"block": { "reduce": 0.85, "parry": 0.22, "guard": 140.0, "drain": 0.6 },
	},
	"nyx": {
		"light": [{ "dmg": 16.0, "reach": 2.2, "arc": 120.0, "knock": 0.8, "poise": 15.0 }, { "dmg": 18.0, "reach": 2.2, "arc": 120.0, "knock": 0.8, "poise": 15.0 }, { "dmg": 30.0, "reach": 2.6, "arc": 360.0, "knock": 4.0, "poise": 40.0 }],
		"heavy": { "dmg": 56.0, "reach": 4.6, "arc": 50.0, "knock": 3.0, "poise": 70.0, "heavy": true, "shake": 0.25 },
		"finisher": { "dmg": 240.0, "knock": 4.0 },
		"lunge": 6.0, "energy": false, "color": Color(0.75, 0.4, 1.0),
		"dodge": { "dist": 5.5, "time": 0.5, "iframes": 0.38, "cool": 1.2, "charges": 2 },
		"block": { "reduce": 0.6, "parry": 0.3, "guard": 80.0, "drain": 1.0 },
	},
	"cipher": {
		"light": [{ "dmg": 18.0, "reach": 2.6, "arc": 100.0, "knock": 1.2, "poise": 18.0 }, { "dmg": 18.0, "reach": 2.6, "arc": 100.0, "knock": 1.2, "poise": 18.0 }, { "dmg": 32.0, "reach": 3.0, "arc": 110.0, "knock": 5.0, "poise": 45.0 }],
		"heavy": { "dmg": 60.0, "reach": 3.4, "arc": 80.0, "knock": 4.0, "poise": 80.0, "heavy": true, "chain": 3, "shake": 0.35 },
		"finisher": { "dmg": 250.0, "knock": 6.0 },
		"lunge": 4.5, "energy": true, "color": Color(0.35, 0.9, 1.0),
		"dodge": { "dist": 6.0, "time": 0.4, "iframes": 0.34, "cool": 1.8, "charges": 1 },
		"block": { "reduce": 0.75, "parry": 0.25, "guard": 100.0, "drain": 0.8 },
	},
}

var gunplay: Node3D
var player: Node3D
## the class's two abilities and super (abilities.gd), stepped here
var abilities: Node3D
var cls := "goliath"
var kit: Dictionary = KITS.goliath
## the worn melee weapon's class numbers (gear meleeClass), {} bare-handed
var weapon := {}

# state
var phase := ""                # "", "light", "heavy", "finisher"
var combo := 0                 # which light swing is playing (0..2)
var phase_t := 0.0             # seconds into the phase
var phase_len := 0.0
var _hit_at := -1.0            # when the swing lands (seconds into the phase); -1 once it has
var _spec := {}
var _queued := false
var _since_swing := 99.0
var _hold := -1.0              # seconds MELEE has been held (-1 = not held)
var _heavy_fired := false
var _finish_t: Variant = null  # the Target being finished
var charges := 1
var _dodge_cool := 0.0
var guard := 100.0
var guard_max := 100.0
var _guard_idle := 99.0
var _guard_broken := 0.0
var _block_t := 99.0           # seconds since BLOCK went down
var _block_was := false
var counter := 0.0             # seconds the counter stays ready
var deflect := 0.0             # seconds a melee weapon's after-swing deflect lasts
## the tallies (the tests): swings, landed blows, parries, finishers, dodges, blocked damage
var swings := 0
var blows := 0
var parries := 0
var finishers := 0
var dodges := 0
var blocked := 0.0

func setup(g: Node3D) -> void:
	gunplay = g
	player = g.player
	_read_class()
	abilities = Abilities.new()
	add_child(abilities)
	abilities.setup(self)
	g.hit.connect(func(_t, dmg: float, _h: bool) -> void: abilities.on_damage(dmg))

func _read_class() -> void:
	if player and player.rig and player.rig.has_method("combat_class"):
		cls = player.rig.combat_class()
	kit = KITS.get(cls, KITS.goliath)
	if abilities:
		abilities.cls = cls
	charges = int(kit.dodge.charges)
	guard_max = float(kit.block.guard)
	guard = guard_max
	weapon = {}
	var save := Gear.load_save()
	var it: Dictionary = Gear.worn(save, "melee")
	if not it.is_empty():
		weapon = (Gear.data().get("meleeClass", {}) as Dictionary).get(String(it.get("cls", "")), {})

func busy() -> bool:
	return phase != "" or (player != null and (player.dodging() or player.guard))

func _controls() -> Node:
	if gunplay and gunplay.controls:
		return gunplay.controls
	return get_tree().get_first_node_in_group("touch_controls") if is_inside_tree() else null

func _down() -> bool:
	var r: Node = gunplay.roster if gunplay else null
	return r != null and float(r.down) > 0.0

## the body's facing, flat
func _fwd() -> Vector3:
	return Vector3(sin(player.heading), 0, cos(player.heading))

func step(dt: float, cam: Camera3D) -> void:
	if not player or not player.rig:
		return
	if player.rig.has_method("combat_class") and player.rig.combat_class() != cls:
		_read_class()
	var c := _controls()
	var press_melee := false
	var melee_held := false
	var press_dodge := false
	var block_held := false
	var cast := -1
	if c and c.has_method("take_ability"):
		cast = c.take_ability()
	if c and c.has_method("take_melee"):
		press_melee = c.take_melee()
		melee_held = c.melee_held()
		press_dodge = c.take_dodge()
		block_held = c.block_held()
	var off: bool = gunplay.holstered or _down() or (c != null and String(c.get("mode")) != "foot")
	# timers
	_since_swing += dt
	counter = maxf(0.0, counter - dt)
	deflect = maxf(0.0, deflect - dt)
	_dodge_cool = maxf(0.0, _dodge_cool - dt)
	if _dodge_cool <= 0.0 and charges < int(kit.dodge.charges):
		charges += 1
		if charges < int(kit.dodge.charges):
			_dodge_cool = float(kit.dodge.cool)
	_guard_broken = maxf(0.0, _guard_broken - dt)
	if abilities:
		abilities.step(dt)
		if cast >= 0 and not off and phase == "" and not player.dodging():
			if not abilities.cast(cast) and c and c.has_method("toast"):
				c.toast("%s not ready" % String(abilities.kit()[cast].name))
		if c and c.has_method("show_abilities"):
			c.show_abilities(abilities.hud() if not off else [])
	if off:
		player.guard = false
		_hold = -1.0
		if phase != "":
			_end_phase()
		return
	# the guard: held, with a meter; just pressed is the parry window
	var want_guard: bool = block_held and phase == "" and not player.dodging() and _guard_broken <= 0.0 and guard > 0.0
	if block_held and not _block_was:
		_block_t = 0.0
	_block_was = block_held
	_block_t += dt
	player.guard = want_guard
	if want_guard:
		_guard_idle = 0.0
	else:
		_guard_idle += dt
		if _guard_idle > GUARD_DELAY:
			guard = minf(guard_max, guard + GUARD_RATE * dt)
	# the dodge cancels a swing's recovery (never a finisher)
	if press_dodge and charges > 0 and phase != "finisher" and not player.dodging():
		_dodge(cam, c)
	# melee: a press starts the hold; a release before HEAVY_HOLD is a light swing, holding past it a heavy
	if press_melee:
		var ft: Variant = _finisher_target()
		if ft != null and phase == "":
			_finisher(ft)
			_hold = -1.0
		elif phase == "light" and _hit_at < 0.0:
			_queued = true
		elif phase == "":
			_hold = 0.0
			_heavy_fired = false
	if _hold >= 0.0:
		if melee_held:
			_hold += dt
			if _hold >= HEAVY_HOLD and not _heavy_fired and phase == "":
				_heavy_fired = true
				_hold = -1.0
				_heavy()
		else:
			if not _heavy_fired and phase == "":
				_light(combo if _since_swing < COMBO_GRACE else 0)
			_hold = -1.0
	# the phase in flight
	if phase != "":
		phase_t += dt
		if _hit_at >= 0.0 and phase_t >= _hit_at:
			_hit_at = -1.0
			_land()
		# the chain carries on once the blow has landed and the recovery has begun
		if phase == "light" and _queued and _hit_at < 0.0 and phase_t >= phase_len * 0.62 and combo < 2:
			_queued = false
			_light(combo + 1)
		elif phase_t >= phase_len:
			_end_phase()

func _end_phase() -> void:
	if phase == "light":
		combo = (combo + 1) % 3
		_since_swing = 0.0
	elif phase != "":
		combo = 0
		_since_swing = 99.0
	phase = ""
	_queued = false
	_finish_t = null

# ---------------------------------------------------------------------------------------------------- the moves
func _speed() -> float:
	return Clips.speed_of(cls) * float(weapon.get("speed", 1.0))

## the clip's length at this class's speed and where its "hit" mark falls
func _timing(name: String) -> Vector2:
	var clip: Dictionary = Clips.variant(cls, name)
	var len := float(clip.get("len", 0.5)) / maxf(_speed(), 0.1)
	var at := 0.5
	for e in clip.get("events", []):
		if String(e[1]) == "hit":
			at = float(e[0])
			break
	return Vector2(len, at * len)

func _start(name: String, spec: Dictionary) -> void:
	var tm := _timing(name)
	phase_len = tm.x
	_hit_at = tm.y
	phase_t = 0.0
	_spec = spec
	player.rig.act(name, phase_len)
	player.combat_hold = maxf(player.combat_hold, 1.2)
	swings += 1

func _light(i: int) -> void:
	combo = clampi(i, 0, 2)
	phase = "light"
	_lunge()
	_start("melee_%d" % (combo + 1), (kit.light as Array)[combo])
	Sound.sfx("swing", -6.0, 0.12)

func _heavy() -> void:
	phase = "heavy"
	combo = 0
	_lunge()
	_start("heavy", kit.heavy)
	player.locked = maxf(player.locked, phase_len * 0.8)
	Sound.sfx("swing_heavy", -4.0, 0.08)

func _finisher(t: Variant) -> void:
	phase = "finisher"
	_finish_t = t
	combo = 0
	_face_point(t.box.get_center())
	_close_on(t.box.get_center(), 1.3)
	var spec: Dictionary = kit.finisher.duplicate()
	spec.reach = FINISH_REACH + 1.0
	spec.arc = 360.0
	spec.poise = 300.0
	spec.heavy = true
	_start("finisher", spec)
	player.locked = phase_len
	player.iframes = maxf(player.iframes, phase_len + 0.1)
	t.stun = maxf(float(t.stun), phase_len + 0.2)
	finishers += 1
	Sound.sfx("swing_heavy", -3.0)

func _dodge(cam: Camera3D, c: Node) -> void:
	var dir := Vector3.ZERO
	var mv: Vector2 = c.move if c else Vector2.ZERO
	if mv.length() > 0.2 and cam:
		var yaw: float = player.cam_yaw
		dir = Vector3(-sin(yaw), 0, -cos(yaw)) * mv.y + Vector3(cos(yaw), 0, -sin(yaw)) * mv.x
	elif cam:
		var yaw2: float = player.cam_yaw
		dir = Vector3(sin(yaw2), 0, cos(yaw2))    # back, away from where the camera looks
	if phase != "":
		_end_phase()
	var d: Dictionary = kit.dodge
	player.dodge(dir, float(d.dist), float(d.time), float(d.iframes))
	charges -= 1
	if _dodge_cool <= 0.0:
		_dodge_cool = float(d.cool)
	dodges += 1
	if cls == "cipher" and player.rig and is_inside_tree():
		# the blink: afterimages along the slide
		AbilityFx.dash(get_parent(), player.rig, dir.normalized(), kit.color, null)

## the nearest foe in front within the lunge: the body turns to it and closes to arm's length
func _lunge() -> void:
	var best: Variant = null
	var best_d := float(kit.lunge)
	var fwd := _cam_fwd()
	for t in _foes():
		var to: Vector3 = t.box.get_center() - player.position
		to.y = 0.0
		var d := to.length()
		if d < best_d and (d < 1.2 or fwd.angle_to(to) < deg_to_rad(50.0)):
			best_d = d
			best = t
	if best != null:
		_face_point(best.box.get_center())
		_close_on(best.box.get_center(), 1.25)
	else:
		player.heading = atan2(fwd.x, fwd.z)
		if player.rig:
			player.rig.rotation.y = player.heading

func _cam_fwd() -> Vector3:
	var yaw: float = player.cam_yaw
	return Vector3(-sin(yaw), 0, -cos(yaw))

func _face_point(p: Vector3) -> void:
	var to := p - player.position
	to.y = 0.0
	if to.length() > 0.05:
		player.heading = atan2(to.x, to.z)
		if player.rig:
			player.rig.rotation.y = player.heading

## a quick step toward a point, stopping `stop` short (the dodge mover does the carrying, without its i-frames or clip)
func _close_on(p: Vector3, stop: float) -> void:
	var to := p - player.position
	to.y = 0.0
	var d := to.length() - stop
	if d > 0.3:
		player.dodge_dir = to.normalized()
		player.dodge_t = clampf(d / 14.0, 0.06, 0.28)
		player.dodge_len = player.dodge_t
		player.dodge_speed = d / player.dodge_t / 1.0

## the live hostiles a swing can land on: bots of the other team, the boss, wildlife — never cover, props or allies
func _foes() -> Array:
	var out: Array = []
	for t in gunplay.targets:
		if not t.alive():
			continue
		if t.has_meta("cover") or t.has_meta("prop") or t.has_meta("cover_box"):
			continue
		if t.has_meta("roster") and t.has_meta("enemy") and t.get_meta("enemy").team == t.get_meta("roster").operator_team:
			continue
		out.append(t)
	return out

func _finisher_target() -> Variant:
	var fwd := _cam_fwd()
	var best: Variant = null
	var best_d := FINISH_REACH
	for t in _foes():
		var to: Vector3 = t.box.get_center() - player.position
		to.y = 0.0
		var d := to.length() - maxf(t.box.size.x, t.box.size.z) * 0.5
		if d > best_d or (d > 1.0 and fwd.angle_to(to) > deg_to_rad(70.0)):
			continue
		var ready: bool = bool(t.get_meta("staggered", false)) or (not t.has_meta("boss") and t.hp <= t.max_hp * FINISH_FRAC and t.max_hp >= 25.0)
		if ready:
			best_d = d
			best = t
	return best

## the blow lands: every foe inside the reach and the arc
func _land() -> void:
	var spec := _spec
	var dmg: float = float(spec.dmg) * float(weapon.get("damage", 1.0)) * (2.0 if counter > 0.0 else 1.0) * (float(abilities.melee_mult()) if abilities else 1.0)
	var reach := float(spec.get("reach", FINISH_REACH)) + float(weapon.get("reach", 0.0)) * 0.6
	var arc := deg_to_rad(float(spec.get("arc", 120.0))) * 0.5
	var fwd := _fwd()
	var landed := 0
	var targets: Array = [_finish_t] if phase == "finisher" and _finish_t != null else _foes()
	for t in targets:
		if not t.alive():
			continue
		var c: Vector3 = t.box.get_center()
		var to := c - player.position
		to.y = 0.0
		var d := to.length() - maxf(t.box.size.x, t.box.size.z) * 0.5
		if d > reach:
			continue
		if arc < PI and d > 0.6 and fwd.angle_to(to) > arc:
			continue
		var dir := to.normalized() if to.length() > 0.05 else fwd
		var hit_at := Vector3(c.x, player.position.y + 1.3, c.z) - dir * maxf(t.box.size.x, t.box.size.z) * 0.5
		gunplay.melee_hit(t, dmg, hit_at, dir * float(spec.get("knock", 1.0)), float(spec.get("poise", 20.0)), bool(spec.get("heavy", false)), bool(kit.energy))
		landed += 1
	if landed > 0:
		blows += landed
		Sound.sfx("punch", -3.0, 0.08)
		player.add_shake(float(spec.get("shake", 0.12)))
		if counter > 0.0:
			counter = 0.0
		if phase in ["heavy", "finisher"] and is_inside_tree():
			AbilityFx.hit_stop(self, 0.09 if phase == "heavy" else 0.14, 0.2)
	if bool(spec.get("heavy", false)) or phase == "finisher":
		_ring(kit.color, reach if arc >= PI else 2.0)
	if int(spec.get("chain", 0)) > 0:
		_arc_chain(int(spec.chain), dmg * 0.5)
	if float(weapon.get("deflect", 0.0)) > 0.0:
		deflect = float(weapon.deflect)
	if phase == "finisher":
		player.add_shake(0.7)
		var sw: Variant = weapon.get("shockwave", null)
		if sw is Dictionary:
			_shockwave(sw as Dictionary)

## CIPHER's charged palm: arcs jump on to the nearest foes
func _arc_chain(n: int, dmg: float) -> void:
	var from := player.position + Vector3(0, 1.3, 0)
	var hit := {}
	for k in n:
		var best: Variant = null
		var best_d := 7.0
		for t in _foes():
			if hit.has(t):
				continue
			var d := from.distance_to(t.box.get_center())
			if d < best_d:
				best_d = d
				best = t
		if best == null:
			break
		hit[best] = true
		var to: Vector3 = best.box.get_center()
		gunplay.tracer(from, to, Color(0.5, 0.95, 1.0))
		gunplay.melee_hit(best, dmg, to, Vector3.ZERO, 20.0, false, true)
		best.stun = maxf(float(best.stun), 0.6)
		from = to

## a greatsword finisher's shockwave down the line it faces
func _shockwave(sw: Dictionary) -> void:
	var fwd := _fwd()
	for t in _foes():
		var to: Vector3 = t.box.get_center() - player.position
		to.y = 0.0
		var along := to.dot(fwd)
		var side := (to - fwd * along).length()
		if along > 0.0 and along < float(sw.length) and side < float(sw.width):
			gunplay.melee_hit(t, float(sw.damage) * 10.0, t.box.get_center(), fwd * 4.0, 60.0, true)
	gunplay.tracer(player.position + Vector3(0, 0.2, 0), player.position + fwd * float(sw.length) + Vector3(0, 0.2, 0), kit.color)

## a ring of light on the ground for the heavy and the finisher
func _ring(col: Color, r: float) -> void:
	var at: Vector3 = player.position + Vector3(0, 0.15, 0)
	for i in 14:
		var a := TAU * i / 14.0
		gunplay.tracer(at, at + Vector3(cos(a), 0, sin(a)) * r, col)

# ---------------------------------------------------------------------------------------------------- taking a blow
## enemies.gd hands every blow on the operator through here first: `src` where it came from (INF: unknown), `melee` a
## swing (parried attackers stagger), `attacker` the Enemy or the boss view (it has `parried()`). Returns what gets
## through to the shield and hull.
func incoming(damage: float, src: Vector3, melee: bool, attacker: Variant = null) -> float:
	if not player:
		return damage
	if player.iframes > 0.0 or phase == "finisher":
		return 0.0
	if abilities:
		damage *= abilities.damage_taken_mult()
	if deflect > 0.0:
		damage *= 0.5
	if not player.guard:
		return damage
	var frontal := true
	if src != Vector3.INF:
		var to := src - player.position
		to.y = 0.0
		frontal = to.length() < 0.3 or _fwd().angle_to(to) < deg_to_rad(80.0)
	if not frontal:
		return damage
	var b: Dictionary = kit.block
	if _block_t <= float(b.parry):
		# the parry: nothing through, the counter readied, a melee attacker thrown off balance
		parries += 1
		counter = COUNTER_S
		Sound.sfx("parry", -2.0)
		player.add_shake(0.2)
		if player.rig and player.rig.action:
			player.rig.act("parry")
		if melee and attacker != null:
			if attacker is Object and (attacker as Object).has_method("parried"):
				(attacker as Object).call("parried")
			elif attacker is RefCounted and "target" in attacker:
				var tg = attacker.target
				tg.impact += 500.0
				tg.knock += (_fwd() * 3.0)
		_block_t = 99.0
		return 0.0
	var stop := damage * float(b.reduce)
	guard -= stop * float(b.drain)
	blocked += stop
	Sound.sfx("block", -4.0, 0.1)
	if guard <= 0.0:
		# the guard breaks: the body staggers, open for a moment
		guard = 0.0
		_guard_broken = GUARD_BROKEN_S
		player.guard = false
		player.locked = maxf(player.locked, 0.8)
		if player.rig:
			player.rig.act("stagger")
		Sound.sfx("shield_break", -4.0)
	return damage - stop

## the read-out for the HUD: guard share, dodge charges, the chain step, the counter
func hud() -> Dictionary:
	return { "guard": guard / maxf(guard_max, 1.0), "charges": charges, "max_charges": int(kit.dodge.charges), "combo": combo if phase == "light" else -1, "counter": counter > 0.0, "finish": _finisher_target() != null and phase == "" }
