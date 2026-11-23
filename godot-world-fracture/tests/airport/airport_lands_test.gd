extends Node
## The four airport lands (Nov 22, src/game/airport-lands.ts): walking out of Eldergrove Airfield, Skyhaven, Aurora Gate and
## Horizon Gate puts you in that airport's own region (not the neighbour it used to borrow), at its airport, on dry
## ground; each region has its own look; Skyhaven's sky bridges carry you between the pinnacles over the sea.
##   godot --headless --path godot-world-fracture res://tests/airport/airport_lands.tscn
const Air := preload("res://scripts/airport/airport.gd")
const ArrivalView := preload("res://scripts/airport/arrival_view.gd")
const Region3D := preload("res://scripts/region_3d.gd")
const LANDS := { "ELD": "eldergrove", "SKA": "skyhaven", "AGA": "aurora-gate", "HGA": "horizon-gate" }
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame

func _ready() -> void:
	for code in LANDS:
		var id: String = LANDS[code]
		ok(String(Air.AIRPORTS[code].region) == id and String(Air.DESTINATIONS[code].region) == id, "%s's region is %s" % [code, id])
		ok(not Data.map(id).is_empty(), "%s is in the exported maps" % id)
		var r3 := Region3D.new()
		ok(r3._style_for(id) != r3._style_for("__none__"), "%s has a look of its own" % id)
		r3.free()
		var v := ArrivalView.new()
		v.dest = code
		add_child(v)
		await _frames(6)
		ok(v.map_id == id, "walking out of %s lands in %s (got %s)" % [code, id, v.map_id])
		var p: Vector3 = v.operator.position
		var g: float = v.region.terrain(p.x, p.z)
		ok(g > v.region.water_level() + 1.0, "%s: you stand on dry ground at the airport (%.1f m over the water)" % [id, g - v.region.water_level()])
		if id == "skyhaven":
			# the Airport Span, halfway across: the deck, a hundred metres over the sea
			var span: Dictionary = {}
			for rd in Data.map(id).roads:
				if String(rd.name) == "Airport Span":
					span = rd
			ok(not span.is_empty(), "Skyhaven has the Airport Span")
			if not span.is_empty():
				var a: Vector2 = v.region._loc(float(span.pts[0][0]), float(span.pts[0][1]))
				var b: Vector2 = v.region._loc(float(span.pts[-1][0]), float(span.pts[-1][1]))
				var mid := (a + b) * 0.5
				var below: float = v.region.terrain(mid.x, mid.y)
				var deck: float = v.region.ground(mid.x, mid.y)
				ok(below < v.region.water_level() and deck > v.region.water_level() + 60.0, "the span's deck carries you %.0f m over the sea (the sea floor is at %.0f)" % [deck - v.region.water_level(), below - v.region.water_level()])
		v.queue_free()
		await _frames(2)
	print("airport lands: %d failed" % fails)
	get_tree().quit(0 if fails == 0 else 1)
