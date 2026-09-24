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
          "Enter WORLD FRACTURE, shape a mixed-class Resonant, conquer private dungeons, and forge a signature arsenal.",
      },
      { property: "og:title", content: "WORLD FRACTURE — Open World Action Game" },
      {
        property: "og:description",
        content:
          "Choose Titan, Hunter, or Warlock, customize a live operator, build mixed abilities, and earn fixed dungeon exotics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
