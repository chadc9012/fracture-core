/** Live lighting state for world props that react to the day cycle without a prop drilled through every city
 * component: Scene.tsx writes it once per frame, street lights, shop glow and light pools read it in their own
 * useFrame. 0 = full day, 1 = full night. */
export const worldLight = { night: 0, /** the sky's horizon colour this frame (linear RGB, SkyDome writes it): distant scenery hazes toward it */ horizon: [0.7, 0.8, 0.9] as [number, number, number] };

/** how strongly artificial lights read: off by day, ramping in through dusk */
export const lampLevel = (night: number) => Math.min(1, Math.max(0, (night - 0.15) / 0.5));
