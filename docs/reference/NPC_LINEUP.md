# NPC & operator lineup (owner, Nov 11)

The art target: `npc-lineup-full-body.png` (full-body board, 12 groups) and `npc-lineup-portraits.png` (the same cast,
waist up). Owner: "Make sure models render like this" — realistic, GTA V-style people, each in their own clothes. Route
chosen by the owner: **both** — MakeHuman for the crowds, Meshy for the hero characters — **whole lineup**.

## Where it stands

| Group | Now in game | Next |
| --- | --- | --- |
| Civilians, police & security, business & workers, gangs, workers & support | civ bodies (`scripts/civ_body_sdf.py`) with the Meshy heads, dressed from the NPC wardrobe in `scripts/character/outfits.gd` (`npc-*`), 16 walkers on the street (`scripts/city/civilians.gd` MIX); the MultiMesh stick crowd only beyond ~10 m | MakeHuman bodies once the CC0 system asset pack (skins, clothes, hair) is reachable: it downloads only from makehumancommunity.org (blocked in the build sandbox); the owner's computer can fetch it, or attach `makehuman_system_assets_cc0.zip`. MPFB2's base mesh, targets and its `rig.mixamo.json` / `weights.mixamo.json` are on GitHub and fit our skeleton |
| Operators (Titan / Hunter / Warlock = goliath / nyx / cipher frames) | **The board's own characters (Nov 15)**: made in Meshy from the board crops (`lineup-crops/`), rigged in Meshy, in `models/characters/{titan,hunter,warlock}.glb`; the player's armoured operator wears its frame's one (`catalog.gd` HEROES — out of armour the civ body and wardrobe stay) | — |
| Police, business woman, white-tee man | **Meshy characters (Nov 15)**: `models/characters/{police,civ-business,civ-tee}.glb` — every male beat cop and `npc-police` walker, and about 60% of the everyday crowd (`catalog.gd` PEOPLE, `civilians.gd`) | the rest of the board needs Meshy credits (about 87 left; owner chose not to buy more) |
| Companions, factions, special & legendary, dimensional citizens | — | Meshy, through the owner's browser (UI only — never the API, never a scraped token) |

## NPC wardrobe ↔ board

| Board figure | Outfit id |
| --- | --- |
| white tee & jeans · crop top & ripped jeans · beige suit · black blazer · grey hoodie & backpack · yellow sundress (tank & shorts for now) · jersey 12 & cargo shorts · older woman's print shirt | `npc-tee-jeans` `npc-crop-jeans` `npc-beige-suit` `npc-business` `npc-hoodie-backpack` `npc-summer` `npc-jersey-shorts` `npc-elder` |
| police · SWAT · security · hi-vis patrol | `npc-police` `npc-swat` `npc-security` `npc-hivis` |
| shop owner (apron) · chef · mechanic · doctor / scientist · construction · delivery | `npc-apron` `npc-chef` `npc-mechanic` `npc-doctor` `npc-construction` `npc-delivery` |
| tank & cargos · crop top & cargos · red jersey 23 & bandana · all black · leather jacket · grey hoodie · shirtless | `npc-tank-cargo` `npc-crop-cargo` `npc-jersey-23` `npc-all-black` `npc-leather` `heather-hoodie` `npc-shirtless` |
| paramedic · firefighter · engineer · researcher · hunter · fisherman | `npc-paramedic` `npc-firefighter` `npc-engineer` `npc-doctor` `npc-hunter` `npc-fisherman` |

Not yet possible on the civ body: dresses and skirts, long coats, hard hats / chef hats / police caps, printed text
(POLICE, numbers), tattoos, the dog. Those wait for modelled characters.

## Meshy batch (hero characters) — prompts

Each: "realistic GTA V style full body character, A-pose, neutral background, PBR textures" plus:

- **Titan** — heavy armoured male operator, black plate armour with orange glowing seams, bulky pauldrons
- **Hunter** — female operator, black tactical bodysuit and light armour, katana on the back, dark hair in a ponytail
- **Warlock** — female operator, long braids, black and purple armoured coat, purple energy in one hand
- **Companions** — man in a black biker jacket over a grey tee; woman in tactical crop top and cargo pants with glasses;
  bearded tattooed man in a black tank and combat trousers; pink-haired woman in black and pink armour; young man in an
  olive field jacket over black
- **Factions** — Nexus Guard (blue and black tactical armour), Solara Nomads (desert hooded robe, tan), Verdant Circle
  (green camouflage ranger), Frostveil Coalition (white fur-collared winter armour), Neon Syndicate (black catsuit, violet
  visor, neon trim), Fracture Order (dark purple hooded robe, glowing sigil)
- **Special & legendary** — white-bearded elder in a long black coat with gold trim; silver-haired woman in black and
  teal light armour; man with a glowing violet eye in a long coat; gold-masked champion in black and gold armour; woman
  with blue face markings in a black gown with a high slit
- **Dimensional citizens** — pale blue-skinned woman in a white gown; silver-skinned elf knight in ornate armour;
  red-skinned horned woman in crimson silks; purple-skinned mage in a blue and gold robe; raccoon-like creature with
  goggles in a leather harness

How the Nov 15 six came in: image → 3D in Meshy (A-pose reference from the crop), Remesh (fixed 30K triangles —
the textured remesh keeps the PBR maps), Rig (humanoid; Mixamo skeleton, Running / Walking / Combat_Stance), download
GLB. `tools/meshy_prep_rig.py` renames the clips (walk / run / combat, idle seeded — `stand_idle.gd` rebuilds it) and
scales the maps to 2048; a rig that came back untextured gets the original's maps baked on by `tools/meshy_bake_rig.py`.
Every file passes `scripts/check-meshy-textures.py`; `tests/character/meshy_people_test.gd` checks they load and play.

Earlier plan: auto-rig in Meshy, export GLB, re-target onto the game's mixamo skeleton (the operators' clips), import with
`generate_lods=false` (the Nov 8 triangle collapse tore Meshy's multi-shell meshes — never decimate them that way).
