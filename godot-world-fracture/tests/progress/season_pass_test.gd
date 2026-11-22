extends SceneTree
## The season pass (scripts/progress/season_pass.gd): seasons turn, XP climbs tiers, rewards claim once into the
## profile and the bag, and Progression.grant feeds it.
const Season := preload("res://scripts/progress/season_pass.gd")
const Progression := preload("res://scripts/progress/progression.gd")
const Gear := preload("res://scripts/gear/gear_store.gd")
var fails := 0

func ok(c: bool, w: String) -> void:
	print(("ok   " if c else "FAIL ") + w)
	if not c:
		fails += 1

func _init() -> void:
	var day0 := Season.EPOCH_DAY * 86400 + 3600
	ok(int(Season.current(day0).id) == 1 and int(Season.current(day0).days_left) == Season.SEASON_DAYS, "season 1 opens on the epoch day")
	ok(int(Season.current(day0 + Season.SEASON_DAYS * 86400).id) == 2, "and turns after %d days" % Season.SEASON_DAYS)
	ok(Season.REWARDS.size() == Season.TIERS, "a reward for every tier")
	var bad := Season.REWARDS.filter(func(r): return (r.kind == "outfit" and Gear.outfit(r.id).is_empty()) or (r.kind == "furniture" and Gear.furniture(r.id).is_empty()))
	ok(bad.is_empty(), "every outfit and piece it names exists")
	var p := { "xp": 0, "nex": 0 }
	ok(Season.tier(p, day0) == 0, "you start at tier 0")
	var got := Season.add_xp(p, Season.TIER_XP * 3 + 120, day0)
	ok(got == [1, 2, 3] and Season.tier(p, day0) == 3 and Season.bar(p, day0) == Vector2i(120, Season.TIER_XP), "XP climbs tiers (%s)" % str(got))
	var g := Gear.fresh()
	ok(not Season.can_claim(p, 4, day0), "a tier ahead can't be claimed")
	var line := Season.claim(p, g, 1, 100.0, day0)
	ok(int(p.nex) == int(Season.REWARDS[0].n) and line.begins_with("SEASON TIER 1"), "a Nex tier pays the balance (%s)" % line)
	ok(Season.claim(p, g, 1, 100.0, day0) == "", "a tier claims once")
	Season.claim(p, g, 2, 100.0, day0)
	ok((g.furniture as Array).has(String(Season.REWARDS[1].id)), "a piece goes to the apartment")
	var items := (g.items as Array).size()
	Season.add_xp(p, Season.TIER_XP * 2, day0)
	Season.claim(p, g, 4, 100.0, day0)
	ok((g.outfits as Array).has("casual"), "an outfit goes to the wardrobe")
	Season.claim(p, g, 5, 100.0, day0)
	ok((g.items as Array).size() == items + 1, "a gear tier drops an item in the bag")
	var nex0 := int(p.nex)
	(g.outfits as Array).append("gym")
	Season.add_xp(p, Season.TIER_XP * 4, day0)
	Season.claim(p, g, 9, 100.0, day0)
	ok(int(p.nex) == nex0 + int(Gear.outfit("gym").price), "an outfit already owned pays its price instead")
	Season.add_xp(p, 999999, day0)
	ok(Season.tier(p, day0) == Season.TIERS and Season.bar(p, day0).x == Season.TIER_XP, "the track tops out at %d" % Season.TIERS)
	ok(Season.tier(p, day0 + Season.SEASON_DAYS * 86400) == 0 and (Season.state(p, day0 + Season.SEASON_DAYS * 86400).claimed as Array).is_empty(), "a new season starts the track over")
	var q := { "xp": 0, "nex": 0 }
	var res := Progression.grant(q, "test", 0, Season.TIER_XP + 10, "", day0)
	ok(Season.tier(q, day0) == 1 and (res.lines as Array).any(func(l): return String(l).begins_with("SEASON TIER 1")), "earned XP climbs the pass and says so")
	var r := { "xp": 0, "nex": 0, "season": JSON.parse_string(JSON.stringify({ "id": 1, "xp": Season.TIER_XP * 3, "claimed": [1, 2] })) }
	ok(Season.claimed(r, 2, day0) and not Season.can_claim(r, 2, day0) and Season.can_claim(r, 3, day0), "claims survive a save and load")
	print("SEASON PASS %s (%d failed)" % ["PASS" if fails == 0 else "FAIL", fails])
	quit(1 if fails else 0)
