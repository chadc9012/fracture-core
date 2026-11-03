extends SceneTree
## cloud_save.gd's Google sign-in: the localhost callback takes the code from the browser's request, answers the tab, and
## exchanges the code (the exchange fails here with no network, which is the right outcome to check).
const Cloud = preload("res://scripts/cloud/cloud_save.gd")

func _init() -> void:
	var c := Cloud.new()
	c.headless = true
	root.add_child(c)
	var lines: Array = []
	c.status_changed.connect(func(t: String): lines.append(t))
	var ok := true
	var r1: bool = c.sign_in_google() and c.last_auth_url.contains("provider=google") and c.last_auth_url.contains("code_challenge=") and c.last_auth_url.contains("localhost%3A4321")
	print("opens the authorize url with a PKCE challenge: ", r1)
	ok = ok and r1
	var peer := StreamPeerTCP.new()
	var r2: bool = peer.connect_to_host("127.0.0.1", 4321) == OK
	for i in 50:
		peer.poll()
		if peer.get_status() == StreamPeerTCP.STATUS_CONNECTED:
			break
		OS.delay_msec(20)
	r2 = r2 and peer.get_status() == StreamPeerTCP.STATUS_CONNECTED
	print("the browser can reach the callback port: ", r2)
	ok = ok and r2
	peer.put_data("GET /callback?code=abc123&other=1 HTTP/1.1\r\nHost: localhost:4321\r\n\r\n".to_utf8_buffer())
	await process_frame
	c._process(0.016)
	await create_timer(0.6).timeout
	peer.poll()
	var reply := ""
	if peer.get_available_bytes() > 0:
		reply = peer.get_string(peer.get_available_bytes())
	var r3: bool = reply.contains("200 OK") and reply.contains("Signed in")
	print("the tab is answered: ", r3)
	ok = ok and r3
	await create_timer(3.0).timeout
	var r4: bool = c._server == null and lines.any(func(t: String) -> bool: return t.begins_with("Google sign-in failed") or t.begins_with("Signed in with Google"))
	print("the code is exchanged and the port closed: ", r4, " ", lines)
	ok = ok and r4
	print("Google callback test: ", ok)
	quit(0 if ok else 1)
