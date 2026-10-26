"""World Fracture's authored assets, made inside the Unreal editor (Python), so the game stops using stand-ins:

  /Game/WF/Materials   M_WF_Surface (lit, "Color"), M_WF_Neon (unlit glow, "Color" x "Glow"), M_WF_Glass (dark glossy,
                       "Color"), M_WF_Terrain (vertex colour, for AWFTerrain), M_WF_Water ("Color", glossy)
  /Game/WF/Models      Buildings/<name> and Fleet/<name>: the web build's GLB models (joined to one mesh each by
                       unreal/tools/join_models.py), named with '_' for '-' (nexus-civic-a -> nexus_civic_a)

The game finds them by path (WFAssets) and falls back to its stand-ins when they are missing.

Run headless (the Unreal workflows do this before cooking):
    UnrealEditor-Cmd <project>/WorldFracture.uproject -run=pythonscript -script="<project>/tools/setup_assets.py" -unattended
with WF_JOINED_MODELS set to the folder join_models.py wrote (default <project>/../build/joined/{buildings,fleet}).
Or in the editor: Tools > Execute Python Script. Safe to run again: everything is replaced in place.
"""
import os

import unreal

ROOT = "/Game/WF"
MAT_PATH = f"{ROOT}/Materials"
MEL = unreal.MaterialEditingLibrary
TOOLS = unreal.AssetToolsHelpers.get_asset_tools()
LIB = unreal.EditorAssetLibrary


def log(msg):
    unreal.log(f"[WF setup] {msg}")


def fresh_material(name):
    path = f"{MAT_PATH}/{name}"
    if LIB.does_asset_exist(path):
        LIB.delete_asset(path)
    mat = TOOLS.create_asset(name, MAT_PATH, unreal.Material, unreal.MaterialFactoryNew())
    # the game draws everything instanced (and terrain as procedural mesh): without these flags a cooked build
    # silently falls back to the default material
    mat.set_editor_property("used_with_instanced_static_meshes", True)
    mat.set_editor_property("used_with_static_lighting", True)
    return mat


def vector_param(mat, name, default, x, y):
    p = MEL.create_material_expression(mat, unreal.MaterialExpressionVectorParameter, x, y)
    p.set_editor_property("parameter_name", name)
    p.set_editor_property("default_value", unreal.LinearColor(*default))
    return p


def scalar_param(mat, name, default, x, y):
    p = MEL.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, x, y)
    p.set_editor_property("parameter_name", name)
    p.set_editor_property("default_value", default)
    return p


def constant(mat, value, x, y):
    c = MEL.create_material_expression(mat, unreal.MaterialExpressionConstant, x, y)
    c.set_editor_property("r", value)
    return c


def finish(mat):
    MEL.recompile_material(mat)
    LIB.save_loaded_asset(mat)
    log(f"material {mat.get_name()}")


def make_materials():
    # lit surface: concrete, metal, asphalt, paint (BasicShapeMaterial's "Color" contract, with real roughness)
    m = fresh_material("M_WF_Surface")
    color = vector_param(m, "Color", (0.5, 0.5, 0.5, 1), -400, 0)
    MEL.connect_material_property(color, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(scalar_param(m, "Roughness", 0.62, -400, 200), "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(scalar_param(m, "Metallic", 0.08, -400, 300), "", unreal.MaterialProperty.MP_METALLIC)
    finish(m)

    # neon: unlit, the colour pushed past 1 so bloom picks it up (signs, strips, shopfronts, lamp heads)
    m = fresh_material("M_WF_Neon")
    m.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    color = vector_param(m, "Color", (0.2, 0.9, 1.0, 1), -500, 0)
    glow = scalar_param(m, "Glow", 6.0, -500, 200)
    mul = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -250, 50)
    MEL.connect_material_expressions(color, "", mul, "A")
    MEL.connect_material_expressions(glow, "", mul, "B")
    MEL.connect_material_property(mul, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    finish(m)

    # glass: dark, glossy, a little metallic so it picks up the city's reflections
    m = fresh_material("M_WF_Glass")
    color = vector_param(m, "Color", (0.06, 0.1, 0.14, 1), -400, 0)
    MEL.connect_material_property(color, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(constant(m, 0.08, -400, 200), "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(constant(m, 0.6, -400, 300), "", unreal.MaterialProperty.MP_METALLIC)
    finish(m)

    # terrain: AWFTerrain writes region ground, shore sand, slope rock and snow into the vertex colours
    m = fresh_material("M_WF_Terrain")
    vc = MEL.create_material_expression(m, unreal.MaterialExpressionVertexColor, -400, 0)
    MEL.connect_material_property(vc, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(constant(m, 0.92, -400, 200), "", unreal.MaterialProperty.MP_ROUGHNESS)
    finish(m)

    # water: deep, glossy
    m = fresh_material("M_WF_Water")
    color = vector_param(m, "Color", (0.02, 0.06, 0.08, 1), -400, 0)
    MEL.connect_material_property(color, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(constant(m, 0.04, -400, 200), "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(constant(m, 0.25, -400, 300), "", unreal.MaterialProperty.MP_METALLIC)
    finish(m)


def import_model(src, folder, collide):
    base = os.path.splitext(os.path.basename(src))[0]
    asset = base.replace("-", "_")
    staging = f"{ROOT}/Models/{folder}/_src/{asset}"
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", src)
    task.set_editor_property("destination_path", staging)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)
    TOOLS.import_asset_tasks([task])
    # the importer may name the mesh after the node or with a prefix: take the static mesh it made (the biggest if several)
    meshes = []
    for path in LIB.list_assets(staging, recursive=True, include_folder=False):
        data = LIB.find_asset_data(path)
        if str(data.asset_class_path.asset_name) == "StaticMesh":
            mesh = LIB.load_asset(path)
            tris = mesh.get_num_triangles(0) if hasattr(mesh, "get_num_triangles") else 0
            meshes.append((tris, path))
    if not meshes:
        unreal.log_warning(f"[WF setup] {base}: the import made no static mesh")
        return False
    meshes.sort(reverse=True)
    target = f"{ROOT}/Models/{folder}/{asset}"
    if LIB.does_asset_exist(target):
        LIB.delete_asset(target)
    src_path = meshes[0][1].split(".")[0]
    if not LIB.rename_asset(src_path, target):
        unreal.log_warning(f"[WF setup] {base}: could not move {src_path} to {target}")
        return False
    mesh = LIB.load_asset(target)
    if collide:
        # buildings: walls you can't walk through, exactly as modelled
        body = mesh.get_editor_property("body_setup")
        if body:
            body.set_editor_property("collision_trace_flag", unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    LIB.save_asset(target)
    log(f"model {folder}/{asset}")
    return True


def import_models():
    here = os.path.dirname(os.path.abspath(__file__))
    default = os.path.normpath(os.path.join(here, "..", "..", "build", "joined"))
    joined = os.environ.get("WF_JOINED_MODELS", default)
    done = 0
    for folder, collide in (("Buildings", True), ("Fleet", False)):
        src_dir = os.path.join(joined, folder.lower())
        if not os.path.isdir(src_dir):
            unreal.log_warning(f"[WF setup] no models at {src_dir} (run unreal/tools/join_models.py first)")
            continue
        for name in sorted(os.listdir(src_dir)):
            if name.lower().endswith(".glb") and import_model(os.path.join(src_dir, name), folder, collide):
                done += 1
    log(f"{done} models imported")


make_materials()
import_models()
LIB.save_directory(ROOT, only_if_is_dirty=False, recursive=True)
log("done")
