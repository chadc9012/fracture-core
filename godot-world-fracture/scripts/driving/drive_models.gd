extends RefCounted
const Catalog = preload("res://scripts/garage/catalog.gd")
const Kit = preload("res://scripts/garage/garage_kit.gd")
static func spawn(parent: Node3D, id: String, state) -> Node3D:
	var v := Catalog.vehicle(id)
	if v.is_empty():
		return null
	var path: String = String(v.model)
	if not ResourceLoader.exists(path):
		push_warning("Drive: missing model " + path)
		return placeholder(parent)
	var scene := load(path) as PackedScene
	if scene == null:
		return placeholder(parent)
	var car := scene.instantiate() as Node3D
	if car == null:
		return placeholder(parent)
	parent.add_child(car)
	Kit.apply(car, state.installed(id), String(v.paint), state.tune(id))
	return car
static func placeholder(parent: Node3D) -> Node3D:
	var node := Node3D.new()
	parent.add_child(node)
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(2.0, 1.0, 4.0)
	mesh.mesh = box
	mesh.position.y = 0.6
	node.add_child(mesh)
	return node
