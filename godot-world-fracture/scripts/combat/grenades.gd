extends Node3D
const Sound := preload("res://scripts/audio/sound.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
## Operator grenades (owner ask Nov 10: "different kinds of grenades that are unique to the three operators"), the Godot
## port of the web build's src/game/grenades.ts + player-grenades.ts — same nine grenades, same numbers, damage × 10 (the
## Godot hull scale, enemies.gd). Every Operator frame carries three of its own and equips one:
##   goliath   Breacher Frag (heavy blast, throws bodies back) · Thermite (burning pool) · Concussion (wide stun)
##   nyx       Shroud (smoke: nobody sees in or out) · Tripmine (sticks, arms, waits) · Tracer (marks: +33% damage taken)
##   cipher    Singularity (pulls in, then bursts) · Arc Chain (stuns, arcs to 3 more) · Rift Well (heals you, slows them)
## gunplay.gd owns one of these and steps it, so every combat view (street, Killbox, raids, descent, bosses, the airport)
## gets grenades with no wiring of its own. Input: J throws, K cycles (desk); GRENADE and ⟳ buttons (phone) — read from
## the touch_controls group. Effects land on gunplay's Targets through gunplay.grenade_hit (the same hit / killed signals
## as a bolt, so kills, tallies and drops work); stuns and marks are Target fields enemies.gd and gunplay read.

const DMG_SCALE := 10.0
const GRENADES := {
	"breacher":    { "name": "Breacher Frag", "frame": "goliath", "effect": "BLAST", "color": Color("#ffb02e"), "charges": 2, "cooldown": 14.0, "fuse": 1.6, "sticky": false, "radius": 6.0, "damage": 6.0, "knockback": 4.0, "stun": 0.0, "duration": 0.0, "tick": 0.0, "amount": 0.0, "jumps": 0, "reach": 0.0 },
	"thermite":    { "name": "Thermite", "frame": "goliath", "effect": "BURN", "color": Color("#ff5a1a"), "charges": 2, "cooldown": 16.0, "fuse": 1.2, "sticky": false, "radius": 3.0, "damage": 2.0, "knockback": 0.0, "stun": 0.0, "duration": 6.0, "tick": 1.4, "amount": 0.0, "jumps": 0, "reach": 4.5 },
	"concussion":  { "name": "Concussion", "frame": "goliath", "effect": "BLAST", "color": Color("#f4e7c0"), "charges": 2, "cooldown": 15.0, "fuse": 1.3, "sticky": false, "radius": 7.5, "damage": 2.0, "knockback": 6.0, "stun": 2.5, "duration": 0.0, "tick": 0.0, "amount": 0.0, "jumps": 0, "reach": 0.0 },
	"shroud":      { "name": "Shroud", "frame": "nyx", "effect": "SMOKE", "color": Color("#8a7aa8"), "charges": 2, "cooldown": 18.0, "fuse": 1.0, "sticky": false, "radius": 6.5, "damage": 0.0, "knockback": 0.0, "stun": 0.0, "duration": 9.0, "tick": 0.0, "amount": 0.0, "jumps": 0, "reach": 0.0 },
	"tripmine":    { "name": "Tripmine", "frame": "nyx", "effect": "MINE", "color": Color("#ff3a5a"), "charges": 2, "cooldown": 14.0, "fuse": 1.0, "sticky": true, "radius": 4.5, "damage": 7.0, "knockback": 0.0, "stun": 0.0, "duration": 25.0, "tick": 0.0, "amount": 0.0, "jumps": 0, "reach": 3.0 },
	"tracer":      { "name": "Tracer", "frame": "nyx", "effect": "MARK", "color": Color("#38e8ff"), "charges": 2, "cooldown": 12.0, "fuse": 1.1, "sticky": false, "radius": 5.5, "damage": 1.5, "knockback": 0.0, "stun": 0.0, "duration": 6.0, "tick": 0.0, "amount": 0.33, "jumps": 0, "reach": 0.0 },
	"singularity": { "name": "Singularity", "frame": "cipher", "effect": "PULL", "color": Color("#b04aff"), "charges": 1, "cooldown": 18.0, "fuse": 1.2, "sticky": false, "radius": 4.0, "damage": 5.0, "knockback": 0.0, "stun": 0.0, "duration": 1.6, "tick": 0.0, "amount": 0.0, "jumps": 0, "reach": 8.0 },
	"arc-chain":   { "name": "Arc Chain", "frame": "cipher", "effect": "CHAIN", "color": Color("#7ff4ff"), "charges": 2, "cooldown": 14.0, "fuse": 1.2, "sticky": false, "radius": 5.0, "damage": 2.5, "knockback": 0.0, "stun": 1.5, "duration": 0.0, "tick": 0.0, "amount": 0.0, "jumps": 3, "reach": 9.0 },
	"rift-well":   { "name": "Rift Well", "frame": "cipher", "effect": "HEAL", "color": Color("#4affa0"), "charges": 1, "cooldown": 22.0, "fuse": 0.9, "sticky": false, "radius": 4.5, "damage": 0.0, "knockback": 0.0, "stun": 0.0, "duration": 8.0, "tick": 9.0, "amount": 0.5, "jumps": 0, "reach": 0.0 },
}
const FRAME_GRENADES := {
	"goliath": ["breacher", "thermite", "concussion"],
	"nyx": ["shroud", "tripmine", "tracer"],
	"cipher": ["singularity", "arc-chain", "rift-well"],
}
const THROW := { "speed": 19.0, "lift": 4.5, "gravity": 22.0, "bounce": 0.35, "friction": 0.55, "max_live": 6 }
## Shroud: an enemy's sight of anything in (or through) smoke drops to this fraction of its range
const SMOKE_SIGHT := 0.15
const SAVE := "user://grenades.json"

# ---------------- pure rules (mirrors grenades.ts) ----------------

static func blast_damage(g: Dictionary, dist: float) -> float:
	return 0.0 if dist >= float(g.radius) else float(g.damage) * (1.0 - 0.5 * dist / float(g.radius))

static func zone_radius(g: Dictionary) -> float:
	return float(g.reach) if g.effect in ["BURN", "PULL"] else float(g.radius)

static func kinds_for(frame: String) -> Array:
	return FRAME_GRENADES.get(frame, FRAME_GRENADES.goliath)

static func next_kind(frame: String, kind: String) -> String:
	var list := kinds_for(frame)
	return list[(list.find(kind) + 1) % list.size()]

static func new_pouch(kind: String) -> Dictionary:
	return { "kind": kind, "charges": int(GRENADES[kind].charges), "recharge": 0.0 }

## switching keeps the pouch's fill as a fraction
static func switch_pouch(p: Dictionary, kind: String) -> Dictionary:
	if p.kind == kind:
		return p
	var was: Dictionary = GRENADES[p.kind]
	var now: Dictionary = GRENADES[kind]
	return { "kind": kind, "charges": mini(int(now.charges), int(floor(float(p.charges) / float(was.charges) * float(now.charges) + 1e-6))), "recharge": 0.0 }

static func step_pouch(p: Dictionary, dt: float) -> void:
	var g: Dictionary = GRENADES[p.kind]
	if int(p.charges) >= int(g.charges):
		p.recharge = 0.0
		return
	p.recharge = float(p.recharge) + dt
	if float(p.recharge) >= float(g.cooldown):
		p.charges = int(p.charges) + 1
		p.recharge = 0.0

## the equipped grenade per frame (saved; the frame's first until one is picked)
static func load_choice(frame: String) -> String:
	var list := kinds_for(frame)
	if FileAccess.file_exists(SAVE):
		var f := FileAccess.open(SAVE, FileAccess.READ)
		var d: Variant = JSON.parse_string(f.get_as_text()) if f else null
		if d is Dictionary and str((d as Dictionary).get(frame, "")) in list:
			return str((d as Dictionary)[frame])
	return list[0]

static func save_choice(frame: String, kind: String) -> void:
	var d := {}
	if FileAccess.file_exists(SAVE):
		var r := FileAccess.open(SAVE, FileAccess.READ)
		var v: Variant = JSON.parse_string(r.get_as_text()) if r else null
		if v is Dictionary:
			d = v
	d[frame] = kind
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))

# ---------------- runtime ----------------

var gunplay: Node3D
var frame := "goliath"
var pouch := {}
## live grenades: { kind, pos, vel, fuse, rest, armed, zone, life, node }
var live: Array = []
## off for tests and shots: the choice is not written to disk
var persist := true
var _fx: Array = []          # { node, t, life, grow }
var _mats := {}

func setup(g: Node3D) -> void:
	gunplay = g
	top_level = true     # grenades live in world space whatever gunplay hangs off
	var look: Dictionary = {}
	if g.player and g.player.get("rig") and g.player.rig and g.player.rig.get("look") is Dictionary:
		look = g.player.rig.look
	set_frame(str(look.get("frame", CharacterStore.load_look().get("frame", "goliath"))))

func set_frame(f: String) -> void:
	frame = f if FRAME_GRENADES.has(f) else "goliath"
	pouch = new_pouch(load_choice(frame) if persist else kinds_for(frame)[0])

func def() -> Dictionary:
	return GRENADES[pouch.kind]

func cycle() -> void:
	pouch = switch_pouch(pouch, next_kind(frame, pouch.kind))
	if persist:
		save_choice(frame, pouch.kind)
	Sound.sfx("click", -6.0)

## throws the equipped grenade from `from` along `dir`; false when the pouch is empty
func throw_along(from: Vector3, dir: Vector3) -> bool:
	if int(pouch.charges) <= 0:
		return false
	var g := def()
	if g.effect == "MINE":
		var mines := live.filter(func(q): return q.kind == pouch.kind)
		if mines.size() >= 2:
			_remove(mines[0])
	if live.size() >= int(THROW.max_live):
		_remove(live[0])
	pouch.charges = int(pouch.charges) - 1
	var d := dir.normalized()
	var gr := { "kind": pouch.kind, "pos": from, "vel": d * float(THROW.speed) + Vector3(0, float(THROW.lift), 0), "fuse": float(g.fuse),
		"rest": false, "armed": false, "zone": false, "life": float(g.duration), "node": _canister(g) }
	live.append(gr)
	Sound.sfx("launcher", -10.0)
	return true

func in_smoke(p: Vector3) -> bool:
	for gr in live:
		if gr.zone and GRENADES[gr.kind].effect == "SMOKE" and Vector2(gr.pos.x - p.x, gr.pos.z - p.z).length() < float(GRENADES[gr.kind].radius):
			return true
	return false

## a step: input (throw / cycle), the pouch, the flights, the effects, the visuals
func step(dt: float, cam: Camera3D, throw := false, cycle_now := false) -> void:
	# the body may be rebuilt as another frame after setup (a view loads the save's look): follow it
	var p: Node3D = gunplay.player
	if p and p.get("rig") and p.rig and p.rig.get("look") is Dictionary:
		var f := str((p.rig.look as Dictionary).get("frame", frame))
		if f != frame and FRAME_GRENADES.has(f):
			set_frame(f)
	if cycle_now:
		cycle()
	if throw and cam:
		var hand: Vector3 = gunplay.player.position + Vector3(0, 1.6, 0)
		var dir := -cam.global_transform.basis.z
		if not throw_along(hand + Vector3(dir.x, 0, dir.z).normalized() * 0.5, dir):
			Sound.sfx("dry", -6.0)
	step_pouch(pouch, dt)
	for gr in live.duplicate():
		_step_one(gr, dt)
	_step_fx(dt)

func _ground(x: float, z: float) -> float:
	var p: Node3D = gunplay.player
	return float(p.ground_at.call(x, z)) if p and p.get("ground_at") else 0.0

func _fly(gr: Dictionary, dt: float) -> void:
	if gr.rest or gr.zone or gr.armed:
		return
	var g: Dictionary = GRENADES[gr.kind]
	gr.vel.y -= float(THROW.gravity) * dt
	var next: Vector3 = gr.pos + gr.vel * dt
	# a wall: bounce off it (the box face it came through)
	for b in gunplay.obstacles:
		if (b as AABB).has_point(next) and not (b as AABB).has_point(gr.pos):
			if g.sticky:
				gr.vel = Vector3.ZERO
				gr.rest = true
				return
			var bx := Vector3(next.x, gr.pos.y, gr.pos.z)
			if (b as AABB).has_point(bx):
				gr.vel.x = -gr.vel.x * float(THROW.bounce)
			else:
				gr.vel.z = -gr.vel.z * float(THROW.bounce)
			next = gr.pos
			break
	gr.pos = next
	var floor_y := _ground(gr.pos.x, gr.pos.z) + 0.12
	if gr.pos.y <= floor_y:
		gr.pos.y = floor_y
		if g.sticky:
			gr.vel = Vector3.ZERO
			gr.rest = true
			return
		gr.vel = Vector3(gr.vel.x * float(THROW.friction), absf(gr.vel.y) * float(THROW.bounce), gr.vel.z * float(THROW.friction))
		if absf(gr.vel.y) < 1.0 and Vector2(gr.vel.x, gr.vel.z).length() < 0.6:
			gr.vel = Vector3.ZERO
			gr.rest = true

## the Targets a grenade can touch: alive, not cover, not the operator's own team
func _foes() -> Array:
	var out: Array = []
	for t in gunplay.targets:
		if not t.alive() or t.has_meta("cover_box") or t.has_meta("prop"):
			continue
		if t.has_meta("enemy") and t.has_meta("roster"):
			var r: Node = t.get_meta("roster")
			if t.get_meta("enemy").team == int(r.get("operator_team")):
				continue
		out.append(t)
	return out

static func _feet(t) -> Vector3:
	return Vector3(t.box.get_center().x, t.box.position.y, t.box.get_center().z)

func _near(at: Vector3, r: float) -> Array:
	return _foes().filter(func(t): return Vector2(_feet(t).x - at.x, _feet(t).z - at.z).length() < r)

func _flat(t, at: Vector3) -> float:
	return Vector2(_feet(t).x - at.x, _feet(t).z - at.z).length()

func _hurt(t, dmg: float, at: Vector3) -> void:
	if dmg > 0.0 and t.alive():
		gunplay.grenade_hit(t, dmg * DMG_SCALE, at)

## moves a bot along the ground (a shove away, or a pull in); dummies and turrets stay put
func _move(t, by: Vector3) -> void:
	if not t.has_meta("enemy"):
		return
	var m: Node3D = t.get_meta("enemy").mover
	m.position += Vector3(by.x, 0, by.z)
	t.box.position += Vector3(by.x, 0, by.z)     # enemies.gd rebuilds it each step; keep it true until then

func _blast(gr: Dictionary) -> void:
	var g: Dictionary = GRENADES[gr.kind]
	for t in _near(gr.pos, float(g.radius)):
		var d := _flat(t, gr.pos)
		_hurt(t, blast_damage(g, d), gr.pos)
		if float(g.knockback) > 0.0:
			var away: Vector3 = _feet(t) - gr.pos
			away.y = 0.0
			_move(t, away.normalized() * float(g.knockback) * (1.0 - d / float(g.radius)))
		if float(g.stun) > 0.0:
			t.stun = maxf(t.stun, float(g.stun))

func _step_one(gr: Dictionary, dt: float) -> void:
	var g: Dictionary = GRENADES[gr.kind]
	_fly(gr, dt)
	if g.effect == "MINE":
		if not gr.rest:
			_place(gr, dt)
			return
		if not gr.armed:
			gr.fuse -= dt
			if gr.fuse <= 0.0:
				gr.armed = true
			_place(gr, dt)
			return
		gr.life -= dt
		if not _near(gr.pos, float(g.reach)).is_empty():
			_blast(gr)
			_burst(gr.pos, float(g.radius), g.color)
			_remove(gr)
			return
		if gr.life <= 0.0:
			_remove(gr)
			return
		_place(gr, dt)
		return
	if not gr.zone:
		gr.fuse -= dt
		if gr.fuse > 0.0:
			_place(gr, dt)
			return
		gr.vel = Vector3.ZERO
		gr.rest = true
		match g.effect:
			"BLAST":
				_blast(gr)
				_burst(gr.pos, float(g.radius), g.color)
				_remove(gr)
				return
			"MARK":
				for t in _near(gr.pos, float(g.radius)):
					_hurt(t, blast_damage(g, _flat(t, gr.pos)), gr.pos)
					if t.alive():
						t.mark = maxf(t.mark, float(g.duration))
				_burst(gr.pos, float(g.radius), g.color)
				_remove(gr)
				return
			"CHAIN":
				var hit := _near(gr.pos, float(g.radius))
				for t in hit:
					_hurt(t, blast_damage(g, _flat(t, gr.pos)), gr.pos)
					t.stun = maxf(t.stun, float(g.stun))
					gunplay.tracer(gr.pos + Vector3(0, 0.3, 0), t.box.get_center(), g.color)
				var from = hit[hit.size() - 1] if not hit.is_empty() else null
				var done := hit.duplicate()
				for j in int(g.jumps):
					if from == null:
						break
					var best = null
					var best_d := float(g.reach)
					for t in _foes():
						if t in done:
							continue
						var d: float = _feet(t).distance_to(_feet(from))
						if d < best_d:
							best_d = d
							best = t
					if best == null:
						break
					done.append(best)
					gunplay.tracer(from.box.get_center(), best.box.get_center(), g.color)
					_hurt(best, float(g.damage) * 0.6, _feet(from))
					best.stun = maxf(best.stun, float(g.stun))
					from = best
				_burst(gr.pos, float(g.radius), g.color)
				_remove(gr)
				return
			"BURN":
				_blast(gr)
		# the rest leave a zone behind
		gr.zone = true
		gr.life = float(g.duration)
		_burst(gr.pos, zone_radius(g), g.color)
		if g.effect in ["PULL", "HEAL"]:
			Sound.sfx_at("portal", gr.pos, gunplay.player.position, -6.0)
		_zone_look(gr)
		return
	# a zone: burning / smoking / pulling / healing
	gr.life -= dt
	var r := zone_radius(g)
	match g.effect:
		"BURN":
			for t in _near(gr.pos, r):
				_hurt(t, float(g.tick) * dt, gr.pos)
		"PULL":
			for t in _near(gr.pos, r):
				var to: Vector3 = gr.pos - _feet(t)
				to.y = 0.0
				if to.length() > 0.6:
					_move(t, to.normalized() * minf(to.length() - 0.5, 7.0 * dt))
				t.stun = maxf(t.stun, 0.1)
		"HEAL":
			var roster: Node = gunplay.get("roster")
			var op: Vector3 = gunplay.player.position
			if roster and Vector2(op.x - gr.pos.x, op.z - gr.pos.z).length() < r and float(roster.get("down")) <= 0.0:
				roster.hull = minf(float(roster.hull_max), float(roster.hull) + float(g.tick) * dt)
			# enemies in the well fire at a fraction of their rate
			for t in _near(gr.pos, r):
				if t.has_meta("enemy"):
					var e = t.get_meta("enemy")
					e.cool += dt * float(g.amount)
	_place(gr, dt)
	if gr.life <= 0.0:
		if g.effect == "PULL":
			for t in _near(gr.pos, float(g.radius)):
				_hurt(t, blast_damage(g, _flat(t, gr.pos)), gr.pos)
			_burst(gr.pos, float(g.radius), g.color)
			Sound.sfx_at("explosion", gr.pos, gunplay.player.position, -2.0)
		_remove(gr)

func _remove(gr: Dictionary) -> void:
	live.erase(gr)
	if gr.node and is_instance_valid(gr.node):
		gr.node.queue_free()

# ---------------- the look ----------------

func _glow(c: Color, alpha := 0.9) -> StandardMaterial3D:
	var key := "%s|%.2f" % [c.to_html(), alpha]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(c.r, c.g, c.b, alpha)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.no_depth_test = false
	_mats[key] = m
	return m

## a small dark canister with a band of the grenade's colour
func _canister(g: Dictionary) -> Node3D:
	var root := Node3D.new()
	var body := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.09
	cyl.bottom_radius = 0.09
	cyl.height = 0.2
	body.mesh = cyl
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(0.16, 0.17, 0.2)
	dark.metallic = 0.7
	dark.roughness = 0.4
	body.material_override = dark
	body.rotation.z = PI / 2
	root.add_child(body)
	var band := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.096
	bm.bottom_radius = 0.096
	bm.height = 0.05
	band.mesh = bm
	band.material_override = _glow(g.color)
	band.rotation.z = PI / 2
	band.name = "band"
	root.add_child(band)
	add_child(root)
	return root

## what a gone-off grenade leaves: a ring on the ground, and smoke / a pool / a column / a dark knot
func _zone_look(gr: Dictionary) -> void:
	var g: Dictionary = GRENADES[gr.kind]
	var root: Node3D = gr.node
	for c in root.get_children():
		c.visible = false
	var r := zone_radius(g)
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = r - 0.08
	tm.outer_radius = r
	ring.mesh = tm
	ring.material_override = _glow(g.color, 0.8)
	ring.name = "ring"
	root.add_child(ring)
	match g.effect:
		"SMOKE":
			var rng := RandomNumberGenerator.new()
			rng.seed = 7
			for i in 14:
				var puff := MeshInstance3D.new()
				var s := SphereMesh.new()
				s.radius = 1.4 + rng.randf() * 0.8
				s.height = s.radius * 1.6
				puff.mesh = s
				puff.material_override = _glow(Color(0.77, 0.74, 0.82), 0.55)
				var a := rng.randf() * TAU
				var rr := rng.randf() * r * 0.8
				puff.position = Vector3(cos(a) * rr, 0.9 + rng.randf() * 2.0, sin(a) * rr)
				puff.name = "puff"
				root.add_child(puff)
		"BURN", "HEAL":
			var disc := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = r
			cm.bottom_radius = r
			cm.height = 0.02 if g.effect == "BURN" else 3.0
			disc.mesh = cm
			disc.position.y = 0.0 if g.effect == "BURN" else 1.5
			disc.material_override = _glow(g.color, 0.5 if g.effect == "BURN" else 0.12)
			disc.name = "pool"
			root.add_child(disc)
		"PULL":
			var knot := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 0.5
			sm.height = 1.0
			knot.mesh = sm
			var dark := StandardMaterial3D.new()
			dark.albedo_color = Color(0.02, 0.0, 0.04)
			dark.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			knot.material_override = dark
			knot.position.y = 1.2
			knot.name = "knot"
			root.add_child(knot)

## keeps a grenade's node where it is (the canister spins in flight; zones pulse and fade out)
func _place(gr: Dictionary, dt: float) -> void:
	var n: Node3D = gr.node
	if not n or not is_instance_valid(n):
		return
	if not gr.zone:
		n.position = gr.pos
		if not gr.rest:
			n.rotation.x += dt * 14.0
		var band: Node3D = n.get_node_or_null("band")
		if band:
			var g: Dictionary = GRENADES[gr.kind]
			band.visible = (int(Time.get_ticks_msec() / 120) % 2 == 0) if (gr.armed or float(gr.fuse) < 0.5) else true
			if g.effect == "MINE" and gr.armed and not n.has_node("ring"):
				var ring := MeshInstance3D.new()
				var tm := TorusMesh.new()
				tm.inner_radius = float(g.reach) - 0.05
				tm.outer_radius = float(g.reach)
				ring.mesh = tm
				ring.material_override = _glow(g.color, 0.5)
				ring.name = "ring"
				ring.position.y = -0.06
				n.add_child(ring)
		return
	n.position = Vector3(gr.pos.x, _ground(gr.pos.x, gr.pos.z) + 0.05, gr.pos.z)
	n.rotation = Vector3.ZERO
	var g2: Dictionary = GRENADES[gr.kind]
	var knot: Node3D = n.get_node_or_null("knot")
	if knot:
		var k := 1.0 - maxf(0.0, float(gr.life)) / float(g2.duration)
		knot.scale = Vector3.ONE * (1.0 + k)
	var ring2: Node3D = n.get_node_or_null("ring")
	if ring2 and g2.effect == "PULL":
		var k2 := 1.0 - maxf(0.0, float(gr.life)) / float(g2.duration)
		ring2.scale = Vector3.ONE * (1.0 - 0.8 * k2)
	for c in n.get_children():
		if c.name.begins_with("puff"):
			c.rotate_y(dt * 0.3)
	# the last second fades the zone out
	n.visible = float(gr.life) > 0.0

## an expanding shell of the grenade's colour for half a second
func _burst(at: Vector3, r: float, c: Color) -> void:
	var m := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 1.0
	s.height = 2.0
	m.mesh = s
	var mat := _glow(c, 0.5).duplicate()
	m.material_override = mat
	m.position = at + Vector3(0, 0.3, 0)
	m.scale = Vector3.ONE * 0.2
	add_child(m)
	_fx.append({ "node": m, "t": 0.0, "life": 0.5, "r": r, "mat": mat })
	if gunplay.player:
		Sound.sfx_at("explosion", at, gunplay.player.position, -3.0)

func _step_fx(dt: float) -> void:
	for f in _fx.duplicate():
		f.t += dt
		var k: float = f.t / f.life
		if k >= 1.0:
			f.node.queue_free()
			_fx.erase(f)
			continue
		f.node.scale = Vector3.ONE * maxf(0.2, f.r * (0.25 + 0.75 * sqrt(k)))
		(f.mat as StandardMaterial3D).albedo_color.a = 0.5 * (1.0 - k)

## the HUD line: name, charges and the recharge (0..1) of the next charge
func hud() -> Dictionary:
	var g := def()
	return { "name": g.name, "charges": int(pouch.charges), "max": int(g.charges), "recharge": float(pouch.recharge) / float(g.cooldown), "color": g.color }
