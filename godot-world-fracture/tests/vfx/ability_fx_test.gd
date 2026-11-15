extends SceneTree
## The ability visuals (scripts/vfx/ability_fx.gd): the charge shell covers the body's meshes, the blast leaves its
## pieces and frees them, the dash leaves three afterimages behind the body (baked in the pose) and a streak.
##   godot --headless --path godot-world-fracture --script res://tests/vfx/ability_fx_test.gd
const Player := preload("res://scripts/player/operator_player.gd")
const AbilityFx := preload("res://scripts/vfx/ability_fx.gd")
var ok := true

func check(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	ok = ok and c

func _init() -> void:
	process_frame.connect(_run, CONNECT_ONE_SHOT)

func _run() -> void:
	var world := Node3D.new()
	root.add_child(world)
	var p := Player.new()
	world.add_child(p)
	p.civilian = false
	p.build()
	await process_frame
	var meshes := p.rig.find_children("*", "MeshInstance3D", true, false).size()
	check(meshes > 0, "the body has meshes: %d" % meshes)
	var charge := AbilityFx.charge(p.rig, 0.3, Color(0.4, 0.9, 1.0))
	var shells := 0
	for m in p.rig.find_children("*", "MeshInstance3D", true, false):
		if m.has_meta("charge_shell"):
			shells += 1
	check(shells == meshes, "the charge shells every mesh: %d" % shells)
	check(charge.get_child_count() >= 3, "the charge has its orb, light and motes")
	var before := world.get_child_count()
	AbilityFx.blast(world, p.global_position + Vector3(0, 1, 3), 6.5, Color(0.4, 0.9, 1.0), Color(0.8, 0.45, 1.0), null, Callable())
	check(world.get_child_count() - before >= 6, "the blast leaves its pieces: %d" % (world.get_child_count() - before))
	check(Engine.time_scale < 1.0, "the hit-stop is on")
	before = world.get_child_count()
	AbilityFx.dash(world, p.rig, Vector3(0, 0, -1), Color(0.4, 0.9, 1.0), null)
	p.rig.global_position.z -= 1.5   # the body moves on; the later afterimages are left where it is then
	for i in 4:
		await process_frame
	await create_timer(0.2).timeout
	var ghosts: Array = []
	for c in world.get_children():
		if c is Node3D and c.get_child_count() > 0 and (c.get_child(0) as Node).has_meta("ghost"):
			ghosts.append(c)
	# the pose bake needs a drawn frame (the skin registered with the renderer); headless has none, so the dash leaves
	# its streak and no afterimage here — the shot m1:anchor:dash shows them
	check(ghosts.size() == 3 or (ghosts.is_empty() and DisplayServer.get_name() == "headless"), "three afterimages (none headless): %d" % ghosts.size())
	if ghosts.size() == 3:
		check((ghosts[0] as Node3D).global_position.z > p.rig.global_position.z + 1.0 and (ghosts[2] as Node3D).global_position.distance_to(p.rig.global_position) < 0.01, "the afterimages trail behind the body")
		var baked: Mesh = (ghosts[0].get_child(0) as MeshInstance3D).mesh
		check(baked != null and baked.get_surface_count() > 0, "the afterimage is a baked mesh with surfaces")
		print("     afterimage aabb ", baked.get_aabb(), " at ", (ghosts[0].get_child(0) as Node3D).global_position, " body at ", p.rig.global_position, " mesh aabb ", (p.rig.find_children("*", "MeshInstance3D", true, false)[0] as MeshInstance3D).get_aabb())
	await create_timer(4.0).timeout   # real seconds (frames fly without vsync)
	check(Engine.time_scale == 1.0, "the hit-stop ends")
	check(world.get_child_count() == 1, "every piece frees itself: %d left" % (world.get_child_count() - 1))
	print("ability fx test: ", ok)
	quit(0 if ok else 1)
