// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import type { Vec3 } from '../vehicles/vehicleWorldAdapter';
export type WorldCameraMode = 'exploration'|'combat'|'aim'|'first-person'|'cinematic'|'photo'|'map'|'vehicle';
export type CameraShot = 'hero-wide'|'low-angle'|'over-shoulder'|'high-establishing'|'orbit-inspect'|'side-track'|'top-down'|'underwater-drift';
export interface CameraPose { position: Vec3; lookAt: Vec3; yaw: number; pitch: number; distance: number; fov: number; mode: WorldCameraMode; shot?: CameraShot; }
export interface CameraPreset { mode: WorldCameraMode; yawOffset: number; pitch: number; distance: number; shoulder: number; targetHeight: number; fov: number; lookAhead: number; }
export interface CameraRigState { yaw: number; pitch: number; distance: number; shoulder: number; targetHeight: number; fov: number; }
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:min));
const finite=(v:number,fallback=0)=>Number.isFinite(v)?v:fallback;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const angleLerp=(a:number,b:number,t:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export const WORLD_CAMERA_PRESETS: Record<WorldCameraMode, CameraPreset> = {
 exploration:{mode:'exploration',yawOffset:0,pitch:-0.16,distance:5.8,shoulder:0.42,targetHeight:1.55,fov:68,lookAhead:1.4},
 combat:{mode:'combat',yawOffset:0,pitch:-0.12,distance:4.1,shoulder:0.72,targetHeight:1.45,fov:72,lookAhead:2.2},
 aim:{mode:'aim',yawOffset:0,pitch:-0.04,distance:2.25,shoulder:0.9,targetHeight:1.48,fov:54,lookAhead:8},
 'first-person':{mode:'first-person',yawOffset:0,pitch:0,distance:0.06,shoulder:0,targetHeight:1.68,fov:82,lookAhead:18},
 cinematic:{mode:'cinematic',yawOffset:0.18,pitch:-0.23,distance:8.5,shoulder:0.1,targetHeight:1.7,fov:48,lookAhead:4},
 photo:{mode:'photo',yawOffset:0.4,pitch:-0.2,distance:7.5,shoulder:0,targetHeight:1.6,fov:42,lookAhead:0},
 map:{mode:'map',yawOffset:0,pitch:-1.18,distance:28,shoulder:0,targetHeight:0,fov:58,lookAhead:0},
 vehicle:{mode:'vehicle',yawOffset:0,pitch:-0.1,distance:8,shoulder:0.25,targetHeight:1.2,fov:74,lookAhead:7},
};
/** Converts look deltas to a bounded camera state; the host owns input polling and inversion preferences. */
export function applyCameraLook(state:CameraRigState,input:{lookX?:number;lookY?:number;zoom?:number;deltaSeconds:number;sensitivity?:number;invertY?:boolean;minDistance?:number;maxDistance?:number}):CameraRigState {
 const dt=clamp(input.deltaSeconds,0,0.1), sensitivity=clamp(input.sensitivity??2.2,0.1,8), invert=input.invertY?-1:1;
 return {...state,yaw:finite(state.yaw)+finite(input.lookX)*sensitivity*dt,pitch:clamp(finite(state.pitch)+finite(input.lookY)*sensitivity*dt*invert,-1.35,0.75),distance:clamp(finite(state.distance)-finite(input.zoom)*dt*8,input.minDistance??0.05,input.maxDistance??60)};
}
export function createCameraRigState(mode:WorldCameraMode,heading=0,overrides:Partial<CameraRigState>={}):CameraRigState {const p=WORLD_CAMERA_PRESETS[mode];return {yaw:finite(heading)+p.yawOffset,pitch:p.pitch,distance:p.distance,shoulder:p.shoulder,targetHeight:p.targetHeight,fov:p.fov,...overrides};}
/** Builds a world-space orbit pose; the host camera manager applies it to the actual R3F camera. */
export function buildWorldCameraPose(input:{target:Vec3;rig:CameraRigState;mode:WorldCameraMode;targetForward?:number;lookAhead?:number}):CameraPose {
 const {target,rig,mode}=input,yaw=finite(rig.yaw),pitch=clamp(rig.pitch,-1.45,0.85),distance=clamp(rig.distance,0.05,100),horizontal=Math.cos(pitch)*distance;
 const position={x:target.x-Math.sin(yaw)*horizontal+Math.cos(yaw)*finite(rig.shoulder),y:target.y+finite(rig.targetHeight)-Math.sin(pitch)*distance,z:target.z-Math.cos(yaw)*horizontal-Math.sin(yaw)*finite(rig.shoulder)};
 const forward=finite(input.targetForward??yaw),ahead=clamp(input.lookAhead??WORLD_CAMERA_PRESETS[mode].lookAhead,0,50);
 const lookAt={x:target.x+Math.sin(forward)*ahead,y:target.y+finite(rig.targetHeight),z:target.z+Math.cos(forward)*ahead};
 return {position,lookAt,yaw,pitch,distance,fov:clamp(rig.fov,25,100),mode};
}
export function blendCameraPose(from:CameraPose,to:CameraPose,alpha:number):CameraPose {const t=clamp(alpha,0,1);return {position:{x:lerp(from.position.x,to.position.x,t),y:lerp(from.position.y,to.position.y,t),z:lerp(from.position.z,to.position.z,t)},lookAt:{x:lerp(from.lookAt.x,to.lookAt.x,t),y:lerp(from.lookAt.y,to.lookAt.y,t),z:lerp(from.lookAt.z,to.lookAt.z,t)},yaw:angleLerp(from.yaw,to.yaw,t),pitch:lerp(from.pitch,to.pitch,t),distance:lerp(from.distance,to.distance,t),fov:lerp(from.fov,to.fov,t),mode:t<1?from.mode:to.mode,shot:t<1?from.shot:to.shot};}
const SHOT_TUNING:Record<CameraShot,{yaw:number;pitch:number;distance:number;fov:number;targetHeight:number;shoulder:number}>={
 'hero-wide':{yaw:0.2,pitch:-0.2,distance:13,fov:42,targetHeight:1.7,shoulder:0},'low-angle':{yaw:0,pitch:0.12,distance:7.5,fov:38,targetHeight:2.2,shoulder:0},'over-shoulder':{yaw:0,pitch:-0.08,distance:3.1,fov:62,targetHeight:1.55,shoulder:0.85},'high-establishing':{yaw:0.45,pitch:-0.72,distance:34,fov:52,targetHeight:0,shoulder:0},'orbit-inspect':{yaw:0.8,pitch:-0.18,distance:5.5,fov:48,targetHeight:1.5,shoulder:0},'side-track':{yaw:Math.PI/2,pitch:-0.08,distance:9,fov:52,targetHeight:1.2,shoulder:0},'top-down':{yaw:0,pitch:-1.35,distance:18,fov:58,targetHeight:0,shoulder:0},'underwater-drift':{yaw:0.25,pitch:-0.16,distance:11,fov:56,targetHeight:0.5,shoulder:0}};
export function buildCameraShot(input:{target:Vec3;heading?:number;shot:CameraShot}):CameraPose {const s=SHOT_TUNING[input.shot],rig:CameraRigState={yaw:finite(input.heading)+s.yaw,pitch:s.pitch,distance:s.distance,shoulder:s.shoulder,targetHeight:s.targetHeight,fov:s.fov};const mode:WorldCameraMode=input.shot==='orbit-inspect'?'photo':input.shot==='over-shoulder'?'combat':input.shot==='top-down'||input.shot==='high-establishing'?'map':'cinematic';return {...buildWorldCameraPose({target:input.target,rig,mode,targetForward:finite(input.heading),lookAhead:input.shot==='hero-wide'?3:input.shot==='underwater-drift'?1:0}),shot:input.shot};}
export const WORLD_LANDMARK_SHOTS={neonCity:['hero-wide','low-angle','high-establishing','side-track'],aegisSpire:['low-angle','hero-wide','high-establishing'],verdantForest:['hero-wide','orbit-inspect','side-track'],thalassia:['underwater-drift','hero-wide','high-establishing'],solaraDesert:['hero-wide','low-angle','high-establishing'],frostSpire:['hero-wide','low-angle','orbit-inspect'],wastelands:['side-track','hero-wide','high-establishing']} as const satisfies Record<string,readonly CameraShot[]>;
