extends RefCounted
## The operators' standing idle. The bodies' own "idle" clip (auto-rigged, retargeted) sits badly on these skeletons: bowed
## knees, arms swung out and forward, and a hunch with one fist pulled to the chest partway through the loop (owner, Nov 9:
## "fix posture"). This replaces that clip, on every body, with a stand built from the rig's rest pose — which is upright
## with straight legs — lowering the arms from the rest A-pose to the sides with a soft bend at the elbows, and adding a
## slow breath through the chest, a little sway in the arms and a small turn of the head. Every caller that plays "idle"
## (the creator, the street, missions, enemies, civilians) gets it, and it blends into walk and run as before.
##
## Rotations are written as skeleton-space turns applied on top of each bone's rest: for a bone with global rest basis G,
## a skeleton-space rotation R becomes the local rest rotation times G⁻¹·R·G.

const LOOP := 4.0
const KEYS := 9

static func _bone(sk: Skeleton3D, suffix: String) -> int:
	for i in sk.get_bone_count():
		if sk.get_bone_name(i).ends_with(suffix):
			return i
	return -1

## the local rotation that turns bone `i` by skeleton-space `r` from its rest
static func _turned(sk: Skeleton3D, i: int, r: Quaternion) -> Quaternion:
	var g := sk.get_bone_global_rest(i).basis.get_rotation_quaternion()
	var rest := sk.get_bone_rest(i).basis.get_rotation_quaternion()
	return rest * (g.inverse() * r * g)

static func install(ap: AnimationPlayer, sk: Skeleton3D) -> void:
	var old: Animation = ap.get_animation("idle")
	if old == null or old.has_meta("stand_idle"):
		return
	var lib_name := ""
	for ln in ap.get_animation_library_list():
		if ap.get_animation_library(ln).has_animation("idle"):
			lib_name = ln
	var lib := ap.get_animation_library(lib_name)
	# the skeleton's path as the old clip addresses it ("Skeleton3D:mixamorig_Hips" and the like)
	var prefix := ""
	for t in old.get_track_count():
		var path := String(old.track_get_path(t))
		if path.contains(":"):
			prefix = path.get_slice(":", 0)
			break
	if prefix == "":
		return
	var a := Animation.new()
	a.length = LOOP
	a.loop_mode = Animation.LOOP_LINEAR
	a.set_meta("stand_idle", true)
	# every bone the old clip moved is held at rest (so nothing is left where the old clip had it)...
	var done := {}
	for t in old.get_track_count():
		var path := String(old.track_get_path(t))
		var bone := path.get_slice(":", 1)
		var i := sk.find_bone(bone)
		if i < 0 or done.has(bone):
			continue
		done[bone] = true
		var rt := a.add_track(Animation.TYPE_ROTATION_3D)
		a.track_set_path(rt, NodePath("%s:%s" % [prefix, bone]))
		var moves := _moves(sk, i)
		for k in KEYS:
			var tt := LOOP * float(k) / (KEYS - 1)
			a.rotation_track_insert_key(rt, tt, moves.call(tt) if moves.is_valid() else sk.get_bone_rest(i).basis.get_rotation_quaternion())
		if old.find_track(NodePath(path), Animation.TYPE_POSITION_3D) >= 0 and not done.has(bone + "#p"):
			done[bone + "#p"] = true
			var pt := a.add_track(Animation.TYPE_POSITION_3D)
			a.track_set_path(pt, NodePath("%s:%s" % [prefix, bone]))
			a.position_track_insert_key(pt, 0.0, sk.get_bone_rest(i).origin)
	lib.remove_animation("idle")
	lib.add_animation("idle", a)

## the stand's motion for one bone, as a Callable(time) -> local rotation, or an invalid Callable for "hold at rest"
static func _moves(sk: Skeleton3D, i: int) -> Callable:
	var nm := sk.get_bone_name(i)
	var w := TAU / LOOP
	if nm.ends_with("LeftArm") or nm.ends_with("RightArm"):
		# lower the arm from the rest A-pose to the side: turn about the forward axis, toward the body
		var g := sk.get_bone_global_rest(i)
		var c := sk.get_bone_global_rest(sk.get_bone_children(i)[0]).origin if sk.get_bone_children(i).size() else g.origin + g.basis.y
		var dir := (c - g.origin).normalized()
		var side := signf(dir.x)
		var from := atan2(absf(dir.x), -dir.y)          # the rest angle out from straight down
		var lower := maxf(from - deg_to_rad(9.0), 0.0)  # leave the arm ~9 degrees out from the side
		var ph := 0.0 if side > 0.0 else 0.6
		return func(t: float) -> Quaternion:
			var sway := deg_to_rad(1.2) * sin(t * w + ph)
			var r := Quaternion(Vector3(0, 0, 1), -side * (lower + sway)) * Quaternion(Vector3(1, 0, 0), deg_to_rad(-4.0))
			return _turned(sk, i, r)
	if nm.ends_with("LeftForeArm") or nm.ends_with("RightForeArm"):
		# a soft bend at the elbow, hands a little forward of the thighs
		return func(t: float) -> Quaternion:
			return _turned(sk, i, Quaternion(Vector3(1, 0, 0), deg_to_rad(-14.0 - 2.0 * sin(t * w))))
	if nm.ends_with("Spine2"):
		# the breath: the chest lifts and opens
		return func(t: float) -> Quaternion:
			return _turned(sk, i, Quaternion(Vector3(1, 0, 0), deg_to_rad(-1.4) * (0.5 + 0.5 * sin(t * w))))
	if nm.ends_with("Spine1"):
		return func(t: float) -> Quaternion:
			return _turned(sk, i, Quaternion(Vector3(1, 0, 0), deg_to_rad(-0.6) * (0.5 + 0.5 * sin(t * w))))
	if nm.ends_with("Head") and not nm.contains("Top"):
		# a small, slow look round and a level chin
		return func(t: float) -> Quaternion:
			return _turned(sk, i, Quaternion(Vector3(0, 1, 0), deg_to_rad(2.5) * sin(t * w * 0.5)) * Quaternion(Vector3(1, 0, 0), deg_to_rad(0.8) * sin(t * w)))
	return Callable()
