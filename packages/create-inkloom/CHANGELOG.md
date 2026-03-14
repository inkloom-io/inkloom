# create-inkloom

## 0.1.1

### Patch Changes

- [`2bb75bd`](https://github.com/inkloom-io/inkloom-private/commit/2bb75bd29e3449e770ee2f15b34035dac8ce0dd8) Thanks [@notadamking](https://github.com/notadamking)! - Add process.cwd() fallback for template path resolution in monorepo workspaces.

- [`1c75287`](https://github.com/inkloom-io/inkloom-private/commit/1c75287c3a259c3246016412851d8fb4eaa4358d) Thanks [@notadamking](https://github.com/notadamking)! - Fix Convex deployment error caused by hyphenated schema filenames. Renamed `schema/core-tables.ts` to `schema/coreTables.ts` in the scaffolded template, since Convex rejects hyphens in module paths.

- [`02f28a7`](https://github.com/inkloom-io/inkloom-private/commit/02f28a79702efde5c544baf8a556eceac6cb2008) Thanks [@notadamking](https://github.com/notadamking)! - Fix template path resolution when code is bundled by Next.js. Template functions now accept an optional `templateDir` parameter for callers running inside bundlers where `import.meta.url` points to the wrong location.
