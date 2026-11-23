extends Node3D
const Weapons := preload("res://scripts/combat/weapons.gd")
const Sound := preload("res://scripts/audio/sound.gd")
const Lines := preload("res://scripts/cinema/lines.gd")
## A Fracture boss on the field (boss.gd rules): the authored hull scaled to the row's size, walking the ground toward the
## operator while the rules say APPROACH, turning to face it otherwise, flaring red on a telegraph, glowing at the core
## while staggered or at a weak point. Attacks land as the rules fire them — LUNGE / SLAM hit the operator inside the
## radius (enemies.gd takes the damage so the hull bar, hurt flash and respawn stay one system), VOLLEY throws bolts the
## bots' way (gunplay tracers, closest-approach hit), BREATH is a cone that burns while you stand in it, SUMMON spawns
## adds through enemies.gd. The body is a gunplay Target whose hits route through boss.hit for the poise / weak-point
## multipliers. Emits `killed` once.

signal killed(boss_id: String, reward: Dictionary)

const Boss := preload("res://scripts/combat/boss.gd")
const Gunplay := preload("res://scripts/combat/gunplay.gd")
const Enemies := preload("res://scripts/combat/enemies.gd")
const MODELS := "res://models/bosses/"

var rules: Boss
var body: Node3D
var target: Gunplay.Target
var operator: Node3D
var gunplay: Node3D
var enemies: Node3D
var ground_at: Callable = func(_x: float, _z: float) -> float: return 0.0
var obstacles: Array[AABB] = []
var heading := 0.0
var _flash := 0.0
var _core: MeshInstance3D
var _ring: MeshInstance3D
var _breath_t := 0.0
var _breath := {}
var _killed := false
var _anim: AnimationPlayer
var toast: Callable = func(_t: String) -> void: pass
## an echo of another player's boss (online story co-op, online_story.gd): it fights this screen's operator where the
## leader's stands and takes its hull from there; its brood comes from the leader's field, so it summons nothing here
var echo := false
var size := 3.0
## the patterns' telegraphs (Nov 22): the CHARGE's line and the SPIKES' circles, fixed when the telegraph starts
var _charge_dir := Vector3.ZERO
var _spikes: Array = []
var _marks: Array = []

func setup(boss_id: String, at: Vector3, op: Node3D, g: Node3D, en: Node3D, ground: Callable) -> void:
	rules = Boss.new(boss_id)
	operator = op
	gunplay = g
	enemies = en
	ground_at = ground
	size = float(rules.def.size)
	# a boss is more hull than the whole bag (Vyrak: 4320 against a starter's ~300 rounds — found by the story test, Nov
	# 23: both guns at 0/0 with 8% of it left, and nothing but its brood to scavenge): the fight opens on a full bag, and
	# every stagger and phase it is driven through shakes ammunition loose, so it is paced by how well you fight
	_resupply(99)
	position = at
	body = Node3D.new()
	add_child(body)
	var path := MODELS + String(rules.def.model)
	if ResourceLoader.exists(path):
		var hull := (load(path) as PackedScene).instantiate() as Node3D
		# the animated hulls drive their own root transform, so the fit goes on a wrapper the clips never touch
		var wrap := Node3D.new()
		body.add_child(wrap)
		wrap.add_child(hull)
		_fit(hull, wrap, size)
		_anim = hull.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if _anim and _anim.has_animation("idle"):
			_anim.get_animation("idle").loop_mode = Animation.LOOP_LINEAR
			if _anim.has_animation("walk"):
				_anim.get_animation("walk").loop_mode = Animation.LOOP_LINEAR
			_anim.play("idle")
	# the core: glows when a punish window is open
	_core = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = size * 0.055
	sm.height = size * 0.11
	_core.mesh = sm
	var cm := StandardMaterial3D.new()
	cm.albedo_color = Color(0.3, 0.9, 1.0)
	cm.emission_enabled = true
	cm.emission = Color(0.3, 0.9, 1.0)
	cm.emission_energy_multiplier = 0.4
	_core.material_override = cm
	_core.position = Vector3(0, size * 0.55, size * 0.16)
	body.add_child(_core)
	# the telegraph ring on the ground
	_ring = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 1.0
	tm.outer_radius = 1.3
	_ring.mesh = tm
	var rm := StandardMaterial3D.new()
	rm.albedo_color = Color(1.0, 0.3, 0.2)
	rm.emission_enabled = true
	rm.emission = Color(1.0, 0.3, 0.2)
	rm.emission_energy_multiplier = 2.0
	_ring.material_override = rm
	_ring.visible = false
	add_child(_ring)
	# the target box: the body's footprint
	target = Gunplay.Target.new(AABB(at + Vector3(-size * 0.35, 0, -size * 0.35), Vector3(size * 0.7, size, size * 0.7)), rules.hull_max, body)
	target.set_meta("blood", Color(0.7, 0.3, 1.0))   # Fracture creatures bleed violet
	target.set_meta("boss", true)
	gunplay.targets.append(target)
	gunplay.hit.connect(_on_hit)

## the authored hulls come at ~1.7 m: scale to the row's height, feet on the origin
func _fit(hull: Node3D, wrap: Node3D, height: float) -> void:
	var aabb := AABB()
	var first := true
	for c in hull.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var t := Transform3D.IDENTITY
		var p: Node = mi
		while p != hull and p is Node3D:
			t = (p as Node3D).transform * t
			p = p.get_parent()
		var a := t * mi.get_aabb()
		aabb = a if first else aabb.merge(a)
		first = false
	if first or aabb.size.y < 0.01:
		return
	var k := height / aabb.size.y
	wrap.scale = Vector3.ONE * k
	wrap.position.y = -aabb.position.y * k

func _on_hit(t: Gunplay.Target, damage: float, head: bool) -> void:
	if t != target or rules.dead:
		return
	# a finisher on the staggered body spends the stagger (close_combat.gd hands it poise 300)
	var finisher := target.impact >= 300.0
	target.impact = 0.0
	target.knock = Vector3.ZERO
	target.heavy = false
	if finisher:
		rules.finished_stagger()
	# gunplay already took `damage` off the target's hp; the rules own the real hull, so put it back and apply theirs
	target.hp = minf(target.max_hp, target.hp + damage)
	# what landed it (a melee blow, a grenade, else the gun in hand's element) and from how far: the unique encounters'
	# gimmicks (boss.gd `gimmick_mult`) read both
	var kind := String(gunplay.get("hit_kind")) if gunplay.get("hit_kind") else ""
	if kind == "" and gunplay.has_method("gun"):
		kind = String(gunplay.gun().element)
	var away := Vector2(operator.position.x - position.x, operator.position.z - position.z).length() - size * 0.3
	var dealt := rules.hit(damage * (1.3 if head else 1.0), kind, away)
	_gimmick_hint(kind, away)
	target.hp = rules.hull
	if rules.dead:
		target.hp = 0.0

## the gimmick said out loud, at most every few seconds: too far from a closing boss, an element it has learned
var _hint_t := 0.0
func _gimmick_hint(kind: String, away: float) -> void:
	if Time.get_ticks_msec() / 1000.0 < _hint_t:
		return
	var say := ""
	match rules.gimmick:
		"closing":
			if away > Boss.CLOSE_RANGE:
				say = "Cut out of the air — close the distance"
		"adaptive":
			if rules.gimmick_mult(kind, away) < 0.6:
				say = "%s has learned %s — switch your damage" % [String(rules.def.name), kind.capitalize()]
		"attune":
			if kind != rules.attuned:
				say = "Turned aside — its halo is %s" % rules.attuned.capitalize()
	if say != "":
		_hint_t = Time.get_ticks_msec() / 1000.0 + 4.0
		toast.call(say)

func step(dt: float) -> void:
	if not rules or rules.dead and _killed:
		return
	var to := operator.position - position
	to.y = 0.0
	var dist := to.length()
	rules.tick(dt, dist)
	# face and move
	if dist > 0.1:
		var want := atan2(to.x, to.z)
		heading = lerp_angle(heading, want, minf(1.0, 3.0 * dt))
	body.rotation.y = heading
	var sp := rules.move_speed()
	if sp > 0.0 and dist > float(rules.def.range) * 0.6:
		var step_v := to.normalized() * sp * dt
		var np := position + step_v
		var blocked := false
		for b in obstacles:
			if b.grow(size * 0.3).has_point(Vector3(np.x, b.position.y + 0.5, np.z)):
				blocked = true
				break
		if not blocked:
			position = np
	position.y = float(ground_at.call(position.x, position.z))
	target.set_meta("staggered", rules.staggered())
	target.box = AABB(position + Vector3(-size * 0.35, 0, -size * 0.35), Vector3(size * 0.7, size, size * 0.7))
	if _anim:
		var clip := "walk" if sp > 0.5 and _anim.has_animation("walk") else "idle"
		if _anim.current_animation != clip and _anim.has_animation(clip):
			_anim.play(clip, 0.2)
	# events
	for e in rules.drain():
		match String(e.kind):
			"telegraph":
				Sound.sfx_at("roar", position, operator.position, -4.0 if size > 4.0 else -9.0)
				_flash = float(e.seconds)
				_ring.visible = true
				var r: float = float(Boss.ATTACKS[e.attack].get("radius", float(rules.def.range) * 0.5))
				(_ring.mesh as TorusMesh).inner_radius = maxf(0.5, r - 0.4)
				(_ring.mesh as TorusMesh).outer_radius = r
				_telegraph(String(e.attack), float(e.seconds))
			"attack":
				_ring.visible = false
				_apply_attack(e, dist)
				if String(e.attack) in ["SLAM", "LUNGE"]:
					Sound.sfx_at("explosion" if String(e.attack) == "SLAM" else "land", position, operator.position, -6.0)
				elif String(e.attack) == "BREATH":
					Sound.sfx_at("jet", position, operator.position, -10.0)
			"summon":
				if echo:
					continue
				for i in int(e.count):
					var a := TAU * i / int(e.count)
					var at := position + Vector3(cos(a), 0, sin(a)) * (size + 3.0)
					at.y = float(ground_at.call(at.x, at.z))
					var add: RefCounted = enemies.spawn(String(e.type), at, [], 0)
					add.state = Enemies.State.ENGAGE
				toast.call("%s calls its brood" % String(rules.def.name))
			"phase":
				toast.call("%s — %s" % [String(e.label), String(e.telegraph)])
				_resupply(2)
			"attune":
				Sound.sfx("confirm", -8.0)
				toast.call("%s's halo turns %s" % [String(rules.def.name), String(e.element).capitalize()])
			"stagger":
				_resupply(1)
				Sound.sfx("stagger", -4.0)
				toast.call("STAGGERED — hit the core")
				if rules.id == "vyrak":
					Sound.voice_path(Lines.path("M09_007"))   # NOVA: "Chest weak point exposed…"
			"dead":
				if not _killed:
					_killed = true
					if not e.get("yield", false):
						Sound.sfx("explosion", -2.0)
					Sound.sfx("confirm", -4.0)
					_ring.visible = false
					killed.emit(rules.id, rules.reward())
	# the breath keeps burning while it lasts
	if _breath_t > 0.0:
		_breath_t -= dt
		var fwd := Vector3(sin(heading), 0, cos(heading))
		var flat := to.normalized() if dist > 0.1 else fwd
		if dist < float(_breath.reach) and fwd.dot(flat) > cos(float(_breath.cone)):
			enemies._hit_operator(float(_breath.damage) * dt, position, false, self)
		if int(Time.get_ticks_msec() / 90) % 2 == 0:
			var tip := position + Vector3(0, size * 0.6, 0) + fwd * float(_breath.reach) * (0.4 + randf() * 0.6) + Vector3(randf() - 0.5, randf() * 0.5, randf() - 0.5) * 3.0
			gunplay.tracer(position + Vector3(0, size * 0.6, 0) + fwd * size * 0.4, tip, Color(1.0, 0.45, 0.1))
	# the look: red flare through a telegraph, cyan core in a punish window
	_flash = maxf(0.0, _flash - dt)
	var cm := _core.material_override as StandardMaterial3D
	var punish := rules.staggered() or rules.weak_point()
	cm.emission_energy_multiplier = (4.0 + sin(Time.get_ticks_msec() * 0.01) * 1.5) if punish else 0.4
	cm.albedo_color = Color(0.4, 1.0, 1.0) if rules.staggered() else (Color(1.0, 0.8, 0.3) if rules.weak_point() else Color(0.3, 0.9, 1.0))
	if rules.gimmick == "attune" and not punish:
		# the halo: the attuned element's colour, always lit
		cm.albedo_color = _kind_color(rules.attuned)
		cm.emission_energy_multiplier = 2.5
	cm.emission = cm.albedo_color
	_ring.position = Vector3(0, 0.1, 0)
	if rules.staggered():
		body.rotation.x = lerpf(body.rotation.x, -0.25, 3.0 * dt)
	else:
		body.rotation.x = lerpf(body.rotation.x, 0.0, 3.0 * dt)
	if rules.dead and rules.yielded:
		body.rotation.x = lerpf(body.rotation.x, 0.0, 3.0 * dt)   # it yields: it stands, and stops
	elif rules.dead:
		body.rotation.x = lerpf(body.rotation.x, PI * 0.45, 2.0 * dt)
		body.position.y = lerpf(body.position.y, -size * 0.2, 2.0 * dt)

static func _kind_color(kind: String) -> Color:
	match kind:
		"MELEE":
			return Color(1.0, 1.0, 1.0)
		"GRENADE":
			return Color(1.0, 0.75, 0.2)
	var el: Dictionary = preload("res://scripts/combat/weapons.gd").ELEMENTS.get(kind, {})
	return el.get("color", Color(0.95, 0.9, 0.8))

func _apply_attack(e: Dictionary, dist: float) -> void:
	var dmg := float(e.damage)
	match String(e.attack):
		"LUNGE":
			# a short dash at the operator, then the bite if inside the radius
			var to := operator.position - position
			to.y = 0.0
			var d := to.length()
			if d > 0.1:
				position += to.normalized() * minf(d - 1.0, float(e.reach) * 0.7)
			if operator.position.distance_to(position) < float(e.radius) + size * 0.3:
				enemies._hit_operator(dmg, position, true, self)
			gunplay.spark(position + Vector3(0, size * 0.4, 0), false)
		"SLAM":
			if dist < float(e.radius) and not _airborne():
				enemies._hit_operator(dmg * (1.0 - 0.5 * dist / float(e.radius)), position, false, self)
			# the shockwave ring
			for i in 16:
				var a := TAU * i / 16.0
				var p := position + Vector3(cos(a), 0.2, sin(a)) * float(e.radius)
				gunplay.tracer(position + Vector3(0, 0.3, 0), p, Color(1.0, 0.5, 0.2))
		"VOLLEY":
			var from := position + Vector3(0, size * 0.6, 0)
			var aim := operator.position + Vector3(0, 1.0, 0)
			for i in int(e.bolts):
				var spread := Vector3(randf() - 0.5, randf() - 0.5, randf() - 0.5) * 0.12 * 2.0
				var dir := (aim - from).normalized() + spread
				var hit_op := _closest(from, from + dir * 60.0, aim) < 0.6
				gunplay.tracer(from, aim + spread * 20.0 if hit_op else from + dir * 60.0, Color(0.8, 0.3, 1.0))
				if hit_op:
					enemies._hit_operator(dmg, from, false, self)
		"BREATH":
			_breath = e
			_breath_t = float(Boss.ATTACKS.BREATH.duration)
		"SWEEP":
			# a wide swing round the front: a jump clears it, a dodge's i-frames pass through it, a parry counters it
			var to2 := operator.position - position
			to2.y = 0.0
			var fwd := Vector3(sin(heading), 0, cos(heading))
			if to2.length() < float(e.radius) + size * 0.3 and (to2.length() < 1.0 or fwd.angle_to(to2) < float(e.arc) * 0.5) and not _airborne():
				enemies._hit_operator(dmg, position, true, self)
			for i in 11:
				var a := heading - float(e.arc) * 0.5 + float(e.arc) * i / 10.0
				gunplay.tracer(position + Vector3(0, size * 0.3, 0), position + Vector3(sin(a), 0.1, cos(a)) * (float(e.radius) + size * 0.3), Color(1.0, 0.35, 0.2))
			Sound.sfx_at("swing_heavy", position, operator.position, -2.0)
		"CHARGE":
			# a run along the telegraphed line, through anything standing on it
			var from := position
			var dist2 := float(e.reach)
			var step_v := _charge_dir * 0.5
			var p := position
			for i in int(dist2 / 0.5):
				var np := p + step_v
				var blocked := false
				for b in obstacles:
					if b.grow(size * 0.3).has_point(Vector3(np.x, b.position.y + 0.5, np.z)):
						blocked = true
						break
				if blocked:
					break
				p = np
			position = p
			if _closest(from, p, operator.position) < float(e.radius) + size * 0.25:
				enemies._hit_operator(dmg, from, true, self)
				operator.knock(_charge_dir * 6.0)
			gunplay.tracer(from + Vector3(0, 0.4, 0), p + Vector3(0, 0.4, 0), Color(1.0, 0.4, 0.2))
			Sound.sfx_at("explosion_2", position, operator.position, -6.0)
		"SPIKES":
			# the circles laid at the telegraph erupt
			for at in _spikes:
				if Vector2(operator.position.x - at.x, operator.position.z - at.z).length() < float(e.radius):
					enemies._hit_operator(dmg, at, false, self)
				for k in 6:
					gunplay.tracer(at, at + Vector3(randf() - 0.5, 2.5 + randf() * 1.5, randf() - 0.5), Color(0.8, 0.35, 1.0))
				gunplay.debris(at + Vector3(0, 0.3, 0), Vector3(1.5, 0.6, 1.5), Color(0.55, 0.35, 0.75), 6)
			_spikes.clear()
			Sound.sfx_at("explosion_3", position, operator.position, -6.0)
	_clear_marks()

static func _closest(a: Vector3, b: Vector3, p: Vector3) -> float:
	var ab := b - a
	var t := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 1e-6), 0.0, 1.0)
	return (a + ab * t).distance_to(p)

# ------------------------------------------------------------------------------------------ patterns (Nov 22)
## a parried swing (close_combat.gd): poise in a lump, and the body reels
func parried() -> void:
	rules.parried()
	body.rotation.x = -0.2
	Sound.sfx_at("stagger", position, operator.position, -6.0)

## the operator is off the ground high enough to clear a low sweep or a slam's shockwave
func _airborne() -> bool:
	return operator != null and not bool(operator.get("grounded")) and operator.position.y - float(ground_at.call(operator.position.x, operator.position.z)) > 0.45

## the telegraph's marks: the CHARGE's line toward where the operator stands now, the SPIKES' circles under and around
## them; both stay where they were laid (move off them), both fade when the attack lands
func _telegraph(attack: String, _seconds: float) -> void:
	_clear_marks()
	match attack:
		"CHARGE":
			var to := operator.position - position
			to.y = 0.0
			_charge_dir = to.normalized() if to.length() > 0.1 else Vector3(sin(heading), 0, cos(heading))
			heading = atan2(_charge_dir.x, _charge_dir.z)
			var len := float(Boss.ATTACKS.CHARGE.reach)
			_mark_line(position + Vector3(0, 0.12, 0), position + _charge_dir * len + Vector3(0, 0.12, 0), float(Boss.ATTACKS.CHARGE.radius))
		"SPIKES":
			_spikes.clear()
			var n := int(Boss.ATTACKS.SPIKES.count) + rules.phase
			for i in n:
				var off := Vector3.ZERO if i == 0 else Vector3(cos(TAU * i / maxf(n - 1, 1)), 0, sin(TAU * i / maxf(n - 1, 1))) * 3.2
				var at: Vector3 = operator.position + off
				at.y = float(ground_at.call(at.x, at.z)) + 0.1
				_spikes.append(at)
				_mark_circle(at, float(Boss.ATTACKS.SPIKES.radius))

func _mark_mat() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(1.0, 0.25, 0.15, 0.45)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.emission_enabled = true
	m.emission = Color(1.0, 0.25, 0.15)
	return m

func _mark_circle(at: Vector3, r: float) -> void:
	var mi := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = maxf(0.2, r - 0.25)
	tm.outer_radius = r
	mi.mesh = tm
	mi.material_override = _mark_mat()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	get_parent().add_child(mi)
	mi.global_position = at
	mi.scale = Vector3(1, 0.15, 1)
	_marks.append(mi)

func _mark_line(a: Vector3, b: Vector3, w: float) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(w * 2.0, 0.04, a.distance_to(b))
	mi.mesh = bm
	mi.material_override = _mark_mat()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	get_parent().add_child(mi)
	mi.global_position = (a + b) * 0.5
	mi.look_at(b, Vector3.UP)
	_marks.append(mi)

func _clear_marks() -> void:
	for m in _marks:
		if is_instance_valid(m):
			m.queue_free()
	_marks.clear()

func _exit_tree() -> void:
	_clear_marks()

## magazines back into every carried gun's reserve (to the frame's full reserve)
func _resupply(mags: int) -> void:
	if gunplay == null or not ("guns" in gunplay):
		return
	for g in gunplay.guns:
		var f: Dictionary = Weapons.FRAMES.get(g.frame, {})
		g.reserve = mini(int(g.reserve) + int(f.get("mag", 10)) * mags, int(f.get("reserve", 0)))
