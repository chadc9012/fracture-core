extends SceneTree
## The NPC rules headless: schedules, places, memory (meeting, chats, personality, gunfire), errands, the police and the
## lines people say.
const People := preload("res://scripts/npc/people.gd")
const Memory := preload("res://scripts/npc/memory.gd")
const Talk := preload("res://scripts/npc/talk.gd")

var ok := true

func check(name: String, cond: bool, extra: Variant = "") -> void:
	print(("PASS " if cond else "FAIL ") + name + ("" if str(extra) == "" else "  " + str(extra)))
	ok = ok and cond

func _init() -> void:
	# the roster
	var ids := {}
	for p in People.PEOPLE:
		ids[p.id] = true
		check("%s has a known personality, places and a schedule" % p.id, People.PERSONALITIES.has(p.personality) and not p.schedule.is_empty() and p.schedule.all(func(b): return People.PLACES.has(b[2])))
	check("ids are unique", ids.size() == People.PEOPLE.size())
	var Outfits := load("res://scripts/character/outfits.gd")
	check("everyone wears a real outfit", People.PEOPLE.all(func(p): return String(p.get("outfit", "")) in Outfits.ids()))
	# schedules
	check("blocks across midnight", People.in_block(23.0, 22, 4) and People.in_block(2.5, 22, 4) and not People.in_block(5.0, 22, 4))
	check("Rosa works the café in the morning", People.where(People.by_id("rosa"), 9.5).get("place") == "cafe")
	check("…shops at the Galleria after", People.where(People.by_id("rosa"), 16.5).get("place") == "mall")
	check("…and is home at night", People.where(People.by_id("rosa"), 23.0).is_empty())
	check("the night officer is out at 2am", People.where(People.by_id("luis"), 2.0).get("activity") == "patrol")
	for h in [0, 3, 6, 9, 12, 15, 18, 21]:
		var out := People.out_at(float(h))
		check("someone is out at %02d:00" % h, out.size() >= 2, out.size())
	check("a police officer covers every hour", range(24).all(func(h): return People.out_at(float(h)).any(func(o): return People.is_police(o.person))))
	check("two people at one place don't stand on one spot", People.spot("plaza", "theo").distance_to(People.spot("plaza", "jonah")) > 0.3)
	# memory
	var s := Memory.blank()
	check("first talk is an introduction", Memory.talk(s, "rosa", "2026-11-11") == "met" and Memory.person(s, "rosa").met)
	var a0 := Memory.affinity(s, "rosa")
	check("one chat a day counts", Memory.talk(s, "rosa", "2026-11-11") == "again" and Memory.affinity(s, "rosa") == a0)
	check("next day it counts again", Memory.talk(s, "rosa", "2026-11-12") == "chat" and Memory.affinity(s, "rosa") > a0)
	Memory.talk(s, "marcus", "2026-11-11")
	check("a warm person warms faster than a gruff one", Memory.affinity(s, "rosa") > Memory.affinity(s, "marcus") and Memory.affinity(s, "marcus") > 0)
	check("bands", Memory.band(-5) == "wary" and Memory.band(10) == "acquaintance" and Memory.band(45) == "friend" and Memory.band(80) == "close")
	# errands
	var present := ["rosa", "marcus", "theo", "jade"]
	var offer := {}
	var day := ""
	for k in 10:
		day = "2026-11-%02d" % (10 + k)
		offer = Memory.errand_offer(s, "rosa", day, present)
		if not offer.is_empty():
			break
	check("someone has an errand on some day", not offer.is_empty() and offer.to != "rosa" and offer.to in present, offer)
	check("an errand is stable for the day", Memory.errand_offer(s, "rosa", day, present) == offer)
	check("no errands from someone you haven't met", Memory.errand_offer(s, "nina", day, present).is_empty())
	Memory.take_errand(s, offer)
	check("one errand at a time", Memory.errand_offer(s, "rosa", day, present).is_empty())
	var prof := { "nex": 100 }
	var to_before := Memory.affinity(s, String(offer.to))
	check("the wrong person can't take it", Memory.deliver(s, "rosa", prof).is_empty())
	var done := Memory.deliver(s, String(offer.to), prof)
	check("delivered: reward paid, both like you more, errand cleared", not done.is_empty() and int(prof.nex) == 100 + int(offer.reward) and Memory.affinity(s, String(offer.to)) > to_before and (s.errand as Dictionary).is_empty())
	check("they remember the delivery", Talk.remember(People.by_id(String(offer.to)), s).begins_with("Thanks for bringing"))
	# gunfire, notoriety, the police
	var t := 1_000_000
	var before := Memory.affinity(s, "rosa")
	for k in 8:
		Memory.gunfire(s, ["rosa"], t)
	check("gunfire scares people near it", Memory.affinity(s, "rosa") == before - 16 and Talk.remember(People.by_id("rosa"), s).begins_with("Were you"))
	check("…and builds notoriety", is_equal_approx(Memory.notoriety(s, t), 8.0))
	check("notoriety fades with time", Memory.notoriety(s, t + 1200) < 6.5)
	check("an officer warns you the first time", Memory.police_verdict(s, "dana", t) == "warning" and Memory.notoriety(s, t) == 0.0)
	check("under the threshold, nothing", Memory.police_verdict(s, "dana", t) == "none")
	for k in 9:
		Memory.gunfire(s, [], t)
	check("then it's a fine", Memory.police_verdict(s, "luis", t) == "fine")
	var poor := { "nex": 60 }
	check("a fine takes what you have, at most 150", Memory.pay_fine(poor) == 60 and int(poor.nex) == 0)
	for k in 12:
		Memory.nudge(s, "dana", 5.0, "chatted")
	for k in 9:
		Memory.gunfire(s, [], t)
	check("an officer who likes you only warns", Memory.police_verdict(s, "dana", t) == "warning")
	# lines
	var rosa := People.by_id("rosa")
	check("greetings use your name", Talk.greeting(rosa, s, 9.0, "Nyx").contains("Nyx") or Memory.band(Memory.affinity(s, "rosa")) == "wary")
	check("every job has work talk", People.PEOPLE.all(func(p): return Talk.WORK.has(p.job)))
	check("every personality greets in every band", Talk.GREET.keys().size() == People.PERSONALITIES.size() and Talk.GREET.values().all(func(g): return g.size() == 4))
	check("intro names the place", Talk.intro(People.by_id("marcus"), "garage").contains("the garage"))
	check("police lines", Talk.police_line("fine").contains("150") and Talk.police_line("warning").begins_with("Hold it"))
	# save round trip
	var back := Memory.tidy(JSON.parse_string(JSON.stringify(s)))
	check("state survives a JSON save", Memory.affinity(back, "rosa") == Memory.affinity(s, "rosa") and Memory.person(back, "rosa").met)
	check("a broken save comes back blank", Memory.tidy({ "people": 3 }).people is Dictionary)
	print("ALL PASS" if ok else "SOME FAILED")
	quit(0 if ok else 1)
