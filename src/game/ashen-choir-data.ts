/** Raid 02 · The Ashen Choir: the second raid, as a dungeon-engine definition (data only). It runs as a fireteam simulation in the
 * Operations hub (no live arena yet); its weekly lockout, encounter drops and difficulty tiers share the Hollow Star's machinery (raid-lockout.ts). */
import type { DungeonDefinition } from "./dungeons";

export const ASHEN_CHOIR_ID = "ashen-choir";

export const ASHEN_CHOIR: DungeonDefinition = {
  id: ASHEN_CHOIR_ID, name: "Raid 02 · The Ashen Choir", activity: "RAID", region: "The Cinderfall · Burned Cathedral", privateInstance: true,
  squad: { min: 1, max: 6 }, duration: "90–150 min", maxLives: 8,
  identity: "A cathedral-sized server farm burned down with its congregation inside, and its voices never stopped. The Cantor still sings the old protocol, and every note rewrites the ash into something that hunts. Climb the nave, silence the bells and the organ, and end the hymn before it finishes.",
  hazard: "Resonance", boss: "The Cantor of Ash",
  signature: { name: "Cantor's Dirge", type: "WEAPON", perk: "Each kill adds a verse that raises weapon damage; at five verses the next kill bursts in ash.", repeatTraits: ["Ashen Refrain", "Low Key", "Last Verse"] },
  stages: [
    { id: "cinder-nave", hazardPerStep: 5, name: "The Cinder Nave", room: "Collapsed Nave", type: "COMBAT", objective: "Hold the nave against the choir's thralls while the three censer pylons are relit", target: 6, checkpoint: true, hazardLabel: "RESONANCE",
      enemies: ["Ash Thrall", "Choir Warden"], triggers: ["Censer 1 lit", "Censer 2 lit", "Nave steadied"] },
    { id: "bellwright-gallery", hazardPerStep: 5, name: "The Bellwright Gallery", room: "Bell Tower Stairs", type: "TRAVERSAL_COMBAT", objective: "Climb the failing tower while thralls drop from the beams and the bells shake the stairs loose", target: 7, checkpoint: true, hazardLabel: "TOLLING",
      enemies: ["Ash Thrall", "Cinder Cantrix"], triggers: ["Bell cracks", "Landing held", "Belfry reached"],
      routes: [
        { id: "outer-stair", name: "Outer stair", tradeoff: "Open air and long sight lines, but the bells hit you with their full tone." },
        { id: "inner-shaft", name: "Inner shaft", tradeoff: "Muffled from the bells, but cramped and swarming with thralls." },
      ] },
    { id: "pyre-crypts", hazardPerStep: 4, name: "The Pyre Crypts", room: "Four Ember Vaults", type: "PUZZLE_COMBAT", objective: "Split up, snuff the four pyres in the right order and hold each vault against wardens", target: 9, checkpoint: true, hazardLabel: "EMBERFALL",
      enemies: ["Choir Warden", "Pyre Sexton"], triggers: ["Pyre A snuffed", "Pyre B snuffed", "Pyre C snuffed", "Pyre D snuffed"] },
    { id: "organ-vault", hazardPerStep: 5, name: "The Organ Vault", room: "Pipe Hall", type: "PUZZLE_COMBAT", objective: "Silence the organ's pipes in sequence, break the resonance shield and survive the chords", target: 8, checkpoint: true, hazardLabel: "DISSONANCE",
      enemies: ["Pyre Sexton", "Cinder Cantrix", "Ash Thrall"], triggers: ["Pipe silenced", "Resonance down", "Chord survived", "Hall quiet"] },
    { id: "choir-loft", hazardPerStep: 5, name: "The Choir Loft", room: "Mirrored Lofts", type: "SYNC_TRAVERSAL", objective: "Two teams stand in separate lofts, sing the counter-hymn in time and cross to the altar together", target: 7, checkpoint: true, hazardLabel: "OFF-KEY",
      enemies: ["Cinder Cantrix", "Choir Warden"], triggers: ["Lofts split", "Hymn in time", "Teams reunite"] },
    { id: "cantor-boss", hazardPerStep: 4, name: "The Cantor of Ash", room: "High Altar", type: "BOSS_FIGHT", objective: "Reach the altar and silence the Cantor before the last verse is sung", target: 16, checkpoint: false, hazardLabel: "LAST VERSE",
      enemies: ["The Cantor of Ash", "Ash Thrall", "Choir Warden", "Cinder Cantrix", "Pyre Sexton"], triggers: ["First verse", "Bells answer", "Choir splits", "Voice exposed"],
      bossPhases: [
        { name: "Phase I · First Verse", threshold: 100, mechanic: "The Cantor sings in waves of ash and calls thralls with every refrain.", counter: "Stay off the sound rings and kill the wardens before the next refrain." },
        { name: "Phase II · The Bells Answer", threshold: 70, mechanic: "Four bells ring in turn; each one that finishes tolling empowers the Cantor.", counter: "Send a team to each bell and cut its rope before the toll ends." },
        { name: "Phase III · Split Choir", threshold: 40, mechanic: "The Cantor sings two lines at once and the arena splits into a burning and a silent half.", counter: "Call which half you are in: the silent team holds the note, the burning team breaks the echoes." },
        { name: "Phase IV · Last Verse", threshold: 15, mechanic: "The altar burns down and the Cantor's voice is exposed, but the final verse is a timer.", counter: "Survive the ashfall, strip the resonance shield and focus the voice before the hymn ends." },
      ], reward: "Cantor's Dirge" },
  ],
};
