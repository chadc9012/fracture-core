import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useState } from "react";
import { useEffect } from "react";

/** Ambient visual-only casino life; no new AI, collision, or reward systems. */
type Worker = { id: string; x: number; z: number; role: "guard" | "server" | "guest" | "dealer"; phase: number };
const WORKERS: Worker[] = [
 {id:"door-left",x:-8,z:24,role:"guard",phase:0},
 {id:"door-right",x:8,z:24,role:"guard",phase:1},
 {id:"vip-guard",x:0,z:9,role:"guard",phase:2},
 {id:"server-a",x:-15,z:18,role:"server",phase:0},
 {id:"server-b",x:14,z:18,role:"server",phase:2},
 {id:"guest-a",x:-17,z:13,role:"guest",phase:0},
 {id:"guest-b",x:16,z:13,role:"guest",phase:2},
 {id:"guest-c",x:-2,z:19,role:"guest",phase:4},
 {id:"guest-d",x:5,z:19,role:"guest",phase:6},
 {id:"dealer-roulette",x:1,z:24.4,role:"dealer",phase:1},
 {id:"dealer-blackjack",x:9,z:24.4,role:"dealer",phase:2},
 {id:"dealer-vip-roulette",x:-8,z:8.4,role:"dealer",phase:3},
 {id:"dealer-vip-blackjack",x:8,z:8.4,role:"dealer",phase:4},
];
function Figure({person}: {person: Worker}) {
 const group=useRef<THREE.Group>(null);
 const arm=useRef<THREE.Group>(null);
 const [talk,setTalk]=useState(false);
 const [alert,setAlert]=useState(false);
 const [response,setResponse]=useState<"calm"|"warning"|"escort">("calm");
 useEffect(()=>{const handler=()=>{if(person.role==="guard"){setAlert(true);setResponse(v=>v==="calm"?"warning":"escort");}};window.addEventListener("wf:casino:disturbance",handler);return()=>window.removeEventListener("wf:casino:disturbance",handler);},[person.role]);
 useFrame(({clock},dt)=>{
  if(!group.current)return;
  const t=clock.elapsedTime+person.phase;
  if(person.role==="guest") {
   group.current.position.x=person.x+Math.sin(t*0.28)*1.5;
   group.current.position.z=person.z+Math.cos(t*0.28)*1.2;
   group.current.rotation.y=Math.atan2(Math.cos(t*0.28),-Math.sin(t*0.28));
  } else if(person.role==="server") {
   group.current.position.x=person.x+Math.sin(t*0.35)*2.2;
   group.current.position.z=person.z+Math.cos(t*0.35)*1.3;
   group.current.rotation.y=Math.atan2(Math.cos(t*0.35),-Math.sin(t*0.35));
  } else if(person.role==="dealer") {
   group.current.rotation.y=Math.sin(t*0.6)*0.12;
  } else {
   group.current.rotation.y=alert?Math.sin(t*1.8)*0.5:Math.sin(t*0.3)*0.25;
  }
  if(arm.current) arm.current.rotation.x=person.role==="dealer" ? -0.45 + Math.sin(t*1.6)*0.5 : Math.sin(t*2.0)*0.12;
 });
 const coat=person.role==="guard"?"#161d2a":person.role==="server"?"#8b4268":person.role==="dealer"?"#3b243b":"#456d8a";
 const greetings={guard:"Welcome. Please keep the entrance clear.",server:"Can I bring you a refreshment?",guest:"Big night at the Skyline, isn't it?",dealer:"Place your arcade chips when you're ready."};
 return <group ref={group} position={[person.x,0,person.z]}>
  <Html position={[0,2.5,0]} center distanceFactor={18}>
   <div style={{pointerEvents:"auto",width:talk?190:80,textAlign:"center",fontFamily:"system-ui",fontSize:11,color:"white",background:"#142039ee",padding:5,borderRadius:6,border:"1px solid #4db7d5"}}>
    {talk?<><p>{alert&&person.role==="guard"?(response==="escort"?"Security: leave the premises. No weapons allowed.":"Security: break it up. Unarmed disputes only."):greetings[person.role]}</p><button onClick={()=>setTalk(false)}>Close</button></>:<button onClick={()=>setTalk(true)} style={{cursor:"pointer"}}>Talk</button>}
   </div>
  </Html>
  <mesh position={[0,1.15,0]} castShadow><capsuleGeometry args={[0.35,0.82,4,8]}/><meshStandardMaterial color={coat} roughness={0.84}/></mesh>
  <mesh position={[0,1.91,0]} castShadow><sphereGeometry args={[0.27,10,8]}/><meshStandardMaterial color={person.phase%2===0?"#9a6e56":"#c49c80"} roughness={0.9}/></mesh>
  <mesh position={[-0.16,0.45,0]}><boxGeometry args={[0.17,0.9,0.22]}/><meshStandardMaterial color="#1b202a"/></mesh>
  <mesh position={[0.16,0.45,0]}><boxGeometry args={[0.17,0.9,0.22]}/><meshStandardMaterial color="#1b202a"/></mesh>
  <group ref={arm} position={[0.43,1.5,0]}><mesh position={[0,-0.25,0]}><capsuleGeometry args={[0.12,0.43,4,6]}/><meshStandardMaterial color={coat}/></mesh></group>
  {person.role==="dealer"&&<><mesh position={[0,1.55,0.33]}><boxGeometry args={[0.25,0.5,0.045]}/><meshStandardMaterial color="#e5d3c2"/></mesh><mesh position={[0,1.55,0.36]}><boxGeometry args={[0.08,0.24,0.03]}/><meshStandardMaterial color="#d5aa57" metalness={0.6}/></mesh></>}
  {person.role==="guard"&&<mesh position={[0,1.47,0.36]}><boxGeometry args={[0.24,0.13,0.04]}/><meshStandardMaterial color="#e9c66c" emissive="#6b4b13" emissiveIntensity={0.35}/></mesh>}
  {person.role==="server"&&<group position={[0.45,1.05,0.22]}><mesh><cylinderGeometry args={[0.36,0.36,0.045,12]}/><meshStandardMaterial color="#b6a8a0" metalness={0.85} roughness={0.2}/></mesh><mesh position={[0,0.13,0]}><cylinderGeometry args={[0.065,0.065,0.22,8]}/><meshStandardMaterial color="#5ad2ef" transparent opacity={0.7}/></mesh></group>}
 </group>;
}
export function CasinoAmbientLife(){return <group>{WORKERS.map(person=><Figure key={person.id} person={person}/>)}
  <Html position={[0,2.5,19]} center><button style={{background:"#372136",color:"white",padding:8,border:"1px solid #ecb3e5",cursor:"pointer"}} onClick={()=>window.dispatchEvent(new Event("wf:casino:disturbance"))}>Simulate disturbance (unarmed)</button></Html>
 </group>}
