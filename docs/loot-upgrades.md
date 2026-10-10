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
