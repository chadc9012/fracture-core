export type FactionId = "resonants" | "controllers" | "breakers" | "corp" | "nomads" | "neutral";

export const PLAYER_NATURE = "resonant" as const;

export const WORLD_FACTIONS: Record<FactionId, { name: string; playable: boolean; role: string; vehicle: string }> = {
  resonants: { name: "Resonants", playable: true, role: "Fracture-touched independents", vehicle: "Aether-Glide Hoverbike" },
  controllers: { name: "Controllers", playable: true, role: "Militia of order and territory", vehicle: "GOLIATH Heavy Armored Tank" },
  breakers: { name: "Breakers", playable: true, role: "Raiders of corrupted logic", vehicle: "Mutated Raider Buggy" },
  corp: { name: "Corp Architects", playable: false, role: "Vanished creators of pre-collapse systems", vehicle: "Creator-tech prototypes" },
  nomads: { name: "Nomads", playable: false, role: "Unaligned cultures crossing the war belts", vehicle: "Wasteland Scout Jeep" },
  neutral: { name: "Unaffiliated", playable: false, role: "Civilians, traders and independent settlements", vehicle: "Scrap utility vehicles" },
};