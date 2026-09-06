import { createFileRoute } from "@tanstack/react-router";

import { GameCanvas } from "@/components/game/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fractured Earth — Playable World Map" },
      {
        name: "description",
        content:
          "Walk the Fractured Earth: safe hubs, the central war belt, fracture zones and the northern core, with a live day/night cycle.",
      },
      { property: "og:title", content: "Fractured Earth — Playable World Map" },
      {
        property: "og:description",
        content:
          "Explore seven regions with their own movement, hazard and risk rules across a living day/night cycle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
