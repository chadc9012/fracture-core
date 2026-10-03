# Destiny-Inspired Onboarding and Full-Game UI

## Goal
Refine WORLD FRACTURE’s complete player-facing flow using the linked Destiny UI archive as a reference while preserving WORLD FRACTURE’s own identity, world, classes, missions, and assets.

## What will change

### 1. Startup and onboarding flow
- Rework the title flow into clear full-screen states: title, identity setup, deployment briefing, and world entry.
- Give class, subclass, and appearance selection a quieter full-screen presentation with one focused decision per step, strong selection feedback, progress markers, and consistent back/confirm actions.
- Add a short deployment/loading state after identity confirmation that presents the destination, mission name, and current objective before entering the world.
- Keep vehicle selection out of onboarding; the starter vehicle remains earned after Mission 01.

### 2. In-game HUD
- Reduce permanent panel weight and let the world remain dominant.
- Group information by purpose: navigation and objectives at the top, player status and abilities at lower left, weapon/ammo at lower right, critical combat information near the center.
- Make mission prompts, alerts, boss status, damage feedback, and low-resource warnings appear contextually with clean entrance/exit motion.
- Preserve all existing combat values, Titan systems, weapon slots, camera behavior, and controller support.

### 3. Menus and world navigation
- Replace the small settings popup with a full-screen game menu organized into Gameplay, Display, Audio, Interface, Controls, and Accessibility sections.
- Create a consistent tab and cursor/focus language across settings, inventory, operations, and the world atlas.
- Refine the world atlas into a destination-first activity map with selected-region details, mission markers, threat/readiness information, and a clear launch/track action.
- Add a pre-deployment briefing state for activities launched from the map or operations screens.

### 4. Visual and motion system
- Establish a restrained, spacious sci-fi interface: thin geometry, off-white text, one WORLD FRACTURE accent, strong hierarchy, and fewer heavy boxed panels.
- Standardize menu transitions, selection states, loading motion, focus behavior, and controller/keyboard prompts.
- Keep motion subtle, fast, and reduced-motion safe.
- Maintain readability on the current compact preview and standard desktop sizes.

### 5. Validation
- Test the full path from title → onboarding → deployment → tutorial → free roam.
- Verify keyboard, mouse, and controller-oriented focus states where supported.
- Check that HUD elements do not collide during tutorial, boss, emergency quest, dialogue, and mission states.
- Verify settings persistence, menu navigation, world-map actions, and the existing spoken NOVA flow.

## Technical notes
- Changes will stay in presentation and existing screen-state orchestration; combat, progression, saves, mission rules, and vehicle unlock rules will not be rewritten.
- Existing design tokens and Button controls will be reused and extended rather than introducing a second visual system.
- The reference is used for interaction and layout principles only; no Destiny logos, text, icons, screenshots, or proprietary assets will be copied.
