# Blog "Red Ledger" Redesign

Date: 2026-07-04
Status: Approved direction, pending spec review

## Goal

Fully redesign the blog (index page `/blog` and post pages `/blog/<slug>`) in a bold brutalist "red ledger" style: newspaper-masthead header, heavy uppercase display type, numbered post index with horizontal rules, giant red numerals, and a single centered column (the current "Explore" sidebar is removed).

The homepage (`/`) is out of scope and keeps its current style.

## Visual language

- **Canvas:** warm off-white paper (`#efece6`-ish) in light mode; near-black warm ink (`#141412`-ish) in dark mode. Theme toggle behavior is preserved.
- **Ink:** near-black text in light mode; warm off-white in dark mode.
- **Accent:** ledger red `#d43a1a` (light) / hotter `#ff4f2a` (dark). Used for post numerals, active nav, meta-line separators, hero word highlight, hover states.
- **Type:** existing Inter (400/600) as the workhorse; display headings use Inter at heavy weight with tight letter-spacing and uppercase. No new font files — use `font-weight: 800/900` synthesized or fall back to system Helvetica Neue stack for display sizes (mockup used Helvetica Neue; acceptable to set display headings in `"Helvetica Neue", Inter, Arial, sans-serif`).
- **Structure:** 3px heavy rules for major boundaries (masthead, index top/bottom), 1px rules between posts. No cards, no shadows, no border-radius.

## Pages

### Blog index (`/blog`)

Single centered column (~760px):

1. **Masthead:** "JONTY KNOX" heavy left; right-aligned uppercase nav: Home / All posts (active, red underline) / RSS / theme toggle (◐). 3px rule beneath, then a thin sub-bar: "Writing, occasionally" left, "Agents · Product · Tuscany" right (static tagline text), 1px rule.
2. **Hero:** giant uppercase "THOUGHTS IN PUBLIC" with "IN" in accent red; short intro paragraph (existing blog intro copy), max-width ~420px.
3. **Index:** posts newest-first. Each entry: red two-digit numeral (`01`, `02`, … in display order), bold title (links to post), excerpt (if present), uppercase meta line "MONTH YEAR / CATEGORY / READ →" with red slashes. 3px rule above the first entry and below the last; 1px rules between.
4. **Footer strip:** "© 2026 Jonty Knox" left, "▲ Top" link right, small uppercase.
5. **Empty state:** keeps a single entry-styled block prompting to add markdown under `content/blog`.

### Post page (`/blog/<slug>`)

Same masthead and footer. Content column narrower (~680px) for reading:

- Back link styled as uppercase "← ALL POSTS" in red.
- Uppercase meta line (date / category), then the title in the heavy display style (not uppercase — long titles in all-caps hurt readability; keep tight-tracked heavy weight), excerpt as a lead paragraph, 3px rule, then prose.
- Prose stays readable: normal-case Inter, comfortable line-height; links in accent red with underline; blockquotes get a 3px left rule; code blocks keep current treatment recolored to the new palette.

## Implementation

- **`src/layouts/BlogLayout.astro`:** replace header with the masthead; delete the sidebar block and the `content/blog/nav.json` import (`showSidebar` prop removed); add footer strip. Keep `ThemeToggleScript` and `BaseHead` wiring.
- **`public/styles/blog.css`:** rewrite for the new design. Blog-scoped color variables (paper/ink/accent) defined here for both themes so `base.css` tokens (used by homepage) stay untouched. The blog body/background override lives here too.
- **`src/pages/blog/index.astro`:** replace card grid markup with the numbered index list.
- **`src/pages/blog/[slug].astro`:** adjust classes/markup to the new article structure (minor).
- **`src/lib/format.ts`:** may need a variant returning date and category separately for the slash-separated meta line.
- `content/blog/nav.json` becomes unused by the layout; leave the file, just stop importing it.

## Error handling / edge cases

- Posts without `publishedAt` or `category`: meta line omits missing parts (existing `metaLine` behavior).
- Posts without excerpts: entry shows title + meta only.
- 100+ posts: numerals grow to three digits; tabular-nums keeps alignment.
- Mobile (<640px): hero scales down via `clamp()`; masthead nav wraps below the name; index numerals shrink.
- No-JS: theme toggle already degrades; nothing new depends on JS.

## Testing

Static site, no test suite. Verification via dev-server preview: index and a post page in light and dark mode, mobile viewport, empty-state check, and `astro build` passing.
