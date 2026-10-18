// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import { applyCameraLook, blendCameraPose, buildWorldCameraPose, createCameraRigState, WORLD_CAMERA_PRESETS, type CameraPose, type CameraRigState, type WorldCameraMode } from './worldCameraSystem';
import type { Vec3 } from '../vehicles/vehicleWorldAdapter';

export interface CameraContext {
  combat?: boolean; aiming?: boolean; firstPerson?: boolean; cinematic?: boolean;
  photo?: boolean; map?: boolean; inVehicle?: boolean; underwater?: boolean;
}
export interface StandardGamepadLike { axes?: readonly number[]; buttons?: readonly ({ value?: number; pressed?: boolean } | number)[]; }
export interface CameraCollisionHit { point: Vec3; distance: number; }
export interface CameraRuntimeState { mode: WorldCameraMode; rig: CameraRigState; pose: CameraPose; transitionFrom?: CameraPose; transitionElapsed: number; transitionDuration: number; }
export interface CameraFrameInput {
  target: Vec3; heading: number; deltaSeconds: number; context?: CameraContext;
  gamepad?: StandardGamepadLike | null; sensitivity?: number; invertY?: boolean; zoom?: number;
  /** Optional host-provided raycast result from target toward desired camera position. */ obstruction?: CameraCollisionHit | null;
  /** Optional sampled ground/water floor; camera is kept above it by clearance. */ floorHeight?: number;
  clearance?: number; transitionDuration?: number; lookAhead?: number;
}
const finite=(n:number,f=0)=>Number.isFinite(n)?n:f;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,finite(n,a)));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const vecMix=(a:Vec3,b:Vec3,t:number):Vec3=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t)});
function buttonValue(pad:StandardGamepadLike|undefined|null,index:number):number { const b=pad?.buttons?.[index]; if(typeof b==='number')return clamp(b,0,1); return clamp(b?.value??(b?.pressed?1:0),0,1); }
/** Standard gamepad right stick (axes 2/3) -> camera look. The host owns polling and deadzone policy. */
export function readCameraGamepad(pad?:StandardGamepadLike|null, deadzone=0.14):{lookX:number;lookY:number;zoom:number} {
 const dz=clamp(deadzone,0,0.5); const clean=(v:number)=>{v=clamp(v,-1,1);return Math.abs(v)<dz?0:Math.sign(v)*(Math.abs(v)-dz)/(1-dz)};
 return {lookX:clean(finite(pad?.axes?.[2]??0)),lookY:clean(finite(pad?.axes?.[3]??0)),zoom:buttonValue(pad,12)-buttonValue(pad,13)};
}
export function selectWorldCameraMode(context:CameraContext={}):WorldCameraMode {
 if(context.cinematic)return 'cinematic'; if(context.map)return 'map'; if(context.photo)return 'photo'; if(context.firstPerson)return 'first-person'; if(context.aiming)return 'aim'; if(context.inVehicle)return 'vehicle'; if(context.underwater)return 'cinematic'; if(context.combat)return 'combat'; return 'exploration';
}
/** Pulls the camera inward when the host raycast reports an obstruction between target and desired position. */
export function resolveCameraObstruction(pose:CameraPose, target:Vec3, hit?:CameraCollisionHit|null, clearance=0.22):CameraPose {
 if(!hit||!Number.isFinite(hit.distance)||hit.distance<0)return pose;
 const dx=pose.position.x-target.x,dy=pose.position.y-target.y,dz=pose.position.z-target.z;
 const length=Math.hypot(dx,dy,dz)||1; const allowed=Math.max(0.12,Math.min(length,hit.distance-Math.max(0,finite(clearance,0.22))));
 const scale=allowed/length;
 return {...pose,position:{x:target.x+dx*scale,y:target.y+dy*scale,z:target.z+dz*scale},distance:Math.min(pose.distance,allowed)};
}
export function clampCameraAboveFloor(pose:CameraPose,floorHeight?:number,clearance=0.35):CameraPose {
 if(floorHeight===undefined||!Number.isFinite(floorHeight))return pose;
 const minY=floorHeight+Math.max(0.05,finite(clearance,0.35));
 if(pose.position.y>=minY)return pose;
 return {...pose,position:{...pose.position,y:minY}};
}
export function createCameraRuntime(target:Vec3,heading=0,mode:WorldCameraMode='exploration'):CameraRuntimeState {
 const rig=createCameraRigState(mode,heading); const pose=buildWorldCameraPose({target,rig,mode});
 return {mode,rig,pose,transitionElapsed:0,transitionDuration:0};
}
/** Pure per-frame camera adapter. Host must apply returned pose to its R3F camera and supply real collision/floor samples. */
export function stepWorldCamera(state:CameraRuntimeState,input:CameraFrameInput):CameraRuntimeState {
 const dt=clamp(input.deltaSeconds,0,0.1); const mode=selectWorldCameraMode(input.context); let rig=state.rig;
 if(mode!==state.mode){ const preset=WORLD_CAMERA_PRESETS[mode]; rig={...rig,pitch:preset.pitch,distance:preset.distance,shoulder:preset.shoulder,targetHeight:preset.targetHeight,fov:preset.fov,yaw:finite(input.heading)+preset.yawOffset}; }
 const gp=readCameraGamepad(input.gamepad); rig=applyCameraLook(rig,{lookX:gp.lookX,lookY:gp.lookY,zoom:finite(input.zoom)+gp.zoom,deltaSeconds:dt,sensitivity:input.sensitivity,invertY:input.invertY,minDistance:mode==='first-person'?0.05:0.7,maxDistance:mode==='map'?80:45});
 // Map mode is intentionally steep; don't let normal look input flatten it excessively.
 if(mode==='map')rig={...rig,pitch:clamp(rig.pitch,-1.45,-0.75)};
 let desired=buildWorldCameraPose({target:input.target,rig,mode,targetForward:input.heading,lookAhead:input.lookAhead});
 desired=resolveCameraObstruction(desired,input.target,input.obstruction,input.clearance);
 desired=clampCameraAboveFloor(desired,input.floorHeight,input.clearance);
 let transitionFrom=state.transitionFrom,elapsed=state.transitionElapsed,duration=state.transitionDuration;
 if(mode!==state.mode){transitionFrom=state.pose;elapsed=0;duration=clamp(input.transitionDuration??0.24,0,3);}
 let pose=desired;
 if(transitionFrom&&duration>0&&elapsed<duration){elapsed=Math.min(duration,elapsed+dt);pose=blendCameraPose(transitionFrom,desired,elapsed/duration);}
 if(!transitionFrom||duration===0||elapsed>=duration)transitionFrom=undefined;
 return {mode,rig,pose,transitionFrom,transitionElapsed:elapsed,transitionDuration:duration};
}
/** Smooths an applied camera toward the runtime pose with frame-rate-independent exponential damping. */
export function dampCameraPose(current:CameraPose,target:CameraPose,deltaSeconds:number,sharpness=12):CameraPose {
 const alpha=1-Math.exp(-clamp(sharpness,0.1,40)*clamp(deltaSeconds,0,0.1));
 const blended=blendCameraPose(current,target,alpha);
 return {...blended,position:vecMix(current.position,target.position,alpha),lookAt:vecMix(current.lookAt,target.lookAt,alpha)};
}
