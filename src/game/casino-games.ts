/** Fictional, non-redeemable arcade chips. No real-money deposits or cash-out. */
export type CasinoGame = "slots" | "roulette" | "blackjack";
export type Card = { rank: number; suit: number };
export const drawCard = (): Card => ({ rank: 1 + Math.floor(Math.random()*13), suit: Math.floor(Math.random()*4) });
export const handValue = (cards: Card[]): number => {
 let total=cards.reduce((s,c)=>s+(c.rank===1?11:Math.min(c.rank,10)),0);
 let aces=cards.filter(c=>c.rank===1).length;
 while(total>21 && aces-->0) total-=10;
 return total;
};
export const cardName=(c:Card)=>`${["","A","2","3","4","5","6","7","8","9","10","J","Q","K"][c.rank]}${["♠","♥","♦","♣"][c.suit]}`;
export const spinSlots=()=>Array.from({length:3},()=>Math.floor(Math.random()*6));
export const slotMultiplier=(a:number[])=>a[0]===a[1]&&a[1]===a[2]?(a[0]===5?12:6):(new Set(a).size===2?2:0);
export const spinRoulette=()=>Math.floor(Math.random()*37);
export const rouletteMultiplier=(number:number,bet:"red"|"black"|"even"|"odd"|"zero")=>{
 if(bet==="zero") return number===0?36:0;
 if(number===0) return 0;
 const red=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
 return bet==="red"?(red.has(number)?2:0):bet==="black"?(!red.has(number)?2:0):bet==="even"?(number%2===0?2:0):(number%2===1?2:0);
};
