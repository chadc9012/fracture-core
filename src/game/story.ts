/** Shared story layer for the Unique Scenarios: branching dialogue graphs, persistent story state (flags, choices, trust,
 * stages, collectibles) and the pure reducers that change it. No rendering, no timers, no randomness - the UI and Scene only
 * call these, so every consequence is testable and a choice always changes real state.
 *
 * Replay safety: every effect list is applied at most once per `onceKey` (graph:node[:choice]), recorded as a `once:` flag, so
 * re-running a conversation can never farm trust or re-fire a consequence. Choices are decisions: the first value stands. */
export type StoryState = {
  /** union-merged across devices: facts that, once true, stay true */
  flags: string[];
  /** decisions by key (first one stands) */
  choices: Record<string, string>;
  /** relationship points per character, 0..100 (max-merged) */
  trust: Record<string, number>;
  /** furthest stage per scenario (monotonic) */
  stages: Record<string, string>;
  /** collected memories / relics (union-merged) */
  collectibles: string[];
};
export const EMPTY_STORY: StoryState = { flags: [], choices: {}, trust: {}, stages: {}, collectibles: [] };

export const TRUST_MAX = 100;

export type StoryEffect =
  | { flag: string }
  | { choice: { key: string; value: string } }
  | { trust: { who: string; amount: number } }
  | { stage: { scenario: string; to: string } }
  | { collect: string };

export type StoryCondition =
  | { flag: string }
  | { notFlag: string }
  | { trustAtLeast: { who: string; points: number } }
  | { choiceIs: { key: string; value: string } };

export type DialogueChoice = { id: string; text: string; requires?: StoryCondition; effects?: StoryEffect[]; next?: string };
export type DialogueNode = { id: string; speaker: string; text: string; effects?: StoryEffect[]; next?: string; choices?: DialogueChoice[] };
export type DialogueGraph = { id: string; start: string; nodes: Record<string, DialogueNode> };

/** per-scenario ordered stage lists; a stage can only move forward */
export const STAGE_ORDER: Record<string, readonly string[]> = {};
export function registerStages(scenario: string, order: readonly string[]) { STAGE_ORDER[scenario] = order; }

export function normalizeStory(raw: unknown): StoryState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<StoryState>;
  const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const rec = <T,>(v: unknown, ok: (x: unknown) => x is T): Record<string, T> => {
    const out: Record<string, T> = {};
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (ok(x)) out[k] = x;
    return out;
  };
  const trust = rec(r.trust, (x): x is number => typeof x === "number" && Number.isFinite(x));
  for (const k of Object.keys(trust)) trust[k] = Math.min(TRUST_MAX, Math.max(0, trust[k]!));
  return {
    flags: [...new Set(strArr(r.flags))],
    choices: rec(r.choices, (x): x is string => typeof x === "string"),
    trust,
    stages: rec(r.stages, (x): x is string => typeof x === "string"),
    collectibles: [...new Set(strArr(r.collectibles))],
  };
}

const stageRank = (scenario: string, stage: string | undefined) => (stage === undefined ? -1 : (STAGE_ORDER[scenario]?.indexOf(stage) ?? -1));

/** Cloud/slot merge: progress is only gained. Flags/collectibles union, trust max, stage furthest; a decision keeps the NEWER copy's value. */
export function mergeStory(local: StoryState, cloud: StoryState, localIsNewer: boolean): StoryState {
  const newer = localIsNewer ? local : cloud, older = localIsNewer ? cloud : local;
  const trust: Record<string, number> = { ...older.trust };
  for (const [k, v] of Object.entries(newer.trust)) trust[k] = Math.max(v, trust[k] ?? 0);
  const stages: Record<string, string> = { ...older.stages };
  for (const [k, v] of Object.entries(newer.stages)) if (stageRank(k, v) >= stageRank(k, stages[k])) stages[k] = v;
  return {
    flags: [...new Set([...local.flags, ...cloud.flags])],
    choices: { ...older.choices, ...newer.choices },
    trust, stages,
    collectibles: [...new Set([...local.collectibles, ...cloud.collectibles])],
  };
}

export const hasFlag = (s: StoryState, flag: string) => s.flags.includes(flag);
export const trustOf = (s: StoryState, who: string) => s.trust[who] ?? 0;
export const stageOf = (s: StoryState, scenario: string) => s.stages[scenario];
export const stageAtLeast = (s: StoryState, scenario: string, stage: string) => stageRank(scenario, s.stages[scenario]) >= stageRank(scenario, stage) && stageRank(scenario, stage) >= 0;

export function conditionHolds(s: StoryState, c: StoryCondition | undefined): boolean {
  if (!c) return true;
  if ("flag" in c) return hasFlag(s, c.flag);
  if ("notFlag" in c) return !hasFlag(s, c.notFlag);
  if ("trustAtLeast" in c) return trustOf(s, c.trustAtLeast.who) >= c.trustAtLeast.points;
  return s.choices[c.choiceIs.key] === c.choiceIs.value;
}

function applyOne(s: StoryState, e: StoryEffect): StoryState {
  if ("flag" in e) return hasFlag(s, e.flag) ? s : { ...s, flags: [...s.flags, e.flag] };
  if ("choice" in e) return e.choice.key in s.choices ? s : { ...s, choices: { ...s.choices, [e.choice.key]: e.choice.value } };
  if ("trust" in e) return { ...s, trust: { ...s.trust, [e.trust.who]: Math.min(TRUST_MAX, Math.max(0, trustOf(s, e.trust.who) + e.trust.amount)) } };
  if ("stage" in e) return stageRank(e.stage.scenario, e.stage.to) > stageRank(e.stage.scenario, s.stages[e.stage.scenario]) ? { ...s, stages: { ...s.stages, [e.stage.scenario]: e.stage.to } } : s;
  return s.collectibles.includes(e.collect) ? s : { ...s, collectibles: [...s.collectibles, e.collect] };
}

/** Apply effects once per key. Without a key they apply every call (use only for idempotent effects such as flags/stages). */
export function applyEffects(s: StoryState, effects: StoryEffect[] | undefined, onceKey?: string): StoryState {
  if (!effects?.length) return s;
  const mark = onceKey ? `once:${onceKey}` : null;
  if (mark && hasFlag(s, mark)) return s;
  let out = effects.reduce(applyOne, s);
  if (mark) out = { ...out, flags: [...out.flags, mark] };
  return out;
}

export const visibleChoices = (s: StoryState, node: DialogueNode) => (node.choices ?? []).filter((c) => conditionHolds(s, c.requires));

/** Enter a node: runs its effects (once). Returns the node to show. */
export function enterNode(s: StoryState, graph: DialogueGraph, nodeId: string): { story: StoryState; node: DialogueNode } | null {
  const node = graph.nodes[nodeId];
  if (!node) return null;
  return { story: applyEffects(s, node.effects, `${graph.id}:${node.id}`), node };
}

export type ChooseResult = { ok: true; story: StoryState; next: string | null } | { ok: false; reason: "no-node" | "no-choice" | "locked" };
/** Pick a choice at a node. Invalid or locked choices change nothing. */
export function choose(s: StoryState, graph: DialogueGraph, nodeId: string, choiceId: string): ChooseResult {
  const node = graph.nodes[nodeId];
  if (!node) return { ok: false, reason: "no-node" };
  const c = node.choices?.find((x) => x.id === choiceId);
  if (!c) return { ok: false, reason: "no-choice" };
  if (!conditionHolds(s, c.requires)) return { ok: false, reason: "locked" };
  return { ok: true, story: applyEffects(s, c.effects, `${graph.id}:${node.id}:${c.id}`), next: c.next ?? node.next ?? null };
}

/** Walk a graph without a UI (used by tests and by skip): takes the first visible choice at each decision unless `picks` says otherwise. */
export function runGraph(s: StoryState, graph: DialogueGraph, picks: Record<string, string> = {}): StoryState {
  let story = s, id: string | null = graph.start, guard = 0;
  while (id && guard++ < 64) {
    const entered = enterNode(story, graph, id);
    if (!entered) break;
    story = entered.story;
    const choices = visibleChoices(story, entered.node);
    if (choices.length) {
      const pick = choices.find((c) => c.id === picks[entered.node.id]) ?? choices[0]!;
      const r = choose(story, graph, entered.node.id, pick.id);
      if (!r.ok) break;
      story = r.story; id = r.next;
    } else id = entered.node.next ?? null;
  }
  return story;
}
