"""Copy Meshy's animation-only GLBs (its Walking / Running downloads: bone nodes as plain nodes, no skin) onto the rigged
character GLB (Character_output.glb) at the glTF level — channels retargeted by bone name, sampler data appended to the
binary chunk. Blender imports those clips as empties, so a Blender merge exported 1-frame clips.

  python3 -I tools/meshy_merge_clips.py CHARACTER.glb walk.glb=walk run.glb=run walk.glb=idle OUT.glb

Then tools/headless_person.py makes an operator body from OUT.glb (Nov 23: the female operator, real-female.glb)."""
import json, struct, sys
def load(p):
    d = open(p, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20+jl])
    p2 = 20 + jl
    bl = struct.unpack('<I', d[p2:p2+4])[0]
    return j, bytearray(d[p2+8:p2+8+bl])
def save(p, j, b):
    while len(b) % 4: b.append(0)
    j['buffers'] = [{'byteLength': len(b)}]
    jt = json.dumps(j, separators=(',', ':')).encode()
    jt += b' ' * ((4 - len(jt) % 4) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jt) + 8 + len(b)) + struct.pack('<II', len(jt), 0x4E4F534A) + jt + struct.pack('<II', len(b), 0x004E4942) + bytes(b)
    open(p, 'wb').write(out)
char, bin_ = load(sys.argv[1])
out = sys.argv[-1]
by_name = {n.get('name'): i for i, n in enumerate(char['nodes'])}
char['animations'] = []
for spec in sys.argv[2:-1]:
    path, name = spec.split('=')
    a, ab = load(path)
    for anim in a['animations']:
        new = {'name': name, 'channels': [], 'samplers': []}
        acc_map = {}
        def copy_acc(k):
            if k in acc_map: return acc_map[k]
            acc = dict(a['accessors'][k]); bv = a['bufferViews'][acc['bufferView']]
            data = ab[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
            while len(bin_) % 4: bin_.append(0)
            char['bufferViews'].append({'buffer': 0, 'byteOffset': len(bin_), 'byteLength': len(data)})
            bin_.extend(data)
            acc['bufferView'] = len(char['bufferViews']) - 1
            char['accessors'].append(acc)
            acc_map[k] = len(char['accessors']) - 1
            return acc_map[k]
        for ch in anim['channels']:
            nm = a['nodes'][ch['target']['node']].get('name')
            if nm not in by_name:
                continue
            s = anim['samplers'][ch['sampler']]
            new['samplers'].append({'input': copy_acc(s['input']), 'output': copy_acc(s['output']), 'interpolation': s.get('interpolation', 'LINEAR')})
            new['channels'].append({'sampler': len(new['samplers']) - 1, 'target': {'node': by_name[nm], 'path': ch['target']['path']}})
        char['animations'].append(new)
        print(name, len(new['channels']), 'channels')
save(out, char, bin_)
