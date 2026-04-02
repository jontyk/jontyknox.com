import type { Doc, NavSection } from "../docs/mod.ts";
import { getDoc, getNavigation, listDocs } from "../docs/mod.ts";
import { renderBlogIndexPage, renderBlogNotFoundPage, renderBlogPostPage } from "./blog.ts";

const contentTypes: Record<string, string> = {
  css: "text/css; charset=utf-8",
  ico: "image/x-icon",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  json: "application/json; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  webmanifest: "application/manifest+json; charset=utf-8",
  webp: "image/webp",
  woff2: "font/woff2",
};

type BlogShellAssets = {
  baseCss: string;
  blogCss: string;
  portraitSrc: string;
};

function normalizePathname(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }

  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

async function readTextFile(path: string): Promise<string> {
  const file = await zro.fs.read(path).text();

  return match(file, {
    Ok: (content) => content,
    Err: () => "",
  });
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1] ?? 0;
    const byte3 = bytes[index + 2] ?? 0;
    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;

    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[chunk & 63] : "=";
  }

  return output;
}

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return contentTypes[ext] ?? "application/octet-stream";
}

function resolvePublicAssetPath(pathname: string): string | null {
  const relativePath = pathname.replace(/^\/+/, "");

  if (!relativePath || relativePath.includes("..") || relativePath.includes("\\")) {
    return null;
  }

  const blogScopedAsset = relativePath.match(
    /^blog\/(favicon\.ico|favicon-16x16\.png|favicon-32x32\.png|apple-touch-icon\.png|android-chrome-192x192\.png|android-chrome-512x512\.png|site\.webmanifest)$/,
  );

  if (blogScopedAsset) {
    return blogScopedAsset[1];
  }

  return relativePath;
}

async function readAssetDataUrl(path: string): Promise<string> {
  const file = await zro.fs.read(path).bytes();
  const mimeType = contentTypeFor(path);

  return match(file, {
    Ok: (bytes) => `data:${mimeType};base64,${encodeBase64(bytes)}`,
    Err: () => "",
  });
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function fallbackNavigation(docs: Doc[]): NavSection[] {
  if (docs.length === 0) {
    return [];
  }

  return [
    {
      title: "Posts",
      items: docs.map((doc) => ({
        title: doc.title,
        path: `/blog/${doc.slug}`,
      })),
    },
  ];
}

function resolveNavigation(navResult: Result<NavSection[], unknown>, docs: Doc[]): NavSection[] {
  return match(navResult, {
    Ok: (nav) => nav,
    Err: () => fallbackNavigation(docs),
  });
}

async function loadBlogShellAssets(): Promise<BlogShellAssets> {
  const [baseCss, blogCss, portraitSrc] = await Promise.all([
    readTextFile("public/styles/base.css"),
    readTextFile("public/styles/blog.css"),
    readAssetDataUrl("public/images/jonty-knox.jpg"),
  ]);

  return {
    baseCss,
    blogCss,
    portraitSrc,
  };
}

async function renderPage(): Promise<string> {
  const [
    baseCss,
    homeCss,
    portraitSrc,
    reflectionSrc,
    formalSrc,
    officeSrc,
    ycSrc,
    westminsterSrc,
  ] = await Promise.all([
    readTextFile("public/styles/base.css"),
    readTextFile("public/styles/home.css"),
    readAssetDataUrl("public/images/jonty-knox.jpg"),
    readAssetDataUrl("public/images/jonty-knox-reflection.jpg"),
    readAssetDataUrl("public/images/jonty-knox-formal.jpg"),
    readAssetDataUrl("public/images/jonty-knox-office.jpg"),
    readAssetDataUrl("public/images/jonty-knox-yc-retreat.jpg"),
    readAssetDataUrl("public/images/jonty-knox-westminster.jpg"),
  ]);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Jonty Knox</title>
    <meta
      name="description"
      content="Jonty Knox is an Australian software entrepreneur, engineer, designer, and Co-founder of CustomerOS."
    />
    <meta property="og:title" content="Jonty Knox" />
    <meta
      property="og:description"
      content="Jonty Knox is an Australian software entrepreneur, engineer, designer, and Co-founder of CustomerOS."
    />
    <meta property="og:type" content="website" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <script>
      (function () {
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
      })();
    </script>
    <style>${baseCss}</style>
    <style>${homeCss}</style>
  </head>
  <body>
    <div class="page-wrapper">
      <header>
        <div class="header-row">
          <img src="${portraitSrc}" alt="Jonty Knox" width="60" height="60" />
          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">◐</button>
        </div>
        <h1>Jonty Knox</h1>
        <h2 class="subheading">Australian software entrepreneur</h2>
      </header>

      <main>
        <section>
          <ul class="list-disc pl-6">
            <li>
              Co-founder of <a href="https://customeros.ai" target="_blank" rel="noreferrer">CustomerOS</a>
            </li>
            <li>
              Building AI sales, marketing and customer success agents with
              <a href="https://mateocafe.com/" target="_blank" rel="noreferrer"> Matt Brown</a>
            </li>
            <li>
              Y Combinator graduate
              (<a href="https://www.ycombinator.com/companies/customeros" target="_blank" rel="noreferrer">Summer 2022</a>)
            </li>
            <li>
              Previously Head of Product at Voxbone,
              <a
                href="https://www.bandwidth.com/blog/bandwidth-to-acquire-international-communications-leader-voxbone/"
                target="_blank"
                rel="noreferrer"
              >
                sold to Bandwidth for US$519M in 2020
              </a>
            </li>
            <li>
              Previously ran Product at
              <a href="https://ottofinance.io" target="_blank" rel="noreferrer"> Otto</a>,
              a Sequoia backed company
            </li>
            <li>Angel investor in 20+ pre-seed companies</li>
            <li>
              Based between
              <a href="https://maps.app.goo.gl/s9d7TS4SyS7sNhcA9" target="_blank" rel="noreferrer"> London, UK</a>
              and <a href="#italy-project">Tuscany, Italy</a>
            </li>
            <li><a href="mailto:jonty@customeros.ai?subject=Sliding%20into%20your%20DMs">jonty@customeros.ai</a></li>
          </ul>
        </section>

        <section>
          <h2>Bio</h2>
          <span class="section-note">For event organizers, journalists, and podcast hosts to copy-paste.</span>
          <blockquote>
            <span>
              Jonty Knox is an Australian entrepreneur and the co-founder of CustomerOS, a Y Combinator-backed company building AI agents for enterprise sales and marketing teams. Previously, he was Head of Product at Voxbone, which was acquired by Bandwidth for $519M in 2020. He is passionate about using AI to transform customer interactions to be a pleasure every single time.
            </span>
          </blockquote>
        </section>

        <section>
          <h2>Awards</h2>
          <ul class="list-disc pl-6">
            <li>
              <a href="https://www.notion.vc/cloud-challengers-2023/top-100-b2b" target="_blank" rel="noreferrer">
                2023 Notion VC's B2B Software 100 List
              </a>
              : #1 upcoming B2B SaaS company
            </li>
            <li>
              <a
                href="https://www.uctoday.com/unified-communications/introducing-your-uc-awards-2021-winners/"
                target="_blank"
                rel="noreferrer"
              >
                2021 UC Awards
              </a>
              : Most Innovative Product
            </li>
            <li>
              <a
                href="https://www.ispreview.co.uk/index.php/2020/09/itspa-reveal-the-2020-best-uk-voip-provider-award-winners.html"
                target="_blank"
                rel="noreferrer"
              >
                2020 ITSPA Awards
              </a>
              : Best VoIP Innovation
            </li>
            <li>
              <a
                href="https://www.capacitymedia.com/article/29otbtelon5a9qh3hqfwg/news/the-winners-of-the-2019-global-carrier-awards-are-announced"
                target="_blank"
                rel="noreferrer"
              >
                2019 Global Carrier Awards
              </a>
              : Best Voice Service Innovation - Mature Market
            </li>
          </ul>
        </section>

        <section>
          <h2>Talks</h2>
          <p>
            Jonty has talked at prestigious locations globally as both a keynote speaker and panelist, at events in King's College, London and with Amazon's AWS.
          </p>
        </section>

        <section id="italy-project">
          <h2>Interests</h2>
          <ul class="list-disc pl-6">
            <li>AI and machine learning, particularly in natural language processing and agent design</li>
            <li>Product strategy and go-to-market execution in B2B SaaS</li>
            <li>Enabling high-performance remote teams</li>
            <li>Running, weight-lifting & playing music</li>
            <li>Currently <a href="#italy-project">restoring and renovating a 200+ year old farm house</a> in Tuscany, Italy.</li>
            <li>Maintaining a few aging (modern) classic cars</li>
          </ul>
        </section>

        <section>
          <h2>Media</h2>
          <div class="grid">
            <figure>
              <img class="gridImage" src="${reflectionSrc}" alt="Jonty Knox headshot" width="400" height="200" />
              <figcaption>Introducing the world to CustomerOS AI Agents in 2024</figcaption>
            </figure>
            <figure>
              <img class="gridImage" src="${formalSrc}" alt="Jonty Knox in traditional Scottish black tie" width="400" height="200" />
              <figcaption>Jonty in traditional Scottish black tie (kilt not pictured)</figcaption>
            </figure>
            <figure>
              <img class="gridImage" src="${officeSrc}" alt="Jonty Knox speaking about CustomerOS product strategy" width="400" height="200" />
              <figcaption>Speaking about CustomerOS's product strategy</figcaption>
            </figure>
            <figure>
              <img class="gridImage" src="${ycSrc}" alt="Jonty Knox at YC S22 Batch Kickoff in Sonoma" width="400" height="200" />
              <figcaption>Attending the YC S22 Batch Kickoff in Sonoma, California</figcaption>
            </figure>
            <figure>
              <img class="gridImage" src="${westminsterSrc}" alt="Jonty Knox visiting Westminster" width="400" height="200" />
              <figcaption>Visiting Westminster to meet with the UK's Investment Minister</figcaption>
            </figure>
          </div>
        </section>

        <section>
          <h2>Links</h2>
          <ul class="list-disc pl-6">
            <li><a href="/blog">Blog</a></li>
            <li><a href="https://x.com/jontyknox" target="_blank" rel="noreferrer">Twitter/X</a></li>
            <li><a href="https://www.linkedin.com/in/jontyknox/" target="_blank" rel="noreferrer">LinkedIn</a></li>
            <li><a href="https://github.com/jontyk" target="_blank" rel="noreferrer">Github</a></li>
            <li><a href="https://www.crunchbase.com/person/jonty-knox" target="_blank" rel="noreferrer">Crunchbase</a></li>
            <li><a href="https://www.ycombinator.com/companies/customeros" target="_blank" rel="noreferrer">Y Combinator</a></li>
            <li><a href="https://www.producthunt.com/@jontyk" target="_blank" rel="noreferrer">ProductHunt</a></li>
          </ul>
        </section>
      </main>
    </div>
    <script>
      (function () {
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
      })();
    </script>
  </body>
</html>`;
}

async function serveStaticAsset(pathname: string): Promise<Response | null> {
  const relativePath = resolvePublicAssetPath(pathname);

  if (!relativePath) {
    return null;
  }

  const file = await zro.fs.read(`public/${relativePath}`).bytes();

  return match(file, {
    Ok: (bytes) =>
      new Response(bytes, {
        headers: {
          "cache-control": "public, max-age=3600",
          "content-type": contentTypeFor(relativePath),
        },
      }),
    Err: () => null,
  });
}

async function routeBlogIndex(): Promise<Response> {
  const [docsResult, navResult, assets] = await Promise.all([
    listDocs(),
    getNavigation(),
    loadBlogShellAssets(),
  ]);

  const docs = match(docsResult, {
    Ok: (items) => items,
    Err: () => [] as Doc[],
  });
  const nav = resolveNavigation(navResult, docs);

  return htmlResponse(renderBlogIndexPage(docs, nav, assets));
}

async function routeBlogPost(slug: string): Promise<Response> {
  const [docResult, docsResult, navResult, assets] = await Promise.all([
    getDoc(slug),
    listDocs(),
    getNavigation(),
    loadBlogShellAssets(),
  ]);

  const docs = match(docsResult, {
    Ok: (items) => items,
    Err: () => [] as Doc[],
  });
  const nav = resolveNavigation(navResult, docs);

  return match(docResult, {
    Ok: (doc) => htmlResponse(renderBlogPostPage(doc, nav, assets)),
    Err: (err) => {
      if (err.kind === "NotFound") {
        return htmlResponse(renderBlogNotFoundPage(assets), 404);
      }

      return new Response("Server error", { status: 500 });
    },
  });
}

zro.serve({
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathname = normalizePathname(url.pathname);
    const asset = await serveStaticAsset(pathname);

    if (asset) {
      return asset;
    }

    if (pathname === "/") {
      return htmlResponse(await renderPage());
    }

    if (pathname === "/blog") {
      return routeBlogIndex();
    }

    if (pathname.startsWith("/blog/")) {
      const slug = pathname.replace(/^\/blog\//, "");
      return routeBlogPost(slug);
    }

    return new Response("Not found", { status: 404 });
  },
});
