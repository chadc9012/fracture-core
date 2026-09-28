import { REGIONS, ZONE_COLOR } from "@/game/world";
import { FACTIONS } from "@/game/sim";
import { MARKER_COLOR } from "@/game/waypoints";
import type { HudState } from "./Scene";
import { CornerBrackets } from "./HudChrome";

/**
 * A persistent local-area minimap — the gap between the Compass strip (bearing-only, no sense of
 * layout) and the full-screen WorldAtlas (a menu you have to stop and open). North-up, player-
 * centered, reusing the same live data everything else already reads: hud.markers (waypoints.ts's
 * track(), already computed every HUD tick) for nearby points of interest, and hud.ownership
 * (sim.zones) for live faction-tinted region blobs — no new world-state plumbing.
 */
const VIEW_RADIUS = 90; // world units shown edge-to-edge
const SIZE = 128; // px
const CENTER = SIZE / 2;
const SCALE = CENTER / VIEW_RADIUS;

export function Minimap({ hud }: { hud: HudState }) {
  const toScreen = (x: number, z: number) => ({ x: (x - hud.px) * SCALE, y: (z - hud.pz) * SCALE });
  const ticks = Array.from({ length: 16 }, (_, i) => (i * 360) / 16);
  return (
    <div className="pointer-events-none absolute right-3 top-3 size-32" aria-label="Minimap">
      <CornerBrackets size={7} inset={-4} />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow:
            "0 0 0 1px color-mix(in oklch, var(--primary) 55%, transparent), 0 0 14px color-mix(in oklch, var(--primary) 30%, transparent), inset 0 0 8px color-mix(in oklch, var(--primary) 14%, transparent)",
        }}
      />
      {ticks.map((deg) => (
        <span
          key={deg}
          className="absolute left-1/2 top-1/2 h-1 w-px origin-bottom"
          style={{ background: "color-mix(in oklch, var(--primary) 60%, transparent)", height: 5, transform: `rotate(${deg}deg) translateY(-63px)` }}
        />
      ))}
      <div className="absolute inset-0 overflow-hidden rounded-full border border-primary/30 bg-background/70 backdrop-blur-sm hud-scanline">
      {REGIONS.map((r) => {
        const p = toScreen(r.x, r.z);
        if (Math.hypot(p.x, p.y) > CENTER + 40) return null;
        const owner = hud.ownership.find((o) => o.id === r.id)?.owner;
        const color = owner ? FACTIONS[owner].color : ZONE_COLOR[r.kind];
        const radiusPx = Math.max(8, r.radius * SCALE);
        return (
          <div
            key={r.id}
            className="absolute rounded-full opacity-30"
            style={{ left: CENTER + p.x - radiusPx, top: CENTER + p.y - radiusPx, width: radiusPx * 2, height: radiusPx * 2, background: color }}
          />
        );
      })}
      {hud.markers.slice(0, 14).map((m) => {
        const p = toScreen(m.x, m.z);
        if (Math.hypot(p.x, p.y) > CENTER) return null;
        return (
          <div
            key={m.id}
            className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: CENTER + p.x, top: CENTER + p.y, background: MARKER_COLOR[m.kind] }}
          />
        );
      })}
      <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[8px] font-bold text-primary" style={{ textShadow: "0 0 6px color-mix(in oklch, var(--primary) 70%, transparent)" }}>N</span>
      <div
        className="absolute size-0"
        style={{ left: CENTER, top: CENTER, transform: `translate(-50%, -50%) rotate(${180 - (hud.yaw * 180) / Math.PI}deg)` }}
      >
        <div className="size-2.5" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)", background: "var(--primary)", filter: "drop-shadow(0 0 4px var(--primary))" }} />
      </div>
      </div>
    </div>
  );
}
