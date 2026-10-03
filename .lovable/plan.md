# Lifelike voiced scenes, smooth narration, Poly Haven world look, and fixes for Destiny-style retention problems

## 1. Faces and gestures that follow speech
- The voice system reports what is happening live: who is speaking, how loud they are right now, and when a line starts and ends.
- NPCs, bosses and enemies listen for their own speaker name:
  - **Mouth/face:** jaw opens and a face glow pulses with loudness. Robot or masked enemies get a visor or eye flicker instead.
  - **Gestures:** chosen from the line's mood (calm = small head tilt; threat = lean in, raise an arm; urgent = quick nods). Shoulders "breathe" between phrases.
  - **Look-at:** the speaker turns its head toward the player, and listeners glance at the speaker.
- Everything is driven by the animation loop, so it adds no extra screen redraws. If voice is muted, the same gestures play using caption timing.

## 2. Responsive, stutter-free voice
- **Pre-fetch:** fetch the next likely line ahead of time (the next mission step, the next onboarding beat) while the game is quiet.
- **Remember lines already spoken:** keep up to about 40 decoded lines in memory, then let the oldest go. Repeated barks and replays start instantly and make no new voice request.
- **Lighter decoding:** decode audio in small pieces during idle time, not inside the frame loop, and reuse one shared audio node chain.
- **Polite interruptions:** quick fade-outs instead of hard cuts. Low-priority barks are skipped during heavy fights or at low frame rates. Only one request runs at a time, and stale requests are cancelled.
- **Captions first:** text shows immediately, and voice joins as soon as the first audio arrives.

## 3. World look inspired by the Poly Haven gallery
Poly Haven's gallery is a set of renders made with its free assets. I'll match that look: natural sky-light, soft ground shadows, realistic materials.
- Each region gets a free (CC0) sky image for lighting, picked to fit it: forest overcast, desert noon, city dusk, underwater, and others. Each region also gets a matching color grade.
- Realistic ground and rock materials (moss, sand, concrete, wet rock) at small sizes. All images are saved inside the project, so a dead link can never freeze the world again.
- Rock and plant models are added only if they load fully. Each one is checked first, with the current shapes as a fallback.
- Lower quality tiers keep simpler skies and materials for speed. Safari keeps its safe defaults.

## 4. Fixing the problems that hurt Destiny's player retention
- **Story never vaulted:** a "Chronicle" page in the menu where you can replay any finished mission's story scenes and re-read their logs. All campaigns stay playable. Nothing is ever removed.
- **Clear next step:** a "What next" card on the world map and pause menu with one recommended activity, why it's recommended, and the reward. This is added to the deployment briefing.
- **Catch-up recap:** if you return after a long break, NOVA plays a short spoken summary of your last mission and what's next.
- **Less grind:** a daily cap on repeat-activity rewards, bonus progress for first-time activities, and no progression resets. This matches the existing "progress only grows" save rule.
- **Visible future:** a small "Roadmap" panel in the menu listing upcoming regions and features from a single list that's easy to edit.

## Technical notes
- The voice director keeps a lightweight state (speaker, envelope level 0–1, phase) that animation code reads each frame. Envelope levels come from the playing audio.
- Cached audio buffers are held in memory with least-recently-used removal, plus a `prefetch(id, text, speaker)` call. No retries after errors, in line with the AI service's error rules.
- Poly Haven assets go into the project's asset folder at 1k size (sky images as .hdr or .jpg). The existing rule that every model texture must load still applies.
- The Chronicle, What next and Roadmap panels are new sections inside the existing full-screen menu system, and they keep the one-panel-at-a-time rule.
- The reward cap and recap timing are pure functions with tests.
