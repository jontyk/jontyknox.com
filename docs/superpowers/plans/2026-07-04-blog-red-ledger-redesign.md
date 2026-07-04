# Blog Red Ledger Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the blog (index, post pages, 404) in a brutalist "red ledger" style — newspaper masthead, heavy uppercase display type, numbered index with rules, red accent — in a single centered column with no sidebar.

**Architecture:** Astro static site. The blog pages share `src/layouts/BlogLayout.astro` and load `public/styles/base.css` + `public/styles/blog.css` (plain CSS, no build step for styles). We rewrite the layout (new masthead/footer, sidebar removed), rewrite `blog.css` with blog-scoped color tokens for light/dark (homepage tokens in `base.css` untouched), and adjust the three page templates. `content/blog/nav.json` stays on disk but is no longer imported.

**Tech Stack:** Astro 5, plain CSS, no test framework. Verification is `npx astro build` plus dev-server preview checks (light/dark, mobile).

**Spec:** `docs/superpowers/specs/2026-07-04-blog-red-ledger-redesign-design.md`

**File map:**
- Modify `src/lib/format.ts` — add `metaParts()` (date + category as separate strings for the slash-separated meta line).
- Rewrite `src/layouts/BlogLayout.astro` — masthead, footer, no sidebar, `showSidebar` prop removed.
- Rewrite `public/styles/blog.css` — all ledger styles + blog color tokens.
- Rewrite `src/pages/blog/index.astro` — numbered index list.
- Modify `src/pages/blog/[slug].astro` — new article markup.
- Modify `src/pages/404.astro` — drop `showSidebar`, new classes.

---

### Task 1: Add `metaParts` to format.ts

**Files:**
- Modify: `src/lib/format.ts`

- [ ] **Step 1: Add the function**

Append to `src/lib/format.ts` (keep existing exports — `metaLine` is still used until Tasks 4–5 land, and RSS may use the others):

```ts
export function formatMonthYear(value?: Date): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function metaParts(publishedAt: Date | undefined, category: string): string[] {
  return [formatMonthYear(publishedAt), titleCase(category)].filter(Boolean);
}
```

- [ ] **Step 2: Verify the build still passes**

Run: `npx astro build`
Expected: completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat: add metaParts helper for slash-separated meta lines"
```

---

### Task 2: Rewrite BlogLayout with masthead and footer

**Files:**
- Modify: `src/layouts/BlogLayout.astro` (full rewrite)
- Modify: `src/pages/404.astro` (remove `showSidebar` prop so the build keeps passing)

- [ ] **Step 1: Replace `src/layouts/BlogLayout.astro` with:**

```astro
---
import BaseHead from "../components/BaseHead.astro";
import ThemeToggleScript from "../components/ThemeToggleScript.astro";

interface Props {
  title: string;
  description: string;
  ogType?: "article" | "website";
  activePath: string;
}

const { title, description, ogType, activePath } = Astro.props;
const blogActive = activePath === "/blog" || activePath.startsWith("/blog/");
const year = new Date().getFullYear();
---

<!doctype html>
<html lang="en">
  <head>
    <BaseHead title={title} description={description} ogType={ogType} stylesheet="blog" />
  </head>
  <body id="top">
    <div class="ledger-page">
      <header class="masthead">
        <div class="masthead-row">
          <a class="masthead-brand" href="/">Jonty Knox</a>
          <nav class="masthead-nav" aria-label="Primary">
            <a href="/">Home</a>
            <a href="/blog" aria-current={blogActive ? "page" : undefined}>All posts</a>
            <a href="/rss.xml">RSS</a>
            <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">◐</button>
          </nav>
        </div>
        <div class="masthead-subbar">
          <span>Writing, occasionally</span>
          <span>Agents · Product · Tuscany</span>
        </div>
      </header>
      <main class="ledger-main">
        <slot />
      </main>
      <footer class="ledger-footer">
        <span>© {year} Jonty Knox</span>
        <a href="#top">▲ Top</a>
      </footer>
    </div>
    <ThemeToggleScript />
  </body>
</html>
```

Notes: the `nav.json` import, sidebar block, `showSidebar` prop, avatar image, and intro paragraph are all gone (the intro copy moves to the index hero in Task 4).

- [ ] **Step 2: In `src/pages/404.astro`, delete the `showSidebar={false}` line** (rest of the file is restyled in Task 6).

- [ ] **Step 3: Verify the build passes**

Run: `npx astro build`
Expected: completes with no errors (pages will look broken until Task 3 — that's fine, only the build must pass).

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BlogLayout.astro src/pages/404.astro
git commit -m "feat: replace blog header/sidebar with ledger masthead and footer"
```

---

### Task 3: Rewrite blog.css with ledger styles

**Files:**
- Modify: `public/styles/blog.css` (full rewrite)

- [ ] **Step 1: Replace `public/styles/blog.css` with:**

```css
/* Red ledger blog theme. Scoped tokens so base.css (homepage) is untouched. */
:root {
  --ledger-paper: #efece6;
  --ledger-ink: #17150f;
  --ledger-accent: #d43a1a;
  --ledger-muted: #6e6a60;
}

[data-theme="dark"] {
  --ledger-paper: #141412;
  --ledger-ink: #eceae4;
  --ledger-accent: #ff4f2a;
  --ledger-muted: #99958b;
}

body {
  background: var(--ledger-paper);
  color: var(--ledger-ink);
  transition: background 300ms ease;
}

.ledger-page {
  margin: 0 auto;
  max-width: 760px;
  padding: 40px 20px 56px;
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--ledger-ink);
}

.ledger-page a {
  color: var(--ledger-ink);
}

.ledger-page a:hover {
  color: var(--ledger-accent);
}

.ledger-display,
.masthead-brand,
.ledger-hero h1,
.ledger-entry h2,
.ledger-article h1 {
  font-family: "Helvetica Neue", "Inter", Arial, sans-serif;
  font-weight: 900;
}

/* --- Masthead --- */
.masthead-row {
  align-items: baseline;
  border-bottom: 3px solid var(--ledger-ink);
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  justify-content: space-between;
  padding-bottom: 10px;
}

.masthead-brand {
  font-size: 1.35rem;
  letter-spacing: -0.02em;
  text-transform: uppercase;
}

.masthead-nav {
  align-items: center;
  display: flex;
  gap: 18px;
}

.masthead-nav a {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.masthead-nav a[aria-current="page"] {
  border-bottom: 2px solid var(--ledger-accent);
  color: var(--ledger-accent);
}

.masthead .theme-toggle {
  color: var(--ledger-ink);
}

.masthead .theme-toggle:hover {
  color: var(--ledger-accent);
}

.masthead-subbar {
  border-bottom: 1px solid var(--ledger-ink);
  color: var(--ledger-muted);
  display: flex;
  flex-wrap: wrap;
  font-size: 0.64rem;
  font-weight: 700;
  gap: 4px 16px;
  justify-content: space-between;
  letter-spacing: 0.14em;
  padding: 7px 0;
  text-transform: uppercase;
}

/* --- Hero --- */
.ledger-hero h1 {
  font-size: clamp(2.6rem, 8.5vw, 4.5rem);
  letter-spacing: -0.04em;
  line-height: 0.92;
  margin: 38px 0 14px;
  text-transform: uppercase;
}

.ledger-hero .accent,
.ledger-num,
.ledger-meta .slash {
  color: var(--ledger-accent);
}

.ledger-hero p {
  color: var(--ledger-muted);
  font-size: 0.95rem;
  line-height: 1.55;
  margin: 0 0 40px;
  max-width: 28rem;
}

/* --- Index --- */
.ledger-list {
  border-bottom: 3px solid var(--ledger-ink);
  list-style: none;
  margin: 0;
  padding: 0;
}

.ledger-entry {
  border-top: 1px solid var(--ledger-ink);
  display: flex;
  gap: 22px;
  padding: 18px 0;
}

.ledger-entry:first-child {
  border-top: 3px solid var(--ledger-ink);
}

.ledger-num {
  font-size: 1.9rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.ledger-entry h2 {
  font-size: 1.4rem;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin: 0;
}

.ledger-excerpt {
  color: var(--ledger-muted);
  font-size: 0.9rem;
  line-height: 1.55;
  margin: 6px 0 0;
  max-width: 34rem;
}

.ledger-meta {
  color: var(--ledger-muted);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  margin: 9px 0 0;
  text-transform: uppercase;
}

.ledger-meta a {
  color: var(--ledger-muted);
}

.ledger-meta a:hover {
  color: var(--ledger-accent);
}

/* --- Footer --- */
.ledger-footer {
  color: var(--ledger-muted);
  display: flex;
  font-size: 0.64rem;
  font-weight: 700;
  justify-content: space-between;
  letter-spacing: 0.14em;
  margin-top: 16px;
  text-transform: uppercase;
}

.ledger-footer a {
  color: var(--ledger-accent);
}

/* --- Article (post pages, 404) --- */
.ledger-article {
  margin: 0 auto;
  max-width: 680px;
}

.ledger-back {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  margin: 30px 0 22px;
  text-transform: uppercase;
}

.ledger-page .ledger-back {
  color: var(--ledger-accent);
}

.ledger-article .ledger-meta {
  margin: 0 0 10px;
}

.ledger-article h1 {
  font-size: clamp(1.9rem, 5vw, 2.7rem);
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin: 0 0 14px;
}

.ledger-lead {
  color: var(--ledger-muted);
  font-size: 1.05rem;
  line-height: 1.6;
  margin: 0 0 22px;
}

.ledger-rule {
  border: 0;
  border-top: 3px solid var(--ledger-ink);
  margin: 0 0 26px;
}

.ledger-prose {
  font-size: 1rem;
  line-height: 1.75;
}

.ledger-prose > * + * {
  margin-top: 16px;
}

.ledger-prose h1,
.ledger-prose h2,
.ledger-prose h3,
.ledger-prose h4 {
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
  margin-top: 28px;
}

.ledger-prose a {
  color: var(--ledger-accent);
  text-decoration: underline;
}

.ledger-prose blockquote {
  border-left: 3px solid var(--ledger-accent);
  font-style: italic;
  margin: 16px 0 0;
  opacity: 0.85;
  padding-left: 18px;
}

.ledger-prose blockquote::before {
  content: none;
}

.ledger-prose pre {
  background: var(--ledger-ink);
  color: var(--ledger-paper);
  overflow-x: auto;
  padding: 16px;
}

.ledger-prose code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.92em;
}

.ledger-prose img {
  border: 2px solid var(--ledger-ink);
  border-radius: 0;
  height: auto;
  max-width: 100%;
  width: 100%;
}

/* --- Mobile --- */
@media screen and (max-width: 640px) {
  .ledger-page {
    padding: 24px 16px 40px;
  }

  .ledger-entry {
    gap: 14px;
  }

  .ledger-num {
    font-size: 1.4rem;
  }

  .ledger-entry h2 {
    font-size: 1.2rem;
  }
}
```

Notes: `base.css` still loads first and provides `@font-face`, `.theme-toggle`, `::selection`, and resets; this file overrides link colors and body background for blog pages only. `blockquote::before` is disabled because `base.css` draws its own bar.

- [ ] **Step 2: Verify the build passes**

Run: `npx astro build`
Expected: completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add public/styles/blog.css
git commit -m "feat: rewrite blog stylesheet in red-ledger style"
```

---

### Task 4: Rewrite the blog index page

**Files:**
- Modify: `src/pages/blog/index.astro` (full rewrite)

- [ ] **Step 1: Replace `src/pages/blog/index.astro` with:**

```astro
---
import { getCollection } from "astro:content";
import BlogLayout from "../../layouts/BlogLayout.astro";
import { metaParts } from "../../lib/format";

const posts = (await getCollection("blog")).sort(
  (a, b) => (b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0),
);
---

<BlogLayout
  title="Blog | Jonty Knox"
  description="Writing from Jonty Knox on AI agents, product craft, founder life, and building things with conviction."
  activePath="/blog"
>
  <section class="ledger-index">
    <div class="ledger-hero">
      <h1>Thoughts <span class="accent">in</span> public</h1>
      <p>
        Notes on AI agents, product taste, company building, and the occasional lesson from
        restoring an old farmhouse in Tuscany.
      </p>
    </div>
    {
      posts.length === 0 ? (
        <ol class="ledger-list">
          <li class="ledger-entry">
            <span class="ledger-num">00</span>
            <div>
              <h2>No posts yet</h2>
              <p class="ledger-excerpt">
                Add markdown files under <code>content/blog</code> and they will show up here.
              </p>
            </div>
          </li>
        </ol>
      ) : (
        <ol class="ledger-list">
          {posts.map((post, index) => (
            <li class="ledger-entry">
              <span class="ledger-num">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>
                  <a href={`/blog/${post.id}`}>{post.data.title}</a>
                </h2>
                {post.data.excerpt && <p class="ledger-excerpt">{post.data.excerpt}</p>}
                <p class="ledger-meta">
                  {metaParts(post.data.publishedAt, post.data.category).map((part) => (
                    <>
                      {part} <span class="slash">/</span>{" "}
                    </>
                  ))}
                  <a href={`/blog/${post.id}`}>Read →</a>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )
    }
  </section>
</BlogLayout>
```

- [ ] **Step 2: Verify the build passes**

Run: `npx astro build`
Expected: completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/blog/index.astro
git commit -m "feat: replace blog card grid with numbered ledger index"
```

---

### Task 5: Restyle the post page

**Files:**
- Modify: `src/pages/blog/[slug].astro` (full rewrite)

- [ ] **Step 1: Replace `src/pages/blog/[slug].astro` with:**

```astro
---
import { getCollection, render } from "astro:content";
import BlogLayout from "../../layouts/BlogLayout.astro";
import { metaParts } from "../../lib/format";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content } = await render(post);
const parts = metaParts(post.data.publishedAt, post.data.category);
---

<BlogLayout
  title={`${post.data.title} | Jonty Knox`}
  description={post.data.excerpt ?? `Read ${post.data.title} on Jonty Knox's blog.`}
  ogType="article"
  activePath={`/blog/${post.id}`}
>
  <article class="ledger-article">
    <a class="ledger-back" href="/blog">← All posts</a>
    {
      parts.length > 0 && (
        <p class="ledger-meta">
          {parts.map((part, index) => (
            <>
              {index > 0 && <span class="slash"> / </span>}
              {part}
            </>
          ))}
        </p>
      )
    }
    <h1>{post.data.title}</h1>
    {post.data.excerpt && <p class="ledger-lead">{post.data.excerpt}</p>}
    <hr class="ledger-rule" />
    <div class="ledger-prose">
      <Content />
    </div>
  </article>
</BlogLayout>
```

- [ ] **Step 2: Verify the build passes**

Run: `npx astro build`
Expected: completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/blog/[slug].astro
git commit -m "feat: restyle blog post pages in ledger style"
```

---

### Task 6: Restyle the 404 page and remove dead code

**Files:**
- Modify: `src/pages/404.astro` (full rewrite)
- Modify: `src/lib/format.ts` (remove `metaLine` if now unused)

- [ ] **Step 1: Replace `src/pages/404.astro` with:**

```astro
---
import BlogLayout from "../layouts/BlogLayout.astro";
---

<BlogLayout title="Page not found | Jonty Knox" description="Page not found." activePath="/blog">
  <section class="ledger-article">
    <a class="ledger-back" href="/blog">← All posts</a>
    <p class="ledger-meta">404</p>
    <h1>That page has wandered off</h1>
    <p class="ledger-lead">The page you were looking for does not exist, or the slug has changed.</p>
  </section>
</BlogLayout>
```

- [ ] **Step 2: Check for remaining `metaLine` users**

Run: `grep -rn "metaLine" src/`
Expected: only the definition in `src/lib/format.ts`. If so, delete the `metaLine` function from `src/lib/format.ts`. If anything else still imports it, leave it.

- [ ] **Step 3: Verify the build passes**

Run: `npx astro build`
Expected: completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/404.astro src/lib/format.ts
git commit -m "feat: restyle 404 page and drop unused metaLine helper"
```

---

### Task 7: Preview verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and check the index page**

Start the Astro dev server (`npx astro dev`, or the preview tooling if available). Load `/blog` and confirm: masthead with red-underlined "All posts", uppercase hero with red "IN", numbered entries with red numerals, 3px top/bottom rules, footer strip.

- [ ] **Step 2: Check a post page** — back link in red uppercase, meta line with red slashes, heavy title (not uppercase), 3px rule before prose, red underlined links in body, recolored code blocks.

- [ ] **Step 3: Toggle dark mode** — background flips to near-black, ink to off-white, accent gets hotter (#ff4f2a), on both pages.

- [ ] **Step 4: Mobile viewport (375px)** — masthead wraps cleanly, hero scales down, numerals shrink, no horizontal scroll.

- [ ] **Step 5: Check `/404` and the homepage** — 404 uses the new style; homepage (`/`) is completely unchanged.

- [ ] **Step 6: Final build**

Run: `npx astro build`
Expected: completes with no errors.
