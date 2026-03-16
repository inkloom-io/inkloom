/**
 * POST /api/page-feedback — Submit a "Was this helpful?" reaction.
 *
 * Called from published docs sites via the proxyUrl. Accepts
 * { projectId, pageSlug, reaction, sessionId? } and writes to the
 * pageFeedback Convex table.
 */
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

const VALID_REACTIONS = ["positive", "neutral", "negative"] as const;
type Reaction = (typeof VALID_REACTIONS)[number];

function isValidReaction(value: unknown): value is Reaction {
  return typeof value === "string" && VALID_REACTIONS.includes(value as Reaction);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Validate required fields
    if (!body.projectId || typeof body.projectId !== "string") {
      return NextResponse.json(
        { error: { message: "projectId is required" } },
        { status: 400 }
      );
    }

    if (!body.pageSlug || typeof body.pageSlug !== "string") {
      return NextResponse.json(
        { error: { message: "pageSlug is required" } },
        { status: 400 }
      );
    }

    if (!isValidReaction(body.reaction)) {
      return NextResponse.json(
        { error: { message: "reaction must be one of: positive, neutral, negative" } },
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

    const result = await convex.mutation(api.pageFeedback.submit, {
      projectId: body.projectId as Id<"projects">,
      pageSlug: body.pageSlug,
      reaction: body.reaction,
      sessionId: body.sessionId && typeof body.sessionId === "string"
        ? body.sessionId
        : undefined,
    });

    return NextResponse.json({ success: true, id: result });
  } catch (error) {
    console.error("[page-feedback] Error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}
