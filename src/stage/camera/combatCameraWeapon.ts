// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import type { Vec3 } from '../vehicles/vehicleWorldAdapter';
import type { CameraPose } from './worldCameraSystem';

export interface WeaponCameraState {
  aiming: boolean;
  shoulderSide: 1 | -1;
  recoilPitch: number;
  recoilYaw: number;
  lastShotId: number | null;
}
export interface WeaponCameraInput {
  /** Standard Gamepad button 7 is right trigger; button 6 is left trigger. */
  buttons?: readonly ({ value?: number; pressed?: boolean } | number)[];
  /** Standard Gamepad right stick axes 2/3, for optional fine-aim sensitivity. */
  axes?: readonly number[];
  aimButton?: number;
  shoulderButton?: number;
  fireButton?: number;
}
export interface WeaponCameraOptions {
  hipFov?: number;
  aimFov?: number;
  fovSharpness?: number;
  recoilSharpness?: number;
  maxRecoilPitch?: number;
  maxRecoilYaw?: number;
  aimSensitivityScale?: number;
}
const finite=(n:number,f=0)=>Number.isFinite(n)?n:f;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,finite(n,a)));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function buttonValue(buttons:WeaponCameraInput['buttons'],index:number):number {const b=buttons?.[index];if(typeof b==='number')return clamp(b,0,1);return clamp(b?.value??(b?.pressed?1:0),0,1);}
export function createWeaponCameraState():WeaponCameraState {return {aiming:false,shoulderSide:1,recoilPitch:0,recoilYaw:0,lastShotId:null};}
/** Converts controller trigger state into camera intent. Host still owns the actual input polling. */
export function readWeaponCameraInput(input:WeaponCameraInput):{aimHeld:boolean;firePressed:boolean;shoulderPressed:boolean;fineAimX:number;fineAimY:number} {
 const aimIndex=input.aimButton??6,fireIndex=input.fireButton??7,shoulderIndex=input.shoulderButton??3;
 const clean=(v:number)=>{v=clamp(v,-1,1);return Math.abs(v)<0.12?0:Math.sign(v)*(Math.abs(v)-0.12)/0.88;};
 return {aimHeld:buttonValue(input.buttons,aimIndex)>0.35,firePressed:buttonValue(input.buttons,fireIndex)>0.55,shoulderPressed:buttonValue(input.buttons,shoulderIndex)>0.55,fineAimX:clean(input.axes?.[2]??0),fineAimY:clean(input.axes?.[3]??0)};
}
/** ADS narrows FOV and modestly lowers sensitivity without taking control of the host camera. */
export function stepWeaponCamera(state:WeaponCameraState,input:{aimHeld:boolean;firePressed?:boolean;shoulderPressed?:boolean;deltaSeconds:number;shotId?:number;shotRecoil?:number;shotYaw?:number},options:WeaponCameraOptions={}):WeaponCameraState {
 const dt=clamp(input.deltaSeconds,0,0.1);let next={...state,aiming:!!input.aimHeld};
 if(input.shoulderPressed)next.shoulderSide=state.shoulderSide===1?-1:1;
 // A changed shotId represents a new firing event; callers should increment it once per shot.
 if(input.firePressed&&input.shotId!==undefined&&input.shotId!==state.lastShotId){
   next.recoilPitch=clamp(state.recoilPitch+Math.max(0,finite(input.shotRecoil??0.035)),0,options.maxRecoilPitch??0.18);
   next.recoilYaw=clamp(state.recoilYaw+finite(input.shotYaw??0),-(options.maxRecoilYaw??0.08),options.maxRecoilYaw??0.08);
   next.lastShotId=input.shotId;
 }
 const decay=Math.exp(-clamp(options.recoilSharpness??9,0.1,40)*dt);
 next.recoilPitch*=decay;next.recoilYaw*=decay;
 return next;
}
export function weaponCameraFov(currentFov:number,aiming:boolean,deltaSeconds:number,options:WeaponCameraOptions={}):number {
 const dt=clamp(deltaSeconds,0,0.1),sharp=clamp(options.fovSharpness??14,0.1,40),alpha=1-Math.exp(-sharp*dt);
 return mix(finite(currentFov,options.hipFov??72),aiming?(options.aimFov??48):(options.hipFov??72),alpha);
}
export function weaponCameraSensitivity(baseSensitivity:number,aiming:boolean,options:WeaponCameraOptions={}):number {
 return clamp(baseSensitivity,0.05,5)*(aiming?clamp(options.aimSensitivityScale??0.62,0.2,1):1);
}
/** Applies a small camera-space recoil offset to pitch/yaw; host remains responsible for camera collision resolution. */
export function applyWeaponRecoil(pose:CameraPose,state:WeaponCameraState):CameraPose {
 return {...pose,pitch:clamp(pose.pitch-state.recoilPitch,-1.48,1.48),yaw:finite(pose.yaw)+state.recoilYaw};
}
/** Aim point is supplied by authoritative weapon/reticle logic; this only computes a normalized direction. */
export function directionToAimPoint(origin:Vec3,aimPoint:Vec3):Vec3|null {
 const x=finite(aimPoint.x)-finite(origin.x),y=finite(aimPoint.y)-finite(origin.y),z=finite(aimPoint.z)-finite(origin.z),length=Math.hypot(x,y,z);
 if(!Number.isFinite(length)||length<1e-6)return null;return {x:x/length,y:y/length,z:z/length};
}
