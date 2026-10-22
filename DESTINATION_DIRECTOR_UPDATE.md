# World Fracture — Destination Director redesign

- New default orbital navigation layout, designed for nine existing destinations without stretching or cropping the seven-region painted map.
- Select a region or separate city to reveal destination details and landing-zone choices.
- Landing-zone selection uses the existing discovered-landmark data and live world coordinates; primary landing preserves the established dropPoint behavior including Thalassia's underwater arrival.
- Preserves original painted map and terrain atlas as alternate map views.
- Preserves internal region IDs and per-Operator progression; no save migration required.
- Source import audit: 0 problems across 2,588 checked local imports.
- Gameplay core: 8/8 passing in this environment.
- Full production build and in-browser/controller validation not completed (dependencies unavailable).
