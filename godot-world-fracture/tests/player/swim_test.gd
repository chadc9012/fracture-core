extends SceneTree
## Swimming (operator_player.gd `swim_at`): a beach shelving into deep water, set up the way region_3d.gd fit_walker does
## it — wade the shallows on the bed, swim where it is deeper than SWIM_DEPTH with the feet held under the surface, no
## jump in the water, slower than on land, the guns stowed, and back out onto the sand.
const Player = preload("res://scripts/player/operator_player.gd")
const DEPTH := 1.3

func _init() -> void:
	var p := Player.new()
	root.add_child(p)
	p.bounds = Rect2(-100, -100, 200, 200)
	# the sand at y 0 for x < 0, then the bed falls 0.25 m per metre out to sea; the surface is y 0
	var bed := func(x: float) -> float: return 0.0 if x < 0.0 else -0.25 * x
	p.ground_at = func(x: float, _z: float) -> float: return maxf(bed.call(x), -DEPTH)
	p.swim_at = func(x: float, _z: float) -> float: return 0.0 if (bed.call(x) as float) < -DEPTH else -INF
	p.cam_floor = func(x: float, _z: float) -> float: return maxf(bed.call(x), 0.4)
	p.cam_yaw = -PI * 0.5      # the camera looks along +x: the stick's forward walks out to sea
	p.position = Vector3(-3, 0, 0)
	var ok := true
	var dt := 1.0 / 60.0
	# wading in: the feet on the bed, not swimming yet
	while p.position.x < 3.0:
		p.step(dt, Vector2(0, 1), Vector2.ZERO, false, false)
	var wade := not p.swimming and absf(p.position.y - (bed.call(p.position.x) as float)) < 0.2
	ok = ok and wade
	print("wades the shallows on the bed: ", wade, " ", p.position)
	# out of depth: swimming, held under the surface, slower than a walk-run
	var top := 0.0
	for i in 240:
		p.step(dt, Vector2(0, 1), Vector2.ZERO, false, true)
		if i < 90:
			continue   # the speed carried in from the run eases off first
		top = maxf(top, Vector2(p.velocity.x, p.velocity.z).length())
	var swims := p.swimming and absf(p.position.y + DEPTH) < 0.05 and top <= Player.SWIM_FAST + 0.01 and top > Player.SWIM * 0.9
	ok = ok and swims
	print("swims out of depth: ", swims, " y ", p.position.y, " top speed ", top)
	# no jumping off the water
	p.step(dt, Vector2.ZERO, Vector2.ZERO, true, false)
	for i in 30:
		p.step(dt, Vector2.ZERO, Vector2.ZERO, false, false)
	var nojump := p.swimming and absf(p.position.y + DEPTH) < 0.05
	ok = ok and nojump
	print("no jump in the water: ", nojump)
	# the guns are stowed while swimming and come back on the shore
	var Gunplay = load("res://scripts/combat/gunplay.gd")
	var g = Gunplay.new()
	g.player = p
	g.follow_swim()
	var stowed: bool = g.holstered
	# back to the beach
	p.cam_yaw = PI * 0.5
	for i in 900:
		p.step(dt, Vector2(0, 1), Vector2.ZERO, false, false)
		if p.position.x < -1.0:
			break
	g.follow_swim()
	var ashore: bool = not p.swimming and absf(p.position.y) < 0.05 and p.position.x < -0.5 and not g.holstered and stowed
	ok = ok and ashore
	print("stows the guns and walks back up the beach: ", ashore, " ", p.position, " stowed ", stowed)
	# the camera stays above the water
	var cam := Camera3D.new()
	root.add_child(cam)
	p.position = Vector3(20, -DEPTH, 0)
	p.attach_camera(cam)
	p.cam_pitch = 0.4
	for i in 10:
		p.step(dt, Vector2.ZERO, Vector2.ZERO, false, false)
	var dry := cam.position.y > 0.35
	ok = ok and dry
	print("camera above the surface: ", dry, " ", cam.position.y)
	g.free()
	print("SWIM ", "PASS" if ok else "FAIL")
	quit(0 if ok else 1)
