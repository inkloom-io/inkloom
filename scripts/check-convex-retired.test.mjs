import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const checkerPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-convex-retired.mjs"
);

function fixture(files) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "inkloom-retired-backend-")
  );
  execFileSync("git", ["init", "--quiet", directory]);
  for (const [relativePath, contents] of Object.entries(files)) {
    const filename = path.join(directory, relativePath);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, contents);
  }
  execFileSync("git", ["-C", directory, "add", "."]);
  return directory;
}

function check(directory) {
  return spawnSync(process.execPath, [checkerPath, directory], {
    encoding: "utf8",
  });
}

function withFixture(files, callback) {
  const directory = fixture(files);
  try {
    callback(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("accepts tracked Cloudflare data-platform sources and retirement prose", () => {
  withFixture(
    {
      "package.json": JSON.stringify({
        dependencies: { hono: "^4.0.0" },
      }),
      "src/worker.ts": 'export const storage = "cloudflare-d1";\n',
      "docs/migration.md": "Convex was replaced by Cloudflare D1.\n",
    },
    (directory) => {
      const result = check(directory);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /retirement check passed/);
    }
  );
});

test("rejects retired dependencies and imports", () => {
  withFixture(
    {
      "package.json": JSON.stringify({
        dependencies: { convex: "^1.0.0", "convex-helpers": "^0.1.0" },
      }),
      "src/data.ts": 'import { query } from "convex/server";\n',
    },
    (directory) => {
      const result = check(directory);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /retired dependency convex/);
      assert.match(result.stderr, /retired dependency convex-helpers/);
      assert.match(result.stderr, /retired package import/);
    }
  );
});

test("rejects retired environment variables, endpoints, and paths", () => {
  withFixture(
    {
      "src/config.ts": [
        "const url = process.env.NEXT_PUBLIC_CONVEX_URL;",
        'const endpoint = "https://retired.convex.cloud";',
        "",
      ].join("\n"),
      "convex/schema.ts": "export default {};\n",
    },
    (directory) => {
      const result = check(directory);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /retired environment variable/);
      assert.match(result.stderr, /retired hosted endpoint/);
      assert.match(result.stderr, /retired backend path/);
    }
  );
});
