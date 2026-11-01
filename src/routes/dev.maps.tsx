import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { DEFAULT_PROGRESSION } from "@/game/progression";
import { REGIONS } from "@/game/world";

const PlanetMap = lazy(() => import("@/components/game/PlanetMap").then((m) => ({ default: m.PlanetMap })));

/** Developer view of the planet globe and the street maps without starting a run (a fresh profile standing in Nexus City). */
export const Route = createFileRoute("/dev/maps")({
  head: () => ({ meta: [{ title: "Maps — World Fracture (dev)" }, { name: "robots", content: "noindex" }] }),
  component: MapsPage,
});

function MapsPage() {
  const nexus = REGIONS.find((r) => r.id === "nexus")!;
  return (
    <div className="min-h-screen bg-[#02060c] p-2 text-slate-100">
      <ClientOnly fallback={<p className="p-4">Loading…</p>}>
        <Suspense fallback={<p className="p-4">Loading…</p>}>
          <PlanetMap progression={DEFAULT_PROGRESSION} onDeploy={() => {}} currentWorld="aetheria" currentRegion="nexus" playerPos={{ x: nexus.x, z: nexus.z }} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
