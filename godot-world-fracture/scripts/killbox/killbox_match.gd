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
## The view feeds `tick` presence counts (who stands in each zone / on the objective) and the alive counts.

const ZONE_RADIUS := 7.0
const ZONE_CAPTURE_S := 5.0
const ZONE_TICK_S := 2.0
const ROUND_ZONE_S := 10.0
const ROUND_PAUSE := 3.0

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

func _init(m: Dictionary, zone_spots: Array = []) -> void:
	mode = m
	kind = String(m.get("kind", "team"))
	for z in zone_spots:
		zones.append({ "id": String(z.id), "dx": float(z.dx), "dz": float(z.dz), "cap": 0.0, "owner": -1 })

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
	if kind == "rounds":
		if by_player:
			player_kills += 1
		return   # rounds are won by wipes and objectives, not kills
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
func tick(dt: float, presence: Dictionary = {}, alive_us := 1, alive_them := 1) -> void:
	round_reset = false
	if over:
		return
	clock += dt
	match kind:
		"zones":
			_step_zones(dt, presence)
		"rounds":
			_step_rounds(dt, presence, alive_us, alive_them)
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
