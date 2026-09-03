# AGENTS

## Purpose

This repository is a static Astro site deployed on Vercel.

## Project Shape

- Config: [astro.config.mjs](./astro.config.mjs)
- Pages: `src/pages/` (homepage, blog index, `blog/[slug]`, 404)
- Layouts/components: `src/layouts/`, `src/components/`
- Blog content: markdown in `content/blog/` (loaded via the `blog` content collection in [src/content.config.ts](./src/content.config.ts))
- Blog sidebar navigation: [content/blog/nav.json](./content/blog/nav.json)
- Static assets: `public/` (served as-is)

## Commands

```bash
npm run dev       # local dev server
npm run build     # static build to dist/
npm run preview   # preview the built site
npm test          # node:test suite over src/lib/*.test.ts
npm run check     # astro check (typechecks .astro + .ts)
npm run verify    # check + test + build, in that order
```

## Conventions

- Styling is plain CSS in `src/styles/`, inlined at build time by `BaseHead.astro` (not served as static files — kept out of `public/` so the raw `.css` isn't also copied to `dist/`). `base.css` and `ledger.css` load on every page; `blog.css` or `fuel.css` is picked per page via the layout's `stylesheet` prop. No CSS framework.
- Dark/light theme uses a `data-theme` attribute set by an inline script (`payload-theme` localStorage key). Inline scripts must use `is:inline`.
- Blog posts need frontmatter: `title`, `category`, and optionally `excerpt`, `publishedAt`. Do not include an `# H1` in the markdown body — the page template renders the title.
- New posts should also be added to `content/blog/nav.json` if they belong in the sidebar.
- Domain logic lives in `src/lib/*.ts` as pure functions with no DOM or Astro imports, so `node --test` can load them directly. Each has a colocated `*.test.ts`. Keep new calculation logic there rather than inline in a page.

## Deployment

Vercel auto-detects Astro; no adapter or vercel.json is required. Output is fully static.

## Verification

After changes, run `npm run verify` — it typechecks, runs the test suite, then confirms all pages generate.
