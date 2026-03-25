# @inkloom/cli

## 0.3.0

### Minor Changes

- [`abbb8da`](https://github.com/inkloom-io/inkloom-private/commit/abbb8da93440e30b97edcfc11a066fd13135a992) Thanks [@notadamking](https://github.com/notadamking)! - Auto-resolve orgId from API when not configured. The `projects create` command now automatically detects the user's organization from existing projects instead of requiring `--org` or `INKLOOM_ORG_ID`. The resolved orgId is cached in config for subsequent commands.

### Patch Changes

- [`6df9ab8`](https://github.com/inkloom-io/inkloom-private/commit/6df9ab85ca371377cf5649bcf7150e65926d20b9) Thanks [@notadamking](https://github.com/notadamking)! - Add INKLOOM_CREDENTIAL_BACKEND env var to force plaintext credential fallback for testing/CI

- [`0b4f535`](https://github.com/inkloom-io/inkloom-private/commit/0b4f535a634f4d2db776845d52d3a2d87aceafd6) Thanks [@notadamking](https://github.com/notadamking)! - Derive CLI version from package.json at runtime instead of hardcoding, preventing version drift when changesets bump the package version.

- [`4ea41cc`](https://github.com/inkloom-io/inkloom-private/commit/4ea41ccd0894e4b147f57d7436ebff519772ba9b) Thanks [@notadamking](https://github.com/notadamking)! - Fix resolveConfig to correctly handle empty string environment variables as valid values instead of falling through to the next source.

## 0.2.2

### Patch Changes

- [`d1b6af5`](https://github.com/inkloom-io/inkloom-private/commit/d1b6af56764009241979d90dd9ee1499016119ab) Thanks [@notadamking](https://github.com/notadamking)! - Fix default API URL from app.inkloom.io to inkloom.io to resolve 522 connection errors.

## 0.2.1

### Patch Changes

- [`065c51f`](https://github.com/inkloom-io/inkloom-private/commit/065c51f53af9bbd10deb202817b42c8deb75fa4a) Thanks [@notadamking](https://github.com/notadamking)! - Fix install failure by moving bundled workspace dep (@inkloom/migration) from dependencies to devDependencies. Since tsup bundles it at build time, it should not be a runtime dependency.

## 0.2.0

### Minor Changes

- [`7b2afac`](https://github.com/inkloom-io/inkloom-private/commit/7b2afac5a4f7f398b2e1abb9c6376e3dbe404091) Thanks [@notadamking](https://github.com/notadamking)! - Add `inkloom import` command for migrating documentation from Mintlify and Gitbook into InkLoom projects.

- [`2a37a9c`](https://github.com/inkloom-io/inkloom-private/commit/2a37a9c2954cc470796472a75e742fee857ca98e) Thanks [@notadamking](https://github.com/notadamking)! - Add cross-platform credential store abstraction that stores CLI tokens in the OS keychain (macOS Keychain, Linux libsecret, Windows Credential Manager) instead of plaintext files, with automatic fallback to file-based storage.

- [`5c9ce1b`](https://github.com/inkloom-io/inkloom-private/commit/5c9ce1b6abd660106df257d33c1202ac4d351b08) Thanks [@notadamking](https://github.com/notadamking)! - Update auth commands and token resolution to use OS keychain credential store. Token resolution now checks CLI flags, env vars, OS keychain, then legacy config file. `auth status` shows token source and migration hints. `auth logout` clears both keychain and legacy config.

- [`a420d89`](https://github.com/inkloom-io/inkloom-private/commit/a420d898af8a8e4cf16eb9f3eec67b581494bb30) Thanks [@notadamking](https://github.com/notadamking)! - Add browser-based login flow as the default for `inkloom auth login`. The CLI starts a localhost server, opens the browser for authentication, and securely stores credentials in the OS keychain. Includes `--no-browser` fallback for interactive token prompt and `--token` flag for CI/CD usage.

- [`8542e49`](https://github.com/inkloom-io/inkloom-private/commit/8542e49f9897e28a55e6e495fafe937ee975ab39) Thanks [@notadamking](https://github.com/notadamking)! - Integrate docs.json config into the `pages push` command. After pushing MDX files, the push command now reads `docs.json` from the push directory and applies navigation tabs, page ordering, and auto-uploads OpenAPI specs. Add `--no-config` flag to skip docs.json processing.

### Patch Changes

- [`8542e49`](https://github.com/inkloom-io/inkloom-private/commit/8542e49f9897e28a55e6e495fafe937ee975ab39) Thanks [@notadamking](https://github.com/notadamking)! - Add shared docs-config parser for docs.json navigation config files with validation, navTab resolution, and page position mapping.

- [`2f640ec`](https://github.com/inkloom-io/inkloom-private/commit/2f640eca9d878c8909f45a2359234a41118190d2) Thanks [@notadamking](https://github.com/notadamking)! - Add branding badge HTML to generated build output so build-branding tests pass.

- [`3cf700d`](https://github.com/inkloom-io/inkloom-private/commit/3cf700d0212826393e4ede70898ce79cfbc27327) Thanks [@notadamking](https://github.com/notadamking)! - Skip platform CLI boundary tests when platform/ directory is absent, fixing CI failures on the public repo.

- [`e759dcd`](https://github.com/inkloom-io/inkloom-private/commit/e759dcd9e4d3868496ed36723be836377be48408) Thanks [@notadamking](https://github.com/notadamking)! - Add @inkloom/migration as an explicit dependency so the type-check build chain resolves correctly.

- [`da3e79d`](https://github.com/inkloom-io/inkloom-private/commit/da3e79d055b7b1e36d06631da0b5db219d7ae5cb) Thanks [@notadamking](https://github.com/notadamking)! - Fix CLI crash caused by yaml CJS package bundled into ESM output. Externalize yaml dependency and properly declare @inkloom/migration as a bundled workspace package.

- [`546a9ca`](https://github.com/inkloom-io/inkloom-private/commit/546a9cae81a9517bc8d2877c15067982b487ac52) Thanks [@notadamking](https://github.com/notadamking)! - Remove the fixed-position "Built with InkLoom" badge from the bottom-right corner of published sites. Sidebar branding remains for applicable plans.

- Updated dependencies []:
  - @inkloom/migration@0.1.0
