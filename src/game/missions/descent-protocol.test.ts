import { advanceMission } from "./descent-protocol";
import { DESCENT_PROTOCOL } from "./descent-protocol";
import { missionSuite } from "./mission-suite";

missionSuite("Descent Protocol state machine", {
  id: "descent-protocol", advance: advanceMission as never, initial: DESCENT_PROTOCOL, payState: "WORLD_UPDATE", questId: "fd-16", materials: { dataShards: 5 },
  script: [
    [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 3, z: 4 }, "DIVE"], [{ type: "ARRIVED" }, "COMBAT_1"], [{ type: "CLEAR" }, "TRACING"],
    [{ type: "HACK", progress: 100 }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
  ],
});
