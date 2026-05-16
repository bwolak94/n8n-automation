import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("collaborationStore — peers / localCursor / roomId", () => {
  const setup = async () => {
    const { useCollaborationStore } = await import("../collaborationStore.js");
    return useCollaborationStore();
  };

  const peer1 = { userId: "p1", email: "x@y.com", color: "#ff0000" };
  const peer2 = { userId: "p2", email: "z@w.com", color: "#00ff00" };

  it("setPeer adds a peer to the peers map and peerList", async () => {
    const store = await setup();
    store.setPeer(peer1);
    expect(store.peers.has("p1")).toBe(true);
    expect(store.peerList).toHaveLength(1);
  });

  it("setPeer updates cursor on existing peer", async () => {
    const store = await setup();
    store.setPeer(peer1);
    store.setPeer({ ...peer1, cursor: { x: 10, y: 20 } });
    expect(store.peers.get("p1")?.cursor).toEqual({ x: 10, y: 20 });
  });

  it("removePeer removes from peers map and peerList", async () => {
    const store = await setup();
    store.setPeer(peer1);
    store.setPeer(peer2);
    store.removePeer("p1");
    expect(store.peers.has("p1")).toBe(false);
    expect(store.peerList).toHaveLength(1);
  });

  it("setLocalCursor stores local cursor position", async () => {
    const store = await setup();
    store.setLocalCursor({ x: 5, y: 15 });
    expect(store.localCursor).toEqual({ x: 5, y: 15 });
  });

  it("setLocalCursor accepts null to clear cursor", async () => {
    const store = await setup();
    store.setLocalCursor({ x: 1, y: 1 });
    store.setLocalCursor(null);
    expect(store.localCursor).toBeNull();
  });

  it("setRoomId stores roomId", async () => {
    const store = await setup();
    store.setRoomId("workflow:wf-1");
    expect(store.roomId).toBe("workflow:wf-1");
  });

  it("peerList computed returns array of peers", async () => {
    const store = await setup();
    store.setPeer(peer1);
    store.setPeer(peer2);
    expect(store.peerList).toHaveLength(2);
  });

  it("setConnected false clears peers map", async () => {
    const store = await setup();
    store.setPeer(peer1);
    store.setConnected(false);
    expect(store.peers.size).toBe(0);
  });

  it("reset clears peers, localCursor and roomId", async () => {
    const store = await setup();
    store.setPeer(peer1);
    store.setLocalCursor({ x: 1, y: 2 });
    store.setRoomId("wf:1");
    store.reset();
    expect(store.peers.size).toBe(0);
    expect(store.localCursor).toBeNull();
    expect(store.roomId).toBeNull();
  });

  it("addUser syncs to peers map", async () => {
    const store = await setup();
    store.addUser({ userId: "u1", email: "a@b.com", color: "#111" });
    expect(store.peers.has("u1")).toBe(true);
  });

  it("removeUser removes from peers map", async () => {
    const store = await setup();
    store.addUser({ userId: "u1", email: "a@b.com", color: "#111" });
    store.removeUser("u1");
    expect(store.peers.has("u1")).toBe(false);
  });

  it("updateUserCursor updates cursor in peers map", async () => {
    const store = await setup();
    store.setPeer(peer1);
    store.updateUserCursor("p1", { x: 7, y: 8 });
    expect(store.peers.get("p1")?.cursor).toEqual({ x: 7, y: 8 });
  });
});
