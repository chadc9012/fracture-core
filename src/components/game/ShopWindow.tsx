import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlayerProgression } from "@/game/progression";
import type { GearItem } from "@/game/inventory";
import { REGIONAL_SHOPS, SHOP_KIND_LABEL, shopLock, shopOffers, shopPriceMult, buyOffer, serviceTargets, serviceGear, serviceFee } from "@/game/regional-shops";
import { FACTIONS, SHOP_FACTION, TIER_RULES, tierOf, EMPTY_LIVING } from "@/game/living-world";
import { canSellDuplicate, sellDuplicate, sellValue } from "@/game/stash";
import { shopAccessKind } from "@/game/shop-access";
import { comparePrice, sortOffers, type OfferSort } from "@/game/shop-compare";

const ELEMENTS: GearItem["element"][] = ["THERMAL", "CRYO", "ARC", "BIO"];

export function ShopWindow({ shopId, progression, onProgression, onClose }: { shopId: string; progression: PlayerProgression; onProgression: (next: PlayerProgression) => void; onClose: () => void }) {
  const shop = REGIONAL_SHOPS.find((s) => s.id === shopId);
  const [notice, setNotice] = useState("");
  const [element, setElement] = useState<GearItem["element"]>("THERMAL");
  const [sale, setSale] = useState<string | null>(null);
  const [sort, setSort] = useState<OfferSort>("default");
  const [affordable, setAffordable] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const mult = shop ? shopPriceMult(shop, progression) : 1;
  const offers = useMemo(() => (shop ? shopOffers(shop, undefined, mult) : []), [shop, mult]);
  if (!shop) return null;
  const owner = SHOP_FACTION[shop.id];
  const ownerTier = owner ? tierOf(progression.living ?? EMPTY_LIVING, owner) : null;
  const lock = shopLock(shop, progression);
  const funds = progression.materials[shop.currency] ?? 0;
  const access = shopAccessKind(shop.id);
  const visible = sortOffers(offers, sort, funds, affordable);
  const targets = serviceTargets(shop, progression);
  const duplicates = progression.inventory.filter((item) => canSellDuplicate(progression, item));
  const pendingSale = duplicates.find((item) => item.id === sale);
  const apply = (r: ReturnType<typeof buyOffer>) => { if ("error" in r) setNotice(r.error); else { onProgression(r.progression); setNotice(r.message); } };

  return (
    <div role="dialog" aria-modal="true" aria-label={shop.name} className="wf-shell absolute inset-0 z-40 flex items-center justify-center bg-background/80 p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="wf-panel max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary">{SHOP_KIND_LABEL[shop.kind]} · {shop.place}</p>
            <h3 className="mt-1 text-2xl font-semibold">{shop.name}</h3>
            <p className="text-xs text-muted-foreground">{shop.blurb} · stock rotates daily</p>
            {owner && ownerTier && <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: TIER_RULES[ownerTier].color }}>{FACTIONS[owner].name} · {TIER_RULES[ownerTier].label}{Math.abs(mult - 1) > 0.001 ? ` · prices ×${mult.toFixed(2)}` : ""}</p>}
          </div>
          <div className="text-right">
            <p className="font-mono text-xs">{funds} {shop.currency}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={onClose}>Leave</Button>
          </div>
        </div>
        {lock && <p className="mt-4 border border-destructive/50 p-3 text-sm text-destructive">Closed to you · {lock}</p>}
        {notice && <p role="status" className="mt-3 text-xs text-primary">{notice}</p>}
        {!lock && <section className="mt-5 border-t border-border pt-4">
          <div className="flex justify-between gap-3"><h4 className="font-mono text-sm">Sell duplicate gear</h4><span className="text-xs text-primary">{progression.fractureShards} fracture shards</span></div>
          {duplicates.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No spare duplicates available.</p>}
          {duplicates.map((item) => <div key={item.id} className="mt-2 flex items-center justify-between gap-3 border-b border-border py-2"><div className="min-w-0"><p className="truncate text-sm">{item.name}</p><p className="text-xs text-muted-foreground">{item.slot} · Power {item.power} · Level {item.level}</p></div><Button size="sm" variant="outline" onClick={() => setSale(item.id)}>Sell · {sellValue(item)} shards</Button></div>)}
          {pendingSale && <div role="alertdialog" aria-label="Confirm duplicate sale" className="mt-3 border border-primary p-3">
            <p className="text-sm">Sell {pendingSale.name} to {shop.name} for <strong>{sellValue(pendingSale)} fracture shards</strong>?</p>
            <p className="mt-1 text-xs text-muted-foreground">This copy will be permanently removed.</p>
            <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => { const next = shopLock(shop, progression) ? progression : sellDuplicate(progression, pendingSale.id); if (next !== progression) { onProgression(next); setNotice(`Sold ${pendingSale.name} · +${sellValue(pendingSale)} fracture shards`); } setSale(null); }}>Confirm sale</Button><Button size="sm" variant="outline" onClick={() => setSale(null)}>Cancel</Button></div>
          </div>}
        </section>}
        {!lock && offers.length > 0 && (
          <section className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">{access === "interior" ? "In-store stock" : access === "window" ? "Window display" : "On the table"} · {visible.length} items</p>
              {(["default", "price-asc", "price-desc"] as OfferSort[]).map((s) => <Button key={s} size="sm" variant={sort === s ? "default" : "outline"} onClick={() => setSort(s)}>{s === "default" ? "Featured" : s === "price-asc" ? "Price ↑" : "Price ↓"}</Button>)}
              <Button size="sm" variant={affordable ? "default" : "outline"} onClick={() => setAffordable((v) => !v)}>Can afford</Button>
            </div>
            <div className="mt-2 space-y-2">
              {visible.map((o) => {
                const lvl = progression.level < o.minLevel;
                const open = preview === o.key;
                const cmp = open ? comparePrice(shop, o) : null;
                return (
                  <div key={o.key} className={`border p-3 ${open ? "border-primary" : "border-border"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button className="min-w-0 text-left" onClick={() => { setPreview(open ? null : o.key); setConfirm(null); }} aria-expanded={open}>
                        <p className="font-mono text-sm">{o.name}</p><p className="text-[10px] text-muted-foreground">{o.detail}</p>
                      </button>
                      <Button size="sm" variant="outline" disabled={lvl || funds < o.price} onClick={() => { setPreview(o.key); setConfirm(o.key); }}>{lvl ? `Level ${o.minLevel}` : `${o.price} ${shop.currency}`}</Button>
                    </div>
                    {open && cmp && <div className="mt-3 grid gap-1 border-t border-border pt-2 text-xs">
                      <p>Type: {o.type === "gear" ? "Weapon / gear" : o.type === "piece" ? "Armor piece" : "Materials"} · Requires level {o.minLevel}</p>
                      <p>After purchase: {funds - o.price} {shop.currency}{funds < o.price ? ` (short ${o.price - funds})` : ""}</p>
                      <p className={cmp.delta == null ? "text-muted-foreground" : cmp.delta > 0 ? "text-destructive" : "text-primary"}>
                        {cmp.cheapest ? cmp.delta! > 0 ? `${cmp.delta} cheaper at ${cmp.cheapest.shopName} (${cmp.cheapest.place})` : cmp.delta === 0 ? `Same price at ${cmp.cheapest.shopName}` : `Best price — ${-cmp.delta!} less than ${cmp.cheapest.shopName}` : "Only stocked here today"}
                      </p>
                    </div>}
                    {confirm === o.key && <div role="alertdialog" aria-label="Confirm purchase" className="mt-3 flex flex-wrap items-center gap-2 border border-primary p-2 text-xs">
                      <span className="mr-auto">Buy {o.name} for {o.price} {shop.currency}?</span>
                      <Button size="sm" onClick={() => { apply(buyOffer(progression, shop, o)); setConfirm(null); }}>Buy</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
                    </div>}
                  </div>
                );
              })}
              {visible.length === 0 && <p className="text-xs text-muted-foreground">Nothing here you can afford yet.</p>}
            </div>
          </section>
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
