# Vehicles that drive, fly and sail differently, inside the real world

## Where the game is today
- All 14 vehicles, including the jet, helicopter, boats and the submarine, use the same driving code: W/S for speed, A/D to steer, and Shift to boost. Planes don't fly and boats don't float. The only differences between vehicles are speed and handling numbers.
- Vehicle damage, garages, tuning, engine start-up sounds and the Nex currency already exist and stay as they are.
- The three uploaded packages contain useful handling ideas: grip by surface, takeoff and landing, water rules and safe exits. Their files are written for a separate starter project, not for this game. Each new package also repeats the earlier ones. I'll use them as a guide and rewrite what works for this game's systems. Nothing gets copied over the game.

## What this milestone delivers (playable, not a demo)
1. **Each vehicle type handles differently.** Six handling styles, each matched to the existing vehicles:
   - Racing cars and the hoverbike: high grip, and a handbrake drift.
   - Off-road jeep and buggy: grip that changes with sand, mud, snow and roads.
   - Tanks: slow and heavy, and can turn on the spot.
   - Jet: throttle, pitch, roll and yaw. Needs speed to take off, and lands on flat ground below a safe speed.
   - Helicopter: hovers, climbs, descends and moves sideways.
   - Boats and submarine: float on the water surface (the submarine can dive). They stay in water and slow down hard in the shallows.
2. **Terrain and surface grip.** The region and ground under you change grip and drift: road, sand, mud, snow, ice and grass. This replaces today's single "biome grip" number.
3. **Getting in and out safely.** You can't get out at high speed, in mid-air, or over deep water unless you're in a boat. A plane has to land first. You can only enter vehicles you own.
4. **Cameras.** Chase camera for cars, a wider and higher chase camera for aircraft, and a low follow camera for boats and the submarine. F switches to a cockpit view. Your existing camera setting is kept.
5. **Controller and keyboard.** A gamepad's sticks and triggers give smooth steering and throttle. Aircraft get pitch and roll on the stick, with climb and descend on the bumpers. Keyboard adds Space and Ctrl to climb and descend. All of this goes into the existing controls menu so you can remap it.
6. **Sound and rumble.** Each vehicle type gets its own engine, wind or hull sound. Tyres screech in a drift, plus splash, boost and crash sounds, and controller rumble on crashes and landings. These are generated sounds through the existing audio settings, not recorded files.
7. **Homes, finished from last time.** A property agent in Neon City lets you buy homes. An in-home screen lets you place furniture, paint, art and TVs room by room.

Fuel stays out, as you asked.

## Left for later milestones (on the to-do list, not this round)
- Proper 3D models for vehicle parts you can see move, like landing gear and suspension.
- The world-wide visual pass, region by region.
- The full world sound pass and the UI package: Atlas, activity log and faction contacts.

## How it will be checked
- Automated tests for each handling rule. For example: the jet can't take off below its takeoff speed, boats can't drive onto land, you can't get out at speed, and ice gives less grip than road.
- A browser test with screenshots: drive the jeep, take off and land the jet, and take a boat onto the water. I'll report test results and what I saw in the browser separately. I can't feel how the handling plays or check it with a real controller.

## Technical details
- A new pure file, `src/game/vehicle-handling.ts`, holds a profile per vehicle domain/type (`VEHICLE_HANDLING[id]`) plus `stepVehicle(state, input, surface, dt)`. It returns speed, yaw, pitch, roll, vertical speed and an airborne/landed flag, and it feeds the existing `damageFx` and `tunedVehicle` numbers. A matching test file goes with it.
- A new `src/game/vehicle-surface.ts` maps the region, slope, height above water and roads to a surface grip, and is tested.
- `Scene.tsx` replaces the vehicle block around line 1564 with `stepVehicle`, and keeps the collision, condition and forced-exit code. It applies height for AIR/WATER domains, and adds an exit check next to the KeyE toggle.
- `bindings.ts` gains vehicle actions: ascend, descend, handbrake and analog axes.
- `vehicle-audio.ts` gains per-domain engine profiles and skid/wind/hull layers. Rumble goes through the existing combat-feedback helper.
- Housing gets a `PropertyAgent` interior entry in Neon City (interiors.ts), plus a `HousingPanel.tsx` that uses `housing.ts`.
- `AGENTS.md` gets a rule: vehicle handling is one pure per-domain stepper; Scene only applies it.
