import { describe, it, expect } from "vitest";
import { createDungeonLobby, inviteToDungeon, joinDungeon, setDungeonReady, launchDungeon, leaveDungeon, revokeDungeonInvite, removeDungeonMember, transferDungeonHost, disbandDungeonLobby, validateDungeonLaunch } from "./dungeon-lobby";

describe("private dungeon lobby rules", () => {
  it("requires invitations, host authority, and every member ready", () => {
    const created = createDungeonLobby("lobby1", "arcology_vaults", "host", "NYX");
    expect(created).not.toBeNull();
    const initial = created!;
    expect(joinDungeon(initial, "guest", "CIPHER").error).toBe("Invitation required");
    expect(inviteToDungeon(initial, "guest", "guest").error).toBe("Only the host can invite");
    const invited = inviteToDungeon(initial, "host", "guest").lobby;
    const joined = joinDungeon(invited, "guest", "CIPHER").lobby;
    expect(joined.members.map(m => m.operator)).toEqual(["NYX", "CIPHER"]);
    expect(launchDungeon(joined, "host").error).toBe("Fireteam is not ready");
    const hostReady = setDungeonReady(joined, "host", true).lobby;
    const bothReady = setDungeonReady(hostReady, "guest", true).lobby;
    expect(launchDungeon(bothReady, "guest").error).toBe("Only the host can launch");
    expect(launchDungeon(bothReady, "host").lobby.status).toBe("LAUNCHED");
    expect(joinDungeon(launchDungeon(bothReady, "host").lobby, "other", "GOLIATH").error).toBe("Lobby already launched");
  });
  it("caps fireteams at three and resets ready checks on membership changes", () => {
    let lobby = createDungeonLobby("lobby2", "arcology_vaults", "host", "GOLIATH")!;
    for (const id of ["a", "b", "c"]) {
      lobby = inviteToDungeon(lobby, "host", id).lobby;
      const result = joinDungeon(lobby, id, "NYX");
      if (id === "c") expect(result.error).toBe("Fireteam is full");
      else lobby = result.lobby;
    }
    lobby = setDungeonReady(lobby, "host", true).lobby;
    lobby = leaveDungeon(lobby, "b").lobby;
    expect(lobby.members.every(m => !m.ready)).toBe(true);
  });
  it("rejects unknown dungeons and malformed identifiers", () => {
    expect(createDungeonLobby("a", "unknown", "host", "NYX")).toBeNull();
    expect(createDungeonLobby("bad id", "arcology_vaults", "host", "NYX")).toBeNull();
  });
  it("lets only the host revoke pending invitations", () => {
    const lobby = inviteToDungeon(createDungeonLobby("revocation", "arcology_vaults", "host", "NYX")!, "host", "guest").lobby;
    expect(revokeDungeonInvite(lobby, "guest", "guest").error).toBe("Only the host can revoke invitations");
    const revoked = revokeDungeonInvite(lobby, "host", "guest").lobby;
    expect(joinDungeon(revoked, "guest", "CIPHER").error).toBe("Invitation required");
  });
  it("lets the host remove members and resets everyone's readiness", () => {
    let lobby = createDungeonLobby("kick", "arcology_vaults", "host", "NYX")!;
    lobby = joinDungeon(inviteToDungeon(lobby, "host", "guest").lobby, "guest", "GOLIATH").lobby;
    lobby = setDungeonReady(setDungeonReady(lobby, "host", true).lobby, "guest", true).lobby;
    expect(removeDungeonMember(lobby, "guest", "host").error).toBe("Only the host can remove members");
    expect(removeDungeonMember(lobby, "host", "host").error).toBe("Host must disband the lobby");
    const updated = removeDungeonMember(lobby, "host", "guest").lobby;
    expect(updated.members.map(m => m.id)).toEqual(["host"]);
    expect(updated.members[0].ready).toBe(false);
  });

  it("rejects self invitations and bounds pending invitation state", () => {
    let lobby = createDungeonLobby("bounded", "arcology_vaults", "host", "NYX")!;
    expect(inviteToDungeon(lobby, "host", "host").error).toBe("Invalid invitee");
    for (let i = 0; i < 32; i++) lobby = inviteToDungeon(lobby, "host", `guest${i}`).lobby;
    expect(lobby.invitedIds).toHaveLength(32);
    expect(inviteToDungeon(lobby, "host", "overflow").error).toBe("Invitation limit reached");
    expect(inviteToDungeon(lobby, "host", "guest0").error).toBeUndefined();
    const reduced = revokeDungeonInvite(lobby, "host", "guest0").lobby;
    expect(inviteToDungeon(reduced, "host", "overflow").lobby.invitedIds).toHaveLength(32);
  });

  it("transfers host authority and requires renewed ready checks", () => {
    let lobby = createDungeonLobby("transfer", "arcology_vaults", "host", "NYX")!;
    lobby = joinDungeon(inviteToDungeon(lobby, "host", "guest").lobby, "guest", "CIPHER").lobby;
    lobby = setDungeonReady(setDungeonReady(lobby, "host", true).lobby, "guest", true).lobby;
    expect(transferDungeonHost(lobby, "guest", "guest").error).toBe("Only the host can transfer leadership");
    expect(transferDungeonHost(lobby, "host", "unknown").error).toBe("New host must be another fireteam member");
    lobby = transferDungeonHost(lobby, "host", "guest").lobby;
    expect(lobby.hostId).toBe("guest");
    expect(lobby.members.every(member => !member.ready)).toBe(true);
    expect(inviteToDungeon(lobby, "host", "third").error).toBe("Only the host can invite");
    expect(disbandDungeonLobby(lobby, "host").closed).toBe(false);
    expect(disbandDungeonLobby(lobby, "guest").closed).toBe(true);
  });

  it("validates authoritative launch payloads and rejects tampering", () => {
    let lobby = createDungeonLobby("launch", "arcology_vaults", "host", "NYX")!;
    lobby = joinDungeon(inviteToDungeon(lobby, "host", "guest").lobby, "guest", "CIPHER").lobby;
    lobby = setDungeonReady(setDungeonReady(lobby, "host", true).lobby, "guest", true).lobby;
    expect(validateDungeonLaunch(lobby)).toBe(false);
    const launched = launchDungeon(lobby, "host").lobby;
    expect(validateDungeonLaunch(launched)).toBe(true);
    expect(validateDungeonLaunch({ ...launched, hostId: "outsider" })).toBe(false);
    expect(validateDungeonLaunch({ ...launched, members: [...launched.members, launched.members[0]] })).toBe(false);
    expect(validateDungeonLaunch({ ...launched, members: launched.members.map(m => ({ ...m, ready: false })) })).toBe(false);
    expect(disbandDungeonLobby(launched, "host").closed).toBe(false);
  });

  it("rejects tampered ready fireteams and clears unused invites on launch", () => {
    let lobby = createDungeonLobby("secure", "arcology_vaults", "host", "NYX")!;
    lobby = joinDungeon(inviteToDungeon(lobby, "host", "guest").lobby, "guest", "CIPHER").lobby;
    lobby = inviteToDungeon(lobby, "host", "unused").lobby;
    lobby = setDungeonReady(setDungeonReady(lobby, "host", true).lobby, "guest", true).lobby;
    const launched = launchDungeon(lobby, "host").lobby;
    expect(launched.invitedIds).toEqual([]);
    expect(validateDungeonLaunch(launched)).toBe(true);
    expect(launchDungeon({ ...lobby, hostId: "outsider" }, "outsider").error).toBe("Invalid fireteam launch state");
    expect(launchDungeon({ ...lobby, members: [lobby.members[0], lobby.members[0]] }, "host").error).toBe("Invalid fireteam launch state");
    expect(validateDungeonLaunch({ ...launched, invitedIds: ["unused"] })).toBe(false);
  });

});

describe("untrusted dungeon lobby snapshots", () => {
  it("accepts valid assembling snapshots without retaining mutable input arrays", async () => {
    const { parseDungeonLobbySnapshot } = await import("./dungeon-lobby");
    const input = createDungeonLobby("snapshot", "arcology_vaults", "host", "NYX")!;
    expect(parseDungeonLobbySnapshot(input)).toEqual(input);
  });
  it("rejects malformed, forged, or duplicate membership and invitation data", async () => {
    const { parseDungeonLobbySnapshot } = await import("./dungeon-lobby");
    const base = createDungeonLobby("snapshot", "arcology_vaults", "host", "NYX")!;
    expect(parseDungeonLobbySnapshot(null)).toBeNull();
    expect(parseDungeonLobbySnapshot({ ...base, hostId: "stranger" })).toBeNull();
    expect(parseDungeonLobbySnapshot({ ...base, members: [base.members[0], base.members[0]] })).toBeNull();
    expect(parseDungeonLobbySnapshot({ ...base, members: [{ ...base.members[0], ready: "true" }] })).toBeNull();
    expect(parseDungeonLobbySnapshot({ ...base, invitedIds: ["guest", "guest"] })).toBeNull();
    expect(parseDungeonLobbySnapshot({ ...base, invitedIds: ["host"] })).toBeNull();
    expect(parseDungeonLobbySnapshot({ ...base, status: "LAUNCHED" })).toBeNull();
  });
});


// Even when a dungeon allows solo story entry, private fireteam matchmaking
// requires two distinct ready players before provisioning an online instance.
import { describe as describeTwo, it as itTwo, expect as expectTwo } from 'vitest';
describeTwo('two-player private fireteam minimum', () => {
  itTwo('does not launch a solo ready host', () => {
    const lobby = createDungeonLobby('solo_test', 'arcology_vaults', 'host_1', 'NYX');
    expectTwo(lobby).not.toBeNull();
    if (!lobby) return;
    const ready = setDungeonReady(lobby, 'host_1', true).lobby;
    expectTwo(launchDungeon(ready, 'host_1').error).toBe('Fireteam is not ready');
  });
});
