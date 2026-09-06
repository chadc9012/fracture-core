/* AI MISSION DIRECTOR
 * Watches the live world (threat, combat heat, zone control, instability),
 * adjusts pressure, then generates missions, chains them and escalates raids.
 * Missions are passive listeners: world events push progress into objectives. */

import { REGIONS } from "./world";

export type MissionKind =
  | "EMERGENCY_DEFENSE"
  | "FACTION_SKIRMISH"
  | "CONVOY_RAID"
  | "RESOURCE_DROP"
  | "ESCALATION"
  | "WORLD_BOSS";

export type ObjectiveType = "KILL" | "SURVIVE" | "PROTECT" | "SEIZE" | "HAUL";

export type Objective = {
  type: ObjectiveType;
  label: string;
  amount: number;
  progress: number;
  done: boolean;
};

export type Mission = {
  id: string;
  name: string;
  kind: MissionKind;
  regionId: string;
  intensity: "LOW" | "MED" | "HIGH";
  state: "ACTIVE" | "COMPLETED" | "FAILED";
  objectives: Objective[];
  reward: number;
  follows?: string;
  /** seconds the mission has been running */
  age: number;
  /** escalation stage (bumped by the director) */
  stage: number;
};

export type WorldEvent =
  | { type: "KILL" }
  | { type: "CARGO"; amount: number }
  | { type: "CAPTURE"; regionId: string }
  | { type: "CORE_DAMAGE"; amount: number }
  | { type: "CONVOY_LOST" };

export type Director = {
  threat: number;
  heat: number;
  escalation: number;
  missions: Mission[];
  memory: { type: string; t: number }[];
  completed: number;
  failed: number;
  cooldown: number;
};

export type DirectorApi = {
  spawnWave: (regionId: string, count: number, elite: boolean) => void;
  alert: (text: string) => void;
};

let seq = 1;
const id = () => `m${seq++}`;

export function createDirector(): Director {
  return {
    threat: 20,
    heat: 0,
    escalation: 0,
    missions: [],
    memory: [],
    completed: 0,
    failed: 0,
    cooldown: 6,
  };
}

const regionName = (rid: string) => REGIONS.find((r) => r.id === rid)?.name ?? "the Wilds";

function define(kind: MissionKind, regionId: string, intensity: Mission["intensity"], follows?: string): Mission {
  const hot = intensity === "HIGH";
  const base: Omit<Mission, "objectives" | "name" | "reward"> = {
    id: id(),
    kind,
    regionId,
    intensity,
    state: "ACTIVE",
    age: 0,
    stage: 0,
    ...(follows ? { follows } : {}),
  };

  switch (kind) {
    case "EMERGENCY_DEFENSE":
      return {
        ...base,
        name: `City Core Breach — ${regionName(regionId)}`,
        reward: 900,
        objectives: [
          { type: "PROTECT", label: "Keep the city core online", amount: 1, progress: 0, done: false },
          { type: "KILL", label: "Break the siege", amount: hot ? 14 : 9, progress: 0, done: false },
          { type: "SURVIVE", label: "Hold the line (s)", amount: hot ? 150 : 100, progress: 0, done: false },
        ],
      };
    case "FACTION_SKIRMISH":
      return {
        ...base,
        name: `Faction Skirmish — ${regionName(regionId)}`,
        reward: 420,
        objectives: [
          { type: "KILL", label: "Destroy war machines", amount: hot ? 10 : 6, progress: 0, done: false },
          { type: "SEIZE", label: "Hold the zone", amount: 1, progress: 0, done: false },
        ],
      };
    case "CONVOY_RAID":
      return {
        ...base,
        name: `Convoy Raid — ${regionName(regionId)}`,
        reward: 380,
        objectives: [{ type: "HAUL", label: "Seize supply crates", amount: 4, progress: 0, done: false }],
      };
    case "RESOURCE_DROP":
      return {
        ...base,
        name: `Supply Drop — ${regionName(regionId)}`,
        reward: 260,
        objectives: [{ type: "HAUL", label: "Recover crates", amount: 2, progress: 0, done: false }],
      };
    case "ESCALATION":
      return {
        ...base,
        name: `Escalation — ${regionName(regionId)}`,
        reward: 750,
        objectives: [
          { type: "KILL", label: "Cut down the elite wave", amount: 12, progress: 0, done: false },
          { type: "SURVIVE", label: "Endure the push (s)", amount: 120, progress: 0, done: false },
        ],
      };
    case "WORLD_BOSS":
      return {
        ...base,
        name: `WAR TITAN — ${regionName(regionId)}`,
        reward: 2400,
        objectives: [
          { type: "KILL", label: "Strip the Titan's escort", amount: 20, progress: 0, done: false },
          { type: "SURVIVE", label: "Apocalyptic phase (s)", amount: 180, progress: 0, done: false },
        ],
      };
  }
}

function remember(dir: Director, type: string) {
  dir.memory.unshift({ type, t: Date.now() });
  if (dir.memory.length > 40) dir.memory.pop();
}

export function directorTrend(dir: Director) {
  const recent = dir.memory.slice(0, 12);
  const wins = recent.filter((m) => m.type === "COMPLETED").length;
  const losses = recent.filter((m) => m.type === "FAILED").length;
  if (!recent.length) return "reading the world";
  if (wins > losses + 1) return "escalating — you are winning";
  if (losses > wins) return "easing off — world under strain";
  return "holding pressure steady";
}

export function spawnMission(
  dir: Director,
  api: DirectorApi,
  kind: MissionKind,
  regionId: string,
  intensity: Mission["intensity"],
  follows?: string,
) {
  if (dir.missions.filter((m) => m.state === "ACTIVE").length >= 3) return null;
  if (dir.missions.some((m) => m.state === "ACTIVE" && m.kind === kind && m.regionId === regionId)) return null;

  const mission = define(kind, regionId, intensity, follows);
  dir.missions.unshift(mission);
  if (dir.missions.length > 8) dir.missions.pop();
  remember(dir, `SPAWNED:${kind}`);
  api.alert(`Director: ${mission.name}`);

  const waveSize = intensity === "HIGH" ? 5 : intensity === "MED" ? 3 : 2;
  api.spawnWave(regionId, waveSize, kind === "WORLD_BOSS" || kind === "ESCALATION");
  return mission;
}

export type DirectorContext = {
  dt: number;
  combatHeat: number;
  playerRegionId: string;
  contestedZones: number;
  instability: number;
  night: number;
  coreHp: number;
  hostileNear: number;
};

export function directorTick(dir: Director, ctx: DirectorContext, api: DirectorApi) {
  const { dt } = ctx;

  /* ---- 1. world analysis ---- */
  const damageToCore = 100 - ctx.coreHp;
  dir.threat = Math.max(
    0,
    damageToCore * 0.6 + ctx.contestedZones * 9 + ctx.instability * 30 + ctx.night * 12 + dir.escalation * 8,
  );
  dir.heat = ctx.combatHeat + ctx.hostileNear * 6;

  /* ---- 2. pressure / pacing ---- */
  if (dir.heat < 10) dir.threat += 6 * dt;
  if (dir.heat > 100) dir.threat -= 12 * dt;
  // balance engine: never pile on while the core is falling apart
  if (ctx.coreHp < 25) dir.threat = Math.min(dir.threat, 60);

  /* ---- 3. mission runtime ---- */
  for (const m of dir.missions) {
    if (m.state !== "ACTIVE") continue;
    m.age += dt;

    for (const o of m.objectives) {
      if (o.type === "SURVIVE") {
        o.progress = Math.min(o.amount, m.age);
      }
      if (o.type === "PROTECT") {
        o.progress = ctx.coreHp > 0 ? 1 : 0;
      }
      if (o.type === "SEIZE" && m.regionId === ctx.playerRegionId) {
        o.progress = Math.min(o.amount, o.progress + dt * 0.05);
      }
      o.done = o.progress >= o.amount;
    }

    if (m.kind === "EMERGENCY_DEFENSE" && ctx.coreHp <= 0) {
      m.state = "FAILED";
      dir.failed++;
      remember(dir, "FAILED");
      api.alert(`Mission failed — ${m.name}`);
      // failure escalates the world into an apocalyptic event
      dir.escalation++;
      spawnMission(dir, api, "WORLD_BOSS", m.regionId, "HIGH", m.id);
      continue;
    }

    // live escalation: half-way through a hot mission an elite wave arrives
    if (m.intensity === "HIGH" && m.stage === 0 && m.age > 45) {
      m.stage = 1;
      api.spawnWave(m.regionId, 4, true);
      api.alert(`Elite wave inbound — ${m.name}`);
    }

    if (m.objectives.every((o) => o.done)) {
      m.state = "COMPLETED";
      dir.completed++;
      remember(dir, "COMPLETED");
      api.alert(`Mission complete — ${m.name}  +${m.reward} cr`);
      // event chaining: strong performance pulls a bigger fight in
      if (m.intensity === "HIGH" || dir.completed % 2 === 0) {
        dir.escalation = Math.min(4, dir.escalation + 1);
        spawnMission(dir, api, "ESCALATION", m.regionId, "HIGH", m.id);
      }
    }
  }

  /* ---- 4. generation ---- */
  dir.cooldown -= dt;
  if (dir.cooldown > 0) return;
  dir.cooldown = 14;

  const active = dir.missions.filter((m) => m.state === "ACTIVE").length;
  if (active >= 3) return;

  if (dir.threat > 85) {
    spawnMission(dir, api, "EMERGENCY_DEFENSE", "nexus", "HIGH");
  } else if (ctx.contestedZones >= 2) {
    spawnMission(dir, api, "FACTION_SKIRMISH", ctx.playerRegionId, dir.threat > 55 ? "HIGH" : "MED");
  } else if (dir.heat < 8) {
    spawnMission(dir, api, "CONVOY_RAID", ctx.playerRegionId, "LOW");
  } else if (dir.threat > 50) {
    spawnMission(dir, api, "FACTION_SKIRMISH", ctx.playerRegionId, "MED");
  } else {
    spawnMission(dir, api, "RESOURCE_DROP", ctx.playerRegionId, "LOW");
  }
}

export function directorEvent(dir: Director, ev: WorldEvent) {
  for (const m of dir.missions) {
    if (m.state !== "ACTIVE") continue;
    for (const o of m.objectives) {
      if (ev.type === "KILL" && o.type === "KILL") o.progress++;
      if (ev.type === "CARGO" && o.type === "HAUL") o.progress += ev.amount;
      if (ev.type === "CAPTURE" && o.type === "SEIZE" && ev.regionId === m.regionId) o.progress = o.amount;
    }
  }
  if (ev.type === "CAPTURE") remember(dir, "CAPTURE");
}

export function rewardsBanked(dir: Director) {
  return dir.missions.filter((m) => m.state === "COMPLETED").reduce((n, m) => n + m.reward, 0);
}
