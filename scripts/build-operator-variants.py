"""
Operator body variants (offline tool; Blender bpy). Each class has one authored body (GOLIATH and CIPHER are men, NYX a woman),
so choosing a body type in character creation only stretched it a few percent. This builds the other bodies from the authored,
rigged GLBs, keeping the skeleton, skin weights and walk/run/idle/combat clips:

  base           the authored body as it is
  female / male  reshape the body (shoulders, chest, waist, hips, limb girth), blended by the skin weights so joints stay seamless;
                 --cover closes a cropped top's midriff panel (a man in NYX's armour)
  robot          re-finish the armour as gunmetal plating with glowing panel seams

Every body is exported HEADLESS: the head and anything rising over the face are removed, and the game skins the face chosen in
character creation onto the Head bone (scripts/build-operator-heads.py makes the heads; operator-faces.ts lists them).

usage: blender -b -P scripts/build-operator-variants.py -- BASE.glb OUT.glb base|female|male|robot [--cover]
(the bundled blender wrapper passes the arguments without "--"; both forms work)
"""
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
base_path, out_path, mode = argv[0], argv[1], argv[2]
cover = "--cover" in argv[3:]  # male from a woman's armour: close the midriff panel
HEAD = "mixamorig:Head"


def objs_after(fn):
    before = set(bpy.data.objects)
    fn()
    return [o for o in bpy.data.objects if o not in before]


def body_of(objs):
    meshes = [o for o in objs if o.type == "MESH"]
    return max(meshes, key=lambda o: len(o.data.vertices)), next(o for o in objs if o.type == "ARMATURE")


def dominant(mesh):
    names = {g.index: g.name for g in mesh.vertex_groups}
    return [names[max(v.groups, key=lambda g: g.weight).group] if v.groups else "" for v in mesh.data.vertices]


def bone_mesh_space(arm, mesh, name):
    """bone head/tail in the mesh's own (bind) space"""
    b = arm.data.bones[name]
    m = mesh.matrix_world.inverted() @ arm.matrix_world
    return m @ b.head_local, m @ b.tail_local


def delete_verts(mesh, keep):
    bm = bmesh.new(); bm.from_mesh(mesh.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep[v.index]], context="VERTS")
    bm.to_mesh(mesh.data); bm.free(); mesh.data.update()


# ---------------------------------------------------------------------------------------------------- proportions
# per bone: how its vertices move. "radial" scales around the bone's axis (limb girth); "x"/"y" scale across the body's width /
# depth about the body's centre line (glTF Blender import: X = body left/right, Y = depth, Z = up)
SHAPES = {
    "female": {
        "mixamorig:LeftShoulder": {"x": 0.86}, "mixamorig:RightShoulder": {"x": 0.86},
        "mixamorig:LeftArm": {"radial": 0.88, "x": 0.9}, "mixamorig:RightArm": {"radial": 0.88, "x": 0.9},
        "mixamorig:LeftForeArm": {"radial": 0.88, "x": 0.92}, "mixamorig:RightForeArm": {"radial": 0.88, "x": 0.92},
        "mixamorig:LeftHand": {"radial": 0.9, "x": 0.93}, "mixamorig:RightHand": {"radial": 0.9, "x": 0.93},
        "mixamorig:Spine2": {"x": 0.9}, "mixamorig:Spine1": {"x": 0.86, "y": 0.94}, "mixamorig:Spine": {"x": 0.84, "y": 0.92},
        "mixamorig:Hips": {"x": 1.06},
        "mixamorig:LeftUpLeg": {"radial": 0.95}, "mixamorig:RightUpLeg": {"radial": 0.95},
        "mixamorig:LeftLeg": {"radial": 0.93}, "mixamorig:RightLeg": {"radial": 0.93},
        "mixamorig:Neck": {"radial": 0.86},
    },
    "male": {
        "mixamorig:LeftShoulder": {"x": 1.2}, "mixamorig:RightShoulder": {"x": 1.2},
        "mixamorig:LeftArm": {"radial": 1.2, "x": 1.12}, "mixamorig:RightArm": {"radial": 1.2, "x": 1.12},
        "mixamorig:LeftForeArm": {"radial": 1.16, "x": 1.1}, "mixamorig:RightForeArm": {"radial": 1.16, "x": 1.1},
        "mixamorig:LeftHand": {"radial": 1.1, "x": 1.08}, "mixamorig:RightHand": {"radial": 1.1, "x": 1.08},
        "mixamorig:Spine2": {"x": 1.16, "y": 1.08}, "mixamorig:Spine1": {"x": 1.22, "y": 1.08}, "mixamorig:Spine": {"x": 1.24, "y": 1.08},
        "mixamorig:Hips": {"x": 0.93},
        "mixamorig:LeftUpLeg": {"radial": 1.07}, "mixamorig:RightUpLeg": {"radial": 1.07},
        "mixamorig:LeftLeg": {"radial": 1.07}, "mixamorig:RightLeg": {"radial": 1.07},
        "mixamorig:Neck": {"radial": 1.2},
    },
    "robot": {},
}


def reshape(mesh, arm, shapes):
    if not shapes:
        return
    names = {g.index: g.name for g in mesh.vertex_groups}
    axes = {n: bone_mesh_space(arm, mesh, n) for n in shapes if n in arm.data.bones}
    hips = bone_mesh_space(arm, mesh, "mixamorig:Hips")[0]
    for v in mesh.data.vertices:
        p = v.co.copy(); d = Vector((0, 0, 0))
        for g in v.groups:
            n = names[g.group]; s = shapes.get(n)
            if not s or n not in axes or g.weight <= 0:
                continue
            q = p.copy()
            if "radial" in s:
                a, b = axes[n]; ab = b - a
                t = max(0.0, min(1.0, (q - a).dot(ab) / max(1e-9, ab.length_squared)))
                c = a + ab * t
                q = c + (q - c) * s["radial"]
            if "x" in s:
                q.x = hips.x + (q.x - hips.x) * s["x"]
            if "y" in s:
                q.y = hips.y + (q.y - hips.y) * s["y"]
            d += (q - p) * g.weight
        v.co = p + d
    mesh.data.update()


def head_bones(arm):
    """the Head and every bone under it (CIPHER has jaw and eye bones of its own)"""
    return {b.name for b in arm.data.bones if b.name == HEAD or any(p.name == HEAD for p in b.parent_recursive)}


def face_clear(mesh, arm):
    """keep-mask: False for the base head and for anything above the jaw line in front of the neck (masks, high collars). This is
    exactly what a head from scripts/build-operator-heads.py brings, so a chosen face fills the gap"""
    hb = bone_mesh_space(arm, mesh, HEAD)[0]
    heads = head_bones(arm)
    keep = []
    for v, n in zip(mesh.data.vertices, dominant(mesh)):
        if n in heads:
            keep.append(False); continue
        above_jaw = v.co.z > hb.z - 0.035
        near_face = (v.co.x - hb.x) ** 2 + (v.co.y - hb.y) ** 2 < 0.12 ** 2
        keep.append(not (above_jaw and near_face and n in ("mixamorig:Neck", "mixamorig:Spine2")))
    return keep


# ---------------------------------------------------------------------------------------------------- male cover
def cover_midriff(mesh, arm):
    """NYX's top is cropped over a sheer mesh panel that shows her midriff; a man in her armour gets a solid undersuit there: the
    warm (skin-showing) texels of the front torso between the belt and the chest plate are repainted the suit's dark fabric"""
    mat = mesh.data.materials[0]; nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    node = next((l.from_node for l in nt.links if l.to_node == bsdf and l.to_socket.name == "Base Color"), None)
    img = getattr(node, "image", None)
    if img is None:
        return
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    sp = bone_mesh_space(arm, mesh, "mixamorig:Spine")[0]; s2 = bone_mesh_space(arm, mesh, "mixamorig:Spine2")[0]
    torso = {"mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2", "mixamorig:Hips"}
    dom = dominant(mesh)
    mask = np.zeros((h, w), dtype=bool)
    uv = mesh.data.uv_layers.active.data
    vs = mesh.data.vertices
    for poly in mesh.data.polygons:
        if not all(dom[i] in torso for i in poly.vertices):
            continue
        c = poly.center
        if not (sp.z - 0.06 < c.z < s2.z - 0.02):
            continue
        uvs = [uv[li].uv for li in poly.loop_indices]
        for k in range(1, len(uvs) - 1):  # fan-triangulate, rasterise into the mask
            tri = np.array([[uvs[0][0] * w, uvs[0][1] * h], [uvs[k][0] * w, uvs[k][1] * h], [uvs[k + 1][0] * w, uvs[k + 1][1] * h]])
            x0, y0 = np.floor(tri.min(0)).astype(int) - 1; x1, y1 = np.ceil(tri.max(0)).astype(int) + 1
            x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(w - 1, x1), min(h - 1, y1)
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            (ax, ay), (bx, by), (cx, cy) = tri
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-9:
                continue
            l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
            l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
            inside = (l1 >= -0.02) & (l2 >= -0.02) & (1 - l1 - l2 >= -0.02)
            mask[y0:y1 + 1, x0:x1 + 1] |= inside
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    lum = r * 0.3 + g * 0.59 + b * 0.11
    warm = (r > b + 0.035) & (r >= g) & (lum > 0.06)
    sel = mask & warm
    fab = np.clip(0.05 + lum * 0.25, 0, 0.14)
    px[sel, 0] = fab[sel] * 0.95; px[sel, 1] = fab[sel] * 0.98; px[sel, 2] = fab[sel] * 1.08
    print(f"midriff cover: {mask.sum()} texels in the panel, {sel.sum()} skin texels repainted")
    ni = bpy.data.images.new(img.name + "_male", w, h); ni.pixels[:] = px.ravel(); ni.pack()
    node.image = ni


# ---------------------------------------------------------------------------------------------------- robot
def robot_finish(mesh):
    """gunmetal plating: the baked colour becomes a cool metal tone keeping its panel detail, panel seams glow cyan"""
    mat = mesh.data.materials[0]
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    img_node = next((l.from_node for l in nt.links if l.to_node == bsdf and l.to_socket.name == "Base Color"), None)
    img = img_node.image if img_node and hasattr(img_node, "image") else None
    if img is None:
        return
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    lum = px[..., 0] * 0.3 + px[..., 1] * 0.59 + px[..., 2] * 0.11
    # gunmetal with a little blue, brighter where the armour was pale (keeps the original panel layout readable)
    tone = np.clip(0.18 + lum * 1.05, 0, 1)
    out = px.copy()
    out[..., 0] = tone * 0.82; out[..., 1] = tone * 0.88; out[..., 2] = tone * 0.98
    robot_img = bpy.data.images.new("robot_plating", w, h)
    robot_img.pixels[:] = out.ravel(); robot_img.pack()
    img_node.image = robot_img
    # seams: strong luminance edges in the baked texture glow
    gx = np.abs(np.diff(lum, axis=1, append=lum[:, -1:])); gy = np.abs(np.diff(lum, axis=0, append=lum[-1:, :]))
    edge = np.clip((gx + gy - 0.16) * 6, 0, 1)
    em = np.zeros_like(px); em[..., 0] = edge * 0.15; em[..., 1] = edge * 0.75; em[..., 2] = edge * 1.0; em[..., 3] = 1
    emi = bpy.data.images.new("robot_seams", w, h); emi.pixels[:] = em.ravel(); emi.pack()
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = emi
    for l in [l for l in nt.links if l.to_node == bsdf and l.to_socket.name == "Emission Color"]:
        nt.links.remove(l)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 2.0
    # metal all over (drop the metallic/roughness map's soft cloth)
    for l in [l for l in nt.links if l.to_node == bsdf and l.to_socket.name in ("Metallic", "Roughness")]:
        nt.links.remove(l)
    bsdf.inputs["Metallic"].default_value = 0.85
    bsdf.inputs["Roughness"].default_value = 0.38


# ---------------------------------------------------------------------------------------------------- run
bpy.ops.wm.read_factory_settings(use_empty=True)
objs = objs_after(lambda: bpy.ops.import_scene.gltf(filepath=base_path))
mesh, arm = body_of(objs)
reshape(mesh, arm, SHAPES.get(mode, {}))
if mode == "male" and cover:
    cover_midriff(mesh, arm)
if mode == "robot":
    robot_finish(mesh)
# headless: the face is chosen in character creation and skinned on at load (scripts/build-operator-heads.py, OperatorModel.tsx)
delete_verts(mesh, face_clear(mesh, arm))
# drop the bone display shapes etc.: export the armature and its body only
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True); mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=True, export_animations=True, export_skins=True,
                          export_image_format="JPEG", export_jpeg_quality=85, export_yup=True)
print("wrote", out_path)
