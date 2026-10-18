// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import type { Vec3 } from '../vehicles/vehicleWorldAdapter';
import type { CameraPose, CameraRigState } from './worldCameraSystem';

export interface CameraTargetCandidate {
  id: string;
  position: Vec3;
  /** Optional host-computed visibility; false candidates cannot be acquired. */
  visible?: boolean;
  /** Optional host-provided target priority, e.g. boss/elite/objective. */
  priority?: number;
  alive?: boolean;
}
export interface CameraAssistState {
  lockedTargetId: string | null;
  shoulderSide: 1 | -1;
  reticleOffset: Vec3;
}
export interface CameraAssistOptions {
  maxAcquireDistance?: number;
  maxRetainDistance?: number;
  maxAngleRadians?: number;
  targetHeight?: number;
  leadSeconds?: number;
}
const finite=(n:number,f=0)=>Number.isFinite(n)?n:f;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,finite(n,a)));
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const length=(v:Vec3)=>Math.hypot(v.x,v.y,v.z);
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const normalize=(v:Vec3):Vec3=>{const l=length(v)||1;return {x:v.x/l,y:v.y/l,z:v.z/l};};
export function createCameraAssistState():CameraAssistState{return {lockedTargetId:null,shoulderSide:1,reticleOffset:{x:0,y:0,z:0}};}
/** Selects the best visible target inside a forward cone. Host must provide actual LOS/raycast results. */
export function acquireCameraTarget(origin:Vec3,forward:Vec3,candidates:readonly CameraTargetCandidate[],options:CameraAssistOptions={}):string|null {
 const maxDistance=clamp(options.maxAcquireDistance??28,1,200),maxAngle=clamp(options.maxAngleRadians??1.0,0.05,Math.PI),f=normalize(forward);
 let best:{id:string;score:number}|null=null;
 for(const c of candidates){if(!c.id||c.visible===false||c.alive===false)continue;const delta=sub(c.position,origin),distance=length(delta);if(!Number.isFinite(distance)||distance>maxDistance||distance<0.001)continue;
 const alignment=clamp(dot(f,normalize(delta)),-1,1),angle=Math.acos(alignment);if(angle>maxAngle)continue;
 const score=(alignment*3)-(distance/maxDistance)+(clamp(c.priority??0,-5,5)*0.12);if(!best||score>best.score)best={id:c.id,score};}
 return best?.id??null;
}
/** Retains lock only while the target remains valid, visible, and within a larger hysteresis radius. */
export function validateCameraTargetLock(state:CameraAssistState,origin:Vec3,candidates:readonly CameraTargetCandidate[],options:CameraAssistOptions={}):CameraAssistState {
 if(!state.lockedTargetId)return state;const c=candidates.find(x=>x.id===state.lockedTargetId);const max=clamp(options.maxRetainDistance??36,1,250);
 if(!c||c.visible===false||c.alive===false||length(sub(c.position,origin))>max)return {...state,lockedTargetId:null};return state;
}
export function cycleCameraTarget(currentId:string|null,candidates:readonly CameraTargetCandidate[]):string|null {
 const valid=candidates.filter(c=>c.id&&c.visible!==false&&c.alive!==false).slice().sort((a,b)=>a.id.localeCompare(b.id));if(!valid.length)return null;const i=valid.findIndex(c=>c.id===currentId);return valid[(i+1+valid.length)%valid.length].id;
}
export function swapCameraShoulder(state:CameraAssistState):CameraAssistState{return {...state,shoulderSide:state.shoulderSide===1?-1:1};}
/** Apply left/right shoulder to the rig; first-person and map cameras should ignore this helper. */
export function applyCameraShoulder(rig:CameraRigState,side:1|-1,mode:'exploration'|'combat'|'aim'|'first-person'|'cinematic'|'photo'|'map'|'vehicle'):CameraRigState {
 if(mode==='first-person'||mode==='map')return rig;return {...rig,shoulder:Math.abs(finite(rig.shoulder))*side};
}
/** Computes a stable look point for lock-on; optional target velocity lets the host lead moving targets. */
export function buildCameraLockLookAt(target:Vec3,velocity:Vec3={x:0,y:0,z:0},options:CameraAssistOptions={}):Vec3 {
 const lead=clamp(options.leadSeconds??0,0,0.8);return {x:finite(target.x)+finite(velocity.x)*lead,y:finite(target.y)+Math.max(-2,Math.min(4,finite(options.targetHeight??0.8)))+finite(velocity.y)*lead,z:finite(target.z)+finite(velocity.z)*lead};
}
/** Nudges an existing pose toward a locked target without changing the camera's collision-resolved position. */
export function applyCameraLockPose(pose:CameraPose,target:Vec3,velocity?:Vec3,options:CameraAssistOptions={}):CameraPose {
 return {...pose,lookAt:buildCameraLockLookAt(target,velocity,options)};
}
