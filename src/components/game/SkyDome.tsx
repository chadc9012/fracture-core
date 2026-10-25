import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SKY_BODY, SKY_RIFT, riftGlow, skyParams, type SkyLookId } from "@/game/sky-dome";
import type { SkyEnv } from "./CloudLayer";
import type { RenderTier } from "@/game/performance";

const VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`; // .xyww pins the dome to the far plane: the sphere (r 3000) is beyond camera far (1800), so unpinned it was clipped inside ~53 deg of the view axis and showed the plain background colour as a big pale circle

/** Procedural sky layer drawn over the atmospheric Sky: a sun disc with glow, lit volumetric-looking cumulus + high cirrus, stars and a Milky Way band.
 * The moon, halo and the extra starfield stay in SkyBodies. Everything is analytic (no textures), the dome is one draw call, and cloud octaves drop
 * on LOW so integrated GPUs keep their frame budget. Behind-terrain pixels are rejected by the depth test before the shader runs. */
const frag = (octaves: number) => /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 sunDir, sunColor, cloudLit, cloudShade, zenith, horizonCol, bodyDir;
uniform float wash, bodyRadius;
uniform float time, cover, night, sunStrength, starStrength, milkyWay;
uniform vec3 riftA, riftB; uniform float riftWidth, riftJag, riftGlow;
uniform float absorb, cirrusK, cloudScale, moonDay, riftK, crackGlow, nebula;
uniform vec3 crackCol, moonTint;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6); // x2 scale and a 37 degree turn per octave, so no octave lines up with the last (no square blocks)
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<${octaves};i++){ s += vn(p)*a; p = ROT * p + 7.1; a *= 0.5; } return s; }
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<3;i++){ s += vn(p)*a; p = ROT * p + 3.3; a *= 0.5; } return s; }
// 3D cell noise: distance to the nearest cell border (F2 - F1), for the moon's plate fractures
vec3 h33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float cellEdge(vec3 p){
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z)), o = h33(i + g);
    float dd = length(g + o - f);
    if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
  }
  return d2 - d1;
}
// cumulus density on the cloud plane: low-frequency coverage clusters the clouds into fields with clear gaps, a domain warp
// billows the edges, and a cauliflower detail erodes them
float cloudDens(vec2 p, float cov){
  float field = fbm3(p * 0.18 + 11.0);
  vec2 w = vec2(fbm3(p * 0.6), fbm3(p * 0.6 + 5.2)) - 0.5;
  float shape = fbm(p + w * 1.6);
  float c = shape * 0.74 + field * 0.34 - (fbm3(p * 4.3 + w * 3.0) - 0.45) * 0.2; // separate heaped clouds rather than sheets // small billows eat into the edges
  float thr = 0.71 - cov * 0.4;                    // cover 0.3 ~ a few fair-weather clouds, 0.9 ~ overcast
  return smoothstep(thr, thr + 0.055, c);
}
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

void main(){
  vec3 d = normalize(vDir);
  if (d.y < -0.02) discard;
  vec3 col = vec3(0.0); float alpha = 0.0; float moonMask = 0.0;

  // ---- authored colour wash over the physical sky: zenith to horizon ----
  float hz = pow(1.0 - clamp(d.y, 0.0, 1.0), 2.4);
  vec3 sunSide = mix(horizonCol, sunColor, pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-4), normalize(vec3(sunDir.x, 0.0, sunDir.z) + 1e-4)), 0.0), 3.0) * 0.6);
  col = mix(zenith, sunSide, hz);
  alpha = wash * (0.55 + 0.45 * hz);

  // ---- the Fracture Moon: a vast cracked world, lit by the sun, cracks glowing from within ----
  {
    vec3 bd = normalize(bodyDir);
    float cosA = dot(d, bd);
    float ang = acos(clamp(cosA, -1.0, 1.0));
    if (ang < bodyRadius * 2.6) {
      vec3 t1 = normalize(cross(bd, vec3(0.0, 1.0, 0.0))), t2 = cross(bd, t1);
      float s = sin(bodyRadius);
      vec2 uv0 = vec2(dot(d, t1), dot(d, t2)) / s;
      float rr = length(uv0);
      float halo = smoothstep(bodyRadius * 1.5, bodyRadius * 0.95, ang);
      vec3 haloCol = mix(mix(vec3(0.75, 0.85, 1.0), crackCol, 0.35), crackCol, clamp(crackGlow - 0.4, 0.0, 1.0)) * (0.16 + 0.12 * crackGlow);
      float haloK = mix(moonDay * 0.8, 1.0, night); col = mix(col, haloCol, halo * 0.45 * haloK); alpha = max(alpha, halo * 0.3 * haloK);
      if (rr < 1.0) {
        vec3 n = t1 * uv0.x + t2 * uv0.y + bd * sqrt(1.0 - rr * rr);   // sphere normal in world space
        float surf = fbm3(n.xy * 4.0 + n.z * 2.0);
        float surf2 = fbm3(n.yz * 9.0 - n.x * 5.0);
        // fracture network: thin ridges where noise fields cross zero; plate seams wider than hairline cracks
        // plate fractures: the borders of large cells (jagged with a little warp), finer cracks splitting the plates
        vec3 wp = n + (vec3(fbm3(n.xy * 6.0), fbm3(n.yz * 6.0), fbm3(n.zx * 6.0)) - 0.45) * 0.12;
        float crack = 1.0 - smoothstep(0.0, 0.055, cellEdge(wp * 3.2 + 17.3));
        crack += (1.0 - smoothstep(0.0, 0.035, cellEdge(wp * 8.5 + 4.0))) * 0.45 * smoothstep(0.35, 0.6, fbm3(n.xy * 3.0));
        float lit = clamp(dot(n, normalize(sunDir)) * 0.6 + 0.55, 0.0, 1.0);
        vec3 rock = moonTint * (0.75 + 0.5 * (surf * 0.7 + surf2 * 0.3));
        vec3 body = rock * (0.35 + lit * 0.85);
        body *= 0.6 + 0.4 * smoothstep(0.0, 0.9, 1.0 - rr * 0.6);           // darker toward the limb
        // cracks: dark chasms by day, burning at sunset, violet at night (owner's sky board)
        body = mix(body, body * 0.35, crack * clamp(1.0 - crackGlow, 0.0, 1.0) * 0.9);
        body += crackCol * crack * crackGlow * 1.1;
        body = mix(body, haloCol * 2.0, pow(rr, 6.0) * 0.4);                // atmosphere rim
        float bodyA = mix(moonDay, 1.0, night);
        col = mix(col, body, bodyA); alpha = max(alpha, bodyA); moonMask = smoothstep(1.0, 0.97, rr);
      }
      // shards breaking off the moon: dark rock slabs drifting away from its rim, edges lit by the crack glow
      for (int i = 0; i < 12; i++) {
        float fi = float(i);
        // breaking off the lower-right limb and drifting out, a couple of strays on the far side (owner's sky board)
        float a0 = mix(-1.35, 0.15, h21(vec2(fi, 1.3))) + (i > 9 ? 2.9 : 0.0);
        float dist = 0.96 + pow(h21(vec2(fi, 2.7)), 1.6) * 0.75 + time * 0.0003 * (1.0 + fi * 0.1);
        float sz = mix(0.03, 0.095, pow(h21(vec2(fi, 4.4)), 1.8));
        vec2 c = vec2(cos(a0), sin(a0)) * dist;
        float rot = a0 + (h21(vec2(fi, 5.5)) - 0.5) * 1.2 + time * 0.002 * (h21(vec2(fi, 6.6)) - 0.5);
        vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * (uv0 - c) / sz;
        // an angular slab: the max of five half-planes at seeded angles and offsets (a splintered polygon, longer than wide)
        q.x /= 1.1 + h21(vec2(fi, 7.7)) * 0.8;
        float poly = -1.0;
        for (int k = 0; k < 5; k++) {
          float ak = float(k) * 1.2566 + (h21(vec2(fi, float(k) + 11.0)) - 0.5) * 0.7;
          poly = max(poly, dot(q, vec2(cos(ak), sin(ak))) - (0.75 + h21(vec2(fi, float(k) + 21.0)) * 0.45));
        }
        float m = smoothstep(0.02, -0.02, poly);
        if (m > 0.001) {
          float shL = clamp(dot(normalize(q), normalize(vec2(dot(sunDir, t1), dot(sunDir, t2)) + 1e-4)) * 0.5 + 0.5, 0.0, 1.0);
          float rim = smoothstep(-0.12, 0.0, poly);
          vec3 sh = moonTint * (0.25 + 0.45 * shL) * (0.7 + 0.5 * vn(q * 4.0 + fi)) + crackCol * rim * crackGlow * 0.7;
          float shA = m * mix(max(moonDay, 0.6), 1.0, night);
          col = mix(col, sh, shA); alpha = max(alpha, shA); moonMask = max(moonMask, m);
        }
      }
    }
  }

  // ---- stars + Milky Way (night only) ----
  if (starStrength > 0.01 || milkyWay > 0.01 || nebula > 0.01) {
    vec3 sp = d * 220.0; vec3 cell = floor(sp); vec3 f = fract(sp) - 0.5;
    float r = h31(cell);
    vec3 axis = normalize(vec3(0.35, 0.8, 0.45));
    float band = exp(-pow(dot(d, axis) * 4.6, 2.0));
    float star = step(0.985 - 0.012 * band * nebula, r) * smoothstep(0.35, 0.0, length(f)) * (0.5 + 0.5 * h31(cell + 7.0));
    float tw = 0.75 + 0.25 * sin(time * 2.0 + r * 40.0);
    float dust = fbm(d.xz * 9.0 / max(0.25, abs(d.y) + 0.35) + d.y * 3.0);
    vec3 mw = mix(vec3(0.22, 0.26, 0.5), vec3(0.75, 0.55, 0.6), dust) * band * (0.35 + dust * 0.9);
    // the board's night nebula: violet and electric-blue gas clouds along the band, a few hot pink knots
    vec2 np = d.xz / (abs(d.y) + 0.45) * 2.2;
    float g1 = fbm(np + fbm3(np * 1.7) * 1.2), g2 = fbm(np * 2.1 + 4.0);
    vec3 neb = mix(vec3(0.38, 0.16, 0.75), vec3(0.12, 0.42, 1.0), smoothstep(0.35, 0.7, g2)) * smoothstep(0.5, 0.85, g1) * band * 1.1;
    neb += vec3(1.0, 0.35, 0.8) * pow(smoothstep(0.62, 0.9, g1 * g2 * 1.9), 2.0) * band * 0.8;
    col += (vec3(0.9, 0.95, 1.0) * star * tw * 1.4) * max(starStrength, nebula) + mw * milkyWay * 0.6 + neb * nebula;
    alpha = max(alpha, clamp(star * max(starStrength, nebula) + length(mw) * milkyWay * 0.5 + length(neb) * nebula * 0.8, 0.0, 1.0));
  }

  // ---- sun disc + glow ----
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  float disc = smoothstep(0.99935, 0.99975, sd);
  float glow = pow(sd, 90.0) * 0.55 + pow(sd, 10.0) * 0.18 + pow(sd, 3.0) * 0.06;
  col += sunColor * (disc * 4.0 + glow) * sunStrength;
  alpha = max(alpha, clamp((disc + glow * 0.8) * sunStrength, 0.0, 1.0));

  // ---- clouds: cumulus on a plane ~1.5 km up over a gently curved earth, lit by marching two steps toward the sun ----
  if (d.y > 0.0) {
    float t = 1.0 / (d.y + 0.045);                                      // distance to the cloud plane (curvature keeps the horizon finite)
    vec2 wind = vec2(time * 0.010, time * 0.004);
    vec2 p = d.xz * t * 1.25 * cloudScale + wind;
    float bank = (1.0 - smoothstep(0.02, 0.3, d.y)) * 0.06;            // cloud banks pile up toward the horizon
    float dens = cloudDens(p, cover + bank);
    vec2 sxz = normalize(sunDir.xz + 1e-4) * (0.35 + 0.65 * (1.0 - clamp(sunDir.y, 0.0, 1.0)));
    float l1 = cloudDens(p + sxz * 0.18, cover), l2 = cloudDens(p + sxz * 0.45, cover);
    float lightT = exp(-(l1 * 0.6 + l2 * 0.4) * absorb * (0.45 + dens * 0.6)); // light that reaches this point through the cloud toward the sun
    vec3 amb = mix(zenith, horizonCol, 0.4) * 0.25 + cloudShade * 0.5 + cloudLit * 0.3; // the sky's own light (and light bounced inside the cloud) fills the shadow side
    // cauliflower billows: small heaps inside the cloud catch the sun, so a cumulus reads as piled-up puffs with flat darker bases
    float billow = smoothstep(0.42, 0.78, fbm3(p * 3.6 + vec2(3.1, 7.7)));
    lightT = clamp(lightT + billow * 0.55 * dens, 0.0, 1.0);
    vec3 cc = mix(amb * mix(1.0, 0.78, dens), cloudLit, lightT);
    float powder = 1.0 - exp(-dens * 4.0);                                 // thin edges stay dim, dense cores bright: soft cumulus, not cotton
    cc *= 0.82 + 0.18 * powder;
    cc *= 1.0 - night * 0.45;                                             // night cloud reads as dark shapes against the stars
    cc += sunColor * pow(sd, 12.0) * (1.0 - dens) * 1.2 * sunStrength + sunColor * pow(sd, 3.0) * lightT * 0.15 * sunStrength; // silver lining toward the sun
    // high cirrus: long wind-combed streaks, very thin, far above the cumulus
    vec2 cp = d.xz / (d.y + 0.1) * 0.25 + wind * 0.6;
    vec2 cr = mat2(0.86, 0.5, -0.5, 0.86) * cp;
    float cir = smoothstep(0.52, 0.82, fbm3(vec2(cr.x * 0.6, cr.y * 5.0) + fbm3(cr * 1.3) * 0.8)) * cirrusK * 0.4;
    vec3 cirCol = mix(cloudLit, sunColor, 0.25);
    // aerial perspective: distant cloud melts into the horizon colour
    float near = smoothstep(0.015, 0.32, d.y);
    cc = mix(mix(horizonCol, cloudLit, 0.25), cc, 0.35 + 0.65 * near);
    float ca = clamp(dens * (0.55 + 0.45 * near), 0.0, 1.0) * smoothstep(0.0, 0.05, d.y) * (1.0 - night * 0.45);
    ca *= 1.0 - moonMask * smoothstep(0.08, 0.25, d.y) * 0.85;               // the moon hangs in front of all but the lowest cloud banks
    float cia = cir * (1.0 - dens) * smoothstep(0.02, 0.25, d.y) * (1.0 - night * 0.6);
    col = mix(col, cirCol, cia);
    alpha = max(alpha, cia);
    col = mix(col, cc, ca);
    alpha = max(alpha, ca);
  }
  // ---- the Sky Rift: a jagged tear across the sky, a white-hot seam with branching cracks and "code" leaking off one edge (sky-dome.ts SKY_RIFT) ----
  if (riftGlow * riftK > 0.01) {
    vec3 ra = normalize(riftA), rb = normalize(riftB);
    vec3 rn = normalize(cross(ra, rb));
    float om = acos(clamp(dot(ra, rb), -1.0, 1.0));
    float across = asin(clamp(dot(d, rn), -1.0, 1.0));
    vec3 pr = normalize(d - rn * dot(d, rn) + 1e-5);
    float along = atan(dot(pr, cross(rn, ra)), dot(pr, ra)) / om;
    if (along > -0.05 && along < 1.05 && abs(across) < 0.3) {
      float taper = smoothstep(0.0, 0.14, along) * smoothstep(1.0, 0.78, along);
      float fadeOut = smoothstep(0.3, 0.18, abs(across));
      float wob = (fbm(vec2(along * 7.0, 1.7)) - 0.5) * 2.0 * riftJag + (vn(vec2(along * 55.0, 3.0)) - 0.5) * riftJag * 0.45;
      float x = across - wob;
      float w = riftWidth * (0.3 + 1.4 * taper) * (0.65 + 0.7 * vn(vec2(along * 17.0, 9.0)));
      // torn opening: a bright inner seam inside a wider, paler gash with a hard jagged rim
      float seam = smoothstep(w * 0.35, 0.0, abs(x));
      float gash = smoothstep(w, w * 0.8, abs(x) + (vn(vec2(along * 140.0, x * 300.0)) - 0.5) * w * 0.5);
      float edge = exp(-abs(x) / (w * 2.5)) * taper * fadeOut;
      // shattered-glass cracks branching off the tear, strongest near it
      float c1 = 1.0 - smoothstep(0.0, 0.012, abs(fbm(vec2(along * 11.0, x * 22.0)) - 0.5));
      float c2 = 1.0 - smoothstep(0.0, 0.008, abs(fbm(vec2(along * 26.0 + 5.0, x * 48.0)) - 0.5));
      float br = (c1 + c2 * 0.6) * smoothstep(w * 14.0, w * 1.5, abs(x)) * taper;
      // leaking code: rows of bright glyph dashes streaming off the sun-side edge and drifting away from the tear
      vec2 g = vec2(along * 150.0, (x - time * 0.003) * 260.0);
      vec2 gc = floor(g), gf = fract(g);
      float on = step(0.55, h21(gc + floor(time * 2.0 + h21(gc) * 9.0) * 0.37)) * step(0.35, h21(vec2(gc.y, 4.0)));
      float glyph = on * step(0.12, gf.x) * step(gf.x, 0.88) * step(0.4, gf.y) * step(gf.y, 0.62);
      float stream = smoothstep(w * 7.0, w * 2.0, x) * step(w * 1.4, x) * taper * fadeOut * smoothstep(0.25, 0.6, vn(vec2(along * 9.0, 2.0))); // a narrow margin: wide streams stretched into big white blocks near the zenith
      vec3 rc = vec3(1.0, 0.98, 0.94) * seam * 2.6 * taper + mix(vec3(0.85, 0.93, 1.0), vec3(1.0, 0.9, 0.75), 0.35) * gash * 1.6 * taper * (0.85 + 0.3 * vn(vec2(along * 40.0, time * 0.4))) + mix(vec3(0.35, 0.68, 1.0), vec3(0.62, 0.38, 1.0), vn(vec2(along * 5.0, 11.0))) * edge * 0.6 + vec3(0.7, 0.85, 1.0) * br * 0.75 + vec3(0.5, 0.95, 1.0) * glyph * stream * 0.8;
      float ra2 = clamp((seam + gash) * taper + edge * 0.4 + br * 0.55 + glyph * stream * 0.6, 0.0, 1.0) * riftGlow * riftK;
      // live check: by day the white gash vanished into a pale sky. A shadowed torn margin around it (violet-dark) gives it contrast,
      // and the soft outer glow only blooms at night.
      float shade = pow(smoothstep(w * 5.5, w * 1.0, abs(x)), 1.3) * (1.0 - gash) * taper;
      col = mix(col, vec3(0.12, 0.1, 0.22), shade * 0.85 * riftK);
      alpha = max(alpha, shade * 0.85 * riftK);
      rc -= mix(vec3(0.35, 0.68, 1.0), vec3(0.62, 0.38, 1.0), vn(vec2(along * 5.0, 11.0))) * edge * 0.6 * (1.0 - night) * 0.75;
      vec3 pre = col * alpha + rc * riftGlow * riftK;          // additive light on top of whatever the dome already drew
      alpha = max(alpha, ra2);
      col = pre / max(alpha, 1e-3);
    }
  }
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

export function SkyDome({ sunDirRef, envRef, playerRef, tier, look, timeRef }: { timeRef?: React.RefObject<number>; sunDirRef: React.RefObject<THREE.Vector3>; envRef: React.RefObject<SkyEnv>; playerRef: React.RefObject<THREE.Object3D | null>; tier: RenderTier; look?: SkyLookId }) {
  const root = useRef<THREE.Group>(null!);
  const octaves = tier === "LOW" ? 4 : 5; // 5 octaves give cumulus crisp edges
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag(octaves),
    uniforms: {
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, zenith: { value: new THREE.Vector3(0.16, 0.42, 0.74) }, horizonCol: { value: new THREE.Vector3(1, 0.86, 0.62) }, bodyDir: { value: new THREE.Vector3(...SKY_BODY.dir).normalize() }, wash: { value: 0.5 }, bodyRadius: { value: SKY_BODY.radius }, sunColor: { value: new THREE.Vector3(1, 0.95, 0.86) }, cloudLit: { value: new THREE.Vector3(1, 1, 1) }, cloudShade: { value: new THREE.Vector3(0.5, 0.55, 0.7) },
      riftA: { value: new THREE.Vector3(...SKY_RIFT.from).normalize() }, riftB: { value: new THREE.Vector3(...SKY_RIFT.to).normalize() }, riftWidth: { value: SKY_RIFT.width }, riftJag: { value: SKY_RIFT.jag }, riftGlow: { value: 0.6 },
      crackCol: { value: new THREE.Vector3(1, 0.6, 0.3) }, crackGlow: { value: 0.4 }, moonTint: { value: new THREE.Vector3(0.7, 0.72, 0.8) }, nebula: { value: 0 },
      absorb: { value: 1.6 }, cirrusK: { value: 0.5 }, cloudScale: { value: 1 }, moonDay: { value: 0.1 }, riftK: { value: 0.6 },
      time: { value: 0 }, cover: { value: 0.4 }, night: { value: 0 }, sunStrength: { value: 1 }, starStrength: { value: 0 }, milkyWay: { value: 0 },
    },
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
  }), [octaves]);

  const eased = useRef<{ zenith: number[]; horizon: number[] } | null>(null);
  useFrame(({ clock }, delta) => {
    const sd = sunDirRef.current, env = envRef.current;
    const p = playerRef.current?.position;
    if (root.current && p) root.current.position.set(p.x, 0, p.z);
    const hour = timeRef?.current != null ? (((timeRef.current % 1) + 1) % 1) * 24 : undefined; // game time is a day fraction
    const params = skyParams(sd?.y ?? 0.6, env?.cloud ?? 0, env?.region, look, hour);
    // ease the graded colours so crossing a region border blends over ~2 s instead of popping
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 1.5);
    if (!eased.current) eased.current = { zenith: [...params.zenith], horizon: [...params.horizon] };
    for (let i = 0; i < 3; i++) { eased.current.zenith[i] = eased.current.zenith[i]! + (params.zenith[i]! - eased.current.zenith[i]!) * k; eased.current.horizon[i] = eased.current.horizon[i]! + (params.horizon[i]! - eased.current.horizon[i]!) * k; }
    params.zenith = eased.current.zenith as typeof params.zenith; params.horizon = eased.current.horizon as typeof params.horizon;
    const u = material.uniforms as Record<string, { value: unknown }>;
    if (sd) (u["sunDir"]!.value as THREE.Vector3).copy(sd);
    (u["sunColor"]!.value as THREE.Vector3).set(...params.sunColor);
    (u["cloudLit"]!.value as THREE.Vector3).set(...params.cloudLit);
    (u["cloudShade"]!.value as THREE.Vector3).set(...params.cloudShade);
    (u["zenith"]!.value as THREE.Vector3).set(...params.zenith);
    (u["horizonCol"]!.value as THREE.Vector3).set(...params.horizon);
    u["wash"]!.value = params.wash;
    u["time"]!.value = clock.elapsedTime;
    u["cover"]!.value = params.cover;
    u["night"]!.value = params.night;
    u["sunStrength"]!.value = params.sunStrength;
    u["starStrength"]!.value = params.starStrength;
    u["milkyWay"]!.value = params.milkyWay;
    u["absorb"]!.value = params.absorb; u["cirrusK"]!.value = params.cirrus; u["cloudScale"]!.value = params.cloudScale; u["moonDay"]!.value = params.moonDay; u["riftK"]!.value = params.riftK;
    (u["crackCol"]!.value as THREE.Vector3).set(...params.crack); u["crackGlow"]!.value = params.crackGlow; (u["moonTint"]!.value as THREE.Vector3).set(...params.moonTint); u["nebula"]!.value = params.nebula;
    u["riftGlow"]!.value = riftGlow(params.night, env?.cloud ?? 0, (env?.cloud ?? 0) > 0.8);
  });

  return (
    <group ref={root}>
      <mesh material={material} frustumCulled={false} renderOrder={-5}><sphereGeometry args={[3000, 40, 20]} /></mesh>
    </group>
  );
}
