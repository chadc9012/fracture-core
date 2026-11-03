extends SceneTree
## loads every script in the project so parse errors (incl. warnings-as-errors) show without running a scene
func _initialize() -> void:
	var bad := 0
	var stack := ["res://scripts", "res://tests"]
	while not stack.is_empty():
		var dir: String = stack.pop_back()
		for d in DirAccess.get_directories_at(dir):
			stack.append(dir + "/" + d)
		for f in DirAccess.get_files_at(dir):
			if f.ends_with(".gd"):
				var s: Script = load(dir + "/" + f)
				if s == null or not s.can_instantiate():
					bad += 1
					print("BAD ", dir + "/" + f)
	print("parse check: %d bad" % bad)
	quit(bad)
