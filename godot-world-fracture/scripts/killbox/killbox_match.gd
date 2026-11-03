extends RefCounted
## A Killbox match's score (pure): two teams, kills per team, the mode's target and clock, who won. Clash counts every
## elimination for the killer's team, first to `target` or the higher score at the time limit (src/game/pvp.ts).

var mode: Dictionary
var us := 0
var them := 0
var clock := 0.0
var over := false
var winner := ""
var player_kills := 0
var player_deaths := 0

func _init(m: Dictionary) -> void:
	mode = m

func target() -> int:
	return int(mode.get("target", 75))

func time_limit() -> float:
	return float(mode.get("timeLimit", 600))

## a kill for `team` (1 us, 0 them)
func score(team: int, by_player := false) -> void:
	if over:
		return
	if team == 1:
		us += 1
		if by_player:
			player_kills += 1
	else:
		them += 1
	_check()

func player_died() -> void:
	player_deaths += 1

func tick(dt: float) -> void:
	if over:
		return
	clock += dt
	if time_limit() > 0.0 and clock >= time_limit():
		_check(true)

func _check(timed := false) -> void:
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
	var left := maxf(0.0, time_limit() - clock) if time_limit() > 0.0 else clock
	return "%d:%02d" % [int(left / 60.0), int(fmod(left, 60.0))]
