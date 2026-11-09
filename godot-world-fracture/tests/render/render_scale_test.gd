extends SceneTree
## The phone render scale (phone.gd): full resolution by default, every tuned 3D view follows a step down / up, and it
## never drops below the old 80 %.  godot --headless --path godot-world-fracture --script res://tests/render/render_scale_test.gd

const Phone := preload("res://scripts/phone.gd")

var fails := 0
var checks := 0

func ok(cond: bool, what: String) -> void:
	checks += 1
	if not cond:
		fails += 1
		printerr("FAIL: ", what)

func _init() -> void:
	ok(is_equal_approx(Phone.scale, 1.0), "the phone starts at full resolution")
	var a := SubViewport.new()
	var b := SubViewport.new()
	Phone.fit_viewport_scale(a)
	Phone.fit_viewport_scale(b)
	ok(is_equal_approx(a.scaling_3d_scale, 1.0), "a new view renders at full resolution")
	Phone.set_scale(Phone.scale - 0.1)
	ok(is_equal_approx(a.scaling_3d_scale, 0.9) and is_equal_approx(b.scaling_3d_scale, 0.9), "a step down reaches every live view")
	for i in 5:
		Phone.set_scale(Phone.scale - 0.1)
	ok(is_equal_approx(Phone.scale, Phone.SCALE_MIN) and is_equal_approx(a.scaling_3d_scale, 0.8), "never below 80 %")
	b.free()
	Phone.set_scale(1.5)
	ok(is_equal_approx(a.scaling_3d_scale, 1.0), "back up to full, capped, and a freed view is dropped without error")
	var c := SubViewport.new()
	Phone.fit_viewport_scale(c)
	ok(is_equal_approx(c.scaling_3d_scale, 1.0), "views opened later take the current scale")
	var guard: Node = Phone.Guard.new()
	ok(guard != null, "the frame-rate guard builds")
	guard.free()
	a.free()
	c.free()
	print("render scale tests: %d checks, %d failed" % [checks, fails])
	quit(1 if fails > 0 else 0)
