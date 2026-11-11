# World Fracture — Lumen Luxe Expanded Collection

**28 new GLB outfit previews** across Casual (6), Streetwear (6), Urban (4), Designer (6), Dresses (6). Fictional original labels: Vela Basics, Arc & Vale, Sorelle Atelier, Noir District, Ghostline, Aureline, Vesper House, Obsidian Label, Crown & Loom, Maison Vero.

All garments are actual 3D meshes with named components, not 2D illustrations. They are **stylized prototype garments on basic mannequins**, not finished photoreal game-ready clothing. Models include no armatures, skin weights, bone attachment, UV textures, fabric simulation or animation. These outfits are preview stand-ins and will need remeshing/rigging/adapting to the game's existing player body and skeleton to function as equippable clothing.

## Import into Godot 4
Copy the GLB files into your Godot project's `res://assets/clothing/lumen_luxe/` folder. Open GLBs as imported scenes or instantiate them via `load("res://assets/clothing/lumen_luxe/<filename>.glb")`. Use `catalog.json` for names, categories, fictional brands and suggested Nex prices. **Do not treat catalog prices as real inventory entitlements**—connect purchase/equip to the game's own authoritative inventory, currency, and save logic.

## Limits
- No edits to the user's Godot APK or original project.
- No rigging / physics, no verified Godot 4 runtime test, no in-game store integration.
- Distinct styling and geometry are simplified; no real-world designer trademarks or logos copied.
- Position is Y-up around a ~1.9m mannequin. Use fit/retargeting before player animation.
