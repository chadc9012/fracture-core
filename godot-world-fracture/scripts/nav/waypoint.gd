extends RefCounted
## The map's waypoint and where you last stood (Nov 18, the owner: "set way points from map … like Destiny and GTA"):
## one waypoint at a time, on one region map — set from region_map.gd (tap a place or the ground → SET WAYPOINT),
## shown in the region you walk (waypoint_beacon.gd: a light beam on the spot, the distance and an arrow on the HUD)
## and on the map with the road route to it from you (route()). `here` is where you were last on foot in a region, so
## the map can show YOU. Map coordinates (the region maps' x / z, not a view's local ones). Saved in user://nav.json.

const SAVE := "user://nav.json"

static func _load() -> Dictionary:
	var f := FileAccess.open(SAVE, FileAccess.READ)
	if f:
		var v: Variant = JSON.parse_string(f.get_as_text())
		if v is Dictionary:
			return v
	return {}

static func _save(d: Dictionary) -> void:
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))

## {map, x, z, name} or {}
static func get_waypoint() -> Dictionary:
	var w: Variant = _load().get("waypoint", {})
	return w if w is Dictionary else {}

static func set_waypoint(map_id: String, x: float, z: float, name := "") -> void:
	var d := _load()
	d.waypoint = { "map": map_id, "x": snappedf(x, 0.1), "z": snappedf(z, 0.1), "name": name }
	_save(d)

static func clear_waypoint() -> void:
	var d := _load()
	d.erase("waypoint")
	_save(d)

## {map, x, z, yaw} or {}
static func get_here() -> Dictionary:
	var h: Variant = _load().get("here", {})
	return h if h is Dictionary else {}

static func set_here(map_id: String, x: float, z: float, yaw := 0.0) -> void:
	var d := _load()
	d.here = { "map": map_id, "x": snappedf(x, 0.1), "z": snappedf(z, 0.1), "yaw": snappedf(yaw, 0.01) }
	_save(d)

## the road route from `a` to `b` on a map (both Vector2 map x / z): along the map's roads where they go (a graph of the
## roads' points, joined where roads meet), straight on from the road's nearest point at each end. [] when the map has
## no roads; then the line is drawn straight.
static func route(m: Dictionary, a: Vector2, b: Vector2) -> PackedVector2Array:
	var pts: Array[Vector2] = []
	var adj: Array = []
	var road_of: Array[int] = []
	var ri := 0
	for r in m.get("roads", []):
		if String(r.get("cls", "")) in ["powerline", "ferry", "rail", "runway", "taxiway", "race"]:
			ri += 1
			continue
		var prev := -1
		for q in r.pts:
			var i := pts.size()
			pts.append(Vector2(float(q[0]), float(q[1])))
			adj.append([])
			road_of.append(ri)
			if prev >= 0:
				adj[prev].append(i)
				adj[i].append(prev)
			prev = i
		ri += 1
	# the city's streets (the paved "street" strips): their centre lines, sampled every 6 m
	for pv in m.get("pavements", []):
		if String(pv[5]) != "street":
			continue
		var cx := float(pv[0])
		var cz := float(pv[1])
		var hx := float(pv[2])
		var hz := float(pv[3])
		var yaw := float(pv[4])
		var along := Vector2(cos(yaw), -sin(yaw)) if hx >= hz else Vector2(sin(yaw), cos(yaw))
		var half := maxf(hx, hz)
		var n := maxi(1, int(half * 2.0 / 6.0))
		var prev2 := -1
		for k in n + 1:
			var q := Vector2(cx, cz) + along * lerpf(-half, half, float(k) / n)
			var i2 := pts.size()
			pts.append(q)
			adj.append([])
			road_of.append(ri)
			if prev2 >= 0:
				adj[prev2].append(i2)
				adj[i2].append(prev2)
			prev2 = i2
		ri += 1
	if pts.size() < 2:
		return PackedVector2Array()
	# where roads meet: points of different roads within 9 m are joined (a grid of 12 m cells)
	var grid := {}
	for i in pts.size():
		var key := Vector2i(int(floor(pts[i].x / 12.0)), int(floor(pts[i].y / 12.0)))
		if not grid.has(key):
			grid[key] = []
		grid[key].append(i)
	for i in pts.size():
		var c := Vector2i(int(floor(pts[i].x / 12.0)), int(floor(pts[i].y / 12.0)))
		for dx in [-1, 0, 1]:
			for dz in [-1, 0, 1]:
				for j in grid.get(c + Vector2i(dx, dz), []):
					if j > i and road_of[j] != road_of[i] and pts[i].distance_to(pts[j]) < 8.0:
						adj[i].append(j)
						adj[j].append(i)
	var s := _nearest(pts, a)
	var t := _nearest(pts, b)
	# A*
	var g := {s: 0.0}
	var came := {}
	var open := [s]
	var closed := {}
	while not open.is_empty():
		var best := 0
		var bf := INF
		for k in open.size():
			var f: float = float(g[open[k]]) + pts[open[k]].distance_to(pts[t])
			if f < bf:
				bf = f
				best = k
		var cur: int = open[best]
		open.remove_at(best)
		if cur == t:
			break
		closed[cur] = true
		for nb in adj[cur]:
			if closed.has(nb):
				continue
			var ng: float = float(g[cur]) + pts[cur].distance_to(pts[nb])
			if not g.has(nb) or ng < float(g[nb]):
				g[nb] = ng
				came[nb] = cur
				if not (nb in open):
					open.append(nb)
	if not g.has(t):
		# the roads don't reach it: as far as they go toward it, then straight on
		var close := s
		for nd in g:
			if pts[nd].distance_squared_to(b) < pts[close].distance_squared_to(b):
				close = nd
		if close == s:
			return PackedVector2Array([a, b])
		t = close
	var path := PackedVector2Array([b, pts[t]])
	var n := t
	while came.has(n):
		n = came[n]
		path.append(pts[n])
	path.append(a)
	path.reverse()
	return path

static func _nearest(pts: Array[Vector2], p: Vector2) -> int:
	var best := 0
	var bd := INF
	for i in pts.size():
		var d := pts[i].distance_squared_to(p)
		if d < bd:
			bd = d
			best = i
	return best

static func length(path: PackedVector2Array) -> float:
	var L := 0.0
	for i in path.size() - 1:
		L += path[i].distance_to(path[i + 1])
	return L
