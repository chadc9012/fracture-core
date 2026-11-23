extends Node3D
## The aurora: tall, slow ribbons of light over the north — green at the foot rising to violet, fading out top and bottom,
## in soft vertical rays, swaying. Aurora Gate's airport (airport_view.gd "aurora" extra) and its land (region_3d.gd style
## key "aurora") both hang one: `Aurora.make(rng, centre, spread)` and add it to the world; it steps itself.

const RIBBONS := 5

static func make(rng: RandomNumberGenerator, centre: Vector3, spread := 600.0) -> Node3D:
	var a: Node3D = load("res://scripts/vfx/aurora.gd").new()
	a.set_meta("dynamic", true)
	for k in RIBBONS:
		var q := MeshInstance3D.new()
		var qm := QuadMesh.new()
		qm.size = Vector2(rng.randf_range(500, 900), rng.randf_range(160, 260))
		q.mesh = qm
		var am := StandardMaterial3D.new()
		am.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		am.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		am.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		am.cull_mode = BaseMaterial3D.CULL_DISABLED
		am.disable_fog = true
		am.albedo_texture = texture(k)
		am.albedo_color = Color(1, 1, 1, 0.75)
		q.material_override = am
		q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		q.position = centre + Vector3(rng.randf_range(-spread, spread), rng.randf_range(-60, 60), -k * 120.0)
		q.rotation = Vector3(0.0, rng.randf_range(-0.5, 0.5), 0.0)
		a.add_child(q)
	return a

func _process(_dt: float) -> void:
	var tt := Time.get_ticks_msec() * 0.001
	for i in get_child_count():
		var q := get_child(i) as Node3D
		q.rotation.y = sin(tt * 0.05 + i * 1.3) * 0.4
		q.scale.y = 1.0 + 0.12 * sin(tt * 0.3 + i)

## one ribbon's picture
static func texture(seed: int) -> Texture2D:
	var img := Image.create(128, 64, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 900 + seed
	var rays: Array = []
	for i in 128:
		rays.append(0.55 + 0.45 * sin(i * 0.31 + rng.randf() * 0.6) * sin(i * 0.07 + seed))
	for y in 64:
		var t := 1.0 - float(y) / 63.0           # 0 at the foot, 1 at the top
		var c := Color(0.25, 1.0, 0.55).lerp(Color(0.7, 0.35, 1.0), clampf((t - 0.35) / 0.65, 0.0, 1.0))
		var fade := smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.55, 1.0, t))
		for x in 128:
			var edge := smoothstep(0.0, 0.12, float(x) / 127.0) * smoothstep(0.0, 0.12, 1.0 - float(x) / 127.0)
			img.set_pixel(x, y, Color(c.r, c.g, c.b, clampf(fade * edge * float(rays[x]), 0.0, 1.0)))
	return ImageTexture.create_from_image(img)
