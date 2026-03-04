import { mutation, query } from "./_generated/server";

const LOCAL_USER_ID = "local";
const LOCAL_USER_EMAIL = "local@inkloom.local";

/**
 * Ensure the local user exists in the database.
 * Called on app mount — idempotent.
 */
export const ensureLocalUser = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", LOCAL_USER_ID))
      .first();

    if (existing) return existing._id;

    const now = Date.now();
    return ctx.db.insert("users", {
      workosUserId: LOCAL_USER_ID,
      email: LOCAL_USER_EMAIL,
      name: "Local User",
      authProvider: "email",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Get the local user.
 */
export const currentLocal = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", LOCAL_USER_ID))
      .first();
  },
});
