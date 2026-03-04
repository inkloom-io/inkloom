/**
 * POST /api/build — Trigger static site build (core mode).
 *
 * Accepts { projectId, branchId?, target? } and generates a static
 * site to the `dist/` directory. Creates a deployment record in Convex
 * for progress tracking via the usePublish hook.
 *
 * Response format matches the platform deployments API so usePublish
 * works identically in both modes.
 */
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";
import { buildProject } from "@/lib/build-project";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Validate projectId
    if (!body.projectId || typeof body.projectId !== "string") {
      return NextResponse.json(
        { error: { message: "projectId is required" } },
        { status: 400 }
      );
    }

    // Create Convex client
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: { message: "NEXT_PUBLIC_CONVEX_URL is not configured" } },
        { status: 500 }
      );
    }

    const convex = new ConvexHttpClient(convexUrl);

    try {
      const result = await buildProject(convex, {
        projectId: body.projectId as Id<"projects">,
        branchId: body.branchId as Id<"branches"> | undefined,
        outDir: "dist",
        clean: true,
      });

      return NextResponse.json(
        {
          data: {
            deploymentId: result.deploymentId,
            url: result.url,
            pageCount: result.pageCount,
            fileCount: result.fileCount,
            outDir: result.outDir,
          },
        },
        { status: 200 }
      );
    } finally {
      // ConvexHttpClient has no explicit close — let GC handle it
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
