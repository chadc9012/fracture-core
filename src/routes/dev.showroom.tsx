import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Showroom = lazy(() => import("@/components/game/Showroom"));

/**
 * Dev showroom: fleet vehicles and city buildings drawn through the game's own components (AuthoredVehicle, InstancedGlb,
 * the facade shader) under a sun, a sky and street light, so their look can be judged without loading the world.
 *   /dev/showroom?set=cars|trucks|air|buildings|facades&hour=13
 */
export const Route = createFileRoute("/dev/showroom")({
  head: () => ({ meta: [{ title: "Showroom — World Fracture (dev)" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ClientOnly fallback={<p className="p-4">Loading…</p>}>
      <Suspense fallback={<p className="p-4">Loading…</p>}><Showroom /></Suspense>
    </ClientOnly>
  ),
});
