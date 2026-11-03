extends RefCounted
## A race's state (pure): who is where round the track, laps, lap times, positions, the finish and the prize. Cars are
## entries {name, player, laps, frac, last_frac, lap_start, last_lap, best_lap, finished_at}; `tick` reads each car's position
## from the track. Laps count when a car crosses the start line forwards (frac wraps from high to low), never backwards.

const Track := preload("res://scripts/racing/track.gd")

var track: Track
var laps_to_go := 3
var entries: Array = []
var time := 0.0
var started := false
var finished := false
var results: Array = []

func _init(t: Track, laps := 3) -> void:
	track = t
	laps_to_go = laps

func add(name: String, player := false) -> Dictionary:
	var e := { "name": name, "player": player, "laps": 0, "frac": 0.0, "last_frac": 0.0, "lap_start": 0.0, "last_lap": 0.0, "best_lap": 0.0, "finished_at": -1.0, "armed": false }
	entries.append(e)
	return e

func start() -> void:
	started = true
	time = 0.0
	for e in entries:
		e.lap_start = 0.0
		e.armed = false

## `positions`: one world position per entry, in order
func tick(dt: float, positions: Array) -> void:
	if not started or finished:
		return
	time += dt
	for i in entries.size():
		var e: Dictionary = entries[i]
		if e.finished_at >= 0.0:
			continue
		var f: float = track.progress(positions[i])
		# arm once the car has gone a tenth of a lap, so the grid start (just behind the line) doesn't count as a lap
		if f > 0.1 and f < 0.9:
			e.armed = true
		if e.armed and e.last_frac > 0.8 and f < 0.2:
			e.laps += 1
			e.last_lap = time - e.lap_start
			e.best_lap = e.last_lap if e.best_lap <= 0.0 else minf(e.best_lap, e.last_lap)
			e.lap_start = time
			e.armed = false
			if e.laps >= laps_to_go:
				e.finished_at = time
				results.append(e)
		e.last_frac = f
		e.frac = f
	var done := true
	for e in entries:
		if e.finished_at < 0.0:
			done = false
	if done:
		finished = true

## running order: finishers by finish time, then by laps and lap fraction
func order() -> Array:
	var list := entries.duplicate()
	list.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if a.finished_at >= 0.0 and b.finished_at >= 0.0:
			return a.finished_at < b.finished_at
		if a.finished_at >= 0.0:
			return true
		if b.finished_at >= 0.0:
			return false
		if a.laps != b.laps:
			return a.laps > b.laps
		return a.frac > b.frac)
	return list

func position_of(e: Dictionary) -> int:
	return order().find(e) + 1

func player() -> Dictionary:
	for e in entries:
		if e.player:
			return e
	return {}

## the Nex the player takes home by finishing place (the track's prize table)
func prize() -> int:
	var p := player()
	if p.is_empty() or p.finished_at < 0.0:
		return 0
	var table: Array = track.def.prize
	var place := position_of(p)
	return int(table[mini(place - 1, table.size() - 1)])
