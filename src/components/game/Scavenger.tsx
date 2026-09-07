import * as THREE from "three";

/**
 * Player avatar built from the reference art:
 * hooded scavenger armour (olive drab + gunmetal), a tan modular
 * sci-fi rifle in hand and an energy blade slung across the back.
 */

const CLOTH = "#6d6a4a";
const ARMOR = "#3a3d3c";
const METAL = "#54514a";

function Rifle({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* receiver */}
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.22, 1.25]} />
        <meshStandardMaterial color="#a08a5f" metalness={0.35} roughness={0.6} />
      </mesh>
      {/* vented handguard */}
      <mesh position={[0, 0.02, 0.95]} castShadow>
        <boxGeometry args={[0.16, 0.16, 0.7]} />
        <meshStandardMaterial color="#8e7a53" metalness={0.4} roughness={0.55} />
      </mesh>
      {/* handguard vent slots */}
      {[-0.9, -1.05, -1.2].map((z) => (
        <mesh key={z} position={[0, 0.11, -z]}>
          <boxGeometry args={[0.12, 0.04, 0.07]} />
          <meshStandardMaterial color="#1d2024" roughness={0.6} />
        </mesh>
      ))}
      {/* barrel + muzzle brake */}
      <mesh position={[0, 0.02, 1.42]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.5, 10]} />
        <meshStandardMaterial color="#22252a" metalness={0.55} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.02, 1.66]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.06, 0.14, 8]} />
        <meshStandardMaterial color="#1a1d21" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* top rail */}
      <mesh position={[0, 0.15, 0.3]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.9]} />
        <meshStandardMaterial color="#26282b" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* scoped optic with glowing lens */}
      <mesh position={[0, 0.24, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.4, 10]} />
        <meshStandardMaterial color="#1d2024" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.24, 0.51]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.02, 10]} />
        <meshStandardMaterial color="#7fe8ff" emissive="#4fd8ff" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* drum magazine */}
      <mesh position={[0, -0.22, 0.05]} castShadow>
        <boxGeometry args={[0.16, 0.3, 0.24]} />
        <meshStandardMaterial color="#8e7a53" metalness={0.35} roughness={0.6} />
      </mesh>
      {/* grip */}
      <mesh position={[0, -0.2, -0.28]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.12]} />
        <meshStandardMaterial color="#26282b" roughness={0.8} />
      </mesh>
      {/* stock */}
      <mesh position={[0, -0.02, -0.78]} castShadow>
        <boxGeometry args={[0.12, 0.18, 0.45]} />
        <meshStandardMaterial color="#a08a5f" metalness={0.3} roughness={0.65} />
      </mesh>
    </group>
  );
}

/**
 * Sawblade cleaver — post-apocalyptic melee from the references:
 * a salvaged circular saw blade welded to a wrapped pipe handle.
 */
function SawCleaver() {
  return (
    <group position={[0, 0.35, -0.55]} rotation={[0, 0, Math.PI / 3.4]}>
      {/* pipe handle */}
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.9, 8]} />
        <meshStandardMaterial color="#4a4238" metalness={0.5} roughness={0.7} />
      </mesh>
      {/* cloth wrap bands */}
      {[-0.3, -0.1, 0.1].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.1, 8]} />
          <meshStandardMaterial color="#6d5f4a" roughness={0.95} />
        </mesh>
      ))}
      {/* welded joint */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.2, 0.18, 0.12]} />
        <meshStandardMaterial color="#33373b" metalness={0.6} roughness={0.55} />
      </mesh>
      {/* rusted saw disc */}
      <mesh position={[0, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.05, 18]} />
        <meshStandardMaterial color="#6b4a35" metalness={0.45} roughness={0.75} />
      </mesh>
      {/* steel cutting edge */}
      <mesh position={[0, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.03, 18]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.35} />
      </mesh>
      {/* hub bolt */}
      <mesh position={[0, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.09, 6]} />
        <meshStandardMaterial color="#22252a" metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Scavenger field pack — bedroll, canisters and strapped salvage. */
function FieldPack() {
  return (
    <group position={[0, 0.15, -0.42]}>
      {/* main pack body */}
      <mesh castShadow>
        <boxGeometry args={[0.72, 0.85, 0.34]} />
        <meshStandardMaterial color="#4f4433" roughness={0.95} />
      </mesh>
      {/* lashed bedroll on top */}
      <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.78, 10]} />
        <meshStandardMaterial color="#6d5f4a" roughness={1} />
      </mesh>
      {/* gas canisters */}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, -0.05, -0.26]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.6, 10]} />
          <meshStandardMaterial color="#3f5a4a" metalness={0.45} roughness={0.6} />
        </mesh>
      ))}
      {/* strap buckles */}
      {[-0.26, 0.26].map((y) => (
        <mesh key={y} position={[0, y, 0.19]}>
          <boxGeometry args={[0.74, 0.08, 0.05]} />
          <meshStandardMaterial color="#2b2822" roughness={0.95} />
        </mesh>
      ))}
      {/* antenna */}
      <mesh position={[0.3, 0.75, -0.1]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.9, 6]} />
        <meshStandardMaterial color="#1f2226" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function Scavenger() {
  return (
    <group>
      {/* legs */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, -0.95, 0]} castShadow>
          <boxGeometry args={[0.34, 1.0, 0.36]} />
          <meshStandardMaterial color={ARMOR} roughness={0.85} />
        </mesh>
      ))}
      {/* exo-frame leg struts + knee plates (powered-suit reference) */}
      {[-0.28, 0.28].map((x) => (
        <group key={`exo${x}`}>
          <mesh position={[x * 1.42, -0.95, -0.02]} castShadow>
            <boxGeometry args={[0.09, 1.05, 0.13]} />
            <meshStandardMaterial color={EXO} metalness={0.45} roughness={0.55} />
          </mesh>
          <mesh position={[x, -0.86, 0.22]} castShadow>
            <boxGeometry args={[0.32, 0.3, 0.12]} />
            <meshStandardMaterial color={EXO} metalness={0.4} roughness={0.6} />
          </mesh>
          <mesh position={[x, -1.42, 0.06]} castShadow>
            <boxGeometry args={[0.4, 0.22, 0.56]} />
            <meshStandardMaterial color="#2c2f31" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* torso — layered coat */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.95, 1.15, 0.6]} />
        <meshStandardMaterial color={CLOTH} roughness={0.9} />
      </mesh>
      {/* chest plate */}
      <mesh position={[0, 0.2, 0.32]} castShadow>
        <boxGeometry args={[0.66, 0.6, 0.12]} />
        <meshStandardMaterial color={EXO} metalness={0.45} roughness={0.6} />
      </mesh>
      {/* chest status light */}
      <mesh position={[0, 0.3, 0.39]}>
        <cylinderGeometry args={[0.06, 0.06, 0.03, 12]} />
        <meshStandardMaterial color="#ffb057" emissive="#ff9a2e" emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      {/* ammo pouch rack */}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, -0.2, 0.34]} castShadow>
          <boxGeometry args={[0.24, 0.2, 0.14]} />
          <meshStandardMaterial color="#5a5340" roughness={0.95} />
        </mesh>
      ))}
      {/* belt / pouches */}
      <mesh position={[0, -0.48, 0]} castShadow>
        <boxGeometry args={[1.0, 0.24, 0.66]} />
        <meshStandardMaterial color="#2f2c26" roughness={0.95} />
      </mesh>
      {/* fur-lined collar */}
      <mesh position={[0, 0.62, 0.02]} castShadow>
        <torusGeometry args={[0.36, 0.14, 8, 16]} />
        <meshStandardMaterial color="#7a6a55" roughness={1} />
      </mesh>
      {/* shoulders */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.3, 12, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
      {/* scrap pauldron spikes (wasteland armour reference) */}
      {[-0.62, 0.62].map((x) =>
        [-0.16, 0.16].map((z) => (
          <mesh key={`${x}${z}`} position={[x * 1.05, 0.66, z]} rotation={[0, 0, x > 0 ? -0.4 : 0.4]} castShadow>
            <coneGeometry args={[0.07, 0.24, 6]} />
            <meshStandardMaterial color="#8a6b4a" metalness={0.5} roughness={0.7} />
          </mesh>
        )),
      )}
      {/* arms */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, -0.05, 0.12]} castShadow>
          <boxGeometry args={[0.26, 0.85, 0.28]} />
          <meshStandardMaterial color={ARMOR} roughness={0.85} />
        </mesh>
      ))}
      {/* forearm exo bracers */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={`br${x}`} position={[x, -0.28, 0.14]} castShadow>
          <boxGeometry args={[0.3, 0.3, 0.32]} />
          <meshStandardMaterial color={EXO} metalness={0.45} roughness={0.55} />
        </mesh>
      ))}
      {/* head + rebreather mask */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <sphereGeometry args={[0.28, 14, 12]} />
        <meshStandardMaterial color="#4a4636" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.85, 0.22]}>
        <boxGeometry args={[0.3, 0.22, 0.16]} />
        <meshStandardMaterial color="#1d2024" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* filter cans on the mask */}
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.8, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.1, 8]} />
          <meshStandardMaterial color="#33373b" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* hood */}
      <mesh position={[0, 1.0, -0.06]} castShadow>
        <sphereGeometry args={[0.38, 14, 12, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
        <meshStandardMaterial color={CLOTH} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* helmet crown plate */}
      <mesh position={[0, 1.08, 0.02]} castShadow>
        <sphereGeometry args={[0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
        <meshStandardMaterial color={EXO} metalness={0.45} roughness={0.55} />
      </mesh>
      {/* visor glow */}
      <mesh position={[0, 0.98, 0.26]}>
        <boxGeometry args={[0.26, 0.07, 0.05]} />
        <meshStandardMaterial color="#66e0ff" emissive="#66e0ff" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>

      <FieldPack />
      <Rifle position={[0.62, -0.05, 0.5]} rotation={[0, 0, 0]} />
      <SawCleaver />
    </group>
  );
}
