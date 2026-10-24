import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZONE_COLOR } from "@/game/world";
import { destinationById } from "@/game/destination-director";
import { destinationInfo, type DestinationId } from "@/game/destination-map";
import { ACTIVITY_COLOR, ACTIVITY_LABEL, type Activity } from "@/game/map-activities";
import { locationById } from "@/game/locations";
import { NEW_DIRECTOR_NAV, current, pop, popTo, push, recall, remember, type DirectorNav, type DirectorScreen } from "@/game/director-nav";
import type { PlayerProgression } from "@/game/progression";
import { DestinationMap, type DestinationChrome } from "./DestinationMap";
import { DestinationView } from "./WorldAtlas";
import { useMenuInput } from "./useMenuInput";
import { playDirectorCue } from "@/game/audio";
import type { DeployTarget } from "./StarMap";

/** The Destination Director (Stages 39–41): one navigation stack over the painted planet (DestinationMap), a destination's
 * regional map, a district's street view and an activity's detail card (WorldAtlas DestinationView, the same screen the
 * in-world map uses), all reading one location registry (locations.ts). Back (Esc / B-Circle / the breadcrumb) returns to
 * the previous map with its selection intact (director-nav.ts). Launch and fast travel go through the normal transit
 * (onDeploy), and waypoints set here are the same client-local pin the compass follows once you are in the world. */
const destIdOf = (s: DirectorScreen): string | null => (s.level === "planet" ? null : s.level === "destination" ? s.id : s.destinationId);

export function DestinationDirector({ progression, onDeploy, onProgression, onAtlas, chrome }: {
  progression: PlayerProgression;
  onDeploy: (target: DeployTarget) => void;
  onProgression?: (next: PlayerProgression) => void;
  onAtlas: () => void;
  chrome?: DestinationChrome;
}) {
  const [nav, setNav] = useState<DirectorNav>(NEW_DIRECTOR_NAV);
  const [launching, setLaunching] = useState(false);
  const top = current(nav);
  const go = (s: DirectorScreen) => { playDirectorCue("open", s.level === "planet" ? null : s.level === "destination" ? s.id : s.destinationId); setNav((n) => push(n, s)); };
  const back = () => { if (nav.stack.length > 1) playDirectorCue("back", destIdOf(current(nav))); setNav((n) => pop(n)); };
  const deeper = top.level !== "planet";
  const destId: DestinationId | null = top.level === "planet" ? null : top.level === "destination" ? top.id : top.destinationId;
  const dest = destId ? destinationById(destId) ?? null : null;
  const destScreen = destId ? nav.stack.find((s) => s.level === "destination") ?? null : null;
  const areaId = top.level === "area" ? top.id : null;

  // Esc / B-Circle step back one screen (the planet handles its own input while it is on top)
  useMenuInput(deeper, (intent) => { if (intent === "back") back(); }, ["back"]);

  const travel = (a: Activity) => {
    if (launching || !dest) return;
    setLaunching(true);
    onDeploy({ id: a.id, name: a.name, sub: `${ACTIVITY_LABEL[a.kind]} · ${dest.name}`, color: ACTIVITY_COLOR[a.kind] ?? ZONE_COLOR[dest.kind], x: a.drop.x, z: a.drop.z, ...(a.drop.y !== undefined ? { y: a.drop.y } : {}) });
  };
  const deployDestination = () => {
    if (!destId || launching) return;
    const info = destinationInfo(destId);
    if (!info.deployable) return;
    setLaunching(true);
    onDeploy({ id: info.id, name: info.name, sub: info.sub, color: ZONE_COLOR[info.kind], x: info.drop.x, z: info.drop.z, ...(info.drop.y !== undefined ? { y: info.drop.y } : {}) });
  };

  const crumbs = useMemo(() => nav.stack.map((s, i) => {
    const label = s.level === "planet" ? "Planet" : s.level === "destination" ? destinationById(s.id)?.name ?? s.id : s.level === "area" ? locationById(s.id)?.name ?? "Street" : "Activity";
    return { i, label };
  }), [nav.stack]);

  return (
    <>
      {/* the planet stays mounted under the deeper screens so its selection, drawers and scroll survive Back */}
      <div aria-hidden={deeper} className={deeper ? "pointer-events-none invisible" : undefined}>
        <DestinationMap progression={progression} onDeploy={onDeploy} {...(onProgression ? { onProgression } : {})} onAtlas={onAtlas} {...(chrome ? { chrome } : {})}
          active={!deeper} initial={recall(nav, { level: "planet" }) as DestinationId | null}
          onSelect={(id) => { playDirectorCue("select", id); setNav((n) => remember(n, { level: "planet" }, id)); }}
          onOpen={(id) => { playDirectorCue("open", id); setNav((n) => push(remember(n, { level: "planet" }, id), { level: "destination", id })); }} />
      </div>
      {deeper && dest && (
        <div className="wf-shell fixed inset-0 z-[62] overflow-y-auto bg-background/95 text-foreground wf-director-in" role="dialog" aria-modal="true" aria-label={`${dest.name} director`}>
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-7">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/15 pb-4">
              <div className="min-w-0">
                <nav className="flex flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground" aria-label="Director path">
                  {crumbs.map((c, k) => <span key={c.i} className="flex items-center gap-1">{k > 0 && <ChevronRight className="size-3" />}
                    {k === crumbs.length - 1 ? <span className="text-primary">{c.label}</span> : <button type="button" className="ui-focus hover:text-foreground" onClick={() => setNav((n) => popTo(n, c.i))}>{c.label}</button>}</span>)}
                </nav>
                <h2 className="mt-1 font-mono text-3xl font-light uppercase sm:text-4xl">{areaId ? locationById(areaId)?.name ?? dest.name : dest.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{areaId ? `Street view · ${dest.name}` : `${dest.sub}${dest.difficulty ? ` · Risk ${dest.difficulty}` : ""}`}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" className="rounded-none" onClick={back} aria-label="Back"><ArrowLeft /><span className="font-mono text-[10px] uppercase">Esc · Back</span></Button>
                <Button className="rounded-none" disabled={launching || !destinationInfo(dest.id as DestinationId).deployable} onClick={deployDestination}><Play />{launching ? "Deploying…" : `Launch to ${dest.name}`}</Button>
              </div>
            </header>
            <DestinationView key={dest.id} dest={dest} progression={progression} phase="orbit" markers={[]} px={Number.NaN} pz={Number.NaN}
              {...(onProgression ? { onProgression } : {})} onTravel={travel} onClose={back}
              areaId={areaId} onArea={(id) => go({ level: "area", id, destinationId: dest.id as DestinationId })}
              initialPick={destScreen ? recall(nav, top) : null} padActive
              onPickChange={(id) => setNav((n) => remember(n, current(n), id))} />
          </div>
        </div>
      )}
    </>
  );
}
