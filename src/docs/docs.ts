import type { Doc, DocError, NavSection } from "./types.ts";

type MarkdownDocument = {
  meta: Record<string, unknown>;
  html: string;
};

const BLOG_CONTENT_ROOT = "content/blog";

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function slugFromPath(path: string): string | null {
  if (!path.startsWith("/blog/")) {
    return null;
  }

  const slug = path.replace(/^\/blog\//, "").replace(/\/+$/, "");

  if (!slug || slug.includes("..") || slug.includes("\\")) {
    return null;
  }

  return slug;
}

function parseDoc(slug: string, content: MarkdownDocument): Result<Doc, DocError> {
  const title = normalizeString(content.meta.title);

  if (!title) {
    return Err({
      kind: "ParseError",
      message: `missing or invalid title in frontmatter for ${slug}`,
    });
  }

  return Ok({
    slug,
    title,
    category: normalizeString(content.meta.category) ?? "notes",
    excerpt: normalizeString(content.meta.excerpt),
    publishedAt: normalizeString(content.meta.publishedAt),
    html: content.html,
  });
}

export async function getDoc(slug: string): Promise<Result<Doc, DocError>> {
  if (!slug || slug.includes("..") || slug.includes("\\")) {
    return Err({ kind: "NotFound", slug });
  }

  const docPath = `${BLOG_CONTENT_ROOT}/${slug}.md`;
  const file = await zro.fs.read(docPath).md();

  return match(file, {
    Ok: (content) => parseDoc(slug, content),
    Err: (err) => {
      if (err.kind === "NotFound") {
        return Err({ kind: "NotFound", slug });
      }

      return Err({ kind: "IOError", message: err.message });
    },
  });
}

function compareDocs(a: Doc, b: Doc): number {
  const aTime = a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN;
  const bTime = b.publishedAt ? Date.parse(b.publishedAt) : Number.NaN;
  const aHasDate = Number.isFinite(aTime);
  const bHasDate = Number.isFinite(bTime);

  if (aHasDate && bHasDate && aTime !== bTime) {
    return bTime - aTime;
  }

  if (aHasDate && !bHasDate) {
    return -1;
  }

  if (!aHasDate && bHasDate) {
    return 1;
  }

  return a.title.localeCompare(b.title);
}

async function listDocsFromNavigation(): Promise<Result<Doc[], DocError>> {
  const navResult = await getNavigation();

  return match(navResult, {
    Ok: async (sections) => {
      const docs: Doc[] = [];
      const seen = new Set<string>();

      for (const section of sections) {
        for (const item of section.items) {
          const slug = slugFromPath(item.path);

          if (!slug || seen.has(slug)) {
            continue;
          }

          seen.add(slug);

          const docResult = await getDoc(slug);

          match(docResult, {
            Ok: (doc) => docs.push(doc),
            Err: () => undefined,
          });
        }
      }

      if (docs.length === 0) {
        return Err({
          kind: "IOError",
          message: "no blog posts could be loaded from navigation",
        });
      }

      docs.sort(compareDocs);

      return Ok(docs);
    },
    Err: (err) => Err(err),
  });
}

export async function listDocs(): Promise<Result<Doc[], DocError>> {
  const navDocsResult = await listDocsFromNavigation();

  if (navDocsResult.isOk()) {
    return navDocsResult;
  }

  const docs: Doc[] = [];
  const errors: DocError[] = [];

  async function walk(dirPath: string): Promise<void> {
    const entriesResult = await zro.fs.readDir(dirPath);

    await match(entriesResult, {
      Ok: async (entries) => {
        for (const entry of entries) {
          const fullPath = `${dirPath}/${entry.name}`;

          if (entry.isDirectory) {
            await walk(fullPath);
            continue;
          }

          if (!entry.isFile || !entry.name.endsWith(".md")) {
            continue;
          }

          const slug = fullPath.replace(`${BLOG_CONTENT_ROOT}/`, "").replace(/\.md$/, "");
          const docResult = await getDoc(slug);

          match(docResult, {
            Ok: (doc) => docs.push(doc),
            Err: (err) => errors.push(err),
          });
        }
      },
      Err: (err) => {
        errors.push({ kind: "IOError", message: err.message });
      },
    });
  }

  await walk(BLOG_CONTENT_ROOT);

  if (errors.length > 0 && docs.length === 0) {
    return Err(errors[0]);
  }

  docs.sort(compareDocs);

  return Ok(docs);
}

export async function getNavigation(): Promise<Result<NavSection[], DocError>> {
  const navFile = await zro.fs.read(`${BLOG_CONTENT_ROOT}/nav.json`).json<NavSection[]>();

  return match(navFile, {
    Ok: (data) => Ok(data),
    Err: (err) => Err({ kind: "IOError", message: err.message }),
  });
}
