import { advanceMission } from "./stitched-neon-core";
import { STITCHED_NEON_CORE } from "./stitched-neon-core";
import { missionSuite } from "./mission-suite";

missionSuite("Stitched Neon Core state machine", {
  id: "stitched-neon-core", advance: advanceMission as never, initial: STITCHED_NEON_CORE, payState: "WORLD_UPDATE", questId: "fd-04", materials: { aegisCore: 1 },
  script: [
    [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 3, z: 4 }, "DESCENT"], [{ type: "ARRIVED" }, "COMBAT_1"], [{ type: "CLEAR" }, "STABILIZING"],
    [{ type: "HACK", progress: 100 }, "BOSS"], [{ type: "CLEAR" }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
  ],
});
