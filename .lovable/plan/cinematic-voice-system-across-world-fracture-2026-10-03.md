# Cinematic voice system across World Fracture

## Goal
Add spoken story presentation from the title screen and Identity Forge through cinematics, missions, open-world NPC encounters, bosses, victory, and campaign ending.

## Voice direction
- NOVA: calm feminine AI; controlled, intelligent, and warm under pressure.
- Narrator: cinematic, restrained, and distinct from NOVA.
- Story cast: named NPCs and mission bosses receive distinct voices; routine enemies use short situational callouts rather than constant chatter.
- Preserve captions for every line and keep the game fully playable with voice muted or unavailable.

## Build
1. Add one central voice director that queues lines, prevents duplicates, interrupts lower-priority chatter for critical mission guidance, and stops cleanly during skips, menus, and scene changes.
2. Add streamed speech playback through the existing Lovable AI service, with safe error messages and no credentials in the browser.
3. Add saved Voice volume and Spoken dialogue toggles alongside Master, Music, and Sound Effects.
4. Connect voices to title/startup, Identity Forge selection and assembly, intro cinematic, tutorial steps, all current NOVA mission overlays, NPC dialogue, bosses, victory, death, and ending.
5. Add subtitle speaker/status treatment so voice remains readable over combat and matches the supplied cinematic interface references.
6. Verify startup, onboarding, one mission line, one NPC exchange, muting, skipping, and Safari-safe failure behavior.

## Technical details
- Use the default speech model `google/gemini-3.1-flash-tts-preview` through the server-side speech endpoint.
- Stream 24 kHz PCM to the browser and route playback through a dedicated voice gain stage controlled by the saved voice setting.
- Keep authored lines in the existing mission/dialogue state machines; audio is presentation only and never changes progression.
- Cancel stale queued speech when its story surface closes. Do not retry denied or blocked speech requests.
