/** Pure, replay-safe reward settlement for combat defeat events.
 * The caller must persist `claimedDefeats` with the player's save.
 * No RNG or storage side effects occur inside this module.
 */
export type DefeatReward = {
  defeatId: string;
  xp: number;
  materials?: Readonly<Record<string, number>>;
};
export type RewardLedger = {
  claimedDefeats: string[];
  xp: number;
  materials: Record<string, number>;
};
export type RewardSettlement = { ledger: RewardLedger; granted: boolean };
export function settleDefeatReward(ledger: RewardLedger, reward: DefeatReward): RewardSettlement {
  if (!reward.defeatId.trim() || !Number.isSafeInteger(reward.xp) || reward.xp < 0) {
    return { ledger, granted: false };
  }
  if (ledger.claimedDefeats.includes(reward.defeatId)) return { ledger, granted: false };
  const materials = { ...ledger.materials };
  for (const [id, amount] of Object.entries(reward.materials ?? {})) {
    if (!id || !Number.isSafeInteger(amount) || amount < 0 ||
        !Number.isSafeInteger((materials[id] ?? 0) + amount)) {
      return { ledger, granted: false };
    }
    materials[id] = (materials[id] ?? 0) + amount;
  }
  if (!Number.isSafeInteger(ledger.xp + reward.xp)) return { ledger, granted: false };
  return {
    ledger: {
      claimedDefeats: [...ledger.claimedDefeats, reward.defeatId],
      xp: ledger.xp + reward.xp,
      materials,
    },
    granted: true,
  };
}
