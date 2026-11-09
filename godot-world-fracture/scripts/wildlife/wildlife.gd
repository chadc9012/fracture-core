extends RefCounted
## Wildlife rules (asset catalog: Animals & creatures, Wildlife behaviour), pure and headless-testable — a port of the web
## game's src/game/wildlife.ts with the board's extra behaviours:
##   ground prey (DEER, BOAR, RABBIT, FOX, REPTILE) cycle IDLE → GRAZE → WANDER inside a home radius, freeze at the alert
##   radius when something moves, bolt at the flee radius (sooner when it sprints); a herd shares one alarm
##   predators (WOLF, BEAR, PANTHER, CROCODILE) roam, and when prey comes into sight they STALK it slowly, CHASE when close,
##   and a catch puts the prey DOWN (it respawns at its home later) — wolves hunt as a pack (the pack shares the quarry);
##   a predator still flees a sprinting operator in its face unless it is a bear
##   nocturnal species (WOLF, PANTHER, BOAR) rest by day at home (REST) and are out by night; diurnal ones rest by night
##   RAPTOR soars in wide circles over its range and stoops onto a rabbit now and then; SONGBIRD feeds, flushes, circles,
##   lands elsewhere; FISH and SHARK school / patrol their lake, the shark hunting the fish and chasing a swimmer
## `step_all(dt, threat, night, habitat)` advances every animal; the view only draws what it finds here.

enum Loco { GROUND, BIRD, SOAR, FISH }
enum St { IDLE, GRAZE, WANDER, ALERT, FLEE, GROUND, FLY, SOAR, SWIM, STALK, CHASE, REST, DOWN }

const SPECIES := {
	"DEER": { "loco": Loco.GROUND, "walk": 1.3, "run": 9.0, "alert": 34.0, "flee": 18.0, "home": 26.0, "stride": 1.4, "stride_run": 4.2, "pause": [2.0, 6.0], "grazes": true, "predator": false, "night": false, "size": 1.0, "body": Vector3(0.6, 1.0, 1.7), "color": Color(0.55, 0.4, 0.26) },
	"BOAR": { "loco": Loco.GROUND, "walk": 1.0, "run": 7.5, "alert": 22.0, "flee": 10.0, "home": 20.0, "stride": 0.9, "stride_run": 2.4, "pause": [2.0, 7.0], "grazes": true, "predator": false, "night": true, "size": 1.0, "body": Vector3(0.6, 0.7, 1.3), "color": Color(0.25, 0.2, 0.17) },
	"RABBIT": { "loco": Loco.GROUND, "walk": 0.8, "run": 6.5, "alert": 14.0, "flee": 7.0, "home": 10.0, "stride": 0.5, "stride_run": 1.6, "pause": [1.5, 5.0], "grazes": true, "predator": false, "night": false, "size": 1.0, "body": Vector3(0.25, 0.3, 0.45), "color": Color(0.5, 0.45, 0.4) },
	"FOX": { "loco": Loco.GROUND, "walk": 1.1, "run": 7.0, "alert": 24.0, "flee": 12.0, "home": 30.0, "stride": 0.9, "stride_run": 2.4, "pause": [2.0, 5.0], "grazes": false, "predator": false, "night": false, "size": 1.0, "body": Vector3(0.3, 0.45, 1.0), "color": Color(0.8, 0.4, 0.15) },
	"REPTILE": { "loco": Loco.GROUND, "walk": 0.4, "run": 2.2, "alert": 8.0, "flee": 4.0, "home": 8.0, "stride": 0.35, "stride_run": 0.5, "pause": [3.0, 8.0], "grazes": false, "predator": false, "night": false, "size": 1.0, "body": Vector3(0.25, 0.18, 0.9), "color": Color(0.35, 0.45, 0.25) },
	"WOLF": { "loco": Loco.GROUND, "walk": 1.4, "run": 11.0, "alert": 30.0, "flee": 6.0, "home": 45.0, "stride": 1.0, "stride_run": 3.0, "pause": [2.0, 5.0], "grazes": false, "predator": true, "night": true, "sight": 42.0, "size": 1.0, "body": Vector3(0.45, 0.75, 1.4), "color": Color(0.45, 0.45, 0.48) },
	"BEAR": { "loco": Loco.GROUND, "walk": 1.0, "run": 8.5, "alert": 26.0, "flee": 0.0, "home": 35.0, "stride": 1.2, "stride_run": 3.2, "pause": [3.0, 8.0], "grazes": true, "predator": true, "night": false, "sight": 30.0, "size": 1.0, "body": Vector3(0.9, 1.3, 2.1), "color": Color(0.3, 0.2, 0.12) },
	"PANTHER": { "loco": Loco.GROUND, "walk": 1.2, "run": 13.0, "alert": 30.0, "flee": 8.0, "home": 40.0, "stride": 1.1, "stride_run": 3.4, "pause": [3.0, 9.0], "grazes": false, "predator": true, "night": true, "sight": 38.0, "size": 1.0, "body": Vector3(0.4, 0.7, 1.6), "color": Color(0.08, 0.08, 0.1) },
	"CROCODILE": { "loco": Loco.GROUND, "walk": 0.5, "run": 5.0, "alert": 14.0, "flee": 0.0, "home": 14.0, "stride": 0.6, "stride_run": 1.4, "pause": [6.0, 14.0], "grazes": false, "predator": true, "night": false, "sight": 16.0, "size": 1.0, "body": Vector3(0.6, 0.45, 3.2), "color": Color(0.25, 0.32, 0.2), "bank": true },
	"RAPTOR": { "loco": Loco.SOAR, "walk": 0.0, "run": 10.0, "alert": 0.0, "flee": 0.0, "home": 55.0, "stride": 1.0, "stride_run": 1.0, "pause": [4.0, 9.0], "grazes": false, "predator": true, "night": false, "size": 1.0, "body": Vector3(1.6, 0.2, 0.6), "color": Color(0.35, 0.25, 0.18) },
	"SONGBIRD": { "loco": Loco.BIRD, "walk": 0.5, "run": 8.0, "alert": 10.0, "flee": 7.0, "home": 34.0, "stride": 0.12, "stride_run": 1.0, "pause": [0.6, 2.4], "grazes": true, "predator": false, "night": false, "size": 1.0, "body": Vector3(0.22, 0.12, 0.2), "color": Color(0.6, 0.6, 0.65) },
	"FISH": { "loco": Loco.FISH, "walk": 0.7, "run": 3.6, "alert": 10.0, "flee": 6.0, "home": 10.0, "stride": 0.5, "stride_run": 0.9, "pause": [1.0, 3.0], "grazes": false, "predator": false, "night": false, "size": 1.0, "body": Vector3(0.15, 0.2, 0.5), "color": Color(0.5, 0.65, 0.7) },
	"SHARK": { "loco": Loco.FISH, "walk": 1.2, "run": 7.0, "alert": 0.0, "flee": 0.0, "home": 24.0, "stride": 1.0, "stride_run": 1.5, "pause": [2.0, 5.0], "grazes": false, "predator": true, "night": false, "sight": 26.0, "size": 1.0, "body": Vector3(0.6, 0.7, 3.4), "color": Color(0.3, 0.38, 0.45) },
}
const DOWN_TIME := 40.0
const RESPAWN := 150.0
const CATCH := 1.6

class Critter:
	var id := ""
	var species := "DEER"
	var group := ""
	var home := Vector2.ZERO
	var home_radius := 20.0
	var pos := Vector2.ZERO
	var alt := 0.0
	var heading := 0.0
	var speed := 0.0
	var state := St.IDLE
	var target := Vector2.ZERO
	var target_alt := 0.0
	var timer := 0.0
	var phase := 0.0
	var head_down := 0.0
	var look := 0.0
	var size := 1.0
	var down := -1.0          # seconds since it was caught / shot; < 0 = alive
	var quarry: Critter = null
	var feed := 0.0           # a predator's pause after a catch

var critters: Array[Critter] = []
var alarms := {}            # group -> {pos, until}
var clock := 0.0
var _rng := RandomNumberGenerator.new()
## kills this session: predator catches and the operator's shots
var catches := 0

func _init(seed := 7) -> void:
	_rng.seed = seed

static func profile(species: String) -> Dictionary:
	return SPECIES[species]

func spawn(species: String, home: Vector2, group := "") -> Critter:
	var p: Dictionary = SPECIES[species]
	var c := Critter.new()
	c.id = "%s-%d" % [species.to_lower(), critters.size()]
	c.species = species
	c.group = group if group != "" else c.id
	c.home = home
	c.home_radius = float(p.home)
	c.pos = home + Vector2(_rng.randf() - 0.5, _rng.randf() - 0.5) * 4.0
	var loco: int = p.loco
	c.alt = (30.0 + _rng.randf() * 15.0) if loco == Loco.SOAR else (-0.9 if loco == Loco.FISH else 0.0)
	c.heading = _rng.randf() * TAU
	c.speed = float(p.run) if loco == Loco.SOAR else 0.0
	c.state = St.SOAR if loco == Loco.SOAR else (St.SWIM if loco == Loco.FISH else (St.GROUND if loco == Loco.BIRD else St.IDLE))
	c.target = home
	c.timer = _rng.randf() * 3.0
	c.phase = _rng.randf() * TAU
	c.size = 0.85 + _rng.randf() * 0.3
	critters.append(c)
	return c

## a herd / pack / flock / school: `n` of a species sharing one group and one home
func spawn_group(species: String, home: Vector2, n: int, spread := 6.0) -> Array:
	var out: Array = []
	var g := "%s-g%d" % [species.to_lower(), critters.size()]
	for i in n:
		var c := spawn(species, home + Vector2(_rng.randf() - 0.5, _rng.randf() - 0.5) * spread * 2.0, g)
		out.append(c)
	return out

static func _ease(v: float, to: float, rate: float, dt: float) -> float:
	return v + (to - v) * minf(1.0, rate * dt)

func _pause(p: Dictionary) -> float:
	return float(p.pause[0]) + _rng.randf() * (float(p.pause[1]) - float(p.pause[0]))

func _pick_target(c: Critter, is_wet: Callable, radius := -1.0) -> void:
	var r: float = c.home_radius if radius < 0.0 else radius
	var p: Dictionary = SPECIES[c.species]
	for tries in 8:
		var a := _rng.randf() * TAU
		var d := sqrt(_rng.randf()) * r
		var t := c.home + Vector2(cos(a), sin(a)) * d
		var wet: bool = is_wet.call(t.x, t.y)
		if int(p.loco) != Loco.FISH and wet and not bool(p.get("bank", false)):
			continue
		c.target = t
		return
	c.target = c.pos

## `threat`: {pos: Vector2, speed, sprinting}; `night`: true between dusk and dawn; `is_wet(x, z) -> bool`
func step_all(dt: float, threat: Dictionary, night: bool, is_wet: Callable) -> void:
	clock += dt
	for c in critters:
		_step(c, dt, threat, night, is_wet)

func _step(c: Critter, dt: float, threat: Dictionary, night: bool, is_wet: Callable) -> void:
	var p: Dictionary = SPECIES[c.species]
	# down: lies where it fell, then a new one wanders home
	if c.down >= 0.0:
		c.down += dt
		c.speed = 0.0
		if c.down > RESPAWN:
			c.down = -1.0
			c.pos = c.home
			c.state = St.IDLE
			c.timer = _pause(p)
		return
	var tpos: Vector2 = threat.get("pos", Vector2(1e6, 1e6))
	var dist := c.pos.distance_to(tpos)
	var moving := float(threat.get("speed", 0.0)) > 0.3
	var reach := 1.8 if bool(threat.get("sprinting", false)) else 1.0
	var alarm: Variant = alarms.get(c.group)
	var group_alarm: Variant = alarm if alarm != null and float(alarm.until) > clock else null
	match int(p.loco):
		Loco.SOAR:
			_soar(c, p, dt)
			return
		Loco.FISH:
			_swim(c, p, dt, tpos, dist, moving, reach, group_alarm)
			return
		Loco.BIRD:
			_bird(c, p, dt, tpos, dist, moving, reach, group_alarm, is_wet)
			return
	# ---------- ground ----------
	# the hours: a nocturnal animal rests by day, a diurnal one by night (predators rest less deeply: they still react)
	var off_hours: bool = bool(p.night) != night
	var flee_r := float(p.flee)
	var spooked: bool = (moving and dist < flee_r * reach) or group_alarm != null
	if spooked and flee_r > 0.0:
		if c.state != St.FLEE:
			alarms[c.group] = { "pos": (group_alarm.pos if group_alarm != null else tpos), "until": clock + 4.0 }
		c.state = St.FLEE
		var from: Vector2 = group_alarm.pos if group_alarm != null else tpos
		var away := (c.pos - from)
		away = away.normalized() if away.length() > 0.001 else Vector2(1, 0)
		c.target = c.pos + away * 14.0
		var hd := c.target.distance_to(c.home)
		var lim := c.home_radius * 1.8
		if hd > lim:
			c.target = c.home + (c.target - c.home) * (lim / hd)
		c.timer = 2.5 + _rng.randf() * 2.0
		c.quarry = null
	elif bool(p.predator) and c.feed > 0.0:
		c.feed -= dt
		if c.state == St.STALK or c.state == St.CHASE:
			c.state = St.IDLE
			c.timer = _pause(p)
		c.timer -= dt
		if c.timer <= 0.0:
			c.state = St.WANDER if c.state != St.WANDER else St.IDLE
			if c.state == St.WANDER:
				_pick_target(c, is_wet)
			c.timer = _pause(p)
	elif bool(p.predator) and not off_hours and _hunt(c, p, dt, is_wet):
		pass
	elif moving and dist < float(p.alert) * reach and c.state != St.FLEE and not bool(p.predator):
		c.state = St.ALERT
		c.timer = 1.5 + _rng.randf() * 2.0
	elif c.state == St.FLEE:
		c.timer -= dt
		if c.timer <= 0.0 or c.target.distance_to(c.pos) < 0.5:
			c.state = St.ALERT
			c.timer = 1.0 + _rng.randf() * 2.0
	elif off_hours and c.state != St.REST and c.pos.distance_to(c.home) < 3.0:
		c.state = St.REST
		c.timer = 20.0 + _rng.randf() * 20.0
	elif c.state == St.REST:
		c.timer -= dt
		if not off_hours and c.timer <= 0.0:
			c.state = St.IDLE
			c.timer = _pause(p)
	else:
		c.timer -= dt
		if c.timer <= 0.0:
			if c.state == St.WANDER or c.state == St.ALERT or c.state == St.STALK or c.state == St.CHASE:
				c.state = St.GRAZE if bool(p.grazes) and _rng.randf() < 0.6 else St.IDLE
				c.timer = _pause(p)
			else:
				c.state = St.WANDER
				if off_hours:
					c.target = c.home   # heading home to rest
				else:
					_pick_target(c, is_wet)
				c.timer = 6.0 + _rng.randf() * 6.0
	var goal := 0.0
	match c.state:
		St.FLEE, St.CHASE:
			goal = float(p.run)
		St.WANDER:
			goal = float(p.walk)
		St.STALK:
			goal = float(p.walk) * 0.7
	c.speed = _ease(c.speed, goal, 4.0 if c.state == St.FLEE or c.state == St.CHASE else 2.5, dt)
	if c.speed > 0.02:
		var d := c.target - c.pos
		var dl := d.length()
		if dl > 0.2:
			var want := atan2(d.x, d.y)
			c.heading += wrapf(want - c.heading, -PI, PI) * minf(1.0, (6.0 if c.state == St.FLEE or c.state == St.CHASE else 2.5) * dt)
			var stp := minf(dl, c.speed * dt)
			var np := c.pos + Vector2(sin(c.heading), cos(c.heading)) * stp
			var wet: bool = is_wet.call(np.x, np.y)
			if wet and not bool(p.get("bank", false)):
				c.speed = 0.0
				c.target = c.pos
			else:
				c.pos = np
				c.phase += (stp / (float(p.stride_run) if goal >= float(p.run) else float(p.stride))) * TAU
		elif c.state == St.WANDER:
			c.state = St.IDLE
			c.timer = _pause(p)
	else:
		c.phase += dt * 0.6
	c.head_down = _ease(c.head_down, 1.0 if c.state == St.GRAZE or c.state == St.REST else 0.0, 2.0, dt)
	var look_want := 0.0
	if c.state == St.ALERT:
		look_want = clampf(wrapf(atan2(tpos.x - c.pos.x, tpos.y - c.pos.y) - c.heading, -PI, PI), -1.2, 1.2)
	c.look = _ease(c.look, look_want, 4.0, dt)

## a predator's hunt: pick the nearest live prey in sight (a pack shares its leader's quarry), stalk it slowly, chase
## inside 12 m, catch at CATCH. Returns true while hunting.
func _hunt(c: Critter, p: Dictionary, dt: float, is_wet: Callable) -> bool:
	var sight := float(p.get("sight", 30.0))
	if c.quarry == null or c.quarry.down >= 0.0:
		c.quarry = null
		# the pack: another hunter of the group already has a quarry
		for o in critters:
			if o != c and o.group == c.group and o.quarry != null and o.quarry.down < 0.0:
				c.quarry = o.quarry
				break
		if c.quarry == null:
			var best_d := sight
			for o in critters:
				if o == c or o.down >= 0.0 or bool(SPECIES[o.species].predator) or int(SPECIES[o.species].loco) != Loco.GROUND:
					continue
				var d := c.pos.distance_to(o.pos)
				if d < best_d:
					best_d = d
					c.quarry = o
		if c.quarry == null:
			if c.state == St.STALK or c.state == St.CHASE:
				c.state = St.IDLE
				c.timer = _pause(p)
			return false
	var q: Critter = c.quarry
	var d := c.pos.distance_to(q.pos)
	if d > sight * 1.5:
		c.quarry = null
		c.state = St.IDLE
		c.timer = _pause(p)
		return false
	c.target = q.pos
	if d < CATCH:
		q.down = 0.0
		q.state = St.DOWN
		q.speed = 0.0
		catches += 1
		c.quarry = null
		c.state = St.IDLE
		c.timer = 8.0 + _rng.randf() * 6.0   # feeds
		c.feed = 40.0 + _rng.randf() * 30.0
		return true
	if d < 12.0 or c.state == St.CHASE:
		c.state = St.CHASE
		# the prey notices a charging predator: its herd bolts
		alarms[q.group] = { "pos": c.pos, "until": clock + 4.0 }
	else:
		c.state = St.STALK
	return true

func _bird(c: Critter, p: Dictionary, dt: float, tpos: Vector2, dist: float, moving: bool, reach: float, group_alarm: Variant, is_wet: Callable) -> void:
	if c.state == St.GROUND:
		if (moving and dist < float(p.flee) * reach) or group_alarm != null:
			alarms[c.group] = { "pos": tpos, "until": clock + 2.0 }
			c.state = St.FLY
			c.target_alt = 8.0 + _rng.randf() * 10.0
			c.timer = 5.0 + _rng.randf() * 6.0
			_pick_target(c, is_wet)
		else:
			c.timer -= dt
			if c.timer <= 0.0:
				c.heading += (_rng.randf() - 0.5) * 2.0
				var hop := 0.25 + _rng.randf() * 0.3
				c.pos += Vector2(sin(c.heading), cos(c.heading)) * hop
				c.timer = _pause(p)
			c.head_down = _ease(c.head_down, 1.0 if sin(clock * 3.0 + c.phase) > 0.3 else 0.0, 10.0, dt)
			c.alt = _ease(c.alt, 0.0, 6.0, dt)
			c.speed = 0.0
		c.phase += dt * 2.0
		return
	c.timer -= dt
	var d := c.target - c.pos
	if d.length() < 3.0:
		_pick_target(c, is_wet)
	c.heading += wrapf(atan2(d.x, d.y) - c.heading, -PI, PI) * minf(1.0, 2.0 * dt)
	c.speed = _ease(c.speed, float(p.run), 2.0, dt)
	c.pos += Vector2(sin(c.heading), cos(c.heading)) * c.speed * dt
	var landing: bool = c.timer <= 0.0 and not (moving and dist < float(p.alert) * 2.0)
	c.alt = _ease(c.alt, 0.0 if landing else c.target_alt, 0.9 if landing else 1.5, dt)
	c.phase += dt * 16.0
	c.head_down = 0.0
	if landing and c.alt < 0.15 and bool(is_wet.call(c.pos.x, c.pos.y)):
		c.timer = 2.0
		_pick_target(c, is_wet)
	elif landing and c.alt < 0.15:
		c.state = St.GROUND
		c.alt = 0.0
		c.speed = 0.0
		c.timer = 1.0 + _rng.randf() * 2.0

## raptors: wide circles over the range; now and then a stoop onto a rabbit below
func _soar(c: Critter, p: Dictionary, dt: float) -> void:
	c.timer -= dt
	if c.timer <= 0.0:
		c.target_alt = 26.0 + _rng.randf() * 22.0
		c.timer = _pause(p)
		# a hunt: the nearest rabbit within the range becomes the stoop target
		if bool(p.predator) and _rng.randf() < 0.35:
			for o in critters:
				if o.species == "RABBIT" and o.down < 0.0 and o.pos.distance_to(c.home) < c.home_radius:
					c.quarry = o
					break
	if c.quarry != null and c.quarry.down < 0.0:
		var q: Critter = c.quarry
		var d := q.pos - c.pos
		c.heading += wrapf(atan2(d.x, d.y) - c.heading, -PI, PI) * minf(1.0, 3.0 * dt)
		c.speed = float(p.run) * 1.8
		c.pos += Vector2(sin(c.heading), cos(c.heading)) * c.speed * dt
		c.alt = _ease(c.alt, 1.0, 1.2, dt)
		c.phase += dt * 0.5
		if d.length() < 2.5 and c.alt < 3.0:
			q.down = 0.0
			q.state = St.DOWN
			catches += 1
			c.quarry = null
			c.target_alt = 30.0
		elif c.alt < 1.5:
			c.quarry = null   # missed: climb away
		return
	c.quarry = null
	var o := c.pos - c.home
	var r := maxf(o.length(), 1.0)
	var tangent := atan2(o.y, -o.x)
	var pull := (r - c.home_radius) / c.home_radius
	var want := tangent + clampf(pull, -0.8, 0.8) * (PI / 2.0)
	c.heading += wrapf(want - c.heading, -PI, PI) * minf(1.0, 0.9 * dt)
	c.speed = float(p.run)
	c.pos += Vector2(sin(c.heading), cos(c.heading)) * c.speed * dt
	c.alt = _ease(c.alt, c.target_alt if c.target_alt > 0.0 else c.alt, 0.3, dt)
	c.phase += dt * 1.2

## fish school in their lake and dart from a swimmer; a shark patrols and hunts them (and a swimmer in reach)
func _swim(c: Critter, p: Dictionary, dt: float, tpos: Vector2, dist: float, moving: bool, reach: float, group_alarm: Variant) -> void:
	var scared: bool = not bool(p.predator) and ((moving and dist < float(p.flee) * reach) or group_alarm != null)
	if scared:
		if group_alarm == null:
			alarms[c.group] = { "pos": tpos, "until": clock + 1.5 }
		var from: Vector2 = group_alarm.pos if group_alarm != null else tpos
		var away := (c.pos - from)
		away = away.normalized() if away.length() > 0.001 else Vector2(1, 0)
		c.target = c.pos + away * 6.0
	elif bool(p.predator) and c.feed > 0.0:
		c.feed -= dt
		c.state = St.SWIM
		c.timer -= dt
		if c.timer <= 0.0 or c.target.distance_to(c.pos) < 0.6:
			_pick_target(c, func(_x: float, _z: float) -> bool: return false)
			c.timer = _pause(p)
	elif bool(p.predator):
		# the shark: the nearest fish in sight, or the swimmer within the lake
		var best: Critter = null
		var best_d := float(p.get("sight", 26.0))
		if dist < best_d and tpos.distance_to(c.home) < c.home_radius:
			best_d = dist
		for o in critters:
			if o != c and o.down < 0.0 and int(SPECIES[o.species].loco) == Loco.FISH and not bool(SPECIES[o.species].predator):
				var d := c.pos.distance_to(o.pos)
				if d < best_d:
					best_d = d
					best = o
		if best != null:
			c.target = best.pos
			c.state = St.CHASE
			alarms[best.group] = { "pos": c.pos, "until": clock + 1.5 }
			if c.pos.distance_to(best.pos) < CATCH:
				best.down = 0.0
				best.state = St.DOWN
				catches += 1
				c.state = St.SWIM
				c.timer = 6.0
				c.feed = 25.0 + _rng.randf() * 20.0
		elif best_d == dist and dist < float(p.get("sight", 26.0)):
			c.target = tpos
			c.state = St.CHASE
		else:
			c.state = St.SWIM
			c.timer -= dt
			if c.timer <= 0.0 or c.target.distance_to(c.pos) < 0.6:
				_pick_target(c, func(_x: float, _z: float) -> bool: return false)
				c.timer = _pause(p)
				c.target_alt = -0.8 - _rng.randf() * 1.5
	else:
		c.timer -= dt
		if c.timer <= 0.0 or c.target.distance_to(c.pos) < 0.4:
			_pick_target(c, func(_x: float, _z: float) -> bool: return false)
			c.timer = _pause(p)
			c.target_alt = -0.5 - _rng.randf() * 1.2
	var hd := c.target.distance_to(c.home)
	if hd > c.home_radius:
		c.target = c.home + (c.target - c.home) * (c.home_radius / hd)
	var d := c.target - c.pos
	var dl := d.length()
	var fast: bool = scared or c.state == St.CHASE
	c.speed = _ease(c.speed, float(p.run) if fast else (float(p.walk) if dl > 0.4 else 0.1), 6.0 if fast else 1.5, dt)
	if dl > 0.05:
		c.heading += wrapf(atan2(d.x, d.y) - c.heading, -PI, PI) * minf(1.0, (8.0 if fast else 2.0) * dt)
	c.pos += Vector2(sin(c.heading), cos(c.heading)) * c.speed * dt
	c.alt = _ease(c.alt, c.target_alt if c.target_alt != 0.0 else -0.9, 0.8, dt)
	c.phase += dt * (3.0 + c.speed * 5.0)

## the operator shot one: it drops where it stands
func shoot(c: Critter) -> void:
	if c.down < 0.0:
		c.down = 0.0
		c.state = St.DOWN
		c.speed = 0.0
		catches += 1

func alive(species := "") -> int:
	var n := 0
	for c in critters:
		if c.down < 0.0 and (species == "" or c.species == species):
			n += 1
	return n
