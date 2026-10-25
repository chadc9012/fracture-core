import { canAfford, spend, type Wallet } from "./economy";
/** Use the player's actual wallet, and commit the returned wallet via the central game save/reward pipeline. */
export const PENTHOUSE_PRICE=25000;
export type PropertyPurchase = {ok:true; wallet:Wallet; reason:string}|{ok:false;reason:string};
export function buyPenthouse(wallet:Wallet|undefined,alreadyOwned=false):PropertyPurchase {
 if(alreadyOwned)return {ok:false,reason:"Penthouse already owned"};
 if(!wallet)return {ok:false,reason:"Purchase unavailable until connected to the active game wallet"};
 if(!canAfford(wallet,{credits:PENTHOUSE_PRICE}))return {ok:false,reason:"Insufficient credits"};
 return {ok:true,wallet:spend(wallet,{credits:PENTHOUSE_PRICE}),reason:"Purchase authorized; commit through the main save pipeline"};
}

/** Atomic purchase adapter: host must commit wallet and property together in one save transaction. */
export type PropertyPurchaseHost = {
 read(): {wallet:Wallet; penthouseOwned:boolean};
 commit(next:{wallet:Wallet;penthouseOwned:boolean}):boolean;
};
export function purchasePenthouseThroughHost(host:PropertyPurchaseHost):{ok:boolean;reason:string} {
 const current=host.read();
 const result=buyPenthouse(current.wallet,current.penthouseOwned);
 if(!result.ok)return {ok:false,reason:result.reason};
 if(!host.commit({wallet:result.wallet,penthouseOwned:true}))return {ok:false,reason:"Save transaction failed; purchase not completed"};
 return {ok:true,reason:"Penthouse purchased and saved"};
}

/* The live purchase: the penthouse is a one-time Nex spend in the player's real Nex ledger (same rule as housing.ts homes), so the
 * save, cloud merge (ledger union) and repurchase protection all come for free. Price matches PENTHOUSE_PRICE. */
import { nexBalance, spendNex, type NexLedger } from "./nex";
export const PENTHOUSE_LEDGER_KEY = "property:skyline-penthouse";
export const ownsPenthouseNex = (ledger: NexLedger | undefined) => !!ledger && PENTHOUSE_LEDGER_KEY in ledger;
export function buyPenthouseNex<P extends { nexLedger: NexLedger }>(p: P): { progression: P; message: string } | { error: string } {
  if (ownsPenthouseNex(p.nexLedger)) return { error: "Penthouse already owned" };
  const ledger = spendNex(p.nexLedger, PENTHOUSE_LEDGER_KEY, PENTHOUSE_PRICE);
  if (!ledger) return { error: `Needs ${PENTHOUSE_PRICE.toLocaleString()} Nex (you have ${nexBalance(p.nexLedger).toLocaleString()})` };
  return { progression: { ...p, nexLedger: ledger }, message: "Skyline Penthouse is yours" };
}

/** the running game publishes its current ledger and a buy action here; the penthouse in the 3D scene (a separate React root) reads it */
export type PenthouseLive = { owned: boolean; balance: number; buy: () => { ok: boolean; reason: string } };
let live: PenthouseLive | null = null;
const listeners = new Set<() => void>();
export const publishPenthouse = (next: PenthouseLive | null) => { live = next; listeners.forEach((l) => l()); };
export const penthouseLive = () => live;
export const subscribePenthouse = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
