import { useMemo } from "react";
import { CasinoGameFloor } from "./CasinoGameFloor";
import { CasinoAmbientLife } from "./CasinoAmbientLife";
import { SkylinePenthouse } from "./SkylinePenthouse";
import * as THREE from "three";
import { Text } from "./SafeText";
import { walkHeight } from "@/game/terrain";
import { NEON_FLAT } from "@/game/world";


/** Reusable architectural lobby kit. Open front makes the furniture visible from the street.
 * This is decorative architecture; gameplay traversal needs explicit collision/nav integration. */
function CasinoLobbyAnnex() {
  return <group position={[0, 0, 19]}>
    <mesh position={[0, 0.18, 5]} receiveShadow>
      <boxGeometry args={[32, 0.36, 23]} />
      <meshStandardMaterial color="#3b394a" metalness={0.3} roughness={0.46} />
    </mesh>
    <mesh position={[0, 0.4, 5]} receiveShadow>
      <boxGeometry args={[3.8, 0.035, 19]} />
      <meshStandardMaterial color="#c9aa7e" metalness={0.58} roughness={0.3} />
    </mesh>
    {[-1,1].map(side => <group key={side}>
      <mesh position={[side * 15.9, 5.4, 5]} castShadow>
        <boxGeometry args={[0.42, 10.8, 23]} />
        <meshStandardMaterial color="#203c51" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[side * 12.8, 3.3, 1.5]} castShadow>
        <cylinderGeometry args={[0.75, 0.75, 6.5, 10]} />
        <meshStandardMaterial color="#c3a47a" metalness={0.75} roughness={0.23} />
      </mesh>
      <mesh position={[side * 10, 0.75, 6.2]} castShadow>
        <boxGeometry args={[8, 1.5, 2.6]} />
        <meshStandardMaterial color="#322b40" roughness={0.56} />
      </mesh>
      <mesh position={[side * 10, 1.55, 6.2]}>
        <boxGeometry args={[7.6, 0.09, 2.3]} />
        <meshStandardMaterial color="#e3bd8b" metalness={0.75} roughness={0.25} />
      </mesh>
      <mesh position={[side * 9.8, 6.3, 1.5]}>
        <sphereGeometry args={[0.65, 10, 8]} />
        <meshStandardMaterial color="#ffe4aa" emissive="#ffad4b" emissiveIntensity={0.65} />
      </mesh>
    </group>)}
    <mesh position={[0, 7.8, 5]} castShadow>
      <boxGeometry args={[32, 0.5, 23]} />
      <meshStandardMaterial color="#232237" metalness={0.6} roughness={0.34} />
    </mesh>
    <Text position={[0, 5.8, 15.8]} fontSize={1.1} color="#f9d9a4" anchorX="center">SKYLINE GRAND LOBBY</Text>
  </group>;
}

/** Stages 26–28: architectural circulation kit shared across tower floors.
 * Geometry-only until the engine's movement, collision and interaction systems
 * explicitly register these surfaces and elevators. */
function CasinoCirculation() {
  const stops = [1.6, 12.3, 38, 77, 116, 154.5];
  return <group>
    {/* Connected-looking, open-air approach: lobby door to lift concourse. */}
    <mesh position={[0, 0.34, 14]} receiveShadow>
      <boxGeometry args={[7.5, 0.25, 18]} />
      <meshStandardMaterial color="#b8a58d" metalness={0.2} roughness={0.68} />
    </mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 3.75, 0.85, 14]}>
      <boxGeometry args={[0.16, 0.8, 18]} />
      <meshStandardMaterial color="#bb9e73" metalness={0.75} roughness={0.28} />
    </mesh>)}
    {/* Stop platforms and visual doors at the elevator bank. */}
    {stops.map((level, index) => <group key={index} position={[0, level, -21.7]}>
      <mesh position={[0, -0.18, 3.4]} receiveShadow>
        <boxGeometry args={[17, 0.35, 8]} />
        <meshStandardMaterial color="#424454" metalness={0.35} roughness={0.52} />
      </mesh>
      {[-1, 0, 1].map(i => <group key={i} position={[i * 4.2, 0, 1.92]}>
        <mesh position={[0, 1.7, 0]}>
          <boxGeometry args={[3.35, 3.4, 0.12]} />
          <meshStandardMaterial color="#32465c" metalness={0.8} roughness={0.23} />
        </mesh>
        <mesh position={[0, 3.46, 0.1]}>
          <boxGeometry args={[3.4, 0.12, 0.15]} />
          <meshStandardMaterial color="#77e1fa" emissive="#238db0" emissiveIntensity={0.7} />
        </mesh>
      </group>)}
    </group>)}
    {/* Rooftop concourse from tower core to observation crown. */}
    <mesh position={[0, 154.65, -7]} receiveShadow>
      <boxGeometry args={[9, 0.32, 24]} />
      <meshStandardMaterial color="#777889" metalness={0.34} roughness={0.58} />
    </mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 4.5, 155.3, -7]}>
      <boxGeometry args={[0.16, 1.1, 24]} />
      <meshStandardMaterial color="#8ab8c9" metalness={0.7} roughness={0.3} />
    </mesh>)}
  </group>;
}

/** Three glass elevator shaft silhouettes; elevators are not yet operational. */
function CasinoElevatorBank() {
  return <group position={[0, 0, -21.7]}>
    {[-1,0,1].map((i) => <group key={i} position={[i * 4.2, 0, 0]}>
      <mesh position={[0, 76, 0]}>
        <boxGeometry args={[3.7, 148, 3.6]} />
        <meshStandardMaterial color="#21465c" transparent opacity={0.55} depthWrite={false} metalness={0.6} roughness={0.22} />
      </mesh>
      <mesh position={[0, 2.2 + (i+1)*20, 0]}>
        <boxGeometry args={[3.1, 3.8, 3.1]} />
        <meshStandardMaterial color="#e1c89e" metalness={0.7} roughness={0.24} />
      </mesh>
    </group>)}
  </group>;
}

/** Panoramic deck furnishing. Uses the same rooftop footprint as the original tower. */
function CasinoSkyDeck() {
  return <group position={[0, 160.3, -7]}>
    {Array.from({length:12},(_,i) => {
      const a = i * Math.PI / 6;
      return <group key={i} position={[Math.sin(a)*17.2, 0, Math.cos(a)*17.2]} rotation={[0,a,0]}>
        <mesh position={[0, 0.65, 0]} castShadow>
          <boxGeometry args={[2.2, 0.24, 0.85]} />
          <meshStandardMaterial color="#c6a77d" metalness={0.45} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <boxGeometry args={[2, 0.45, 0.65]} />
          <meshStandardMaterial color="#2a3542" metalness={0.65} roughness={0.32} />
        </mesh>
      </group>;
    })}
    {[-1,1].map(side => <mesh key={side} position={[side * 9.5, 0.55, 8]}>
      <boxGeometry args={[4.4, 1.1, 1.7]} />
      <meshStandardMaterial color="#3d2b47" metalness={0.42} roughness={0.42} />
    </mesh>)}
  </group>;
}


/** Stage 23: public entrance plaza, planters and pedestrian approach. */
function CasinoArrivalPlaza() {
  return <group position={[0, 0, 36]}>
    <mesh position={[0, 0.14, 0]} receiveShadow>
      <boxGeometry args={[44, 0.28, 18]} />
      <meshStandardMaterial color="#656575" roughness={0.86} />
    </mesh>
    <mesh position={[0, 0.31, 0]} receiveShadow>
      <boxGeometry args={[6, 0.045, 17]} />
      <meshStandardMaterial color="#c9b9a0" roughness={0.72} />
    </mesh>
    {[-1, 1].map(side => <group key={side} position={[side * 15.5, 0, 0]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[5.5, 1.4, 11]} />
        <meshStandardMaterial color="#45404e" metalness={0.25} roughness={0.7} />
      </mesh>
      {[-3, 3].map(z => <group key={z} position={[0, 1.4, z]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.32, 2.8, 8]} />
          <meshStandardMaterial color="#574b54" roughness={0.85} />
        </mesh>
        <mesh position={[0, 3.2, 0]} castShadow>
          <coneGeometry args={[1.55, 3.3, 7]} />
          <meshStandardMaterial color="#235a56" roughness={0.92} />
        </mesh>
      </group>)}
    </group>)}
  </group>;
}

/** Stage 24: roof access vestibule and physical safety perimeter. */
function CasinoRoofAccess() {
  return <group position={[0, 160.5, -7]}>
    <mesh position={[0, 1.5, 10.5]} castShadow>
      <boxGeometry args={[7.2, 3, 5]} />
      <meshStandardMaterial color="#30364b" metalness={0.65} roughness={0.32} />
    </mesh>
    <mesh position={[0, 1.5, 13.05]}>
      <boxGeometry args={[2.7, 2.8, 0.12]} />
      <meshStandardMaterial color="#1a536c" metalness={0.7} roughness={0.19} />
    </mesh>
    <Text position={[0, 3.25, 13.1]} fontSize={0.65} color="#a7efff" anchorX="center">SKY DECK</Text>
    {Array.from({length:16}, (_, i) => {
      const a = i * Math.PI / 8;
      return <group key={i} position={[Math.cos(a) * 19.25, 0, Math.sin(a) * 19.25]} rotation={[0, -a, 0]}>
        <mesh position={[0, 0.75, 0]}>
          <boxGeometry args={[0.16, 1.5, 2.9]} />
          <meshStandardMaterial color="#80a7ba" transparent opacity={0.42} metalness={0.3} roughness={0.16} depthWrite={false} />
        </mesh>
        <mesh position={[0, 1.55, 0]}>
          <boxGeometry args={[0.2, 0.1, 2.9]} />
          <meshStandardMaterial color="#b5a17f" metalness={0.8} roughness={0.25} />
        </mesh>
      </group>;
    })}
  </group>;
}

/** Stage 25: indoor event mezzanine and visible wayfinding; decorative, not navigable. */
function CasinoEventMezzanine() {
  return <group position={[0, 11.5, 17]}>
    <mesh position={[0, 0, 0]} receiveShadow>
      <boxGeometry args={[35, 0.5, 15]} />
      <meshStandardMaterial color="#343342" roughness={0.58} metalness={0.3} />
    </mesh>
    {[-1, 1].map(side => <group key={side} position={[side * 13, 0.5, 0]}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.12, 1.1, 14]} />
        <meshStandardMaterial color="#8cb9c5" transparent opacity={0.48} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.18, 0.12, 14]} />
        <meshStandardMaterial color="#d9b58c" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>)}
    <Text position={[0, 2.2, 7.7]} fontSize={0.85} color="#f7dca8" anchorX="center">EVENT GALLERY</Text>
  </group>;
}

/** Distinct landmark tower, placed away from the existing Understage venue.
 * Casino-inspired architecture only; no wagering or gambling functionality. */
export function NeonSkylineCasino({ center }: { center: { x: number; z: number } }) {
  const x = center.x - NEON_FLAT * 0.49;
  const z = center.z + NEON_FLAT * 0.36;
  const y = walkHeight(x, z);
  const floors = useMemo(() => Array.from({ length: 28 }, (_, i) => i), []);
  return <group position={[x, y, z]}>
    <CasinoLobbyAnnex />
    <CasinoGameFloor />
    <CasinoAmbientLife />
    <SkylinePenthouse />
    <CasinoElevatorBank />
    <CasinoCirculation />
    <CasinoSkyDeck />
    <CasinoArrivalPlaza />
    <CasinoRoofAccess />
    {/* Landing bridge between elevator shaft and rooftop deck. */}
    <mesh position={[0, 160.5, -17.8]} receiveShadow>
      <boxGeometry args={[8, 0.3, 10]} />
      <meshStandardMaterial color="#747e90" metalness={0.55} roughness={0.42} />
    </mesh>
    <CasinoEventMezzanine />
    <mesh position={[0, 1.3, 0]} receiveShadow castShadow>
      <boxGeometry args={[49, 2.6, 45]} />
      <meshStandardMaterial color="#1a1b2a" metalness={0.65} roughness={0.3} />
    </mesh>
    {/* Podium: illuminated entrance canopy and public-facing facade. */}
    <mesh position={[0, 7.5, -3]} castShadow>
      <boxGeometry args={[43, 12, 36]} />
      <meshStandardMaterial color="#172132" metalness={0.7} roughness={0.25} />
    </mesh>
    <mesh position={[0, 3.6, 20]}>
      <boxGeometry args={[28, 0.55, 8]} />
      <meshStandardMaterial color="#3a3048" metalness={0.6} roughness={0.28} />
    </mesh>
    <mesh position={[0, 5.8, 24.15]}>
      <boxGeometry args={[23, 2.5, 0.3]} />
      <meshStandardMaterial color="#170e26" emissive="#7028b6" emissiveIntensity={0.45} />
    </mesh>
    <Text position={[0, 5.8, 24.4]} color="#f6c9ff" fontSize={1.7} anchorX="center">SKYLINE CASINO</Text>
    {/* Tall entrance glazing, side pilasters and warm lobby lighting. */}
    {[-1, 1].map(side => <group key={`entry-${side}`}>
      <mesh position={[side * 15.5, 5.5, 15.15]}>
        <boxGeometry args={[1.3, 10.3, 0.65]} />
        <meshStandardMaterial color="#c6a56c" metalness={0.8} roughness={0.26} />
      </mesh>
      <mesh position={[side * 9.5, 5.2, 15.3]}>
        <boxGeometry args={[8.5, 7.8, 0.24]} />
        <meshStandardMaterial color="#193a50" emissive="#0c4555" emissiveIntensity={0.28} metalness={0.7} roughness={0.18} />
      </mesh>
      <mesh position={[side * 10, 11.8, 15.45]}>
        <boxGeometry args={[15, 0.24, 0.3]} />
        <meshStandardMaterial color="#e4b979" emissive="#805220" emissiveIntensity={0.4} />
      </mesh>
    </group>)}
    {/* 28-tier glass tower rises above the surrounding entertainment district. */}
    <mesh position={[0, 79, -7]} castShadow>
      <boxGeometry args={[27, 142, 25]} />
      <meshStandardMaterial color="#172b3e" metalness={0.8} roughness={0.2} />
    </mesh>
    {floors.map(i => <group key={i} position={[0, 10 + i * 5, -7]}>
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[0, 0, side * 12.65]}>
          <boxGeometry args={[26.9, 0.19, 0.15]} />
          <meshStandardMaterial color="#6ad6f6" emissive="#167ba5" emissiveIntensity={0.65} />
        </mesh>
        <mesh position={[side * 13.65, 0, 0]}>
          <boxGeometry args={[0.15, 0.19, 24.9]} />
          <meshStandardMaterial color="#6ad6f6" emissive="#167ba5" emissiveIntensity={0.65} />
        </mesh>
      </group>)}
    </group>)}
    {/* Vertical architectural ribs add scale to the skyline without duplicating floor geometry. */}
    {[-1, 1].map(side => <group key={`tower-rib-${side}`}>
      <mesh position={[side * 13.7, 79, -7]}>
        <boxGeometry args={[0.55, 143, 0.7]} />
        <meshStandardMaterial color="#a98d70" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, 79, -7 + side * 12.85]}>
        <boxGeometry args={[0.7, 143, 0.55]} />
        <meshStandardMaterial color="#a98d70" metalness={0.85} roughness={0.3} />
      </mesh>
    </group>)}
    {/* Distinctive crown: panoramic roof lounge and headliner platform. */}
    <mesh position={[0, 153, -7]} castShadow receiveShadow>
      <cylinderGeometry args={[22, 18, 5, 12]} />
      <meshStandardMaterial color="#1c2036" metalness={0.72} roughness={0.29} />
    </mesh>
    <mesh position={[0, 157.5, -7]}>
      <cylinderGeometry args={[19, 19, 4, 12, 1, true]} />
      <meshStandardMaterial color="#46c7f7" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    <mesh position={[0, 159.8, -7]}>
      <cylinderGeometry args={[20, 20, 0.65, 12]} />
      <meshStandardMaterial color="#161625" metalness={0.65} roughness={0.24} />
    </mesh>
    <mesh position={[0, 162.5, -7]}>
      <cylinderGeometry args={[1.2, 1.2, 6, 8]} />
      <meshStandardMaterial color="#6bdfff" emissive="#249bd5" emissiveIntensity={1.2} />
    </mesh>
    {/* Rooftop show infrastructure: rear truss, lighting banks and stage deck.
        Decorative only until roof navigation and concert scheduling are connected. */}
    <mesh position={[0, 156.1, -12]} receiveShadow>
      <boxGeometry args={[17, 0.6, 8]} />
      <meshStandardMaterial color="#1c1a27" metalness={0.6} roughness={0.45} />
    </mesh>
    {[-1, 1].map(side => <group key={`roof-truss-${side}`}>
      <mesh position={[side * 8, 160.2, -15]}>
        <cylinderGeometry args={[0.2, 0.2, 8, 6]} />
        <meshStandardMaterial color="#718b9e" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[side * 5.5, 162.6, -15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 5, 6]} />
        <meshStandardMaterial color="#718b9e" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[side * 6, 159.2, -14.6]}>
        <boxGeometry args={[1.2, 1.5, 0.8]} />
        <meshStandardMaterial color="#252631" emissive="#7932aa" emissiveIntensity={0.7} />
      </mesh>
    </group>)}
    <mesh position={[0, 163, -15]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.22, 0.22, 16, 8]} />
      <meshStandardMaterial color="#718b9e" metalness={0.9} roughness={0.3} />
    </mesh>
    <Text position={[0, 147.5, 6]} color="#f1baff" fontSize={2.8} anchorX="center">SKYLINE</Text>
  </group>;
}
