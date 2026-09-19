export type ClassId = "VANGUARD" | "ASSASSIN" | "TECH" | "DESTROYER";
export type AppearanceId = "RANGER" | "WARDEN" | "PHANTOM" | "CONDUIT";

export type AppearanceDefinition = {
  id: AppearanceId;
  name: string;
  armor: string;
  cloth: string;
  visor: string;
  marking: string;
};

export const APPEARANCES: readonly AppearanceDefinition[] = [
  { id: "RANGER", name: "Dust Ranger", armor: "#b7ab93", cloth: "#6d6a4a", visor: "#66e0ff", marking: "Frontier / 01" },
  { id: "WARDEN", name: "Nexus Warden", armor: "#8fa6b0", cloth: "#34434a", visor: "#7dffca", marking: "Citadel / 07" },
  { id: "PHANTOM", name: "Rift Phantom", armor: "#827598", cloth: "#3d3548", visor: "#c86bff", marking: "Phase / 13" },
  { id: "CONDUIT", name: "Solar Conduit", armor: "#b89462", cloth: "#51463b", visor: "#ffb057", marking: "Ember / 04" },
];

export function appearanceById(id: AppearanceId): AppearanceDefinition {
  return APPEARANCES.find((appearance) => appearance.id === id) ?? APPEARANCES[0];
}