// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";

const root = new URL(".", import.meta.url);

function lastCommittedAt(...paths) {
  try {
    return execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", ...paths],
      { cwd: root, encoding: "utf8" },
    ).trim() || undefined;
  } catch {
    // Builds without Git metadata can still emit a valid sitemap without lastmod.
    return undefined;
  }
}

const lastModifiedByPath = new Map([
  ["/", lastCommittedAt("src/pages/index.astro")],
  ["/blog", lastCommittedAt("content/blog", "src/pages/blog/index.astro")],
  ["/tools", lastCommittedAt("src/pages/tools/index.astro")],
  ["/tools/fuel", lastCommittedAt("src/pages/tools/fuel.astro")],
]);

for (const file of readdirSync(join(root.pathname, "content/blog"))) {
  if (!file.endsWith(".md")) continue;

  const slug = basename(file, ".md");
  lastModifiedByPath.set(
    `/blog/${slug}`,
    lastCommittedAt(`content/blog/${file}`, "src/pages/blog/[slug].astro"),
  );
}

export default defineConfig({
  site: "https://jontyknox.com",
  trailingSlash: "never",
  integrations: [
    sitemap({
      serialize(item) {
        const path = new URL(item.url).pathname.replace(/\/$/, "") || "/";
        item.lastmod = lastModifiedByPath.get(path);
        return item;
      },
    }),
  ],
});
