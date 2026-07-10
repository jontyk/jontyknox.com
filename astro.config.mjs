// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://jontyknox.com",
  trailingSlash: "never",
  redirects: {
    "/fuel": "/tools/fuel",
  },
  integrations: [sitemap()],
});
