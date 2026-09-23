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
          "Enter WORLD FRACTURE, shape a flex-class operator, and fight across an unstable living open world.",
      },
      { property: "og:title", content: "WORLD FRACTURE — Open World Action Game" },
      {
        property: "og:description",
        content:
          "Choose a class and subclass, customize a live operator, survive the first mission, and earn your first vehicle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
