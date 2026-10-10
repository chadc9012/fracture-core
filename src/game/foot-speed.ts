/** On-foot speed in world units/s. The original ~380 m world used 30 (sprint x2.1); at WORLD_SCALE > 1 the map is far wider, so crossing
 * it should feel like travel: 14 walk / ~30 sprint. Scene reads these; movement-feel scales its stride thresholds by FOOT_SCALE. */
import { WORLD_SCALE } from "./world";

export const BASE_FOOT_SPEED = WORLD_SCALE > 1 ? 14 : 30;
export const SPRINT_MULT = WORLD_SCALE > 1 ? 2.15 : 2.1;
/** 1 at the original world; < 1 when walking is slower */
export const FOOT_SCALE = BASE_FOOT_SPEED / 30;
