extends RefCounted
## District streaming (owner's Dec 4 plan, phase 5: Active / Simulated / Frozen). The street is a run of block tiles along
## z, TILE metres each; tile 0 is the authored slice (garage, mall, casino). Whatever carries the camera — the operator or
## the driven car — is the focus, and each tile's state follows its distance in tiles from the focus tile:
##   ACTIVE    within `active_ring`: meshes stand, troopers and traffic run, boxes block
##   SIMULATED within `sim_ring`:    no meshes; traffic still ticks its positions (hidden) and the boxes stay
##   FROZEN    beyond:               nothing drawn or ticked; the tile's obstacle slots are parked out of the world
## The focus tile only changes once the focus is `HYSTERESIS` metres past a tile edge, so standing on a boundary never
## loads and unloads every frame. Pure: `update(z)` returns the tiles whose state changed; the scene applies them.

const TILE := 260.0
const HYSTERESIS := 18.0
enum State { FROZEN, SIMULATED, ACTIVE }

var min_k := -3
var max_k := 3
var active_ring := 1
var sim_ring := 2
var focus_k := 0
var states := {}   # k -> State

func _init(lo := -3, hi := 3) -> void:
	min_k = lo
	max_k = hi
	for k in range(min_k, max_k + 1):
		states[k] = State.FROZEN

static func tile_of(z: float) -> int:
	return int(floor((z + TILE * 0.5) / TILE))

static func tile_z(k: int) -> float:
	return k * TILE

## the street's z extent, every tile
func span() -> Vector2:
	return Vector2(min_k * TILE - TILE * 0.5, max_k * TILE + TILE * 0.5)

## the z extent of the tiles in `at_least` state (Vector2(lo, hi))
func extent(at_least: State) -> Vector2:
	var lo := INF
	var hi := -INF
	for k in states:
		if int(states[k]) >= int(at_least):
			lo = minf(lo, k * TILE - TILE * 0.5)
			hi = maxf(hi, k * TILE + TILE * 0.5)
	return Vector2(lo, hi)

func state(k: int) -> State:
	return states.get(k, State.FROZEN)

func desired(k: int) -> State:
	var d := absi(k - focus_k)
	if d <= active_ring:
		return State.ACTIVE
	if d <= sim_ring:
		return State.SIMULATED
	return State.FROZEN

## move the focus to z (with hysteresis) and return the tiles whose state changed, as {k: new State}.
## The first call (`force`) reports every non-frozen tile so the scene can build the start.
func update(z: float, force := false) -> Dictionary:
	var k := tile_of(z)
	if k != focus_k:
		# only cross once well past the edge, in the direction we are going
		var edge := (focus_k + (1 if k > focus_k else -1)) * TILE - (TILE * 0.5 if k > focus_k else -TILE * 0.5)
		if absf(z - edge) >= HYSTERESIS or force:
			focus_k = clampi(k, min_k, max_k)
	var changes := {}
	for t in states:
		var want := desired(t)
		if want != states[t] or (force and want != State.FROZEN):
			states[t] = want
			changes[t] = want
	return changes

func counts() -> Dictionary:
	var out := { State.FROZEN: 0, State.SIMULATED: 0, State.ACTIVE: 0 }
	for t in states:
		out[states[t]] += 1
	return out
