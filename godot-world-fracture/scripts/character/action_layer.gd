extends SkeletonModifier3D
## Plays combat_clips.gd clips over the body's AnimationPlayer (owner, Nov 21: combat animations). A SkeletonModifier3D runs
## after the animation each frame, so a clip written here sits on top of the walk / run / idle underneath: an "upper" clip
## turns the spine, head and arms and leaves the legs walking, a "full" clip takes every bone it names. Bones a clip never
## names stay as the animation left them. Two channels: `stance` (a held pose — the guard, the gun at the ready, the
## sprint lean; loops) under `action` (a one-off — a swing, a dodge, a reload, a hit, a death). Each fades in and out.
##
##   play(name, clip, speed, seconds)   starts a one-off on the action channel (seconds stretches it to a length)
##   stance(name, clip)                 holds a looping pose ("" clears)
##   stop(fade)                         ends the action (a held one — death, jump — stays until stopped)
## `event(name)` fires as a clip passes one of its event marks (hit, mag_out, mag_in, rack, shell, cast …).

const Clips := preload("res://scripts/character/combat_clips.gd")
const StandIdle := preload("res://scripts/character/stand_idle.gd")
const WorkIdle := preload("res://scripts/character/work_idle.gd")

signal event(name: String)
signal finished(name: String)

const FADE_IN := 0.07
const FADE_OUT := 0.12

var _bones := {}            # role -> bone index
var _unit := 1.0            # skeleton units per metre
var _built := false
var _ch := {
	"stance": { "name": "", "clip": {}, "t": 0.0, "len": 1.0, "w": 0.0, "want": 0.0, "speed": 1.0 },
	"action": { "name": "", "clip": {}, "t": 0.0, "len": 1.0, "w": 0.0, "want": 0.0, "speed": 1.0, "fired": 0 },
}
## seconds advanced by the tests when the modifier is not run by a skeleton update
var manual := false
## look-dev: the clock stands still (a pose held at one moment, freeze_at)
var frozen := false

## look-dev and tests: hold `clip` at `u` (0..1) at full weight
func freeze_at(name: String, clip: Dictionary, u: float) -> void:
	play(name, clip)
	var c: Dictionary = _ch.action
	c.t = u * float(c.len)
	c.w = 1.0
	c.fired = 999
	frozen = true

func _sk() -> Skeleton3D:
	var sk := get_skeleton()
	return sk if sk else get_parent() as Skeleton3D

func _setup() -> void:
	var sk := _sk()
	if not sk:
		return
	var roles := { "hips": "Hips", "spine": "Spine", "spine1": "Spine1", "spine2": "Spine2", "head": "Head", "ra": "RightArm", "re": "RightForeArm", "la": "LeftArm", "le": "LeftForeArm", "rt": "RightUpLeg", "rk": "RightLeg", "lt": "LeftUpLeg", "lk": "LeftLeg" }
	for role in roles:
		var suffix: String = roles[role]
		for i in sk.get_bone_count():
			var nm := sk.get_bone_name(i)
			if nm.ends_with(suffix) and not (suffix == "Head" and nm.contains("Top")) and not (suffix == "Spine" and (nm.ends_with("Spine1") or nm.ends_with("Spine2"))):
				_bones[role] = i
				break
	if _bones.has("hips"):
		_unit = maxf(sk.get_bone_global_rest(int(_bones.hips)).origin.y / 0.98, 1e-4)
	_built = true

func play(name: String, clip: Dictionary, speed := 1.0, seconds := -1.0) -> void:
	if clip.is_empty():
		return
	var c: Dictionary = _ch.action
	var was := String(c.name)
	c.name = name
	c.clip = clip
	c.t = 0.0
	c.len = seconds if seconds > 0.0 else float(clip.get("len", 0.5)) / maxf(speed, 0.05)
	c.want = 1.0
	c.fired = 0
	if was == "":
		c.w = 0.0

func stance(name: String, clip: Dictionary = {}) -> void:
	var c: Dictionary = _ch.stance
	if name == String(c.name) and float(c.want) > 0.0:
		return
	if name == "" or clip.is_empty():
		c.want = 0.0
		return
	c.name = name
	c.clip = clip
	c.t = 0.0
	c.len = float(clip.get("len", 1.0))
	c.want = 1.0

func stop(fade := FADE_OUT) -> void:
	_ch.action.want = 0.0
	if fade <= 0.0:
		_ch.action.w = 0.0
		_ch.action.name = ""

func current() -> String:
	return String(_ch.action.name) if float(_ch.action.want) > 0.0 else ""

func stance_name() -> String:
	return String(_ch.stance.name) if float(_ch.stance.want) > 0.0 else ""

## 0..1 through the action
func progress() -> float:
	return clampf(float(_ch.action.t) / maxf(float(_ch.action.len), 1e-4), 0.0, 1.0)

func busy() -> bool:
	return current() != ""

func _process_modification_with_delta(delta: float) -> void:
	if manual:
		return
	apply(delta)

## advance the channels by `dt` and write the pose (the modifier calls this; tests call it by hand)
func apply(dt: float) -> void:
	if frozen:
		dt = 0.0
	if not _built:
		_setup()
	var sk := _sk()
	if not sk or not _built:
		return
	for key in ["stance", "action"]:
		var c: Dictionary = _ch[key]
		if String(c.name) == "":
			continue
		var target := float(c.want)
		c.w = move_toward(float(c.w), target, dt / (FADE_IN if target > float(c.w) else FADE_OUT))
		if float(c.w) <= 0.0 and target <= 0.0:
			if key == "action":
				finished.emit(String(c.name))
			c.name = ""
			continue
		var clip: Dictionary = c.clip
		var len := maxf(float(c.len), 1e-3)
		c.t = float(c.t) + dt
		var u := float(c.t) / len
		if bool(clip.get("loop", false)):
			u = fposmod(u, 1.0)
		elif u >= 1.0:
			u = 1.0
			if key == "action" and not bool(clip.get("hold", false)) and float(c.want) > 0.0:
				c.want = 0.0
		if key == "action":
			var evs: Array = clip.get("events", [])
			while int(c.fired) < evs.size() and float(evs[int(c.fired)][0]) <= u:
				event.emit(String(evs[int(c.fired)][1]))
				c.fired = int(c.fired) + 1
		_write(sk, Clips.sample(clip, u), String(clip.get("mask", "full")), float(c.w))

func _allowed(mask: String, param: String) -> bool:
	match mask:
		"upper":
			return not (param in ["hp", "hr", "hy", "drop", "fwd", "rt", "lt", "rk", "lk"])
		"arms":
			return param in ["ra", "la", "re", "le"]
		"spine":
			return param in ["lean", "twist", "side", "head", "head_turn"]
	return true

func _write(sk: Skeleton3D, p: Dictionary, mask: String, w: float) -> void:
	var has := func(names: Array) -> bool:
		for n in names:
			if p.has(n) and _allowed(mask, n):
				return true
		return false
	var g := func(n: String, d := 0.0) -> float:
		return float(p[n]) if p.has(n) and _allowed(mask, n) else d
	# the spine: lean / twist / side split over its three bones
	if has.call(["lean", "twist", "side"]):
		var q := Quaternion(Vector3.UP, deg_to_rad(g.call("twist") / 3.0)) * Quaternion(Vector3(0, 0, 1), deg_to_rad(-g.call("side") / 3.0)) * Quaternion(Vector3(1, 0, 0), deg_to_rad(g.call("lean") / 3.0))
		for role in ["spine", "spine1", "spine2"]:
			if _bones.has(role):
				_set_rot(sk, int(_bones[role]), StandIdle._turned(sk, int(_bones[role]), q), w)
	if has.call(["head", "head_turn"]) and _bones.has("head"):
		var hq := Quaternion(Vector3.UP, deg_to_rad(g.call("head_turn"))) * Quaternion(Vector3(1, 0, 0), deg_to_rad(g.call("head")))
		_set_rot(sk, int(_bones.head), StandIdle._turned(sk, int(_bones.head), hq), w)
	if _bones.has("hips"):
		var hi := int(_bones.hips)
		if has.call(["hp", "hr", "hy"]):
			var q2 := Quaternion(Vector3.UP, deg_to_rad(g.call("hy"))) * Quaternion(Vector3(0, 0, 1), deg_to_rad(-g.call("hr"))) * Quaternion(Vector3(1, 0, 0), deg_to_rad(g.call("hp")))
			_set_rot(sk, hi, StandIdle._turned(sk, hi, q2), w)
		if has.call(["drop", "fwd"]):
			var base := sk.get_bone_pose_position(hi)
			var off := Vector3(0, -g.call("drop"), g.call("fwd")) * _unit
			sk.set_bone_pose_position(hi, base + off * w)
	for arm in ARMS:
		if p.has(arm) and _allowed(mask, arm) and _bones.has(arm):
			var a: Array = p[arm]
			_set_rot(sk, int(_bones[arm]), _arm(sk, int(_bones[arm]), float(a[0]), float(a[1]), float(a[2]) if a.size() > 2 else 0.0), w)
	for fore in ["re", "le"]:
		if p.has(fore) and _allowed(mask, fore) and _bones.has(fore):
			_set_rot(sk, int(_bones[fore]), WorkIdle._elbow(sk, int(_bones[fore]), float(p[fore])), w)
	for th in ["rt", "lt"]:
		if p.has(th) and _allowed(mask, th) and _bones.has(th):
			var t: Array = p[th]
			_set_rot(sk, int(_bones[th]), _thigh(sk, int(_bones[th]), float(t[0]), float(t[1]) if t.size() > 1 else 0.0), w)
	for kn in ["rk", "lk"]:
		if p.has(kn) and _allowed(mask, kn) and _bones.has(kn):
			var i := int(_bones[kn])
			_set_rot(sk, i, StandIdle._turned(sk, i, WorkIdle._bend(WorkIdle._dir(sk, i), -float(p[kn]))), w)

const ARMS := ["ra", "la"]

func _set_rot(sk: Skeleton3D, i: int, q: Quaternion, w: float) -> void:
	if w >= 0.999:
		sk.set_bone_pose_rotation(i, q)
	else:
		sk.set_bone_pose_rotation(i, sk.get_bone_pose_rotation(i).slerp(q, w))

## an upper arm: lowered from the rest A-pose as the stand lowers it, raised back out by `out`, swung forward by `fwd`
## and across the body by `across` (work_idle.gd's arm with the abduction added)
static func _arm(sk: Skeleton3D, i: int, fwd: float, across: float, out: float) -> Quaternion:
	var ad := WorkIdle._dir(sk, i)
	var side := signf(ad.x)
	var lower := maxf(atan2(absf(ad.x), -ad.y) - deg_to_rad(9.0), 0.0) - deg_to_rad(out)
	var lowq := Quaternion(Vector3(0, 0, 1), -side * lower)
	var d := lowq * ad
	var r := Quaternion(Vector3(0, 1, 0), -side * deg_to_rad(across)) * WorkIdle._bend(d, fwd) * lowq
	return StandIdle._turned(sk, i, r)

## a thigh swung forward by `fwd` and out to its side by `out`
static func _thigh(sk: Skeleton3D, i: int, fwd: float, out: float) -> Quaternion:
	var d := WorkIdle._dir(sk, i)
	var side := signf(sk.get_bone_global_rest(i).origin.x)
	var outq := Quaternion(Vector3(0, 0, 1), side * deg_to_rad(out))
	return StandIdle._turned(sk, i, WorkIdle._bend(outq * d, fwd) * outq)
