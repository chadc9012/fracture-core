import type { ReactNode } from "react";
import { MAP_STRIPS, type MapStrip } from "@/game/map-art";
import sunriseVeridan from "@/assets/map-strips/sunrise-veridan.jpg";
import sunsetNexus from "@/assets/map-strips/sunset-nexus.jpg";
import nightFrostspire from "@/assets/map-strips/night-frostspire.jpg";
import moonlightFracture from "@/assets/map-strips/moonlight-fracture.jpg";
import trees from "@/assets/map-strips/trees.jpg";
import rocks from "@/assets/map-strips/rocks.jpg";
import ocean from "@/assets/map-strips/ocean.jpg";
import lake from "@/assets/map-strips/lake.jpg";
import volcano from "@/assets/map-strips/volcano.jpg";
import flowers from "@/assets/map-strips/flowers.jpg";
import daySolara from "@/assets/map-strips/day-solara.jpg";
import moonFrostspire from "@/assets/map-strips/moon-frostspire.jpg";
import stormEmber from "@/assets/map-strips/storm-ember.jpg";
import sunsetWastelands from "@/assets/map-strips/sunset-wastelands.jpg";

const SRC: Record<string, string> = {
  "sunrise-veridan": sunriseVeridan, "sunset-nexus": sunsetNexus, "night-frostspire": nightFrostspire, "moonlight-fracture": moonlightFracture,
  trees, rocks, ocean, lake, volcano, flowers,
  "day-solara": daySolara, "moon-frostspire": moonFrostspire, "storm-ember": stormEmber, "sunset-wastelands": sunsetWastelands,
};

function Tile({ s }: { s: MapStrip }) {
  return <figure className={`relative min-h-0 min-w-0 overflow-hidden border border-foreground/20 bg-black/40 ${s.edge === "left" ? "w-full shrink-0" : "flex-1"}`} style={s.edge === "left" ? { aspectRatio: String(s.aspect) } : undefined}>
    <img src={SRC[s.id]} alt="" loading="lazy" draggable={false} className="size-full select-none object-cover" />
    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-0.5 pt-3 font-mono text-[8px] uppercase tracking-widest text-white/90">{s.caption}</figcaption>
  </figure>;
}

/** Decorative photo frame around the hub map: 4 tiles on top, 6 down the left, 4 along the bottom. Purely presentational (aria-hidden, not
 * clickable, no gameplay data) and hidden below the lg breakpoint, where the map needs the room. */
export function MapStrips({ children }: { children: ReactNode }) {
  const edge = (e: MapStrip["edge"]) => MAP_STRIPS.filter((s) => s.edge === e);
  return <div className="flex w-full min-w-0 flex-col gap-1.5">
    <div aria-hidden="true" className="hidden h-[8.5vh] gap-1.5 lg:flex">{edge("top").map((s) => <Tile key={s.id} s={s} />)}</div>
    <div className="flex min-w-0 gap-1.5">
      <div aria-hidden="true" className="hidden w-[7.5vw] max-w-32 shrink-0 flex-col gap-1.5 lg:flex">{edge("left").map((s) => <Tile key={s.id} s={s} />)}</div>
      <div className="flex min-w-0 flex-1 items-center justify-center">{children}</div>
    </div>
    <div aria-hidden="true" className="hidden h-[8.5vh] gap-1.5 lg:flex">{edge("bottom").map((s) => <Tile key={s.id} s={s} />)}</div>
  </div>;
}
