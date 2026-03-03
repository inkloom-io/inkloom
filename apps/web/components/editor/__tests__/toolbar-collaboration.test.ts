import { describe, it, expect } from "vitest";
import type { CollaborationState, ToolbarCollaborationProps } from "../toolbar-collaboration";

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe("toolbar-collaboration module exports", () => {
  it("exports ToolbarCollaboration component", async () => {
    const mod = await import("../toolbar-collaboration");
    expect(typeof mod.ToolbarCollaboration).toBe("function");
  });

  it("ToolbarCollaboration is a named function", async () => {
    const { ToolbarCollaboration } = await import("../toolbar-collaboration");
    expect(ToolbarCollaboration.name).toBe("ToolbarCollaboration");
  });
});

// ---------------------------------------------------------------------------
// CollaborationState interface compliance
// ---------------------------------------------------------------------------

describe("CollaborationState interface", () => {
  it("accepts a connected and synced state", () => {
    const state: CollaborationState = {
      connected: true,
      synced: true,
      error: null,
      activeUsers: [
        { id: "u1", name: "Alice", avatar: null, color: "#F44336" },
        { id: "u2", name: "Bob", avatar: "https://example.com/bob.png", color: "#2196F3" },
      ],
      currentUser: { id: "u0", name: "Me", avatar: null, color: "#4CAF50" },
    };
    expect(state.connected).toBe(true);
    expect(state.synced).toBe(true);
    expect(state.error).toBeNull();
    expect(state.activeUsers).toHaveLength(2);
    expect(state.currentUser?.id).toBe("u0");
  });

  it("accepts a disconnected state with error", () => {
    const state: CollaborationState = {
      connected: false,
      synced: false,
      error: "Connection lost",
      activeUsers: [],
      currentUser: null,
    };
    expect(state.connected).toBe(false);
    expect(state.error).toBe("Connection lost");
    expect(state.activeUsers).toHaveLength(0);
    expect(state.currentUser).toBeNull();
  });

  it("accepts a connecting state (connected but not synced)", () => {
    const state: CollaborationState = {
      connected: true,
      synced: false,
      error: null,
      activeUsers: [],
      currentUser: { id: "u0", name: "Me", avatar: null, color: "#009688" },
    };
    expect(state.connected).toBe(true);
    expect(state.synced).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ToolbarCollaborationProps interface compliance
// ---------------------------------------------------------------------------

describe("ToolbarCollaborationProps interface", () => {
  it("accepts minimal props (all optional)", () => {
    const props: ToolbarCollaborationProps = {};
    expect(props.collaboration).toBeUndefined();
    expect(props.collaborationGated).toBeUndefined();
    expect(props.onDisableCollaboration).toBeUndefined();
    expect(props.onEnableCollaboration).toBeUndefined();
    expect(props.collaborationDisabled).toBeUndefined();
  });

  it("accepts full props with active collaboration", () => {
    const props: ToolbarCollaborationProps = {
      collaboration: {
        connected: true,
        synced: true,
        error: null,
        activeUsers: [],
        currentUser: { id: "u0", name: "Test", avatar: null, color: "#F44336" },
      },
      collaborationGated: false,
      onDisableCollaboration: () => {},
      onEnableCollaboration: () => {},
      collaborationDisabled: false,
    };
    expect(props.collaboration?.connected).toBe(true);
    expect(props.collaborationGated).toBe(false);
    expect(typeof props.onDisableCollaboration).toBe("function");
    expect(typeof props.onEnableCollaboration).toBe("function");
  });

  it("accepts gated collaboration props", () => {
    const props: ToolbarCollaborationProps = {
      collaborationGated: true,
    };
    expect(props.collaborationGated).toBe(true);
    expect(props.collaboration).toBeUndefined();
  });

  it("accepts disabled collaboration props", () => {
    const props: ToolbarCollaborationProps = {
      collaboration: {
        connected: false,
        synced: false,
        error: null,
        activeUsers: [],
        currentUser: null,
      },
      collaborationDisabled: true,
      onEnableCollaboration: () => {},
    };
    expect(props.collaborationDisabled).toBe(true);
    expect(typeof props.onEnableCollaboration).toBe("function");
  });
});
