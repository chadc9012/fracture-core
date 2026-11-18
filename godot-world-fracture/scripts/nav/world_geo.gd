extends RefCounted
## The planet as you fly it (owner, Nov 18: "make it so you can fly around the world"). Every region map sits on the globe
## at its continent's latitude / longitude (planet.json, the Planetary Director's board); a continent with more than one
## map spreads the others a few degrees round its centre. A region view works in flat local metres (x east, -z north,
## from the map's centre); these map those metres onto the sphere and back (an azimuthal equidistant frame about an
## anchor), so a craft can carry its place and heading from one region's frame into the next.
##
## The scale is a game one: one degree of arc is M_PER_DEG metres, so Nexus City to Neon City (about 30 deg) is ~6 km,
## a few minutes in a jet, and all the way round the world is 72 km.

const M_PER_DEG := 200.0
const R := M_PER_DEG * 180.0 / PI          # the planet's radius in game metres (~11.5 km)
const SUB_OFFSET := 8.0                    # degrees between a continent's centre map and its other maps
## Thalassia lies under the sea: flown over it is open water, so it is not a place to arrive by air
const NOT_BY_AIR := ["thalassia"]

static var _sites: Array = []

## every flyable map on the globe: [{map, name, continent, lat, lon, v (unit vector)}]
static func sites() -> Array:
	if not _sites.is_empty():
		return _sites
	var data: Node = Engine.get_main_loop().root.get_node_or_null("Data") if Engine.get_main_loop() else null
	if data == null:
		return _sites
	# the other maps of a continent go east, south, west, north of its centre, in the order planet.json lists them
	var dirs := [Vector2(0, 1), Vector2(-1, 0), Vector2(0, -1), Vector2(1, 0)]
	for c in data.continents():
		var maps: Array = c.get("maps", [])
		for i in maps.size():
			var id := String(maps[i])
			if id in NOT_BY_AIR or data.map(id).is_empty():
				continue
			var lat := float(c.lat)
			var lon := float(c.lon)
			if i > 0:
				var d: Vector2 = dirs[(i - 1) % dirs.size()] * SUB_OFFSET
				lat += d.x
				lon += d.y / maxf(0.2, cos(deg_to_rad(lat)))
			_sites.append({ "map": id, "name": String(data.map(id).get("name", id)), "continent": String(c.id),
				"lat": lat, "lon": lon, "v": lat_lon_to_vec(lat, lon) })
	return _sites

static func site(map_id: String) -> Dictionary:
	for s in sites():
		if String(s.map) == map_id:
			return s
	return {}

## north +Y; longitude 0 faces -Z; east is +lon. (Not the globe view's SphereMesh convention: this one only has to agree
## with itself.)
static func lat_lon_to_vec(lat: float, lon: float) -> Vector3:
	var la := deg_to_rad(lat)
	var lo := deg_to_rad(lon)
	return Vector3(cos(la) * sin(lo), sin(la), -cos(la) * cos(lo))

static func vec_to_lat_lon(v: Vector3) -> Vector2:
	var n := v.normalized()
	return Vector2(rad_to_deg(asin(clampf(n.y, -1.0, 1.0))), rad_to_deg(atan2(n.x, -n.z)))

## the east and north unit vectors at a point of the sphere (at a pole, east is picked along +X)
static func basis(a: Vector3) -> Array:
	var east := a.cross(Vector3.UP)
	if east.length() < 1e-6:
		east = Vector3.RIGHT
	east = east.normalized()
	var north := east.cross(a).normalized()
	return [east, north]

## local metres (x east, z south) in the frame anchored at unit vector `a` -> the point on the sphere
static func to_globe(a: Vector3, x: float, z: float) -> Vector3:
	var b := basis(a)
	var t: Vector3 = b[0] * x + b[1] * (-z)
	var d := t.length()
	if d < 1e-4:
		return a
	var ang := d / R
	return (a * cos(ang) + t / d * sin(ang)).normalized()

## a point on the sphere -> local metres in the frame anchored at `a`
static func to_local(a: Vector3, p: Vector3) -> Vector2:
	# atan2 of the cross and the dot: acos of a float32 dot rounds every point within ~5 m of the anchor onto it
	var c := a.dot(p)
	var ang := atan2(a.cross(p).length(), c)
	if ang < 1e-9:
		return Vector2.ZERO
	var t := (p - a * c).normalized()
	var b := basis(a)
	return Vector2(t.dot(b[0]), -t.dot(b[1])) * ang * R

## great-circle distance in game metres
static func dist(p: Vector3, q: Vector3) -> float:
	return atan2(p.cross(q).length(), p.dot(q)) * R

## the compass bearing (radians, 0 north, clockwise) from p toward q
static func bearing(p: Vector3, q: Vector3) -> float:
	var b := basis(p)
	var t := q - p * p.dot(q)
	return atan2(t.dot(b[0]), t.dot(b[1]))

## a region view's yaw (forward = (-sin yaw, -cos yaw) in local x/z) as a compass heading, and back
static func yaw_to_heading(yaw: float) -> float:
	return wrapf(-yaw, 0.0, TAU)

static func heading_to_yaw(h: float) -> float:
	return wrapf(-h, -PI, PI)

## carries a position + yaw from one frame (anchor a) to another (anchor b): [Vector2 local, float yaw]
static func reframe(a: Vector3, b: Vector3, x: float, z: float, yaw: float) -> Array:
	var fwd := Vector2(-sin(yaw), -cos(yaw))
	var p0 := to_globe(a, x, z)
	var p1 := to_globe(a, x + fwd.x * 50.0, z + fwd.y * 50.0)
	var l0 := to_local(b, p0)
	var l1 := to_local(b, p1)
	var d := l1 - l0
	return [l0, atan2(-d.x, -d.y)]

static func compass(h: float) -> String:
	var names := ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
	return names[int(round(wrapf(h, 0.0, TAU) / (TAU / 8.0))) % 8]

## "13.1°N 4.4°W"
static func lat_lon_text(ll: Vector2) -> String:
	return "%.1f°%s %.1f°%s" % [absf(ll.x), "N" if ll.x >= 0.0 else "S", absf(ll.y), "E" if ll.y >= 0.0 else "W"]
