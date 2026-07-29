import type { Context, Env } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: ContentfulStatusCode = 400,
    readonly code = "bad_request",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function readJson<T, TEnv extends Env>(
  context: Context<TEnv>,
  schema: ZodType<T>,
): Promise<T> {
  const value = await context.req.json().catch(() => {
    throw new ApiError("Request body must be valid JSON.");
  });
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(
      result.error.issues.map((issue) => issue.message).join("; "),
      422,
      "validation_error",
    );
  }

  return result.data;
}
