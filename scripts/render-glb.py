"""Quick Cycles (CPU) preview of a GLB, for checking authored models without a browser or GPU.

    blender -b -P scripts/render-glb.py -- public/models/fleet/war-rig.glb /tmp/war-rig.png [yaw-degrees] [distance]

Frames the model from its bounding box at a three-quarter height; yaw (degrees) orbits the camera around it,
sun + sky light, a ground plane, 640x400 at 24 samples (~10 s on two cores).
"""
import math
import sys

import bpy
from mathutils import Vector

glb, out = sys.argv[1], sys.argv[2]
yaw = math.radians(float(sys.argv[3])) if len(sys.argv) > 3 else math.radians(35)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
centre, size = (lo + hi) / 2, (hi - lo).length
dist = float(sys.argv[4]) if len(sys.argv) > 4 else size * 1.25
sc = bpy.context.scene
# the model's nose is three.js +Z = Blender -Y after import; start in front-left and orbit by yaw
eye = centre + Vector((-math.sin(yaw) * dist, -math.cos(yaw) * dist, size * 0.35))
bpy.ops.object.camera_add(location=eye); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 40
bpy.ops.object.empty_add(location=centre); aim = bpy.context.object
t = cam.constraints.new("TRACK_TO"); t.target = aim
bpy.ops.object.light_add(type="SUN", location=(4, -6, 10)); bpy.context.object.data.energy = 4; bpy.context.object.rotation_euler = (0.7, 0.2, 0.5)
bpy.ops.mesh.primitive_plane_add(size=max(40, size * 6), location=(centre.x, centre.y, lo.z))
w = bpy.data.worlds.new("sky"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.62, 0.7, 0.8, 1); bg.inputs[1].default_value = 0.9
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 24
sc.render.resolution_x, sc.render.resolution_y = 640, 400
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDERED", out)
