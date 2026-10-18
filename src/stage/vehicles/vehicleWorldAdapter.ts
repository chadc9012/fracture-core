// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
import type { VehicleClass, VehicleMode, VehicleMotion, VehicleTuning } from './vehicleDynamics';
import { VEHICLE_TUNING_PRESETS } from './vehicleDynamics';

export interface Vec3 { x:number; y:number; z:number }
export interface VehicleTransform { position:Vec3; rotation:Vec3; velocity:Vec3 }
export type SurfaceKind = 'road'|'concrete'|'dirt'|'sand'|'mud'|'ice'|'snow'|'grass'|'shallow-water'|'deep-water'|'underwater'|'runway';
export interface SurfaceProfile { kind:SurfaceKind; grip:number; supportsGroundVehicle:boolean; supportsBoat:boolean; supportsSubmersible:boolean; }
export const SURFACE_PROFILES:Record<SurfaceKind,SurfaceProfile> = {
 road:{kind:'road',grip:1.12,supportsGroundVehicle:true,supportsBoat:false,supportsSubmersible:false},
 concrete:{kind:'concrete',grip:1.05,supportsGroundVehicle:true,supportsBoat:false,supportsSubmersible:false},
 dirt:{kind:'dirt',grip:0.88,supportsGroundVehicle:true,supportsBoat:false,supportsSubmersible:false},
 sand:{kind:'sand',grip:0.64,supportsGroundVehicle:true,supportsBoat:false,supportsSubmersible:false},
 mud:{kind:'mud',grip:0.48,supportsGroundVehicle:true,supportsBoat:false,supportsSubmersible:false},
 ice:{kind:'ice',grip:0.22,supportsGroundVehicle:true,supportsBoat:false,supportsSubmersible:false},
 snow:{kind:'snow',grip:0.52,supportsGroundVehicle:true,supportsBoat:false,supportsSubmersible:false},
 grass:{kind:'grass',grip:0.76,supportsGroundVehicle:true,supportsBoat:false,supportsSubmersible:false},
 'shallow-water':{kind:'shallow-water',grip:0.3,supportsGroundVehicle:false,supportsBoat:true,supportsSubmersible:false},
 'deep-water':{kind:'deep-water',grip:0.8,supportsGroundVehicle:false,supportsBoat:true,supportsSubmersible:true},
 underwater:{kind:'underwater',grip:0.85,supportsGroundVehicle:false,supportsBoat:false,supportsSubmersible:true},
 runway:{kind:'runway',grip:1.08,supportsGroundVehicle:true,supportsBoat:false,supportsSubmersible:false},
};
export function getSurfaceGrip(surface:SurfaceKind):number { return SURFACE_PROFILES[surface].grip; }

/** Converts the shared simulation state into a host-friendly R3F/world transform. Heading zero points down +Z. */
export function motionToWorldTransform(motion:VehicleMotion,position:Vec3,deltaSeconds:number):VehicleTransform {
 const dt=Math.max(0,Math.min(Number.isFinite(deltaSeconds)?deltaSeconds:0,1/15));
 const speed=Number.isFinite(motion.speed)?motion.speed:0; const heading=Number.isFinite(motion.heading)?motion.heading:0;
 const verticalSpeed=Number.isFinite(motion.verticalSpeed)?motion.verticalSpeed:0;
 return {position:{x:position.x+Math.sin(heading)*speed*dt,y:position.y+verticalSpeed*dt,z:position.z+Math.cos(heading)*speed*dt},rotation:{x:motion.pitch||0,y:heading,z:motion.roll||0},velocity:{x:Math.sin(heading)*speed,y:verticalSpeed,z:Math.cos(heading)*speed}};
}
export interface GarageVehicle { id:string; vehicleClass:VehicleClass; garageId:string; }
export type VehicleSpawnResult = { ok:true; vehicle:GarageVehicle; position:Vec3; heading:number } | { ok:false; reason:'vehicle-not-owned'|'not-stored-in-garage'|'garage-unavailable'|'invalid-spawn' }
export function spawnOwnedGarageVehicle(input:{vehicleId:string;ownedVehicles:readonly GarageVehicle[];availableGarageIds:readonly string[];spawnPosition?:Vec3;heading?:number}):VehicleSpawnResult {
 const vehicle=input.ownedVehicles.find(v=>v.id===input.vehicleId);
 if(!vehicle)return {ok:false,reason:'vehicle-not-owned'};
 if(!input.availableGarageIds.includes(vehicle.garageId))return {ok:false,reason:'garage-unavailable'};
 if(!input.spawnPosition||![input.spawnPosition.x,input.spawnPosition.y,input.spawnPosition.z].every(Number.isFinite))return {ok:false,reason:'invalid-spawn'};
 return {ok:true,vehicle,position:{...input.spawnPosition},heading:Number.isFinite(input.heading)?input.heading!:0};
}
export type VehicleCameraMode='chase'|'cockpit'|'overhead'|'submersible-follow';
export interface VehicleCameraConfig { mode:VehicleCameraMode; offset:Vec3; lookAhead:number; fov:number; }
export function vehicleCameraConfig(vehicleClass:VehicleClass,mode:VehicleCameraMode='chase'):VehicleCameraConfig {
 const resolved:VehicleCameraMode=vehicleClass==='submarine'&&mode==='chase'?'submersible-follow':mode;
 const offsets:Record<VehicleCameraMode,Vec3>={chase:{x:0,y:3.2,z:-8},cockpit:{x:0,y:1.15,z:0.35},overhead:{x:0,y:12,z:-2},'submersible-follow':{x:0,y:2.4,z:-6}};
 return {mode:resolved,offset:{...offsets[resolved]},lookAhead:resolved==='cockpit'?16:Math.max(4,Math.abs(VEHICLE_TUNING_PRESETS[vehicleClass].maxForwardSpeed)*0.16),fov:resolved==='cockpit'?78:resolved==='overhead'?62:74};
}
export type VehicleTransition = 'blocked'|'grounded'|'takeoff-ready'|'airborne'|'landing'|'landed'|'enter-water'|'underwater'|'surface-water';
export interface VehicleWorldState { mode:VehicleMode; airborne:boolean; landingGearDown:boolean; depth:number; grounded:boolean; }
export function resolveVehicleWorldTransition(input:{vehicleClass:VehicleClass;state:VehicleWorldState;surface:SurfaceKind;verticalSpeed:number;nearRunway?:boolean;waterDepth?:number;requestTakeoff?:boolean;requestLand?:boolean}):{transition:VehicleTransition;state:VehicleWorldState;reason?:string} {
 const state={...input.state}; const preset:VehicleTuning=VEHICLE_TUNING_PRESETS[input.vehicleClass];
 if(preset.mode==='air'){
  if(input.requestTakeoff&&!state.airborne){if(!input.nearRunway)return {transition:'blocked',state,reason:'takeoff-requires-runway-or-approved-pad'};state.airborne=true;state.grounded=false;state.landingGearDown=false;return {transition:'airborne',state};}
  if(input.requestLand&&state.airborne){if(!input.nearRunway)return {transition:'blocked',state,reason:'landing-requires-runway-or-approved-pad'};state.landingGearDown=true;return {transition:'landing',state};}
  if(state.airborne&&state.landingGearDown&&input.nearRunway&&Math.abs(input.verticalSpeed)<2.2){state.airborne=false;state.grounded=true;return {transition:'landed',state};}
  return {transition:state.airborne?'airborne':'takeoff-ready',state};
 }
 if(preset.mode==='water'){
  if(input.surface==='shallow-water'||input.surface==='deep-water')return {transition:'surface-water',state};
  return {transition:'blocked',state,reason:'boat-requires-water-surface'};
 }
 if(preset.mode==='submersible'){
  if(input.surface==='underwater'||input.surface==='deep-water') {state.depth=Math.max(0,input.waterDepth??state.depth);return {transition:'underwater',state};}
  if(input.surface==='shallow-water')return {transition:'blocked',state,reason:'submersible-requires-sufficient-water-depth'};
  return {transition:'blocked',state,reason:'submersible-must-launch-from-water'};
 }
 if(input.surface==='shallow-water'||input.surface==='deep-water'||input.surface==='underwater')return {transition:'blocked',state,reason:'ground-vehicle-cannot-drive-on-open-water'};
 if(!SURFACE_PROFILES[input.surface].supportsGroundVehicle)return {transition:'blocked',state,reason:'unsupported-ground-surface'};
 state.grounded=true;state.airborne=false;return {transition:'grounded',state};
}
