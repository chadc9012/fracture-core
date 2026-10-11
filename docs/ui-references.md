# UI references → design plan

Source: interfaceingame.com (owner's pick; Destiny 2 first, Helldivers 2 and GTA V to follow). These screenshots are layout and style
references only; no art or text is copied.

## Destiny 2 → World Fracture

| Destiny 2 screen | What we take | Status |
|---|---|---|
| Character | One character menu with tabs across the top (Collections · Triumphs · Character · Inventory · ⚙). Character tab: subclass diamond and weapons on the left, the live operator in the centre on an emblem backdrop, currencies + **Power** + five armor slots and attribute bars on the right. Click a slot to swap. | **Built**: `CharacterScreen.tsx`, view model `character-sheet.ts` (tested). Opens with Tab / F1 or the HUD inventory button. |
| Item card (armor set / rifle) | Rarity-coloured header (name, type), big Power number, source line, stat bars, perk chips | **Built**: `ItemCard` (hover/focus a slot, and in the swap picker) |
| Collections | Category tiles with owned / total | **Built**: Armor, Exotics, Weapons, Vehicles, Landmarks |
| Triumphs | Score total, objectives with progress bars | **Built**: six triumphs read from the save (campaign, landmarks, scenario bosses, dungeons, a full set, vehicles) |
| Key mapping / Video settings | Settings with a left category column and a binding table | Exists in `SettingsWindow`/`ControlsPanel`; restyle **planned** |
| Destinations / Director | Planet map with activity nodes, tabs Pursuits · Map · Destinations | Star map exists (`StarMap.tsx`); Director tabs **planned** |
| New mission banner, level up | Slanted ribbon "NEW MISSION" + wide-spaced location name; centred "LEVEL UP n" + "Upgrade point available" toast | **Planned** (LevelUpOverlay exists; restyle) |
| Vendor (faction reward / reputation) | NPC portrait left, reputation + bounties right | **Planned** for Nexus shopkeepers |
| Press enter to play | Minimal start screen | Title screen already exists (MainMenu) |
