/** Central combat integration helpers: do not use these without passing the actual
 * player position and casino tower center into the combat dispatcher. */
export type CasinoAction = "shoot"|"throw_weapon"|"draw_weapon"|"melee"|"emote"|"interact";
export type CasinoSecurityState = { incidents:number; warned:boolean; escorted:boolean };
export const initialCasinoSecurity=():CasinoSecurityState=>({incidents:0,warned:false,escorted:false});
export function casinoAllowsAction(action:CasinoAction):boolean {return action==="melee"||action==="emote"||action==="interact";}
export function registerCasinoDisturbance(state:CasinoSecurityState):CasinoSecurityState {
 const incidents=state.incidents+1;return {incidents,warned:true,escorted:incidents>=2};
}
export function isInsideSkylineCasino(px:number,pz:number,cx:number,cz:number):boolean {
 return Number.isFinite(px)&&Number.isFinite(pz)&&Math.abs(px-cx)<=25&&Math.abs(pz-cz)<=25;
}
export function filterCasinoCombat(action:CasinoAction,insideCasino:boolean):{allowed:boolean;securityAlert:boolean} {
 if(!insideCasino)return {allowed:true,securityAlert:false};
 if(!casinoAllowsAction(action))return {allowed:false,securityAlert:true};
 return {allowed:true,securityAlert:action==="melee"};
}

/** A single action gate for use by input, projectile spawning, and damage application. */
export function casinoCombatGate(action:CasinoAction, position:{x:number;z:number}, center:{x:number;z:number}) {
 return filterCasinoCombat(action,isInsideSkylineCasino(position.x,position.z,center.x,center.z));
}
/** Pure security escalation; caller is responsible for actual NPC navigation and relocation. */
export function resolveSecurityIncident(state:CasinoSecurityState, kind:"melee"|"weapon_attempt") {
 const next=registerCasinoDisturbance(state);
 return {state:next, response:next.escorted?"escort":kind==="weapon_attempt"?"confiscation_warning":"separate_fighters"} as const;
}

/** World-space safety check. Restrict only within the casino's active vertical structure. */
export function casinoCombatGate3D(action:CasinoAction, position:{x:number;y:number;z:number}, center:{x:number;z:number}, baseY:number) {
 const inside=isInsideSkylineCasino(position.x,position.z,center.x,center.z)
  && position.y>=baseY-2 && position.y<=baseY+170;
 return filterCasinoCombat(action,inside);
}
