import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShopWindow } from "@/components/game/ShopWindow";
import { DEFAULT_PROGRESSION } from "@/game/progression";

function Harness() {
  const id = new URLSearchParams(location.search).get("shop") ?? "nexus-outfitter";
  const [p, setP] = useState({ ...DEFAULT_PROGRESSION, level: 20, completedMissions: [...DEFAULT_PROGRESSION.completedMissions, "system-core"], materials: { ...DEFAULT_PROGRESSION.materials, scrapMetal: 500, dataShards: 500, credits: 500 } } as typeof DEFAULT_PROGRESSION);
  const [open, setOpen] = useState(true);
  return <div className="relative h-screen">{open ? <ShopWindow shopId={id} progression={p} onProgression={setP} onClose={() => setOpen(false)} /> : <p>closed</p>}</div>;
}
export const Route = createFileRoute("/dev-shop-test")({ ssr: false, component: Harness });
