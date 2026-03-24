# @inkloom/cli

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
