import { CLASS_CARDS, cardFor } from "@/game/weapon-class-cards";

/** The Arsenal's six class cards: Auto, Scout, Sniper, Shotgun, SMG and Heavy, each with the real bars of the gun it stands for. */
export function WeaponClassCards() {
  return <section className="mx-auto mt-5 max-w-6xl" aria-label="Weapon classes">
    <p className="ui-kicker">Weapon classes</p>
    <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {CLASS_CARDS.map((c) => { const k = cardFor(c); return <article key={k.id} className="border bg-background/60 p-3" style={{ borderColor: k.color }}>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: k.color }}>{k.label}</p>
        <h3 className="mt-1 font-mono text-sm uppercase tracking-widest">{k.name}</h3>
        <dl className="mt-3 space-y-2">{k.stats.map((s) => <div key={s.label}>
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground"><dt>{s.label}</dt><dd>{s.label === "Mag size" ? k.mag : s.pct}</dd></div>
          <div className="mt-0.5 h-1.5 bg-foreground/10"><div className="h-full" style={{ width: `${s.pct}%`, background: k.color }} /></div>
        </div>)}</dl>
      </article>; })}
    </div>
  </section>;
}
