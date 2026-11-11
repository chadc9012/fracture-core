extends RefCounted
## A race over a long route (route.gd): checkpoints in order, laps on a circuit, a finish at the end of a stage, the
## running order, the prize and the police heat. Pure state; the view moves the cars and calls `tick` with where they are.
##
## Each entry keeps `hint` (its last distance along the road, so route.gd searches a small window round it), `lap`,
## `next` (the checkpoint it must reach next) and `along`. A checkpoint counts only when the car reaches it in order and
## close to the road (`MISS_M`): driving off across country past one doesn't count, and the car is told it missed it.

const Route := preload("res://scripts/racing/route.gd")
const MISS_M := 60.0     # a car further than this off the road at a checkpoint has missed it

var route: Route
var laps_to_go := 1
var entries: Array = []
var time := 0.0
var started := false
var finished := false
var results: Array = []
var heat := 0.0          # police heat 0..5 (routes with pursuits): rises with speed through traffic, falls when clean
var busted := false

func _init(r: Route, laps := -1) -> void:
	route = r
	laps_to_go = r.laps() if laps <= 0 else (laps if r.closed else 1)

func add(name: String, player := false) -> Dictionary:
	var e := { "name": name, "player": player, "lap": 0, "next": 0, "along": 0.0, "hint": -1.0, "side": 0.0,
		"finished_at": -1.0, "missed": false, "cp_times": [] }
	entries.append(e)
	return e

func start() -> void:
	started = true
	time = 0.0

## how far a car has come, for the running order: laps done plus the distance into this lap (a car still behind the line
## on the grid counts as just short of the start)
func progress(e: Dictionary) -> float:
	var a: float = e.along
	if route.closed and int(e.next) == 0 and a > route.length * 0.5:
		a -= route.length
	return float(e.lap) * route.length + a

## `positions`: one world position per entry, in order
func tick(dt: float, positions: Array) -> void:
	for i in entries.size():
		var e: Dictionary = entries[i]
		var n: Array = route.nearest_from(positions[i], float(e.hint))
		e.hint = float(n[0])
		e.along = float(n[0])
		e.side = float(n[1])
	if not started or finished:
		return
	time += dt
	var cps := route.checkpoints
	for e in entries:
		if float(e.finished_at) >= 0.0:
			continue
		var nx: int = e.next
		if nx < cps.size():
			var target := cps[nx]
			# reached, in order, on the road (circuits: checkpoint 0 is the line itself, reached by wrapping)
			var reached := float(e.along) >= target - 2.0 and float(e.along) - target < 400.0
			if route.closed and nx == 0:
				reached = false
				e.next = 1     # the start line is where the grid is: the first checkpoint to make is the next one
			elif reached:
				if float(e.side) > route.width * 0.5 + MISS_M:
					e.missed = true
				else:
					e.missed = false
					e.next = nx + 1
					(e.cp_times as Array).append(time)
		if not route.closed:
			if int(e.next) >= cps.size() and float(e.along) >= route.length - 5.0:
				_finish(e)
		elif int(e.next) >= cps.size() and float(e.along) < route.length * 0.2:
			# every checkpoint made and over the line: a lap
			e.lap = int(e.lap) + 1
			e.next = 1
			if int(e.lap) >= laps_to_go:
				_finish(e)
	var done := true
	for e in entries:
		if float(e.finished_at) < 0.0:
			done = false
	if done or busted:
		finished = true

func _finish(e: Dictionary) -> void:
	e.finished_at = time
	results.append(e)

## the police (routes that have pursuits): `speed` the player's speed (m/s), `close_calls` near misses with traffic this
## frame, `cops_near` police within reach; heat climbs with reckless driving and holds while a cruiser is close, and a car
## boxed in by cruisers at a crawl for a few seconds is busted
var _boxed := 0.0
func police(dt: float, speed: float, close_calls: int, cops_near: int) -> void:
	if not started or finished:
		return
	if speed > 45.0:
		heat += dt * 0.05
	heat += close_calls * 0.25
	if cops_near == 0:
		heat -= dt * 0.08
	heat = clampf(heat, 0.0, 5.0)
	if cops_near > 0 and speed < 4.0:
		_boxed += dt
	else:
		_boxed = maxf(0.0, _boxed - dt * 2.0)
	if _boxed > 3.0:
		busted = true
		finished = true

func order() -> Array:
	var list := entries.duplicate()
	list.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var fa := float(a.finished_at)
		var fb := float(b.finished_at)
		if fa >= 0.0 and fb >= 0.0:
			return fa < fb
		if fa >= 0.0:
			return true
		if fb >= 0.0:
			return false
		return progress(a) > progress(b))
	return list

func position_of(e: Dictionary) -> int:
	return order().find(e) + 1

func player() -> Dictionary:
	for e in entries:
		if e.player:
			return e
	return {}

## metres the player still has to drive
func remaining(e: Dictionary) -> float:
	return maxf(0.0, float(laps_to_go) * route.length - progress(e))

## the prize: scaled with the distance raced (a long stage pays like a long stage) and the place
func prize() -> int:
	var p := player()
	if p.is_empty() or float(p.finished_at) < 0.0 or busted:
		return 0
	var km := route.length * laps_to_go / 1000.0
	var place := position_of(p)
	var share: Array = [1.0, 0.55, 0.3, 0.15, 0.08]
	return int(round(km * 140.0 * float(share[mini(place - 1, share.size() - 1)]) / 10.0) * 10.0)
