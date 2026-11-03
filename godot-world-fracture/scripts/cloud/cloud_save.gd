extends Node
## Cloud save for the Godot build (the Dec 4 plan, phase 3): the same Supabase project and `player_saves` row the web game
## uses, so one account carries the phone and the desk. Sign-in is by email one-time code (Supabase GoTrue `/auth/v1/otp`
## then `/auth/v1/verify`; the project's email template must print `{{ .Token }}`), the session lives in user://session.json
## and refreshes itself. A sync pulls the row, merges our namespace (`data.godot`, cloud_merge.gd rules) with the local files,
## writes the winners back to user:// and pushes the merged namespace with the row's revision bumped — the web game's own
## optimistic write sees a new revision and merges in turn (src/game/cloud-save.ts, mergeGodot). Google sign-in waits for an
## Android deep link (a custom Gradle build), noted on TASKBOARD.md.

const Merge := preload("res://scripts/cloud/cloud_merge.gd")
const URL := "https://gonsxecjmpemkguhheal.supabase.co"
const KEY := "sb_publishable_3JNGD-S_XEMNHahvllbxXg_bWPWegFs"
const SESSION := "user://session.json"
const FILES := { "profile": "user://profile.json", "character": "user://character.json", "inventory": "user://inventory.json", "mission01": "user://mission01.json" }

signal status_changed(text: String)

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
