extends RefCounted
## The cloud save's merge rules (pure, headless-tested). The Godot build keeps its saves as files under user:// (profile.json,
## character.json, inventory.json, mission01.json); in the cloud they ride the web game's player_saves row under `data.godot`
## as {file: {"updated": ISO time, "data": {...}}}. Each file keeps whichever copy was updated later — the web game applies the
## same rule when it merges (src/game/cloud-save.ts mergeGodot) — with two exceptions that never lose progress: the profile
## keeps the higher XP / level / Nex, and the inventory keeps the union of both bags (the newer copy's worn slots and transmog).

const FILES := ["profile", "character", "inventory", "mission01", "quests"]

static func newer(a: Dictionary, b: Dictionary) -> Dictionary:
	if a.is_empty():
		return b
	if b.is_empty():
		return a
	return a if str(a.get("updated", "")) >= str(b.get("updated", "")) else b

## merges two namespaces (local and cloud), returning the namespace to keep on both sides
static func merge(local: Dictionary, cloud: Dictionary) -> Dictionary:
	var out := {}
	for k in FILES:
		var a: Dictionary = local.get(k, {})
		var b: Dictionary = cloud.get(k, {})
		if a.is_empty() and b.is_empty():
			continue
		var win := newer(a, b)
		if k == "profile" and not a.is_empty() and not b.is_empty():
			var pa: Dictionary = a.get("data", {})
			var pb: Dictionary = b.get("data", {})
			var merged: Dictionary = (win.get("data", {}) as Dictionary).duplicate(true)
			for f in ["xp", "level", "nex"]:
				merged[f] = maxi(int(pa.get(f, 0)), int(pb.get(f, 0)))
			win = { "updated": win.updated, "data": merged }
		elif k == "inventory" and not a.is_empty() and not b.is_empty():
			var ia: Dictionary = a.get("data", {})
			var ib: Dictionary = b.get("data", {})
			var merged: Dictionary = (win.get("data", {}) as Dictionary).duplicate(true)
			var ids := {}
			var items: Array = []
			for src in [ia.get("items", []), ib.get("items", [])]:
				for it in src:
					if it is Dictionary and not ids.has(str(it.get("id", ""))):
						ids[str(it.get("id", ""))] = true
						items.append(it)
			merged.items = items
			merged.next_id = maxi(int(ia.get("next_id", 1)), int(ib.get("next_id", 1)))
			win = { "updated": win.updated, "data": merged }
		out[k] = win
	return out

## true when `a` holds nothing `b` lacks (so no push is needed)
static func same(a: Dictionary, b: Dictionary) -> bool:
	return JSON.stringify(a) == JSON.stringify(b)
