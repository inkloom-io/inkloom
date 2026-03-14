"use client";

/**
 * Core-mode AI generation banner stub.
 *
 * In core mode, AI generation is not available (requires platform SaaS).
 * This stub renders nothing. The platform version provides the real banner
 * that prompts users to try AI documentation generation.
 */

import type { Id } from "@/convex/_generated/dataModel";

interface AiGenerationBannerProps {
  projectId: Id<"projects">;
}

export function AiGenerationBanner(_props: AiGenerationBannerProps) {
  return null;
}
