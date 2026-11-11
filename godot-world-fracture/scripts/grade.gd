extends RefCounted
## A film grade as a 3D colour LUT (GTA pass, owner Nov 11): the environment's own adjustment step applies it, so it costs
## one texture lookup per pixel on the phone. A gentle S-curve, warm highlights, cool (slightly teal) shadows, and
## saturation held back in the brightest colours so skies and lights don't go neon unless the scene is neon.
## `look` picks the balance: "day" (sunlit streets), "night" (wet neon), "region" (the 3D maps).

const N := 17

static var _cache := {}

static func lut(look := "day") -> ImageTexture3D:
	if _cache.has(look):
		return _cache[look]
	var warm := Color(1.0, 0.94, 0.84)
	var cool := Color(0.86, 0.95, 1.02)
	var curve := 0.35
	var sat_hi := 0.9
	match look:
		"night":
			warm = Color(1.0, 0.9, 0.95)
			cool = Color(0.82, 0.9, 1.08)
			curve = 0.25
			sat_hi = 1.0
		"region":
			curve = 0.25
			sat_hi = 0.95
	var layers: Array[Image] = []
	for b in N:
		var img := Image.create(N, N, false, Image.FORMAT_RGB8)
		for g in N:
			for r in N:
				var c := Color(float(r) / (N - 1), float(g) / (N - 1), float(b) / (N - 1))
				img.set_pixel(r, g, _grade(c, warm, cool, curve, sat_hi))
		layers.append(img)
	var tex := ImageTexture3D.new()
	tex.create(Image.FORMAT_RGB8, N, N, N, false, layers)
	_cache[look] = tex
	return tex

static func _s(x: float, k: float) -> float:
	# an S-curve around mid-grey; k = 0 is linear
	var s := x * x * (3.0 - 2.0 * x)
	return lerpf(x, s, k)

static func _grade(c: Color, warm: Color, cool: Color, curve: float, sat_hi: float) -> Color:
	var l := c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
	# split tone: cool below mid, warm above
	var t := clampf((l - 0.15) / 0.7, 0.0, 1.0)
	var tint := cool.lerp(warm, t)
	var out := Color(c.r * tint.r, c.g * tint.g, c.b * tint.b)
	# contrast
	out = Color(_s(clampf(out.r, 0, 1), curve), _s(clampf(out.g, 0, 1), curve), _s(clampf(out.b, 0, 1), curve))
	# hold saturation back in the highlights
	var l2 := out.r * 0.2126 + out.g * 0.7152 + out.b * 0.0722
	var k := lerpf(1.0, sat_hi, smoothstep(0.55, 1.0, l2))
	out = Color(lerpf(l2, out.r, k), lerpf(l2, out.g, k), lerpf(l2, out.b, k))
	# lift the very blacks a hair (filmic toe) so dark streets keep shape
	out = Color(0.012 + out.r * 0.988, 0.012 + out.g * 0.988, 0.014 + out.b * 0.986)
	return out
