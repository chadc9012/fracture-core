import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import horizon from "@/assets/world-fracture-horizon.png.asset.json";
import { playIntroSwell, unlockAudio } from "@/game/audio";
import { classById, type ClassId } from "@/game/loadout";
import { PAD_LABELS, moveFocus } from "@/game/menu-nav";
import type { SaveSummary } from "@/game/startup";
import { ConfirmDialog } from "./ConfirmDialog";
import { CreditsPanel } from "./CreditsPanel";
import { useMenuInput } from "./useMenuInput";

type Item = { id: "continue" | "new" | "character" | "settings" | "credits"; label: string; hint: string };
const ITEMS: Item[] = [
  { id: "continue", label: "Continue", hint: "Resume your saved game" },
  { id: "new", label: "New Game", hint: "Create an operator and deploy" },
  { id: "character", label: "Character", hint: "Operator, subclass and body profile" },
  { id: "settings", label: "Settings", hint: "Controls, audio, display, accessibility" },
  { id: "credits", label: "Credits", hint: "Who and what made this" },
];

export function MainMenu({ save, classId, reducedMotion, startNotice, onContinue, onNewGame, onCharacter, onSettings }: {
  startNotice?: string;
  save: SaveSummary; classId: ClassId;reducedMotion: boolean;
  onContinue: () => void; onNewGame: () => void; onCharacter: () => void; onSettings: () => void;
}) {
  const enabled = useMemo(() => ITEMS.map(() => true), []);
  const [index, setIndex] = useState(() => (save.hasSave ? 0 : 1)); // land on New Game when there is nothing to continue
  const [notice, setNotice] = useState("");
  const [overlay, setOverlay] = useState<null | "confirm-new" | "credits">(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // First deliberate input unlocks the procedural audio engine (same rule as the rest of the game); nothing plays before that.
  const swelled = useRef(false);
  useEffect(() => {
    const greet = () => { if (swelled.current) return; swelled.current = true; unlockAudio(); playIntroSwell(); };
    window.addEventListener("pointerdown", greet); window.addEventListener("keydown", greet);
    return () => { window.removeEventListener("pointerdown", greet); window.removeEventListener("keydown", greet); };
  }, []);

  const go = (fn: () => void) => {
    if (reducedMotion) { fn(); return; }
    setLeaving(true);
    timer.current = window.setTimeout(fn, 260);
  };

  const activate = (item: Item) => {
    setNotice("");
    switch (item.id) {
      case "continue":
        if (!save.hasSave) { setNotice("No saved game found on this device. Choose New Game to begin."); return; }
        go(onContinue); return;
      case "new":
        if (save.hasSave) setOverlay("confirm-new"); else go(onNewGame);
        return;
      case "character": go(onCharacter); return;
      case "settings": onSettings(); return;
      case "credits": setOverlay("credits"); return;
    }
  };

  const pad = useMenuInput(overlay === null && !leaving, (intent) => {
    if (intent === "up" || intent === "down") setIndex((i) => moveFocus(i, intent === "down" ? 1 : -1, enabled));
    else if (intent === "confirm") { const item = ITEMS[index]; if (item) activate(item); }
    else if (intent === "back") setNotice("This is the main menu. Choose an option to continue.");
  });
  const labels = PAD_LABELS[pad ?? "generic"];
  const cls = classById(classId);

  return (
    <div className={`fixed inset-0 overflow-hidden bg-background transition-opacity duration-200 ${leaving ? "opacity-0" : "opacity-100"}`}>
      {/* cinematic backdrop: the Fractured Earth horizon on a slow push-in, drifting light and shadow sweeps and low mist; pure CSS, so it needs no WebGL and costs no draw calls.
          Reduced motion freezes every layer (styles.css). */}
      <img src={horizon.url} alt="" className="title-landscape absolute inset-0 h-full w-full object-cover object-center" />
      <div className="title-sunlight pointer-events-none absolute inset-0" />
      <div className="title-shadows pointer-events-none absolute inset-0" />
      <div className="title-mist pointer-events-none absolute inset-x-0 bottom-0 h-2/5" />
      <div className="pointer-events-none absolute inset-0 title-vignette" />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/95 via-background/65 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/40" />
      <main className="relative z-10 flex h-full min-h-0 flex-col overflow-y-auto px-6 py-8 sm:px-[7vw] sm:py-12">
        <header className="flex items-start justify-between gap-4">
          <div><p className="font-mono text-[10px] uppercase tracking-normal text-primary">NOVA // Command network</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-normal text-foreground/60">Nexus orbit · System online</p></div>
          <p className="hidden border border-foreground/20 bg-background/30 px-3 py-2 font-mono text-[10px] uppercase tracking-normal text-foreground/70 sm:block">World status // Fractured</p>
        </header>
        <div className="my-auto max-w-[45rem] py-10">
          <p className="mb-4 border-l-2 border-primary pl-3 font-mono text-[11px] uppercase tracking-normal text-primary">A world worth reclaiming</p>
          <h1 className="title-glow text-5xl font-black uppercase leading-[0.88] tracking-normal text-foreground sm:text-7xl lg:text-[6rem]">WORLD<br />FRACTURE</h1>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">The sky broke. The worlds collided. Your story begins at the edge of the Fracture.</p>
          {save.hasSave && <p className="mt-5 border-l border-primary/70 pl-3 font-mono text-[11px] uppercase tracking-normal text-primary">{save.name ?? cls.name} · Level {save.level} · {save.missions} missions complete</p>}
          <nav aria-label="Main menu" className="mt-9 grid w-full max-w-lg gap-2">
            {ITEMS.map((item, i) => { const active = i === index; const dim = item.id === "continue" && !save.hasSave;
              return <Button variant="ghost" key={item.id} type="button" onClick={() => { setIndex(i); activate(item); }} onMouseEnter={() => setIndex(i)} onFocus={() => setIndex(i)} aria-current={active ? "true" : undefined}
                className={`group flex h-auto rounded-none whitespace-normal min-h-14 items-center justify-between gap-3 border px-5 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${active ? "border-primary bg-primary/15 text-foreground ui-focus" : "border-foreground/15 bg-background/35 text-muted-foreground hover:border-foreground/50"} ${dim ? "opacity-60" : ""}`}>
                <span className="font-mono text-sm font-bold uppercase tracking-normal">{item.label}</span>
                <span className="hidden text-right text-xs text-muted-foreground sm:block">{item.hint}</span>
                <span aria-hidden="true" className="text-primary">{active ? "◆" : "›"}</span>
              </Button>;
            })}
            <p className="min-h-5 font-mono text-xs text-primary" role="status" aria-live="polite">{startNotice || notice}</p>
          </nav>
        </div>
        <footer className="flex flex-wrap justify-between gap-3 border-t border-foreground/20 pt-4 font-mono text-[10px] uppercase tracking-normal text-foreground/65">
          <span>↑↓ / W S / {labels.nav} Navigate · Enter / {labels.confirm} Select</span><span>Esc / {labels.back} Back</span>
        </footer>
      </main>

      {overlay === "confirm-new" && (
        <ConfirmDialog pad={pad} title="Start a new game?" confirmLabel="New Game" cancelLabel="Keep my save"
          body="You have saved progress. Starting a new game keeps it: your current game is parked in a free save slot and a fresh run begins. Nothing is erased, and you can switch back any time from Saves. If every slot is in use, New Game is refused until you free one."
          onCancel={() => setOverlay(null)} onConfirm={() => { setOverlay(null); go(onNewGame); }} />
      )}
      {overlay === "credits" && <CreditsPanel pad={pad} onClose={() => setOverlay(null)} />}
    </div>
  );
}
