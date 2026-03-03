import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { isInteractive, confirm } from "../src/lib/prompt.ts";
import { CliError, EXIT_GENERAL } from "../src/lib/errors.ts";

// Save/restore helpers for environment and process.stdin.isTTY
let originalCI: string | undefined;
let originalIsTTY: boolean | undefined;

function saveState() {
  originalCI = process.env.CI;
  originalIsTTY = process.stdin.isTTY;
}

function restoreState() {
  if (originalCI === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = originalCI;
  }
  // isTTY is a getter from libuv; we can assign it for testing
  Object.defineProperty(process.stdin, "isTTY", {
    value: originalIsTTY,
    writable: true,
    configurable: true,
  });
}

describe("isInteractive", () => {
  beforeEach(() => {
    saveState();
  });

  afterEach(() => {
    restoreState();
  });

  it("should return false when CI env var is set", () => {
    process.env.CI = "true";
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    assert.equal(isInteractive(), false);
  });

  it("should return false when CI env var is set to any truthy value", () => {
    process.env.CI = "1";
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    assert.equal(isInteractive(), false);
  });

  it("should return false when stdin is not a TTY", () => {
    delete process.env.CI;
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
    assert.equal(isInteractive(), false);
  });

  it("should return false when stdin.isTTY is undefined", () => {
    delete process.env.CI;
    Object.defineProperty(process.stdin, "isTTY", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    assert.equal(isInteractive(), false);
  });

  it("should return true when TTY and no CI env", () => {
    delete process.env.CI;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    assert.equal(isInteractive(), true);
  });

  it("should return false when both CI is set and stdin is not TTY", () => {
    process.env.CI = "true";
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
    assert.equal(isInteractive(), false);
  });
});

describe("confirm", () => {
  beforeEach(() => {
    saveState();
  });

  afterEach(() => {
    restoreState();
  });

  it("should return true immediately when force is true", async () => {
    // Force should bypass all checks — even in non-interactive mode
    process.env.CI = "true";
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    const result = await confirm("Delete everything?", { force: true });
    assert.equal(result, true);
  });

  it("should return true when force is true and TTY is available", async () => {
    delete process.env.CI;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });

    const result = await confirm("Are you sure?", { force: true });
    assert.equal(result, true);
  });

  it("should throw CliError in non-interactive mode without force", async () => {
    process.env.CI = "true";
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    await assert.rejects(
      () => confirm("Delete everything?"),
      (err: unknown) => {
        assert.ok(err instanceof CliError);
        assert.equal(err.exitCode, EXIT_GENERAL);
        assert.ok(err.message.includes("Confirmation required"));
        assert.ok(err.message.includes("--force"));
        return true;
      }
    );
  });

  it("should throw CliError when stdin is not TTY (piped input)", async () => {
    delete process.env.CI;
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    await assert.rejects(
      () => confirm("Continue?"),
      (err: unknown) => {
        assert.ok(err instanceof CliError);
        assert.equal(err.exitCode, EXIT_GENERAL);
        assert.ok(err.message.includes("--force"));
        return true;
      }
    );
  });

  it("should throw CliError when opts is undefined in non-interactive mode", async () => {
    process.env.CI = "true";
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    await assert.rejects(
      () => confirm("Delete?", undefined),
      (err: unknown) => {
        assert.ok(err instanceof CliError);
        return true;
      }
    );
  });

  it("should throw CliError when force is explicitly false in non-interactive mode", async () => {
    process.env.CI = "true";
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    await assert.rejects(
      () => confirm("Delete?", { force: false }),
      (err: unknown) => {
        assert.ok(err instanceof CliError);
        return true;
      }
    );
  });
});

describe("confirm — property-based edge cases", () => {
  beforeEach(() => {
    saveState();
  });

  afterEach(() => {
    restoreState();
  });

  it("force=true should always return true regardless of environment", async () => {
    // Test multiple environment combinations with force=true
    const environments = [
      { ci: "true", tty: false },
      { ci: "true", tty: true },
      { ci: undefined, tty: false },
      { ci: undefined, tty: true },
      { ci: "1", tty: false },
      { ci: "", tty: true },
    ];

    for (const env of environments) {
      if (env.ci === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = env.ci;
      }
      Object.defineProperty(process.stdin, "isTTY", {
        value: env.tty,
        writable: true,
        configurable: true,
      });

      const result = await confirm("Test?", { force: true });
      assert.equal(
        result,
        true,
        `force=true should return true with CI=${env.ci}, TTY=${env.tty}`
      );
    }
  });

  it("non-interactive without force should always throw CliError", async () => {
    // Test all non-interactive scenarios
    const nonInteractiveEnvs = [
      { ci: "true", tty: true },  // CI overrides TTY
      { ci: "true", tty: false },
      { ci: undefined, tty: false }, // no TTY
    ];

    for (const env of nonInteractiveEnvs) {
      if (env.ci === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = env.ci;
      }
      Object.defineProperty(process.stdin, "isTTY", {
        value: env.tty,
        writable: true,
        configurable: true,
      });

      await assert.rejects(
        () => confirm("Delete?"),
        (err: unknown) => {
          assert.ok(
            err instanceof CliError,
            `Should throw CliError with CI=${env.ci}, TTY=${env.tty}`
          );
          return true;
        }
      );
    }
  });

  it("error message should contain actionable instructions", async () => {
    process.env.CI = "true";
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    await assert.rejects(
      () => confirm("Delete this project?"),
      (err: unknown) => {
        assert.ok(err instanceof CliError);
        // Must mention --force so users know what to do
        assert.ok(
          err.message.includes("--force"),
          "Error should mention --force flag"
        );
        // Must mention non-interactive context
        assert.ok(
          err.message.includes("non-interactive"),
          "Error should mention non-interactive mode"
        );
        return true;
      }
    );
  });
});
