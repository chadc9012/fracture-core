/** One-shot hand-offs between the UI and the running scene for the player's vehicle: "drive this one out of the garage"
 * (the scene puts you in the driver's seat at the bay, facing out) and "you just parked in a bay" (the scene reports
 * where you stepped out, so the UI can record which garage holds the car). Module-level so neither side needs a prop. */
export type DriveOut = { x: number; z: number; y: number; yaw: number };
let pending: DriveOut | null = null;
export const requestDriveOut = (at: DriveOut) => { pending = at; };
/** the scene takes the request once */
export const takeDriveOut = (): DriveOut | null => { const p = pending; pending = null; return p; };
type ExitListener = (x: number, z: number) => void;
const exitListeners = new Set<ExitListener>();
/** the UI listens for where you step out of the vehicle (to park it in a garage bay) */
export const onVehicleExit = (l: ExitListener) => { exitListeners.add(l); return () => { exitListeners.delete(l); }; };
export const reportVehicleExit = (x: number, z: number) => { for (const l of exitListeners) l(x, z); };
const enterListeners = new Set<() => void>();
/** the UI hears when you get in (a summoned car that was parked in a garage has left it) */
export const onVehicleEnter = (l: () => void) => { enterListeners.add(l); return () => { enterListeners.delete(l); }; };
export const reportVehicleEnter = () => { for (const l of enterListeners) l(); };
