# AGENTS

## Purpose

This repository is a static Astro site deployed on Vercel.

## Project Shape

- Config: [astro.config.mjs](./astro.config.mjs)
- Pages: `src/pages/` (homepage, blog index, `blog/[slug]`, 404)
- Layouts/components: `src/layouts/`, `src/components/`
- Blog content: markdown in `content/blog/` (loaded via the `blog` content collection in [src/content.config.ts](./src/content.config.ts))
- Blog sidebar navigation: [content/blog/nav.json](./content/blog/nav.json)
- Static assets: `public/` (served as-is, including `public/styles/*.css`)

## Commands

```bash
npm run dev       # local dev server
npm run build     # static build to dist/
npm run preview   # preview the built site
```

## Conventions

- Styling is plain CSS in `public/styles/` (base.css shared, home.css and blog.css per shell). No CSS framework.
- Dark/light theme uses a `data-theme` attribute set by an inline script (`payload-theme` localStorage key). Inline scripts must use `is:inline`.
- Blog posts need frontmatter: `title`, `category`, and optionally `excerpt`, `publishedAt`. Do not include an `# H1` in the markdown body — the page template renders the title.
- New posts should also be added to `content/blog/nav.json` if they belong in the sidebar.

## Deployment

Vercel auto-detects Astro; no adapter or vercel.json is required. Output is fully static.

## Verification

After changes, run `npm run build` and confirm all pages generate.
