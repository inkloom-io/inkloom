/**
 * Core-mode API error types and helpers.
 *
 * Provides error codes and response helpers for API routes.
 * Platform version adds billing-specific errors (feature_gated,
 * insufficient_credits); core uses a simpler subset.
 */
import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "rate_limit_exceeded"
  | "feature_gated"
  | "insufficient_credits"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    },
    { status: error.statusCode }
  );
}

export function unauthorized(message = "Authentication required"): ApiError {
  return new ApiError(401, "unauthorized", message);
}

export function forbidden(message = "Insufficient permissions"): ApiError {
  return new ApiError(403, "forbidden", message);
}

export function notFound(message = "Resource not found"): ApiError {
  return new ApiError(404, "not_found", message);
}

export function validationError(
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return new ApiError(400, "validation_error", message, details);
}

export function conflict(message: string): ApiError {
  return new ApiError(409, "conflict", message);
}

export function internalError(message = "Internal server error"): ApiError {
  return new ApiError(500, "internal_error", message);
}
