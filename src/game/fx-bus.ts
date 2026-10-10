/** Client-only presentation pools shared by Scene (which feeds them) and CombatFx (which draws them). Never saved, never read by the sim. */
import { createCasings } from "./casings";
import { createFlights } from "./combat-fx";
export const FLIGHT_POOL = 48, CASING_POOL = 40;
export const fxBus = { flights: createFlights(FLIGHT_POOL), casings: createCasings(CASING_POOL) };
