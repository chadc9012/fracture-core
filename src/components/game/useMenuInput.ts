import { useEffect, useRef, useState } from "react";
import { NEW_PAD_NAV, keyIntent, padIntent, padKind, type MenuIntent, type PadKind } from "@/game/menu-nav";

/** Keyboard + standard-mapping gamepad intents for UI screens. Handlers are read through a ref so
 * the listeners and the rAF poll are attached once and cleaned up on unmount or when `active` flips.
 * Reports which pad family last produced input so prompts can show PlayStation or Xbox labels. */
export function useMenuInput(active: boolean, onIntent: (intent: MenuIntent, source: "keyboard" | "pad") => void, only?: readonly MenuIntent[]) {
  const handler = useRef(onIntent);
  handler.current = onIntent;
  const filter = useRef(only);
  filter.current = only;
  const [pad, setPad] = useState<PadKind | null>(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return; // never steal typing
      const intent = keyIntent(e.code);
      if (!intent || (filter.current && !filter.current.includes(intent))) return;
      // let buttons/links keep native Enter/Space; the menu handles those itself via focus index
      e.preventDefault();
      setPad(null);
      handler.current(intent, "keyboard");
    };
    window.addEventListener("keydown", onKey);

    let raf = 0, nav = NEW_PAD_NAV, lastKind: PadKind | null = null;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const pads = typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      const gp = pads.find((p): p is Gamepad => !!p && p.connected) ?? null;
      const r = padIntent(nav, gp ? { buttons: gp.buttons.map((b) => b.pressed), axes: gp.axes } : null, now);
      nav = r.next;
      if (r.intent && gp && (!filter.current || filter.current.includes(r.intent))) {
        const kind = padKind(gp.id);
        if (kind !== lastKind) { lastKind = kind; setPad(kind); }
        handler.current(r.intent, "pad");
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("keydown", onKey); cancelAnimationFrame(raf); };
  }, [active]);

  return pad;
}
