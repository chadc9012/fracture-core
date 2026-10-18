/** Vyrak's personality as a companion: a dry, predatory sense of humour, impatient and proud, who treats the Operator as "we" and
 * enemies as snacks. Original writing (a wisecracking-symbiote flavour, no borrowed lines). Pure: a mood machine that reacts to what
 * the sim reports, picks a line by mood and trigger, and rate-limits itself so it never turns into constant chatter.
 * Text only: the lines are shown as captions; recorded audio can be mapped to the same ids later. */
export type Mood = "calm" | "playful" | "annoyed" | "furious" | "proud" | "wary";
export type Trigger = "kill" | "killStreak" | "hurt" | "lowHp" | "idle" | "bossKill" | "farmed" | "ruin" | "danger" | "summon" | "death" | "riding" | "recover";

type Line = { id: string; text: string };
const L = (id: string, text: string): Line => ({ id, text });

/** lines per trigger and mood; a missing mood falls back to "calm" */
export const LINES: Record<Trigger, Partial<Record<Mood, Line[]>>> = {
  kill: {
    calm: [L("k-c1", "Tidy. Barely a snack."), L("k-c2", "One down. I was only warming up my appetite.")],
    playful: [L("k-p1", "Did you see that? Tell me you saw that. I want it on the record."), L("k-p2", "Crunchy on the outside. Crunchy on the inside. Crunchy all the way down.")],
    annoyed: [L("k-a1", "Finally. Next time stand still long enough for me to help.")],
    furious: [L("k-f1", "MORE. Bring me more of them!"), L("k-f2", "That's what happens when you look at us funny.")],
    proud: [L("k-r1", "That is my Operator. Say it with me: that is OUR Operator.")],
    wary: [L("k-w1", "Don't relax. The quiet ones are the loud ones later.")],
  },
  killStreak: {
    playful: [L("ks-p1", "We are on a roll. Somebody write down my name. Both our names. Mostly mine."), L("ks-p2", "Is this what you call a good day? I call it lunch.")],
    furious: [L("ks-f1", "Burn them ALL. I will not be taking questions.")],
    proud: [L("ks-r1", "Legends are made like this. Loudly, and with a little smoke.")],
  },
  hurt: {
    calm: [L("h-c1", "Ouch. Rude."), L("h-c2", "Someone just hit my favourite person. I will remember their face.")],
    annoyed: [L("h-a1", "Stop getting hit. It is bad for the both of us, and worse for my mood.")],
    furious: [L("h-f1", "They TOUCHED you. I will take that personally. Painfully."), L("h-f2", "That is the last mistake they get to make.")],
    wary: [L("h-w1", "Told you. I said the quiet ones would bite.")],
  },
  lowHp: {
    calm: [L("lh-c1", "Heal. Now. I am not breaking in a new Operator.")],
    annoyed: [L("lh-a1", "You are leaking. Fix it, or I fix it, and my way has teeth.")],
    furious: [L("lh-f1", "Nobody finishes you off but me. Move!")],
    wary: [L("lh-w1", "This is where the smart ones retreat. I will pretend I did not say that.")],
  },
  idle: {
    calm: [L("i-c1", "Standing around is not a plan. It is a pause with a posture."), L("i-c2", "I counted the stars. There are plenty. I want something to bite.")],
    playful: [L("i-p1", "If we were any quieter I would start narrating our lives. Do not tempt me."), L("i-p2", "Question: if I knock this ruin over, is that archaeology or a hobby?")],
    annoyed: [L("i-a1", "My wings are going to fall asleep. Wings do that. Look it up.")],
  },
  bossKill: {
    proud: [L("b-r1", "Now THAT was a feast. Remember this. I will be telling it wrong for years.")],
    playful: [L("b-p1", "It had a title and everything. Had.")],
    furious: [L("b-f1", "Another one gone. Is that all this world has to offer?")],
  },
  farmed: {
    annoyed: [L("fm-a1", "We have beaten this one before. I am not impressed, and the trust meter is not either."), L("fm-a2", "Again? Even I am bored, and I am a dragon of simple pleasures.")],
  },
  ruin: {
    calm: [L("r-c1", "Old stone. Older than me, almost. Look closer."), L("r-c2", "These carvings remember something. I might too, if you give me a minute.")],
    playful: [L("r-p1", "Ooh, ruins. Let me sniff it first. For safety. And also because I want to.")],
    wary: [L("r-w1", "Something here does not like us. Good. I do not like it either.")],
  },
  danger: {
    wary: [L("d-w1", "No. Not that way. I am not saying why. I am saying no."), L("d-w2", "I can smell that from here. It smells like regret.")],
    calm: [L("d-c1", "Careful. Something older than both of us is awake.")],
  },
  summon: {
    playful: [L("s-p1", "You called? Always at the best part. Or the worst. Hard to tell."), L("s-p2", "Wyrmcall received. Dinner is served. Theirs.")],
    furious: [L("s-f1", "Finally! Point me at them!")],
    calm: [L("s-c1", "On my way. Try not to die until I arrive.")],
  },
  death: {
    annoyed: [L("de-a1", "Seriously? I leave you for ONE second.")],
    calm: [L("de-c1", "Get up. We are not finished. I decide when we are finished.")],
  },
  riding: {
    playful: [L("rd-p1", "Hold on tight. Or do not. I am only carrying you across the entire sky."), L("rd-p2", "Feel that? That is the whole world getting out of our way.")],
    proud: [L("rd-r1", "Few have ever sat there. Fewer still were worth the weight.")],
  },
  recover: {
    calm: [L("rc-c1", "Better. Now let us go be a problem.")],
    playful: [L("rc-p1", "There you are. I was getting sentimental, and I hate that.")],
  },
};

export type PersonalityState = { mood: Mood; /** 0..1 how strongly the mood is held */ intensity: number; rage: number; lastSpoke: number; lastTrigger: Trigger | null; streak: number; streakAt: number; farmCount: number; used: Record<string, number> };
export const createPersonality = (): PersonalityState => ({ mood: "calm", intensity: 0.3, rage: 0, lastSpoke: 0, lastTrigger: null, streak: 0, streakAt: -999, farmCount: 0, used: {} });

export const MIN_GAP = 9, SAME_TRIGGER_GAP = 25, STREAK_WINDOW = 12, STREAK_NEEDED = 4, IDLE_AFTER = 70;

/** moods follow rage (anger builds when the Operator is hurt, bleeds off when things are quiet) */
export function moodFor(s: PersonalityState): Mood {
  if (s.rage >= 0.75) return "furious";
  if (s.rage >= 0.4) return "annoyed";
  return s.mood === "furious" || s.mood === "annoyed" ? "calm" : s.mood;
}

export function stepMood(s: PersonalityState, dt: number): void {
  s.rage = Math.max(0, s.rage - dt * 0.03);
  if (s.rage < 0.4 && (s.mood === "furious" || s.mood === "annoyed")) s.mood = "calm";
  if (s.rage >= 0.75) s.mood = "furious"; else if (s.rage >= 0.4) s.mood = "annoyed";
}

/** a thing happened. Returns a line to say (or null). Deterministic given `roll` (0..1). */
export function react(s: PersonalityState, trigger: Trigger, now: number, roll = Math.random()): Line | null {
  // state changes happen even when Vyrak stays quiet
  if (trigger === "hurt") s.rage = Math.min(1, s.rage + 0.18);
  if (trigger === "lowHp") s.rage = Math.min(1, s.rage + 0.3);
  if (trigger === "death") s.rage = Math.min(1, s.rage + 0.5);
  if (trigger === "farmed") s.farmCount++;
  if (trigger === "kill") {
    s.streak = now - s.streakAt <= STREAK_WINDOW ? s.streak + 1 : 1; s.streakAt = now;
    if (s.streak >= STREAK_NEEDED) { trigger = "killStreak"; s.streak = 0; s.mood = s.rage > 0.6 ? "furious" : "playful"; }
    else s.rage = Math.max(0, s.rage - 0.05);
  }
  if (trigger === "bossKill") { s.mood = "proud"; s.rage = Math.max(0, s.rage - 0.4); }
  if (trigger === "summon" && s.mood === "calm") s.mood = "playful";
  if (trigger === "recover") { s.mood = "playful"; s.rage = Math.max(0, s.rage - 0.3); }
  if (trigger === "danger") s.mood = "wary";
  if (trigger === "ruin" && s.mood === "calm") s.mood = "playful";
  stepMood(s, 0);

  const important = trigger === "killStreak" || trigger === "bossKill" || trigger === "death" || trigger === "lowHp" || trigger === "danger";
  if (!important && now - s.lastSpoke < MIN_GAP) return null;
  if (s.lastTrigger === trigger && now - s.lastSpoke < SAME_TRIGGER_GAP && !important) return null;
  const mood = moodFor(s);
  const pool = LINES[trigger][mood] ?? LINES[trigger].calm ?? Object.values(LINES[trigger])[0];
  if (!pool?.length) return null;
  // prefer lines not used recently
  const fresh = pool.filter((l) => (s.used[l.id] ?? -999) < now - 120);
  const list = fresh.length ? fresh : pool;
  const line = list[Math.min(list.length - 1, Math.floor(roll * list.length))]!;
  s.used[line.id] = now; s.lastSpoke = now; s.lastTrigger = trigger;
  return line;
}

/** quiet long enough that Vyrak makes a remark */
export function maybeIdle(s: PersonalityState, now: number, roll = Math.random()): Line | null {
  return now - s.lastSpoke >= IDLE_AFTER ? react(s, "idle", now, roll) : null;
}

/** Fury is a small combat bonus for Dragonite abilities: up to +15% while Vyrak is furious. Never above that. */
export const furyBonus = (s: PersonalityState): number => (s.mood === "furious" ? 0.15 * Math.min(1, s.rage) : 0);
