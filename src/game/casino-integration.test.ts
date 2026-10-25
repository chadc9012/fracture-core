import { describe, it, expect } from "bun:test";
import { STARTING_WALLET } from "./economy";
import { buyPenthouse,PENTHOUSE_PRICE } from "./casino-property";
import { filterCasinoCombat,isInsideSkylineCasino,initialCasinoSecurity,registerCasinoDisturbance } from "./casino-safe-zone";
describe("Skyline casino integration contracts",()=>{
 it("blocks weapon actions only inside casino",()=>{
  expect(filterCasinoCombat("shoot",true)).toEqual({allowed:false,securityAlert:true});
  expect(filterCasinoCombat("shoot",false).allowed).toBe(true);
  expect(filterCasinoCombat("melee",true)).toEqual({allowed:true,securityAlert:true});
 });
 it("escalates disturbances",()=>{
  const first=registerCasinoDisturbance(initialCasinoSecurity());
  expect(first.warned).toBe(true);expect(first.escorted).toBe(false);
  expect(registerCasinoDisturbance(first).escorted).toBe(true);
 });
 it("uses a bounded zone",()=>{
  expect(isInsideSkylineCasino(10,10,0,0)).toBe(true);
  expect(isInsideSkylineCasino(40,10,0,0)).toBe(false);
 });
 it("does not grant property without real wallet",()=>{
  expect(buyPenthouse(undefined).ok).toBe(false);
  expect(buyPenthouse(STARTING_WALLET).ok).toBe(false);
  const rich={...STARTING_WALLET,credits:PENTHOUSE_PRICE+100};
  const result=buyPenthouse(rich);
  expect(result.ok).toBe(true);
  if(result.ok)expect(result.wallet.credits).toBe(100);
  expect(rich.credits).toBe(PENTHOUSE_PRICE+100);
 });
});
