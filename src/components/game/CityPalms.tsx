import { useMemo } from "react";
import { neonPalms, nexusPalms, type Palm } from "@/game/city-palms";
import { neonTowersWorld } from "@/game/neon-layout";
import { neonKeepOut } from "@/game/residences";
import { neonPlateauLevel, walkHeight } from "@/game/terrain";
import { InstancedGlb } from "./InstancedGlb";

/** Palm-lined streets (city-palms.ts): one instanced batch per palm variant. */
const URLS = ["/models/foliage/palm-a.glb", "/models/foliage/palm-b.glb", "/models/foliage/palm-c.glb"] as const;

function Palms({ list, y }: { list: Palm[]; y: (p: Palm) => number }) {
  const byVariant = useMemo(() => URLS.map((_, v) => list.filter((p) => p.variant === v).map((p) => ({ x: p.x, y: y(p) - 0.1, z: p.z, yaw: p.yaw, scale: p.scale }))), [list, y]);
  return <group>{byVariant.map((items, v) => <InstancedGlb key={v} url={URLS[v]!} items={items} />)}</group>;
}

export function NexusPalms() {
  const list = useMemo(() => nexusPalms(), []);
  return <Palms list={list} y={(p) => walkHeight(p.x, p.z)} />;
}

export function NeonPalms() {
  const list = useMemo(() => neonPalms(neonTowersWorld(neonKeepOut())), []);
  const level = useMemo(() => neonPlateauLevel(), []);
  return <Palms list={list} y={() => level} />;
}
