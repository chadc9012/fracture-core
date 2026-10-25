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
