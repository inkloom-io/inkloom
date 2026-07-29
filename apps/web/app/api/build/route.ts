/**
 * POST /api/build — Trigger static site build (core mode).
 *
 * Accepts { projectId, branchId?, target? } and generates a static
 * site to the `dist/` directory. Creates a deployment record in D1
 * for progress tracking via the usePublish hook.
 *
 * Response format matches the platform deployments API so usePublish
 * works identically in both modes.
 */
import { NextResponse } from "next/server";
import { buildProject } from "@/lib/build-project";
import { errorReportingAdapter } from "@/lib/adapters";
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
      projectId: body.projectId,
      branchId: typeof body.branchId === "string" ? body.branchId : undefined,
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
  } catch (error) {
    console.error("[build] Unhandled error:", error);
    if (error instanceof Error) {
      errorReportingAdapter.captureError(error, { source: "build-route" });
    }
    // Flush queued error events before serverless function terminates
    if (errorReportingAdapter.flush) {
      await errorReportingAdapter.flush(2000);
    }
    return NextResponse.json(
      { error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}
