"""Portrait turnaround of a rigged character GLB (Cycles CPU), framed on its body mesh only (operator GLBs also carry tiny bone
display meshes that throw the general render-glb.py framing off).

    blender -b -P scripts/render-operator.py -- model.glb out-prefix [yaw-degrees ...]

Writes out-prefix-<yaw>.png (480x720) for each yaw (default 0 = front, 35 = three-quarter, 180 = back).
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
glb, prefix = argv[0], argv[1]
yaws = [float(a) for a in argv[2:]] or [0.0, 35.0, 180.0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
body = max((o for o in bpy.context.scene.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
for o in bpy.context.scene.objects:
    if o.type == "MESH" and o is not body and len(o.data.vertices) < 200:
        o.hide_render = True
# stand it in its bind pose (no clip playing)
for o in bpy.context.scene.objects:
    if o.type == "ARMATURE" and o.animation_data:
        o.animation_data.action = None
        for b in o.pose.bones:
            b.location = (0, 0, 0); b.rotation_quaternion = (1, 0, 0, 0); b.rotation_euler = (0, 0, 0); b.scale = (1, 1, 1)
bpy.context.view_layer.update()
pts = [body.matrix_world @ Vector(c) for c in body.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
centre = (lo + hi) / 2; height = hi.z - lo.z
sc = bpy.context.scene
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 55
bpy.ops.object.empty_add(location=centre); aim = bpy.context.object
t = cam.constraints.new("TRACK_TO"); t.target = aim
bpy.ops.object.light_add(type="SUN", location=(4, -6, 10)); sun = bpy.context.object; sun.data.energy = 3.5; sun.rotation_euler = (0.8, 0.15, 0.6)
bpy.ops.object.light_add(type="AREA", location=(-3, 2, 3)); rim = bpy.context.object; rim.data.energy = 300; rim.data.size = 3
bpy.ops.mesh.primitive_plane_add(size=40, location=(centre.x, centre.y, lo.z))
w = bpy.data.worlds.new("sky"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.32, 0.36, 0.42, 1); bg.inputs[1].default_value = 0.8
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 28
sc.render.resolution_x, sc.render.resolution_y = 480, 720
dist = height * 2.1
for yaw in yaws:
    a = math.radians(yaw)
    cam.location = centre + Vector((-math.sin(a) * dist, -math.cos(a) * dist, height * 0.08))
    sc.render.filepath = f"{prefix}-{int(yaw)}.png"
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)
