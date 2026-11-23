extends SceneTree
## Lays the road network and the highway of every region (owner, Nov 23: "Generate roads and highway") and writes
## data/road_net.json, which region_3d.gd adds to the region's own roads at load. Run after a map changes:
##   godot --headless --path godot-world-fracture --script res://tools/gen_road_net.gd
## Per region:
##   - a highway (cls "highway", 14.4 m, named "<Region> Expressway") edge to edge across the land through the middle,
##     for regions big enough and mostly land and without one already; routed for gentle grades (region_3d builds its
##     deck on fill and bridges, never in a cutting)
##   - roads from the network (existing driveable roads + the highway) to every place (POI): each place in turn is reached
##     by the cheapest route from what is already built (multi-source Dijkstra on an 8 m grid), so later roads branch off
##     earlier ones; cost = length × (1 + slope and water penalties), buildings blocked. Long links are "main" asphalt,
##     short ones in the wilds "track"; city regions use "street". Runs over water become their own "bridge" pieces.
## Everything is in map coordinates (metres), the same as the exported roads.

const OUT := "res://data/road_net.json"
const GEN := "res://generated/maps/"
const CELL := 8.0
const SKIP := ["thalassia", "storm"]                       # under the sea; floating islands
const NO_HIGHWAY := ["swamps", "riverdale", "skyhaven", "azure-isles", "shattered-reefs", "frostveil"]
const CITY := ["nexus", "neon-city", "old-harrow", "skyhaven"]
const DRIVE := ["highway", "main", "street", "track", "bridge"]

var n := 0
var span := 0.0
var x0 := 0.0
var z0 := 0.0
var water := -2.5
var hn := 2
var heights := PackedFloat32Array()
var blocked := PackedByteArray()
var hgrid := PackedFloat32Array()

func _init() -> void:
	var idx = JSON.parse_string(FileAccess.get_file_as_string(GEN + "index.json"))
	var ids: Array = []
	if idx is Array:
		for e in idx:
			ids.append(String(e.id) if e is Dictionary else String(e))
	elif idx is Dictionary:
		ids = idx.keys()
	if ids.is_empty():
		for f in DirAccess.get_files_at(GEN):
			if f.ends_with(".json") and f != "index.json":
				ids.append(f.get_basename())
	var out := {}
	var only := OS.get_environment("ONLY")
	for id in ids:
		if id in SKIP or (only != "" and not (id in only.split(","))):
			continue
		var m = JSON.parse_string(FileAccess.get_file_as_string(GEN + id + ".json"))
		if not (m is Dictionary) or not m.has("bounds"):
			continue
		var t0 := Time.get_ticks_msec()
		printerr("start ", id)
		var roads := _region(id, m)
		out[id] = roads
		var km := 0.0
		for r in roads:
			for i in r.pts.size() - 1:
				km += Vector2(r.pts[i][0], r.pts[i][1]).distance_to(Vector2(r.pts[i + 1][0], r.pts[i + 1][1]))
		print("%-18s %2d roads  %5.1f km  (%d ms)" % [id, roads.size(), km / 1000.0, Time.get_ticks_msec() - t0])
	var f := FileAccess.open(OUT, FileAccess.WRITE)
	f.store_string(JSON.stringify(out))
	f.close()
	print("wrote ", OUT)
	quit()

# ------------------------------------------------------------------------------------------------ one region
func _region(id: String, m: Dictionary) -> Array:
	var b: Dictionary = m.bounds
	span = float(b.span)
	x0 = float(b.x0)
	z0 = float(b.z0)
	water = float(m.get("water", -2.5))
	_heights(id, m)
	n = int(ceil(span / CELL)) + 1
	hgrid.resize(n * n)
	blocked.resize(n * n)
	blocked.fill(0)
	for j in n:
		for i in n:
			hgrid[j * n + i] = _h(x0 + i * CELL, z0 + j * CELL)
	# buildings block (3 m clear round them)
	for bd in m.get("buildings", []):
		var cx := float(bd[0])
		var cz := float(bd[1])
		var hx := float(bd[2]) + 3.0
		var hz := float(bd[3]) + 3.0
		var r := maxf(hx, hz) * 1.42
		for j in range(_cj(cz - r), _cj(cz + r) + 1):
			for i in range(_ci(cx - r), _ci(cx + r) + 1):
				if i < 0 or j < 0 or i >= n or j >= n:
					continue
				var p := Vector2(x0 + i * CELL - cx, z0 + j * CELL - cz).rotated(-float(bd[4]))
				if absf(p.x) <= hx and absf(p.y) <= hz:
					blocked[j * n + i] = 1
	var city := id in CITY
	var roads: Array = []
	var net := {}                            # grid cells already on the network
	var have_highway := false
	for r in m.get("roads", []):
		if not (String(r.cls) in DRIVE):
			continue
		if r.cls == "highway":
			have_highway = true
		var pts: Array = r.pts
		for k in pts.size():
			var c := _cell(float(pts[k][0]), float(pts[k][1]))
			if c >= 0:
				net[c] = true
			if k < pts.size() - 1:
				var a := Vector2(pts[k][0], pts[k][1])
				var e := Vector2(pts[k + 1][0], pts[k + 1][1])
				var steps := int(a.distance_to(e) / CELL)
				for s in steps:
					var q := a.lerp(e, float(s) / maxf(steps, 1))
					var c2 := _cell(q.x, q.y)
					if c2 >= 0:
						net[c2] = true
	# the highway, edge to edge through the middle across the long run of land
	if not have_highway and not (id in NO_HIGHWAY) and span >= 400.0 and _land_frac() > 0.6:
		var hw := _highway(String(m.get("name", id)))
		if not hw.is_empty():
			for p in hw[0].pts:
				var c := _cell(float(p[0]), float(p[1]))
				if c >= 0:
					net[c] = true
			roads.append_array(hw)
	# places, most important first
	var pois: Array = []
	for p in m.get("pois", []):
		var c := _free_near(_cell(float(p.x), float(p.z)))
		if c < 0 or hgrid[c] < water + 0.3:
			continue
		pois.append([c, int(p.get("rank", 3)), String(p.get("name", ""))])
	pois.sort_custom(func(a, b2): return a[1] < b2[1])
	pois = pois.slice(0, 16)
	if net.is_empty() and not pois.is_empty():
		net[pois[0][0]] = true
		pois.remove_at(0)
	while not pois.is_empty():
		var res := _dijkstra(net, 1.0)
		var dist: PackedFloat64Array = res[0]
		var prev: PackedInt32Array = res[1]
		var best := -1
		for k in pois.size():
			if best < 0 or dist[pois[k][0]] < dist[pois[best][0]]:
				best = k
		var target: int = pois[best][0]
		var name: String = pois[best][2]
		pois.remove_at(best)
		if dist[target] >= INF or net.has(target):
			continue
		var path: Array = []
		var c := target
		while c >= 0 and not net.has(c):
			path.push_front(c)
			c = prev[c]
		if c >= 0:
			path.push_front(c)
		for pc in path:
			net[pc] = true
		var length := path.size() * CELL
		var cls := "street" if city else ("main" if length > 140.0 else "track")
		var w := 8.0 if cls == "street" else (10.8 if cls == "main" else 5.0)
		roads.append_array(_to_roads(path, cls, w, "Road to " + name if name != "" else "Road"))
	return roads

func _highway(region: String) -> Array:
	# try both axes, keep the cheaper per metre of the two edge-to-edge routes through the centre
	var best: Array = []
	var best_cost := INF
	var mid := n / 2
	for axis in 2:
		for off in [0, -n / 6, n / 6]:
			var a := _free_near(_idx(0, mid + off) if axis == 0 else _idx(mid + off, 0))
			var e := _free_near(_idx(n - 1, mid - off) if axis == 0 else _idx(mid - off, n - 1))
			if a < 0 or e < 0:
				continue
			var src := {}
			src[a] = true   # (a `{ a: true }` literal keys the string "a")
			var res := _dijkstra(src, 0.35, true)
			var dist: PackedFloat64Array = res[0]
			if dist[e] >= INF:
				continue
			var path: Array = []
			var c := e
			while c >= 0:
				path.push_front(c)
				c = (res[1] as PackedInt32Array)[c]
			var per := dist[e] / (path.size() * CELL)
			if per < best_cost:
				best_cost = per
				best = path
		if not best.is_empty():
			break
	if best.is_empty():
		return []
	# a highway keeps its line over water: one piece, region_3d bridges what is wet
	return [{ "cls": "highway", "w": 14.4, "name": region + " Expressway", "color": "", "gen": true, "pts": _smooth(best) }]

# ------------------------------------------------------------------------------------------------ grid search
## multi-source Dijkstra from `src`; `slope_w` scales the slope penalty; highways cross water at a small cost (bridges)
func _dijkstra(src: Dictionary, slope_w: float, highway := false) -> Array:
	# float64: float32 rounding made stored costs differ from the heap's, and steep regions re-relaxed without end
	var dist := PackedFloat64Array()
	dist.resize(n * n)
	dist.fill(INF)
	var prev := PackedInt32Array()
	prev.resize(n * n)
	prev.fill(-1)
	var heap: Array = []                     # [cost, cell] binary heap
	for c in src:
		dist[c] = 0.0
		_push(heap, [0.0, c])
	var dirs := [[1, 0, 1.0], [-1, 0, 1.0], [0, 1, 1.0], [0, -1, 1.0], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]
	while not heap.is_empty():
		var top: Array = _pop(heap)
		var c: int = top[1]
		if top[0] > dist[c]:
			continue
		var i := c % n
		var j := c / n
		for d in dirs:
			var ii: int = i + d[0]
			var jj: int = j + d[1]
			if ii < 0 or jj < 0 or ii >= n or jj >= n:
				continue
			var nc := jj * n + ii
			if blocked[nc] == 1:
				continue
			var run: float = CELL * d[2]
			var slope := absf(hgrid[nc] - hgrid[c]) / run
			var wet := hgrid[nc] < water + 0.2
			var k := 1.0 + slope_w * (slope * 8.0 + maxf(0.0, slope - 0.12) * 60.0)
			if wet:
				k += 0.6 if highway else 6.0
			var nd := dist[c] + run * k
			if nd < dist[nc]:
				dist[nc] = nd
				prev[nc] = c
				_push(heap, [nd, nc])
	return [dist, prev]

func _push(h: Array, e: Array) -> void:
	h.append(e)
	var i := h.size() - 1
	while i > 0:
		var p := (i - 1) / 2
		if h[p][0] <= h[i][0]:
			break
		var t = h[p]
		h[p] = h[i]
		h[i] = t
		i = p

func _pop(h: Array) -> Array:
	var top: Array = h[0]
	var last: Array = h.pop_back()
	if not h.is_empty():
		h[0] = last
		var i := 0
		while true:
			var l := i * 2 + 1
			var r := l + 1
			var s := i
			if l < h.size() and h[l][0] < h[s][0]:
				s = l
			if r < h.size() and h[r][0] < h[s][0]:
				s = r
			if s == i:
				break
			var t = h[s]
			h[s] = h[i]
			h[i] = t
			i = s
	return top

# ------------------------------------------------------------------------------------------------ path → road pieces
## grid path → smoothed polyline in map coordinates; runs over water become "bridge" pieces of their own
func _to_roads(path: Array, cls: String, w: float, name: String) -> Array:
	var pts := _smooth(path)
	var out: Array = []
	var run: Array = []
	var run_wet := false
	for p in pts:
		var wet := _h(float(p[0]), float(p[1])) < water + 0.2
		if run.is_empty():
			run_wet = wet
		if wet != run_wet and run.size() >= 1:
			run.append(p)
			out.append({ "cls": "bridge" if run_wet else cls, "w": w, "name": name, "color": "", "gen": true, "pts": run })
			run = [p]
			run_wet = wet
		else:
			run.append(p)
	if run.size() >= 2:
		out.append({ "cls": "bridge" if run_wet else cls, "w": w, "name": name, "color": "", "gen": true, "pts": run })
	return out

## the cell centres, the corners cut (Chaikin twice), then points closer than 6 m dropped
func _smooth(path: Array) -> Array:
	var pts: Array[Vector2] = []
	for c in path:
		pts.append(Vector2(x0 + (c % n) * CELL, z0 + (c / n) * CELL))
	for it in 2:
		if pts.size() < 3:
			break
		var q: Array[Vector2] = [pts[0]]
		for k in pts.size() - 1:
			q.append(pts[k].lerp(pts[k + 1], 0.25))
			q.append(pts[k].lerp(pts[k + 1], 0.75))
		q.append(pts[-1])
		pts = q
	var out: Array = []
	var last := Vector2.INF
	for k in pts.size():
		if k == pts.size() - 1 or last == Vector2.INF or pts[k].distance_to(last) >= 6.0:
			out.append([snappedf(pts[k].x, 0.1), snappedf(pts[k].y, 0.1)])
			last = pts[k]
	return out

# ------------------------------------------------------------------------------------------------ helpers
func _heights(id: String, m: Dictionary) -> void:
	var hd: Dictionary = m.get("heights", {})
	hn = int(hd.get("n", 2))
	var lo := float(hd.get("lo", 0.0))
	var hi := float(hd.get("hi", 1.0))
	heights.resize(hn * hn)
	heights.fill(0.0)
	var bytes := FileAccess.get_file_as_bytes(GEN + id + ".height.pngb")
	if bytes.is_empty():
		return
	var img := Image.new()
	if img.load_png_from_buffer(bytes) != OK:
		return
	img.convert(Image.FORMAT_RGB8)
	var d := img.get_data()
	for k in hn * hn:
		heights[k] = lo + (hi - lo) * ((d[k * 3] << 8) | d[k * 3 + 1]) / 65535.0

func _h(x: float, z: float) -> float:
	var fx := clampf((x - x0) / span * (hn - 1), 0.0, hn - 1.001)
	var fz := clampf((z - z0) / span * (hn - 1), 0.0, hn - 1.001)
	var i := int(fx)
	var j := int(fz)
	var tx := fx - i
	var tz := fz - j
	return lerpf(lerpf(heights[j * hn + i], heights[j * hn + i + 1], tx), lerpf(heights[(j + 1) * hn + i], heights[(j + 1) * hn + i + 1], tx), tz)

func _ci(x: float) -> int:
	return int(round((x - x0) / CELL))

func _cj(z: float) -> int:
	return int(round((z - z0) / CELL))

func _idx(i: int, j: int) -> int:
	return clampi(j, 0, n - 1) * n + clampi(i, 0, n - 1)

func _cell(x: float, z: float) -> int:
	var i := _ci(x)
	var j := _cj(z)
	if i < 0 or j < 0 or i >= n or j >= n:
		return -1
	return j * n + i

## the nearest unblocked dry cell to `c` (spiral out to 6 cells)
func _free_near(c: int) -> int:
	if c < 0:
		return -1
	var i := c % n
	var j := c / n
	for r in 7:
		for dj in range(-r, r + 1):
			for di in range(-r, r + 1):
				if maxi(absi(di), absi(dj)) != r:
					continue
				var ii := i + di
				var jj := j + dj
				if ii < 0 or jj < 0 or ii >= n or jj >= n:
					continue
				var k := jj * n + ii
				if blocked[k] == 0 and hgrid[k] >= water + 0.3:
					return k
	return -1

func _land_frac() -> float:
	var dry := 0
	for k in n * n:
		if hgrid[k] >= water + 0.2:
			dry += 1
	return float(dry) / (n * n)
