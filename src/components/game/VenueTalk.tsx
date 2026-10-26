import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { CAST, discovered, greeting, openTopics, type Topic } from "@/game/venue-life";
import { useVoiceLine } from "./useVoiceLine";

/** A conversation with someone in a venue (venue-life.ts CAST): their greeting shows they remember you, then you pick what
 * to ask about. New topics open on later nights and after you've done things there; a few lead to a one-time discovery. */
export function VenueTalk({ npc, progression, onTopic, onClose }: { npc: string; progression: PlayerProgression; onTopic: (t: Topic) => void; onClose: () => void }) {
  const c = CAST.find((x) => x.id === npc);
  // greeting and topics are fixed when the conversation opens (GameCanvas records tonight's talk when it ends, however it ends)
  const lines = useMemo(() => greeting(progression, npc), []); // eslint-disable-line react-hooks/exhaustive-deps
  const topics = useMemo(() => openTopics(progression, npc), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [asked, setAsked] = useState<Topic | null>(null);
  const said = asked ? asked.text : lines.map((l) => l.text).join(" ");
  useVoiceLine(`venue-talk-${npc}-${asked?.id ?? "hello"}`, c?.name ?? "NPC", said, "story");
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  if (!c) return null;
  return (
    <div className="fixed inset-x-0 bottom-28 z-[65] mx-auto w-[min(94vw,560px)]" role="dialog" aria-label={`Talking to ${c.name}`}>
      <div className="hud-panel p-4">
        <p className="hud-label">{c.name} · {c.role}</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{said}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {topics.map((t) => (
            <Button key={t.id} size="sm" variant={asked?.id === t.id ? "default" : "outline"} onClick={() => { setAsked(t); onTopic(t); }}>
              {t.title}{t.discovery && !discovered(progression, t.id) ? " ·  new" : ""}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={onClose}>Goodbye</Button>
        </div>
      </div>
    </div>
  );
}
