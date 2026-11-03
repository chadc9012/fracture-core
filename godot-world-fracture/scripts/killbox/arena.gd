extends RefCounted
## A Killbox arena as data (the owner's PvP maps board; src/game/killbox-arenas.ts exported to data/killbox.json by
## bun scripts/export-godot-killbox.ts): roofs, walkways, cover, ledges, shifters, team spawns, zones, the fracture event and
## the kill plane. Arena space: x / z metres from the arena centre, heights `top` above the street (base 0 here). `surface_at`
## is the walkable height (-INF over the street), `boxes` the solids the movers slide around (cover, parapets where a roof
## edge has nothing beyond it, the ledges between roof heights, rails). Pure; tests/killbox/arena_test.gd.

const DATA := "res://data/killbox.json"
const PARAPET := 1.1
const STEP := 0.5
const OUT := 0.4

static var _data: Dictionary = {}
static func data() -> Dictionary:
	if _data.is_empty():
		var f := FileAccess.open(DATA, FileAccess.READ)
		if f:
			var d: Variant = JSON.parse_string(f.get_as_text())
			if d is Dictionary:
				_data = d
	return _data

static func arena_ids() -> Array:
	var out: Array = []
	for a in data().get("arenas", []):
		out.append(a.id)
	return out

static func mode(id: String) -> Dictionary:
	for m in data().get("modes", []):
		if m.id == id:
			return m
	return {}

var def: Dictionary = {}

func _init(id: String) -> void:
	for a in data().get("arenas", []):
		if a.id == id:
			def = a

func ok() -> bool:
	return not def.is_empty()

static func _walk_rect(w: Dictionary) -> Rect2:
	var hx: float = float(w.length) / 2.0 if w.along == "x" else float(w.width) / 2.0
	var hz: float = float(w.length) / 2.0 if w.along == "z" else float(w.width) / 2.0
	return Rect2(float(w.x) - hx, float(w.z) - hz, hx * 2.0, hz * 2.0)

## the walkable height at an arena point, or -INF over the drop
func surface_at(x: float, z: float) -> float:
	var best := -INF
	for r in def.roofs:
		if x >= float(r.x0) and x <= float(r.x1) and z >= float(r.z0) and z <= float(r.z1):
			best = maxf(best, float(r.top))
	for w in def.walks:
		var q := _walk_rect(w)
		if x < q.position.x or x > q.end.x or z < q.position.y or z > q.end.y:
			continue
		var t: float = (x - q.position.x) / q.size.x if w.along == "x" else (z - q.position.y) / q.size.y
		best = maxf(best, float(w.top) + (float(w.topB) - float(w.top)) * t)
	return best

## the solids: cover props, parapets, ledges, the walkways' rails
func boxes() -> Array[AABB]:
	var out: Array[AABB] = []
	for c in def.cover:
		var top := surface_at(float(c.x), float(c.z))
		if top == -INF:
			top = 0.0
		out.append(AABB(Vector3(float(c.x) - float(c.w) / 2.0, top, float(c.z) - float(c.d) / 2.0), Vector3(float(c.w), float(c.h), float(c.d))))
	for l in def.ledges:
		var ax := float(l.ax); var az := float(l.az); var bx := float(l.bx); var bz := float(l.bz)
		out.append(AABB(Vector3(minf(ax, bx) - 0.15, float(l.base), minf(az, bz) - 0.15), Vector3(absf(bx - ax) + 0.3, float(l.top) - float(l.base), absf(bz - az) + 0.3)))
	for r in def.roofs:
		var top := float(r.top)
		for edge in [[float(r.x0), float(r.z0), float(r.x1), float(r.z0), 0.0, -1.0], [float(r.x0), float(r.z1), float(r.x1), float(r.z1), 0.0, 1.0], [float(r.x0), float(r.z0), float(r.x0), float(r.z1), -1.0, 0.0], [float(r.x1), float(r.z0), float(r.x1), float(r.z1), 1.0, 0.0]]:
			var ax: float = edge[0]; var az: float = edge[1]; var bx: float = edge[2]; var bz: float = edge[3]; var nx: float = edge[4]; var nz: float = edge[5]
			var len := Vector2(bx - ax, bz - az).length()
			var n := maxi(1, int(round(len / STEP)))
			var run_start := -1
			for i in n + 1:
				var t := (i + 0.5) / n
				var open: bool = i == n or surface_at(ax + (bx - ax) * t + nx * OUT, az + (bz - az) * t + nz * OUT) != -INF
				if not open and run_start < 0:
					run_start = i
				if open and run_start >= 0:
					var t0 := float(run_start) / n
					var t1 := float(i) / n
					var p0 := Vector3(ax + (bx - ax) * t0, top - 0.5, az + (bz - az) * t0)
					var p1 := Vector3(ax + (bx - ax) * t1, top + PARAPET, az + (bz - az) * t1)
					var lo := Vector3(minf(p0.x, p1.x) - 0.15, p0.y, minf(p0.z, p1.z) - 0.15)
					var hi := Vector3(maxf(p0.x, p1.x) + 0.15, p1.y, maxf(p0.z, p1.z) + 0.15)
					out.append(AABB(lo, hi - lo))
					run_start = -1
	for w in def.walks:
		if not w.rails:
			continue
		var q := _walk_rect(w)
		var top := maxf(float(w.top), float(w.topB))
		var lo_y := minf(float(w.top), float(w.topB))
		if w.along == "z":
			out.append(AABB(Vector3(q.position.x - 0.1, lo_y, q.position.y), Vector3(0.2, top - lo_y + 1.0, q.size.y)))
			out.append(AABB(Vector3(q.end.x - 0.1, lo_y, q.position.y), Vector3(0.2, top - lo_y + 1.0, q.size.y)))
		else:
			out.append(AABB(Vector3(q.position.x, lo_y, q.position.y - 0.1), Vector3(q.size.x, top - lo_y + 1.0, 0.2)))
			out.append(AABB(Vector3(q.position.x, lo_y, q.end.y - 0.1), Vector3(q.size.x, top - lo_y + 1.0, 0.2)))
	return out

## a team's spawn point, the one furthest from `threats`
func spawn(side: String, threats: Array = [], pick := 0) -> Vector3:
	var list: Array = def.spawns[side]
	var best := Vector3.ZERO
	var best_d := -1.0
	var k := 0
	for s in list:
		var p := Vector3(float(s[0]), 0, float(s[1]))
		p.y = surface_at(p.x, p.z)
		var d := 1e9
		for t in threats:
			d = minf(d, Vector2(p.x - (t as Vector3).x, p.z - (t as Vector3).z).length())
		if threats.is_empty():
			d = float((k + pick) % list.size())
		if d > best_d:
			best_d = d
			best = p
		k += 1
	return best

func kill_plane() -> float:
	return float(def.killPlane)

## the bounds the movers may roam (a little past the roofs)
func bounds() -> Rect2:
	var r := Rect2()
	var first := true
	for roof in def.roofs:
		var q := Rect2(float(roof.x0), float(roof.z0), float(roof.x1) - float(roof.x0), float(roof.z1) - float(roof.z0))
		r = q if first else r.merge(q)
		first = false
	return r.grow(6.0)
