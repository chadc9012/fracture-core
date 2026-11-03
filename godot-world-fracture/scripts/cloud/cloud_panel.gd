extends Control
## The cloud sign-in panel over the globe: email → SEND CODE → the emailed code → SIGN IN; once in, SYNC NOW and SIGN OUT,
## with the last result as a line. Talks to cloud_save.gd.

signal closed

var cloud: Node
var _email: LineEdit
var _code: LineEdit
var _line: Label
var _send: Button
var _verify: Button
var _sync: Button
var _out: Button
var _google: Button

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.03, 0.05, 0.92)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var box := VBoxContainer.new()
	box.position = Vector2(24, 80)
	box.custom_minimum_size = Vector2(480, 0)
	box.add_theme_constant_override("separation", 12)
	add_child(box)
	var title := Label.new()
	title.text = "CLOUD SAVE"
	title.add_theme_font_size_override("font_size", 26)
	box.add_child(title)
	var blurb := Label.new()
	blurb.text = "One account carries your operator, gear and progress between this phone and the web game.\nSign in with Google in your browser, or with your email: we send a one-time code."
	blurb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	blurb.custom_minimum_size = Vector2(480, 0)
	blurb.modulate = Color(0.8, 0.85, 0.9)
	box.add_child(blurb)
	_email = LineEdit.new()
	_email.placeholder_text = "you@example.com"
	_email.custom_minimum_size = Vector2(0, 48)
	box.add_child(_email)
	_send = Button.new()
	_send.text = "SEND CODE"
	_send.custom_minimum_size = Vector2(0, 48)
	_send.pressed.connect(_on_send)
	box.add_child(_send)
	_code = LineEdit.new()
	_code.placeholder_text = "6-digit code from the email"
	_code.custom_minimum_size = Vector2(0, 48)
	box.add_child(_code)
	_verify = Button.new()
	_verify.text = "SIGN IN"
	_verify.custom_minimum_size = Vector2(0, 48)
	_verify.pressed.connect(_on_verify)
	box.add_child(_verify)
	var google := Button.new()
	google.text = "SIGN IN WITH GOOGLE"
	google.custom_minimum_size = Vector2(0, 48)
	google.add_theme_color_override("font_color", Color(1.0, 0.85, 0.5))
	google.pressed.connect(func(): cloud.sign_in_google())
	box.add_child(google)
	_google = google
	_sync = Button.new()
	_sync.text = "SYNC NOW"
	_sync.custom_minimum_size = Vector2(0, 48)
	_sync.pressed.connect(_on_sync)
	box.add_child(_sync)
	_out = Button.new()
	_out.text = "SIGN OUT"
	_out.custom_minimum_size = Vector2(0, 48)
	_out.pressed.connect(func(): cloud.sign_out(); _refresh())
	box.add_child(_out)
	_line = Label.new()
	_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_line.custom_minimum_size = Vector2(480, 0)
	_line.modulate = Color(0.6, 1.0, 0.85)
	box.add_child(_line)
	var close := Button.new()
	close.text = "← BACK"
	close.custom_minimum_size = Vector2(0, 48)
	close.pressed.connect(func(): closed.emit())
	box.add_child(close)
	cloud.status_changed.connect(func(t: String): _line.text = t; _refresh())
	_refresh()

func _refresh() -> void:
	var in_: bool = cloud.signed_in()
	_email.visible = not in_
	_send.visible = not in_
	_code.visible = not in_
	_verify.visible = not in_
	_google.visible = not in_
	_sync.visible = in_
	_out.visible = in_
	if _line.text == "":
		_line.text = cloud.status()

func _on_send() -> void:
	_send.disabled = true
	await cloud.send_code(_email.text)
	_send.disabled = false

func _on_verify() -> void:
	_verify.disabled = true
	if await cloud.verify_code(_email.text, _code.text):
		_line.text = await cloud.sync()
	_verify.disabled = false
	_refresh()

func _on_sync() -> void:
	_sync.disabled = true
	_line.text = "Syncing…"
	_line.text = await cloud.sync()
	_sync.disabled = false
