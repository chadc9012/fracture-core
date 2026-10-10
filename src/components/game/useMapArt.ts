import { useEffect, useState } from "react";
import { MAP_ART_HIRES_URL, hiresArtUsable } from "@/game/map-art";

/** Optional high-resolution painting: HEAD-checks public/maps/fractured-earth-map-4096.jpg, decodes it, and only adopts it when it is truly
 * larger and the same shape as the bundled art. Any failure (no file, wrong shape, decode error) leaves the bundled image in place. */
let result: { url: string; width: number; height: number } | null | undefined;
export function useMapArt(fallback: string): { src: string; hires: boolean } {
  const [hi, setHi] = useState(result ?? null);
  useEffect(() => {
    if (result !== undefined || typeof window === "undefined") return;
    let live = true;
    fetch(MAP_ART_HIRES_URL, { method: "HEAD" }).then((r) => {
      const type = r.headers.get("content-type") ?? "";
      if (!r.ok || !type.startsWith("image/")) throw new Error("absent"); // dev servers answer unknown paths with index.html
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { result = hiresArtUsable(img.naturalWidth, img.naturalHeight) ? { url: MAP_ART_HIRES_URL, width: img.naturalWidth, height: img.naturalHeight } : null; if (live) setHi(result); };
      img.onerror = () => { result = null; };
      img.src = MAP_ART_HIRES_URL;
    }).catch(() => { result = null; });
    return () => { live = false; };
  }, []);
  return hi ? { src: hi.url, hires: true } : { src: fallback, hires: false };
}
