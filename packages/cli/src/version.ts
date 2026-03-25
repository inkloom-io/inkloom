import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

/** CLI version, read from package.json at build time. */
export const VERSION = pkg.version;
