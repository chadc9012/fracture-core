extends SceneTree
## Props that stand inside each other (a planter through a palm, a car parked into a bus shelter, a lamp in a café
## table): every placed prop on the street slices (the holders prop() sizes, the parked cars) is checked against every
## other in the same block by footprint, and against the road. Buildings may touch each other (terraces share walls).
##   godot --headless --path godot-world-fracture --script res://tests/tools/overlap_scan.gd
## Prints each overlap and "overlaps: N"; exits non-zero when there are any.

var main: Node
var found := 0

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	for i in 10:
		await process_frame
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
	for style in ["nexus", "neon", "coast"]:
		for night in [false, true]:
			main._open_street(night, style, true)
			for i in 6:
				await process_frame
			_scan(main.street, "%s %s" % [style, "night" if night else "day"])
			main._close_street()
			for i in 4:
				await process_frame
	print("overlaps: %d" % found)
	quit(1 if found > 0 else 0)

func _is_building(f: String) -> bool:
	for k in ["apartment", "brick", "office", "deco", "villa", "casino", "buildings/", "shopfront"]:
		if f.contains(k):
			return true
	return false

func _scan(st: Node, label: String) -> void:
	var roots: Array[Node3D] = [st.world]
	for c in st.world.get_children():
		if String(c.name).begins_with("tile_"):
			roots.append(c)
	var road := float(st.ROAD_W) * 0.5
	for r in roots:
		var items: Array = []
		for c in r.get_children():
			var n := c as Node3D
			if not n or not (n.has_meta("size") or n.has_meta("car")):
				continue
			var sz: Vector3 = n.get_meta("size") if n.has_meta("size") else Vector3(2.0, 1.5, 4.5)
			var f := String(n.get_meta("file")) if n.has_meta("file") else ("car" if n.has_meta("car") or n.has_meta("size") and not n.has_meta("file") else "?")
			# a footprint in the root's space: palms and lamps are a trunk / a post, not their crown or arm
			if f.contains("palm") or f.begins_with("street-lamp") or f.contains("lamp"):
				sz = Vector3(0.6, sz.y, 0.6)
			var basis := n.transform.basis
			var ex := (basis * Vector3(sz.x * 0.5, 0, 0)).abs() + (basis * Vector3(0, 0, sz.z * 0.5)).abs()
			var p := n.position
			items.append({ "f": f, "lo": Vector2(p.x - ex.x, p.z - ex.z), "hi": Vector2(p.x + ex.x, p.z + ex.z), "y": p.y, "h": sz.y })
		if label == "nexus day":
			print("  %s: %d placed" % [r.name, items.size()])
		for i in items.size():
			var a: Dictionary = items[i]
			# nothing but cars stands in the carriageway (the parked lane is the outer 2.8 m)
			if a.f != "car" and not _is_building(a.f) and a.lo.x < road - 2.8 and a.hi.x > -road + 2.8 and a.y < 1.0:
				found += 1
				print("IN THE ROAD %s [%s] %s at %s" % [label, r.name, a.f, str(((a.lo + a.hi) * 0.5).round())])
			for j in range(i + 1, items.size()):
				var b: Dictionary = items[j]
				if _is_building(a.f) and _is_building(b.f):
					continue
				var ox := minf(a.hi.x, b.hi.x) - maxf(a.lo.x, b.lo.x)
				var oz := minf(a.hi.y, b.hi.y) - maxf(a.lo.y, b.lo.y)
				# a sign or awning above a doorway is not an overlap: only things standing on the same ground
				if absf(a.y - b.y) > 1.0:
					continue
				if ox > 0.15 and oz > 0.15:
					found += 1
					if found <= 60:
						print("OVERLAP %s [%s] %s at %s  x  %s at %s  (%.1f x %.1f m)" % [label, r.name, a.f, str(((a.lo + a.hi) * 0.5).round()), b.f, str(((b.lo + b.hi) * 0.5).round()), ox, oz])
