# Engine samples

The same World Fracture scene in two engines, to compare on a phone: a Nexus City street (day/night switch) and a foggy
forest war zone with a wrecked-armour checkpoint (CITY / WAR ZONE button).

- `godot-nexus-street/` — Godot 4.6 (GDScript). Builds with no account.
- `unity-nexus-street/` — Unity 6 URP (C#). Built by GameCI with the UNITY_LICENSE / UNITY_EMAIL / UNITY_PASSWORD secrets.

`.github/workflows/engine-samples.yml` builds both APKs and attaches them to the `engine-samples` release.

Controls: left side drag to walk, right side drag to look; keyboard WASD, N day/night, T city/war zone.
