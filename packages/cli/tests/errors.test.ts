import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CliError,
  EXIT_SUCCESS,
  EXIT_GENERAL,
  EXIT_AUTH,
  EXIT_PERMISSION,
  EXIT_NOT_FOUND,
  exitCodeFromApiError,
} from "../src/lib/errors.ts";

describe("exit code constants", () => {
  it("should have correct values", () => {
    assert.equal(EXIT_SUCCESS, 0);
    assert.equal(EXIT_GENERAL, 1);
    assert.equal(EXIT_AUTH, 2);
    assert.equal(EXIT_PERMISSION, 3);
    assert.equal(EXIT_NOT_FOUND, 4);
  });

  it("should all be distinct", () => {
    const codes = [EXIT_SUCCESS, EXIT_GENERAL, EXIT_AUTH, EXIT_PERMISSION, EXIT_NOT_FOUND];
    const unique = new Set(codes);
    assert.equal(unique.size, codes.length, "All exit codes should be unique");
  });
});

describe("CliError", () => {
  it("should create error with message only (defaults to EXIT_GENERAL)", () => {
    const err = new CliError("something went wrong");
    assert.equal(err.message, "something went wrong");
    assert.equal(err.exitCode, EXIT_GENERAL);
    assert.equal(err.apiError, undefined);
    assert.equal(err.name, "CliError");
  });

  it("should create error with custom exit code", () => {
    const err = new CliError("not found", EXIT_NOT_FOUND);
    assert.equal(err.message, "not found");
    assert.equal(err.exitCode, EXIT_NOT_FOUND);
    assert.equal(err.apiError, undefined);
  });

  it("should create error with API error details", () => {
    const apiError = {
      code: "not_found",
      message: "Page not found",
      details: { pageId: "abc123" },
    };
    const err = new CliError("Page not found (not_found)", EXIT_NOT_FOUND, apiError);
    assert.equal(err.exitCode, EXIT_NOT_FOUND);
    assert.deepEqual(err.apiError, apiError);
    assert.equal(err.apiError?.code, "not_found");
    assert.equal(err.apiError?.details?.pageId, "abc123");
  });

  it("should create error with API error without details", () => {
    const apiError = { code: "unauthorized", message: "Authentication required" };
    const err = new CliError("Auth required", EXIT_AUTH, apiError);
    assert.equal(err.apiError?.details, undefined);
  });

  it("should be an instance of Error", () => {
    const err = new CliError("test");
    assert.ok(err instanceof Error);
    assert.ok(err instanceof CliError);
  });

  it("should have a stack trace", () => {
    const err = new CliError("test error");
    assert.ok(err.stack, "Should have a stack trace");
    assert.ok(err.stack!.includes("test error"), "Stack should include message");
  });
});

describe("exitCodeFromApiError", () => {
  it("should map unauthorized to EXIT_AUTH (2)", () => {
    assert.equal(exitCodeFromApiError("unauthorized"), EXIT_AUTH);
  });

  it("should map forbidden to EXIT_PERMISSION (3)", () => {
    assert.equal(exitCodeFromApiError("forbidden"), EXIT_PERMISSION);
  });

  it("should map not_found to EXIT_NOT_FOUND (4)", () => {
    assert.equal(exitCodeFromApiError("not_found"), EXIT_NOT_FOUND);
  });

  it("should map validation_error to EXIT_GENERAL (1)", () => {
    assert.equal(exitCodeFromApiError("validation_error"), EXIT_GENERAL);
  });

  it("should map conflict to EXIT_GENERAL (1)", () => {
    assert.equal(exitCodeFromApiError("conflict"), EXIT_GENERAL);
  });

  it("should map rate_limit_exceeded to EXIT_GENERAL (1)", () => {
    assert.equal(exitCodeFromApiError("rate_limit_exceeded"), EXIT_GENERAL);
  });

  it("should map internal_error to EXIT_GENERAL (1)", () => {
    assert.equal(exitCodeFromApiError("internal_error"), EXIT_GENERAL);
  });

  it("should default unknown API error codes to EXIT_GENERAL (1)", () => {
    assert.equal(exitCodeFromApiError("unknown_code"), EXIT_GENERAL);
    assert.equal(exitCodeFromApiError(""), EXIT_GENERAL);
    assert.equal(exitCodeFromApiError("some_other_error"), EXIT_GENERAL);
  });

  it("should match all API error codes from api-errors.ts", () => {
    // These are all error codes defined in apps/platform/lib/api-errors.ts
    const allApiCodes = [
      "unauthorized",
      "forbidden",
      "not_found",
      "validation_error",
      "conflict",
      "rate_limit_exceeded",
      "internal_error",
    ];
    for (const code of allApiCodes) {
      const exitCode = exitCodeFromApiError(code);
      assert.ok(
        [EXIT_GENERAL, EXIT_AUTH, EXIT_PERMISSION, EXIT_NOT_FOUND].includes(exitCode),
        `API code "${code}" should map to a valid exit code, got ${exitCode}`
      );
    }
  });
});
