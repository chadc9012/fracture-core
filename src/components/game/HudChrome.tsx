/**
 * Shared "holographic tactical HUD" framing — angular corner brackets reused across HUD.tsx,
 * Tracker.tsx and Minimap.tsx so every readout panel shares one consistent sci-fi frame language
 * (see the hud-panel/hud-glow/hud-ticks/hud-label utilities in styles.css) instead of each one
 * drawing its own ad hoc border. Pure CSS/SVG chrome — no new 3D assets, shaders or art involved.
 */
export function CornerBrackets({ size = 8, inset = -1 }: { size?: number; inset?: number }) {
  const stroke = "color-mix(in oklch, var(--primary) 85%, transparent)";
  const base: React.CSSProperties = { position: "absolute", width: size, height: size };
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      <span style={{ ...base, top: inset, left: inset, borderTop: `1.5px solid ${stroke}`, borderLeft: `1.5px solid ${stroke}` }} />
      <span style={{ ...base, top: inset, right: inset, borderTop: `1.5px solid ${stroke}`, borderRight: `1.5px solid ${stroke}` }} />
      <span style={{ ...base, bottom: inset, left: inset, borderBottom: `1.5px solid ${stroke}`, borderLeft: `1.5px solid ${stroke}` }} />
      <span style={{ ...base, bottom: inset, right: inset, borderBottom: `1.5px solid ${stroke}`, borderRight: `1.5px solid ${stroke}` }} />
    </span>
  );
}

/** A readout panel with the angular clip, glow border and corner brackets in one wrapper. */
export function HudPanel({ children, className = "", glow = true }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`hud-panel relative ${glow ? "hud-glow" : ""} ${className}`}>
      <CornerBrackets />
      {children}
    </div>
  );
}
