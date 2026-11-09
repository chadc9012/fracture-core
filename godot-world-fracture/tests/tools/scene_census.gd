extends SceneTree
## Opens each playable scene headless and counts what a phone's frame pays for: mesh draws (surfaces, before culling),
## triangles, lights (and which cast shadows), transparent and unshaded materials, particles, 3D labels; plus the CPU
## time of a frame of the game's own scripts (headless, nothing is drawn, so this is the scripts' share of the frame).
##   godot --headless --path godot-world-fracture --script res://tests/tools/scene_census.gd [-- <scene> ...]
## Scenes: street-<style>-<day|night>, mall, casino, sports, m1, descent, killbox, raid, street-race, speedway, drive,
## garage, region-<id>. Writes user://census.json and prints a table.

var main: Node
var rows: Array = []

func _initialize() -> void:
	_run.call_deferred()

func frames(n: int) -> void:
	for i in n:
		await process_frame

func _run() -> void:
	main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	await frames(10)
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
		await frames(3)
	var wanted: Array = Array(OS.get_cmdline_user_args())
	if wanted.is_empty():
		wanted = ["street-nexus-night", "street-nexus-day", "street-neon-night", "street-coast-day", "mall", "casino", "sports", "m1", "descent", "killbox", "raid", "street-race", "speedway", "drive", "garage", "region-veridan", "region-nexus", "region-solara"]
	for s in wanted:
		var opened := await _open(String(s))
		if not opened:
			print("could not open ", s)
			continue
		await frames(30)
		var r := _count(String(s))
		r["script_ms"] = await _script_ms()
		rows.append(r)
		print("%-20s draws %5d  tris %8d  lights %3d (shadow %2d)  transp %4d  particles %3d  labels %4d  nodes %6d  script %.2f ms" % [s, r.draws, r.tris, r.lights, r.shadow_lights, r.transparent, r.particles, r.labels, r.nodes, r.script_ms])
		for top in r.top_lights:
			pass
		await _close(String(s))
		await frames(5)
	var f := FileAccess.open("user://census.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(rows, "  "))
	quit()

func _open(s: String) -> bool:
	if s.begins_with("street-") and s != "street-race":
		var p := s.split("-")
		main._open_street(p[2] == "night", p[1], true)
		return main.street != null
	match s:
		"mall", "casino", "sports":
			main._open_street(false, "nexus", true)
			if not main.street:
				return false
			var fn: String = { "mall": "open_mall", "casino": "open_casino", "sports": "open_sports" }[s]
			if main.street.has_method(fn):
				main.street.call(fn)
			else:
				print("  (no ", fn, " on the street)")
			return true
		"m1":
			main._open_mission()
			return main.mission != null
		"descent":
			main._open_descent()
			return main.descent != null
		"killbox":
			main._open_killbox()
			return main.killbox != null
		"raid":
			main._open_modes()
			main.modes.open_mode("raids")
			main.modes._launch_raid("broken-gate")
			return true
		"street-race":
			main._open_modes()
			main.modes.open_mode("races")
			main.modes._launch_race("neon-circuit")
			return true
		"speedway":
			main._open_race()
			return main.race_view != null
		"drive":
			main._open_drive()
			return main.driving != null
		"garage":
			main._open_garage()
			return main.garage != null
	if s.begins_with("region-"):
		main._open_map(s.substr(7))
		main._open_3d(s.substr(7), null, true)
		return main.region_3d != null
	return false

func _close(s: String) -> void:
	for fn in ["_close_3d", "_close_map", "_close_street", "_close_mission", "_close_descent", "_close_killbox", "_close_modes", "_close_race", "_close_drive", "_close_garage"]:
		main.call(fn)

## the scripts' own share of a frame: the engine's process + physics time (headless draws nothing; frames here are
## throttled, so wall time would only show the sleep)
func _script_ms() -> float:
	var times: Array[float] = []
	for i in 60:
		await process_frame
		times.append((Performance.get_monitor(Performance.TIME_PROCESS) + Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)) * 1000.0)
	times.sort()
	return times[times.size() / 2]

func _count(s: String) -> Dictionary:
	var r := { "scene": s, "draws": 0, "tris": 0, "lights": 0, "shadow_lights": 0, "transparent": 0, "particles": 0, "labels": 0, "nodes": 0, "top_lights": [], "top_meshes": {} }
	var mats := {}
	var by_src := {}
	for n in root.find_children("*", "", true, false):
		r.nodes += 1
		if n is Node3D and not (n as Node3D).is_visible_in_tree():
			continue
		if n is Light3D:
			var l := n as Light3D
			if l is DirectionalLight3D:
				if l.shadow_enabled:
					r.shadow_lights += 1
				continue
			r.lights += 1
			if l.shadow_enabled:
				r.shadow_lights += 1
			var src := _src(n)
			by_src["light " + src] = by_src.get("light " + src, 0) + 1
		elif n is GPUParticles3D or n is CPUParticles3D:
			r.particles += 1
		elif n is Label3D:
			r.labels += 1
		elif n is MeshInstance3D and (n as MeshInstance3D).mesh:
			var mi := n as MeshInstance3D
			var sc := mi.mesh.get_surface_count()
			r.draws += sc
			var src2 := _src(n)
			by_src["mesh " + src2] = by_src.get("mesh " + src2, 0) + sc
			for i in sc:
				var m: Material = mi.get_active_material(i)
				if m is BaseMaterial3D and (m as BaseMaterial3D).transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
					r.transparent += 1
				var arr := mi.mesh.surface_get_arrays(i) if mi.mesh is ArrayMesh else []
				if arr.size() > Mesh.ARRAY_INDEX and arr[Mesh.ARRAY_INDEX] != null:
					r.tris += (arr[Mesh.ARRAY_INDEX] as PackedInt32Array).size() / 3
				elif arr.size() > 0 and arr[Mesh.ARRAY_VERTEX] != null:
					r.tris += (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size() / 3
		elif n is MultiMeshInstance3D and (n as MultiMeshInstance3D).multimesh and (n as MultiMeshInstance3D).multimesh.mesh:
			r.draws += (n as MultiMeshInstance3D).multimesh.mesh.get_surface_count()
	var keys := by_src.keys()
	keys.sort_custom(func(a, b) -> bool: return by_src[a] > by_src[b])
	for k in keys.slice(0, 12):
		r.top_meshes[k] = by_src[k]
	return r

## the nearest script up the tree that built this node, to name where draws and lights come from
func _src(n: Node) -> String:
	var p := n
	while p:
		if p.get_script():
			return (p.get_script() as Script).resource_path.get_file()
		p = p.get_parent()
	return "?"
