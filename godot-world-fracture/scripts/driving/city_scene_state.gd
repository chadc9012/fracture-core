extends RefCounted
var current_district := "Nexus City"
var last_garage := "nexus-customs"
var garage_visits := 0
func enter_garage() -> void:
	garage_visits += 1
