extends SceneTree
## Times the street slice's per-frame pieces one by one (district, enemies, civilians, traffic, gunplay, the operator) to
## find what the frame spends its script time on.
func _initialize() -> void:
	_run.call_deferred()

func _t(label: String, c: Callable, n := 30) -> void:
	var t0 := Time.get_ticks_usec()
	for i in n:
		c.call()
	print("%-28s %.3f ms per call" % [label, (Time.get_ticks_usec() - t0) / 1000.0 / n])

func _run() -> void:
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	root.add_child(main)
	for i in 10:
		await process_frame
	if main.creator:
		main.creator.confirmed.emit(main.creator.look)
	var night := OS.get_cmdline_user_args().has("night")
	main._open_street(night, "nexus", true)
	for i in 10:
		await process_frame
	var st: Node = main.street
	print("boxes ", st.operator.obstacles.size(), " walkers ", st.civilians.walkers.size(), " traffic ", st.traffic.cars.size() if "cars" in st.traffic else -1, " enemies ", st.enemies.enemies.size() if st.enemies else 0)
	var dt := 1.0 / 60.0
	_t("whole street _process", func(): st._process(dt))
	_t("district.update", func(): st.district.update(st.operator.position.z))
	if st.enemies:
		_t("enemies.step", func(): st.enemies.step(dt))
	_t("civilians.step", func(): st.civilians.step(dt))
	_t("traffic.step", func(): st.traffic.step(dt))
	_t("operator.step", func(): st.operator.step(dt, Vector2(0, 1), Vector2.ZERO, false, false))
	if st.gunplay:
		_t("gunplay.step", func(): st.gunplay.step(dt, st.cam, false, false, 0.0))
	_t("dressing", func(): st._step_dressing(dt))
	quit()
