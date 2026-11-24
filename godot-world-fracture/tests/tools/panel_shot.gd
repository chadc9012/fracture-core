extends SceneTree
## Look-dev for the restyled panels: the operator panel and a shop.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --resolution 1600x738 --script res://tests/tools/panel_shot.gd -- out.png profile|nova|haven|apex|rusty
const ProfileView := preload("res://scripts/progress/profile_view.gd")
const ShopView := preload("res://scripts/gear/shop_view.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
var frames := 0
var out := "user://panel.png"

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	var which: String = args[1] if args.size() > 1 else "profile"
	if which == "profile":
		get_root().add_child(ProfileView.new())
	else:
		var v := ShopView.new()
		v.shop = which
		v.gear = Gear.fresh()
		v.profile = { "nex": 48250 }
		get_root().add_child(v)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 10:
		get_root().get_texture().get_image().save_png(out)
		print("saved ", out)
		return true
	return false
