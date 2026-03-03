/**
 * Core-mode user functions for OSS single-tenant operation.
 *
 * In core mode, there's no authentication. A single "local" user is
 * automatically created on first access via `ensureLocalUser`.
 *
 * The local user uses sentinel values:
 * - `workosUserId: "local"`
 * - `email: "local@inkloom.local"`
 * - `authProvider: "email"`
 *
 * After the core/platform restructure, these will become the main
 * implementations in `core/apps/web/convex/users.ts`.
 */
import { mutation, query } from "./_generated/server";

/** Sentinel WorkOS user ID for the local user in core mode. */
export const LOCAL_USER_ID = "local";

/** Sentinel email for the local user in core mode. */
export const LOCAL_USER_EMAIL = "local@inkloom.local";

/**
 * Ensure the local user exists, creating it if needed.
 *
 * Called on app mount by `CoreContextProvider`. Idempotent — safe to
 * call on every page load without triggering unnecessary writes.
 *
 * Returns the Convex user ID.
 */
export const ensureLocalUser = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", LOCAL_USER_ID)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Create the local user
    const userId = await ctx.db.insert("users", {
      workosUserId: LOCAL_USER_ID,
      email: LOCAL_USER_EMAIL,
      name: "Local User",
      authProvider: "email",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return userId;
  },
});

/**
 * Get the current user in core mode.
 *
 * Always returns the local user (no authentication check).
 */
export const currentLocal = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", LOCAL_USER_ID)
      )
      .first();
  },
});
