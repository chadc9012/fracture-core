# Combat effects, ordnance and vehicles: what exists, what was added, what is missing

Legend: **implemented** = code exists · **tested** = unit tests pass (`src/game/combat-fx.test.ts`) · **unverified** = never seen in a running game (no browser here; `.tsx` could not be type-checked because `react`/`three` are not installed in this sandbox).

## Added in this pass (visual only: hit tests, damage, rewards and phases are unchanged)
| Feature | Where | Status |
|---|---|---|
| Troops fire the element of the region they stand in: Ember fire, Frostspire ice, Swamps acid, Overclocked arc; other regions plain tracers. Elites and bosses fire larger shots | `combat-fx.ts` `zoneElement`, `Scene.tsx` enemy-shot loop, `CombatFx.tsx` | implemented, tested, unverified |
| Dark Knight: void bolt volleys (FAN attacks) and a spinning staff spell circle with a rising beam for sweeps/fracture field | `combat-fx.ts` `attackFx`, `CombatFx.tsx` | implemented, tested, unverified |
| Rime Alpha: frost breath volley of 9 ice shards | same | same |
| Drowned Monarch: corrosive acid globs lobbed at the player's area on its field attacks (it has no ranged attack of its own; the damage zones are unchanged) | same | same |
| Hollow Saint: light bolts on Benediction | same | same |
| Bullet casings for ballistic weapons only (Auto Rifle small, Heavy Cannon large). The Pulse Rifle (light) and the Fracture Blade eject nothing | `casings.ts`, `CombatFx.tsx`, `Scene.tsx` | implemented, tested, unverified |
| Rocket / missile / torpedo rules: straight rockets, turn-rate-limited guided missiles, proximity / ground / timeout bursts, splash falloff | `ordnance.ts` | **rules only, not wired** to sim.ts, a weapon or a vehicle |

Honest limits: troop and boss projectiles are *flourishes*. An enemy shot still hits by the old 25 % chip roll, and boss attacks still hit by their geometry test at impact, so nothing here makes enemies stronger or weaker. Making region troops use real elemental abilities (burn, chill, corrode with status effects) would be a combat change and needs your balance decision.

## Vehicles that already exist (14 definitions in `vehicles.ts`)
| Id | Domain | Type | Weapon text | Model today |
|---|---|---|---|---|
| scrap-interceptor | LAND | muscle car | ram bar + repeater | race_future (car) |
| goliath-tank | LAND | tracked military | 120mm fracture cannon | **truck stand-in** |
| wasteland-jeep | LAND | 4x4 | pintle machine gun | suv |
| aether-hoverbike | LAND | anti-grav bike | twin pulse emitters | race_future (car stand-in) |
| tech-transport | LAND | troop carrier | pulse-laser array | van |
| rift-helicopter | AIR | attack chopper | chain gun + rocket pods | **car stand-in** |
| vanguard-jet | AIR | supersonic fighter | arc cannon + missiles | **car stand-in** |
| void-skimmer | SPACE | shuttle | void lance | car stand-in |
| scrap-patrol-boat | WATER | skiff | heavy deck gun | **van stand-in** |
| hydro-sub-skiff | AMPHIBIOUS | submersible | phase torpedoes | car stand-in |
| leviathan | WATER | dreadnought | heavy energy batteries | truck stand-in |
| raider-buggy | LAND | assault car | mines + ram spikes | police |
| ai-interceptor | AIR | drone | continuous laser | car stand-in |
| fracture-behemoth | LAND | mobile fortress | thermal pulse + crush field | truck stand-in |

The weapon text is lore, not wired behaviour. Only 12 GLBs exist in `models.ts` (cars, truck, van, SUV, police, buildings, NPCs); there is no tank, helicopter, jet, plane, boat or motorcycle model, so those definitions render as ground-vehicle stand-ins.

## Still missing (not built; each is a large piece of work)
- Real models for tank, helicopter, jets, military and sci-fi planes, boats, motorcycles, exotic vehicles (needs authored/Meshy assets: do not fake them).
- Flight and water physics (aerial warfare is audit-only today: `docs/aerial-warfare-audit.md`; the agreed first step is a pure `flight.ts` with input mapping and tests).
- Vehicle hardpoints that actually fire (`ordnance.ts` is the rules layer they would call).
- Military-grade on-foot weapons beyond the 4 weapon ids (AUTO, PULSE, HEAVY, SWORD); the 122-item `WEAPON_MANIFEST` is a catalogue, and only those 4 ids drive the live weapon behaviour.
- Anti-vehicle damage rules, lock-on UI, flares/countermeasures, enemy aircraft.

## Suggested order
1. Wire `ordnance.ts` to the Heavy Cannon alt-fire or one shoulder launcher (smallest real rocket), with explosion VFX and splash through `applyMachineDamageMods`.
2. Pure `flight.ts` + tests, then one drivable aircraft once a model exists.
3. Model pass (tank, helicopter, jet, boat, motorcycle) before any more vehicle code.

## Launchers and elemental weapons

**Implemented and covered by `launchers.test.ts` (pure rules + sim):** four shoulder launchers, `ROCKET` (Breacher, kinetic), `CINDER` (thermal), `FROSTBITE` (cryo, the only guided one: locks the nearest machine in a 0.45 rad forward cone within 90 m when fired) and `VITRIOL` (corrosive/BIO, widest splash). They are `kind: "launcher"` entries in `weapons.ts` (mag 1-3, 6-10 reserve, 3.2-3.6 s reload) and use the ordnance rules in `ordnance.ts`; rounds live in a pooled `sim.rounds`. A round bursts on a machine, cover, ground or timeout; splash falls off linearly, never hurts the player, and each machine is hit once per burst through `applyMachineDamageMods` (so Weaken/Marked, boss poise, scenario gimmicks and participation behave exactly as for bullets).

**Elemental statuses (`weapon-elements.ts`)** apply only to weapons that carry an element: Pulse Rifle (ARC), Heavy Cannon (THERMAL) and the elemental launchers. Auto Rifle, Fracture Blade and the Breacher (kinetic) apply none.

| Element | Status | Regular enemy | Boss |
|---|---|---|---|
| THERMAL | Burn | 0.5 hp/s for 3 s, applied straight to hp (never counts as scenario participation or poise) | none |
| CRYO | Chill | speed x0.55 for 3 s | none |
| BIO | Corrode | damage x1.25 for 4 s | x1.10 for 4 s |
| ARC | Shock | 0.7 s stun, 3.5 s cooldown per machine | same, plus the existing boss stun cap |

Corrode reuses `vulnUntil/vulnMult` and never weakens or shortens an active window. Statuses live in `sim.statuses` (a `Map<Machine, MachineStatuses>`), are removed in `defeatMachine`, and are purged for dead pooled slots, so a respawned machine never inherits them.

**Not done / not verified:** no browser run, so rocket, burst and launcher audio are unseen/unheard; the damage and reload numbers are first-pass and untuned; launchers are selectable in the Arsenal screen by everyone (no unlock gate yet); no launcher can hit trucks or vehicles; the element does not yet appear on the HUD. `CombatFx.tsx`, `Scene.tsx` and `ArsenalLoadouts.tsx` changes are not type-checked here (no react/three packages).
