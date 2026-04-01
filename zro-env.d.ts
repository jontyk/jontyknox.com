interface FsError {
  kind: "NotFound" | "PermissionDenied" | "IoError" | "Other";
  message: string;
}

interface MarkdownDocument {
  meta: Record<string, unknown>;
  html: string;
}

interface FileReader extends PromiseLike<Result<string, FsError>> {
  text(): Promise<Result<string, FsError>>;
  bytes(): Promise<Result<Uint8Array, FsError>>;
  json<T = unknown>(): Promise<Result<T, FsError>>;
  md(): Promise<Result<MarkdownDocument, FsError>>;
  toml<T = unknown>(): Promise<Result<T, FsError>>;
}

interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

interface FileInfo {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

interface Result<T, E> {
  readonly _tag: "Ok" | "Err";
  readonly _value: T | E;
  isOk(): boolean;
  isErr(): boolean;
  unwrap(): T;
  unwrapErr(): E;
  unwrapOr<U>(def: U): T | U;
}

declare function Ok<T>(value: T): Result<T, never>;
declare function Err<E>(error: E): Result<never, E>;

declare function match<T, E, R1, R2 = R1>(
  value: Result<T, E>,
  patterns: { Ok: (value: T) => R1; Err: (error: E) => R2 }
): R1 | R2;

interface ServeOptions {
  fetch: (req: Request) => Response | Promise<Response>;
  port?: number;
}

declare const zro: {
  serve(handler: ((req: Request) => Response | Promise<Response>) | ServeOptions): Promise<never>;
  readonly fs: {
    read(path: string): FileReader;
    readDir(path: string): Promise<Result<DirEntry[], FsError>>;
    stat(path: string): Promise<Result<FileInfo, FsError>>;
    exists(path: string): Promise<Result<boolean, FsError>>;
  };
};

declare module "zro:docs" {
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

  export function getDoc(slug: string): Promise<Result<Doc, DocError>>;
  export function listDocs(): Promise<Result<Doc[], DocError>>;
  export function getNavigation(): Promise<Result<NavSection[], DocError>>;
}
