import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { printData, printSuccess, printError, printWarning } from "../src/lib/output.ts";
import { CliError, EXIT_NOT_FOUND, EXIT_AUTH } from "../src/lib/errors.ts";

// Capture stdout/stderr writes for assertions
let stdoutOutput: string;
let stderrOutput: string;
let origStdoutWrite: typeof process.stdout.write;
let origStderrWrite: typeof process.stderr.write;

function captureOutput() {
  stdoutOutput = "";
  stderrOutput = "";
  origStdoutWrite = process.stdout.write;
  origStderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutOutput += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrOutput += String(chunk);
    return true;
  }) as typeof process.stderr.write;
}

function restoreOutput() {
  process.stdout.write = origStdoutWrite;
  process.stderr.write = origStderrWrite;
}

// Strip ANSI escape codes for easier assertions
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}

describe("printData", () => {
  beforeEach(() => captureOutput());
  afterEach(() => restoreOutput());

  describe("JSON mode", () => {
    it("should output JSON-stringified data to stdout", () => {
      printData({ name: "test", id: 123 }, { json: true });
      const parsed = JSON.parse(stdoutOutput);
      assert.deepEqual(parsed, { name: "test", id: 123 });
    });

    it("should output JSON array to stdout", () => {
      const data = [{ id: 1 }, { id: 2 }];
      printData(data, { json: true });
      const parsed = JSON.parse(stdoutOutput);
      assert.deepEqual(parsed, data);
    });

    it("should output null as JSON", () => {
      printData(null, { json: true });
      assert.equal(stdoutOutput.trim(), "null");
    });

    it("should output string as JSON", () => {
      printData("hello", { json: true });
      assert.equal(stdoutOutput.trim(), '"hello"');
    });

    it("should output number as JSON", () => {
      printData(42, { json: true });
      assert.equal(stdoutOutput.trim(), "42");
    });

    it("should pretty-print JSON with 2-space indent", () => {
      printData({ a: 1 }, { json: true });
      assert.ok(stdoutOutput.includes("  "), "Should contain indentation");
      assert.ok(stdoutOutput.includes('"a"'), "Should contain key");
    });
  });

  describe("table mode (array of objects)", () => {
    it("should print aligned table with header row", () => {
      const data = [
        { id: "abc123", name: "My Project", slug: "my-project" },
        { id: "def456", name: "Docs", slug: "docs" },
      ];
      printData(data, {});
      const plain = stripAnsi(stdoutOutput);

      // Header row should exist with uppercase keys
      assert.ok(plain.includes("ID"), "Should have ID header");
      assert.ok(plain.includes("NAME"), "Should have NAME header");
      assert.ok(plain.includes("SLUG"), "Should have SLUG header");

      // Data rows should exist
      assert.ok(plain.includes("abc123"), "Should have first row ID");
      assert.ok(plain.includes("My Project"), "Should have first row name");
      assert.ok(plain.includes("def456"), "Should have second row ID");
    });

    it("should print 'No results' for empty array", () => {
      printData([], {});
      const plain = stripAnsi(stdoutOutput);
      assert.ok(plain.includes("No results"));
    });

    it("should handle single-row tables", () => {
      printData([{ id: "abc" }], {});
      const plain = stripAnsi(stdoutOutput);
      assert.ok(plain.includes("ID"));
      assert.ok(plain.includes("abc"));
    });

    it("should handle boolean values in table cells", () => {
      printData([{ name: "test", active: true }], {});
      const plain = stripAnsi(stdoutOutput);
      assert.ok(plain.includes("true"));
    });

    it("should handle null/undefined values in table cells", () => {
      printData([{ name: "test", parent: null }], {});
      const plain = stripAnsi(stdoutOutput);
      // null should be rendered as "—" (em dash)
      assert.ok(plain.includes("—"), "Null should show em dash");
    });

    it("should handle array values in table cells", () => {
      printData([{ name: "hook", events: ["page.created", "page.updated"] }], {});
      const plain = stripAnsi(stdoutOutput);
      assert.ok(plain.includes("page.created, page.updated"));
    });

    it("should print primitives one per line for arrays of non-objects", () => {
      printData(["alpha", "beta", "gamma"], {});
      const plain = stripAnsi(stdoutOutput);
      assert.ok(plain.includes("alpha"));
      assert.ok(plain.includes("beta"));
      assert.ok(plain.includes("gamma"));
    });

    it("should pad columns correctly for alignment", () => {
      const data = [
        { id: "a", name: "Short" },
        { id: "abc123456", name: "A Much Longer Name Here" },
      ];
      printData(data, {});
      const lines = stdoutOutput.split("\n").filter((l) => l.trim());
      // Each line should start with spaces
      for (const line of lines) {
        assert.ok(line.startsWith("  "), `Line should start with indent: "${line}"`);
      }
    });
  });

  describe("key-value mode (object)", () => {
    it("should print object as key-value pairs", () => {
      printData({ id: "abc123", name: "My Project", slug: "my-proj" }, {});
      const plain = stripAnsi(stdoutOutput);
      assert.ok(plain.includes("id"), "Should have 'id' key");
      assert.ok(plain.includes("abc123"), "Should have value");
      assert.ok(plain.includes("name"), "Should have 'name' key");
      assert.ok(plain.includes("My Project"), "Should have name value");
    });

    it("should handle empty object", () => {
      printData({}, {});
      const plain = stripAnsi(stdoutOutput);
      assert.ok(plain.includes("No data"));
    });

    it("should align key-value pairs", () => {
      printData({ short: "a", longerKey: "b" }, {});
      const lines = stdoutOutput.split("\n").filter((l) => l.trim());
      assert.equal(lines.length, 2, "Should have 2 lines");
    });
  });

  describe("primitive mode", () => {
    it("should print string as-is", () => {
      printData("hello world", {});
      assert.equal(stdoutOutput, "hello world\n");
    });

    it("should print number as string", () => {
      printData(42, {});
      assert.equal(stdoutOutput, "42\n");
    });

    it("should print boolean as string", () => {
      printData(true, {});
      assert.equal(stdoutOutput, "true\n");
    });
  });
});

describe("printSuccess", () => {
  beforeEach(() => captureOutput());
  afterEach(() => restoreOutput());

  it("should write to stderr with green checkmark", () => {
    printSuccess("Token saved");
    const plain = stripAnsi(stderrOutput);
    assert.ok(plain.includes("✓"), "Should contain checkmark");
    assert.ok(plain.includes("Token saved"), "Should contain message");
    assert.equal(stdoutOutput, "", "Should not write to stdout");
  });

  it("should end with newline", () => {
    printSuccess("Done");
    assert.ok(stderrOutput.endsWith("\n"));
  });
});

describe("printError", () => {
  beforeEach(() => captureOutput());
  afterEach(() => restoreOutput());

  describe("human-readable mode", () => {
    it("should print generic Error to stderr", () => {
      printError(new Error("something failed"), {});
      const plain = stripAnsi(stderrOutput);
      assert.ok(plain.includes("Error:"), "Should have Error: prefix");
      assert.ok(plain.includes("something failed"), "Should have message");
      assert.equal(stdoutOutput, "", "Should not write to stdout");
    });

    it("should print CliError to stderr", () => {
      const err = new CliError("Page not found (not_found)", EXIT_NOT_FOUND, {
        code: "not_found",
        message: "Page not found",
      });
      printError(err, {});
      const plain = stripAnsi(stderrOutput);
      assert.ok(plain.includes("Error:"));
      assert.ok(plain.includes("Page not found (not_found)"));
    });
  });

  describe("JSON mode", () => {
    it("should output JSON error to stderr for generic Error", () => {
      printError(new Error("something failed"), { json: true });
      const parsed = JSON.parse(stderrOutput);
      assert.ok(parsed.error, "Should have error key");
      assert.equal(parsed.error.message, "something failed");
      assert.equal(parsed.error.code, undefined, "Generic errors have no code");
    });

    it("should output JSON error with code for CliError with apiError", () => {
      const err = new CliError("Page not found (not_found)", EXIT_NOT_FOUND, {
        code: "not_found",
        message: "Page not found",
      });
      printError(err, { json: true });
      const parsed = JSON.parse(stderrOutput);
      assert.equal(parsed.error.code, "not_found");
      assert.equal(parsed.error.message, "Page not found (not_found)");
    });

    it("should include details in JSON error when present", () => {
      const err = new CliError("Validation failed", 1, {
        code: "validation_error",
        message: "Validation failed",
        details: { field: "name", reason: "required" },
      });
      printError(err, { json: true });
      const parsed = JSON.parse(stderrOutput);
      assert.deepEqual(parsed.error.details, { field: "name", reason: "required" });
    });

    it("should not include details when not present", () => {
      const err = new CliError("Auth failed", EXIT_AUTH, {
        code: "unauthorized",
        message: "Auth failed",
      });
      printError(err, { json: true });
      const parsed = JSON.parse(stderrOutput);
      assert.equal(parsed.error.details, undefined);
    });

    it("should not write to stdout", () => {
      printError(new Error("fail"), { json: true });
      assert.equal(stdoutOutput, "");
    });
  });
});

describe("printWarning", () => {
  beforeEach(() => captureOutput());
  afterEach(() => restoreOutput());

  it("should write to stderr with 'Warning:' prefix", () => {
    printWarning("This feature is deprecated");
    const plain = stripAnsi(stderrOutput);
    assert.ok(plain.includes("Warning:"), "Should have Warning: prefix");
    assert.ok(plain.includes("This feature is deprecated"), "Should have message");
    assert.equal(stdoutOutput, "", "Should not write to stdout");
  });

  it("should end with newline", () => {
    printWarning("test");
    assert.ok(stderrOutput.endsWith("\n"));
  });
});

describe("output separation (stdout vs stderr)", () => {
  beforeEach(() => captureOutput());
  afterEach(() => restoreOutput());

  it("should write data to stdout only", () => {
    printData([{ id: "1" }], {});
    assert.ok(stdoutOutput.length > 0, "Should write to stdout");
    assert.equal(stderrOutput, "", "Should not write to stderr");
  });

  it("should write success messages to stderr only", () => {
    printSuccess("ok");
    assert.equal(stdoutOutput, "", "Should not write to stdout");
    assert.ok(stderrOutput.length > 0, "Should write to stderr");
  });

  it("should write errors to stderr only", () => {
    printError(new Error("fail"), {});
    assert.equal(stdoutOutput, "", "Should not write to stdout");
    assert.ok(stderrOutput.length > 0, "Should write to stderr");
  });

  it("should write warnings to stderr only", () => {
    printWarning("caution");
    assert.equal(stdoutOutput, "", "Should not write to stdout");
    assert.ok(stderrOutput.length > 0, "Should write to stderr");
  });
});

describe("table edge cases", () => {
  beforeEach(() => captureOutput());
  afterEach(() => restoreOutput());

  it("should handle objects with nested object values", () => {
    printData([{ id: "1", meta: { version: 2 } }], {});
    const plain = stripAnsi(stdoutOutput);
    assert.ok(plain.includes('{"version":2}'), "Should JSON.stringify nested objects");
  });

  it("should handle objects with empty array values", () => {
    printData([{ id: "1", tags: [] }], {});
    const plain = stripAnsi(stdoutOutput);
    // Empty array should render as empty string from join
    assert.ok(plain.includes("ID"), "Should still have header");
  });

  it("should handle very long cell values without crashing", () => {
    const longValue = "x".repeat(500);
    printData([{ id: longValue }], {});
    const plain = stripAnsi(stdoutOutput);
    assert.ok(plain.includes(longValue));
  });

  it("should handle rows with undefined values", () => {
    const data = [{ id: "1", name: undefined }];
    printData(data, {});
    const plain = stripAnsi(stdoutOutput);
    assert.ok(plain.includes("—"), "Undefined should show em dash");
  });

  it("should handle mixed types in column values", () => {
    const data = [
      { id: "1", value: "hello" },
      { id: "2", value: 42 },
    ];
    printData(data as unknown[], {});
    const plain = stripAnsi(stdoutOutput);
    assert.ok(plain.includes("hello"));
    assert.ok(plain.includes("42"));
  });

  it("should handle single-column tables", () => {
    printData([{ id: "only-one" }], {});
    const plain = stripAnsi(stdoutOutput);
    assert.ok(plain.includes("ID"));
    assert.ok(plain.includes("only-one"));
  });
});
