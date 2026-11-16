"""Ready a textured Meshy rig for the game (Blender, background).

When Meshy's remesh keeps the texture, its rigged download already carries the character's PBR maps (at 4K) and the
Running / Walking / Combat_Stance clips. This renames the clips to the game's (walk / run / combat, with an "idle" seeded
from combat when Meshy left it out — stand_idle.gd rebuilds idle from the rest pose anyway), scales the maps down to
SIZE and writes one GLB. For an untextured rig use meshy_bake_rig.py instead.

  blender -b -P tools/meshy_prep_rig.py -- RIG.glb OUT.glb [SIZE]
  (or PREP_ARGS="RIG.glb OUT.glb SIZE" when the blender wrapper drops the arguments)
"""
import bpy, sys, os

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else os.environ["PREP_ARGS"].split()
RIG, OUT = argv[0], argv[1]
SIZE = int(argv[2]) if len(argv) > 2 else 2048

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RIG)

for img in bpy.data.images:
    if img.size[0] > SIZE:
        img.scale(SIZE, SIZE * img.size[1] // max(1, img.size[0]))

NAMES = {"walking": "walk", "running": "run", "combat_stance": "combat", "idle": "idle"}
for a in list(bpy.data.actions):
    k = a.name.lower().split("|")[-1]
    if k in NAMES:
        a.name = NAMES[k]
        a.use_fake_user = True
if not bpy.data.actions.get("idle"):
    seed = bpy.data.actions.get("combat") or bpy.data.actions.get("walk")
    if seed:
        c = seed.copy()
        c.name = "idle"
        c.use_fake_user = True

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS",
                          export_image_format="JPEG", export_jpeg_quality=92, export_skins=True, export_yup=True)
print("wrote", OUT, "actions", sorted(a.name for a in bpy.data.actions))
