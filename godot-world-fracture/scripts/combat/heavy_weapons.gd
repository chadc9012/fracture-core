extends Node3D
## Heavy ordnance (owner, Nov 11: "Work on the tanks shooting missiles ... projectiles as well should feel like call of
## duty fort nite"): the Goliath tank's 120 mm cannon and its four-tube missile pod, as real projectiles you can watch fly
## — a glowing shell with a smoke wake, rockets that pop out of the pod, light their motors and curl onto a locked target
## — and explosions with weight: a white flash, a fireball, a shockwave ring, black smoke rolling up, chunks and embers,
## a scorch on the ground, the camera shaken by distance. The blast hurts what is near it: the troopers and dummies
## (gunplay.gd targets, through `grenade_hit` so kills and drops count), and the traffic, which is thrown and burns
## (traffic.gd `wreck`).
##
## The street (street_slice.gd) owns one; `fire_shell` / `fire_missiles` launch, `step` flies and blows things up.

const Sound := preload("res://scripts/audio/sound.gd")

signal exploded(at: Vector3, radius: float)

const SHELL_SPEED := 150.0
const SHELL_DROP := 3.0
const SHELL_DMG := 260.0
const SHELL_RADIUS := 7.0
const MISSILE_DMG := 140.0
const MISSILE_RADIUS := 5.0
const MISSILE_TOP := 75.0
const MISSILE_TURN := 4.2
const LIFE := 4.0
const FX_MAX := 260              # live effect pieces; past it the smallest are skipped

var gunplay: Node3D = null       # gunplay.gd (targets, grenade_hit, debris)
var traffic: Node3D = null       # traffic.gd (cars, wreck)
var obstacles: Array[AABB] = []
var ground_at := Callable()
var listener := Callable()       # -> Vector3: where the ears (and the camera) are
var shake := Callable()          # (amount: float): kicks the camera
var skip_box := -1               # the firing vehicle's own box

var _shots: Array = []           # {node, vel, kind, life, trail_t, target, boost}
var _fx: Array = []              # {node, t, life, grow, rise, fade, vel}
var _lights: Array = []
var _rng := RandomNumberGenerator.new()
var _mats := {}
var _sphere: QuadMesh           # a camera-facing quad with a soft round puff on it (smoke, fire, embers)
var _soft: ImageTexture
var _ring: TorusMesh
var _disc: CylinderMesh

func _ready() -> void:
	_rng.randomize()
	_sphere = QuadMesh.new()
	_sphere.size = Vector2(1.0, 1.0)
	# a soft, lumpy puff: a radial falloff broken up by a few lobes, so smoke reads as smoke and not as a ball
	var n := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var r2 := RandomNumberGenerator.new()
	r2.seed = 11
	var lobes: Array = []
	for i in 7:
		lobes.append([Vector2(r2.randf_range(-0.35, 0.35), r2.randf_range(-0.35, 0.35)), r2.randf_range(0.3, 0.5)])
	for y in n:
		for x in n:
			var p := Vector2((x + 0.5) / n * 2.0 - 1.0, (y + 0.5) / n * 2.0 - 1.0)
			var a := 0.0
			for l in lobes:
				a = maxf(a, 1.0 - (p - (l[0] as Vector2)).length() / float(l[1]))
			a = clampf(a, 0.0, 1.0)
			a = a * a * (3.0 - 2.0 * a) * clampf(1.0 - p.length(), 0.0, 1.0) * 1.6
			var shade := 0.8 + 0.2 * clampf(-p.y, -1.0, 1.0)
			img.set_pixel(x, y, Color(shade, shade, shade, clampf(a, 0.0, 1.0)))
	_soft = ImageTexture.create_from_image(img)
	_ring = TorusMesh.new()
	_ring.inner_radius = 0.42
	_ring.outer_radius = 0.5
	_ring.rings = 24
	_ring.ring_segments = 4
	_disc = CylinderMesh.new()
	_disc.top_radius = 0.5
	_disc.bottom_radius = 0.5
	_disc.height = 0.02
	_disc.radial_segments = 16

func _mat(key: String, col: Color, glow := 0.0, additive := false) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = col
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	if key.begins_with("puff"):
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		m.albedo_texture = _soft
	if additive:
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	if glow > 0.0:
		m.emission_enabled = true
		m.emission = Color(col.r, col.g, col.b)
		m.emission_energy_multiplier = glow
	_mats[key] = m
	return m

# ------------------------------------------------------------------------------------------------ firing
## the cannon: a shell from the muzzle along `dir`
func fire_shell(muzzle: Vector3, dir: Vector3) -> void:
	var n := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 0.09
	cap.height = 0.9
	n.mesh = cap
	n.material_override = _mat("shell", Color(1.0, 0.85, 0.5), 6.0)
	add_child(n)
	n.global_position = muzzle
	_orient(n, dir)
	_shots.append({ "node": n, "vel": dir.normalized() * SHELL_SPEED, "kind": "shell", "life": LIFE, "trail_t": 0.0 })
	# the blast at the muzzle: a flash, a ring of smoke blown round the barrel, dust off the road
	_puff(muzzle, Color(1.0, 0.9, 0.6, 0.95), 0.6, 2.4, 0.08, true, Vector3.ZERO, 7.0)
	for i in 8:
		var a := TAU * i / 8.0
		var side := dir.cross(Vector3.UP).normalized()
		var up := side.cross(dir).normalized()
		var v := (side * cos(a) + up * sin(a)) * 4.0 + dir * 3.0
		_puff(muzzle + dir * 0.4, Color(0.55, 0.55, 0.55, 0.55), 0.5, 1.8, 1.2, false, v)
	_light(muzzle, Color(1.0, 0.75, 0.4), 14.0, 9.0, 0.12)
	Sound.sfx("tank_cannon", 0.0, 0.04)
	_shake_at(muzzle, 0.55)

## the missile pod: `count` rockets out of the tubes at `pods`, each a moment after the last, curling onto `target`
## (a Node3D or a gunplay target to follow) or else onto `aim`
func fire_missiles(pods: Array, up_dir: Vector3, aim: Vector3, target: Variant = null) -> void:
	for i in pods.size():
		var p: Vector3 = pods[i]
		var n := Node3D.new()
		var body := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.07
		cyl.bottom_radius = 0.09
		cyl.height = 0.8
		body.mesh = cyl
		body.rotation.x = -PI * 0.5
		body.material_override = _mat("rocket", Color(0.85, 0.87, 0.9), 0.0)
		n.add_child(body)
		var flame := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 0.12
		cone.height = 0.7
		flame.mesh = cone
		flame.rotation.x = PI * 0.5
		flame.position = Vector3(0, 0, 0.7)
		flame.material_override = _mat("flame", Color(1.0, 0.6, 0.2), 8.0, true)
		n.add_child(flame)
		add_child(n)
		n.global_position = p
		var spread := Vector3(_rng.randf_range(-1, 1), 0, _rng.randf_range(-1, 1)) * 2.5
		var v0 := up_dir.normalized() * 14.0 + (aim - p).normalized() * 8.0 + spread
		_orient(n, v0)
		_shots.append({ "node": n, "vel": v0, "kind": "missile", "life": LIFE + 1.5, "trail_t": 0.0, "target": target,
			"aim": aim + Vector3(_rng.randf_range(-1.2, 1.2), 0, _rng.randf_range(-1.2, 1.2)), "delay": i * 0.14,
			"boost": 0.0, "flame": flame })
		n.visible = false
	Sound.sfx("missile_launch", -1.0, 0.06)

# ------------------------------------------------------------------------------------------------ flight
func step(dt: float) -> void:
	var keep: Array = []
	for s in _shots:
		var n: Node3D = s.node
		if s.has("delay") and float(s.delay) > 0.0:
			s.delay = float(s.delay) - dt
			if float(s.delay) <= 0.0:
				n.visible = true
				Sound.sfx("missile_launch", -8.0, 0.1)
				_puff(n.global_position, Color(0.9, 0.9, 0.9, 0.7), 0.4, 1.6, 0.9, false, Vector3(0, 1.5, 0))
			keep.append(s)
			continue
		s.life = float(s.life) - dt
		var v: Vector3 = s.vel
		if s.kind == "shell":
			v.y -= SHELL_DROP * dt
		else:
			# out of the tube on the kick, then the motor lights and it steers onto the target
			s.boost = float(s.boost) + dt
			var goal: Vector3 = s.aim
			var tg: Variant = s.get("target")
			if tg is Node3D and is_instance_valid(tg):
				goal = (tg as Node3D).global_position + Vector3(0, 1.0, 0)
			elif tg is Object and is_instance_valid(tg) and tg.get("box") != null and tg.alive():
				goal = (tg.box as AABB).get_center()
			if float(s.boost) > 0.22:
				var want := (goal - n.global_position).normalized()
				var spd := minf(v.length() + 95.0 * dt, MISSILE_TOP)
				var cur := v.normalized()
				var ang := cur.angle_to(want)
				var turn := minf(1.0, MISSILE_TURN * dt / maxf(ang, 0.001))
				v = cur.slerp(want, turn).normalized() * spd
				# a little corkscrew in the smoke
				v += cur.cross(Vector3.UP).normalized() * sin(float(s.boost) * 22.0) * 0.6
				(s.flame as Node3D).scale = Vector3.ONE * _rng.randf_range(0.8, 1.4)
			else:
				v.y -= 9.8 * dt
				(s.flame as Node3D).scale = Vector3.ONE * 0.3
		var from := n.global_position
		var to := from + v * dt
		s.vel = v
		# smoke behind it
		s.trail_t = float(s.trail_t) - dt
		if float(s.trail_t) <= 0.0:
			if s.kind == "shell":
				s.trail_t = 0.012
				_puff(from, Color(0.8, 0.8, 0.82, 0.35), 0.12, 0.7, 0.6, false, Vector3(0, 0.3, 0))
			else:
				s.trail_t = 0.018
				_puff(from, Color(0.86, 0.86, 0.88, 0.6), 0.22, 1.4, 1.6, false, Vector3(0, 0.4, 0) + _jit(0.4))
				if _rng.randf() < 0.35:
					_puff(from, Color(1.0, 0.65, 0.25, 0.9), 0.15, 0.4, 0.12, true)
		var hit: Variant = _sweep(from, to, s.get("target"))
		if hit != null:
			var at: Vector3 = hit
			_explode(at, SHELL_RADIUS if s.kind == "shell" else MISSILE_RADIUS, SHELL_DMG if s.kind == "shell" else MISSILE_DMG, s.kind == "shell")
			n.queue_free()
			continue
		if float(s.life) <= 0.0:
			_explode(to, MISSILE_RADIUS * 0.8, MISSILE_DMG * 0.5, false)
			n.queue_free()
			continue
		n.global_position = to
		_orient(n, v)
		keep.append(s)
	_shots = keep
	_step_fx(dt)

## where the flight from..to first meets something: the ground, a box (a facade, a parked car, a traffic car), a target
func _sweep(from: Vector3, to: Vector3, want: Variant) -> Variant:
	var d := to - from
	var len := d.length()
	if len < 0.0001:
		return null
	var dir := d / len
	var best := len
	var any := false
	for i in obstacles.size():
		if i == skip_box:
			continue
		var b: AABB = obstacles[i]
		if b.size.y < 0.05 or b.position.y < -40.0:
			continue
		var p: Variant = b.intersects_segment(from, to)
		if p != null:
			var dd := from.distance_to(p)
			if dd < best:
				best = dd
				any = true
	if gunplay:
		for t in gunplay.targets:
			if not t.alive():
				continue
			var p2: Variant = (t.box as AABB).grow(0.4).intersects_segment(from, to)
			if p2 != null:
				var dd2 := from.distance_to(p2)
				if dd2 < best:
					best = dd2
					any = true
	if ground_at.is_valid():
		var g: float = ground_at.call(to.x, to.z)
		if to.y <= g:
			var k := clampf((from.y - g) / maxf(from.y - to.y, 0.0001), 0.0, 1.0)
			var dd3 := len * k
			if dd3 < best:
				best = dd3
				any = true
	return from + dir * best if any else null

# ------------------------------------------------------------------------------------------------ the blast
func _explode(at: Vector3, radius: float, dmg: float, big: bool) -> void:
	var g := at.y
	if ground_at.is_valid():
		g = ground_at.call(at.x, at.z)
	# white flash, the fireball, its dark-orange skin, the shockwave on the ground, rolling smoke, embers
	_puff(at, Color(1.0, 0.97, 0.85, 1.0), 0.4, radius * 0.75, 0.09, true, Vector3.ZERO, 0.0)
	_puff(at, Color(1.0, 0.62, 0.18, 0.95), 0.6, radius * 0.95, 0.35, true, Vector3(0, 1.2, 0))
	_puff(at + Vector3(0, radius * 0.15, 0), Color(0.95, 0.35, 0.08, 0.85), 0.5, radius * 0.8, 0.55, true, Vector3(0, 2.5, 0))
	var ring := MeshInstance3D.new()
	ring.mesh = _ring
	ring.material_override = _mat("ring", Color(1.0, 0.9, 0.75, 0.6), 2.0, true)
	add_child(ring)
	ring.global_position = Vector3(at.x, g + 0.15, at.z)
	_fx.append({ "node": ring, "t": 0.0, "life": 0.4, "from": 0.6, "to": radius * 2.6, "fade": true })
	for i in (14 if big else 9):
		var v := Vector3(_rng.randf_range(-1, 1), _rng.randf_range(0.3, 1.2), _rng.randf_range(-1, 1)) * radius * 0.5
		var c := _rng.randf_range(0.08, 0.2)
		_puff(at + _jit(radius * 0.25), Color(c, c, c, 0.8), radius * 0.25, radius * _rng.randf_range(0.6, 1.0), _rng.randf_range(1.8, 3.2), false, v * 0.35 + Vector3(0, 2.2, 0))
	for i in (22 if big else 14):
		var v2 := Vector3(_rng.randf_range(-1, 1), _rng.randf_range(0.4, 1.6), _rng.randf_range(-1, 1)).normalized() * _rng.randf_range(8.0, 22.0)
		_puff(at, Color(1.0, 0.7, 0.3, 1.0), 0.09, 0.05, _rng.randf_range(0.4, 0.9), true, v2, 0.0, true)
	if gunplay and gunplay.has_method("debris"):
		gunplay.debris(at, Vector3.ONE * radius * 0.4, Color(0.35, 0.33, 0.3), 10 if big else 6)
	# the scorch on the road
	var sc := MeshInstance3D.new()
	sc.mesh = _disc
	sc.material_override = _mat("scorch", Color(0.03, 0.03, 0.03, 0.85))
	add_child(sc)
	sc.global_position = Vector3(at.x, g + 0.03, at.z)
	sc.scale = Vector3(radius * 1.1, 1.0, radius * 1.1)
	_fx.append({ "node": sc, "t": 0.0, "life": 12.0, "from": radius * 1.1, "to": radius * 1.1, "fade": true, "flat": true })
	_light(at + Vector3(0, 1.0, 0), Color(1.0, 0.6, 0.25), 22.0 if big else 14.0, radius * 4.0, 0.45)
	var ears: Vector3 = listener.call() if listener.is_valid() else at
	Sound.sfx_at("explosion_big" if big else "explosion", at, ears, 2.0 if big else 0.0)
	_shake_at(at, 1.4 if big else 0.9)
	# what it hurts: troopers and dummies, then the traffic (thrown and burning)
	if gunplay:
		for t in gunplay.targets:
			if not t.alive() or t.has_meta("cover_box"):
				continue
			var d := (t.box as AABB).get_center().distance_to(at)
			if d < radius:
				gunplay.grenade_hit(t, dmg * (1.0 - 0.7 * d / radius), at)
	if traffic and traffic.has_method("wreck"):
		for w: Vector3 in traffic.wreck(at, radius * 1.3):
			# the car goes up too: a second fireball off its tank, and it smokes where it lands
			_puff(w + Vector3(0, 1.0, 0), Color(1.0, 0.55, 0.15, 0.9), 0.8, 3.2, 0.5, true, Vector3(0, 3.0, 0))
			for i in 5:
				_puff(w + Vector3(0, 1.2 + i * 0.5, 0) + _jit(0.6), Color(0.07, 0.07, 0.07, 0.75), 0.8, 3.0, 4.0 + i * 0.5, false, Vector3(0, 2.6, 0) + _jit(0.4))
			Sound.sfx_at("car_explode", w, ears, 0.0)
	exploded.emit(at, radius)

func _shake_at(at: Vector3, amount: float) -> void:
	if not shake.is_valid():
		return
	var ears: Vector3 = listener.call() if listener.is_valid() else at
	var d := ears.distance_to(at)
	shake.call(amount * clampf(1.0 - d / 70.0, 0.0, 1.0))

# ------------------------------------------------------------------------------------------------ effect pieces
## a ball that grows from `r0` to `r1` over `life`, drifts with `vel` and fades; `hot` ones glow
func _puff(at: Vector3, col: Color, r0: float, r1: float, life: float, hot := false, vel := Vector3.ZERO, glow := 4.0, falls := false) -> void:
	if _fx.size() >= FX_MAX and r1 < 1.0:
		return
	var n := MeshInstance3D.new()
	n.mesh = _sphere
	n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var key := "puff%s%.2f,%.2f,%.2f,%.2f" % ["h" if hot else "s", col.r, col.g, col.b, col.a]
	n.material_override = (_mat(key, col, glow if hot else 0.0, hot) as StandardMaterial3D).duplicate()
	add_child(n)
	n.global_position = at
	n.scale = Vector3.ONE * r0 * 2.0
	_fx.append({ "node": n, "t": 0.0, "life": life, "from": r0 * 2.0, "to": r1 * 2.0, "fade": true, "vel": vel, "falls": falls, "a": col.a })

func _light(at: Vector3, col: Color, energy: float, rng: float, life: float) -> void:
	var l := OmniLight3D.new()
	l.light_color = col
	l.light_energy = energy
	l.omni_range = rng
	l.shadow_enabled = false
	add_child(l)
	l.global_position = at
	_lights.append({ "node": l, "t": life, "life": life, "e": energy })

func _step_fx(dt: float) -> void:
	var keep: Array = []
	for f in _fx:
		f.t = float(f.t) + dt
		var n: MeshInstance3D = f.node
		var k := clampf(float(f.t) / float(f.life), 0.0, 1.0)
		if k >= 1.0:
			n.queue_free()
			continue
		var e := 1.0 - pow(1.0 - k, 3.0)
		var s := lerpf(float(f.from), float(f.to), e)
		n.scale = Vector3(s, 1.0, s) if f.get("flat", false) else Vector3.ONE * s
		if f.has("vel"):
			var v: Vector3 = f.vel
			if f.get("falls", false):
				v.y -= 14.0 * dt
			else:
				v *= maxf(0.0, 1.0 - 1.6 * dt)
			f.vel = v
			n.global_position += v * dt
		var m := n.material_override as StandardMaterial3D
		if m:
			var c := m.albedo_color
			c.a = float(f.get("a", 1.0)) * (1.0 - k * k) if f.get("fade", true) else c.a
			if f.get("flat", false):
				c.a = 0.85 * (1.0 - smoothstep(0.7, 1.0, k))
			m.albedo_color = c
		keep.append(f)
	_fx = keep
	var lk: Array = []
	for l in _lights:
		l.t = float(l.t) - dt
		var ln: OmniLight3D = l.node
		if float(l.t) <= 0.0:
			ln.queue_free()
			continue
		ln.light_energy = float(l.e) * pow(float(l.t) / float(l.life), 2.0)
		lk.append(l)
	_lights = lk

func _orient(n: Node3D, dir: Vector3) -> void:
	if dir.length() < 0.001:
		return
	var up := Vector3.UP if absf(dir.normalized().y) < 0.98 else Vector3.RIGHT
	n.look_at(n.global_position + dir, up)

func _jit(r: float) -> Vector3:
	return Vector3(_rng.randf_range(-r, r), _rng.randf_range(-r, r), _rng.randf_range(-r, r))

func live() -> int:
	return _shots.size()
