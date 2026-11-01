import { Activity, ChevronRight, CloudRain, MapPin, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import { NextActivityCard } from "./NextActivityCard";
import { classById, subclassById, type AppearanceDefinition, type ClassId, type OperatorId, type SubclassId } from "@/game/loadout";
import type { BodyType } from "@/game/operators";
import { useMenuInput } from "./useMenuInput";
import { startsInResidences } from "@/game/story-start";

export type DeploymentBriefingData = {
  classId: ClassId;
  subclassId: SubclassId;
  appearance: AppearanceDefinition;
  bodyType: BodyType;
  deploymentId: string;
  operatorId: OperatorId;
};

export function DeploymentBriefing({ deployment, progression, onLaunch, onBack }: { deployment: DeploymentBriefingData; progression: PlayerProgression; onLaunch: () => void; onBack: () => void }) {
  useMenuInput(true, (intent) => {
    if (intent === "confirm") onLaunch();
    else if (intent === "back") onBack();
  }, ["confirm", "back"]);
  const operatorClass = classById(deployment.classId);
  const subclass = subclassById(deployment.subclassId);
  // a new character's story starts at home in Nexus City (story-start.ts), not in the forest
  const prologue = startsInResidences(progression);

  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 deployment-field" />
      <div className="absolute inset-0 fracture-grid opacity-30" />
      <div className="relative z-10 flex h-full flex-col px-5 py-5 sm:px-10 sm:py-8">
        <header className="flex items-center justify-between border-b border-foreground/15 pb-4">
          <div>
            <p className="ui-kicker">Deployment queue / 01</p>
            <h1 className="mt-1 font-mono text-xl uppercase sm:text-3xl">{prologue ? "Nexus City" : "Verdant Forest"}</h1>
          </div>
          <Button variant="ghost" onClick={onBack}>Back</Button>
        </header>

        {/* scrolls instead of spilling up over the header when the briefing is taller than the window */}
        <section className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6 sm:pb-10">
          <div className="mt-auto max-w-3xl pt-6 ui-enter">
            <p className="ui-kicker">{prologue ? "Prologue" : "First deployment"}</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-light leading-none sm:text-6xl">{prologue ? <>Before the Fracture<br /><span className="text-primary">Apartment 12-04</span></> : <>Mission 01<br /><span className="text-primary">First Resonance</span></>}</h2>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{prologue ? "An ordinary morning in Nexus City Residences, the last one before everything breaks. Wake up, get ready, and get out of the building when it starts." : "Materialize beyond the Nexus perimeter, complete NOVA’s field calibration, and secure the first stable signal."}</p>

            <div className="mt-8 grid max-w-2xl grid-cols-2 gap-px border-y border-foreground/15 bg-foreground/15 sm:grid-cols-4">
              <BriefStat icon={MapPin} label="Destination" value={prologue ? "Nexus City" : "Veridan"} />
              <BriefStat icon={Activity} label="Threat" value={prologue ? "None. Yet." : "Low"} />
              <BriefStat icon={CloudRain} label="Conditions" value={prologue ? "Clear morning" : "Rain mist"} />
              <BriefStat icon={Radio} label="Guide" value={prologue ? "Your neighbours" : "NOVA"} />
            </div>

            <div className="mt-5 max-w-md"><NextActivityCard progression={progression} /></div>
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="ui-kicker">Operator imprint</p>
                <p className="mt-1 font-mono text-sm uppercase">{deployment.appearance.callsign} · {operatorClass.name} / {subclass.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">Vehicle access locked until Mission 01 is complete.</p>
              </div>
              <Button size="lg" className="ui-focus min-w-52 justify-between rounded-none" onClick={onLaunch}>{prologue ? "Wake up" : "Launch mission"} <ChevronRight /></Button>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-foreground/15 pt-3 font-mono text-[9px] uppercase text-muted-foreground">
          <span>Fireteam / Solo</span><span>Signal lock / Ready</span>
        </footer>
      </div>
    </main>
  );
}

function BriefStat({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return <div className="bg-background/75 p-3 backdrop-blur-sm"><Icon className="size-4 text-primary" /><p className="ui-kicker mt-4">{label}</p><p className="mt-1 text-sm">{value}</p></div>;
}