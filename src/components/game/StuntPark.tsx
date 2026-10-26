import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RAMPS, STUNT_PARK, rampCentre, rampDeck, rampProfile } from "@/game/stunt-park";
import { registerDeck } from "@/game/district-decks";
import { heightAt } from "@/game/terrain";

/** The Wastelands Stunt Park (stunt-park.ts): steel ramps with hazard-striped lips on a packed-dirt yard, a chain-link perimeter
 * of posts, and floodlight masts. The ramp tops are registered decks, so vehicles launch off them (stunts.ts scores the air). */
export function StuntPark() {
  const ramps = useMemo(() => RAMPS.map((r) => { const c = rampCentre(r); return { r, c, ground: heightAt(c.x, c.z) }; }), []);
  useEffect(() => { for (const q of ramps) registerDeck(rampDeck(q.r, q.ground)); }, [ramps]);
  const yaw = Math.atan2(STUNT_PARK.dirX, STUNT_PARK.dirZ);

  const geo = useMemo(() => {
    // each ramp: its side profile extruded across its width (profile x = along the run-up, y = up); local +z = along after rotation
    const ramp = ramps.map(({ r }) => {
      const shape = new THREE.Shape();
      const pts = rampProfile(r);
      shape.moveTo(pts[0]![0], -0.6);
      for (const [a, h] of pts) shape.lineTo(a, h);
      shape.lineTo(pts[pts.length - 1]![0], -0.6);
      const g = new THREE.ExtrudeGeometry(shape, { depth: r.width, bevelEnabled: false });
      g.translate(0, 0, -r.width / 2);
      g.rotateY(-Math.PI / 2); // profile x → local z (the run-up)
      return g;
    });
    const stripe = ramps.map(({ r }) => {
      // a hazard band along the lip edge(s) of each ramp's top
      const h = r.length / 2, list: THREE.BufferGeometry[] = [];
      for (const s of r.ramp * 2 >= r.length - 0.5 ? [0] : [-(h - r.ramp), h - r.ramp]) list.push(new THREE.BoxGeometry(r.width + 0.1, 0.08, 0.9).translate(0, r.height + 0.03, s));
      return list;
    });
    return { ramp, stripe, post: new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), mast: new THREE.CylinderGeometry(0.18, 0.24, 14, 8), lamp: new THREE.BoxGeometry(2.4, 0.5, 0.8), yard: new THREE.PlaneGeometry(STUNT_PARK.width, STUNT_PARK.length) };
  }, [ramps]);

  const mats = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 16;
    const x = c.getContext("2d")!;
    for (let i = -2; i < 10; i++) { x.fillStyle = i % 2 ? "#111" : "#f2c230"; x.beginPath(); x.moveTo(i * 8, 16); x.lineTo(i * 8 + 8, 16); x.lineTo(i * 8 + 16, 0); x.lineTo(i * 8 + 8, 0); x.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1); tex.colorSpace = THREE.SRGBColorSpace;
    return {
      steel: new THREE.MeshStandardMaterial({ color: "#7c7166", roughness: 0.7, metalness: 0.45 }),
      stripe: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
      post: new THREE.MeshStandardMaterial({ color: "#8a8f94", roughness: 0.5, metalness: 0.6 }),
      lamp: new THREE.MeshStandardMaterial({ color: "#fff3d0", emissive: "#fff0c0", emissiveIntensity: 1.6 }),
      yard: new THREE.MeshStandardMaterial({ color: "#8e7656", roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
  }, []);
  useEffect(() => () => { geo.ramp.forEach((g) => g.dispose()); geo.stripe.flat().forEach((g) => g.dispose()); [geo.post, geo.mast, geo.lamp, geo.yard].forEach((g) => g.dispose()); Object.values(mats).forEach((m) => { m.map?.dispose(); m.dispose(); }); }, [geo, mats]);

  // fence posts round the yard and four floodlight masts at the corners
  const posts = useMemo(() => {
    const out: [number, number, number][] = [], { x, z, length: L, width: W, dirX, dirZ } = STUNT_PARK;
    const at = (a: number, c: number) => { const px = x + dirX * a - dirZ * c, pz = z + dirZ * a + dirX * c; return [px, heightAt(px, pz), pz] as [number, number, number]; };
    for (let a = -L / 2; a <= L / 2; a += 6) { out.push(at(a, -W / 2), at(a, W / 2)); }
    for (let c = -W / 2 + 6; c < W / 2; c += 6) { if (Math.abs(c) > 8) out.push(at(-L / 2, c), at(L / 2, c)); } // gaps at the ends to drive in
    const masts = [[-L / 2, -W / 2], [-L / 2, W / 2], [L / 2, -W / 2], [L / 2, W / 2]].map(([a, c]) => at(a!, c!));
    return { out, masts };
  }, []);

  return (
    <group name="site:stunt-park">
      {ramps.map(({ r, c, ground }, i) => (
        <group key={r.id} position={[c.x, ground - 0.15, c.z]} rotation-y={yaw}>
          <mesh geometry={geo.ramp[i]!} material={mats.steel} castShadow receiveShadow />
          {geo.stripe[i]!.map((g, k) => <mesh key={k} geometry={g} material={mats.stripe} />)}
        </group>
      ))}
      {posts.out.map((p, i) => <mesh key={i} geometry={geo.post} material={mats.post} position={[p[0], p[1] + 1.1, p[2]]} />)}
      {posts.masts.map((p, i) => (
        <group key={`m${i}`} position={p}>
          <mesh geometry={geo.mast} material={mats.post} position-y={7} castShadow />
          <mesh geometry={geo.lamp} material={mats.lamp} position-y={14} />
        </group>
      ))}
    </group>
  );
}
