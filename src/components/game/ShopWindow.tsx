import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import type { GearItem } from "@/game/inventory";
import { REGIONAL_SHOPS, SHOP_KIND_LABEL, shopLock, shopOffers, buyOffer, serviceTargets, serviceGear, serviceFee } from "@/game/regional-shops";

const ELEMENTS: GearItem["element"][] = ["THERMAL", "CRYO", "ARC", "BIO"];

export function ShopWindow({ shopId, progression, onProgression, onClose }: { shopId: string; progression: PlayerProgression; onProgression: (next: PlayerProgression) => void; onClose: () => void }) {
  const shop = REGIONAL_SHOPS.find((s) => s.id === shopId);
  const [notice, setNotice] = useState("");
  const [element, setElement] = useState<GearItem["element"]>("THERMAL");
  const offers = useMemo(() => (shop ? shopOffers(shop) : []), [shop]);
  if (!shop) return null;
  const lock = shopLock(shop, progression);
  const funds = progression.materials[shop.currency] ?? 0;
  const targets = serviceTargets(shop, progression);
  const apply = (r: ReturnType<typeof buyOffer>) => { if ("error" in r) setNotice(r.error); else { onProgression(r.progression); setNotice(r.message); } };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">{SHOP_KIND_LABEL[shop.kind]} · {shop.place}</p>
            <h3 className="mt-1 text-2xl font-semibold">{shop.name}</h3>
            <p className="text-xs text-muted-foreground">{shop.blurb} · stock rotates daily</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs">{funds} {shop.currency}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={onClose}>Leave</Button>
          </div>
        </div>
        {lock && <p className="mt-4 border border-destructive/50 p-3 text-sm text-destructive">Closed to you · {lock}</p>}
        {notice && <p className="mt-3 text-xs text-primary">{notice}</p>}
        {!lock && offers.length > 0 && (
          <div className="mt-4 space-y-2">
            {offers.map((o) => {
              const lvl = progression.level < o.minLevel;
              return (
                <div key={o.key} className="flex items-center justify-between gap-3 border border-border p-3">
                  <div><p className="font-mono text-sm">{o.name}</p><p className="text-[10px] text-muted-foreground">{o.detail}</p></div>
                  <Button size="sm" variant="outline" disabled={lvl || funds < o.price} onClick={() => apply(buyOffer(progression, shop, o))}>{lvl ? `Level ${o.minLevel}` : `${o.price} ${shop.currency}`}</Button>
                </div>
              );
            })}
          </div>
        )}
        {!lock && (shop.kind === "gunsmith" || shop.kind === "mods" || shop.kind === "vehicles") && (
          <div className="mt-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">{shop.kind === "mods" ? "Infuse an element" : "Upgrade your gear"}</p>
            {shop.kind === "mods" && <div className="mt-2 flex gap-1">{ELEMENTS.map((e) => <Button key={e} size="sm" variant={e === element ? "default" : "outline"} onClick={() => setElement(e)}>{e}</Button>)}</div>}
            {targets.length === 0 && <p className="mt-2 text-xs text-muted-foreground">You have nothing this shop can work on.</p>}
            <div className="mt-2 space-y-2">
              {targets.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border border-border p-3">
                  <div><p className="font-mono text-sm">{item.name}</p><p className="text-[10px] text-muted-foreground">Level {item.level} · {item.element} · POWER {item.power}</p></div>
                  <Button size="sm" variant="outline" onClick={() => apply(serviceGear(progression, shop, item.id, shop.kind === "mods" ? element : undefined))}>{serviceFee(shop, item)} {shop.currency}</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
