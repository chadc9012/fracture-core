extends RefCounted
const State = preload("res://scripts/garage/garage_state.gd")
static func load_state():
	return State.load_or_fresh()
static func save_state(state) -> bool:
	return state.save()
