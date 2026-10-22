import { useEffect, useMemo, useState } from "react";
import { Compass, Lock, Settings2, Play, X } from "lucide-react";
import { ZONE_COLOR, REGIONS } from "@/game/world";
import { LANDMARKS, isLandmarkKnown } from "@/game/landmarks";
import { REGION_HAZARD } from "@/game/region-hazards";
import { ENCOUNTERS } from "@/game/encounters";
import { ACTIVITY_COLOR, ACTIVITY_LABEL } from "@/game/map-activities";
import {
  CARD_RECT, CLOSEUP_RECT, DESTINATION_PINS, DRAWER_RECT, MAP_WINDOW, STAGE, STAGE_PANELS, destinationActivities, destinationInfo, destinationStatus, pct, pinById,
  stepDestination, threatLabel, type DestinationId,
} from "@/game/destination-map";
import type { PlayerProgression } from "@/game/progression";
import { useMenuInput } from "./useMenuInput";
import { ActivityPanel } from "./ActivityPanel";
import type { DeployTarget } from "./StarMap";

/** Art built by scripts/build-destination-art.py from docs/reference/destination-map. */
const ART = import.meta.glob("../../assets/destination/*", { eager: true, import: "default" }) as Record<string, string>;
const art = (file: string) => ART[`../../assets/destination/${file}`] ?? "";

/** The Director tabs, drawn in the art's tab bar (Q/E like L1/R1) */
export type DestinationChrome = {
  tabs: { id: string; label: string }[];
  current: string;
  onTab: (id: string) => void;
  operator: string;
  level: number;
  onResume: () => void;
  onSystem: () => void;
};

type Drawer = null | "activities" | "landing" | "legend";

const LEGEND: { glyph: string; color: string; label: string }[] = [
  { glyph: "◆", color: "#ffd166", label: "Main story · next chapter" },
  { glyph: "☠", color: "#ff4d5e", label: "Boss lair or nemesis" },
  { glyph: "◎", color: "#7ef2b0", label: "Open activities" },
  { glyph: "▲", color: "#92e9f5", label: "Recommended next" },
  { glyph: "⛨", color: ZONE_COLOR.safe, label: "Safe zone / city" },
  { glyph: "🔒", color: "#ffb23e", label: "No landing site" },
];

/** Destination Map (destination-map.ts): the painted planet from the owner's reference with every control live.
 * Select a destination on the art or in the list, inspect its card, open its activities or landing zones, launch. */
export function DestinationMap({ progression, onDeploy, onProgression, onAtlas, chrome }: {
  progression: PlayerProgression;
  onDeploy: (target: DeployTarget) => void;
  onProgression?: (next: PlayerProgression) => void;
  /** open the geographic terrain atlas */
  onAtlas: () => void;
  chrome?: DestinationChrome;
}) {
  const statuses = useMemo(() => Object.fromEntries(DESTINATION_PINS.map((p) => [p.id, destinationStatus(progression, p.id)])), [progression]);
  const firstRecommended = DESTINATION_PINS.find((p) => statuses[p.id]?.recommended)?.id ?? "veridan";
  const [selected, setSelected] = useState<DestinationId | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [zoom, setZoom] = useState(false);
  const [landingId, setLandingId] = useState("primary");
  const [launching, setLaunching] = useState(false);
  const focus = selected ?? firstRecommended;

  const info = selected ? destinationInfo(selected) : null;
  const pin = selected ? pinById(selected)! : null;
  const status = selected ? statuses[selected]! : null;
  const region = info ? REGIONS.find((r) => r.id === info.regionId)! : null;
  const acts = useMemo(() => (selected ? destinationActivities(progression, selected) : []), [progression, selected]);
  const landings = useMemo(() => {
    if (!info || !region) return [];
    const reach = info.id === "neon-city" || info.id === "thalassia" ? 160 : region.radius * 1.4;
    const city = DESTINATION_PINS.some((p) => p.id === info.id) && (info.id === "neon-city" || info.id === "thalassia");
    const centre = city ? { x: info.drop.x, z: info.drop.z } : { x: region.x, z: region.z };
    const known = LANDMARKS.filter((l) => isLandmarkKnown(progression, l.id) && l.id !== info.id && Math.hypot(l.x - centre.x, l.z - centre.z) <= reach).slice(0, 7);
    return [{ id: "primary", name: "Primary landing zone", x: info.drop.x, z: info.drop.z, ...(info.drop.y !== undefined ? { y: info.drop.y } : {}) },
      // a submerged city is only reached by its submersible; landmarks there are not separate drops
      ...(info.drop.y !== undefined ? [] : known.map((l) => ({ id: l.id, name: l.name, x: l.x, z: l.z + 6 })))];
  }, [info, region, progression]);
  const landing = landings.find((l) => l.id === landingId) ?? landings[0];

  const select = (id: DestinationId) => { setSelected(id); setLandingId("primary"); setLaunching(false); if (drawer === "landing" || drawer === "activities") setDrawer(drawer); };
  const launch = () => {
    if (!info || !landing || !info.deployable || launching) return;
    setLaunching(true);
    onDeploy({ id: info.id, name: info.name, sub: landing.id === "primary" ? info.sub : `${landing.name} · ${info.name}`, color: ZONE_COLOR[info.kind], x: landing.x, z: landing.z, ...("y" in landing && typeof landing.y === "number" ? { y: landing.y } : {}) });
  };
  const back = () => { if (zoom) setZoom(false); else if (drawer) setDrawer(null); else if (selected) setSelected(null); else chrome?.onSystem(); };

  useMenuInput(true, (intent) => {
    if (intent === "up" || intent === "down") { if (!drawer && !zoom) select(stepDestination(focus, intent === "up" ? -1 : 1)); }
    else if (intent === "confirm") { if (!selected) select(focus); else if (!drawer || drawer === "landing") launch(); }
    else if (intent === "back") back();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.code === "KeyZ" && selected) setZoom((z) => !z);
      if (e.code === "KeyX" && selected) setDrawer((d) => (d === "activities" ? null : "activities"));
      if (e.code === "KeyC" && selected) setDrawer((d) => (d === "landing" ? null : "landing"));
      if (e.code === "KeyG") setDrawer((d) => (d === "legend" ? null : "legend"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const boss = region ? ENCOUNTERS.find((e) => e.regionId === region.id)?.boss : undefined;
  const hazard = region ? REGION_HAZARD[region.id] : undefined;

  /* ---------------- pieces shared by the desktop stage and the phone layout ---------------- */
  const pins = DESTINATION_PINS.map((p) => {
    const st = statuses[p.id]!;
    const on = p.id === selected;
    return (
      <div key={p.id}>
        <button type="button" className="wf-dest-pin" style={{ ...pct(p.label), ["--pin" as string]: p.accent }} aria-pressed={on}
          aria-label={`${destinationInfo(p.id).name}${st.recommended ? ", recommended" : ""}${st.story ? ", next story chapter" : ""}`} onClick={() => select(p.id)} />
        {on && <span className="wf-dest-ring" style={{ left: `${(p.icon.x / STAGE.w) * 100}%`, top: `${(p.icon.y / STAGE.h) * 100}%`, ["--pin" as string]: p.accent }} />}
        <span className="pointer-events-none absolute flex -translate-y-full gap-[0.3cqw]" style={{ left: `${(p.label.x / STAGE.w) * 100}%`, top: `${(p.label.y / STAGE.h) * 100}%` }}>
          {st.recommended && <span className="wf-dest-badge text-[#92e9f5]">▲ Recommended</span>}
          {st.story && <span className="wf-dest-badge text-[#ffd166]">◆ Story</span>}
          {st.bosses > 0 && <span className="wf-dest-badge text-[#ff4d5e]">☠ {st.bosses}</span>}
        </span>
      </div>
    );
  });

  const list = DESTINATION_PINS.map((p) => {
    const d = destinationInfo(p.id), st = statuses[p.id]!;
    return (
      <button key={p.id} type="button" className="wf-dest-row" aria-current={p.id === selected} onClick={() => select(p.id)} style={{ height: `${100 / DESTINATION_PINS.length}%` }}>
        <img src={art(`emblem-${p.id}.png`)} alt="" className="size-[2.4cqw] shrink-0 object-contain" draggable={false} />
        <span className="min-w-0 flex-1 truncate">{d.name}</span>
        {st.story && <span className="text-[#ffd166]" title="Next story chapter">◆</span>}
        {!d.deployable && <Lock className="size-[1cqw] text-[#ffb23e]" aria-label="No landing site" />}
      </button>
    );
  });

  const card = info && pin && status && region && (
    <div className="wf-dest-in flex h-full flex-col gap-[0.5cqw] p-[0.9cqw]">
      <div className="flex items-center gap-[0.8cqw]">
        <img src={art(`emblem-${pin.id}.png`)} alt="" className="size-[2.5cqw] object-contain" draggable={false} />
        <div className="min-w-0">
          <h2 className="truncate text-[1.75cqw] font-bold uppercase leading-none tracking-[0.12em]" style={{ color: pin.accent }}>{info.name}</h2>
          <p className="mt-[0.25cqw] text-[0.9cqw] font-semibold uppercase tracking-[0.28em] text-[#cfe8f2]">{pin.tagline}</p>
        </div>
        <button type="button" onClick={() => setSelected(null)} className="ml-auto text-white/60 hover:text-white" aria-label="Close destination"><X className="size-[1.2cqw]" /></button>
      </div>
      <button type="button" onClick={() => setZoom(true)} className="group relative h-[4.6cqw] shrink-0 overflow-hidden border border-white/20" aria-label={`Open the ${info.name} close-up`}>
        <img src={art(`${pin.id}.jpg`)} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" draggable={false} />
        <span className="absolute bottom-[0.3cqw] right-[0.4cqw] bg-black/70 px-[0.4cqw] text-[0.75cqw] font-semibold uppercase tracking-[0.2em]">Z · Close-up</span>
      </button>
      <p className="line-clamp-2 text-[0.92cqw] leading-snug text-[#d6e6ee]">{pin.blurb}</p>
      <p className="flex flex-wrap gap-x-[0.9cqw] text-[0.82cqw] font-semibold uppercase tracking-[0.14em] text-[#9fc3d3]">
        <span>Threat <b className="text-white">{threatLabel(info.threat)}</b></span>
        <span>Activities <b className="text-white">{status.open}</b></span>
        {status.done > 0 && <span>Cleared <b className="text-white">{status.done}</b></span>}
      </p>
      <div className="mt-auto">
        {!info.deployable && <p className="mb-[0.4cqw] text-[0.85cqw] text-[#ffb23e]">{info.blockedReason}</p>}
        <button type="button" className="wf-dest-launch !h-[2.6cqw]" disabled={!info.deployable || launching} onClick={launch}>
          <span className="wf-dest-cap">↵</span>{launching ? "Deploying…" : "Launch"}
        </button>
        {landing && landing.id !== "primary" && <p className="mt-[0.3cqw] truncate text-center text-[0.75cqw] uppercase tracking-[0.18em] text-[#92e9f5]">Landing · {landing.name}</p>}
      </div>
    </div>
  );

  const drawerBody = drawer === "legend" ? (
    <div className="p-[1.2cqw]">
      <p className="wf-dest-kicker">Legend</p>
      <ul className="mt-[1cqw] space-y-[0.7cqw]">{LEGEND.map((l) => <li key={l.label} className="flex items-center gap-[0.8cqw] text-[1cqw]"><span className="w-[1.6cqw] text-center text-[1.2cqw]" style={{ color: l.color }}>{l.glyph}</span>{l.label}</li>)}</ul>
      <p className="mt-[1.2cqw] text-[0.85cqw] leading-snug text-[#9fc3d3]">The planet art is illustrative. Every launch uses the live world; the terrain atlas shows true geography.</p>
      <button type="button" onClick={onAtlas} className="mt-[1cqw] flex items-center gap-[0.5cqw] border border-white/30 px-[0.9cqw] py-[0.5cqw] text-[0.9cqw] font-semibold uppercase tracking-[0.2em] hover:bg-white/10"><Compass className="size-[1.1cqw]" /> Terrain atlas</button>
    </div>
  ) : drawer === "landing" && info ? (
    <div className="flex h-full flex-col p-[1.2cqw]">
      <p className="wf-dest-kicker">Landing zones · {info.name}</p>
      <p className="mt-[0.4cqw] text-[0.85cqw] text-[#9fc3d3]">{landings.length > 1 ? "Discovered landmarks become landing zones." : info.drop.y !== undefined ? "Submersible arrival at the Sentry Dock airlock." : "Discover landmarks here to unlock more landing zones."}</p>
      <div className="mt-[0.8cqw] min-h-0 flex-1 space-y-[0.4cqw] overflow-y-auto">
        {landings.map((l) => <button key={l.id} type="button" onClick={() => setLandingId(l.id)} aria-pressed={landing?.id === l.id}
          className={`flex w-full items-center gap-[0.7cqw] border px-[0.8cqw] py-[0.6cqw] text-left text-[1cqw] ${landing?.id === l.id ? "border-[#92e9f5] bg-[#92e9f5]/15" : "border-white/15 hover:border-white/45"}`}>
          <span className="text-[#92e9f5]">▼</span><span className="flex-1">{l.name}</span>{landing?.id === l.id && <span className="text-[0.8cqw] uppercase tracking-[0.2em] text-[#92e9f5]">Selected</span>}
        </button>)}
      </div>
    </div>
  ) : drawer === "activities" && info && region ? (
    <div className="flex h-full flex-col p-[1.2cqw] font-sans">
      <p className="wf-dest-kicker wf-display">Activities · {info.name}</p>
      <div className="mt-[0.4cqw] flex flex-wrap gap-[0.4cqw]">
        {hazard && hazard.id !== "none" && <span className="wf-dest-badge wf-display text-[#ff9c7a]">⚠ {hazard.name}</span>}
        {boss && <span className="wf-dest-badge wf-display text-[#ff4d5e]">☠ {boss.name}</span>}
      </div>
      <div className="mt-[0.8cqw] min-h-0 flex-1 overflow-y-auto text-[0.95cqw]">
        {onProgression ? <ActivityPanel key={info.id} progression={progression} regionId={region.id} activities={acts} onProgression={onProgression} launchLabel="Launch"
          onLaunch={(a) => { if (launching) return; setLaunching(true); onDeploy({ id: a.id, name: a.name, sub: `${ACTIVITY_LABEL[a.kind]} · ${info.name}`, color: ACTIVITY_COLOR[a.kind], x: a.drop.x, z: a.drop.z, ...(a.drop.y !== undefined ? { y: a.drop.y } : {}) }); }} />
          : <ul className="space-y-1">{acts.map((a) => <li key={a.id}>{ACTIVITY_LABEL[a.kind]} · {a.name}</li>)}</ul>}
      </div>
    </div>
  ) : null;

  const hints = (
    <>
      <button type="button" className="wf-dest-hint" disabled={!selected} onClick={() => setZoom((z) => !z)}><span className="wf-dest-cap">Z</span>Close-up</button>
      <button type="button" className="wf-dest-hint" disabled={!selected} onClick={() => setDrawer((d) => (d === "activities" ? null : "activities"))}><span className="wf-dest-cap">X</span>Activities</button>
      <button type="button" className="wf-dest-hint" disabled={!selected} onClick={() => setDrawer((d) => (d === "landing" ? null : "landing"))}><span className="wf-dest-cap">C</span>Landing zones</button>
      <button type="button" className="wf-dest-hint" onClick={() => setDrawer((d) => (d === "legend" ? null : "legend"))}><span className="wf-dest-cap">G</span>Show legend</button>
    </>
  );

  const closeup = zoom && info && pin && status && (
    <div className="wf-dest-in absolute inset-0 flex flex-col">
      <div className="flex items-center gap-[0.9cqw] border-b border-white/15 px-[1.2cqw] py-[0.8cqw]">
        <img src={art(`emblem-${pin.id}.png`)} alt="" className="size-[3cqw] object-contain" draggable={false} />
        <div><h2 className="text-[2cqw] font-bold uppercase leading-none tracking-[0.14em]" style={{ color: pin.accent }}>{info.name}</h2><p className="mt-[0.2cqw] text-[0.95cqw] font-semibold uppercase tracking-[0.3em]">{pin.tagline}</p></div>
        <button type="button" onClick={() => setZoom(false)} className="ml-auto flex items-center gap-[0.4cqw] text-[0.95cqw] font-semibold uppercase tracking-[0.2em] text-white/70 hover:text-white"><span className="wf-dest-cap">Esc</span>Back</button>
      </div>
      <div className="relative min-h-0 flex-1">
        <img src={art(`${pin.id}.jpg`)} alt={`${info.name} close-up`} className="size-full object-cover" draggable={false} />
        <div className="absolute bottom-[1cqw] left-[1cqw] max-w-[60%] bg-black/70 p-[0.9cqw] text-[0.95cqw] leading-snug">
          {pin.blurb}
          <p className="mt-[0.5cqw] text-[0.82cqw] uppercase tracking-[0.16em] text-[#9fc3d3]">{status.story ? "◆ Your next chapter is here · " : ""}{status.bosses ? `☠ ${status.bosses} boss${status.bosses > 1 ? "es" : ""} · ` : ""}{status.open} open activities</p>
        </div>
        <button type="button" onClick={onAtlas} className="absolute right-[1cqw] top-[1cqw] flex items-center gap-[0.5cqw] border border-white/30 bg-black/60 px-[0.9cqw] py-[0.5cqw] text-[0.9cqw] font-semibold uppercase tracking-[0.2em] hover:bg-white/10"><Compass className="size-[1.1cqw]" /> Terrain atlas</button>
      </div>
    </div>
  );

  return (
    <div className="wf-dest" role="dialog" aria-modal="true" aria-label="Destination map">
      {/* ---------------- desktop / tablet: the reference stage ---------------- */}
      <div className="wf-dest-stage hidden md:block">
        <img src={art("planet.jpg")} alt="World Fracture: the planet and its nine destinations" className="wf-dest-art" draggable={false} />
        {pins}

        <div className="absolute flex flex-col justify-center" style={pct(STAGE_PANELS.title)}>
          <p className="text-[2.6cqw] font-bold uppercase leading-none tracking-[0.06em] text-white [text-shadow:0_0_1.2cqw_rgba(146,233,245,0.45)]">World Fracture</p>
          <p className="mt-[0.6cqw] text-[1cqw] font-semibold uppercase tracking-[0.62em] text-[#92e9f5]">Destination map</p>
        </div>

        <nav className="wf-dest-panel flex items-center justify-center gap-[0.4cqw]" style={pct(STAGE_PANELS.tabs)} aria-label="Director">
          <span className="wf-dest-cap" aria-hidden>Q</span>
          {(chrome?.tabs ?? [{ id: "map", label: "Map" }]).map((t) => <button key={t.id} type="button" className="wf-dest-tab" aria-current={(chrome?.current ?? "map") === t.id ? "page" : undefined} onClick={() => chrome?.onTab(t.id)}>{t.label}</button>)}
          <span className="wf-dest-cap" aria-hidden>E</span>
        </nav>

        {chrome && <div className="absolute flex items-center justify-end gap-[0.8cqw]" style={pct(STAGE_PANELS.status)}>
          <span className="text-[1cqw] font-semibold uppercase tracking-[0.24em] text-[#cfe8f2]">{chrome.operator} · Lvl {chrome.level}</span>
          <button type="button" onClick={chrome.onSystem} className="grid size-[2.4cqw] place-items-center border border-white/25 bg-black/40 hover:bg-white/10" aria-label="System settings"><Settings2 className="size-[1.2cqw]" /></button>
          <button type="button" onClick={chrome.onResume} className="flex h-[2.4cqw] items-center gap-[0.4cqw] border border-[#92e9f5]/70 bg-[#0d3448]/80 px-[0.9cqw] text-[0.95cqw] font-bold uppercase tracking-[0.2em] hover:bg-[#145067]"><Play className="size-[1cqw]" /> Resume</button>
        </div>}

        <nav className="wf-dest-panel flex flex-col" style={pct(STAGE_PANELS.list)} aria-label="Destinations">
          <p className="wf-dest-kicker px-[0.9cqw] pb-[0.5cqw] pt-[0.9cqw]">Destinations</p>
          <div className="flex min-h-0 flex-1 flex-col px-[0.5cqw] pb-[0.5cqw]">{list}</div>
        </nav>

        {selected && <section className="wf-dest-panel" style={pct(CARD_RECT)} aria-label="Selected destination">{card}</section>}

        {drawer && <aside className="wf-dest-panel wf-dest-in overflow-hidden" style={pct(DRAWER_RECT)} aria-label="Destination details">
          <button type="button" onClick={() => setDrawer(null)} className="absolute right-[0.6cqw] top-[0.6cqw] z-10 text-white/60 hover:text-white" aria-label="Close panel"><X className="size-[1.2cqw]" /></button>
          {drawerBody}
        </aside>}

        {closeup && <section className="wf-dest-panel overflow-hidden" style={pct(CLOSEUP_RECT)} aria-label="Destination close-up">{closeup}</section>}

        <footer className="wf-dest-panel flex items-center gap-[1.4cqw] px-[1cqw]" style={pct(STAGE_PANELS.bottom)}>
          <div className="flex h-[70%] min-w-[20cqw] items-center gap-[0.9cqw] border border-white/15 bg-black/30 px-[0.9cqw]">
            {pin ? <img src={art(`emblem-${pin.id}.png`)} alt="" className="size-[2.4cqw] object-contain" /> : <Compass className="size-[1.8cqw] text-[#92e9f5]" />}
            <span className="text-[1.25cqw] font-semibold uppercase tracking-[0.3em]">{info ? info.name : "Select destination"}</span>
          </div>
          <div className="flex flex-1 items-center justify-center gap-[1.2cqw]">{hints}</div>
          <button type="button" className="wf-dest-hint" onClick={back}><span className="wf-dest-cap">Esc</span>{zoom || drawer || selected ? "Back" : "Options"}</button>
        </footer>
      </div>

      {/* ---------------- phone: the map window of the art, controls below ---------------- */}
      <div className={`flex size-full flex-col overflow-y-auto md:hidden ${chrome ? "pt-14" : ""}`}>
        <div className="relative w-full shrink-0 overflow-hidden" style={{ aspectRatio: `${MAP_WINDOW.w} / ${MAP_WINDOW.h}` }}>
          <div className="wf-dest-stage absolute" style={{ width: `${(STAGE.w / MAP_WINDOW.w) * 100}%`, left: `${(-MAP_WINDOW.x / MAP_WINDOW.w) * 100}%`, top: `${(-MAP_WINDOW.y / MAP_WINDOW.h) * 100}%` }}>
            <img src={art("planet.jpg")} alt="World Fracture: the planet and its nine destinations" className="wf-dest-art" draggable={false} />
            {pins}
          </div>
        </div>
        <div className="space-y-3 p-3 text-sm">
          <p className="wf-dest-kicker !text-[11px]">Destinations</p>
          <div className="grid grid-cols-2 gap-1">
            {DESTINATION_PINS.map((p) => <button key={p.id} type="button" onClick={() => select(p.id)} aria-current={p.id === selected}
              className={`flex items-center gap-2 border px-2 py-2 text-left ${p.id === selected ? "border-[#92e9f5] bg-[#92e9f5]/15" : "border-white/15"}`}>
              <img src={art(`emblem-${p.id}.png`)} alt="" className="size-6 object-contain" />{destinationInfo(p.id).name}{statuses[p.id]?.story && <span className="text-[#ffd166]">◆</span>}
            </button>)}
          </div>
          {info && pin && status && <div className="wf-dest-in space-y-2 border border-white/15 bg-[#06131f] p-3">
            <div className="flex items-center gap-3">
              <img src={art(`emblem-${pin.id}.png`)} alt="" className="size-10 object-contain" />
              <div><h2 className="text-xl font-bold uppercase leading-none tracking-[0.12em]" style={{ color: pin.accent }}>{info.name}</h2><p className="mt-1 text-xs font-semibold uppercase tracking-[0.28em]">{pin.tagline}</p></div>
            </div>
            <img src={art(`${pin.id}.jpg`)} alt={`${info.name} close-up`} className="aspect-[16/9] w-full border border-white/20 object-cover" />
            <p className="leading-snug text-[#d6e6ee]">{pin.blurb}</p>
            <p className="flex flex-wrap gap-x-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#9fc3d3]"><span>Threat <b className="text-white">{threatLabel(info.threat)}</b></span><span>Activities <b className="text-white">{status.open}</b></span></p>
            {!info.deployable && <p className="text-[#ffb23e]">{info.blockedReason}</p>}
            <button type="button" className="wf-dest-launch !h-12 !text-base" disabled={!info.deployable || launching} onClick={launch}>{launching ? "Deploying…" : "Launch"}</button>
          </div>}
          {info && <div className="flex flex-wrap gap-2">
            <button type="button" className="border border-white/25 px-3 py-2 uppercase tracking-widest" onClick={() => setDrawer(drawer === "activities" ? null : "activities")}>Activities</button>
            <button type="button" className="border border-white/25 px-3 py-2 uppercase tracking-widest" onClick={() => setDrawer(drawer === "landing" ? null : "landing")}>Landing zones</button>
            <button type="button" className="border border-white/25 px-3 py-2 uppercase tracking-widest" onClick={onAtlas}>Terrain atlas</button>
          </div>}
          {drawer && drawer !== "legend" && <div className="border border-white/15 [&_*]:!text-[13px]">{drawerBody}</div>}
        </div>
      </div>
    </div>
  );
}
