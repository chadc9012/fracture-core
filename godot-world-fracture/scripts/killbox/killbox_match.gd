extends RefCounted
## A Killbox match's rules (pure, mirrors src/game/pvp.ts for a bot match where both teams are fully on the field):
##   team   Clash — every elimination scores for the killer's team; first to `target`, or the higher score at the clock
##   zones  Dominion — kills score, and zones A / B / C tick a point every ZONE_TICK_S to whoever holds them; a zone moves
##          toward the team standing in it unopposed (ZONE_CAPTURE_S), a contested zone holds; first to `target`
##   ffa    Freefall — everyone for themselves on a board; `us` is your tally, `them` the best other; first to `target`
##   rounds Lockdown — attack / defend alternates, no respawns in a round; attackers win by wiping the defenders or
##          holding the objective ROUND_ZONE_S unopposed, defenders by wiping, by the round clock, or when the attackers
##          leave the objective planted; first to `target` rounds. Ascendancy — wipe the other three; at the buzzer the
##          middle zone opens and whoever holds it takes the round; first to `target`.
##   extract Extraction — a data core drops in the middle; a team standing on it unopposed for PICK_TIME takes it, the
##          carrier runs it to their own pad (PAD_RADIUS), it drops where the carrier goes down, lies RESET_AFTER then goes
##          home; kills do not score; first to `target` extractions (pvp.ts stepExtract).
## The view feeds `tick` presence counts (who stands in each zone / on the objective) and the alive counts; Extraction
## feeds `units` instead: [{id, team (1 us / 0 them), x, z, alive}] — the operator is "player".

const ZONE_RADIUS := 7.0
const ZONE_CAPTURE_S := 5.0
const ZONE_TICK_S := 2.0
const ROUND_ZONE_S := 10.0
const ROUND_PAUSE := 3.0
const PICK_RADIUS := 2.5
const PICK_TIME := 1.2
const PAD_RADIUS := 4.0
const RESET_AFTER := 15.0

var mode: Dictionary
var kind := "team"
var us := 0
var them := 0
var clock := 0.0
var over := false
var winner := ""
var player_kills := 0
var player_deaths := 0
## zones: [{id, dx, dz, cap (-1..1), owner (-1 none / 0 them / 1 us)}]
var zones: Array = []
## ffa: tally per fighter id ("you" and the bots' names)
var board := {}
## rounds
var round := 1
var round_clock := 0.0
var us_rounds := 0
var them_rounds := 0
var attacking := true
var plant := 0.0
var zone_hold := 0.0
var round_over := 0.0
var reason := ""
## set for one frame when a round ends, so the view can respawn everyone
var round_reset := false
## extract: the core — where it lies, who holds it (-1 none / 0 them / 1 us), which unit carries it, pickup progress
## (+ toward us, − toward them), how long it has lain away from home; `home` and the two pads in arena space
var core := { "x": 0.0, "z": 0.0, "holder": -1, "carrier": "", "pick": 0.0, "idle": 0.0, "home": Vector2.ZERO, "pad_us": Vector2.ZERO, "pad_them": Vector2.ZERO }
## the last thing that happened to the core, for the HUD and the toasts (cleared by the view)
var core_event := ""

func _init(m: Dictionary, zone_spots: Array = []) -> void:
	mode = m
	kind = String(m.get("kind", "team"))
	for z in zone_spots:
		zones.append({ "id": String(z.id), "dx": float(z.dx), "dz": float(z.dz), "cap": 0.0, "owner": -1 })

## Extraction's sites (killbox-arenas.ts extractionSites): the core drops at `home`, each team extracts at its pad
func set_sites(home: Vector2, pad_us: Vector2, pad_them: Vector2) -> void:
	core.home = home
	core.pad_us = pad_us
	core.pad_them = pad_them
	core.x = home.x
	core.z = home.y

func target() -> int:
	return int(mode.get("target", 75))

func time_limit() -> float:
	return float(mode.get("timeLimit", 600))

func round_time() -> float:
	return float(mode.get("roundTime", 90))

func is_rounds() -> bool:
	return kind == "rounds"

## a kill for `team` (1 us, 0 them); ffa passes the killer's board id in `who`
func score(team: int, by_player := false, who := "") -> void:
	if over or round_over > 0.0:
		return
	if kind == "ffa":
		var id := "you" if by_player else who
		if id != "":
			board[id] = int(board.get(id, 0)) + 1
		if by_player:
			player_kills += 1
		_ffa_totals()
		_check()
		return
	if kind == "rounds" or kind == "extract":
		if by_player:
			player_kills += 1
		return   # rounds are won by wipes and objectives, Extraction by the core, not kills
	if team == 1:
		us += 1
		if by_player:
			player_kills += 1
	else:
		them += 1
	_check()

func player_died() -> void:
	player_deaths += 1

func _ffa_totals() -> void:
	us = int(board.get("you", 0))
	var best := 0
	for k in board:
		if k != "you":
			best = maxi(best, int(board[k]))
	them = best

## one frame. `presence`: zone id → {us, them} standing in it (zones) or the objective's counts under "obj" (rounds);
## `alive_us` / `alive_them` the fighters standing this round (rounds).
func tick(dt: float, presence: Dictionary = {}, alive_us := 1, alive_them := 1, units: Array = []) -> void:
	round_reset = false
	if over:
		return
	clock += dt
	match kind:
		"zones":
			_step_zones(dt, presence)
		"rounds":
			_step_rounds(dt, presence, alive_us, alive_them)
		"extract":
			_step_extract(dt, units)
	if time_limit() > 0.0 and clock >= time_limit():
		_check(true)

func _step_zones(dt: float, presence: Dictionary) -> void:
	for z in zones:
		var p: Dictionary = presence.get(z.id, { "us": 0, "them": 0 })
		var pu := int(p.get("us", 0))
		var pt := int(p.get("them", 0))
		if pu > 0 and pt == 0:
			z.cap = minf(1.0, float(z.cap) + dt / ZONE_CAPTURE_S * mini(2, pu))
		elif pt > 0 and pu == 0:
			z.cap = maxf(-1.0, float(z.cap) - dt / ZONE_CAPTURE_S * mini(2, pt))
		if float(z.cap) >= 1.0:
			z.owner = 1
		elif float(z.cap) <= -1.0:
			z.owner = 0
	var before := int(floor((clock - dt) / ZONE_TICK_S))
	var now := int(floor(clock / ZONE_TICK_S))
	if now > before:
		for z in zones:
			if int(z.owner) == 1:
				us += 1
			elif int(z.owner) == 0:
				them += 1
		_check()

func held(team: int) -> int:
	var n := 0
	for z in zones:
		if int(z.owner) == team:
			n += 1
	return n

func _end_round(won: bool, why: String) -> void:
	if won:
		us_rounds += 1
	else:
		them_rounds += 1
	reason = why
	round_over = ROUND_PAUSE
	round += 1
	round_clock = 0.0
	plant = 0.0
	zone_hold = 0.0
	if String(mode.id) == "lockdown":
		attacking = not attacking
	us = us_rounds
	them = them_rounds
	round_reset = true
	_check()

func _step_rounds(dt: float, presence: Dictionary, alive_us: int, alive_them: int) -> void:
	if round_over > 0.0:
		round_over = maxf(0.0, round_over - dt)
		return
	round_clock += dt
	var p: Dictionary = presence.get("obj", { "us": 0, "them": 0 })
	var on_us := int(p.get("us", 0)) > 0
	var on_them := int(p.get("them", 0)) > 0
	if round_clock > 1.0:
		if alive_us == 0:
			_end_round(false, "Your team went down")
			return
		if alive_them == 0:
			_end_round(true, "Rivals wiped")
			return
	var rt := round_time()
	if String(mode.id) == "lockdown":
		if attacking:
			if on_us and not on_them:
				zone_hold += dt
			else:
				zone_hold = maxf(0.0, zone_hold - dt)
			if zone_hold >= ROUND_ZONE_S:
				_end_round(true, "Objective secured")
			elif round_clock >= rt:
				_end_round(false, "Out of time")
		else:
			if on_them and not on_us:
				plant += dt / 12.0
			else:
				plant = maxf(0.0, plant - dt / 6.0)
			if plant >= 1.0:
				_end_round(false, "The objective fell")
			elif round_clock >= rt:
				_end_round(true, "Held the line")
		return
	# Ascendancy: at the buzzer the middle zone decides it
	if round_clock >= rt:
		if on_us and not on_them:
			zone_hold += dt
		elif on_them and not on_us:
			plant += dt / 15.0
		if zone_hold >= ROUND_ZONE_S:
			_end_round(true, "Zone captured")
		elif plant >= 1.0:
			_end_round(false, "They took the zone")

## Extraction, one frame (pvp.ts stepExtract): `units` are everyone on the field
func _step_extract(dt: float, units: Array) -> void:
	var c := core
	if int(c.holder) >= 0:
		var k: Dictionary = {}
		for u in units:
			if String(u.id) == String(c.carrier):
				k = u
		if k.is_empty() or not bool(k.alive):
			_drop_core(float(c.x), float(c.z))
			core_event = "Core dropped"
			reason = core_event
			return
		c.x = float(k.x)
		c.z = float(k.z)
		var pad: Vector2 = c.pad_us if int(c.holder) == 1 else c.pad_them
		if Vector2(float(k.x) - pad.x, float(k.z) - pad.y).length() < PAD_RADIUS:
			_extract(int(c.holder))
		return
	var near_us: Array = []
	var near_them: Array = []
	for u in units:
		if bool(u.alive) and Vector2(float(u.x) - float(c.x), float(u.z) - float(c.z)).length() < PICK_RADIUS:
			if int(u.team) == 1:
				near_us.append(u)
			else:
				near_them.append(u)
	if not near_us.is_empty() and near_them.is_empty():
		c.pick = maxf(0.0, float(c.pick)) + dt
	elif not near_them.is_empty() and near_us.is_empty():
		c.pick = minf(0.0, float(c.pick)) - dt
	elif near_us.is_empty() and near_them.is_empty():
		c.pick = 0.0
	if absf(float(c.pick)) >= PICK_TIME:
		var team: Array = near_us if float(c.pick) > 0.0 else near_them
		var by: Dictionary = team[0]
		for q in team:
			if Vector2(float(q.x) - float(c.x), float(q.z) - float(c.z)).length() < Vector2(float(by.x) - float(c.x), float(by.z) - float(c.z)).length():
				by = q
		c.holder = int(by.team)
		c.carrier = String(by.id)
		c.pick = 0.0
		c.idle = 0.0
		core_event = "Core taken" if int(by.team) == 1 else "They have the core"
		reason = core_event
		return
	# a core lying away from home goes back after a while untouched
	var home: Vector2 = c.home
	if near_us.is_empty() and near_them.is_empty() and Vector2(float(c.x) - home.x, float(c.z) - home.y).length() > 1.0:
		c.idle = float(c.idle) + dt
		if float(c.idle) >= RESET_AFTER:
			_drop_core(home.x, home.y)
			core_event = "Core reset"
			reason = core_event
	else:
		c.idle = 0.0

func _drop_core(x: float, z: float) -> void:
	core.x = x
	core.z = z
	core.holder = -1
	core.carrier = ""
	core.pick = 0.0
	core.idle = 0.0

func _extract(team: int) -> void:
	if team == 1:
		us += 1
	else:
		them += 1
	core_event = "Core extracted" if team == 1 else "They extracted the core"
	reason = core_event
	var home: Vector2 = core.home
	_drop_core(home.x, home.y)
	_check()

## where the core lies or rides, arena space
func core_at() -> Vector2:
	return Vector2(float(core.x), float(core.z))

## the HUD line for Extraction
func core_text() -> String:
	var c := core
	var home: Vector2 = c.home
	if int(c.holder) < 0:
		return "core dropped" if Vector2(float(c.x) - home.x, float(c.z) - home.y).length() > 1.0 else "core in the middle"
	if String(c.carrier) == "player":
		return "YOU HAVE THE CORE — get it home"
	return "your team carries the core" if int(c.holder) == 1 else "THEY HAVE THE CORE — stop the carrier"

## the objective is live: a Lockdown round always, an Ascendancy round once the buzzer has gone
func objective_open() -> bool:
	if kind != "rounds":
		return false
	return String(mode.id) == "lockdown" or round_clock >= round_time()

func _check(timed := false) -> void:
	if over:
		return
	if us >= target() or (timed and us > them):
		over = true
		winner = "us"
	elif them >= target() or (timed and them > us):
		over = true
		winner = "them"
	elif timed:
		over = true
		winner = "draw"

func clock_text() -> String:
	if kind == "rounds":
		var left := maxf(0.0, round_time() - round_clock)
		return "R%d  %d:%02d" % [round, int(left / 60.0), int(fmod(left, 60.0))]
	var left2 := maxf(0.0, time_limit() - clock) if time_limit() > 0.0 else clock
	return "%d:%02d" % [int(left2 / 60.0), int(fmod(left2, 60.0))]
