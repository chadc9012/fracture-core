extends "res://tests/mission/descent_play_test.gd"
## The 18 hidden unique encounters without a window (owner, Nov 23): the rules (encounters.gd — clues only once the
## story reaches them, two clues discover, story / npc / place / combat routes, the journal's keys as the web's, the
## reward once in full then a third, completion per operator), the gimmicks (boss.gd poise / adaptive / attune / closing /
## trial), the data (every line voiced, every talk person and speaker has a look, every set built, every POI real), and
## then every lead-in mission played through to its fight and its clear.
##   godot --headless --path godot-world-fracture res://tests/mission/unique_encounters_play.tscn
const Encounters := preload("res://scripts/mission/encounters.gd")
const Unique := preload("res://scripts/mission/unique_encounter.gd")
const Campaign := preload("res://scripts/mission/campaign.gd")
const Boss := preload("res://scripts/combat/boss.gd")
const Lines := preload("res://scripts/cinema/lines.gd")
const Stage := preload("res://scripts/mission/stage.gd")
const Journal := preload("res://scripts/mission/encounter_journal.gd")
var _kept := {}

func _ready() -> void:
	var saves := ["user://profile.json"]
	for e in Encounters.all():
		saves.append("user://unique_%s.json" % String(e.mission))
	for p in saves:
		var f := FileAccess.open(p, FileAccess.READ)
		_kept[p] = f.get_as_text() if f else null
		DirAccess.remove_absolute(ProjectSettings.globalize_path(p))
	_rules()
	_gimmicks()
	_data_checks()
	await _journal()
	for e in Encounters.all():
		await _play(e)
	var p := Gear.profile_load()
	var t := Encounters.tally(p)
	ok(int(t.done) == 18, "every encounter cleared: %d of 18" % int(t.done))
	for k in saves:
		if _kept[k] == null:
			DirAccess.remove_absolute(ProjectSettings.globalize_path(k))
		else:
			var w := FileAccess.open(k, FileAccess.WRITE)
			w.store_string(String(_kept[k]))
	print("unique encounters play test: " + str(fails == 0))
	get_tree().quit(0 if fails == 0 else 1)

func _story_to(n: int) -> Array:
	var a: Array = []
	for i in range(2, n + 1):
		a.append("%02d" % i)
	return a

func _rules() -> void:
	ok(Encounters.all().size() == 18, "eighteen encounters")
	var ids := {}
	for e in Encounters.all():
		ids[String(e.id)] = true
	for want in ["unbroken-glass", "system-core", "rime-alpha", "dark-knight", "hollow-saint", "drowned-monarch", "vaelith", "red-ronin", "vyrak",
			"hollow-colossus", "exiled-architect", "verdant-sovereign", "black-market-phantom", "king-beneath", "clockwork-saint", "abyssal-leviathan",
			"eternal-huntress", "iron-behemoth"]:
		ok(ids.has(want), "the roster keeps %s" % want)
	# the web's authored clue ids are kept
	var vy := Encounters.by_id("vyrak")
	var vids := []
	for c in vy.clues:
		vids.append(String(c.id))
	ok(vids.has("site") and vids.has("inscription") and vids.has("ember"), "Vyrak keeps the web's three routes: site, inscription, ember")
	var p := { "aftershock_done": _story_to(14) }
	ok(Encounters.sense(p, "solara", Encounters.pois("solara")["cb-refraction-city"]).is_empty(), "no clue before the story reaches it (Unbroken Glass opens after Mission 15)")
	p.aftershock_done = _story_to(15)
	var t1 := Encounters.sense(p, "solara", Encounters.pois("solara")["cb-refraction-city"] + Vector2(10, 0))
	ok(not t1.is_empty() and Encounters.has_key(p, "enc-clue:unbroken-glass:site"), "standing near the lair records the site clue, as the web's key")
	ok(not Encounters.is_discovered(p, "unbroken-glass"), "one clue is not a discovery")
	ok(Encounters.hint(p, Encounters.by_id("unbroken-glass")).begins_with("NOVA: One lead"), "NOVA's hint with one clue")
	var r := Encounters.record_clue(p, "unbroken-glass", "site")
	ok(not r.new, "a clue is recorded once")
	var st := Encounters.on_story(p)
	ok(Encounters.is_discovered(p, "unbroken-glass") and Encounters.has_key(p, "enc-found:unbroken-glass"), "the story clue makes two: discovered")
	ok(Encounters.hint(p, Encounters.by_id("unbroken-glass")) == "", "no hint once discovered")
	# npc
	p.aftershock_done = _story_to(31)
	var nc := Encounters.npc_clue(p, "oda")
	ok(not nc.is_empty() and String(nc.e) == "system-core", "Chief Oda has the System Core's rumour after Mission 31")
	Encounters.record_clue(p, "system-core", String(nc.c.id))
	ok(Encounters.npc_clue(p, "oda").is_empty() and not Encounters.npc_rumour(p, "oda").is_empty(), "told once; she can still repeat it")
	# combat: element and chance
	ok(Encounters.on_kill(p, "thalassia", "KINETIC", 0.0).is_empty(), "the System Core's combat clue wants an Arc kill")
	ok(not Encounters.on_kill(p, "thalassia", "ARC", 0.0).is_empty() and Encounters.is_discovered(p, "system-core"), "an Arc kill in Thalassia finds it")
	p.aftershock_done = _story_to(45)
	ok(Encounters.on_kill(p, "ember", "KINETIC", 0.9).is_empty(), "a chance clue misses on a high roll")
	ok(not Encounters.on_kill(p, "ember", "KINETIC", 0.1).is_empty(), "and lands on a low one")
	# the reward
	var nex0 := int(p.get("nex", 0))
	var lines := Encounters.clear(p, "unbroken-glass")
	ok(int(p.nex) - nex0 == 600 and int((p.relics as Dictionary).get("anomalyCarbon", 0)) == 1 and not lines.is_empty(), "a first clear pays 600 Nex and Anomaly Carbon")
	ok(Encounters.has_key(p, "enc-done:op:unbroken-glass"), "completion is keyed to the operator")
	var nex1 := int(p.nex)
	Encounters.clear(p, "unbroken-glass")
	ok(int(p.nex) - nex1 == 200 and int(p.relics.anomalyCarbon) == 1, "again pays a third and no drop")
	# places are only the region's
	ok(Encounters.near("solara", Encounters.pois("solara")["ribcage"]).size() >= 1, "the Ribcage is Vyrak's lair")
	var w := Encounters.places("wastelands")
	var has_ember := false
	for pl in w:
		if String(pl.e) == "vyrak" and String(pl.c) == "ember":
			has_ember = true
	ok(has_ember, "the ranger's campfire (Vyrak's ember clue) is in the Wastelands")

func _gimmicks() -> void:
	var b := Boss.new("dark-knight")
	b.set_gimmick("adaptive")
	var first := b.gimmick_mult("KINETIC", 3.0)
	for i in 40:
		b.hit(20.0, "KINETIC", 3.0)
	var late := b.gimmick_mult("KINETIC", 3.0)
	var fresh := b.gimmick_mult("THERMAL", 3.0)
	b.tick(20.0, 5.0)
	var rested := b.gimmick_mult("KINETIC", 3.0)
	ok(late < first * 0.5 and fresh > late * 2.0 and rested > late * 2.0, "adaptive: the same element lands for less (×%.2f → ×%.2f), a new one fully (×%.2f), and it forgets (×%.2f)" % [first, late, fresh, rested])
	var s := Boss.new("hollow-saint")
	s.set_gimmick("attune", ["KINETIC", "THERMAL", "MELEE"])
	var on := s.hit(10.0, "KINETIC", 3.0)
	var off := s.hit(10.0, "THERMAL", 3.0)
	ok(on > off * 3.0, "attune: the halo's element lands, the rest is turned aside")
	s.tick(Boss.ATTUNE_EVERY + 0.1, 5.0)
	ok(s.attuned == "THERMAL" and s.drain().any(func(ev): return String(ev.kind) == "attune"), "attune: the halo turns every %d s" % int(Boss.ATTUNE_EVERY))
	var r := Boss.new("red-ronin")
	r.set_gimmick("closing")
	var far := r.hit(10.0, "KINETIC", 30.0)
	var near := r.hit(10.0, "KINETIC", 4.0)
	ok(far < near * 0.25, "closing: shots from range are cut out of the air")
	var g := Boss.new("unbroken-glass")
	g.set_gimmick("poise")
	var outside := g.hit(10.0, "KINETIC", 5.0)
	g.stagger_until = g.clock + 3.0
	var inside := g.hit(10.0, "KINETIC", 5.0)
	ok(inside > outside * 3.0, "poise: only the stagger window really hurts")
	var v := Boss.new("vaelith")
	v.set_gimmick("trial")
	v.hit(1e9, "KINETIC", 5.0)
	ok(v.dead and v.yielded and v.hull > 0.0, "trial: Vaelith yields and is not killed")
	for e in Encounters.all():
		ok(not Boss.row(String(e.hull)).is_empty(), "%s has a hull (%s)" % [e.id, e.hull])

func _data_checks() -> void:
	var data: Dictionary = Encounters.data()
	var unvoiced: Array = []
	var people: Array = []
	var sets: Array = []
	var st: Node3D = Stage.new()
	for m in data.missions:
		for c in m.chapters:
			var all_ids: Array = c.get("open", []) + c.get("close", [])
			for k in (c.get("by_choice", {}) as Dictionary):
				all_ids += c.by_choice[k]
			for lid in all_ids:
				if not Lines.has(String(lid)):
					unvoiced.append(lid)
			if String(c.kind) == "talk" and not (String(c.who) in Stage.ROSTER or Stage.EXTRAS.has(String(c.who)) or Stage.PERSONS.has(String(c.who))):
				people.append(c.who)
			if c.has("stage") and not st.has_method("_set_" + String(c.stage)):
				sets.append(c.stage)
	st.free()
	var speakers := {}
	for l in data.lines:
		speakers[String(l.speaker)] = true
	var faceless: Array = []
	for s in speakers:
		if s in ["PLAYER", "NOVA"] or s in Stage.VOICES or s in Stage.ROSTER or Stage.EXTRAS.has(s) or Stage.FIGURES.has(s) or Stage.PERSONS.has(s):
			continue
		var boss_named := false
		for e in Encounters.all():
			if String(e.boss_name).to_upper() == s:
				boss_named = true
		if not boss_named:
			faceless.append(s)
	ok(unvoiced.is_empty(), "every encounter line is voiced" + ("" if unvoiced.is_empty() else ": not %d, e.g. %s" % [unvoiced.size(), str(unvoiced.slice(0, 6))]))
	ok(people.is_empty(), "every talk chapter's person has a look" + ("" if people.is_empty() else ": missing " + str(people)))
	ok(sets.is_empty(), "every set is built" + ("" if sets.is_empty() else ": missing " + str(sets)))
	ok(faceless.is_empty(), "every speaker stands as someone or is a voice" + ("" if faceless.is_empty() else ": " + str(faceless)))
	for e in Encounters.all():
		ok(Encounters.pois(String(e.world)).has(String(e.lair)), "%s's lair %s is a real place in %s" % [e.id, e.lair, e.world])
		ok((e.clues as Array).size() >= 3, "%s has at least three routes to its clues" % e.id)

func _journal() -> void:
	var j: Control = Journal.new()
	add_child(j)
	await _frames(2)
	ok(j.get_child_count() > 0, "the journal opens")
	j.queue_free()
	await _frames(1)

func _play(e: Dictionary) -> void:
	var mid := String(e.mission)
	Unique.pending = mid
	d = Unique.new()
	add_child(d)
	await _frames(5)
	var m: Dictionary = {}
	for mm in Encounters.data().missions:
		if String(mm.id) == mid:
			m = mm
	# (a mission that opens on a cutscene chapter may already have played it)
	var at_first := String(d.quest.get("id", "")) == String(m.chapters[0].id) or (String(m.chapters[0].kind) == "cutscene" and String(d.quest.get("id", "")) == String(m.chapters[1].id))
	ok(d.chapters.size() == (m.chapters as Array).size() and at_first,
		"%s %s: its own %d chapters, from the first" % [mid, e.name, (m.chapters as Array).size()])
	var guard := 0
	var fought := false
	while String(d.progress.current) != d.ACT_END and guard < 30:
		guard += 1
		for k in 4:
			if d.cutscene and d.cutscene.playing:
				d.cutscene._end()
			await _frames(2)
		if String(d.progress.current) == d.ACT_END:
			break
		var c: Dictionary = d.quest
		var kind := String(c.get("kind_real", c.kind))
		var id0 := String(c.id)
		match kind:
			"choice":
				d.choice_view.chosen.emit(String(c.options[0][0]))
			"boss":
				if d.boss:
					ok(d.boss.rules.gimmick == String(e.gimmick), "%s fights with its gimmick (%s)" % [e.id, e.gimmick])
					d.boss.rules.stagger_until = d.boss.rules.clock + 3.0
					d.boss.rules.hit(1e9, "KINETIC", 1.0)
					fought = true
			"cutscene":
				pass
			_:
				d._complete()
		var t := 0
		while String(d.progress.current) == id0 and t < 200:
			if d.cutscene.playing:
				d.cutscene._end()
			await get_tree().process_frame
			t += 1
	var p := Gear.profile_load()
	ok(fought and String(d.progress.current) == d.ACT_END and Encounters.is_done(p, String(e.id)), "%s played through, fought and cleared" % mid)
	d.queue_free()
	d = null
	await _frames(3)
