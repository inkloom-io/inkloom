/**
 * POST /api/page-feedback — Submit a "Was this helpful?" reaction.
 *
 * Called from published docs sites via the proxyUrl. Accepts
 * { projectId, pageSlug, reaction, sessionId? } and writes to the
 * D1 page_feedback table.
 */
import { NextResponse } from "next/server";
import { createDataClient } from "@/data/client";

export const runtime = "nodejs";

const VALID_REACTIONS = ["positive", "neutral", "negative"] as const;
type Reaction = (typeof VALID_REACTIONS)[number];

function isValidReaction(value: unknown): value is Reaction {
  return (
    typeof value === "string" && VALID_REACTIONS.includes(value as Reaction)
  );
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
        {
          error: {
            message: "reaction must be one of: positive, neutral, negative",
          },
        },
        { status: 400 }
      );
    }

    const data = createDataClient({
      baseUrl: process.env.DATA_API_URL ?? "http://127.0.0.1:8787",
      token: process.env.DATA_API_TOKEN,
    });
    const result = await data.pageFeedback.submit({
      projectId: body.projectId,
      pageSlug: body.pageSlug,
      reaction: body.reaction,
      sessionId:
        body.sessionId && typeof body.sessionId === "string"
          ? body.sessionId
          : undefined,
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error("[page-feedback] Error:", error);
    return NextResponse.json(
      { error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}
