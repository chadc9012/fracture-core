/** Deterministic private dungeon lobby rules. Transport/auth must be provided by an
 * authoritative multiplayer service; this module does not imply online play. */
import { DUNGEONS } from "./dungeons.ts";

export type OperatorClass = "GOLIATH" | "NYX" | "CIPHER";
export type LobbyMember = Readonly<{ id: string; operator: OperatorClass; ready: boolean }>;
export type DungeonLobby = Readonly<{
  id: string; dungeonId: string; hostId: string; members: readonly LobbyMember[];
  invitedIds: readonly string[]; status: "ASSEMBLING" | "LAUNCHED";
}>;
export type LobbyResult = { lobby: DungeonLobby; error?: string };
const fail = (lobby: DungeonLobby, error: string): LobbyResult => ({ lobby, error });
const validId = (id: string) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
const validOperator = (value: string): value is OperatorClass => ["GOLIATH", "NYX", "CIPHER"].includes(value);

export function createDungeonLobby(id: string, dungeonId: string, hostId: string, operator: OperatorClass): DungeonLobby | null {
  const dungeon = DUNGEONS.find(d => d.id === dungeonId && d.privateInstance && d.squad.max >= 2);
  if (!dungeon || !validId(id) || !validId(hostId) || !validOperator(operator)) return null;
  return { id, dungeonId, hostId, members: [{ id: hostId, operator, ready: false }], invitedIds: [], status: "ASSEMBLING" };
}
export function inviteToDungeon(lobby: DungeonLobby, actorId: string, inviteeId: string): LobbyResult {
  if (lobby.status !== "ASSEMBLING") return fail(lobby, "Lobby already launched");
  if (actorId !== lobby.hostId) return fail(lobby, "Only the host can invite");
  if (!validId(inviteeId) || inviteeId === actorId || lobby.members.some(m => m.id === inviteeId)) return fail(lobby, "Invalid invitee");
  // Bound outstanding invites to prevent untrusted clients growing lobby state without limit.
  if (!lobby.invitedIds.includes(inviteeId) && lobby.invitedIds.length >= 32) return fail(lobby, "Invitation limit reached");
  if (lobby.invitedIds.includes(inviteeId)) return { lobby };
  return { lobby: { ...lobby, invitedIds: [...lobby.invitedIds, inviteeId] } };
}
export function joinDungeon(lobby: DungeonLobby, playerId: string, operator: OperatorClass): LobbyResult {
  if (lobby.status !== "ASSEMBLING") return fail(lobby, "Lobby already launched");
  if (!validId(playerId) || !validOperator(operator) || !lobby.invitedIds.includes(playerId)) return fail(lobby, "Invitation required");
  if (lobby.members.some(m => m.id === playerId)) return fail(lobby, "Already joined");
  const dungeon = DUNGEONS.find(d => d.id === lobby.dungeonId);
  if (!dungeon || lobby.members.length >= Math.min(3, dungeon.squad.max)) return fail(lobby, "Fireteam is full");
  return { lobby: { ...lobby, members: [...lobby.members.map(m => ({ ...m, ready: false })), { id: playerId, operator, ready: false }], invitedIds: lobby.invitedIds.filter(id => id !== playerId) } };
}
export function setDungeonReady(lobby: DungeonLobby, playerId: string, ready: boolean): LobbyResult {
  if (lobby.status !== "ASSEMBLING") return fail(lobby, "Lobby already launched");
  if (!lobby.members.some(m => m.id === playerId)) return fail(lobby, "Not in fireteam");
  return { lobby: { ...lobby, members: lobby.members.map(m => m.id === playerId ? { ...m, ready: !!ready } : m) } };
}
export function leaveDungeon(lobby: DungeonLobby, playerId: string): LobbyResult {
  if (lobby.status !== "ASSEMBLING") return fail(lobby, "Lobby already launched");
  if (playerId === lobby.hostId) return fail(lobby, "Host must disband the lobby");
  if (!lobby.members.some(m => m.id === playerId)) return fail(lobby, "Not in fireteam");
  return { lobby: { ...lobby, members: lobby.members.filter(m => m.id !== playerId).map(m => ({ ...m, ready: false })) } };
}
export function launchDungeon(lobby: DungeonLobby, actorId: string): LobbyResult {
  if (actorId !== lobby.hostId) return fail(lobby, "Only the host can launch");
  if (lobby.status !== "ASSEMBLING") return fail(lobby, "Already launched");
  const dungeon = DUNGEONS.find(d => d.id === lobby.dungeonId);
  if (!dungeon || lobby.members.length < Math.max(2, dungeon.squad.min) || !lobby.members.every(m => m.ready)) return fail(lobby, "Fireteam is not ready");
  // Validate the complete proposed launch before provisioning an instance.
  // Never carry unused invitations into a launched dungeon.
  const launched: DungeonLobby = { ...lobby, status: "LAUNCHED", invitedIds: [] };
  if (!validateDungeonLaunch(launched)) return fail(lobby, "Invalid fireteam launch state");
  return { lobby: launched };
}

/** Host can withdraw an unused invitation before the invitee joins. */
export function revokeDungeonInvite(lobby: DungeonLobby, actorId: string, inviteeId: string): LobbyResult {
  if (lobby.status !== "ASSEMBLING") return fail(lobby, "Lobby already launched");
  if (actorId !== lobby.hostId) return fail(lobby, "Only the host can revoke invitations");
  if (!lobby.invitedIds.includes(inviteeId)) return fail(lobby, "Invitation not found");
  return { lobby: { ...lobby, invitedIds: lobby.invitedIds.filter(id => id !== inviteeId) } };
}

/** Removing a member invalidates everyone's ready check, including the host's. */
export function removeDungeonMember(lobby: DungeonLobby, actorId: string, memberId: string): LobbyResult {
  if (lobby.status !== "ASSEMBLING") return fail(lobby, "Lobby already launched");
  if (actorId !== lobby.hostId) return fail(lobby, "Only the host can remove members");
  if (memberId === lobby.hostId) return fail(lobby, "Host must disband the lobby");
  if (!lobby.members.some(member => member.id === memberId)) return fail(lobby, "Not in fireteam");
  return { lobby: { ...lobby, members: lobby.members.filter(member => member.id !== memberId).map(member => ({ ...member, ready: false })) } };
}

/** Transfer leadership before launch; all players must ready up again. */
export function transferDungeonHost(lobby: DungeonLobby, actorId: string, newHostId: string): LobbyResult {
  if (lobby.status !== "ASSEMBLING") return fail(lobby, "Lobby already launched");
  if (actorId !== lobby.hostId) return fail(lobby, "Only the host can transfer leadership");
  if (newHostId === lobby.hostId || !lobby.members.some(member => member.id === newHostId)) return fail(lobby, "New host must be another fireteam member");
  return { lobby: { ...lobby, hostId: newHostId, members: lobby.members.map(member => ({ ...member, ready: false })) } };
}

/** A host may close an assembling lobby, invalidating outstanding invitations. */
export function disbandDungeonLobby(lobby: DungeonLobby, actorId: string): { closed: boolean; error?: string } {
  if (actorId !== lobby.hostId) return { closed: false, error: "Only the host can disband" };
  if (lobby.status !== "ASSEMBLING") return { closed: false, error: "Lobby already launched" };
  return { closed: true };
}

/** Validate a launch payload at the network boundary before provisioning an instance. */
export function validateDungeonLaunch(lobby: DungeonLobby): boolean {
  const dungeon = DUNGEONS.find(d => d.id === lobby.dungeonId && d.privateInstance);
  if (!dungeon || lobby.status !== "LAUNCHED" || !validId(lobby.id) || !validId(lobby.hostId)) return false;
  if (lobby.invitedIds.length !== 0) return false;
  if (lobby.members.length < Math.max(2, dungeon.squad.min) || lobby.members.length > Math.min(3, dungeon.squad.max)) return false;
  const ids = lobby.members.map(member => member.id);
  return new Set(ids).size === ids.length && ids.includes(lobby.hostId) &&
    lobby.members.every(member => validId(member.id) && validOperator(member.operator) && member.ready === true);
}

/** Parse an untrusted lobby snapshot before using it in the UI or provisioning.
 * A client-supplied snapshot is never proof of identity or authorization; the
 * server must associate every action with its authenticated actor. */
export function parseDungeonLobbySnapshot(input: unknown): DungeonLobby | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as { id?: unknown; hostId?: unknown; dungeonId?: unknown; status?: unknown; members?: unknown; invitedIds?: unknown };
  if (!validId(value.id as string) || !validId(value.hostId as string) || typeof value.dungeonId !== "string") return null;
  const dungeon = DUNGEONS.find(d => d.id === value.dungeonId && d.privateInstance);
  if (!dungeon || (value.status !== "ASSEMBLING" && value.status !== "LAUNCHED")) return null;
  if (!Array.isArray(value.members) || value.members.length < 1 || value.members.length > Math.min(3, dungeon.squad.max)) return null;
  if (!Array.isArray(value.invitedIds) || value.invitedIds.length > 32) return null;
  const members: LobbyMember[] = [];
  for (const entry of value.members) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const member = entry as { id?: unknown; operator?: unknown; ready?: unknown };
    if (!validId(member.id as string) || !validOperator(member.operator as string) || typeof member.ready !== "boolean") return null;
    members.push({ id: member.id as string, operator: member.operator as OperatorClass, ready: member.ready });
  }
  const memberIds = members.map(member => member.id);
  if (new Set(memberIds).size !== memberIds.length || !memberIds.includes(value.hostId as string)) return null;
  if (!value.invitedIds.every(id => validId(id) && !memberIds.includes(id))) return null;
  if (new Set(value.invitedIds).size !== value.invitedIds.length) return null;
  const lobby: DungeonLobby = {
    id: value.id as string, dungeonId: dungeon.id, hostId: value.hostId as string,
    status: value.status, members, invitedIds: [...value.invitedIds],
  };
  if (lobby.status === "LAUNCHED" && !validateDungeonLaunch(lobby)) return null;
  return lobby;
}
