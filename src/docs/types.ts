export type Doc = {
  slug: string;
  title: string;
  category: string;
  excerpt?: string;
  publishedAt?: string;
  html: string;
};

export type NavSection = {
  title: string;
  items: Array<{ title: string; path: string }>;
};

export type DocError =
  | { kind: "NotFound"; slug: string }
  | { kind: "ParseError"; message: string }
  | { kind: "IOError"; message: string };
