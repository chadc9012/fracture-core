extends SceneTree
## Close combat and the combat animations, headless (owner, Nov 21-22): the clip library and its layer on a real rig, the
## operator's chain / heavy / finisher / dodge / guard / parry, the bots' reactions (flinch, stagger, knockdown, the fall),
## the Executor's telegraphed chain, the brace, and the bosses' phase combos and parry stagger.
const Player = preload("res://scripts/player/operator_player.gd")
const Gunplay = preload("res://scripts/combat/gunplay.gd")
const Enemies = preload("res://scripts/combat/enemies.gd")
const Clips = preload("res://scripts/character/combat_clips.gd")
const Boss = preload("res://scripts/combat/boss.gd")
const CharacterStore = preload("res://scripts/character/character_store.gd")

## the input close_combat.gd reads, written by the test
class FakeControls extends Node:
	var move := Vector2.ZERO
	var mode := "foot"
	var melee := false
	var held := false
	var dodge := false
	var block := false
	func take_melee() -> bool:
		var m := melee
		melee = false
		return m
	func melee_held() -> bool:
		return held
	func take_dodge() -> bool:
		var d := dodge
		dodge = false
		return d
	func block_held() -> bool:
		return block
	func take_grenade() -> bool:
		return false
	func take_cycle_grenade() -> bool:
		return false
	func show_grenade(_h: Dictionary) -> void:
		pass
	var ability := -1
	func take_ability() -> int:
		var a := ability
		ability = -1
		return a
	func show_abilities(_l: Array) -> void:
		pass
	func toast(_t: String) -> void:
		pass

var p: Node3D
var g: Node3D
var en: Node3D
var cam: Camera3D
var c: FakeControls
const DT := 1.0 / 60.0
var fails := 0

func check(name: String, cond: bool, extra := "") -> void:
	print(("ok   " if cond else "FAIL ") + name + ("  " + extra if extra != "" else ""))
	if not cond:
		fails += 1

func run(seconds: float) -> void:
	for i in int(seconds * 60.0):
		p.step(DT, c.move, Vector2.ZERO, false, false)
		g.step(DT, cam, false, false, 0.0)
		en.step(DT)

func _init() -> void:
	# --- the clip library
	var all := Clips.all()
	var sane := all.size() > 40
	for k in all:
		for u in [0.0, 0.33, 0.5, 1.0]:
			var pose := Clips.sample(all[k], u)
			sane = sane and not pose.is_empty()
	check("every clip samples (%d clips)" % all.size(), sane)
	for cls in ["goliath", "nyx", "cipher"]:
		var have := true
		for n in ["melee_1", "melee_2", "melee_3", "heavy", "finisher", "block", "dodge_f", "dodge_b", "dodge_l", "dodge_r", "cast", "jump", "land", "stagger", "knockdown", "death", "get_up", "hit", "parry"]:
			have = have and not Clips.variant(cls, n).is_empty()
		check("%s has the whole set" % cls.to_upper(), have)
	var reloads := true
	for f in ["AUTO", "SMG", "SIDEARM", "SHOTGUN", "SNIPER", "LMG", "HEAVY", "FUSION"]:
		var ev: Array = Clips.reload_for(f).get("events", [])
		reloads = reloads and ev.size() >= 2
	check("a reload per gun with its mag / shell / rack marks", reloads and Clips.reload_for("SHOTGUN").events.size() == 5)
	check("dodge picks the variant from the direction", Clips.dodge_name(Vector2(1, 0)) == "dodge_r" and Clips.dodge_name(Vector2(0, -1)) == "dodge_b" and Clips.dodge_name(Vector2(0, 1)) == "dodge_f" and Clips.dodge_name(Vector2.ZERO) == "dodge_b")

	# --- the scene
	p = Player.new()
	root.add_child(p)
	p.civilian = false
	p.build(CharacterStore.clean({ "frame": "goliath", "body": "male" }))
	p.bounds = Rect2(-40, -80, 80, 160)
	var none: Array[AABB] = []
	p.obstacles = none
	p.heading = PI
	p.cam_yaw = 0.0
	g = Gunplay.new()
	root.add_child(g)
	c = FakeControls.new()
	root.add_child(c)
	g.controls = c
	g.setup(p, p.obstacles)
	cam = Camera3D.new()
	root.add_child(cam)
	cam.position = Vector3(0, 1.6, 4)
	cam.look_at(Vector3(0, 1.2, -10))
	p.cam = cam
	en = Enemies.new()
	root.add_child(en)
	en.setup(p, g)

	# --- the layer on a real rig: a death pose lowers the hips, a straight right moves the right forearm
	var sk: Skeleton3D = p.rig.skeleton
	var hips := -1
	var fore := -1
	for i in sk.get_bone_count():
		var nm := sk.get_bone_name(i)
		if nm.ends_with("Hips"):
			hips = i
		elif nm.ends_with("RightArm"):
			fore = i
	var rest_y: float = sk.get_bone_pose_position(hips).y
	var layer: Node = p.rig.action
	layer.freeze_at("death", Clips.variant("goliath", "death"), 1.0)
	layer.apply(0.0)
	var dropped: float = rest_y - sk.get_bone_pose_position(hips).y
	sk.reset_bone_poses()
	var q0: Quaternion = sk.get_bone_pose_rotation(fore)
	layer.freeze_at("melee_1", Clips.variant("goliath", "melee_1"), 0.45)
	layer.apply(0.0)
	var turned := q0.angle_to(sk.get_bone_pose_rotation(fore))
	check("the layer poses the rig (hips down %.2f units, right arm turned %.0f°)" % [dropped, rad_to_deg(turned)], dropped > rest_y * 0.5 and turned > deg_to_rad(20.0))
	sk.reset_bone_poses()
	layer.frozen = false
	layer.stop(0.0)

	# --- the chain: three taps on an elite in front land three blows and move the chain along
	var elite = en.spawn("elite", Vector3(0, 0, -1.9))
	elite.state = Enemies.State.ENGAGE
	var hp0: float = elite.target.hp + elite.target.shield
	for k in 3:
		c.melee = true
		run(0.02)
		run(0.5)
	run(0.6)
	var close: Node = g.close
	check("MELEE ×3: the three-hit chain lands", close.swings >= 3 and close.blows >= 3 and elite.target.hp + elite.target.shield < hp0, "swings %d blows %d" % [close.swings, close.blows])
	run(1.5)

	# --- the heavy: MELEE held past HEAVY_HOLD is GOLIATH's ground pound; a scout beside it is knocked down
	var scout = en.spawn("scout", p.position + Vector3(1.0, 0, -1.6))
	scout.state = Enemies.State.ENGAGE
	c.melee = true
	c.held = true
	run(0.45)
	c.held = false
	var floored := false
	for i in 60:
		run(DT)
		floored = floored or scout.floor_t > 0.0 or not scout.target.alive()
	check("MELEE held: the heavy floors a scout", close.phase == "" and floored)
	run(2.5)

	# --- the finisher: a foe below a quarter hull in reach goes in one move, the operator untouchable meanwhile
	var victim = en.spawn("scout", p.position + Vector3(0, 0, -1.6))
	victim.target.hp = victim.target.max_hp * 0.2
	victim.target.shield = 0.0
	c.melee = true
	run(DT)
	var inv: float = p.iframes
	run(1.6)
	check("a weak foe is finished", close.finishers == 1 and not victim.target.alive() and inv > 0.5, "finishers %d" % close.finishers)

	# --- the dodge: along the stick, i-frames swallow a hit
	for e in en.enemies:
		e.target.hp = 0.0
	run(0.1)
	var from: Vector3 = p.position
	c.move = Vector2(1, 0)
	c.dodge = true
	run(DT * 2)
	var hull0: float = en.hull + en.shield
	en._hit_operator(30.0, p.position + Vector3(0, 0, -3), false)
	var spared: bool = en.hull + en.shield == hull0
	run(0.5)
	c.move = Vector2.ZERO
	var moved: float = p.position.distance_to(from)
	check("DODGE: ~4 m along the stick, the hit inside the i-frames lands nothing", moved > 3.0 and spared and close.dodges == 1, "moved %.1f m" % moved)
	run(2.5)

	# --- the guard: held past the parry window it takes most of a frontal blow
	en.hull = en.hull_max
	en.shield = 0.0
	c.block = true
	run(0.5)
	var before: float = en.hull + en.shield     # (a shield that came back during the wait takes its share too)
	en._hit_operator(20.0, p.position + Vector3(0, 0, -2), true)
	var through: float = before - en.hull - en.shield
	check("BLOCK: a frontal blow mostly stopped", p.guard and through > 0.0 and through < 5.0, "through %.1f" % through)
	c.block = false
	run(0.3)

	# --- the parry: BLOCK pressed as the Executor's blow lands — nothing through, the Executor staggers, a counter is ready
	var ex = en.spawn("executor", p.position + Vector3(0, 0, -1.8))
	ex.state = Enemies.State.ENGAGE
	run(DT)
	c.block = true
	run(DT)
	before = en.hull
	ex.set_meta("foe", null)
	en._damage_foe(ex, 16.0, true)
	run(DT * 3)
	check("BLOCK just pressed: a parry", en.hull == before and close.parries == 1 and close.counter > 0.0 and ex.stagger_t > 0.0, "stagger %.2f" % ex.stagger_t)
	c.block = false
	ex.target.hp = 0.0
	run(0.1)

	# --- the bot's fall: it dies where it stands, plays the fall and only then goes
	var falls = en.spawn("scout", Vector3(6, 0, -10))
	falls.target.hp = 0.0
	falls.target.down = 5.0     # as gunplay leaves a kill
	run(0.2)
	var lying: bool = falls.mover.visible and falls.mover.rig.action.current() == "death"
	run(2.4)
	check("a downed bot falls, then goes", lying and not falls.mover.visible)

	# --- the Executor's chain: a telegraphed wind-up, then blows land on an operator who does nothing
	en.hull = en.hull_max
	en.shield = en.shield_max
	en.spawn_guard = 0.0
	var ex2 = en.spawn("executor", p.position + Vector3(0, 0, -2.2))
	ex2.state = Enemies.State.ENGAGE
	var wound := false
	var hurt_after_wind := false
	for i in 60 * 3:
		run(DT)
		if ex2.windup > 0.0:
			wound = true
		if wound and en.hull + en.shield < en.hull_max + en.shield_max:
			hurt_after_wind = true
	check("the Executor winds up, then its chain lands", wound and hurt_after_wind)
	ex2.target.hp = 0.0
	run(0.1)

	# --- the elite's brace: sustained frontal fire and it plants behind its plating
	var el = en.spawn("elite", p.position + Vector3(0, 0, -8))
	el.state = Enemies.State.ENGAGE
	el.mover.heading = 0.0
	for k in 4:
		g.hit.emit(el.target, 5.0, false)
	run(DT)
	check("sustained fire: the elite braces", el.brace_t > 0.0 and el.mover.guard)
	el.target.hp = 0.0
	run(0.1)

	# --- abilities: GOLIATH's slam floors what stands round it and goes on cooldown; the super fills and casts
	var ab: Node = close.abilities
	en.down = 0.0
	en.hull = en.hull_max
	for e in en.enemies:
		e.target.hp = 0.0
	run(0.1)
	var s1 = en.spawn("scout", p.position + Vector3(2.0, 0, -1.0))
	var s2 = en.spawn("scout", p.position + Vector3(-2.5, 0, 1.0))
	c.ability = 1
	run(1.0)
	var slammed: bool = (s1.floor_t > 0.0 or not s1.target.alive()) and (s2.floor_t > 0.0 or not s2.target.alive())
	check("GOLIATH: SEISMIC SLAM knocks down all round, then cools", slammed and ab.cool[1] > 10.0 and not ab.can_cast(1))
	var n_obs: int = g.obstacles.size()
	c.ability = 0
	run(0.9)
	check("GOLIATH: BULWARK raises a wall in the shared obstacles", g.obstacles.size() == n_obs + 1)
	ab.energy = ab.SUPER_COST
	c.ability = 2
	run(0.4)
	en.shield = 0.0
	en.hull = en.hull_max
	en.spawn_guard = 0.0
	en._hit_operator(20.0, p.position + Vector3(5, 0, 0), false)
	check("GOLIATH: JUGGERNAUT takes 70% off a blow", absf((en.hull_max - en.hull) - 6.0) < 0.5 and ab.energy < 5.0, "took %.1f" % (en.hull_max - en.hull))
	for e in en.enemies:
		e.target.hp = 0.0
	run(0.1)
	# CIPHER's arc surge hops through four foes and stuns them; NYX's shadow step hides the operator
	ab.cls = "cipher"
	ab.cool = [0.0, 0.0]
	var row: Array = []
	for i in 4:
		var f = en.spawn("scout", p.position + Vector3(-3.0 + i * 2.0, 0, -6.0))
		f.target.shield = 0.0
		row.append(f)
	c.ability = 0
	run(1.0)
	var zapped := 0
	for f in row:
		if f.target.hp < f.target.max_hp or not f.target.alive():
			zapped += 1
	check("CIPHER: ARC SURGE chains through four", zapped == 4, "%d hit" % zapped)
	for f in row:
		f.target.hp = 0.0
	run(0.1)
	ab.cls = "nyx"
	ab.cool = [0.0, 0.0]
	c.ability = 0
	run(0.4)
	check("NYX: SHADOW STEP blinks ahead and hides", ab.cloaked > 2.0)
	ab.cls = "goliath"

	# --- the bosses: phase combos and the parry's poise
	var b := Boss.new("colossus")
	b.hull = b.hull_max * 0.25
	b.hit(1.0)    # into OVERLOADED
	for i in 60 * 20:
		b.tick(DT, 3.0)
		b.drain()
	check("OVERLOADED chains every attack into its follow-up", b.phase == 2 and b.chains >= 3, "chains %d" % b.chains)
	var b2 := Boss.new("rift-hound")
	for i in 3:
		b2.parried()
	check("three parries stagger a boss", b2.staggered() and b2.parries == 3)
	b2.finished_stagger()
	b2.tick(0.7, 3.0)
	check("a finisher spends the stagger", not b2.staggered())
	check("new attacks are on the table", Boss.ATTACKS.has("SWEEP") and Boss.ATTACKS.has("CHARGE") and Boss.ATTACKS.has("SPIKES") and Boss.FOLLOW.has("SLAM"))

	print("close combat: %d failed" % fails)
	quit(1 if fails > 0 else 0)
