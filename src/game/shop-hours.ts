/** Shop hours: merchants in the two cities close for the small hours, and the black markets only trade at night. Outposts and
 * remote shops never close. The hour comes from the world clock (world.ts hourOf); until a clock is set (tests, menus) every shop
 * is open, so nothing here can lock a player out by accident. Pure apart from the one clock value Scene updates. */
export type ShopHours = { open: number; close: number }; // hours 0..24; close < open means the window runs through midnight

type HourShop = { id: string; kind: string };
const CITY_HOURS: ShopHours = { open: 5, close: 25 }; // closed 01:00-05:00 (close 25 = 01:00 next day)
const NIGHT_HOURS: ShopHours = { open: 18, close: 5 };

export function shopHours(shop: HourShop): ShopHours | null {
  if (shop.kind === "blackmarket") return NIGHT_HOURS;
  return shop.id.startsWith("nexus-") || shop.id.startsWith("neon-") ? CITY_HOURS : null;
}

const norm = (h: number) => ((h % 24) + 24) % 24;
export function isOpenAt(hours: ShopHours | null, hour: number | null): boolean {
  if (!hours || hour === null || !Number.isFinite(hour)) return true;
  const h = norm(hour), open = norm(hours.open), close = norm(hours.close);
  if (open === close) return true;
  return open < close ? h >= open && h < close : h >= open || h < close;
}

const clock = (h: number) => `${String(Math.floor(norm(h))).padStart(2, "0")}:00`;
export const shopHoursLabel = (hours: ShopHours | null) => (hours ? `${clock(hours.open)}–${clock(hours.close)}` : "Always open");
/** null = open now; otherwise why the door is shut */
export function shopClosedReason(shop: HourShop, hour: number | null): string | null {
  const hours = shopHours(shop);
  return isOpenAt(hours, hour) ? null : `Closed · opens ${clock(hours!.open)}`;
}

let worldHour: number | null = null;
export const setShopClockHour = (h: number | null) => { worldHour = h; };
export const shopClockHour = () => worldHour;
