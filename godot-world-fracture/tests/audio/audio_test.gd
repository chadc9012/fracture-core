extends SceneTree
## The radio broadcast (scripts/audio/radio.gd over data/radio.json): tuning in plays the station ID, then the rotation in
## order, a commercial after every ad_every programs and never mid-song, the dial wraps to off; every exported path exists in
## the build (no archived spoiler episode is shipped). The SFX, ambience and voice sets are present and loadable.
## Run: godot --headless --path . --script res://tests/audio/audio_test.gd

const Radio := preload("res://scripts/audio/radio.gd")

var ok := true
var a: Node

func _init() -> void:
	var r := Radio.new()
	ok = ok and Radio.stations().size() == 7 and Radio.station_ids()[0] == "hiphop"
	# every path the data names ships
	var missing: Array[String] = []
	for s in Radio.stations():
		if s.ident is Dictionary and not ResourceLoader.exists(String(s.ident.path)):
			missing.append(String(s.ident.path))
		for t in s.tracks:
			if not ResourceLoader.exists(String(t.path)):
				missing.append(String(t.path))
	for a in Radio.data().ads:
		if not ResourceLoader.exists(String(a.path)):
			missing.append(String(a.path))
	ok = ok and missing.is_empty()
	if not missing.is_empty():
		print("missing: ", missing)
	# the archive never ships
	ok = ok and not ResourceLoader.exists("res://audio/radio/fracture-fm-episode-01.ogg") and not ResourceLoader.exists("res://audio/radio/ads/vyrak-insurance.ogg")
	# Block Signal: ID → track 0 → track 1 → ad → track 2 → track 3 → ad ...
	r.tune("hiphop")
	var seq: Array[String] = []
	for i in 8:
		var now := r.on_air()
		seq.append("ID" if bool(now.ident) else ("AD" if bool(now.advertisement) else String(now.title)))
		r.advance()
	ok = ok and seq[0] == "ID" and seq[1] == "Brooklyn, Stand Tall" and seq[2] == "Bodega Gate" and seq[3] == "AD" and seq[4] == "Write Your Own Name" and seq[5] == "We Keep Rolling" and seq[6] == "AD" and seq[7] == "Facetime"
	ok = ok and r.line().begins_with("BLOCK SIGNAL · Kinggg Dream — ")
	# the dial: hiphop → rock → ... → comedy → off → hiphop
	var id := ""
	var dial: Array[String] = []
	for i in 9:
		id = Radio.next_station(id)
		dial.append(id)
	ok = ok and dial[0] == "hiphop" and dial[6] == "comedy" and dial[7] == "" and dial[8] == "hiphop"
	# off: nothing on air
	r.tune("")
	ok = ok and r.on_air().is_empty() and r.line() == "RADIO OFF"
	# the ads rotate
	r.tune("rock")
	var ads: Array[String] = []
	for i in 12:
		var now := r.on_air()
		if bool(now.advertisement):
			ads.append(String(now.title))
		r.advance()
	ok = ok and ads.size() >= 3 and ads[0] != ads[1] and ads[1] != ads[2]
	# the sets
	for n in ["rifle", "sniper", "fusion", "smg", "shotgun", "sidearm", "lmg", "heavy", "reload", "dry", "hit", "headshot", "hurt", "down", "step", "jump", "land", "click", "door", "portal", "roar", "stagger", "capture", "engine", "hover", "rotor", "jet", "wind", "water", "explosion"]:
		ok = ok and ResourceLoader.exists("res://audio/sfx/%s.wav" % n)
	for b in ["forest-wilds", "swamp-marsh", "underwater-city", "nexus-hum", "frost-spire", "solara-dunes", "wasteland-wind", "ember-peaks"]:
		ok = ok and ResourceLoader.exists("res://audio/ambience/%s.mp3" % b)
	for v in ["nova-first-contact", "mara-crash-site", "vaelith-first-contact", "serik-vale-warning", "dr-aris-world-anchor-log"]:
		ok = ok and ResourceLoader.exists("res://audio/voices/%s.wav" % v)
	# the autoload needs a live tree to play: the second half runs on the first frame
	a = preload("res://scripts/audio/audio.gd").new()
	root.add_child(a)
	process_frame.connect(_stage2, CONNECT_ONE_SHOT)

func _stage2() -> void:
	# the Audio autoload runs headless: cues, loops, ambience, a voice and the radio all play without error
	a.sfx("rifle")
	ok = ok and a.last == ["sfx", "rifle"]
	a.sfx_at("hit", Vector3(200, 0, 0), Vector3.ZERO)   # beyond earshot: no play
	a.loop("engine", "engine", -8.0, 1.2)
	a.loop_set("engine", 1.6, -4.0)
	a.ambience("nexus-hum")
	a.voice("nova-first-contact")
	ok = ok and a.last == ["voice", "nova-first-contact"]
	a.radio_on("oldschool")
	ok = ok and a.radio.station == "oldschool" and String(a.last[0]) == "radio"
	a.radio_next()
	ok = ok and a.radio.station == "instrumental"
	a.radio_off()
	ok = ok and a.radio_line() == "RADIO OFF"
	a.stop_all()
	print("audio test: " + str(ok))
	quit(0 if ok else 1)
