import { Crosshair, LogOut, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import horizon from "@/assets/world-fracture-horizon.png.asset.json";
import { Button } from "@/components/ui/button";
import { playIntroSwell, unlockAudio } from "@/game/audio";
import { TitleBackdrop } from "./TitleBackdrop";

export function TitleScreen({
  canContinue,
  onContinue,
  onNewGame,
  onSettings,
}: {
  canContinue: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onSettings: () => void;
}) {
  const [notice, setNotice] = useState("");

  /* First touch/key on the title screen unlocks the procedural audio engine and plays a soft
   * ambient swell — same "unlock on first input" rule Scene.tsx follows, just reached one screen
   * earlier so the menu isn't silent. No sound files, matching the rest of the game's audio. */
  const swelled = useRef(false);
  useEffect(() => {
    const greet = () => {
      if (swelled.current) return;
      swelled.current = true;
      unlockAudio();
      playIntroSwell();
    };
    window.addEventListener("pointerdown", greet);
    window.addEventListener("keydown", greet);
    return () => {
      window.removeEventListener("pointerdown", greet);
      window.removeEventListener("keydown", greet);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <div className="absolute inset-0">
        <img src={horizon.url} alt="A fractured world rejoining at sunrise" className="title-landscape h-full w-full object-cover object-center" />
      </div>
      <TitleBackdrop />
      <div className="pointer-events-none absolute inset-0 title-sunlight" />
      <div className="pointer-events-none absolute inset-0 title-shadows" />
      <div className="pointer-events-none absolute inset-0 title-vignette" />
      <main className="pointer-events-none relative z-10 flex h-full flex-col justify-between overflow-y-auto px-6 py-7 sm:px-12 sm:py-10">
        <header className="title-intro-fade">
          <p className="font-mono text-[9px] uppercase tracking-[0.42em] text-primary">Signal recovered · Nexus orbit</p>
          <div className="mt-4 h-px w-24 bg-primary/70" />
        </header>

        <section className="title-intro-rise max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-muted-foreground">The first collapse</p>
          <h1 className="title-glow mt-3 font-mono text-5xl font-bold tracking-[0.12em] text-foreground sm:text-7xl lg:text-8xl">WORLD<br />FRACTURE</h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">Reality is unstable. Territory remembers every battle. Enter as a Resonant and choose who controls what remains.</p>

          <div className="pointer-events-auto mt-8 flex w-full max-w-sm flex-col items-stretch gap-1" aria-label="Main menu">
            <Button className="h-11 justify-start rounded-none border-l-2 pl-4 font-mono uppercase tracking-[0.2em]" onClick={onNewGame}><Crosshair /> New Game</Button>
            <Button variant="ghost" disabled={!canContinue} className="h-10 justify-start rounded-none pl-4 font-mono uppercase tracking-[0.2em]" onClick={onContinue}>Continue</Button>
            <Button variant="ghost" className="h-10 justify-start rounded-none pl-4 font-mono uppercase tracking-[0.2em]" onClick={onSettings}><Settings /> Settings</Button>
            <Button variant="ghost" className="h-10 justify-start rounded-none pl-4 font-mono uppercase tracking-[0.2em]" onClick={() => setNotice("Exit is available in the installed game build.")}><LogOut /> Exit</Button>
          </div>
          {notice && <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{notice}</p>}
        </section>

        <footer className="title-intro-fade flex flex-wrap items-end justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Build WF-01 · Online world simulation</span>
          <span>Core signal: unstable</span>
        </footer>
      </main>
    </div>
  );
}