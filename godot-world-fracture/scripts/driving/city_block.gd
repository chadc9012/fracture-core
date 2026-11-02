extends Node3D
const Buildings = preload("res://scripts/driving/city_buildings.gd")
const Streetlights = preload("res://scripts/driving/city_streetlights.gd")
const Sidewalk = preload("res://scripts/driving/city_sidewalk.gd")
func _ready() -> void:
	add_child(Sidewalk.new())
	add_child(Buildings.new())
	add_child(Streetlights.new())
