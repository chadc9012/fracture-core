import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";

/** Animated volcanic surface used at Ember Peaks. Fully local, so it cannot stall world loading. */
export function LavaPool({ radius = 7 }: { radius?: number }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, delta) => { uniforms.uTime.value += Math.min(delta, 0.05); });
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <circleGeometry args={[radius, 64]} />
      <shaderMaterial uniforms={uniforms} toneMapped={false}
        vertexShader={`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`
          uniform float uTime; varying vec2 vUv;
          float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1)),f.x),f.y);}
          void main(){vec2 p=(vUv-.5)*7.;float f=n(p+vec2(uTime*.18,-uTime*.11))+.5*n(p*2.3+vec2(-uTime*.12,uTime*.24));float c=smoothstep(.63,.82,f);float r=smoothstep(.52,.38,length(vUv-.5));vec3 crust=vec3(.055,.018,.012);vec3 hot=mix(vec3(.95,.08,.005),vec3(1.,.58,.04),c);gl_FragColor=vec4(mix(crust,hot,c*.92+r*.08),1.);}`}
      />
    </mesh>
  );
}