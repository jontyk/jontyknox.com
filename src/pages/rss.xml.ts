import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = (await getCollection("blog")).sort(
    (a, b) => (b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0),
  );

  return rss({
    title: "Jonty Knox — Blog",
    description:
      "Writing from Jonty Knox on AI agents, product craft, founder life, and building things with conviction.",
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.publishedAt,
      categories: [post.data.category],
      link: `/blog/${post.id}`,
    })),
  });
}
