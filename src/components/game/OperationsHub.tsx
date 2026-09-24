import { useMemo, useState } from "react";
import { Activity, Anvil, Check, ChevronRight, Coins, LockKeyhole, Network, PackageOpen, Shield, Skull, Snowflake, Timer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ABILITY_NODES, DEFAULT_BUILD, buildSynergy, nodeById, type ActiveBuild } from "@/game/ability-network";
import { DUNGEONS } from "@/game/dungeons";
import { ARMOR_MANIFEST, EQUIPMENT_COUNTS, WEAPON_MANIFEST, type WeaponTier } from "@/game/equipment";
import { STARTING_WALLET, UPGRADE_RECIPES, VENDORS, canAfford, spend, type Wallet } from "@/game/economy";
import { advanceEncounter, createEncounterRun, loseEncounterLife } from "@/game/raid-stages";
import type { PlayerProgression } from "@/game/progression";

type HubView = "DUNGEONS" | "ARSENAL" | "ABILITIES";

const currencyLabel = { credits: "Credits", dataShards: "Data Shards", spatialCores: "Spatial Cores" } as const;

export function OperationsHub({ initialView = "DUNGEONS", progression, onProgression, onClose }: { initialView?: HubView; progression: PlayerProgression; onProgression: (next: PlayerProgression) => void; onClose: () => void }) {
  const [view, setView] = useState<HubView>(initialView);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-xl">
      <div className="mx-auto min-h-full max-w-7xl px-4 py-5 sm:px-7">
        <header className="flex items-start justify-between border-b border-border pb-4">
          <div><p className="font-mono text-[9px] uppercase tracking-[0.38em] text-primary">Nexus operations terminal</p><h2 className="mt-1 font-mono text-2xl font-semibold sm:text-3xl">FIELD SYSTEMS</h2></div>
          <Button size="icon" variant="outline" onClick={onClose} aria-label="Close operations"><X /></Button>
        </header>
        <nav className="grid grid-cols-3 border-b border-border" aria-label="Operations sections">
          {(["DUNGEONS", "ARSENAL", "ABILITIES"] as const).map((item) => <Button key={item} variant="ghost" onClick={() => setView(item)} className={`h-12 rounded-none border-b-2 font-mono text-[9px] uppercase tracking-[0.18em] ${view === item ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{item}</Button>)}
        </nav>
        {view === "DUNGEONS" && <DungeonOperations />}
        {view === "ARSENAL" && <Arsenal />}
        {view === "ABILITIES" && <AbilityNetwork progression={progression} onProgression={onProgression} />}
      </div>
    </div>
  );
}

function DungeonOperations() {
  const [selectedId, setSelectedId] = useState(DUNGEONS[0]?.id ?? "");
  const dungeon = DUNGEONS.find((entry) => entry.id === selectedId) ?? DUNGEONS[0];
  const [run, setRun] = useState(() => dungeon ? createEncounterRun(dungeon) : null);
  if (!dungeon || !run) return null;
  const stage = dungeon.stages[run.stageIndex];
  const selectDungeon = (id: string) => {
    const next = DUNGEONS.find((entry) => entry.id === id);
    if (!next) return;
    setSelectedId(id);
    setRun(createEncounterRun(next));
  };
  const reset = () => setRun(createEncounterRun(dungeon));
  return <main className="grid gap-6 py-6 lg:grid-cols-[0.72fr_1.28fr]">
    <section><p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Private fireteam · 1–3 players</p><h3 className="mt-2 text-2xl font-semibold">Dungeon Operations</h3><div className="mt-5 space-y-2">{DUNGEONS.map((entry) => <Button key={entry.id} variant="ghost" onClick={() => selectDungeon(entry.id)} className={`h-auto w-full justify-start rounded-none border p-4 text-left whitespace-normal ${entry.id === dungeon.id ? "border-primary bg-primary/10" : "border-border bg-card/40"}`}><span className="w-full"><span className="flex items-center justify-between gap-3"><b className="font-mono text-sm">{entry.name}</b><span className="text-[9px] text-muted-foreground">{entry.duration}</span></span><span className="mt-1 block text-xs text-muted-foreground">{entry.region} · {entry.hazard}</span></span></Button>)}</div></section>
    <section className="min-w-0 border-l border-border pl-0 lg:pl-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div><p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">{dungeon.region}</p><h3 className="mt-1 font-mono text-2xl">{dungeon.name}</h3><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{dungeon.identity}</p></div><div className="grid grid-cols-2 gap-2 text-center font-mono text-[9px] uppercase"><div className="border border-border p-3"><Timer className="mx-auto mb-1 size-4 text-primary" />{dungeon.duration}</div><div className="border border-border p-3"><Shield className="mx-auto mb-1 size-4 text-primary" />{dungeon.maxLives} lives</div></div></div>
      <div className="mt-6 grid gap-2 sm:grid-cols-3">{dungeon.stages.map((item, index) => <div key={item.id} className={`border p-3 ${index === run.stageIndex && run.status !== "COMPLETE" ? "border-primary bg-primary/10" : "border-border bg-card/30"}`}><p className="font-mono text-[9px] text-muted-foreground">0{index + 1} · {item.type.replace("_", " ")}</p><p className="mt-2 text-sm font-medium">{item.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.objective}</p></div>)}</div>
      <div className="mt-5 border border-border bg-card/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">Signature exotic · fixed identity</p><p className="mt-1 text-lg font-semibold">{dungeon.signature.name}</p><p className="text-xs text-muted-foreground">{dungeon.signature.perk}</p></div><span className="border border-primary px-3 py-2 font-mono text-[9px] text-primary">{dungeon.signature.type}</span></div>
        <p className="mt-3 text-[10px] text-muted-foreground">Repeat traits: {dungeon.signature.repeatTraits.join(" · ")}</p>
      </div>
      <div className="mt-5 border border-border p-4">
        <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Live encounter simulation</p><h4 className="mt-1 text-lg font-semibold">{run.status === "COMPLETE" ? "Cache secured" : run.status === "WIPED" ? "Fireteam lost" : stage?.name}</h4><p className="mt-1 text-xs text-muted-foreground">{run.message}</p></div><div className="text-right font-mono text-[10px]"><p>{run.lives} SHARED LIVES</p><p className="text-primary">{run.status}</p></div></div>
        <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3"><div><div className="flex justify-between text-[9px] uppercase text-muted-foreground"><span>{stage?.hazardLabel ?? "STABILITY"}</span><span>{run.hazard}%</span></div><div className="mt-1 h-2 overflow-hidden bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${run.hazard}%` }} /></div></div><span className="font-mono text-xs">{run.progress}/{stage?.target ?? run.progress}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">{run.status === "READY" && <Button onClick={() => setRun({ ...run, status: "ACTIVE", message: `Entered ${stage?.name ?? dungeon.name}.` })}>Launch privately <ChevronRight /></Button>}{run.status === "ACTIVE" && <><Button onClick={() => setRun(advanceEncounter(dungeon, run))}>Advance objective <ChevronRight /></Button><Button variant="outline" onClick={() => setRun(loseEncounterLife(dungeon, run))}><Skull /> Lose shared life</Button></>}{(run.status === "COMPLETE" || run.status === "WIPED") && <Button onClick={reset}>{run.status === "COMPLETE" ? "Run again" : "Retry checkpoint"}</Button>}</div>
      </div>
    </section>
  </main>;
}

function Arsenal() {
  const [wallet, setWallet] = useState<Wallet>(STARTING_WALLET);
  const [tier, setTier] = useState<WeaponTier>("T1");
  const [condition, setCondition] = useState(73);
  const [notice, setNotice] = useState("Select a forge operation or vendor offer.");
  const recipe = UPGRADE_RECIPES.find((entry) => entry.from === tier);
  const samples = WEAPON_MANIFEST.filter((item) => item.tier === tier).slice(0, 6);
  const craft = () => { if (!recipe || !canAfford(wallet, recipe.costs, recipe.tax)) { setNotice("Insufficient resources for this upgrade."); return; } setWallet(spend(wallet, recipe.costs, recipe.tax)); setTier(recipe.to); setNotice(`${recipe.label} complete. Frame advanced to ${recipe.to}.`); };
  const repairCost = 100 - condition;
  return <main className="py-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Nexus equipment registry</p><h3 className="mt-1 text-2xl font-semibold">Arsenal & Forge</h3><p className="mt-1 text-xs text-muted-foreground">{EQUIPMENT_COUNTS.weapons} weapons · {EQUIPMENT_COUNTS.armor} armor pieces · validated master manifest</p></div><div className="flex gap-3 font-mono text-[10px]"><span><Coins className="mr-1 inline size-3 text-primary" />{wallet.credits} CR</span><span>{wallet.dataShards} DATA</span><span>{wallet.spatialCores} CORES</span></div></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section><div className="flex overflow-x-auto border-b border-border">{(["T1", "T2", "T3", "T4", "T5", "S"] as WeaponTier[]).map((item) => <Button key={item} variant="ghost" onClick={() => setTier(item)} className={`rounded-none border-b-2 ${tier === item ? "border-primary text-primary" : "border-transparent"}`}>{item}</Button>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{samples.map((item) => <div key={item.id} className="border border-border bg-card/30 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm">{item.name}</p><p className="mt-1 text-[9px] uppercase text-primary">{item.archetype} · {item.element}</p></div><span className="font-mono text-[9px]">DUR {item.durability}</span></div><p className="mt-3 text-xs text-muted-foreground">{item.perk}</p><p className="mt-2 text-[9px] text-muted-foreground">{item.source}</p></div>)}</div>
        {recipe && <div className="mt-5 border border-primary/50 bg-primary/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">{tier} → {recipe.to}</p><h4 className="mt-1 text-lg">{recipe.label}</h4><p className="text-xs text-muted-foreground">{recipe.source} · {recipe.tax} credit crafting tax</p></div><Button onClick={craft} disabled={!canAfford(wallet, recipe.costs, recipe.tax)}><Anvil /> Upgrade frame</Button></div><div className="mt-3 flex flex-wrap gap-2">{Object.entries(recipe.costs).map(([key, value]) => <span key={key} className="border border-border px-2 py-1 font-mono text-[9px]">{key.replace(/([A-Z])/g, " $1")} {value}</span>)}</div></div>}
        <div className="mt-3 flex items-center justify-between border border-border p-3"><div><p className="font-mono text-[9px] uppercase text-muted-foreground">Equipped frame condition</p><p className="mt-1 text-sm">{condition}% · upkeep cost {repairCost} Credits</p></div><Button size="sm" variant="outline" disabled={condition === 100 || wallet.credits < repairCost} onClick={() => { setWallet({ ...wallet, credits: wallet.credits - repairCost }); setCondition(100); setNotice("Equipped frame restored to full condition."); }}>Repair</Button></div>
      </section>
      <section><p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Vendor districts</p><div className="mt-3 space-y-2">{VENDORS.map((vendor) => { const affordable = wallet[vendor.currency] >= vendor.price; return <div key={vendor.id} className="border border-border p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-sm">{vendor.name}</p><p className="text-[10px] text-muted-foreground">{vendor.district} · {vendor.offer}</p></div><Button size="sm" variant="outline" disabled={!affordable} onClick={() => { setWallet({ ...wallet, [vendor.currency]: wallet[vendor.currency] - vendor.price }); setNotice(`${vendor.name} purchase secured.`); }}><PackageOpen /> {vendor.price} {currencyLabel[vendor.currency]}</Button></div></div>; })}</div>
        <div className="mt-5 border-l-2 border-primary bg-card/30 p-4"><p className="font-mono text-[9px] uppercase text-primary">Terminal report</p><p className="mt-1 text-xs text-muted-foreground">{notice}</p></div>
        <div className="mt-5"><p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Armor registry sample</p><div className="mt-2 grid grid-cols-2 gap-2">{ARMOR_MANIFEST.slice(80, 86).map((item) => <div key={item.id} className="border border-border p-2"><p className="text-[11px]">{item.name}</p><p className="mt-1 text-[9px] text-primary">{item.classId} · {item.slot}</p></div>)}</div></div>
      </section>
    </div>
  </main>;
}

function AbilityNetwork({ progression, onProgression }: { progression: PlayerProgression; onProgression: (next: PlayerProgression) => void }) {
  const [build, setBuild] = useState<ActiveBuild>(progression.activeBuild ?? DEFAULT_BUILD);
  const [selected, setSelected] = useState(ABILITY_NODES[0]?.id ?? "fracture-shield");
  const [saved, setSaved] = useState(false);
  const synergy = useMemo(() => buildSynergy(build), [build]);
  const selectedNode = nodeById(selected);
  const mastery = { COMBAT: 34, SYSTEMS: 34, EXPLORATION: 31 } as const;
  const selectedUnlocked = selectedNode ? progression.unlockedAbilities.includes(selectedNode.id) || mastery[selectedNode.stream] >= selectedNode.cost : false;
  const equip = () => { if (!selectedNode || !selectedUnlocked) return; setBuild({ ...build, slots: { ...build.slots, [selectedNode.slot]: selectedNode.id } }); setSaved(false); };
  return <main className="py-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">Fracture Core station</p><h3 className="mt-1 text-2xl font-semibold">Ability Network</h3><p className="mt-1 text-xs text-muted-foreground">Cross-class paths unlock through combat, systems, and exploration mastery.</p></div><div className="flex gap-1">{(["SOLO", "HYBRID", "TEAM"] as const).map((mode) => <Button key={mode} size="sm" variant={build.mode === mode ? "default" : "outline"} onClick={() => setBuild({ ...build, mode })}>{mode}</Button>)}</div></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
       <section className="relative min-h-[420px] overflow-hidden border border-border bg-card/20 p-4 fracture-grid"><div className="relative z-10 grid grid-cols-3 gap-x-4 gap-y-12">{ABILITY_NODES.map((node) => { const active = Object.values(build.slots).includes(node.id); const unlocked = progression.unlockedAbilities.includes(node.id) || mastery[node.stream] >= node.cost; return <Button key={node.id} variant="ghost" onClick={() => setSelected(node.id)} className={`h-auto min-h-24 rounded-none border p-3 text-left whitespace-normal ${selected === node.id ? "border-primary bg-primary/15" : active ? "border-primary/60 bg-card" : "border-border bg-background/70"}`}><span><span className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] text-primary">{node.classId}</span>{active ? <Check className="size-3 text-primary" /> : !unlocked ? <LockKeyhole className="size-3 text-muted-foreground" /> : null}</span><span className="mt-2 block text-xs font-medium">{node.name}</span><span className="mt-1 block text-[9px] text-muted-foreground">{node.slot} · {node.stream} {node.cost}</span></span></Button>; })}</div></section>
      <section><div className="border border-border p-4"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">Selected node</p><h4 className="mt-2 text-xl">{selectedNode?.name}</h4><p className="mt-1 text-xs text-muted-foreground">{selectedNode?.description}</p><div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px]"><span>{selectedNode?.classId} · {selectedNode?.slot}</span><Button size="sm" onClick={equip} disabled={!selectedUnlocked}>{selectedUnlocked ? "Equip node" : `Requires ${selectedNode?.cost} ${selectedNode?.stream}`}</Button></div></div>
        <div className="mt-4 border border-border p-4"><p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Active loadout</p>{(["PRIMARY", "TACTICAL", "ULTIMATE"] as const).map((slot) => { const node = nodeById(build.slots[slot]); return <div key={slot} className="mt-3 flex items-center justify-between border-b border-border pb-2"><span className="text-[10px] text-muted-foreground">{slot}</span><span className="text-sm">{node?.name} <b className="ml-2 font-mono text-[9px] text-primary">{node?.classId}</b></span></div>; })}<div className="mt-4 flex items-center justify-between"><div><p className="text-sm font-semibold">{synergy.archetype}</p><p className="font-mono text-[9px] text-primary">+{synergy.bonus}% RESONANCE SYNERGY</p></div><Button variant="outline" onClick={() => { setSaved(true); onProgression({ ...progression, activeBuild: build, unlockedAbilities: Array.from(new Set([...progression.unlockedAbilities, ...Object.values(build.slots)])) }); }}>{saved ? <Check /> : <Network />}{saved ? "Saved" : "Save build"}</Button></div></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center font-mono text-[9px]"><div className="border border-border p-3"><Activity className="mx-auto mb-1 size-4 text-primary" />COMBAT {mastery.COMBAT}</div><div className="border border-border p-3"><Network className="mx-auto mb-1 size-4 text-primary" />SYSTEMS {mastery.SYSTEMS}</div><div className="border border-border p-3"><Snowflake className="mx-auto mb-1 size-4 text-primary" />EXPLORE {mastery.EXPLORATION}</div></div>
      </section>
    </div>
  </main>;
}