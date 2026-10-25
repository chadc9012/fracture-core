/** Authored bodies for the merchants from the owner's sheets (reference-roster.ts). Each is a Meshy image-to-3D model made from
 * docs/reference/merchant-<id>-front.jpg, remeshed, rigged with a Mixamo skeleton and given an idle clip, saved at
 * public/models/npcs/merchants/<id>.glb. A shop whose merchant has no model yet keeps the generic civilian vendor body.
 * Pure data; Interiors.tsx and ShopStalls.tsx draw them through SpeakingFigure. */
import { REFERENCE_MERCHANTS } from "./reference-roster";
import { keeperFor } from "./population";

/** merchants whose GLB is in public/models/npcs/merchants (a test checks every one exists) */
export const MERCHANT_MODEL_IDS: ReadonlySet<string> = new Set<string>(["cruz-mendez", "thalia-ren", "malek-daram", "rafiq-kaleem", "jax-kane", "selene-voss"]);

export const merchantModelPath = (merchantId: string) => `/models/npcs/merchants/${merchantId}.glb`;

/** the authored body for the merchant keeping this shop, or null while there is none */
export function merchantModelUrl(shopId: string | undefined): string | null {
  if (!shopId) return null;
  const m = REFERENCE_MERCHANTS.find((x) => x.shopId === shopId);
  return m && MERCHANT_MODEL_IDS.has(m.id) ? merchantModelPath(m.id) : null;
}

/** the name a shop's keeper goes by: the named shopkeeper (population.ts) when there is one */
export const keeperName = (shopId: string, shopName: string) => keeperFor(shopId)?.name ?? `${shopName} specialist`;
