import { advanceMission } from "./blackout-protocol";
import { BLACKOUT_PROTOCOL } from "./blackout-protocol";
import { missionSuite } from "./mission-suite";

missionSuite("Blackout Protocol state machine", {
  id: "blackout-protocol", advance: advanceMission as never, initial: BLACKOUT_PROTOCOL, payState: "WORLD_UPDATE", questId: "fd-04", materials: { microCircuits: 4 },
  script: [
    [{ type: "START" }, "TRIGGERED"], [{ type: "ANCHOR", x: 3, z: 4 }, "INFILTRATION"], [{ type: "ARRIVED" }, "COMBAT_1"], [{ type: "CLEAR" }, "HACKING"],
    [{ type: "HACK", progress: 50 }, "COMBAT_2"], [{ type: "CLEAR" }, "HACKING"], [{ type: "HACK", progress: 100 }, "COMPLETE"], [{ type: "ACK" }, "WORLD_UPDATE"],
  ],
});
