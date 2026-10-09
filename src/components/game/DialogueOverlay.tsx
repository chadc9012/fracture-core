import { useEffect, useState } from "react";
import type { DialogueLine } from "@/game/dialogue";
import { useVoiceLine } from "./useVoiceLine";

/**
 * Typewriter dialogue box — one line at a time, with centralized spoken playback while it reveals;
 * advance/skip on the same interact key the rest of the
 * game already uses for a one-shot prompt (E / Enter), matching AwakeningOverlay's pattern.
 */
export function DialogueOverlay({ lines, onDone }: { lines: DialogueLine[]; onDone: () => void }) {
  const [lineIndex, setLineIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const line = lines[lineIndex];
  useVoiceLine(`npc-dialogue-${lineIndex}`, line?.speaker ?? "NPC", line?.text, "story");

  useEffect(() => { setShown(0); }, [lineIndex]);

  useEffect(() => {
    if (!line || shown >= line.text.length) return;
    const t = setTimeout(() => {
      setShown((s) => s + 1);
    }, 22);
    return () => clearTimeout(t);
  }, [shown, line]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE" && e.code !== "Enter" && e.code !== "Space") return;
      if (!line) return;
      if (shown < line.text.length) { setShown(line.text.length); return; }
      if (lineIndex + 1 < lines.length) setLineIndex((i) => i + 1);
      else onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, line, lineIndex, lines.length, onDone]);

  if (!line) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-30 mx-auto w-[min(92vw,520px)] border border-border bg-background/85 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">{line.speaker}</p>
      <p className="mt-1 min-h-10 text-sm text-foreground">{line.text.slice(0, shown)}</p>
      <p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {shown < line.text.length ? "E to skip" : lineIndex + 1 < lines.length ? "E to continue" : "E to close"}
      </p>
    </div>
  );
}
