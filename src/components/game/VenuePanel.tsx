import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { venueEvent } from "@/game/nightlife";
import { FOURBEAT_BPM, challengeClaimed, challengesAt, hadSpecialTonight, specialAt, type CastMember } from "@/game/venue-life";

/** What you can do inside a venue (venue-life.ts): talk to whoever you're standing near, order tonight's house special,
 * try the Four-Beat Dance, and see the venue's small challenges. Sits on the right so the dance/arcade buttons keep the centre. */
export function VenuePanel({ venueId, name, progression, hour, near, onTalk, onSpecial, onFourBeat }: {
  venueId: string; name: string; progression: PlayerProgression; hour: number; near: CastMember[];
  onTalk: (id: string) => void; onSpecial: () => void; onFourBeat: (() => void) | null;
}) {
  const special = specialAt(venueId), had = hadSpecialTonight(progression, venueId);
  const event = venueEvent(venueId, hour);
  const challenges = challengesAt(venueId);
  return (
    <div className="pointer-events-none absolute right-4 top-1/3 z-[60] w-[min(80vw,280px)]">
      <div className="hud-panel pointer-events-auto p-3">
        <p className="hud-label">{name}</p>
        {event && <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Tonight · {event.title}</p>}
        {special && (
          <div className="mt-2">
            <Button size="sm" variant="outline" className="w-full justify-between" disabled={had} onClick={onSpecial}>
              <span>{special.name}</span><span className="font-mono text-[10px]">{had ? "had tonight" : `${special.price} Nex`}</span>
            </Button>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{special.blurb}</p>
          </div>
        )}
        {onFourBeat && FOURBEAT_BPM[venueId] && <Button size="sm" variant="outline" className="mt-2 w-full" onClick={onFourBeat}>Four-Beat Dance</Button>}
        {near.map((c) => <Button key={c.id} size="sm" className="mt-2 w-full" onClick={() => onTalk(c.id)}>Talk to {c.name}</Button>)}
        {challenges.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-border/50 pt-2">
            {challenges.map((c) => {
              const done = challengeClaimed(progression, c.id), n = Math.min(c.target, c.progress(progression));
              return <li key={c.id} className="text-[11px] leading-snug"><span className={done ? "text-primary" : "text-foreground"}>{done ? "✓ " : ""}{c.title}</span>{" "}<span className="font-mono text-muted-foreground">{done ? "" : `${n}/${c.target}`}</span><br /><span className="text-muted-foreground">{c.blurb}</span></li>;
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
