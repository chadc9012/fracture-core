extends RefCounted
## Handling for everything that is not a street car (asset catalog: Vehicles — all classes), a pure port of the web
## game's src/game/vehicle-handling.ts: one profile per kind (RACER / OFFROAD / TANK / JET / HELI / BOAT / SUB), one
## `step` a frame over a small state. Speeds in m/s on the web's base of 62 m/s × the profile's `top`. Air: a helicopter
## lifts from standstill (takeoff 0) and hovers; a jet needs takeoff speed and sinks below 70 % of it. Water: a boat
## rides the surface, a sub dives between the floor and the surface. Tanks pivot at a standstill. Kept node-free so
## tests/driving/handling_test.gd runs headless; the views own the hull node and the camera.

const BASE_SPEED := 62.0
const RIDE := 1.9

const HANDLING := {
	"RACER": { "mode": "GROUND", "top": 1.1, "accel": 60.0, "brake": 80.0, "reverse": 18.0, "steer": 1.7, "pivot": false, "grip": 0.95, "takeoff": 0.0, "climb": 0.0, "safe_exit": 6.0 },
	"OFFROAD": { "mode": "GROUND", "top": 0.9, "accel": 48.0, "brake": 70.0, "reverse": 18.0, "steer": 1.5, "pivot": false, "grip": 0.85, "takeoff": 0.0, "climb": 0.0, "safe_exit": 6.0 },
	"TANK": { "mode": "GROUND", "top": 0.55, "accel": 22.0, "brake": 40.0, "reverse": 10.0, "steer": 0.9, "pivot": true, "grip": 1.0, "takeoff": 0.0, "climb": 0.0, "safe_exit": 6.0 },
	"JET": { "mode": "AIR", "top": 1.6, "accel": 40.0, "brake": 25.0, "reverse": 0.0, "steer": 1.0, "pivot": false, "grip": 1.0, "takeoff": 32.0, "climb": 22.0, "safe_exit": 4.0 },
	"HELI": { "mode": "AIR", "top": 0.8, "accel": 30.0, "brake": 40.0, "reverse": 10.0, "steer": 1.6, "pivot": false, "grip": 1.0, "takeoff": 0.0, "climb": 9.0, "safe_exit": 4.0 },
	"BOAT": { "mode": "WATER", "top": 0.75, "accel": 30.0, "brake": 30.0, "reverse": 8.0, "steer": 1.2, "pivot": false, "grip": 0.7, "takeoff": 0.0, "climb": 0.0, "safe_exit": 6.0 },
	"SUB": { "mode": "WATER", "top": 0.5, "accel": 18.0, "brake": 24.0, "reverse": 8.0, "steer": 1.0, "pivot": false, "grip": 0.9, "takeoff": 0.0, "climb": 4.0, "safe_exit": 6.0 },
}
## the web's BY_ID for the fleet hulls that are not plain cars (vehicle-handling.ts); cars fall to OFFROAD / RACER
const BY_ID := {
	"goliath-tank": "TANK", "fracture-behemoth": "TANK", "vanguard-jet": "JET", "ai-interceptor": "JET", "rift-helicopter": "HELI",
	"leviathan": "JET", "scrap-patrol-boat": "BOAT", "hydro-sub-skiff": "SUB", "hover-car": "RACER", "void-skimmer": "JET",
	"aether-hoverbike": "RACER", "war-rig": "OFFROAD", "tech-transport": "OFFROAD",
}

## the fleet's speed / handling multipliers (vehicles.ts) for the hulls this view flies and sails
const FLEET_SPEED := { "rift-helicopter": 1.12, "vanguard-jet": 1.8, "scrap-patrol-boat": 0.85, "hydro-sub-skiff": 0.7, "goliath-tank": 0.6, "hover-car": 1.1 }

static func profile(kind: String) -> Dictionary:
	return HANDLING.get(kind, HANDLING.OFFROAD)

static func kind_of(vehicle_id: String) -> String:
	return String(BY_ID.get(vehicle_id, "OFFROAD"))

class State:
	var speed := 0.0
	var yaw := 0.0
	var y := 0.0
	var vy := 0.0
	var airborne := false
	var slip := 0.0
	var roll := 0.0
	var pitch := 0.0
	# per frame
	var landed := false
	var hard_landing := false
	var blocked := false
	var skidding := false

## `input`: throttle 0..1, brake 0..1, steer -1..1, ascend 0..1, descend 0..1, handbrake, boost
## `env`: grip 0..1, slope, floor (ground or sea floor height), water (surface height), over_water
static func step(p: Dictionary, st: State, input: Dictionary, env: Dictionary, top_speed: float, dt: float) -> void:
	var mode := String(p.mode)
	var ground: float = 1.0 if mode != "GROUND" else float(env.get("grip", 1.0))
	var throttle := float(input.get("throttle", 0.0))
	var brake := float(input.get("brake", 0.0))
	var steer := float(input.get("steer", 0.0))
	var ascend := float(input.get("ascend", 0.0))
	var descend := float(input.get("descend", 0.0))
	var max_speed: float = top_speed * float(p.top) * (1.4 if bool(input.get("boost", false)) else 1.0)
	# longitudinal
	if throttle > 0.0:
		st.speed += float(p.accel) * ground * throttle * dt
	elif brake > 0.0:
		st.speed -= (float(p.brake) if st.speed > 0.5 else float(p.accel) * 0.8) * brake * dt
	else:
		st.speed *= exp(-(0.15 if mode == "AIR" and st.airborne else (1.0 if mode == "WATER" else 1.4)) * dt)
	if mode == "GROUND":
		st.speed *= exp(-(0.22 + float(env.get("slope", 0.0)) * 1.6) * dt)
	st.speed = clampf(st.speed, -float(p.reverse), max_speed)
	# steering
	var pivot := bool(p.pivot)
	var speed_factor: float = 1.0 if pivot else clampf(absf(st.speed) / 14.0, 0.15, 1.0)
	var handbrake: bool = bool(input.get("handbrake", false)) and mode == "GROUND" and absf(st.speed) > 8.0
	var steer_grip: float = ground if mode == "GROUND" else 1.0
	var yaw_rate: float = float(p.steer) * steer_grip * speed_factor * (1.6 if handbrake else 1.0) * (0.5 if float(p.takeoff) > 0.0 and not st.airborne else 1.0)
	st.yaw += steer * yaw_rate * dt * (1.0 if pivot else signf(st.speed if st.speed != 0.0 else 1.0))
	# drift
	var load := absf(steer) * absf(st.speed) / 30.0
	var hold: float = float(p.grip) * (float(env.get("grip", 1.0)) if mode == "GROUND" else 1.0) * (0.45 if handbrake else 1.0)
	st.slip = st.slip + (maxf(0.0, load - hold) - st.slip) * (1.0 - exp(-6.0 * dt))
	if st.slip > 0.3 and mode == "GROUND":
		st.speed *= exp(-0.5 * st.slip * dt)
	var roll_want: float = -steer * 0.6 if mode == "AIR" else -steer * minf(0.12, load * 0.1)
	st.roll += (roll_want - st.roll) * (1.0 - exp(-5.0 * dt))
	# vertical
	st.landed = false
	st.hard_landing = false
	var floor_h := float(env.get("floor", 0.0))
	st.blocked = mode == "WATER" and not bool(env.get("over_water", true))
	if mode == "GROUND":
		st.y = floor_h + RIDE
		st.vy = 0.0
		st.airborne = false
		st.pitch = 0.0
	elif mode == "WATER":
		var surface := float(env.get("water", 0.0)) + 0.6
		if float(p.climb) > 0.0:
			st.vy = (ascend - descend) * float(p.climb)
			st.y = clampf(st.y + st.vy * dt, floor_h + 1.2, surface)
		else:
			st.y = surface
			st.vy = 0.0
		st.pitch = 0.0
		if st.blocked:
			st.speed *= exp(-6.0 * dt)
	else:
		var floor_ride := floor_h + RIDE
		var can_lift: bool = float(p.takeoff) == 0.0 or st.speed >= float(p.takeoff)
		if not st.airborne:
			st.y = floor_ride
			st.vy = 0.0
			if can_lift and ascend > 0.0:
				st.airborne = true
				st.vy = float(p.climb) * 0.4
		else:
			var want := (ascend - descend) * float(p.climb)
			var sink: float = -8.0 if float(p.takeoff) > 0.0 and st.speed < float(p.takeoff) * 0.7 else 0.0
			st.vy += (want + sink - st.vy) * (1.0 - exp(-2.5 * dt))
			st.y += st.vy * dt
			if st.y <= floor_ride:
				st.hard_landing = st.vy < -7.0 or absf(st.speed) > float(p.takeoff) + 12.0
				st.y = floor_ride
				st.vy = 0.0
				st.airborne = false
				st.landed = true
				if st.hard_landing:
					st.speed *= 0.4
		var pitch_want: float = clampf(st.vy / 40.0, -0.35, 0.35) if st.airborne else 0.0
		st.pitch += (pitch_want - st.pitch) * (1.0 - exp(-4.0 * dt))
	st.skidding = st.slip > 0.3 or (handbrake and absf(st.speed) > 10.0)

## safe to get out: not airborne, slow, and (water) near a shore
static func can_exit(p: Dictionary, st: State, deep_water: bool) -> Dictionary:
	if st.airborne:
		return { "ok": false, "reason": "Land first" if float(p.takeoff) > 0.0 else "Set down first" }
	if absf(st.speed) > float(p.safe_exit):
		return { "ok": false, "reason": "Too fast to get out" }
	if deep_water and String(p.mode) == "WATER":
		return { "ok": false, "reason": "Pull up to the shore first" }
	return { "ok": true }

## chase camera per kind (distance, height)
static func camera(p: Dictionary) -> Vector2:
	if String(p.mode) == "AIR":
		return Vector2(22.0, 7.0)
	if String(p.mode) == "WATER":
		return Vector2(13.0, 3.5)
	if bool(p.pivot):
		return Vector2(15.0, 6.0)
	return Vector2(14.0, 5.0)
