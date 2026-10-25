import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { Text } from "./SafeText";
import { profileKey } from "../../game/save-profile";
import { PENTHOUSE_PRICE, purchasePenthouseThroughHost, type PropertyPurchaseHost } from "../../game/casino-property";

type SuiteStyle = {wall:string;floor:string;lighting:string;sofa:string;art:string; bed:string; kitchen:string; window:string; carpet:string};
const DEFAULT:SuiteStyle={wall:"#29384e",floor:"#514336",lighting:"#9bdfff",sofa:"#633e67",art:"#e0a95d",bed:"#d7d2d0",kitchen:"#727b86",window:"#68b4c5",carpet:"#b4a3b8"};
const STORAGE=profileKey("wf.skyline.penthouse.v2");
export function SkylinePenthouse({purchaseHost}:{purchaseHost?:PropertyPurchaseHost}={}){
 const [owned,setOwned]=useState(false);
 const [style,setStyle]=useState<SuiteStyle>(DEFAULT);
 const [open,setOpen]=useState(false);
 const [notice,setNotice]=useState("");
 const [room,setRoom]=useState<"lounge"|"bedroom"|"kitchen">("lounge");
 const [furniture,setFurniture]=useState({desk:true,plants:true,bookshelf:true});
 useEffect(()=>{setOwned(purchaseHost?.read().penthouseOwned===true);try{const v=JSON.parse(localStorage.getItem(STORAGE)||"null");if(v){setStyle({...DEFAULT,...v.style});if(v.furniture)setFurniture({...{desk:true,plants:true,bookshelf:true},...v.furniture});}}catch{}},[purchaseHost]);
 useEffect(()=>{try{localStorage.setItem(STORAGE,JSON.stringify({style,furniture}));}catch{}},[owned,style]);
 const choose=(key:keyof SuiteStyle,value:string)=>setStyle(v=>({...v,[key]:value}));
 return <group>
  {/* Residential suite is an architectural preview high in the tower. */}
  <group position={[0,133,-7]}>
   <mesh position={[0,0,0]} receiveShadow><boxGeometry args={[22,0.35,20]}/><meshStandardMaterial color={style.floor}/></mesh>
   <mesh position={[0,5,-9.9]}><boxGeometry args={[22,10,0.2]}/><meshStandardMaterial color={style.wall}/></mesh>
   {[-1,1].map(side=><mesh key={side} position={[side*10.9,5,0]}><boxGeometry args={[0.2,10,20]}/><meshStandardMaterial color={style.wall}/></mesh>)}
   <mesh position={[0,0.85,1]}><boxGeometry args={[5.5,1.3,2.2]}/><meshStandardMaterial color={style.sofa}/></mesh>
   <mesh position={[0,2.6,-9.7]}><boxGeometry args={[4.5,2.8,0.15]}/><meshStandardMaterial color={style.art} emissive={style.art} emissiveIntensity={0.15}/></mesh>
   {/* Separate bedroom and kitchen furniture zones; visible independently of editor UI. */}
   <mesh position={[-6,0.75,-5]}><boxGeometry args={[5,1.2,4]}/><meshStandardMaterial color={style.bed} roughness={0.9}/></mesh>
   <mesh position={[6,1.05,-5]}><boxGeometry args={[5,2,1.5]}/><meshStandardMaterial color={style.kitchen} metalness={0.4}/></mesh>
   <mesh position={[0,0.22,2]}><boxGeometry args={[7,0.05,5]}/><meshStandardMaterial color={style.carpet} roughness={1}/></mesh>
   <mesh position={[0,5,9.9]}><boxGeometry args={[22,9.5,0.18]}/><meshStandardMaterial color={style.window} transparent opacity={0.18} metalness={0.35} roughness={0.12}/></mesh>
   {furniture.desk&&<mesh position={[7,1.1,4]}><boxGeometry args={[2.5,0.2,1.2]}/><meshStandardMaterial color={style.kitchen}/></mesh>}
   {furniture.plants&&<mesh position={[-8,1.2,6]}><coneGeometry args={[0.75,2.4,7]}/><meshStandardMaterial color="#39714c"/></mesh>}
   {furniture.bookshelf&&<mesh position={[8,3,-9]}><boxGeometry args={[3,5,0.7]}/><meshStandardMaterial color="#65513c"/></mesh>}
   <pointLight position={[0,6,0]} color={style.lighting} intensity={3} distance={18}/>
   <Text position={[0,8.2,-9.5]} fontSize={0.8} color="#e6d8bb" anchorX="center">SKYLINE PENTHOUSE</Text>
  </group>
  <Html position={[0,3,23]} center distanceFactor={22}>
   <div style={{fontFamily:"system-ui",background:"#12182af2",border:"1px solid #d7b57b",padding:12,borderRadius:9,color:"white",width:270,pointerEvents:"auto"}} onPointerDown={e=>e.stopPropagation()}>
    <strong>Skyline Residences</strong><p style={{fontSize:12}}>Penthouse residence. Purchase requires a connected World Fracture credits wallet.</p>
    {!owned?<button onClick={()=>{if(!purchaseHost){setNotice("Property purchase requires a connected game save and wallet");return;}const result=purchasePenthouseThroughHost(purchaseHost);setNotice(result.reason);if(result.ok)setOwned(true);}}>Buy penthouse — {PENTHOUSE_PRICE.toLocaleString()} credits</button>:<button onClick={()=>setOpen(v=>!v)}>{open?"Close editor":"Customize suite"}</button>}
    {notice&&<p role="status" style={{fontSize:11}}>{notice}</p>}
    {owned&&open&&<div style={{display:"grid",gap:7,marginTop:9}}>
      <div style={{display:"flex",gap:5}}>{(["lounge","bedroom","kitchen"] as const).map(r=><button key={r} onClick={()=>setRoom(r)} style={{opacity:room===r?1:0.6}}>{r}</button>)}</div>
      <small>Editing {room} finishes and furnishings</small>
      {(["desk","plants","bookshelf"] as const).map(k=><label key={k}>{k} <input type="checkbox" checked={furniture[k]} onChange={e=>setFurniture(v=>({...v,[k]:e.target.checked}))}/></label>)}{(Object.keys(DEFAULT) as (keyof SuiteStyle)[]).map(k=><label key={k} style={{display:"flex",justifyContent:"space-between"}}>{k}<input type="color" value={style[k]} onChange={e=>choose(k,e.target.value)}/></label>)}
     <button onClick={()=>setStyle(DEFAULT)}>Reset design</button>
    </div>}
   </div>
  </Html>
 </group>;
}
