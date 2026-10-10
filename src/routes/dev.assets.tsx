import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { ASSET_INVENTORY, inspectable } from "@/game/asset-inventory";

const AssetViewer = lazy(() => import("@/components/game/AssetViewer"));

export const Route = createFileRoute("/dev/assets")({
  head: () => ({
    meta: [
      { title: "Asset Inspector — World Fracture (dev)" },
      { name: "description", content: "Developer tool to inspect World Fracture 3D models one at a time." },
      { property: "og:title", content: "Asset Inspector — World Fracture" },
      { property: "og:description", content: "Inspect models, materials, clips and scale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssetsPage,
});

function AssetsPage() {
  const list = inspectable();
  const [url, setUrl] = useState(list[0]?.url ?? "");
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-80 shrink-0 space-y-2 overflow-y-auto border-r border-border p-4 text-xs">
        <h1 className="text-sm font-semibold">Asset inventory</h1>
        {ASSET_INVENTORY.map((a) => (
          <button key={a.id} disabled={!a.url} onClick={() => a.url && setUrl(a.url)}
            className={`block w-full rounded border p-2 text-left ${a.url === url ? "border-primary" : "border-border"} disabled:opacity-60`}>
            <span className="font-mono">[{a.status}] {a.category} · {a.id}</span>
            <span className="mt-1 block text-muted-foreground">{a.note}</span>
          </button>
        ))}
      </aside>
      <main className="flex-1">
        <ClientOnly fallback={<p className="p-4">Loading viewer…</p>}>
          <Suspense fallback={<p className="p-4">Loading viewer…</p>}>{url && <AssetViewer key={url} url={url} />}</Suspense>
        </ClientOnly>
      </main>
    </div>
  );
}
