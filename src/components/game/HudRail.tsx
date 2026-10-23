import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Destiny-style HUD rails: the panels that used to be pinned at hand-picked fixed offsets (mission tracker, tracked objectives,
 * quest line on the right; activity card, world events, cloud badge on the left) overlapped each other whenever two were up at once.
 * Each now portals into one column per side and stacks in `order`, so they never collide. The rail strips the panel's own fixed /
 * absolute offsets (styles.css `.wf-rail-item > *`). Without a rail in the page the panel renders where it is, unchanged. */
export function HudRails() {
  return <>
    <div id="wf-rail-left" className="wf-rail wf-rail-left" />
    <div id="wf-rail-right" className="wf-rail wf-rail-right" />
  </>;
}

export function HudRail({ side, order, children }: { side: "left" | "right"; order: number; children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setEl(document.getElementById(`wf-rail-${side}`)); }, [side]);
  if (!el) return <>{children}</>;
  return createPortal(<div className="wf-rail-item" style={{ order }}>{children}</div>, el);
}
