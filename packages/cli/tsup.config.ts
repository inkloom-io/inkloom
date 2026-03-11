import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  // Bundle workspace packages so end-users don't need them installed separately.
  // @inkloom/mdx-parser is private and never published to npm;
  // create-inkloom is bundled to avoid forcing a separate install.
  noExternal: ["@inkloom/mdx-parser", "create-inkloom"],
});
