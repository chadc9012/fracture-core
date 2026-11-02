"""Nexus street look-dev in Unreal (UE 5.8, Lumen): builds the same block as godot-world-fracture/scripts/city/street_slice.gd
from the Meshy city models in the repo, lights it at golden hour or night, and frames a street-level camera.

Run inside the editor (Output Log, Python mode):
    import urllib.request; exec(urllib.request.urlopen("https://raw.githubusercontent.com/chadc9012/fracture-core/main/unreal/tools/street_render.py").read())
Then:  wf_street("nexus" | "neon" | "coast", night=False)   and   wf_shot("NexusStreet")   for a 2560x1440 still in Saved/Screenshots.

Units: Unreal centimetres, Z up. The Godot layout is in metres with Y up: (x, y, z)gd -> (x, z, y) * 100 here.
"""
import os
import random
import urllib.request

import unreal

RAW = "https://raw.githubusercontent.com/chadc9012/fracture-core/main/godot-world-fracture/models/"
CITY = ["apartment", "brick", "office", "casino", "deco", "villa", "shopfront", "palm", "planter", "street-lamp", "bus-shelter", "cafe-set"]
FLEET = ["street-racer-lod", "muscle-car-lod", "security-suv", "tuner", "offroad-truck"]
DEST = "/Game/WF/City"
M = 100.0  # metres -> cm

ROAD_W, WALK_W, LENGTH = 16.0, 7.0, 260.0

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def _log(*a):
    unreal.log("[WF street] " + " ".join(str(x) for x in a))


# ------------------------------------------------------------------------------------------------ import
def _download(name, sub):
    folder = os.path.join(unreal.Paths.project_saved_dir(), "WFDownloads")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, name + ".glb")
    if not os.path.exists(path) or os.path.getsize(path) < 1000:
        urllib.request.urlretrieve(RAW + sub + "/" + name + ".glb", path)
    return path


def _mesh(name, sub="city"):
    """the static mesh for a model, importing it the first time"""
    folder = DEST + "/" + name
    if eal.does_directory_exist(folder):
        for p in eal.list_assets(folder, recursive=True):
            a = eal.load_asset(p)
            if isinstance(a, unreal.StaticMesh):
                return a
    task = unreal.AssetImportTask()
    task.filename = _download(name, sub)
    task.destination_path = folder
    task.automated = True
    task.save = True
    task.replace_existing = True
    asset_tools.import_asset_tasks([task])
    for p in eal.list_assets(folder, recursive=True):
        a = eal.load_asset(p)
        if isinstance(a, unreal.StaticMesh):
            return a
    _log("no mesh imported for", name)
    return None


# ------------------------------------------------------------------------------------------------ materials
def _mat(name, color, rough=0.8, metal=0.0, emissive=0.0, puddles=False):
    path = "/Game/WF/Materials/" + name
    if eal.does_asset_exist(path):
        return eal.load_asset(path)
    m = asset_tools.create_asset(name, "/Game/WF/Materials", unreal.Material, unreal.MaterialFactoryNew())
    c = mel.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -400, 0)
    c.set_editor_property("constant", unreal.LinearColor(color[0], color[1], color[2], 1))
    mel.connect_material_property(c, "", unreal.MaterialProperty.MP_BASE_COLOR)
    if puddles:
        # world-aligned noise drives roughness: dry asphalt with mirror-wet puddles
        n = mel.create_material_expression(m, unreal.MaterialExpressionNoise, -700, 200)
        n.set_editor_property("scale", 0.0012)
        n.set_editor_property("levels", 3)
        n.set_editor_property("output_min", -0.6)
        n.set_editor_property("output_max", 1.4)
        lerp = mel.create_material_expression(m, unreal.MaterialExpressionLinearInterpolate, -400, 200)
        lerp.set_editor_property("const_a", rough)
        lerp.set_editor_property("const_b", 0.03)
        sat = mel.create_material_expression(m, unreal.MaterialExpressionSaturate, -550, 200)
        mel.connect_material_expressions(n, "", sat, "")
        mel.connect_material_expressions(sat, "", lerp, "Alpha")
        mel.connect_material_property(lerp, "", unreal.MaterialProperty.MP_ROUGHNESS)
    else:
        r = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -400, 200)
        r.set_editor_property("r", rough)
        mel.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mt = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -400, 300)
    mt.set_editor_property("r", metal)
    mel.connect_material_property(mt, "", unreal.MaterialProperty.MP_METALLIC)
    if emissive > 0:
        e = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -200, 400)
        mel.connect_material_expressions(c, "", e, "A")
        e.set_editor_property("const_b", emissive)
        mel.connect_material_property(e, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    mel.recompile_material(m)
    eal.save_asset(path)
    return m


CUBE = None


def _box(size_m, pos_m, mat, label=None):
    """an engine cube (100 cm) scaled to size_m (x, y, z in Unreal axes, metres) centred at pos_m"""
    global CUBE
    if CUBE is None:
        CUBE = eal.load_asset("/Engine/BasicShapes/Cube")
    a = actors.spawn_actor_from_object(CUBE, unreal.Vector(pos_m[0] * M, pos_m[1] * M, pos_m[2] * M))
    a.set_actor_scale3d(unreal.Vector(size_m[0], size_m[1], size_m[2]))
    a.static_mesh_component.set_material(0, mat)
    if label:
        a.set_actor_label(label)
    a.tags = ["WFStreet"]
    return a


def _place(mesh, height_m, pos_m, yaw_deg, label):
    """a model scaled to height_m tall, its base on the ground, centred on pos (Unreal axes, metres); returns (actor, size m)"""
    if mesh is None:
        return None, (10, 10, height_m)
    b = mesh.get_bounding_box()
    ext = b.max - b.min
    s = height_m * M / max(ext.z, 0.001)
    a = actors.spawn_actor_from_object(mesh, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, yaw_deg))
    a.set_actor_scale3d(unreal.Vector(s, s, s))
    # put the model's footprint centre on pos and its base on the ground
    cx, cy = (b.min.x + b.max.x) * 0.5 * s, (b.min.y + b.max.y) * 0.5 * s
    r = unreal.MathLibrary.rotate_angle_axis(unreal.Vector(cx, cy, 0), yaw_deg, unreal.Vector(0, 0, 1))
    a.set_actor_location(unreal.Vector(pos_m[0] * M - r.x, pos_m[1] * M - r.y, pos_m[2] * M - b.min.z * s), False, False)
    a.set_actor_label(label)
    a.tags = ["WFStreet"]
    return a, (ext.x * s / M, ext.y * s / M, ext.z * s / M)


# ------------------------------------------------------------------------------------------------ scene
def _clear():
    for a in actors.get_all_level_actors():
        if "WFStreet" in [str(t) for t in a.tags]:
            actors.destroy_actor(a)


def _lighting(night):
    sun = actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 2000))
    lc = sun.light_component
    lc.set_atmosphere_sun_light(True)
    if night:
        sun.set_actor_rotation(unreal.Rotator(0, -38, 120), False)
        lc.set_intensity(0.6)
        lc.set_light_color(unreal.LinearColor(0.55, 0.62, 0.95, 1))
    else:
        sun.set_actor_rotation(unreal.Rotator(0, -9, 148), False)   # low sun down the street: long shadows, warm haze
        lc.set_intensity(9.0)
        lc.set_light_color(unreal.LinearColor(1.0, 0.8, 0.6, 1))
    sun.tags = ["WFStreet"]
    for cls in (unreal.SkyAtmosphere, unreal.SkyLight, unreal.ExponentialHeightFog, unreal.VolumetricCloud):
        a = actors.spawn_actor_from_class(cls, unreal.Vector(0, 0, 0))
        a.tags = ["WFStreet"]
        if cls is unreal.SkyLight:
            a.light_component.set_editor_property("real_time_capture", True)
            a.light_component.set_intensity(0.6 if night else 1.0)
        if cls is unreal.ExponentialHeightFog:
            f = a.component
            f.set_editor_property("fog_density", 0.03 if night else 0.02)
            f.set_editor_property("volumetric_fog", True)
            f.set_editor_property("volumetric_fog_scattering_distribution", 0.6)
    pp = actors.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
    pp.set_editor_property("unbound", True)
    st = pp.settings
    st.set_editor_property("override_bloom_intensity", True)
    st.set_editor_property("bloom_intensity", 1.2 if night else 0.6)
    st.set_editor_property("override_auto_exposure_bias", True)
    st.set_editor_property("auto_exposure_bias", 1.2 if night else 0.3)
    st.set_editor_property("override_vignette_intensity", True)
    st.set_editor_property("vignette_intensity", 0.35)
    pp.set_editor_property("settings", st)
    pp.tags = ["WFStreet"]


NEON = [(1.0, 0.18, 0.62), (0.15, 0.85, 1.0), (0.62, 0.3, 1.0), (1.0, 0.62, 0.15), (0.25, 1.0, 0.55)]


def wf_street(style="nexus", night=False, seed=2207):
    """build the street block (style nexus / neon / coast) in the current level"""
    rnd = random.Random(seed)
    if style == "neon":
        night = True
    _clear()
    _lighting(night)
    half = ROAD_W * 0.5
    asphalt = _mat("M_WetAsphalt", (0.05, 0.052, 0.058), 0.75, 0.0, puddles=True)
    pave = _mat("M_PavingCoast" if style == "coast" else "M_Paving", (0.62, 0.5, 0.46) if style == "coast" else (0.42, 0.4, 0.37), 0.7)
    kerb = _mat("M_Kerb", (0.5, 0.5, 0.48), 0.6)
    paint = _mat("M_Paint", (0.8, 0.8, 0.78), 0.5)
    # Unreal axes: X along the street (Godot -z), Y across it (Godot x)
    _box((LENGTH, ROAD_W, 0.1), (0, 0, -0.05), asphalt, "Road")
    for side in (-1, 1):
        _box((LENGTH, WALK_W, 0.18), (0, side * (half + WALK_W * 0.5), 0.09), pave, "Sidewalk")
        _box((LENGTH, 0.3, 0.2), (0, side * (half + 0.15), 0.1), kerb, "Kerb")
        _box((LENGTH, 0.15, 0.02), (0, side * (half - 0.6), 0.01), paint, "EdgeLine")
    x = -LENGTH * 0.5 + 4
    while x < LENGTH * 0.5 - 4:
        _box((3.0, 0.15, 0.02), (x, 0, 0.01), paint, "LaneDash")
        x += 9
    # buildings: facades on the back of the sidewalk, sized by their real footprints
    kinds = [("apartment", 22), ("brick", 21), ("office", 34), ("apartment", 25), ("brick", 19)]
    if style == "coast":
        kinds = [("deco", 15), ("villa", 12), ("deco", 17), ("villa", 11)]
    elif style == "neon":
        kinds = [("deco", 16), ("brick", 18), ("apartment", 20), ("deco", 14), ("office", 28)]
    back = half + WALK_W
    k = 0
    for side in (-1, 1):
        x = -LENGTH * 0.5 + 6
        while x < LENGTH * 0.5 - 10:
            name, h = kinds[(k * 7 + side + 1) % len(kinds)]
            if style == "nexus" and side < 0 and k == 2:
                name, h = "casino", 14
            # glTF fronts face +Y after import (Interchange); turn them to face the road
            yaw = 180.0 if side > 0 else 0.0
            a, size = _place(_mesh(name), h * rnd.uniform(0.92, 1.1), (x, side * back, 0), yaw, name)
            width = size[0]
            if a:
                loc = a.get_actor_location()
                a.set_actor_location(unreal.Vector(loc.x + width * 0.5 * M, loc.y + side * size[1] * 0.5 * M, loc.z), False, False)
            x += width + rnd.uniform(0, 1.5)
            k += 1
    # street furniture
    for side in (-1, 1):
        x = -LENGTH * 0.5 + 8
        i = 0
        while x < LENGTH * 0.5 - 6:
            edge = side * (half + 1.3)
            if i % 2 == 0 or style != "nexus":
                _place(_mesh("palm"), rnd.uniform(8.5, 11), (x, edge, 0.18), rnd.uniform(0, 360), "Palm")
            else:
                _place(_mesh("street-lamp"), 6.5, (x, edge, 0.18), 90 if side > 0 else -90, "Lamp")
                if night:
                    l = actors.spawn_actor_from_class(unreal.PointLight, unreal.Vector(x * M, (edge - side * 1.2) * M, 600))
                    l.point_light_component.set_intensity(30000)
                    l.point_light_component.set_light_color(unreal.LinearColor(1.0, 0.8, 0.6, 1))
                    l.point_light_component.set_attenuation_radius(1600)
                    l.tags = ["WFStreet"]
            if i % 3 == 1:
                _place(_mesh("planter"), 2.2, (x + 5.5, edge, 0.18), 0, "Planter")
            x += 12
            i += 1
    for j in range(5):
        _place(_mesh("cafe-set"), 0.95, (-6 + j * 3.2, back - 2.4, 0.18), rnd.uniform(-20, 20), "Cafe")
    _place(_mesh("bus-shelter"), 2.8, (-12, -(half + 2.4), 0.18), 0, "BusShelter")
    # parked cars
    x = -LENGTH * 0.5 + 20
    i = 0
    while x < LENGTH * 0.5 - 20:
        side = 1 if i % 2 == 0 else -1
        car, _ = _place(_mesh(FLEET[i % len(FLEET)], "fleet"), 1.4, (x + rnd.uniform(-2, 2), side * (half - 1.4), 0), 0 if side > 0 else 180, "Car")
        x += rnd.uniform(9, 16)
        i += 1
    if night:
        _neon(rnd, back)
    wf_camera()
    _log("built", style, "night" if night else "day")


def _neon(rnd, back):
    names = ["LUMA CAFE", "NEXA BANK", "BYTEBURGER", "VOLTA MOBILE", "IRONCLAD ARMS", "FADE & CO", "HAVEN HOME", "PULSE GYM", "KAIJU RAMEN", "ORBIT TICKETS"]
    k = 0
    for side in (-1, 1):
        x = -LENGTH * 0.5 + 14
        while x < LENGTH * 0.5 - 10:
            col = NEON[k % len(NEON)]
            mat = _mat("M_Neon%d" % (k % len(NEON)), col, 0.4, 0.0, emissive=40.0)
            _box((0.25, 1.0, 3.2), (x + 6, side * (back - 0.9), 9 + (k % 3) * 1.5), mat, "BladeSign")
            _box((4.0, 0.25, 1.1), (x - 2, side * (back - 0.1), 6.1), _mat("M_Neon%d" % ((k + 2) % len(NEON)), NEON[(k + 2) % len(NEON)], 0.4, 0, emissive=40.0), "ShopSign")
            t = actors.spawn_actor_from_class(unreal.TextRenderActor, unreal.Vector((x - 2) * M, side * (back - 0.3) * M, 610))
            t.text_render.set_text(names[k % len(names)])
            t.text_render.set_world_size(60)
            t.text_render.set_horizontal_alignment(unreal.HorizTextAligment.EHTA_CENTER)
            t.set_actor_rotation(unreal.Rotator(0, 0, 90 if side < 0 else -90), False)
            t.tags = ["WFStreet"]
            p = actors.spawn_actor_from_class(unreal.PointLight, unreal.Vector((x + 6) * M, side * (back - 2.0) * M, 1000))
            p.point_light_component.set_intensity(12000)
            p.point_light_component.set_light_color(unreal.LinearColor(col[0], col[1], col[2], 1))
            p.point_light_component.set_attenuation_radius(900)
            p.tags = ["WFStreet"]
            x += 22
            k += 1


def wf_camera(loc=(30.0, 11.4, 1.7), look=(-40.0, 5.0, 4.0)):
    """put the editor viewport at street level looking down the block (Unreal axes, metres)"""
    l = unreal.Vector(loc[0] * M, loc[1] * M, loc[2] * M)
    t = unreal.Vector(look[0] * M, look[1] * M, look[2] * M)
    rot = unreal.MathLibrary.find_look_at_rotation(l, t)
    unreal.EditorLevelLibrary.set_level_viewport_camera_info(l, rot)
    return rot


def wf_shot(name="NexusStreet", w=2560, h=1440):
    """a high-resolution still of the current viewport into Saved/Screenshots"""
    unreal.SystemLibrary.execute_console_command(None, "HighResShot %dx%d filename=%s" % (w, h, name))
    _log("screenshot ->", os.path.join(unreal.Paths.project_saved_dir(), "Screenshots"))


_log("loaded: wf_street(style, night), wf_camera(), wf_shot(name)")
