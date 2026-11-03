extends Node
## Cloud save for the Godot build (the Dec 4 plan, phase 3): the same Supabase project and `player_saves` row the web game
## uses, so one account carries the phone and the desk. Sign-in is by email one-time code (Supabase GoTrue `/auth/v1/otp`
## then `/auth/v1/verify`; the project's email template must print `{{ .Token }}`), the session lives in user://session.json
## and refreshes itself. Google sign-in is the PKCE flow through the phone's own browser: the app listens on localhost (a
## TCPServer, port LOCAL_PORT), opens Supabase's authorize URL with that callback, the browser lands on
## http://localhost:<port>/callback?code=… (Chrome on Android reaches the device's own localhost), and the code is exchanged
## for a session — no deep link, no custom Android build. The project's redirect allowlist must carry the callback URL.
## A sync pulls the row, merges our namespace (`data.godot`, cloud_merge.gd rules) with the local files,
## writes the winners back to user:// and pushes the merged namespace with the row's revision bumped — the web game's own
## optimistic write sees a new revision and merges in turn (src/game/cloud-save.ts, mergeGodot). Google sign-in waits for an
## Android deep link (a custom Gradle build), noted on TASKBOARD.md.

const Merge := preload("res://scripts/cloud/cloud_merge.gd")
const URL := "https://gonsxecjmpemkguhheal.supabase.co"
const KEY := "sb_publishable_3JNGD-S_XEMNHahvllbxXg_bWPWegFs"
const SESSION := "user://session.json"
const FILES := { "profile": "user://profile.json", "character": "user://character.json", "inventory": "user://inventory.json", "mission01": "user://mission01.json", "quests": "user://quests.json" }

signal status_changed(text: String)
const LOCAL_PORT := 4321
const CALLBACK := "http://localhost:%d/callback" % LOCAL_PORT
var _server: TCPServer
var _verifier := ""
var _oauth_t := 0.0

var session := {}          # access_token, refresh_token, expires_at (unix), user_id, email
var last_sync := ""
var busy := false

func _ready() -> void:
	_load_session()

func signed_in() -> bool:
	return session.has("access_token") and session.get("user_id", "") != ""

func status() -> String:
	if not signed_in():
		return "Cloud: not signed in"
	return "Cloud: %s%s" % [session.get("email", "?"), (" · synced " + last_sync) if last_sync != "" else ""]

# --------------------------------------------------------------------------------------------- HTTP
## one request; returns {code, body (parsed JSON or null), text}
func _call(path: String, method: HTTPClient.Method, body: Variant = null, auth := false, extra: PackedStringArray = []) -> Dictionary:
	var req := HTTPRequest.new()
	add_child(req)
	var headers := PackedStringArray(["apikey: " + KEY, "Content-Type: application/json"])
	if auth and signed_in():
		headers.append("Authorization: Bearer " + str(session.access_token))
	else:
		headers.append("Authorization: Bearer " + KEY)
	for h in extra:
		headers.append(h)
	var err := req.request(URL + path, headers, method, JSON.stringify(body) if body != null else "")
	if err != OK:
		req.queue_free()
		return { "code": 0, "body": null, "text": "request error %d" % err }
	var res: Array = await req.request_completed
	req.queue_free()
	var text := (res[3] as PackedByteArray).get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(text) if text != "" else null
	return { "code": int(res[1]), "body": parsed, "text": text }

# --------------------------------------------------------------------------------------------- auth
## asks Supabase to email a one-time code; true when it was accepted
func send_code(email: String) -> bool:
	var r := await _call("/auth/v1/otp", HTTPClient.METHOD_POST, { "email": email.strip_edges(), "create_user": true })
	if r.code >= 200 and r.code < 300:
		status_changed.emit("Code sent to " + email)
		return true
	status_changed.emit("Couldn't send the code: " + _err(r))
	return false

## signs in with the emailed code
func verify_code(email: String, code: String) -> bool:
	var r := await _call("/auth/v1/verify", HTTPClient.METHOD_POST, { "type": "email", "email": email.strip_edges(), "token": code.strip_edges() })
	if r.code >= 200 and r.code < 300 and r.body is Dictionary and r.body.has("access_token"):
		_take_session(r.body, email.strip_edges())
		status_changed.emit("Signed in as " + email)
		return true
	status_changed.emit("Code refused: " + _err(r))
	return false

# --------------------------------------------------------------------------------------------- Google (PKCE via localhost)
## opens the browser on Google through Supabase; the callback is caught in _process. Returns false if the port is taken.
func sign_in_google() -> bool:
	if not _start_listener(180.0):
		return false
	var url := "%s/auth/v1/authorize?provider=google&redirect_to=%s&code_challenge=%s&code_challenge_method=s256&prompt=select_account" % [URL, CALLBACK.uri_encode(), _challenge()]
	status_changed.emit("Finish signing in with Google in the browser, then come back")
	last_auth_url = url
	if not headless:
		OS.shell_open(url)
	return true

## the magic link by email, on the same PKCE callback: tap the link on this phone and it lands back in the app
## (no email template change needed; a code in the email still works through verify_code)
func send_link(email: String) -> bool:
	if not _start_listener(600.0):
		return false
	var r := await _call("/auth/v1/otp?redirect_to=%s" % CALLBACK.uri_encode(), HTTPClient.METHOD_POST, { "email": email.strip_edges(), "create_user": true, "code_challenge": _challenge(), "code_challenge_method": "s256" })
	if r.code >= 200 and r.code < 300:
		status_changed.emit("Link sent to %s · open it on this phone (or type the code if the email shows one)" % email)
		return true
	_stop_oauth()
	status_changed.emit("Couldn't send the link: " + _err(r))
	return false

## opens the local port the browser comes back to, with a fresh PKCE verifier
func _start_listener(timeout: float) -> bool:
	_stop_oauth()
	_server = TCPServer.new()
	if _server.listen(LOCAL_PORT, "127.0.0.1") != OK:
		_server = null
		status_changed.emit("Couldn't open the sign-in port %d" % LOCAL_PORT)
		return false
	var bytes := PackedByteArray()
	for i in 48:
		bytes.append(randi() % 256)
	_verifier = _b64url(bytes)
	_oauth_t = timeout
	return true

func _challenge() -> String:
	return _b64url(_sha256(_verifier))

var last_auth_url := ""
## tests: no browser
var headless := false

static func _sha256(text: String) -> PackedByteArray:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(text.to_utf8_buffer())
	return ctx.finish()

static func _b64url(bytes: PackedByteArray) -> String:
	return Marshalls.raw_to_base64(bytes).replace("+", "-").replace("/", "_").replace("=", "")

func _stop_oauth() -> void:
	if _server:
		_server.stop()
		_server = null
	_oauth_t = 0.0

func _process(dt: float) -> void:
	if not _server:
		return
	_oauth_t -= dt
	if _oauth_t <= 0.0:
		_stop_oauth()
		status_changed.emit("Sign-in timed out")
		return
	if not _server.is_connection_available():
		return
	var peer := _server.take_connection()
	var req := ""
	var waited := 0
	while waited < 50 and not req.contains("\r\n\r\n") and not req.contains("\n\n"):
		if peer.get_available_bytes() > 0:
			req += peer.get_string(peer.get_available_bytes())
		else:
			OS.delay_msec(20)
			waited += 1
	var code := ""
	var err := ""
	var first := req.get_slice("\n", 0)
	if first.begins_with("GET "):
		var path := first.get_slice(" ", 1)
		var q := path.get_slice("?", 1) if path.contains("?") else ""
		for kv in q.split("&"):
			var pair := kv.split("=")
			if pair.size() == 2:
				if pair[0] == "code":
					code = pair[1].uri_decode()
				elif pair[0] == "error_description" or pair[0] == "error":
					err = pair[1].uri_decode()
	var body := "<html><body style=\"background:#0b1420;color:#e8f0ff;font-family:sans-serif;text-align:center;padding-top:30vh\"><h2>%s</h2><p>You can close this tab and go back to World Fracture.</p></body></html>" % ("Signed in" if code != "" else "Sign-in failed")
	peer.put_data(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % body.to_utf8_buffer().size()).to_utf8_buffer())
	peer.put_data(body.to_utf8_buffer())
	await get_tree().create_timer(0.2).timeout
	peer.disconnect_from_host()
	if code == "":
		if err != "":
			_stop_oauth()
			status_changed.emit("Google refused: " + err)
		return   # a stray request (a favicon): keep listening
	_stop_oauth()
	var r := await _call("/auth/v1/token?grant_type=pkce", HTTPClient.METHOD_POST, { "auth_code": code, "code_verifier": _verifier })
	if r.code >= 200 and r.code < 300 and r.body is Dictionary and r.body.has("access_token"):
		_take_session(r.body)
		status_changed.emit("Signed in as " + str(session.get("email", "")))
		var line := await sync()
		status_changed.emit(line)
	else:
		status_changed.emit("Sign-in failed: " + _err(r))

func sign_out() -> void:
	session = {}
	DirAccess.remove_absolute(SESSION)
	last_sync = ""
	status_changed.emit(status())

func _take_session(b: Dictionary, email := "") -> void:
	session = {
		"access_token": b.access_token, "refresh_token": b.get("refresh_token", ""),
		"expires_at": int(Time.get_unix_time_from_system()) + int(b.get("expires_in", 3600)) - 60,
		"user_id": str((b.get("user", {}) as Dictionary).get("id", session.get("user_id", ""))),
		"email": email if email != "" else str(session.get("email", (b.get("user", {}) as Dictionary).get("email", ""))),
	}
	var f := FileAccess.open(SESSION, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(session))

func _load_session() -> void:
	var f := FileAccess.open(SESSION, FileAccess.READ)
	if f:
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary and d.has("access_token"):
			session = d

## a fresh access token when the saved one is stale; false when the refresh fails (signed out)
func _ensure_fresh() -> bool:
	if not signed_in():
		return false
	if int(Time.get_unix_time_from_system()) < int(session.get("expires_at", 0)):
		return true
	var r := await _call("/auth/v1/token?grant_type=refresh_token", HTTPClient.METHOD_POST, { "refresh_token": session.get("refresh_token", "") })
	if r.code >= 200 and r.code < 300 and r.body is Dictionary and r.body.has("access_token"):
		_take_session(r.body)
		return true
	sign_out()
	status_changed.emit("Session expired: sign in again")
	return false

static func _err(r: Dictionary) -> String:
	if r.body is Dictionary:
		for k in ["msg", "message", "error_description", "error"]:
			if r.body.has(k):
				return str(r.body[k])
	return "HTTP %d" % int(r.code)

# --------------------------------------------------------------------------------------------- the files
## the local files as a namespace: {file: {updated, data}}
static func local_namespace() -> Dictionary:
	var out := {}
	for k in FILES:
		var path: String = FILES[k]
		if not FileAccess.file_exists(path):
			continue
		var f := FileAccess.open(path, FileAccess.READ)
		if not f:
			continue
		var d: Variant = JSON.parse_string(f.get_as_text())
		if d is Dictionary:
			out[k] = { "updated": Time.get_datetime_string_from_unix_time(FileAccess.get_modified_time(path), true) + "Z", "data": d }
	return out

## writes the merged winners that differ from the local files
static func apply_namespace(ns: Dictionary, local: Dictionary) -> int:
	var written := 0
	for k in ns:
		if not FILES.has(k):
			continue
		var mine: Dictionary = local.get(k, {})
		if not mine.is_empty() and JSON.stringify(mine.data) == JSON.stringify(ns[k].data):
			continue
		var f := FileAccess.open(FILES[k], FileAccess.WRITE)
		if f:
			f.store_string(JSON.stringify(ns[k].data))
			written += 1
	return written

# --------------------------------------------------------------------------------------------- sync
## pull, merge, apply, push. Returns a one-line result for the status.
func sync() -> String:
	if busy:
		return "Sync already running"
	if not await _ensure_fresh():
		return status()
	busy = true
	var uid: String = session.user_id
	var r := await _call("/rest/v1/player_saves?user_id=eq.%s&select=data,revision" % uid, HTTPClient.METHOD_GET, null, true)
	if r.code < 200 or r.code >= 300 or not (r.body is Array):
		busy = false
		return "Cloud read failed: " + _err(r)
	var local := local_namespace()
	var rows: Array = r.body
	var merged: Dictionary
	var result := ""
	if rows.is_empty():
		merged = Merge.merge(local, {})
		var ins := await _call("/rest/v1/player_saves", HTTPClient.METHOD_POST, { "user_id": uid, "data": { "godot": merged }, "revision": 1, "device_id": "godot" }, true, ["Prefer: return=minimal"])
		result = "Uploaded" if ins.code >= 200 and ins.code < 300 else "Cloud write failed: " + _err(ins)
	else:
		var row: Dictionary = rows[0]
		var data: Dictionary = row.get("data", {}) if row.get("data") is Dictionary else {}
		var cloud_ns: Dictionary = data.get("godot", {}) if data.get("godot") is Dictionary else {}
		merged = Merge.merge(local, cloud_ns)
		var written := apply_namespace(merged, local)
		if Merge.same(merged, cloud_ns):
			result = "Up to date" if written == 0 else "Downloaded %d file(s)" % written
		else:
			data["godot"] = merged
			var rev := int(row.get("revision", 1))
			var up := await _call("/rest/v1/player_saves?user_id=eq.%s&revision=eq.%d" % [uid, rev], HTTPClient.METHOD_PATCH, { "data": data, "revision": rev + 1, "device_id": "godot", "updated_at": Time.get_datetime_string_from_system(true) + "Z" }, true, ["Prefer: return=representation"])
			if up.code >= 200 and up.code < 300 and up.body is Array and not (up.body as Array).is_empty():
				result = "Synced" + ((" · %d file(s) downloaded" % written) if written > 0 else "")
			elif up.code >= 200 and up.code < 300:
				result = "Another device saved first; sync again"
			else:
				result = "Cloud write failed: " + _err(up)
	busy = false
	if not result.begins_with("Cloud") and not result.begins_with("Another"):
		last_sync = Time.get_time_string_from_system().left(5)
	status_changed.emit(status())
	return result
