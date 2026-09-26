import { useState } from "react";
import { MapPin, Shield, Skull, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, ZONE_LABEL } from "@/game/world";
import { ENCOUNTERS } from "@/game/encounters";
import mapArt from "@/assets/fractured-earth-map.png.asset.json";
import troopArt from "@/assets/regional-troops.jpg.asset.json";
import bossArt from "@/assets/regional-bosses.jpg.asset.json";
import factionArt from "@/assets/enemy-roster.jpg.asset.json";

export function WorldAtlas({ currentRegion, phase, onClose }: { currentRegion: string; phase: string; onClose: () => void }) {
  const [selected, setSelected] = useState(REGIONS.find((region) => region.name === currentRegion)?.id ?? "veridan");
  const region = REGIONS.find((entry) => entry.id === selected) ?? REGIONS[0];
  const encounter = ENCOUNTERS.find((entry) => entry.regionId === selected);
  const [gallery, setGallery] = useState<"MAP" | "TROOPS" | "BOSSES" | "FACTIONS">("MAP");
  const art = gallery === "MAP" ? mapArt : gallery === "TROOPS" ? troopArt : gallery === "BOSSES" ? bossArt : factionArt;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 text-foreground backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="World map">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-7">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-5"><div><p className="font-mono text-xs uppercase text-primary">The Fractured Earth / {phase}</p><h2 className="mt-1 font-mono text-3xl font-semibold">WORLD ATLAS</h2></div><Button size="icon" variant="outline" onClick={onClose} aria-label="Close world map"><X /></Button></header>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.7fr)]">
        <section className="min-w-0"><nav className="mb-3 flex flex-wrap gap-1" aria-label="Atlas artwork">{(["MAP", "TROOPS", "BOSSES", "FACTIONS"] as const).map((tab) => <Button key={tab} size="sm" variant={gallery === tab ? "default" : "outline"} onClick={() => setGallery(tab)}>{tab}</Button>)}</nav><img src={art.url} alt={gallery === "MAP" ? "The Fractured Earth map showing seven regions, terrain and zone types" : `${gallery.toLowerCase()} concept reference`} className="w-full border border-border object-contain" /><p className="mt-2 text-xs text-muted-foreground">{gallery === "MAP" ? "Regional routes and safe, war, fracture, and core zones" : "Field identification reference"}</p></section>
        <aside className="min-w-0"><p className="font-mono text-xs uppercase text-primary">Regional intelligence</p><div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-2">{REGIONS.map((entry) => <Button key={entry.id} variant={selected === entry.id ? "default" : "outline"} onClick={() => setSelected(entry.id)} className="h-auto min-h-12 whitespace-normal text-left text-xs"><MapPin className="size-3 shrink-0" />{entry.name}</Button>)}</div>
          {region && <div className="mt-5 border-t border-border pt-5"><p className="font-mono text-xs uppercase text-primary">{ZONE_LABEL[region.kind]} · Risk {region.difficulty}</p><h3 className="mt-2 text-2xl font-semibold">{region.name}</h3><p className="mt-1 text-sm text-muted-foreground">{region.sub}</p><div className="mt-5 flex items-center gap-2 text-xs uppercase text-primary"><Shield className="size-4" /> Field units</div><ul className="mt-2 divide-y divide-border">{encounter?.troops.map((troop) => <li key={troop.name} className="py-2"><strong className="block text-sm">{troop.name}</strong><span className="text-xs text-muted-foreground">{troop.role} · {troop.kind.toLowerCase()}</span></li>)}</ul>{encounter?.boss && <div className="mt-5 border-l-2 border-destructive pl-4"><p className="flex items-center gap-2 font-mono text-xs uppercase text-destructive"><Skull className="size-4" /> Dungeon boss</p><h4 className="mt-1 text-lg font-semibold">{encounter.boss.name}</h4><p className="text-xs text-muted-foreground">{encounter.boss.lair} · {encounter.boss.tell}</p><p className="mt-2 text-xs text-primary">Enter this region and press B to challenge the boss.</p></div>}</div>}
        </aside>
      </div>
    </div>
  </div>;
}