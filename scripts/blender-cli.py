"""`blender` command for headless machines that only have Blender-as-a-module (pip bpy).

Mirrors the Blender CLI flags the build scripts and quick checks need:
    blender [-b] [file.blend] [-P script.py]... [--python-expr CODE]... [-o OUT] [-f N | -a] [-E ENGINE] [-- script args]
    blender --version
Anything after `--` reaches each script as its own arguments: sys.argv = [script, *args], so the project build scripts
(written for `python3 scripts/build-*.py args`) work unchanged.
"""
import os
import runpy
import sys


def main(argv):
    if "--version" in argv or "-v" in argv:
        import bpy
        print("Blender", bpy.app.version_string, "(bpy module)")
        return 0
    import bpy
    rest = argv[argv.index("--") + 1:] if "--" in argv else []
    own = argv[:argv.index("--")] if "--" in argv else argv
    i, out, frames, engine, actions = 0, None, [], None, []
    while i < len(own):
        a = own[i]
        if a in ("-b", "--background"):
            pass
        elif a in ("-P", "--python"):
            i += 1; actions.append(("script", own[i]))
        elif a == "--python-expr":
            i += 1; actions.append(("expr", own[i]))
        elif a in ("-o", "--render-output"):
            i += 1; out = own[i]
        elif a in ("-E", "--engine"):
            i += 1; engine = own[i]
        elif a in ("-f", "--render-frame"):
            i += 1; frames.append(int(own[i]))
        elif a in ("-a", "--render-anim"):
            frames.append("anim")
        elif a.endswith(".blend"):
            bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a))
        else:
            print(f"blender: ignoring unsupported flag {a}", file=sys.stderr)
        i += 1
    for kind, val in actions:
        if kind == "script":
            sys.argv = [os.path.abspath(val)] + rest
            sys.path.insert(0, os.path.dirname(os.path.abspath(val)))
            runpy.run_path(os.path.abspath(val), run_name="__main__")
        else:
            exec(compile(val, "<python-expr>", "exec"), {"bpy": bpy, "__name__": "__main__"})
    if frames:
        sc = bpy.context.scene
        if engine:
            sc.render.engine = engine
        if out:
            sc.render.filepath = out
        for f in frames:
            if f == "anim":
                bpy.ops.render.render(animation=True)
            else:
                sc.frame_set(f); bpy.ops.render.render(write_still=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
