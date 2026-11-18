extends RefCounted
## Job idles for the named people (TASKBOARD "NPC lane: job animations"): what someone does standing at their place of
## work, built the way stand_idle.gd builds the stand — from the rig's rest pose, skeleton-space turns on top of each
## bone's rest, every other bone the body's old clip moved held still. Five clips go into every body's library:
##   work_counter  hands up on the counter, wiping and setting things down (baristas, clerks, stalls, desks, doors)
##   work_tool     bent over the job, the right arm working a tool (mechanics, engineers, miners, foremen, research)
##   sit           sat down: thighs forward, shins down, hands on the lap, the hips dropped to a bench
##   busk          the street musician: a guitar held across the body, the right hand strumming
##   wait          a phone to the ear, the head tipped to it
## operator_player.gd plays `idle_clip` in place of "idle" when the mover stands still; npc_street.gd picks the clip by
## activity and job (clip_for). Every clip loops; walking and running blend out of them as they do out of the stand.

const StandIdle := preload("res://scripts/character/stand_idle.gd")
const CLIPS := ["work_counter", "work_tool", "sit", "busk", "wait"]
const LOOP := 4.0
const KEYS := 13
const SIT_DROP := 0.42   # how far the hips come down onto a bench, metres

## the clip for someone at their place: by activity first, then the job's words
static func clip_for(activity: String, job: String) -> String:
	match activity:
		"sit":
			return "sit"
		"play":
			return "busk"
		"wait":
			return "wait"
		"work":
			var j := job.to_lower()
			for w in ["mechanic", "engineer", "miner", "foreman", "repair", "fisherman", "diver", "researcher", "glaciologist", "hacker", "warden", "ranger", "scout", "solar"]:
				if j.contains(w):
					return "work_tool"
			for w in ["barista", "clerk", "stall", "concierge", "attendant", "agent", "trader", "door", "pit boss", "recruiter", "nurse", "consultant", "promoter", "fixer", "captain", "marshal"]:
				if j.contains(w):
					return "work_counter"
			return "work_counter"
	return "idle"

static func install(ap: AnimationPlayer, sk: Skeleton3D) -> void:
	var old: Animation = ap.get_animation("idle")
	if old == null or ap.has_animation("work_counter"):
		return
	var lib_name := ""
	for ln in ap.get_animation_library_list():
		if ap.get_animation_library(ln).has_animation("idle"):
			lib_name = ln
	var lib := ap.get_animation_library(lib_name)
	var prefix := ""
	for t in old.get_track_count():
		var path := String(old.track_get_path(t))
		if path.contains(":"):
			prefix = path.get_slice(":", 0)
			break
	if prefix == "":
		return
	var bones := {}
	var with_pos := {}
	for t in old.get_track_count():
		var path := String(old.track_get_path(t))
		var bone := path.get_slice(":", 1)
		if sk.find_bone(bone) < 0:
			continue
		bones[bone] = true
		if old.track_get_type(t) == Animation.TYPE_POSITION_3D:
			with_pos[bone] = true
	for clip in CLIPS:
		var a := Animation.new()
		a.length = LOOP
		a.loop_mode = Animation.LOOP_LINEAR
		for bone in bones:
			var i := sk.find_bone(bone)
			var rt := a.add_track(Animation.TYPE_ROTATION_3D)
			a.track_set_path(rt, NodePath("%s:%s" % [prefix, bone]))
			var moves := _moves(sk, i, clip)
			if not moves.is_valid():
				moves = StandIdle._moves(sk, i)
			for k in KEYS:
				var tt := LOOP * float(k) / (KEYS - 1)
				a.rotation_track_insert_key(rt, tt, moves.call(tt) if moves.is_valid() else sk.get_bone_rest(i).basis.get_rotation_quaternion())
			if with_pos.has(bone):
				var pt := a.add_track(Animation.TYPE_POSITION_3D)
				a.track_set_path(pt, NodePath("%s:%s" % [prefix, bone]))
				var at: Vector3 = sk.get_bone_rest(i).origin
				if clip == "sit" and bone.ends_with("Hips"):
					at.y -= SIT_DROP
				a.position_track_insert_key(pt, 0.0, at)
		lib.add_animation(clip, a)

static func _rx(sk: Skeleton3D, i: int, deg: float) -> Quaternion:
	return StandIdle._turned(sk, i, Quaternion(Vector3(1, 0, 0), deg_to_rad(deg)))

## the direction a bone runs in (to its first child), in skeleton space at rest
static func _dir(sk: Skeleton3D, i: int) -> Vector3:
	var g := sk.get_bone_global_rest(i)
	var ch := sk.get_bone_children(i)
	return ((sk.get_bone_global_rest(ch[0]).origin - g.origin).normalized()) if ch.size() else g.basis.y
## a hinge turn that swings a limb running along `d` toward the front (+z) by `deg` (negative: back). About the
## skeleton's x this would twist an A-pose arm as much as bend it, since the arm runs 37° out from straight down.
static func _bend(d: Vector3, deg: float) -> Quaternion:
	var axis := d.cross(Vector3(0, 0, 1))
	if axis.length() < 0.05:
		axis = Vector3(1, 0, 0)
	return Quaternion(axis.normalized(), deg_to_rad(deg))
## the forearm's run once the stand has lowered the upper arm to the side (stand_idle.gd: the rest angle out, less 9°)
static func _fore_dir(sk: Skeleton3D, i: int) -> Vector3:
	var d := _dir(sk, i)
	var pa := sk.get_bone_parent(i)
	if pa < 0:
		return d
	var ad := _dir(sk, pa)
	var side := signf(ad.x)
	var lower := maxf(atan2(absf(ad.x), -ad.y) - deg_to_rad(9.0), 0.0)
	return Quaternion(Vector3(0, 0, 1), -side * lower) * d
## a forearm bent toward the front by `deg` on the lowered arm
static func _elbow(sk: Skeleton3D, i: int, deg: float) -> Quaternion:
	return StandIdle._turned(sk, i, _bend(_fore_dir(sk, i), deg))
## an upper arm lowered by the stand, then swung forward (`fwd`) and across the body (`across`, toward the middle)
static func _arm(sk: Skeleton3D, i: int, t: float, fwd: float, across := 0.0) -> Quaternion:
	var ad := _dir(sk, i)
	var side := signf(ad.x)
	var lower := maxf(atan2(absf(ad.x), -ad.y) - deg_to_rad(9.0), 0.0)
	var w := TAU / LOOP
	var sway := deg_to_rad(1.2) * sin(t * w + (0.0 if side > 0.0 else 0.6))
	var lowq := Quaternion(Vector3(0, 0, 1), -side * (lower + sway))
	var d := lowq * ad
	var r := Quaternion(Vector3(0, 1, 0), -side * deg_to_rad(across)) * _bend(d, fwd) * lowq * Quaternion(Vector3(1, 0, 0), deg_to_rad(-4.0))
	return StandIdle._turned(sk, i, r)

## the clip's motion for one bone, as a Callable(time) -> local rotation; invalid to take the stand's
static func _moves(sk: Skeleton3D, i: int, clip: String) -> Callable:
	var nm := sk.get_bone_name(i)
	var w := TAU / LOOP
	var left := nm.contains("Left")
	var right := nm.contains("Right")
	var arm := nm.ends_with("LeftArm") or nm.ends_with("RightArm")
	var fore := nm.ends_with("ForeArm")
	var upleg := nm.ends_with("UpLeg")
	var leg := nm.ends_with("LeftLeg") or nm.ends_with("RightLeg")
	var head := nm.ends_with("Head") and not nm.contains("Top")
	var spine1 := nm.ends_with("Spine1")
	match clip:
		"work_counter":
			if fore:
				# hands up to counter height, wiping across and setting things down
				return func(t: float) -> Quaternion:
					return _elbow(sk, i, 78.0 + 6.0 * sin(t * w * 2.0 + (0.0 if left else PI)))
			if arm:
				return func(t: float) -> Quaternion:
					return _arm(sk, i, t, 10.0, 8.0 * sin(t * w * 2.0 + (0.0 if left else PI)))
			if head:
				return func(t: float) -> Quaternion:
					return _rx(sk, i, 10.0 + 1.5 * sin(t * w))
		"work_tool":
			if spine1:
				return func(t: float) -> Quaternion:
					return _rx(sk, i, 22.0 + 1.5 * sin(t * w * 2.0))
			if fore and right:
				# the tool hand pumps
				return func(t: float) -> Quaternion:
					return _elbow(sk, i, 64.0 + 24.0 * sin(t * w * 2.5))
			if fore and left:
				return func(t: float) -> Quaternion:
					return _elbow(sk, i, 44.0 + 3.0 * sin(t * w * 2.5))
			if arm:
				return func(t: float) -> Quaternion:
					return _arm(sk, i, t, 22.0 if right else 14.0)
			if head:
				return func(_t: float) -> Quaternion:
					return _rx(sk, i, 20.0)
		"sit":
			if upleg:
				return func(_t: float) -> Quaternion:
					return StandIdle._turned(sk, i, _bend(_dir(sk, i), 84.0))
			if leg:
				return func(_t: float) -> Quaternion:
					return StandIdle._turned(sk, i, _bend(_dir(sk, i), -82.0))
			if fore:
				# hands on the lap
				return func(t: float) -> Quaternion:
					return _elbow(sk, i, 60.0 + 2.0 * sin(t * w))
			if arm:
				return func(t: float) -> Quaternion:
					return _arm(sk, i, t, 12.0, 6.0)
			if spine1:
				return func(t: float) -> Quaternion:
					return _rx(sk, i, 6.0 + 1.0 * sin(t * w))
		"busk":
			if arm and left:
				# the fretting arm out across the body
				return func(t: float) -> Quaternion:
					return _arm(sk, i, t, 40.0, 30.0)
			if arm and right:
				return func(t: float) -> Quaternion:
					return _arm(sk, i, t, 26.0, 10.0)
			if fore and left:
				return func(_t: float) -> Quaternion:
					return _elbow(sk, i, 95.0)
			if fore and right:
				# the strum
				return func(t: float) -> Quaternion:
					return _elbow(sk, i, 80.0 + 14.0 * sin(t * w * 4.0))
			if head:
				return func(t: float) -> Quaternion:
					return StandIdle._turned(sk, i, Quaternion(Vector3(1, 0, 0), deg_to_rad(12.0)) * Quaternion(Vector3(0, 0, 1), deg_to_rad(6.0) * sin(t * w)))
		"wait":
			if fore and right:
				# the phone to the ear
				return func(t: float) -> Quaternion:
					return _elbow(sk, i, 140.0 + 1.5 * sin(t * w))
			if arm and right:
				return func(t: float) -> Quaternion:
					return _arm(sk, i, t, 14.0, 14.0)
			if head:
				return func(t: float) -> Quaternion:
					return StandIdle._turned(sk, i, Quaternion(Vector3(0, 0, 1), deg_to_rad(-9.0)) * Quaternion(Vector3(1, 0, 0), deg_to_rad(4.0 * sin(t * w * 0.5))))
	return Callable()
