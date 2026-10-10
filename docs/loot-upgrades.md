# Weapon loot, upgrade gates, gear rating

Legend: **tested** = unit tests pass (`src/game/loot-integration.test.ts`) · **unverified** = never run in a browser; nothing here has been seen in the running game.

## Weapon sources (all create a real inventory item with a stable id)
| Source | Weapon? | Notes |
|---|---|---|
| Regular / elite / boss kill (`sim.defeatMachine` → `claimDrops`) | yes, 2% / 8% / 35% | tiers T1–T3 only; power 80 / 95 / 110; id includes the drop id, so a drop is claimed once |
| Main mission first clear (`rewardMission`) | yes, one guaranteed | id `reward-weapon:mission:<id>`; `mission-01` (tutorial) excluded; repeats pay nothing |
| Dungeon first clear (OperationsHub → `grantDungeonFirstClear`) | yes, one guaranteed | id `reward-weapon:dungeon:<id>` |
| Loot caches | weapons/armor already (loot-caches.ts, unchanged) | |
| Side contracts | no, materials only | pay `tuningCore` |
| Shops | existing stock unchanged; mod shops now also sell Tuning Core | |
Armor-set pieces still drop from kills via armor-sets.ts, unchanged.

## Upgrade gates (`upgrade-gates.ts`, enforced in `inventory.upgradeGear`)
- Weapons from level 3 need 1 **Forge Catalyst** (first clear of a main mission or dungeon only).
- Armor from level 4 need 1 **Tuning Core** (side-contract first clear, or bought at a mod shop for `round(8 × priceMult)` of that shop's currency).
- Base cost is unchanged (`gearCost`). Base cost and gate are deducted in one return, or not at all. Gunsmith fee is only charged if the upgrade succeeds.

## Gear rating vs Power Level
- Power Level (`balance.playerPowerScore`) = average of equipped items; unchanged. Inventory items never count.
- Gear score (`gear-evaluation.gearScore`) = item power +8 set piece, +10 perk, +5 scenario rarity; grade S≥160, A≥125, B≥100, C≥80, else D. Verdict compares with the item worn in that slot (±5 margin); armor also shows Intellect/Mobility/Defense deltas.

## Not done
- InventoryWindow/ShopWindow show no rating or gate yet (UI not wired); the gate shows only as a refused upgrade/shop error.
- Population (civilians/shopkeepers/enemy ranks) is in `population.ts` as data only: no models, voices, or rendering wiring. Missing assets are flagged `missing` / `temporary-placeholder`.
- Mods and consumables, Discipline/Strength, shared power function: still on the equipment checklist.
- No type-check of OperationsHub.tsx / tsx files (react and three are not installed here); no production build; nothing browser-verified.

## Weapon-evolution ruins (super rare)

Five hidden ruins (`src/game/weapon-evolution.ts`: Cinderglass Vault/Ember, Rimeheart Spire/Frostspire, Drowned Orchard/Swamps, Stormwrecked Array/Wastelands, Sunken Heliostat/Solara). Walk within 40 m to discover one (map + compass marker); press **U** within 6 m to attune.

- **Evolving** a weapon gives +60 power once, sets its element to the ruin's, and grants an ability: Ember Brand (every 5th hit thermal burst), Rime Shatter (+30% vs chilled, every 6th hit frost burst), Rot Bloom (every 4th hit corrode burst), Storm Arc (every 4th hit chains to 2), Sun Flare (every 6th hit brief stun).
- **Not free**: weapon must be level 5+, costs 2 forge catalysts (earn-only) + 6 of the ruin's element material, all deducted in the same return. One weapon per ruin (`ruin:<id>` in earnedRewards), a weapon evolves once, and its element can no longer be infused away.
- **Cloud merge** keeps an evolution found on either copy (`mergeEvolution`), so a spent ruin claim can never strip the weapon.
- Ability bursts go through `applyMachineDamageMods` and `stunMachine`, so boss poise, scenario gimmicks and stun caps still apply. Local single-player only; no enemy shields involved.
- Status: rules and merge are unit-tested (12 tests); Scene/HUD/panel/markers are syntax-checked only. **Not browser-verified.** Cost and bonus numbers are first-pass and need your review (reward economy).
