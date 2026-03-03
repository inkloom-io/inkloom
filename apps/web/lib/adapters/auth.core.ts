import type { AuthAdapter, AdapterUser } from "./types";

/**
 * Core-mode auth adapter.
 *
 * Returns a static local user — no login required.
 * OSS InkLoom runs as a single-tenant local tool.
 */

const LOCAL_USER: AdapterUser = {
  id: "local_user",
  email: "local@inkloom.dev",
  firstName: "Local",
  lastName: "User",
  profilePictureUrl: null,
};

export const authAdapter: AuthAdapter = {
  async getUser() {
    return LOCAL_USER;
  },

  async requireUser() {
    return LOCAL_USER;
  },

  async signOut() {
    // No-op in core mode — there is no session to clear.
  },
};
