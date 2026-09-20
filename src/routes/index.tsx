import { createFileRoute } from "@tanstack/react-router";

import { GameCanvas } from "@/components/game/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "WORLD FRACTURE — Open World Action Game" },
      {
        name: "description",
        content:
          "Enter WORLD FRACTURE, choose a Resonant class and vehicle, and fight across an unstable open world.",
      },
      { property: "og:title", content: "WORLD FRACTURE — Open World Action Game" },
      {
        property: "og:description",
        content:
          "Choose your class, customize your operator, deploy a combat vehicle, and shape a fractured living world.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
