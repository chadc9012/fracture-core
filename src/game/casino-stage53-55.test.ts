import { describe, it } from "bun:test";
import { strict as assert } from "node:assert";
import { STARTING_WALLET } from "./economy";
import { purchasePenthouseThroughHost, PENTHOUSE_PRICE } from "./casino-property";
import { casinoCombatGate,initialCasinoSecurity,resolveSecurityIncident } from "./casino-safe-zone";
describe("Skyline casino integration contracts",()=>{
 it("rejects insufficient credits without saving",()=>{
  let commits=0;
  const result=purchasePenthouseThroughHost({read:()=>({wallet:STARTING_WALLET,penthouseOwned:false}),commit:()=>{commits++;return true;}});
  assert.equal(result.ok,false);assert.equal(commits,0);
 });
 it("commits the purchase once and prevents repurchase",()=>{
  let state={wallet:{...STARTING_WALLET,credits:PENTHOUSE_PRICE+200},penthouseOwned:false};
  const host={read:()=>state,commit:(next:typeof state)=>{state=next;return true;}};
  assert.equal(purchasePenthouseThroughHost(host).ok,true);
  assert.equal(state.wallet.credits,200);assert.equal(state.penthouseOwned,true);
  assert.equal(purchasePenthouseThroughHost(host).ok,false);
 });
 it("rejects weapons within casino but allows melee",()=>{
  const pos={x:5,z:5},center={x:0,z:0};
  assert.equal(casinoCombatGate("shoot",pos,center).allowed,false);
  assert.equal(casinoCombatGate("melee",pos,center).allowed,true);
  assert.equal(casinoCombatGate("shoot",{x:100,z:100},center).allowed,true);
 });
 it("escalates from warning to escort",()=>{
  const first=resolveSecurityIncident(initialCasinoSecurity(),"melee");
  assert.equal(first.response,"separate_fighters");
  assert.equal(resolveSecurityIncident(first.state,"melee").response,"escort");
 });
});
