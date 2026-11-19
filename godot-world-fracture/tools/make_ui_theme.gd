extends SceneTree
## Writes res://ui/theme.tres from scripts/ui/ui_theme.gd (the game-wide Destiny-style look; project.godot points
## gui/theme/custom at it). Rerun after changing ui_theme.gd:
##   godot --headless --path godot-world-fracture --script res://tools/make_ui_theme.gd
const UiTheme := preload("res://scripts/ui/ui_theme.gd")

func _init() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://ui"))
	var err := ResourceSaver.save(UiTheme.build(), "res://ui/theme.tres")
	print("ui theme: ", "saved" if err == OK else "error %d" % err)
	quit(0 if err == OK else 1)
