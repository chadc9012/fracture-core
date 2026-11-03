extends SceneTree
## cloud_merge.gd: newer file wins, the profile never loses XP, the bags join.
const M = preload("res://scripts/cloud/cloud_merge.gd")

func _init() -> void:
	var ok := true
	var local := {
		"profile": { "updated": "2026-11-03T01:00:00Z", "data": { "xp": 1200, "level": 2, "nex": 300 } },
		"character": { "updated": "2026-11-03T02:00:00Z", "data": { "frame": "nyx", "body": "female" } },
		"inventory": { "updated": "2026-11-03T02:30:00Z", "data": { "items": [{ "id": "a" }, { "id": "drop-1" }], "equipped": { "primary": "drop-1" }, "next_id": 2 } },
	}
	var cloud := {
		"profile": { "updated": "2026-11-03T03:00:00Z", "data": { "xp": 900, "level": 1, "nex": 800 } },
		"character": { "updated": "2026-11-03T01:00:00Z", "data": { "frame": "goliath", "body": "male" } },
		"inventory": { "updated": "2026-11-03T01:30:00Z", "data": { "items": [{ "id": "a" }, { "id": "drop-2" }], "equipped": { "primary": "a" }, "next_id": 3 } },
		"mission01": { "updated": "2026-11-03T00:10:00Z", "data": { "beat": 7 } },
	}
	var m := M.merge(local, cloud)
	var r1: bool = m.character.data.frame == "nyx" and m.mission01.data.beat == 7
	print("newer file wins, missing file carried: ", r1)
	var r2: bool = m.profile.data.xp == 1200 and m.profile.data.level == 2 and m.profile.data.nex == 800 and m.profile.updated == "2026-11-03T03:00:00Z"
	print("profile keeps the best of both: ", r2)
	var ids: Array = m.inventory.data.items.map(func(i: Dictionary) -> String: return i.id)
	var r3: bool = ids.size() == 3 and "drop-2" in ids and m.inventory.data.equipped.primary == "drop-1" and m.inventory.data.next_id == 3
	print("bags join, newer worn slots: ", r3, " ", ids)
	var r4: bool = M.same(M.merge(m, m), m) and M.same(M.merge(m, {}), m)
	print("idempotent: ", r4)
	ok = r1 and r2 and r3 and r4
	print("Cloud merge test: ", ok)
	quit(0 if ok else 1)
