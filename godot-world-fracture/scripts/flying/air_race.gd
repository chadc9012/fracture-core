extends RefCounted
## Air races (the owner's racing direction, Nov 1: race in the cities with cars, motorcycles and planes; the hub's last
## "soon" class): the Skyways ring course flown against three rival jets. They sit on the apron beside your pad, lift
## when you do, and fly ring to ring on a kinematic line — turning at a rate, climbing to the ring's height, each at a
## pace of its own — so the course is a race for position, not a solo clock. Placings by rings flown, then by time at
## the last ring; the purse by place through Progression (the view's _finish asks place()).
##   skyways_view.gd: air_race = true before add_child; AirRace.new(view).setup() after the course; step(dt) each
##   frame; standings() for the HUD. Shot hook skyways:jet:race[:go].

const Handling := preload("res://scripts/driving/vehicle_handling.gd")
const StreetCar := preload("res://scripts/driving/street_car.gd")
const RIVALS := [["skyhawk", "V. Okonkwo", 1.0], ["riftwing", "Sable", 0.93], ["thunderbolt-a7", "D. Marr", 0.86]]
const PURSE := [900, 500, 250, 100]
const TURN_RATE := 0.9       # rad/s at full pace
const CLIMB_RATE := 0.55     # of the way to the ring's height a second

var view: Node
var rivals: Array = []       # [{ id, name, skill, hull, pos, yaw, speed, next, done_at, launched }]
var launched := false
var clock := 0.0

func _init(v: Node) -> void:
	view = v

## the rivals on the apron: a row beside the pad, facing the player's way
func setup() -> void:
	var side := Vector3(cos(view.state.yaw), 0, -sin(view.state.yaw))
	var back := Vector3(sin(view.state.yaw), 0, cos(view.state.yaw))
	for i in RIVALS.size():
		var r: Array = RIVALS[i]
		var id := String(r[0])
		var hull := (load(view.model_of(id)) as PackedScene).instantiate() as Node3D
		StreetCar.face_forward(hull)
		view.region.world().add_child(hull)
		_fit(hull, float(view.CRAFT[id].length))
		# on the apron's level (the pad's: the airport's apron is a flat deck above the terrain under it)
		var p: Vector3 = view.pad + side * (22.0 + 20.0 * i) + back * 6.0 * i
		p.y = view.pad.y + Handling.RIDE
		hull.position = p
		hull.rotation.y = view.state.yaw
		var top: float = float(view.top_speed) * (0.92 + 0.1 * float(r[2]))
		rivals.append({ "id": id, "name": String(r[1]), "skill": float(r[2]), "hull": hull, "pos": p, "yaw": float(view.state.yaw), "speed": 0.0, "top": top, "next": 0, "done_at": -1.0, "launched": false })

static func _fit(hull: Node3D, length: float) -> void:
	var aabb := AABB()
	var first := true
	for c in hull.find_children("*", "MeshInstance3D", true, false):
		var mi := c as MeshInstance3D
		var t := Transform3D.IDENTITY
		var p: Node = mi
		while p != hull and p is Node3D:
			t = (p as Node3D).transform * t
			p = p.get_parent()
		var a := t * mi.get_aabb()
		aabb = a if first else aabb.merge(a)
		first = false
	if first or aabb.size.z < 0.01:
		return
	var k := length / maxf(aabb.size.z, aabb.size.x)
	for ch in hull.get_children():
		if ch is Node3D:
			(ch as Node3D).scale *= k
			(ch as Node3D).position = (ch as Node3D).position * k - Vector3(0, aabb.position.y * k, 0)

## the field lifts when you do; from then on every rival flies the rings at its pace
func step(dt: float) -> void:
	if not launched:
		if view.state.airborne:
			launched = true
		else:
			return
	clock += dt
	var rings: Array = view.rings
	for r in rivals:
		if r.done_at >= 0.0 or rings.is_empty():
			continue
		var hull: Node3D = r.hull
		var target: Vector3 = rings[mini(int(r.next), rings.size() - 1)].pos
		var pos: Vector3 = r.pos
		# the launch: a run on the ground to half pace, then up
		var pace: float = float(r.top)
		r.speed = move_toward(float(r.speed), pace, (14.0 + 10.0 * float(r.skill)) * dt)
		var to := target - pos
		var want_yaw := atan2(-to.x, -to.z)
		var turn := TURN_RATE * (0.75 + 0.25 * float(r.skill)) * dt
		r.yaw = lerp_angle(float(r.yaw), want_yaw, clampf(turn / maxf(absf(angle_difference(float(r.yaw), want_yaw)), 0.001), 0.0, 1.0))
		var fwd := Vector3(-sin(float(r.yaw)), 0, -cos(float(r.yaw)))
		pos += fwd * float(r.speed) * dt
		var ground: float = maxf(view.region.ground(pos.x, pos.z), view.pad.y if pos.distance_to(view.pad) < 160.0 else -INF) + Handling.RIDE
		var rolling := float(r.speed) < pace * 0.45 and pos.y <= ground + 0.5
		if rolling:
			pos.y = ground
		else:
			# climb or sink toward the ring's height, never under the ground or the roofs between (the roofs looked up
			# every few frames: the city has thousands of boxes)
			r.roof_t = float(r.get("roof_t", 0.0)) - dt
			if float(r.roof_t) <= 0.0:
				r.roof_t = 0.25
				var roof := 0.0
				for b in view._boxes:
					if absf(b.get_center().x - pos.x) < 30.0 and absf(b.get_center().z - pos.z) < 30.0:
						roof = maxf(roof, b.end.y + 12.0)
				r.roof = roof
			var want_y := maxf(target.y, float(r.get("roof", 0.0)))
			pos.y = maxf(lerpf(pos.y, want_y, clampf(CLIMB_RATE * dt, 0.0, 1.0)), ground)
		r.pos = pos
		hull.position = pos
		var bank := clampf(angle_difference(want_yaw, float(r.yaw)) * 1.4, -0.7, 0.7)
		hull.rotation = Vector3(clampf((target.y - pos.y) * 0.01, -0.3, 0.3), float(r.yaw), -bank if not rolling else 0.0)
		if pos.distance_to(target) < float(view.RING_R) * 1.5:
			r.next = int(r.next) + 1
			if int(r.next) >= rings.size():
				r.done_at = clock

## everyone's rings and times, best first: [{ name, rings, time, you }]
func standings() -> Array:
	var rows: Array = [{ "name": "You", "rings": int(view.next_ring), "time": (float(view.clock) if view.finished else INF), "you": true }]
	for r in rivals:
		rows.append({ "name": r.name, "rings": int(r.next), "time": (float(r.done_at) if r.done_at >= 0.0 else INF), "you": false })
	rows.sort_custom(func(a, b):
		if a.rings != b.rings:
			return a.rings > b.rings
		return a.time < b.time)
	return rows

## your place, 1-based
func place() -> int:
	var rows := standings()
	for i in rows.size():
		if rows[i].you:
			return i + 1
	return rows.size()

func purse(p: int) -> int:
	return int(PURSE[clampi(p - 1, 0, PURSE.size() - 1)])

func clear() -> void:
	for r in rivals:
		if is_instance_valid(r.hull):
			r.hull.queue_free()
	rivals.clear()
