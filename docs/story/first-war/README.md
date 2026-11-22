# The First War: story and characters (owner, Nov 21)

The owner's First War material: the story bible, the campaign kickoff and the five legendary characters. It is
**proposed historical arc, not implemented content** (see FIRST_WAR_KICKOFF.md, "Continuity").

| File | What |
| --- | --- |
| `WORLD_FRACTURE_STORY_BIBLE.md` | consolidated story: protagonists, First Witness, Astryans, relics, guardians, Origin Engine, Elyndra, Prime Origin, continuity rules |
| `FIRST_WAR_KICKOFF.md` | the First War arc: Elyndra Concord vs Null Choir vs the Unbound, 5 chapters, 4 encounters |
| `specs/*.md` | 3D production brief per character (look, materials, rig, animation list) |
| `boards/<name>.jpg` | character boards: hero art, 4-view turnaround, 5 expressions, combat animation samples |
| `boards/ref-*.jpg` | single reference portraits from the character pack (none for Vael Turog: its source image was missing from the pack) |
| `concept/*.jpg` | world concept posters and maps (1600 px copies) |

## The five

| Character | Faction | Role | Board |
| --- | --- | --- | --- |
| Ilyra Sen, the Voice of the Concord | Elyndra Concord | Supreme Leader, Celestial Sovereign (spear) | boards/ilyra-sen.jpg |
| Vael Turog, the Severant | Null Choir | Supreme Commander, Reality Executioner (blade) | boards/vael-turog.jpg |
| Auren Thale, the First Cartographer | Elyndra Concord | Explorer, Rift Pathfinder (staff) | boards/auren-thale.jpg |
| The Veiled Sovereign | The Unbound | Founder and Commander, Paradox Strategist | boards/veiled-sovereign.jpg |
| The Echo Before Names, the First Consciousness | Elyndra (Origin) | Primordial Guide, Reality Architect | boards/echo-before-names.jpg |

## 3D models: status

The owner also sent procedural blockouts (all five) and Ilyra Sen refinement passes 01–11 (pass 08 textured, pass 10
a rig placement guide, pass 11 a Blender rig script). Reviewed Nov 21 and **not put in the game**:

- they are assemblies of primitive shapes (30–190 separate parts, Z-up), not a sculpted body; in the look-dev render
  they read as blobs next to the operator bodies;
- the blockouts have no materials; pass 08 has 1024 px procedural textures, which fail the pixelation gate
  (`scripts/check-meshy-textures.py`: under 2048 px and soft);
- no skeleton or skinning (the pass 11 script is untested, with placeholder weights, as its own README says).

They stay with the owner's files as shape and proportion references; they are not committed.

**Path to game-ready models:** the boards already carry a clean four-view turnaround for each character, which is
what Meshy's image-to-3D (multi-view) wants. Per character: crop the turnaround views, image-to-3D at 4K PBR, remesh
to the hero budget (20–40k tris, docs/reference/MESHY_UPGRADE.md), auto-rig (humanoid) and retarget to the game's
skeleton like the operator bodies, then the gate and a look-dev render. The Echo's robes and the Veiled Sovereign's
cloak may need the cape split off as its own piece. Cost is about 30–40 credits per character plus rigging; the
Meshy account is nearly out of credits after the Nov 15 batches, so this waits on a top-up.

## Meshy inputs (Nov 21)

`meshy-input/<name>.png` is the full-body hero figure cut from each board (the turnaround views on the boards are only
~140 px wide, too small to generate from). In the Meshy agent: upload the crop, ask for a clean front-view A-pose
concept of the same character on a neutral background (no rock, no effects, weapon separate), then image-to-3D at 4K
PBR from that concept.
