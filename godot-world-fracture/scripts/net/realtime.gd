extends Node
## Online play's wire (Nov 18, the owner picked "Build online now"): a client for Supabase Realtime — the same Supabase
## project the cloud save uses (cloud_save.gd URL / KEY), so there is no game server of our own to host. Realtime speaks
## the Phoenix channel protocol over one WebSocket:
##   join      {topic: "realtime:<room>", event: "phx_join", payload: {config: {broadcast: {self: false}, presence: {key}}}}
##   broadcast {event: "broadcast", payload: {type: "broadcast", event, payload}}      fan-out to everyone in the room
##   presence  {event: "presence", payload: {type: "presence", event: "track", payload}} who is in the room, kept by
##             the server (presence_state on join, presence_diff after) — a client that drops leaves by itself
##   heartbeat {topic: "phoenix", event: "heartbeat"} every 25 s
## A room here is a Room object: `send(event, data)`, `track(meta)`, and the signals `message(event, data, from)`,
## `joined(key, meta)`, `left(key)`. The socket reconnects on its own (2, 4, 8 … 30 s) and rejoins every room.
## `url` can point at a local stand-in (tests/net/realtime_mock.py) for the headless tests.

const Cloud := preload("res://scripts/cloud/cloud_save.gd")

signal connected
signal disconnected

var url := Cloud.URL.replace("https://", "wss://") + "/realtime/v1/websocket?apikey=" + Cloud.KEY + "&vsn=1.0.0"
## who we are in every room (presence key): set by online.gd before the first join
var me := ""
var ws := WebSocketPeer.new()
var rooms := {}              # topic -> Room
var _ref := 0
var _beat := 0.0
var _retry := 0.0
var _backoff := 2.0
var _was_open := false
var _out: Array = []         # frames waiting for the socket
var started := false

class Room extends RefCounted:
	signal message(event: String, data: Dictionary, from: String)
	signal joined(key: String, meta: Dictionary)
	signal left(key: String)
	signal ready
	var name := ""
	var topic := ""
	var rt: Node
	var join_ref := ""
	var is_joined := false
	var meta := {}             # what we track (re-sent on rejoin)
	var members := {}          # presence key -> meta (not us)

	func send(event: String, data: Dictionary) -> void:
		data["from"] = rt.me
		rt._push(topic, "broadcast", { "type": "broadcast", "event": event, "payload": data }, join_ref)

	func track(m: Dictionary) -> void:
		meta = m
		if is_joined:
			rt._push(topic, "presence", { "type": "presence", "event": "track", "payload": meta }, join_ref)

	func leave() -> void:
		rt.leave(self)

func _ready() -> void:
	set_process(true)

## open the socket (idempotent)
func start() -> void:
	if started:
		return
	started = true
	_open()

func _open() -> void:
	ws = WebSocketPeer.new()
	ws.inbound_buffer_size = 1 << 20
	ws.outbound_buffer_size = 1 << 20
	var err := ws.connect_to_url(url)
	if err != OK:
		_retry = _backoff

func is_open() -> bool:
	return ws.get_ready_state() == WebSocketPeer.STATE_OPEN

## a room by name (joined now if the socket is open, else as soon as it opens)
func room(name: String) -> Room:
	var topic := "realtime:" + name
	if rooms.has(topic):
		return rooms[topic]
	var r := Room.new()
	r.name = name
	r.topic = topic
	r.rt = self
	rooms[topic] = r
	start()
	if is_open():
		_join(r)
	return r

func leave(r: Room) -> void:
	if r.is_joined:
		_push(r.topic, "phx_leave", {}, r.join_ref)
	r.is_joined = false
	rooms.erase(r.topic)

func _join(r: Room) -> void:
	_ref += 1
	r.join_ref = str(_ref)
	r.members = {}
	_send_raw({ "topic": r.topic, "event": "phx_join", "ref": r.join_ref, "join_ref": r.join_ref,
		"payload": { "config": { "broadcast": { "self": false, "ack": false }, "presence": { "key": me }, "private": false } } })

func _push(topic: String, event: String, payload: Dictionary, join_ref: String) -> void:
	_ref += 1
	var f := { "topic": topic, "event": event, "payload": payload, "ref": str(_ref), "join_ref": join_ref }
	if is_open():
		_send_raw(f)
	elif event != "broadcast":
		_out.append(f)        # positions go stale; presence and joins wait

func _send_raw(f: Dictionary) -> void:
	ws.send_text(JSON.stringify(f))

func _process(dt: float) -> void:
	if not started:
		return
	ws.poll()
	var st := ws.get_ready_state()
	if st == WebSocketPeer.STATE_OPEN:
		if not _was_open:
			_was_open = true
			_backoff = 2.0
			for t in rooms:
				_join(rooms[t])
			connected.emit()
		while ws.get_available_packet_count() > 0:
			var txt := ws.get_packet().get_string_from_utf8()
			var m: Variant = JSON.parse_string(txt)
			if m is Dictionary:
				_on_frame(m)
		_beat -= dt
		if _beat <= 0.0:
			_beat = 25.0
			_ref += 1
			_send_raw({ "topic": "phoenix", "event": "heartbeat", "payload": {}, "ref": str(_ref) })
	elif st == WebSocketPeer.STATE_CLOSED:
		if _was_open:
			_was_open = false
			for t in rooms:
				(rooms[t] as Room).is_joined = false
			disconnected.emit()
			_retry = _backoff
		elif _retry <= 0.0:
			_retry = _backoff
		_retry -= dt
		if _retry <= 0.0:
			_backoff = minf(_backoff * 2.0, 30.0)
			_open()

func _on_frame(m: Dictionary) -> void:
	var topic := String(m.get("topic", ""))
	var event := String(m.get("event", ""))
	var p: Variant = m.get("payload", {})
	var r: Room = rooms.get(topic)
	if r == null or not (p is Dictionary):
		return
	match event:
		"phx_reply":
			if String(m.get("ref", "")) == r.join_ref and String((p as Dictionary).get("status", "")) == "ok" and not r.is_joined:
				r.is_joined = true
				if not r.meta.is_empty():
					_push(r.topic, "presence", { "type": "presence", "event": "track", "payload": r.meta }, r.join_ref)
				for f in _out.filter(func(x): return x.topic == r.topic):
					_send_raw(f)
				_out = _out.filter(func(x): return x.topic != r.topic)
				r.ready.emit()
		"broadcast":
			var data: Variant = (p as Dictionary).get("payload", {})
			if data is Dictionary and String((data as Dictionary).get("from", "")) != me:
				r.message.emit(String((p as Dictionary).get("event", "")), data, String(data.get("from", "")))
		"presence_state":
			for k in p:
				_member(r, String(k), p[k])
		"presence_diff":
			for k in (p as Dictionary).get("joins", {}):
				_member(r, String(k), p.joins[k])
			for k in (p as Dictionary).get("leaves", {}):
				if String(k) != me and r.members.has(String(k)) and not (p as Dictionary).get("joins", {}).has(k):
					r.members.erase(String(k))
					r.left.emit(String(k))
		"phx_close", "phx_error":
			r.is_joined = false

func _member(r: Room, key: String, entry: Variant) -> void:
	if key == me or not (entry is Dictionary):
		return
	var metas: Array = (entry as Dictionary).get("metas", [])
	var meta: Dictionary = metas[metas.size() - 1] if not metas.is_empty() and metas[metas.size() - 1] is Dictionary else {}
	var fresh := not r.members.has(key)
	r.members[key] = meta
	if fresh:
		r.joined.emit(key, meta)
