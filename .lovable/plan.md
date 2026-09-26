# Identity Forge and Clean Combat HUD

## Goal
Replace the menu-style character creator with an immersive Identity Forge chamber, present the supplied high-detail operators as the player identity, and reduce the in-game overlay to essential combat information.

## What will change
- Build a full-screen Identity Forge chamber with three physical class projections: Vanguard, Assassin, and Tech.
- Let players move their viewpoint through the chamber, approach/select projections, inspect specializations, and use an armor forge station without page tabs.
- Blend the camera between free chamber exploration and focused cinematic framing when interacting.
- Show class confirmation as an armor-assembly sequence, then hand directly into the existing materialization mission.
- Replace the current block-built creator preview with high-detail character presentation derived from the supplied visual references.
- Keep class, specialization, and armor choices connected to the existing saved identity and live gameplay rules.
- Simplify the world HUD: one compact menu button, central reticle, mission tracking, and grouped health/ammo/ability status. Remove the permanently open zone, cycle, AI director, combat feed, controls, and vehicle-stat panels.

## Technical details
- Keep the browser-native React Three Fiber engine; Unreal Engine 5 cannot run inside this web project.
- Use generated transparent character plates for the cinematic class projections while preserving the existing gameplay character and save data contracts.
- Implement the chamber as a client-side 3D scene with world-space hologram interactions and a minimal DOM prompt layer.
- Preserve local FPS/TPP preferences, cloud progression, class/subclass IDs, appearance IDs, and Mission 01 startup.
- Add reduced-motion handling for camera and assembly transitions.

## Verification
- Check the complete flow at desktop and mobile sizes: title → chamber → class → specialization → armor forge → confirmation → world.
- Confirm there are no overlapping HUD panels, the selected identity persists, and the live 3D world remains visible and playable.
