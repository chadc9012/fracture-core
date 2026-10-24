import json,math,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1];path=root/'public/models/animals/fox.glb';raw=path.read_bytes();jl=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+jl]);off=20+((jl+3)//4)*4;assert raw[off+4:off+8]==b'BIN\x00';bl=struct.unpack_from('<I',raw,off)[0];buf=bytearray(raw[off+8:off+8+bl]);prim=d['meshes'][0]['primitives'][0]
if 'NORMAL' in prim['attributes']:print('Already fixed');quit()
assert 'indices' not in prim
acc=d['accessors'][prim['attributes']['POSITION']];v=d['bufferViews'][acc['bufferView']];start=v.get('byteOffset',0)+acc.get('byteOffset',0);stride=v.get('byteStride',12);assert acc['count']%3==0
pts=[struct.unpack_from('<fff',buf,start+i*stride) for i in range(acc['count'])];ns=[];deg=0
for i in range(0,len(pts),3):
 a,b,c=pts[i:i+3];u=[b[k]-a[k] for k in range(3)];w=[c[k]-a[k] for k in range(3)];n=(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]);mag=math.sqrt(sum(t*t for t in n));deg+=mag<1e-12;n=tuple(t/mag for t in n) if mag>=1e-12 else (0.,1.,0.);ns.extend([n]*3)
while len(buf)%4:buf.append(0)
pos=len(buf);buf.extend(b''.join(struct.pack('<fff',*n) for n in ns));d['bufferViews'].append({'buffer':0,'byteOffset':pos,'byteLength':len(ns)*12,'target':34962});d['accessors'].append({'bufferView':len(d['bufferViews'])-1,'componentType':5126,'count':len(ns),'type':'VEC3'});prim['attributes']['NORMAL']=len(d['accessors'])-1;d['buffers'][0]['byteLength']=len(buf);jb=json.dumps(d,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);buf.extend(b'\x00'*((-len(buf))%4));path.write_bytes(struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(buf))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(buf),b'BIN\x00')+buf);print('Normals:',len(ns),'degenerate faces:',deg)
