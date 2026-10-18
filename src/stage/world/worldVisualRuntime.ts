// @ts-nocheck -- ported verbatim from the standalone Stage 9-16 packages; not yet type-checked against this repo (no tsc available when imported)
/**
 * World Fracture visual runtime contracts.
 * Pure data/math: the host R3F renderer must map these values to actual lights,
 * fog, tone mapping, material instances, weather particles and post-processing.
 */
export type WorldRegionId = 'neon-city'|'nexus-city'|'verdant-forest'|'shrouded-swamps'|'ember-peaks'|'solara-desert'|'frost-spire'|'wastelands'|'thalassia'|'ocean-coast';
export type WeatherId = 'clear'|'rain'|'storm'|'fog'|'snow'|'ash'|'sandstorm'|'underwater';
export type QualityTier = 'low'|'balanced'|'high'|'cinematic';
export interface RGB { r:number; g:number; b:number }
export interface VisualRegionProfile {
  id: WorldRegionId; label: string; baseFog: number; fogColor: RGB; ambient: number;
  keyLight: number; exposure: number; saturation: number; wetness: number;
  wind: number; fractureGlow: number; cloudDensity: number; weather: WeatherId[];
  materialTags: string[]; signature: string;
}
export const WORLD_VISUAL_PROFILES: VisualRegionProfile[] = [
 {id:'neon-city',label:'Neon City',baseFog:0.018,fogColor:{r:0.055,g:0.075,b:0.12},ambient:0.38,keyLight:2.6,exposure:1.02,saturation:1.14,wetness:0.35,wind:0.22,fractureGlow:0.72,cloudDensity:0.46,weather:['clear','rain','storm','fog'],materialTags:['wet-asphalt','neon-glass','brushed-alloy','fabric-armor'],signature:'rain-slick streets, volumetric signage, violet fracture reflections'},
 {id:'nexus-city',label:'Nexus City',baseFog:0.012,fogColor:{r:0.09,g:0.12,b:0.17},ambient:0.48,keyLight:3.1,exposure:1.04,saturation:0.96,wetness:0.08,wind:0.18,fractureGlow:0.42,cloudDensity:0.28,weather:['clear','rain','fog'],materialTags:['architectural-glass','ceramic-alloy','polished-stone','fabric-armor'],signature:'monumental clean silhouettes, reflective glass and controlled highlights'},
 {id:'verdant-forest',label:'Verdant Forest',baseFog:0.026,fogColor:{r:0.12,g:0.2,b:0.13},ambient:0.42,keyLight:3.5,exposure:1.0,saturation:1.08,wetness:0.2,wind:0.48,fractureGlow:0.34,cloudDensity:0.38,weather:['clear','rain','storm','fog'],materialTags:['bark','leaf-translucency','moss','skin','hair','fabric-armor'],signature:'layered canopy, sun shafts, moving foliage and humid ground haze'},
 {id:'shrouded-swamps',label:'Shrouded Swamps',baseFog:0.052,fogColor:{r:0.12,g:0.18,b:0.16},ambient:0.32,keyLight:2.0,exposure:0.94,saturation:0.84,wetness:0.9,wind:0.16,fractureGlow:0.55,cloudDensity:0.74,weather:['fog','rain','storm'],materialTags:['black-water','mud','wet-bark','fungal-emission','fabric-armor'],signature:'volumetric ground mist, oily water reflections, bioluminescent pockets'},
 {id:'ember-peaks',label:'Ember Peaks',baseFog:0.021,fogColor:{r:0.22,g:0.09,b:0.055},ambient:0.3,keyLight:3.8,exposure:1.03,saturation:1.05,wetness:0.03,wind:0.58,fractureGlow:0.64,cloudDensity:0.58,weather:['clear','storm','ash'],materialTags:['basalt','volcanic-glass','ember-particles','scorched-metal','fabric-armor'],signature:'heat shimmer, drifting ash, lava bounce light and sharp ridge silhouettes'},
 {id:'solara-desert',label:'Solara Desert',baseFog:0.009,fogColor:{r:0.55,g:0.35,b:0.19},ambient:0.52,keyLight:4.2,exposure:1.08,saturation:1.02,wetness:0,wind:0.62,fractureGlow:0.48,cloudDensity:0.1,weather:['clear','sandstorm'],materialTags:['sandstone','fine-sand','sun-bleached-fabric','dragonite','skin','hair'],signature:'long hard shadows, heat haze, fine wind-carried sand and gold rim light'},
 {id:'frost-spire',label:'Frost Spire',baseFog:0.024,fogColor:{r:0.52,g:0.65,b:0.75},ambient:0.55,keyLight:3.2,exposure:1.02,saturation:0.86,wetness:0.12,wind:0.78,fractureGlow:0.46,cloudDensity:0.62,weather:['clear','snow','storm','fog'],materialTags:['packed-snow','ice-transmission','frosted-metal','breath-vapor','fabric-armor'],signature:'crystalline ice glints, wind-driven snow, blue shadow fill and breath vapor'},
 {id:'wastelands',label:'Wastelands',baseFog:0.018,fogColor:{r:0.28,g:0.22,b:0.16},ambient:0.36,keyLight:3.6,exposure:1.0,saturation:0.78,wetness:0.02,wind:0.7,fractureGlow:0.28,cloudDensity:0.24,weather:['clear','storm','ash','sandstorm'],materialTags:['oxidized-metal','cracked-concrete','dust','scrap-fabric','leather','skin'],signature:'dust layers, sun-bleached wrecks, rust roughness and distant mirage'},
 {id:'thalassia',label:'Thalassia',baseFog:0.06,fogColor:{r:0.025,g:0.18,b:0.25},ambient:0.4,keyLight:2.4,exposure:0.96,saturation:1.04,wetness:1,wind:0.08,fractureGlow:0.58,cloudDensity:0.2,weather:['underwater'],materialTags:['pressure-glass','coral','marine-metal','caustics','suspended-particles'],signature:'depth falloff, animated caustics, suspended particles and distant habitat glow'},
 {id:'ocean-coast',label:'Ocean Coast',baseFog:0.018,fogColor:{r:0.14,g:0.3,b:0.39},ambient:0.52,keyLight:3.7,exposure:1.02,saturation:1.02,wetness:0.28,wind:0.62,fractureGlow:0.22,cloudDensity:0.34,weather:['clear','rain','storm','fog'],materialTags:['ocean-water','wet-rock','salt-weathered-metal','foam','wet-sand'],signature:'shoreline foam, wave highlights, sea spray and distance haze'}
];
export interface MaterialProfile { id:string; roughness:number; metalness:number; clearcoat:number; clearcoatRoughness:number; transmission:number; ior:number; sheen:number; sheenRoughness:number; normalStrength:number; displacement:number; emissive:number; alphaCutoff?:number; notes:string }
export const PRODUCTION_MATERIALS: MaterialProfile[] = [
 {id:'armor-fabric',roughness:.78,metalness:.04,clearcoat:.08,clearcoatRoughness:.6,transmission:0,ior:1.45,sheen:.42,sheenRoughness:.72,normalStrength:.85,displacement:.08,emissive:0,notes:'woven micro-normal, seam masks, dirt/wear masks; preserve silhouette readability'},
 {id:'brushed-alloy',roughness:.34,metalness:.88,clearcoat:.22,clearcoatRoughness:.28,transmission:0,ior:1.5,sheen:0,sheenRoughness:.5,normalStrength:.55,displacement:.02,emissive:0,notes:'anisotropic brushed direction where supported; edge wear driven by masks'},
 {id:'skin',roughness:.48,metalness:0,clearcoat:.04,clearcoatRoughness:.5,transmission:.04,ior:1.4,sheen:.12,sheenRoughness:.62,normalStrength:.35,displacement:.01,emissive:0,notes:'subsurface approximation, pore detail and roughness variation; avoid waxy highlights'},
 {id:'hair',roughness:.38,metalness:0,clearcoat:.16,clearcoatRoughness:.3,transmission:0,ior:1.46,sheen:.24,sheenRoughness:.42,normalStrength:.42,displacement:.01,emissive:0,alphaCutoff:.42,notes:'strand cards or groom with correct alpha sorting and anisotropic highlights'},
 {id:'foliage',roughness:.72,metalness:0,clearcoat:.02,clearcoatRoughness:.7,transmission:.12,ior:1.38,sheen:.08,sheenRoughness:.7,normalStrength:.62,displacement:.04,emissive:0,alphaCutoff:.38,notes:'two-sided leaf shading, wind vertex animation, LOD and shadow budget'},
 {id:'wet-asphalt',roughness:.22,metalness:.12,clearcoat:.68,clearcoatRoughness:.14,transmission:0,ior:1.48,sheen:0,sheenRoughness:.5,normalStrength:.7,displacement:.01,emissive:0,notes:'puddle masks and roughness breakup; reflections must be performance-budgeted'},
 {id:'architectural-glass',roughness:.08,metalness:.18,clearcoat:.75,clearcoatRoughness:.08,transmission:.72,ior:1.5,sheen:0,sheenRoughness:.5,normalStrength:.08,displacement:0,emissive:.02,notes:'use selective transmission; distant windows should use cheaper baked/reflection impostors'},
 {id:'water-surface',roughness:.12,metalness:.04,clearcoat:.86,clearcoatRoughness:.08,transmission:.3,ior:1.333,sheen:0,sheenRoughness:.5,normalStrength:.5,displacement:.12,emissive:0,notes:'multi-scale normals, depth tint, shore foam and restrained screen-space reflections'},
 {id:'snow-ice',roughness:.3,metalness:.02,clearcoat:.24,clearcoatRoughness:.18,transmission:.08,ior:1.31,sheen:.16,sheenRoughness:.45,normalStrength:.72,displacement:.06,emissive:0,notes:'separate powder snow from hard ice; sparkle only at grazing angles'},
 {id:'fracture-energy',roughness:.24,metalness:.18,clearcoat:.32,clearcoatRoughness:.16,transmission:.18,ior:1.45,sheen:.12,sheenRoughness:.3,normalStrength:.35,displacement:.02,emissive:2.4,notes:'emission pulses, depth-aware particles, chromatic split reserved for close events'}
];
export interface QualityBudget { pixelRatio:number; shadows:'off'|'low'|'high'|'ultra'; shadowMapSize:number; maxDynamicLights:number; volumetrics:boolean; ssr:boolean; bloom:boolean; foliageDensity:number; particleScale:number; reflectionUpdatesPerSecond:number; lodBias:number }
export const QUALITY_BUDGETS:Record<QualityTier,QualityBudget> = {
 low:{pixelRatio:1,shadows:'low',shadowMapSize:1024,maxDynamicLights:2,volumetrics:false,ssr:false,bloom:false,foliageDensity:.45,particleScale:.35,reflectionUpdatesPerSecond:2,lodBias:1.6},
 balanced:{pixelRatio:1.25,shadows:'high',shadowMapSize:2048,maxDynamicLights:4,volumetrics:false,ssr:false,bloom:true,foliageDensity:.7,particleScale:.65,reflectionUpdatesPerSecond:5,lodBias:1},
 high:{pixelRatio:1.6,shadows:'high',shadowMapSize:3072,maxDynamicLights:6,volumetrics:true,ssr:true,bloom:true,foliageDensity:1,particleScale:1,reflectionUpdatesPerSecond:10,lodBias:.45},
 cinematic:{pixelRatio:2,shadows:'ultra',shadowMapSize:4096,maxDynamicLights:10,volumetrics:true,ssr:true,bloom:true,foliageDensity:1.2,particleScale:1.35,reflectionUpdatesPerSecond:15,lodBias:0}
};
export interface VisualFrameInput { regionId:WorldRegionId; weather:WeatherId; timeOfDay:number; fractureIntensity:number; quality:QualityTier; deltaSeconds:number }
export interface VisualFrame { region:VisualRegionProfile; quality:QualityBudget; fogDensity:number; fogColor:RGB; ambientIntensity:number; keyLightIntensity:number; exposure:number; saturation:number; wetness:number; wind:number; fractureGlow:number; cloudDensity:number; rainOpacity:number; snowOpacity:number; ashOpacity:number; sandOpacity:number; lightningFlash:number; timeBlend:number }
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const mixRgb=(a:RGB,b:RGB,t:number):RGB=>({r:mix(a.r,b.r,t),g:mix(a.g,b.g,t),b:mix(a.b,b.b,t)});
export function getVisualRegion(id:WorldRegionId):VisualRegionProfile { return WORLD_VISUAL_PROFILES.find(p=>p.id===id) ?? WORLD_VISUAL_PROFILES[0]; }
export function buildVisualFrame(input:VisualFrameInput):VisualFrame {
 const region=getVisualRegion(input.regionId), quality=QUALITY_BUDGETS[input.quality] ?? QUALITY_BUDGETS.balanced;
 const t=((input.timeOfDay%24)+24)%24, daylight=clamp(Math.sin(((t-6)/12)*Math.PI),0,1), night=1-daylight;
 const allowed=region.weather.includes(input.weather), weather=allowed?input.weather:'clear';
 const storm=weather==='storm'?1:0, rain=weather==='rain'||storm?1:0, fog=weather==='fog'?1:0, snow=weather==='snow'?1:0, ash=weather==='ash'?1:0, sand=weather==='sandstorm'?1:0, underwater=weather==='underwater'?1:0;
 const intensity=clamp(input.fractureIntensity,0,1), dt=clamp(input.deltaSeconds,0,.1);
 // Deterministic frame-level flash envelope; host may override with authored lightning events.
 const flash=storm?Math.max(0,Math.sin(t*91.7)*Math.sin(t*17.3))*.45:0;
 const fogDensity=Math.max(.001,region.baseFog*(1+fog*1.8+storm*.65+underwater*1.6+sand*.55+snow*.2));
 const nightTint:RGB={r:region.fogColor.r*.78,g:region.fogColor.g*.84,b:Math.min(1,region.fogColor.b*1.18+.025)};
 return {region,quality,fogDensity,fogColor:mixRgb(region.fogColor,nightTint,night*.72),ambientIntensity:clamp(region.ambient*(.72+daylight*.48)+underwater*.08,.08,1.5),keyLightIntensity:clamp(region.keyLight*(.18+daylight*.82)+flash*4,0,8),exposure:clamp(region.exposure-night*.12+flash*.18,.65,1.4),saturation:clamp(region.saturation-ash*.12-sand*.08,0,1.4),wetness:clamp(Math.max(region.wetness,rain*.82,storm*.95),0,1),wind:clamp(region.wind+storm*.28+snow*.12+sand*.25,0,1.5),fractureGlow:clamp(region.fractureGlow+intensity*.9,0,2),cloudDensity:clamp(region.cloudDensity+storm*.32+fog*.18,0,1),rainOpacity:rain*(.25+storm*.5)*quality.particleScale,snowOpacity:snow*.8*quality.particleScale,ashOpacity:ash*.65*quality.particleScale,sandOpacity:sand*.72*quality.particleScale,lightningFlash:flash,timeBlend:clamp(dt*10,0,1)};
}
export function validateMaterialProfile(profile:MaterialProfile):string[] {
 const issues:string[]=[];
 for(const key of ['roughness','metalness','clearcoat','clearcoatRoughness','transmission','sheen','sheenRoughness','normalStrength','displacement'] as const){const v=profile[key];if(!Number.isFinite(v)||v<0||v>1)issues.push(`${key} must be between 0 and 1`);}
 if(!Number.isFinite(profile.emissive)||profile.emissive<0||profile.emissive>8)issues.push('emissive must be between 0 and 8');
 if(profile.metalness>.65&&profile.transmission>.4)issues.push('high metalness and high transmission are usually physically inconsistent');
 return issues;
}
