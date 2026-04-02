import type { Doc, NavSection } from "../docs/mod.ts";

type BlogPageAssets = {
  baseCss: string;
  blogCss: string;
  portraitSrc: string;
};

type BlogLayoutOptions = BlogPageAssets & {
  title: string;
  description: string;
  body: string;
  activePath: string;
  ogType?: "article" | "website";
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function titleCase(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPublishedAt(value?: string): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function renderThemeSetupScript(): string {
  return `(function () {
    var storageKey = "payload-theme";
    var defaultTheme = "light";

    function getImplicitPreference() {
      var mediaQuery = "(prefers-color-scheme: dark)";
      var mql = window.matchMedia(mediaQuery);
      return typeof mql.matches === "boolean" ? (mql.matches ? "dark" : "light") : null;
    }

    var theme = localStorage.getItem(storageKey);

    if (theme !== "light" && theme !== "dark") {
      theme = getImplicitPreference() || defaultTheme;
    }

    document.documentElement.setAttribute("data-theme", theme);
  })();`;
}

function renderThemeToggleScript(): string {
  return `(function () {
    var storageKey = "payload-theme";
    var toggle = document.getElementById("theme-toggle");

    if (!toggle) return;

    function nextTheme(theme) {
      return theme === "dark" ? "light" : "dark";
    }

    function updateLabel(theme) {
      toggle.setAttribute("aria-label", "Switch to " + nextTheme(theme) + " mode");
      toggle.textContent = theme === "dark" ? "☀" : "◐";
    }

    var currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    updateLabel(currentTheme);

    toggle.addEventListener("click", function () {
      currentTheme = nextTheme(currentTheme);
      document.documentElement.setAttribute("data-theme", currentTheme);
      localStorage.setItem(storageKey, currentTheme);
      updateLabel(currentTheme);
    });
  })();`;
}

function renderNavigation(sections: NavSection[], activePath: string): string {
  if (sections.length === 0) {
    return "";
  }

  const sectionsHtml = sections
    .map((section) => {
      const itemsHtml = section.items
        .map((item) => {
          const isActive = item.path === activePath;
          const currentAttr = isActive ? ' aria-current="page"' : "";

          return `<li><a href="${escapeAttr(item.path)}"${currentAttr}>${escapeHtml(item.title)}</a></li>`;
        })
        .join("");

      return `<section class="blog-nav-section">
        <h2>${escapeHtml(section.title)}</h2>
        <ul>${itemsHtml}</ul>
      </section>`;
    })
    .join("");

  return `<aside class="blog-sidebar">
    <div class="blog-sidebar-inner">
      <span class="blog-sidebar-kicker">Explore</span>
      ${sectionsHtml}
    </div>
  </aside>`;
}

function renderMetaLine(doc: Doc): string {
  const parts = [formatPublishedAt(doc.publishedAt), titleCase(doc.category)].filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return `<p class="blog-meta">${parts.map(escapeHtml).join(" · ")}</p>`;
}

function stripLeadingHeading(html: string): string {
  return html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}

function renderBlogLayout(options: BlogLayoutOptions): string {
  const { title, description, body, activePath, baseCss, blogCss, portraitSrc, ogType } = options;
  const blogActive = activePath === "/blog" || activePath.startsWith("/blog/");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:type" content="${ogType ?? "website"}" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <script>${renderThemeSetupScript()}</script>
    <style>${baseCss}</style>
    <style>${blogCss}</style>
  </head>
  <body>
    <div class="page-wrapper page-wrapper-blog">
      <header class="blog-header">
        <div class="header-row">
          <a class="blog-brand" href="/">
            <img src="${portraitSrc}" alt="Jonty Knox" width="60" height="60" />
            <div class="blog-brand-copy">
              <span class="blog-eyebrow">Jonty Knox</span>
              <strong>Blog</strong>
            </div>
          </a>
          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">◐</button>
        </div>
        <p class="blog-intro">
          Notes on AI agents, product taste, company building, and the occasional lesson from restoring an old farmhouse in Tuscany.
        </p>
        <nav class="blog-top-nav" aria-label="Primary">
          <a href="/">Home</a>
          <a href="/blog"${blogActive ? ' aria-current="page"' : ""}>All posts</a>
        </nav>
      </header>
      ${body}
    </div>
    <script>${renderThemeToggleScript()}</script>
  </body>
</html>`;
}

export function renderBlogIndexPage(
  docs: Doc[],
  sections: NavSection[],
  assets: BlogPageAssets,
): string {
  const cardsHtml =
    docs.length === 0
      ? `<article class="blog-card blog-card-empty">
          <h2>No posts yet</h2>
          <p>Add markdown files under <code>content/blog</code> and they will show up here.</p>
        </article>`
      : docs
          .map((doc) => {
            const excerpt = doc.excerpt
              ? `<p class="blog-card-excerpt">${escapeHtml(doc.excerpt)}</p>`
              : "";

            return `<article class="blog-card">
              ${renderMetaLine(doc)}
              <h2><a href="/blog/${escapeAttr(doc.slug)}">${escapeHtml(doc.title)}</a></h2>
              ${excerpt}
              <a class="blog-card-cta" href="/blog/${escapeAttr(doc.slug)}">Read post</a>
            </article>`;
          })
          .join("");

  const body = `<main class="blog-layout">
    ${renderNavigation(sections, "/blog")}
    <section class="blog-main">
      <div class="blog-hero">
        <span class="blog-hero-kicker">Writing</span>
        <h1>Thoughts in public</h1>
        <p>The blog is markdown-backed, routed through the zro app, and intentionally lightweight.</p>
      </div>
      <div class="blog-card-grid">${cardsHtml}</div>
    </section>
  </main>`;

  return renderBlogLayout({
    ...assets,
    activePath: "/blog",
    body,
    description:
      "Writing from Jonty Knox on AI agents, product craft, founder life, and building things with conviction.",
    title: "Blog | Jonty Knox",
  });
}

export function renderBlogPostPage(
  doc: Doc,
  sections: NavSection[],
  assets: BlogPageAssets,
): string {
  const excerpt = doc.excerpt
    ? `<p class="blog-lead">${escapeHtml(doc.excerpt)}</p>`
    : "";
  const prose = stripLeadingHeading(doc.html);

  const body = `<main class="blog-layout">
    ${renderNavigation(sections, `/blog/${doc.slug}`)}
    <article class="blog-main blog-article">
      <a class="blog-back-link" href="/blog">Back to all posts</a>
      ${renderMetaLine(doc)}
      <h1>${escapeHtml(doc.title)}</h1>
      ${excerpt}
      <div class="blog-prose">${prose}</div>
    </article>
  </main>`;

  return renderBlogLayout({
    ...assets,
    activePath: `/blog/${doc.slug}`,
    body,
    description: doc.excerpt ?? `Read ${doc.title} on Jonty Knox's blog.`,
    ogType: "article",
    title: `${doc.title} | Jonty Knox`,
  });
}

export function renderBlogNotFoundPage(assets: BlogPageAssets): string {
  const body = `<main class="blog-layout">
    <section class="blog-main blog-not-found">
      <span class="blog-hero-kicker">404</span>
      <h1>That post has wandered off</h1>
      <p>The page you were looking for does not exist, or the slug has changed.</p>
      <a class="blog-back-link" href="/blog">Browse the blog</a>
    </section>
  </main>`;

  return renderBlogLayout({
    ...assets,
    activePath: "/blog",
    body,
    description: "Blog post not found.",
    title: "Post not found | Jonty Knox",
  });
}
