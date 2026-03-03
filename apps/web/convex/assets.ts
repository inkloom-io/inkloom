import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createAsset = mutation({
  args: {
    projectId: v.id("projects"),
    r2Key: v.string(),
    url: v.string(),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const assetId = await ctx.db.insert("assets", {
      projectId: args.projectId,
      r2Key: args.r2Key,
      url: args.url,
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      createdAt: Date.now(),
    });

    return { assetId, url: args.url };
  },
});

export const getAssetUrl = query({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) return null;
    return asset.url;
  },
});

export const getAsset = query({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) return null;
    return asset;
  },
});

export const deleteAsset = mutation({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) return { r2Key: null };
    await ctx.db.delete(args.assetId);
    return { r2Key: asset.r2Key };
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const assets = await ctx.db
      .query("assets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return assets;
  },
});
