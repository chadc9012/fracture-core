import { advanceMission } from "./system-core";
import { SYSTEM_CORE } from "./system-core";
import { missionSuite } from "./mission-suite";

missionSuite("System Core state machine", {
  id: "system-core", advance: advanceMission as never, initial: SYSTEM_CORE, payState: "WORLD_UPDATE", questId: "fd-18", materials: { fractureCore: 1 },
  script: [
    [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 3, z: 4 }, "DIVE"], [{ type: "ARRIVED" }, "COMBAT_1"], [{ type: "CLEAR" }, "STABILIZING"],
    [{ type: "HACK", progress: 100 }, "BOSS"], [{ type: "CLEAR" }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
  ],
});
