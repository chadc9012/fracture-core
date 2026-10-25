import { useEffect, useMemo, useState } from "react";
import { Award, Check, ChevronDown, Crown, Gem, Heart, Hourglass, Lock, Package, Shield, Skull, Sparkles, Swords, Users, X, Zap, Hexagon, type LucideIcon } from "lucide-react";
import { MAP_NODES, dungeonBrief, dungeonDeploy, nodeRadius, raidBrief, raidDeploy, type MapNode } from "@/game/director-activities";
import { RAID_INSTANCES } from "@/game/raid-instances";
import { gateColor } from "@/game/fracture-gates";
import { destinationInfo, STAGE } from "@/game/destination-map";
import type { PlayerProgression } from "@/game/progression";
import { useMenuInput } from "./useMenuInput";
import type { DeployTarget } from "./StarMap";

/** Hero art for the launch screens (built from the owner's dungeon-concepts and Hollow Star boards). */
const ART = import.meta.glob("../../assets/activities/*", { eager: true, import: "default" }) as Record<string, string>;
const heroArt = (file: string) => ART[`../../assets/activities/${file}`] ?? "";

const RAID_GOLD = "#e9c77b";
const nodeColor = (n: MapNode, p: PlayerProgression, now: number) => {
  if (n.kind === "RAID") return RAID_GOLD;
  const b = dungeonBrief(p, n.refId, now);
  return b ? gateColor(b.rank, b.gate.sealed).core : "#5ee7ff";
};

/* ---------------- the glyphs ---------------- */

/** dungeon: a diamond frame around a gate arch with a descending chevron (you go down) */
function DungeonGlyph({ color, r }: { color: string; r: number }) {
  const s = r * 0.92;
  return (
    <g>
      <rect x={-s * 0.72} y={-s * 0.72} width={s * 1.44} height={s * 1.44} transform="rotate(45)" fill="rgba(6,12,18,0.88)" stroke={color} strokeWidth={2.2} />
      <rect x={-s * 0.56} y={-s * 0.56} width={s * 1.12} height={s * 1.12} transform="rotate(45)" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      <path d={`M ${-s * 0.34} ${s * 0.3} V ${-s * 0.08} A ${s * 0.34} ${s * 0.34} 0 0 1 ${s * 0.34} ${-s * 0.08} V ${s * 0.3}`} fill="none" stroke="#fff" strokeWidth={2} />
      <path d={`M ${-s * 0.16} ${-s * 0.02} L 0 ${s * 0.14} L ${s * 0.16} ${-s * 0.02}`} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** raid: a double hexagon crest around a hollow star */
function RaidGlyph({ r }: { r: number }) {
  const hex = (k: number) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${Math.cos(a) * r * k},${Math.sin(a) * r * k}`; }).join(" ");
  const star = Array.from({ length: 8 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 4, k = i % 2 ? 0.22 : 0.5; return `${Math.cos(a) * r * k},${Math.sin(a) * r * k}`; }).join(" ");
  return (
    <g>
      <polygon points={hex(1)} fill="rgba(10,8,18,0.9)" stroke={RAID_GOLD} strokeWidth={2.4} />
      <polygon points={hex(0.8)} fill="none" stroke="rgba(233,199,123,0.45)" strokeWidth={1.2} />
      <polygon points={star} fill="none" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" />
      <circle r={r * 0.12} fill="#a970ff" stroke="#fff" strokeWidth={1} />
    </g>
  );
}

/* ---------------- the nodes on the planet ---------------- */

/** The activity nodes drawn over the painted planet (stage pixels), with Destiny's hover card. */
export function ActivityNodes({ progression, onOpen, focus, dim = false }: {
  progression: PlayerProgression;
  onOpen: (node: MapNode) => void;
  /** the selected destination: its nodes are drawn brighter */
  focus: string | null;
  dim?: boolean;
}) {
  const now = Date.now();
  const [hover, setHover] = useState<string | null>(null);
  const nodes = useMemo(() => MAP_NODES.map((n) => ({
    n, color: nodeColor(n, progression, now),
    brief: n.kind === "DUNGEON" ? dungeonBrief(progression, n.refId, now) : null,
    raid: n.kind === "RAID" ? raidBrief(progression, n.refId) : null,
  })), [progression, now]);
  const hovered = nodes.find((x) => x.n.id === hover) ?? null;

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} aria-hidden>
        {nodes.map(({ n, color, brief, raid }) => {
          const r = nodeRadius(n), on = hover === n.id, mine = focus === n.destination, done = brief?.clearedToday || raid?.cleared;
          return (
            <g key={n.id} transform={`translate(${n.at.x} ${n.at.y}) scale(${on ? 1.14 : 1})`} opacity={dim && !mine && !on ? 0.55 : 1} style={{ transition: "transform .15s" }}>
              {/* a gate open in the world today pulses; a raid always glows */}
              {(brief?.worldGate || n.kind === "RAID") && <circle r={r * 1.2} fill="none" stroke={color} strokeWidth={1.5} className="wf-node-pulse" />}
              <circle r={r * 1.25} fill={`${color}22`} />
              {n.kind === "RAID" ? <RaidGlyph r={r} /> : <DungeonGlyph color={color} r={r} />}
              {done && <g transform={`translate(${r * 0.78} ${-r * 0.78})`}><circle r={7} fill="#0c1a12" stroke="#7ef2b0" strokeWidth={1.5} /><path d="M -3.2 0 L -0.8 2.4 L 3.4 -2.4" fill="none" stroke="#7ef2b0" strokeWidth={1.8} /></g>}
              {brief && <text y={r + 15} textAnchor="middle" fontSize={12} fontWeight={700} letterSpacing={1.5} fill={color} stroke="#040a10" strokeWidth={3} paintOrder="stroke">{brief.rank}-RANK</text>}
              {n.kind === "RAID" && <text y={r + 16} textAnchor="middle" fontSize={12} fontWeight={700} letterSpacing={3} fill={RAID_GOLD} stroke="#040a10" strokeWidth={3} paintOrder="stroke">RAID</text>}
            </g>
          );
        })}
      </svg>
      {nodes.map(({ n }) => {
        const r = nodeRadius(n) * 1.3;
        const name = n.kind === "RAID" ? RAID_INSTANCES.find((x) => x.id === n.refId)?.name : nodes.find((x) => x.n.id === n.id)?.brief?.dungeon.name;
        return <button key={n.id} type="button" className="wf-node-hit" aria-label={`${n.kind === "RAID" ? "Raid" : "Dungeon"}: ${name ?? n.refId}`}
          style={{ left: `${((n.at.x - r) / STAGE.w) * 100}%`, top: `${((n.at.y - r) / STAGE.h) * 100}%`, width: `${((2 * r) / STAGE.w) * 100}%`, height: `${((2 * r) / STAGE.h) * 100}%` }}
          onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover((h) => (h === n.id ? null : h))} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
          onClick={() => onOpen(n)} />;
      })}
      {hovered && <NodeCard {...hovered} />}
    </>
  );
}

/** Destiny's hover card: a type band, the name, where it is, and the one line that matters */
function NodeCard({ n, color, brief, raid }: { n: MapNode; color: string; brief: ReturnType<typeof dungeonBrief>; raid: ReturnType<typeof raidBrief> }) {
  const right = n.at.x < STAGE.w * 0.62;
  const x = right ? n.at.x + nodeRadius(n) + 18 : n.at.x - nodeRadius(n) - 18;
  const y = Math.min(Math.max(n.at.y - 40, 70), STAGE.h - 260);
  const title = brief?.dungeon.name ?? raid?.raid.name ?? "";
  const place = brief ? brief.dungeon.place : raid ? raid.raid.entrance : "";
  return (
    <div className="wf-node-card" style={{ left: `${(x / STAGE.w) * 100}%`, top: `${(y / STAGE.h) * 100}%`, transform: right ? undefined : "translateX(-100%)", ["--node" as string]: color }}>
      <div className="wf-dest-in">
      <div className="wf-node-card-band">
        <p className="text-[0.75cqw] font-semibold uppercase tracking-[0.3em] opacity-80">{n.kind === "RAID" ? "Raid" : "Dungeon"} · {destinationInfo(n.destination).name}</p>
        <p className="mt-[0.2cqw] text-[1.45cqw] font-bold uppercase leading-none tracking-[0.06em]">{title}</p>
      </div>
      <div className="space-y-[0.45cqw] px-[0.9cqw] py-[0.7cqw] text-[0.88cqw] leading-snug">
        <p className="text-[#c7d8e0]">{place}</p>
        {brief && <p className="flex flex-wrap gap-x-[0.8cqw] font-semibold uppercase tracking-[0.12em] text-[#9fc3d3]">
          <span style={{ color }}>{brief.rank}-rank</span><span>{brief.depth.toLocaleString()} m</span><span>{brief.floors} floors</span><span>Fireteam 1–3</span>
        </p>}
        {raid && <p className="flex flex-wrap gap-x-[0.8cqw] font-semibold uppercase tracking-[0.12em] text-[#9fc3d3]">
          <span style={{ color: RAID_GOLD }}>{raid.encounters.length} encounters</span><span>Fireteam {raid.fireteam}</span><span>{raid.duration}</span>
        </p>}
        {brief && <p className="text-[#e6eef2]"><Skull className="mr-[0.3cqw] inline size-[0.9cqw] text-[#ff7a8a]" />{brief.dungeon.boss}</p>}
        {raid && <p className="text-[#e6eef2]"><Skull className="mr-[0.3cqw] inline size-[0.9cqw] text-[#ff7a8a]" />{raid.boss}</p>}
        <p className="text-[0.78cqw] uppercase tracking-[0.2em] text-[#92e9f5]">
          {brief?.clearedToday || raid?.cleared ? "✓ Cleared · " : ""}{brief ? (brief.worldGate ? "Gate open in the world today" : "No world gate · launch from here") : "Launch from the Director only"}
        </p>
      </div>
      </div>
    </div>
  );
}

/* ---------------- the launch screen ---------------- */

/** The full launch screen a node opens: hero art, the briefing, modifiers and rewards, Launch. */
export function ActivityLaunch({ node, progression, onDeploy, onBack, active = true }: {
  node: MapNode;
  progression: PlayerProgression;
  onDeploy: (target: DeployTarget) => void;
  onBack: () => void;
  active?: boolean;
}) {
  const now = useMemo(() => Date.now(), [node.id]);
  const brief = node.kind === "DUNGEON" ? dungeonBrief(progression, node.refId, now) : null;
  const raid = node.kind === "RAID" ? raidBrief(progression, node.refId) : null;
  const [launching, setLaunching] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const color = brief ? gateColor(brief.rank, brief.gate.sealed).core : RAID_GOLD;
  const launch = () => {
    if (launching) return;
    const target = brief ? dungeonDeploy(brief.dungeon.id, now) : raid ? raidDeploy(raid.raid) : null;
    if (!target) return;
    setLaunching(true);
    onDeploy(target);
  };
  useMenuInput(active, (intent) => { if (intent === "confirm") launch(); else if (intent === "back") onBack(); }, ["confirm", "back"]);
  useEffect(() => setLaunching(false), [node.id]);

  const kicker = brief ? `Dungeon // ${brief.dungeon.place}` : `Raid // ${raid?.raid.entrance ?? ""}`;
  const title = brief?.dungeon.name ?? raid?.raid.name ?? "";
  const body = brief?.dungeon.look ?? raid?.identity ?? "";
  const tiles = brief
    ? brief.modifiers.map((m) => ({ id: m.id, label: m.label, detail: m.detail, glyph: (m.id === "champ-BULWARK" ? Shield : m.id === "champ-SURGE" ? Zap : m.id === "champ-JUGGERNAUT" ? Swords : m.id === "lives" ? Heart : m.id === "collapse" ? Hourglass : m.id === "sealed" ? Lock : Skull) as LucideIcon, tone: m.tone }))
    : raid ? [
      { id: "team", label: `Fireteam · ${raid.fireteam}`, detail: `Built for six. A ${raid.challengeFireteam}-player challenge variant scales the fight and pays more on repeat.`, glyph: Hexagon as LucideIcon, tone: "info" as const },
      { id: "lives", label: "Shared lives", detail: "Wipes return the fireteam to the last encounter checkpoint.", glyph: Heart as LucideIcon, tone: "info" as const },
      { id: "bleed", label: "Dimensional bleed", detail: "Hazard builds through every encounter; the Hollow Star punishes slow clears.", glyph: Hourglass as LucideIcon, tone: "danger" as const },
      { id: "boss", label: raid.boss, detail: "Four phases: Awakening, Star Collapse, Fractured Reality, Final Stand.", glyph: Skull as LucideIcon, tone: "warn" as const },
    ] : [];
  const rewards = brief
    ? brief.rewards
    : raid ? [
      { id: "lens", label: raid.reward, detail: "The raid's signature weapon.", earned: raid.cleared },
      { id: "title", label: "Starbreaker title", detail: "First clear.", earned: raid.starbreaker },
      { id: "blueprint", label: "Dimensional blueprint", detail: "A weapon-mod blueprint from the final chamber.", earned: raid.cleared },
    ] : [];
  const toneColor = { info: "#92e9f5", warn: "#ffcf6a", danger: "#ff6a6a" } as const;

  const path = brief ? (
    <ol className="wf-launch-path">
      {brief.dungeon.areas.map((a, i) => (
        <li key={a} className="flex items-center gap-[calc(var(--u)*0.7)]">
          <span className="wf-launch-step" style={{ borderColor: i === 3 ? "#ff6a6a" : color }}><span className="-rotate-45">{i === 3 ? <Skull className="size-[calc(var(--u)*0.8)]" /> : i + 1}</span></span>
          <span className="flex-1">{a}</span>
          {i === 0 && <span className="text-[calc(var(--u)*0.72)] uppercase tracking-[0.2em] text-white/60">Surface</span>}
          {i === 3 && <span className="text-[calc(var(--u)*0.72)] uppercase tracking-[0.2em] text-[#ff9a9a]">{brief.depth.toLocaleString()} m · {brief.dungeon.boss}</span>}
        </li>
      ))}
    </ol>
  ) : raid ? (
    <ol className="wf-launch-path">
      {raid.encounters.map((e, i) => (
        <li key={e.id} className="flex items-center gap-[calc(var(--u)*0.7)]">
          <span className="wf-launch-step" style={{ borderColor: i === raid.encounters.length - 1 ? "#ff6a6a" : RAID_GOLD }}><span className="-rotate-45">{i === raid.encounters.length - 1 ? <Skull className="size-[calc(var(--u)*0.8)]" /> : i + 1}</span></span>
          <span className="flex-1">{e.name}</span>
          <span className="text-[calc(var(--u)*0.72)] uppercase tracking-[0.2em] text-white/60">{e.room}</span>
        </li>
      ))}
    </ol>
  ) : null;

  const tipText = tip ? [...tiles, ...rewards].find((t) => t.id === tip) : null;

  return (
    <section className="wf-launch wf-dest-in" aria-label={`${title} launch`} style={{ ["--node" as string]: color }}>
      <img src={heroArt(node.art)} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
      <div className="wf-launch-shade" />
      <div className="relative flex h-full flex-col px-[calc(var(--u)*3.2)] pb-[calc(var(--u)*1.6)] pt-[calc(var(--u)*5.2)]">
        <div className="flex min-h-0 flex-1 gap-[calc(var(--u)*3)]">
          <div className="flex w-[44%] min-w-0 flex-col">
            <p className="flex items-center gap-[calc(var(--u)*0.7)] text-[calc(var(--u)*0.95)] font-semibold uppercase tracking-[0.32em] text-white/80">
              <svg viewBox="-24 -24 48 48" className="size-[calc(var(--u)*2.2)]" aria-hidden>{node.kind === "RAID" ? <RaidGlyph r={20} /> : <DungeonGlyph color={color} r={20} />}</svg>
              {kicker}
            </p>
            <h2 className="mt-[calc(var(--u)*0.6)] text-[calc(var(--u)*3.7)] font-bold uppercase leading-[0.95] tracking-[0.03em] text-white [text-shadow:0_0.3cqw_1.6cqw_rgba(0,0,0,0.7)]">{title}</h2>
            <div className="mt-[calc(var(--u)*0.9)] flex flex-wrap items-center gap-[calc(var(--u)*0.6)] text-[calc(var(--u)*0.9)] font-semibold uppercase tracking-[0.16em]">
              {brief && <span className="wf-launch-chip" style={{ color, borderColor: color }}>{brief.rank}-rank{brief.gate.sealed ? " · sealed" : ""}</span>}
              {brief && <span className="wf-launch-chip">{brief.depth.toLocaleString()} m · {brief.floors} floors</span>}
              {brief && <span className="wf-launch-chip"><Users className="size-[calc(var(--u)*0.9)]" /> 1–3</span>}
              {raid && <span className="wf-launch-chip" style={{ color: RAID_GOLD, borderColor: RAID_GOLD }}>Raid · {raid.duration}</span>}
              {raid && <span className="wf-launch-chip"><Users className="size-[calc(var(--u)*0.9)]" /> {raid.fireteam} · or {raid.challengeFireteam}</span>}
              {(brief?.clearedToday || raid?.cleared) && <span className="wf-launch-chip" style={{ color: "#7ef2b0", borderColor: "#7ef2b0" }}><Check className="size-[calc(var(--u)*0.9)]" /> {brief ? "Cleared today" : "Cleared"}</span>}
            </div>
            <p className="mt-[calc(var(--u)*1)] max-w-[calc(var(--u)*36)] text-[calc(var(--u)*1.05)] leading-relaxed text-[#dfe9ee] [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">{body}</p>
            <p className="mt-[calc(var(--u)*1.3)] text-[calc(var(--u)*0.82)] font-semibold uppercase tracking-[0.3em] text-white/70">{brief ? "The descent" : "Encounters"} <ChevronDown className="inline size-[calc(var(--u)*0.9)]" /></p>
            <div className="mt-[calc(var(--u)*0.5)] min-h-0 overflow-hidden">{path}</div>
            {brief && <div className="mt-[calc(var(--u)*1.2)] max-w-[calc(var(--u)*36)] border-l-2 border-[#ff6a6a] bg-black/50 px-[calc(var(--u)*0.9)] py-[calc(var(--u)*0.6)]">
              <p className="text-[calc(var(--u)*0.78)] font-semibold uppercase tracking-[0.3em] text-[#ff9a9a]">Final boss · {brief.dungeon.areas[3]}</p>
              <p className="mt-[calc(var(--u)*0.2)] text-[calc(var(--u)*1.35)] font-bold uppercase tracking-[0.06em]">{brief.dungeon.boss}</p>
              <p className="mt-[calc(var(--u)*0.2)] text-[calc(var(--u)*0.95)] leading-snug text-[#d8e2e7]">{brief.dungeon.bossMechanic}</p>
              <p className="mt-[calc(var(--u)*0.5)] flex flex-wrap gap-[calc(var(--u)*0.4)] text-[calc(var(--u)*0.78)] font-semibold uppercase tracking-[0.14em] text-white/75">
                <span className="text-white/50">Enemies</span>{brief.dungeon.roster.map((e) => <span key={e} className="border border-white/20 px-[calc(var(--u)*0.4)]">{e}</span>)}
                <span className="border border-[#ffcf6a]/60 px-[calc(var(--u)*0.4)] text-[#ffcf6a]">{brief.dungeon.gatekeeper}</span>
              </p>
            </div>}
          </div>
          <div className="ml-auto flex w-[30%] min-w-0 flex-col justify-end gap-[calc(var(--u)*1.2)]">
            <div>
              <p className="wf-launch-label">Modifiers</p>
              <div className="mt-[calc(var(--u)*0.5)] flex flex-wrap gap-[calc(var(--u)*0.5)]">
                {tiles.map((t) => <button key={t.id} type="button" className="wf-launch-tile" style={{ color: toneColor[t.tone] }} onMouseEnter={() => setTip(t.id)} onMouseLeave={() => setTip(null)} onFocus={() => setTip(t.id)} onBlur={() => setTip(null)} aria-label={`${t.label}: ${t.detail}`}><t.glyph className="size-[calc(var(--u)*1.5)]" /></button>)}
              </div>
            </div>
            <div>
              <p className="wf-launch-label">Rewards</p>
              <div className="mt-[calc(var(--u)*0.5)] flex flex-wrap gap-[calc(var(--u)*0.5)]">
                {rewards.map((t) => <button key={t.id} type="button" className="wf-launch-tile wf-launch-reward" data-earned={t.earned} onMouseEnter={() => setTip(t.id)} onMouseLeave={() => setTip(null)} onFocus={() => setTip(t.id)} onBlur={() => setTip(null)} aria-label={`${t.label}: ${t.detail}${t.earned ? " (earned)" : ""}`}>
                  {(() => { const I = t.id.startsWith("seal") ? Award : t.id === "chests" ? Package : t.id === "title" ? Crown : t.id === "blueprint" ? Sparkles : Gem; return <I className="size-[calc(var(--u)*1.5)]" />; })()}{t.earned && <Check className="absolute bottom-[calc(var(--u)*0.15)] right-[calc(var(--u)*0.15)] size-[calc(var(--u)*0.75)] text-[#7ef2b0]" />}
                </button>)}
              </div>
            </div>
            <div className="min-h-[calc(var(--u)*4.6)] border-l-2 border-[color:var(--node)] bg-black/55 px-[calc(var(--u)*0.8)] py-[calc(var(--u)*0.5)] text-[calc(var(--u)*0.9)] leading-snug">
              {tipText ? <><p className="font-bold uppercase tracking-[0.12em]">{tipText.label}</p><p className="mt-[calc(var(--u)*0.2)] text-[#c9d8df]">{tipText.detail}</p></> : <p className="text-white/55">Hover a modifier or reward for details.</p>}
            </div>
          </div>
        </div>
        <div className="mt-[calc(var(--u)*1.2)] flex items-center gap-[calc(var(--u)*1.6)] border-t border-white/15 pt-[calc(var(--u)*1)]">
          <button type="button" className="wf-dest-hint" onClick={onBack}><span className="wf-dest-cap">Esc</span>Back</button>
          <p className="text-[calc(var(--u)*0.85)] uppercase tracking-[0.2em] text-white/55">{brief ? (brief.worldGate ? "Launch travels to today's gate and drops you in" : "This dungeon has no world gate yet · launch only from here") : "Raids are instanced: they start from the Director, never from the world"}</p>
          <button type="button" className="wf-launch-go ml-auto" disabled={launching} onClick={launch}><span className="wf-dest-cap">↵</span>{launching ? "Launching…" : "Launch"}</button>
        </div>
      </div>
      <button type="button" onClick={onBack} className="absolute right-[calc(var(--u)*1.2)] top-[calc(var(--u)*1.2)] text-white/60 hover:text-white" aria-label="Close"><X className="size-[calc(var(--u)*1.4)]" /></button>
    </section>
  );
}

/** compact list for the phone layout */
export function ActivityList({ progression, onOpen }: { progression: PlayerProgression; onOpen: (n: MapNode) => void }) {
  const now = Date.now();
  return (
    <div className="grid grid-cols-1 gap-1">
      {MAP_NODES.map((n) => {
        const b = n.kind === "DUNGEON" ? dungeonBrief(progression, n.refId, now) : null;
        const r = n.kind === "RAID" ? raidBrief(progression, n.refId) : null;
        const c = nodeColor(n, progression, now);
        return <button key={n.id} type="button" onClick={() => onOpen(n)} className="flex items-center gap-2 border border-white/15 px-2 py-2 text-left">
          <svg viewBox="-24 -24 48 48" className="size-7 shrink-0" aria-hidden>{n.kind === "RAID" ? <RaidGlyph r={20} /> : <DungeonGlyph color={c} r={20} />}</svg>
          <span className="min-w-0 flex-1"><b className="block truncate">{b?.dungeon.name ?? r?.raid.name}</b><span className="block truncate text-xs uppercase tracking-widest text-white/60">{n.kind === "RAID" ? `Raid · ${r?.fireteam} players` : `${b?.rank}-rank · ${destinationInfo(n.destination).name}`}</span></span>
          {(b?.clearedToday || r?.cleared) && <Check className="size-4 text-[#7ef2b0]" />}
        </button>;
      })}
    </div>
  );
}

