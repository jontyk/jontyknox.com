# AGENTS

## Purpose

This repository is a zro app, not a Node or Next app.
Agents working here should default to zro-native patterns for routing, file access, capabilities, and type-checking.

## Project Shape

- Project config: [zro.toml](./zro.toml)
- Entrypoint module: [src/index/mod.ts](./src/index/mod.ts)
- Public assets directory: `/public`
- Editor/type support: [tsconfig.json](./tsconfig.json) and [zro-env.d.ts](./zro-env.d.ts)

Important: `entrypoint = "src/index"` means zro looks for `src/index/mod.ts`, not `src/index.ts`.

## Default Commands

Use these first:

```bash
zro dev
zro lint src/index/mod.ts
zro build
tsc --noEmit
zro fmt src/index/mod.ts
```

If `zro dev` behaves unexpectedly, also try:

```bash
zro dev src/index/mod.ts
```

## zro Runtime Rules

- Prefer `zro.serve(...)` for HTTP apps.
- Prefer `zro.fs.*` for runtime filesystem access.
- Prefer `match(...)` on zro `Result` values instead of assuming success.
- Do not assume Node built-ins like `node:fs` are available in runtime code.
- Treat zro runtime code like a capability-gated environment, not a full Node server.

## File System Guidance

Use zro APIs at runtime:

```ts
const text = await zro.fs.read("file.txt").text();
const bytes = await zro.fs.read("public/image.png").bytes();
const entries = await zro.fs.readDir("public");
```

Handle results with `match(...)`:

```ts
const file = await zro.fs.read("public/example.txt").text();

return match(file, {
  Ok: (content) => content,
  Err: () => null,
});
```

Avoid these in runtime code unless support is explicitly verified:

- `import { readFile } from "node:fs/promises"`
- path-based Node filesystem helpers

## Capabilities

zro capabilities are declared in [zro.toml](./zro.toml).
If runtime code needs new access, update the matching module allow-list.

Important:

- Capabilities are granted per module, for example `[index.allow]`
- The module name here comes from the entrypoint folder name and config, not from arbitrary file names

Rules:

- If you add runtime reads outside `/public`, update `fs.read`.
- If you add runtime writes, explicitly add `fs.write`.
- If you add network access, explicitly add `fetch`.
- Keep grants as narrow as practical.

## Dependencies

If runtime code imports JSR packages, install them with `zro add`, for example:

```bash
zro add jsr:@hono/hono
```

Do not assume npm or `node_modules` is the source of truth for runtime dependencies.

## Type Checking

zro can build without a local `tsconfig.json`, but this repo keeps one for editor support and `tsc --noEmit`.

- Runtime validation: `zro lint` and `zro build`
- Editor support: [tsconfig.json](./tsconfig.json)
- Ambient zro globals for this repo: [zro-env.d.ts](./zro-env.d.ts)
- If future zro features need more ambient types, extend `zro-env.d.ts`

## Verification

After meaningful changes, run:

```bash
zro fmt src/index/mod.ts
zro lint src/index/mod.ts
zro build
tsc --noEmit
```

If runtime behavior changed, also confirm `zro.toml` grants still match the code.
