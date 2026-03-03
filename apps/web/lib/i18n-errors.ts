/**
 * Client-side error message localization utility.
 *
 * Backend errors arrive as English strings with a machine-readable `code`.
 * This module maps those codes to translation keys so the UI can display
 * localized messages via next-intl.
 */

import type { ApiErrorCode } from "./api-errors";

/** Maps API error codes to translation keys in the "errors" namespace. */
const ERROR_CODE_MAP: Record<ApiErrorCode, string> = {
  unauthorized: "authRequired",
  forbidden: "insufficientPermissions",
  not_found: "pageNotFound",
  validation_error: "validationError",
  conflict: "conflict",
  rate_limit_exceeded: "rateLimited",
  feature_gated: "featureGated",
  insufficient_credits: "insufficientCredits",
  internal_error: "internalError",
};

/**
 * Well-known backend error strings and their translation keys.
 * Used as a fallback when the response doesn't include a `code` field
 * (e.g. Convex errors that surface raw messages).
 */
const MESSAGE_MAP: Record<string, string> = {
  "Authentication required": "authRequired",
  "Insufficient permissions": "insufficientPermissions",
  "Resource not found": "pageNotFound",
  "Page not found": "pageNotFound",
  "Version not found": "versionNotFound",
  "Project not found": "projectNotFound",
  "Rate limit exceeded. Please retry later.": "rateLimited",
  "Internal server error": "internalError",
  "Cannot rename the default branch": "cannotRenameDefaultBranch",
  "Cannot delete the default branch": "cannotDeleteDefaultBranch",
  "Source and target branches must be different":
    "sourceBranchMustDifferFromTarget",
  "Folder not found": "folderNotFound",
  "Cannot move a folder into itself or its descendants":
    "cannotMoveFolderIntoSelf",
  "Thread not found": "threadNotFound",
  "Comment not found": "commentNotFound",
  "You can only edit your own comments": "canOnlyEditOwnComments",
  "You can only delete your own comments": "canOnlyDeleteOwnComments",
};

interface ApiErrorBody {
  code?: string;
  message?: string;
}

/**
 * Returns the translation key (within the "errors" namespace) for the given
 * error.  Falls back to `null` if no mapping exists — callers should then
 * display the raw message.
 *
 * Usage:
 * ```ts
 * const t = useTranslations("errors");
 * const key = getErrorTranslationKey(err);
 * const msg = key ? t(key, params) : err.message;
 * ```
 */
export function getErrorTranslationKey(
  error: ApiErrorBody | string | unknown
): string | null {
  // String error
  if (typeof error === "string") {
    return MESSAGE_MAP[error] ?? null;
  }

  // Object with code / message
  if (error && typeof error === "object") {
    const e = error as ApiErrorBody;

    // Try code first (most reliable)
    if (e.code && e.code in ERROR_CODE_MAP) {
      return ERROR_CODE_MAP[e.code as ApiErrorCode] ?? null;
    }

    // Fall back to message match
    if (e.message && e.message in MESSAGE_MAP) {
      return MESSAGE_MAP[e.message] ?? null;
    }
  }

  return null;
}
