# concept-gt.glb (the Aurora GT)

Source: Khronos glTF Sample Assets, `Models/CarConcept` (https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept).

- Model and textures: Eric Chadwick, © 2024 Darmstadt Graphics Group GmbH, started from a public-domain model by Unity Fan
  (sketchfab.com/3d-models/free-concept-car-004-public-domain-cc0-4cba124633eb494eadc3bb0c4660ad7e)
- Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); the Khronos logo and trademarks are excluded.
- Changes: simplified from 213k to 45k triangles with gltfpack 0.22 (`-si 0.2 -noq -kn -km`); materials fitted to Godot
  with tools/fix_glb_materials.py (the transmission glass made alpha-blended, the paints' metal-flake normal map and the
  zero-strength occlusion removed, full-metal paints brought to 0.6, the Khronos logos on the licence plate and the tyre walls blanked with `--blank 3,10`).

Credited in the game's Credits screen (CreditsPanel.tsx).
