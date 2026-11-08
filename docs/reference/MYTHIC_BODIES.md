# Mythic operator bodies (tier above Elite, 340+ worn armor power)

Status: tier logic is live (src/game/operator-tier.ts). No Mythic GLBs exist yet, so Mythic wearers see the Elite body.

## Direction
Mythic is the Fracture made flesh: the Elite hero after the simulation starts to break around them. Same silhouette, face and
class identity as the Elite body so players recognise their hero, but the armor is fractured, floating-plated and lit from
within. Palette per class keeps their Elite colours and adds one shared Mythic motif: cracks of white-gold light with a faint
glitch-cyan edge, a few armor plates detached and hovering a hand's width off the body, and a thin broken-halo ring behind the shoulders.

## Meshy prompts (image-to-3D from the Elite render, then text refine; A-pose, full body, plain background)
- TITAN / Goliath: "Heavily armored soldier, same design as the reference, armor plating cracked open with glowing white-gold fracture lines, shoulder and chest plates floating slightly detached, torn dark cloak, broken light halo behind shoulders, gritty realistic PBR, A-pose, full body"
- HUNTER / Nyx: "Agile female operator, same design as the reference, black tactical suit with white-gold fracture lines and glitch-cyan edges, floating detached armor shards at shoulders and thighs, red scarf kept, broken light ring behind shoulders, gritty realistic PBR, A-pose, full body"
- WARLOCK / Cipher: "Tech arcanist, same design as the reference, armored coat split by glowing white-gold fracture lines, hovering circuit-plate fragments around forearms and chest, broken light halo behind shoulders, gritty realistic PBR, A-pose, full body"
Reference images: the Elite sheets rendered at scratchpad/r (front view) or docs/reference/rookie-*.jpg for identity.

## Pipeline (same as the other tier bodies)
Remesh to ~30k tris, Mixamo rig with Idle 1 + Combat Idle + walk/run, 2K textures, build with scripts/build-operator-authored.py,
save as public/models/operators/{goliath,nyx,cipher}-mythic-authored.glb, then add `MYTHIC: { url, colorway: false }` to each class in
TIER_BODIES (operator-tier.ts). The existing test checks every listed file exists.
