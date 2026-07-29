/**
 * POST /api/build — Trigger static site build.
 *
 * Accepts { projectId, branchId? } and generates a static
 * site to the `dist/` directory. Creates a deployment record in D1
 * for progress tracking.
 */
import { NextResponse } from "next/server";
import type { Id } from "@/data/types";
import { buildProject } from "@/lib/build-project";
import { createServerDataClient } from "@/lib/server-data-client";

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

    const data = await createServerDataClient();
    const result = await buildProject(data, {
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
          ...(result.warnings ? { warnings: result.warnings } : {}),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[build] Unhandled error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}
