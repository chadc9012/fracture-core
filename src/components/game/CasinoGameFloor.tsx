import { useEffect, useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { Text } from "./SafeText";
import { cardName, drawCard, handValue, rouletteMultiplier, slotMultiplier, spinRoulette, spinSlots, type Card, type CasinoGame } from "@/game/casino-games";

const stations = [
 {id:"slot-a",game:"slots" as CasinoGame,x:-12,z:27,high:false},
 {id:"slot-b",game:"slots" as CasinoGame,x:-7,z:27,high:false},
 {id:"roulette-a",game:"roulette" as CasinoGame,x:1,z:27,high:false},
 {id:"blackjack-a",game:"blackjack" as CasinoGame,x:9,z:27,high:false},
 {id:"roulette-vip",game:"roulette" as CasinoGame,x:-8,z:11,high:true},
 {id:"blackjack-vip",game:"blackjack" as CasinoGame,x:8,z:11,high:true},
];
const buttonStyle: React.CSSProperties = { background:"#253953",border:"1px solid #6ad9ff",color:"white",borderRadius:5,padding:"7px 10px",cursor:"pointer" };
function ArcadePanel({ game, high, close, onPlay, chips, setChips }: {game:CasinoGame;high:boolean;close:()=>void;onPlay:()=>void;chips:number;setChips:React.Dispatch<React.SetStateAction<number>>}) {
 const [bet,setBet]=useState(high?100:25);
 const [status,setStatus]=useState("Choose a stake and play. Fictional chips only.");
 const [reels,setReels]=useState([0,1,2]);
 const [wheel,setWheel]=useState<number|null>(null);
 const [choice,setChoice]=useState<"red"|"black"|"even"|"odd"|"zero">("red");
 const [hand,setHand]=useState<Card[]>([]);
 const [dealer,setDealer]=useState<Card[]>([]);
 const [active,setActive]=useState(false);
 const [lockedBet,setLockedBet]=useState(0);
 const min=high?100:10;
 const valid=()=>bet>=min && bet<=chips;
 const finish=(p:Card[],d:Card[],stake:number)=>{
  let dealerHand=[...d];
  while(handValue(dealerHand)<17) dealerHand.push(drawCard());
  const playerScore=handValue(p),dealerScore=handValue(dealerHand);
  const win=playerScore<=21&&(dealerScore>21||playerScore>dealerScore);
  const push=playerScore===dealerScore&&playerScore<=21;
  const payout=win?stake*2:push?stake:0;
  setDealer(dealerHand);setChips(c=>c+payout);setActive(false);
  setStatus(win?`Win! +${payout} chips returned.`:push?"Push: stake returned.":"Dealer wins.");
 };
 const start=()=>{
  if(!valid()){setStatus(`Minimum ${min} chips; check your balance.`);return;}
  onPlay();
  setChips(c=>c-bet);
  setLockedBet(bet);
  if(game==="slots"){
   const result=spinSlots(), payout=bet*slotMultiplier(result);
   setReels(result);setChips(c=>c+payout);setStatus(payout?`Slots paid ${payout} chips!`:"No match this spin.");
  }else if(game==="roulette"){
   const number=spinRoulette(),payout=bet*rouletteMultiplier(number,choice);
   setWheel(number);setChips(c=>c+payout);setStatus(`Wheel landed on ${number}. ${payout?`Paid ${payout} chips.`:"No win."}`);
  }else{
   const p=[drawCard(),drawCard()],d=[drawCard(),drawCard()];
   setHand(p);setDealer(d);setActive(true);setStatus("Hit or stand.");
   if(handValue(p)===21||handValue(d)===21){
    const payout=handValue(p)===21?(handValue(d)===21?bet:Math.floor(bet*2.5)):0;
    setChips(c=>c+payout);setActive(false);
    setStatus(handValue(p)===21?(handValue(d)===21?"Both have blackjack: push.":"Natural blackjack!"):"Dealer blackjack.");
   }
  }
 };
 const hit=()=>{
  const p=[...hand,drawCard()];setHand(p);
  if(handValue(p)>21){setActive(false);setStatus("Bust! Dealer wins.");}
 };
 return <div onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} style={{width:300,background:"#0d1426",color:"#eef8ff",border:"2px solid #53c8ed",borderRadius:12,padding:15,fontFamily:"system-ui",boxShadow:"0 0 24px #15506c",pointerEvents:"auto"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><strong>{high?"HIGH ROLLER ":""}{game.toUpperCase()}</strong><button style={buttonStyle} onClick={close}>Close</button></div>
  <p>Arcade chips: <b>{chips}</b> · Minimum: {min}</p>
  <div style={{display:"flex",gap:5,marginBottom:8}}>{[10,25,100,250,500].filter(n=>n>=min).map(n=><button key={n} style={{...buttonStyle,opacity:bet===n?1:0.6}} onClick={()=>setBet(n)}>{n}</button>)}</div>
  {game==="slots"&&<div style={{fontSize:32,textAlign:"center"}}>{reels.map(n=>["🍒","🔔","⭐","💎","7️⃣","👑"][n]).join(" ")}</div>}
  {game==="roulette"&&<><p>Last number: {wheel??"—"}</p><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{(["red","black","even","odd","zero"] as const).map(v=><button key={v} style={{...buttonStyle,opacity:choice===v?1:0.55}} onClick={()=>setChoice(v)}>{v}</button>)}</div></>}
  {game==="blackjack"&&<><p>Dealer: {dealer.map(cardName).join(" ")} ({handValue(dealer)})</p><p>You: {hand.map(cardName).join(" ")} ({handValue(hand)})</p></>}
  <p aria-live="polite" style={{minHeight:38}}>{status}</p>
  {active?<div style={{display:"flex",gap:8}}><button style={buttonStyle} onClick={hit}>Hit</button><button style={buttonStyle} onClick={()=>finish(hand,dealer,lockedBet)}>Stand</button></div>:<button style={buttonStyle} onClick={start} disabled={!valid()}>Play — {bet} chips</button>}
  {chips<min&&!active&&<button style={{...buttonStyle,marginLeft:8}} onClick={()=>{setChips(1500);setStatus("Arcade balance reset.");}}>Reset demo chips</button>}
  <small style={{display:"block",marginTop:10,opacity:0.7}}>Simulation only. No cash value or real-money wagering.</small>
 </div>;
}
function CasinoEquipment({game,playCount}:{game:CasinoGame;playCount:number}) {
 const ref=useRef<THREE.Group>(null);
 const remaining=useRef(0);
 useEffect(()=>{if(playCount>0)remaining.current=1.4;},[playCount]);
 useFrame((_,dt)=>{
  if(!ref.current)return;
  remaining.current=Math.max(0,remaining.current-dt);
  const active=remaining.current>0;
  if(game==="roulette")ref.current.rotation.y+=active?dt*16:dt*0.25;
  else if(game==="slots")ref.current.rotation.x+=active?dt*18:0;
  else ref.current.position.z=active?Math.sin((1.4-remaining.current)*18)*0.55:0;
 });
 return <group>
  {game==="roulette"?<group position={[0,1.34,0]}>
   <group ref={ref}><mesh rotation-x={-Math.PI/2}><torusGeometry args={[0.65,0.16,8,24]}/><meshStandardMaterial color="#bb8a3b" metalness={0.8}/></mesh>
    {Array.from({length:12},(_,i)=><mesh key={i} rotation={[0,i*Math.PI/6,0]} position={[Math.sin(i*Math.PI/6)*0.46,0,Math.cos(i*Math.PI/6)*0.46]}><boxGeometry args={[0.19,0.03,0.18]}/><meshStandardMaterial color={i%2?"#a72137":"#171d24"}/></mesh>)}
   </group></group>:game==="slots"?<group position={[0,1.55,0]}>
   <group ref={ref}><mesh><cylinderGeometry args={[0.45,0.45,0.75,12]}/><meshStandardMaterial color="#d6bd67" metalness={0.8}/></mesh></group>
  </group>:<group ref={ref} position={[0,1.3,0]}>
   {[0,1,2].map(i=><mesh key={i} position={[(i-1)*0.32,0,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[0.27,0.4]}/><meshStandardMaterial color="#fff3dc" side={THREE.DoubleSide}/></mesh>)}
  </group>}
 </group>;
}

export function CasinoGameFloor() {
 const [selected,setSelected]=useState<string|null>(null);
 const [visuals,setVisuals]=useState<Record<string,number>>({});
 const playVisual=(id:string)=>setVisuals(v=>({...v,[id]:(v[id]??0)+1}));
 // One arcade balance shared by all stations. Kept separate from the game's rewards/currency.
 const [chips,setChips]=useState<number>(()=>{
  if(typeof window==="undefined") return 1500;
  try {const v=Number(window.localStorage.getItem("wf.skyline.arcadeChips.v1"));return Number.isFinite(v)&&v>=0&&v<=1000000?v:1500;} catch{return 1500;}
 });
 useEffect(()=>{try{window.localStorage.setItem("wf.skyline.arcadeChips.v1",String(chips));}catch{/* storage disabled */}},[chips]);
 return <group>
  {/* Staff animations and dialogue are rendered by CasinoAmbientLife at matching stations. */}
  {stations.map(s=><group key={s.id} position={[s.x,0,s.z]}>
    <CasinoEquipment game={s.game} playCount={visuals[s.id]??0}/>
    <mesh position={[0,0.65,0]} castShadow><cylinderGeometry args={[s.game==="slots"?0.9:2.0,s.game==="slots"?0.9:2.0,1.2,12]}/><meshStandardMaterial color={s.high?"#593c75":"#244b57"} metalness={0.6} roughness={0.35}/></mesh>
    {s.game!=="slots"&&<group position={[0,0,-2.5]}>
      <mesh position={[0,0.82,0]} castShadow><capsuleGeometry args={[0.38,0.85,4,8]}/><meshStandardMaterial color={s.high?"#35294c":"#182b3a"} roughness={0.83}/></mesh>
      <mesh position={[0,1.66,0]} castShadow><sphereGeometry args={[0.29,12,8]}/><meshStandardMaterial color="#a87a62" roughness={0.92}/></mesh>
      <mesh position={[0,1.9,0]}><boxGeometry args={[0.52,0.14,0.43]}/><meshStandardMaterial color="#18191e"/></mesh>
    </group>}
    {s.game!=="slots"&&[-1,1].map((side)=><group key={side} position={[side*2.5,0,1.8]}>
      <mesh position={[0,0.7,0]} castShadow><capsuleGeometry args={[0.34,0.8,4,8]}/><meshStandardMaterial color={side===1?"#70436b":"#465f74"}/></mesh>
      <mesh position={[0,1.48,0]}><sphereGeometry args={[0.26,10,8]}/><meshStandardMaterial color={side===1?"#b38a76":"#7e5b4b"}/></mesh>
    </group>)}
    <Text position={[0,1.5,0]} fontSize={0.5} color={s.high?"#f5c77c":"#8deaff"} anchorX="center">{s.high?"VIP ":""}{s.game.toUpperCase()}</Text>
    <mesh position={[0,0.18,0]}><torusGeometry args={[s.game==="slots"?1.1:2.1,0.045,6,24]}/><meshStandardMaterial color={s.high?"#d6b36d":"#50b5cf"} emissive={s.high?"#775214":"#14566c"} emissiveIntensity={0.8}/></mesh>
    <Html position={[0,2.4,0]} center distanceFactor={18} transform={false}>
      {selected===s.id?<ArcadePanel game={s.game} high={s.high} close={()=>setSelected(null)} chips={chips} setChips={setChips} onPlay={()=>playVisual(s.id)}/>:<button style={{...buttonStyle,whiteSpace:"nowrap"}} onPointerDown={e=>e.stopPropagation()} onClick={()=>setSelected(s.id)}>Play {s.high?"VIP ":""}{s.game}</button>}
    </Html>
  </group>)}
 </group>;
}
