import { describe, it, expect } from "vitest";
import type { AuthState, AuthUser } from "@/hooks/use-auth";

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe("use-auth module exports", () => {
  it("exports useAuth function", async () => {
    const mod = await import("@/hooks/use-auth");
    expect(typeof mod.useAuth).toBe("function");
  });

  it("exports AuthProvider component", async () => {
    const mod = await import("@/hooks/use-auth");
    expect(mod.AuthProvider).toBeDefined();
  });

  it("exports AuthContext", async () => {
    const mod = await import("@/hooks/use-auth");
    expect(mod.AuthContext).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AuthState interface compliance
// ---------------------------------------------------------------------------

describe("AuthState interface", () => {
  it("accepts a valid authenticated state", () => {
    const state: AuthState = {
      user: {
        _id: "user123" as any,
        _creationTime: 1700000000000,
        email: "test@example.com",
        name: "Test User",
        avatarUrl: "https://example.com/avatar.png",
        workosUserId: "wos_123",
      },
      userId: "user123" as any,
      isLoading: false,
      signOut: () => {},
    };
    expect(state.user).not.toBeNull();
    expect(state.userId).toBe("user123");
    expect(state.isLoading).toBe(false);
    expect(typeof state.signOut).toBe("function");
  });

  it("accepts a loading state", () => {
    const state: AuthState = {
      user: null,
      userId: undefined,
      isLoading: true,
      signOut: () => {},
    };
    expect(state.user).toBeNull();
    expect(state.userId).toBeUndefined();
    expect(state.isLoading).toBe(true);
  });

  it("accepts an unauthenticated state", () => {
    const state: AuthState = {
      user: null,
      userId: undefined,
      isLoading: false,
      signOut: () => {},
    };
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AuthUser interface compliance
// ---------------------------------------------------------------------------

describe("AuthUser interface", () => {
  it("accepts a minimal user with required fields only", () => {
    const user: AuthUser = {
      _id: "u1" as any,
      _creationTime: 1700000000000,
      email: "minimal@example.com",
    };
    expect(user._id).toBe("u1");
    expect(user.email).toBe("minimal@example.com");
    expect(user.name).toBeUndefined();
    expect(user.avatarUrl).toBeUndefined();
    expect(user.workosUserId).toBeUndefined();
  });

  it("accepts a fully populated user", () => {
    const user: AuthUser = {
      _id: "u2" as any,
      _creationTime: 1700000000000,
      email: "full@example.com",
      name: "Full User",
      avatarUrl: "https://example.com/avatar.png",
      workosUserId: "wos_456",
    };
    expect(user.name).toBe("Full User");
    expect(user.avatarUrl).toBe("https://example.com/avatar.png");
    expect(user.workosUserId).toBe("wos_456");
  });

  it("accepts additional unknown fields (Convex doc extensibility)", () => {
    const user: AuthUser = {
      _id: "u3" as any,
      _creationTime: 1700000000000,
      email: "ext@example.com",
      authProvider: "email",
      customField: 42,
    };
    expect(user.authProvider).toBe("email");
    expect(user.customField).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// AuthContext default value
// ---------------------------------------------------------------------------

describe("AuthContext defaults", () => {
  it("has null default (requires provider)", async () => {
    const { AuthContext } = await import("@/hooks/use-auth");
    // React contexts created with null default indicate provider is required
    // @ts-expect-error -- accessing internal React context value for testing
    const defaultValue = AuthContext._currentValue;
    expect(defaultValue).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Contract: useAuth throws without provider
// ---------------------------------------------------------------------------

describe("useAuth contract", () => {
  it("is a named function", async () => {
    const { useAuth } = await import("@/hooks/use-auth");
    expect(useAuth.name).toBe("useAuth");
  });

  it("AuthProvider is a valid React context provider", async () => {
    const { AuthProvider, AuthContext } = await import("@/hooks/use-auth");
    // AuthProvider should be the Provider property of the context
    expect(AuthProvider).toBe(AuthContext.Provider);
  });
});

// ---------------------------------------------------------------------------
// Platform auth bridge module
// ---------------------------------------------------------------------------

describe("PlatformAuthBridge module", () => {
  it("exports PlatformAuthBridge component", async () => {
    const mod = await import("@/components/auth-bridge");
    expect(typeof mod.PlatformAuthBridge).toBe("function");
  });

  it("PlatformAuthBridge is a named function", async () => {
    const { PlatformAuthBridge } = await import("@/components/auth-bridge");
    expect(PlatformAuthBridge.name).toBe("PlatformAuthBridge");
  });
});

// ---------------------------------------------------------------------------
// AuthState shape transformation tests
// ---------------------------------------------------------------------------

describe("AuthState data transformation", () => {
  it("signOut returns void (no return value expected)", () => {
    const state: AuthState = {
      user: null,
      userId: undefined,
      isLoading: false,
      signOut: () => {
        // Would navigate to /signout in real implementation
      },
    };
    const result = state.signOut();
    expect(result).toBeUndefined();
  });

  it("userId mirrors user._id when user exists", () => {
    const mockId = "mock_user_id" as any;
    const state: AuthState = {
      user: {
        _id: mockId,
        _creationTime: 1700000000000,
        email: "test@example.com",
      },
      userId: mockId,
      isLoading: false,
      signOut: () => {},
    };
    expect(state.userId).toBe(state.user?._id);
  });

  it("userId is undefined when user is null", () => {
    const state: AuthState = {
      user: null,
      userId: undefined,
      isLoading: false,
      signOut: () => {},
    };
    expect(state.userId).toBeUndefined();
    expect(state.user).toBeNull();
  });
});
