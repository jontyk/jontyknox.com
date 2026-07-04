import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./content/blog" }),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    excerpt: z.string().optional(),
    publishedAt: z.coerce.date().optional(),
  }),
});

export const collections = { blog };
