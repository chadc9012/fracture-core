extends Node
## Online play (Nov 18): who you are online and the rooms the game uses, over Supabase Realtime (realtime.gd).
##   world:<city>       everyone in that city's open world: presence (name, look frame) and positions on foot / in a car
##                      (online_world.gd draws them); street-race lobbies and player challenges are messages here
##   race:<id>          one race between players: the start, each car's progress, the finishes
##   pvp:<arena>        an online Killbox match (arena_view.gd online mode): positions, shots, hits, eliminations
## One node under the root ("Online"), made on first use: `Online.shared(tree)`. Your id is your cloud account's when
## you're signed in (cloud_save.gd), else a guest id kept in user://online.json; your name is your operator's.

const Realtime := preload("res://scripts/net/realtime.gd")
const CharacterStore := preload("res://scripts/character/character_store.gd")
const SAVE := "user://online.json"

var rt: Node
var id := ""
var display := ""
## off: no socket at all (the headless tests that don't test online play, the settings toggle)
static var enabled := true
## tests point the socket at a local stand-in
static var url_override := ""

## online play runs in the game; the headless tests stay offline unless they point it at the stand-in
static func live() -> bool:
	return enabled and (url_override != "" or DisplayServer.get_name() != "headless")

static func shared(tree: SceneTree) -> Node:
	var n := tree.root.get_node_or_null("Online")
	if n == null:
		n = load("res://scripts/net/online.gd").new()
		n.name = "Online"
		tree.root.add_child(n)
	return n

func _ready() -> void:
	rt = Realtime.new()
	rt.name = "Realtime"
	if url_override != "":
		rt.url = url_override
	add_child(rt)
	_identity()
	rt.me = id

func _identity() -> void:
	var d := {}
	var f := FileAccess.open(SAVE, FileAccess.READ)
	if f:
		var v: Variant = JSON.parse_string(f.get_as_text())
		if v is Dictionary:
			d = v
	var cloud: Node = get_tree().get_first_node_in_group("cloud")
	var uid := ""
	if cloud and cloud.has_method("signed_in") and cloud.signed_in():
		uid = String(cloud.session.get("user_id", ""))
	if uid != "":
		id = "u-" + uid.left(12)
	else:
		if String(d.get("guest", "")) == "":
			var rng := RandomNumberGenerator.new()
			rng.randomize()
			d.guest = "g-%08x" % rng.randi()
			var w := FileAccess.open(SAVE, FileAccess.WRITE)
			if w:
				w.store_string(JSON.stringify(d))
		id = String(d.guest)
	display = String(CharacterStore.load_look().get("name", "")).strip_edges()
	if display == "":
		display = "Operator " + id.right(4).to_upper()

func online() -> bool:
	return live() and rt.is_open()

func room(name: String) -> RefCounted:
	if not live():
		return null
	return rt.room(name)

## the line for a HUD: connected or not, and how many others share `r`
func status(r: RefCounted = null) -> String:
	if not enabled:
		return "OFFLINE"
	if not rt.is_open():
		return "CONNECTING…"
	return "ONLINE · %d here" % ((r.members.size() + 1) if r else 1)
