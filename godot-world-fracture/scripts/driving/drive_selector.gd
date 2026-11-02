extends OptionButton
const Catalog = preload("res://scripts/garage/catalog.gd")
func _ready() -> void:
	for v in Catalog.VEHICLES:
		add_item(String(v.name))
		set_item_metadata(item_count - 1, String(v.id))
func selected_id() -> String:
	return String(get_item_metadata(selected))
