// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://jontyknox.com",
  trailingSlash: "never",
  integrations: [sitemap({ filter: (page) => !page.includes("/fuel") })],
});
