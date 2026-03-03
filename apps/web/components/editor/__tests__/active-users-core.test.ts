import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Core stub: module exports match platform active-users
// ---------------------------------------------------------------------------

describe("active-users.core module exports", () => {
  it("exports ActiveUsers function", async () => {
    const mod = await import("../active-users.core");
    expect(typeof mod.ActiveUsers).toBe("function");
  });

  it("exports ConnectionStatus function", async () => {
    const mod = await import("../active-users.core");
    expect(typeof mod.ConnectionStatus).toBe("function");
  });

  it("ActiveUsers is a named function", async () => {
    const { ActiveUsers } = await import("../active-users.core");
    expect(ActiveUsers.name).toBe("ActiveUsers");
  });

  it("ConnectionStatus is a named function", async () => {
    const { ConnectionStatus } = await import("../active-users.core");
    expect(ConnectionStatus.name).toBe("ConnectionStatus");
  });
});

// ---------------------------------------------------------------------------
// Core stub: same export names as platform active-users
// ---------------------------------------------------------------------------

describe("active-users.core matches platform active-users exports", () => {
  it("has the same named exports as platform active-users", async () => {
    const coreMod = await import("../active-users.core");
    const platformMod = await import("../active-users");

    // Both should export ActiveUsers and ConnectionStatus
    expect(typeof coreMod.ActiveUsers).toBe("function");
    expect(typeof coreMod.ConnectionStatus).toBe("function");
    expect(typeof platformMod.ActiveUsers).toBe("function");
    expect(typeof platformMod.ConnectionStatus).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Core stub: ActiveUsers returns null
// ---------------------------------------------------------------------------

describe("ActiveUsers core stub behavior", () => {
  it("returns null with empty users", async () => {
    const { ActiveUsers } = await import("../active-users.core");
    const result = ActiveUsers({ users: [] });
    expect(result).toBeNull();
  });

  it("returns null with users present", async () => {
    const { ActiveUsers } = await import("../active-users.core");
    const result = ActiveUsers({
      users: [
        { id: "u1", name: "Alice", avatar: null, color: "#F44336" },
        { id: "u2", name: "Bob", avatar: "https://example.com/bob.png", color: "#2196F3" },
      ],
      currentUser: { id: "u0", name: "Me", avatar: null, color: "#4CAF50" },
      maxVisible: 3,
    });
    expect(result).toBeNull();
  });

  it("returns null with only currentUser", async () => {
    const { ActiveUsers } = await import("../active-users.core");
    const result = ActiveUsers({
      users: [],
      currentUser: { id: "u0", name: "Me", avatar: null, color: "#009688" },
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Core stub: ConnectionStatus returns null
// ---------------------------------------------------------------------------

describe("ConnectionStatus core stub behavior", () => {
  it("returns null when connected and synced", async () => {
    const { ConnectionStatus } = await import("../active-users.core");
    const result = ConnectionStatus({
      connected: true,
      synced: true,
    });
    expect(result).toBeNull();
  });

  it("returns null when disconnected", async () => {
    const { ConnectionStatus } = await import("../active-users.core");
    const result = ConnectionStatus({
      connected: false,
      synced: false,
    });
    expect(result).toBeNull();
  });

  it("returns null with error", async () => {
    const { ConnectionStatus } = await import("../active-users.core");
    const result = ConnectionStatus({
      connected: false,
      synced: false,
      error: "Connection failed",
    });
    expect(result).toBeNull();
  });

  it("returns null with collaboration disabled", async () => {
    const { ConnectionStatus } = await import("../active-users.core");
    const result = ConnectionStatus({
      connected: false,
      synced: false,
      collaborationDisabled: true,
      onEnableCollaboration: () => {},
    });
    expect(result).toBeNull();
  });

  it("returns null with all props populated", async () => {
    const { ConnectionStatus } = await import("../active-users.core");
    const result = ConnectionStatus({
      connected: true,
      synced: true,
      error: null,
      onDisableCollaboration: () => {},
      onEnableCollaboration: () => {},
      collaborationDisabled: false,
    });
    expect(result).toBeNull();
  });
});
