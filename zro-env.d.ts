interface FsError {
  kind: "NotFound" | "PermissionDenied" | "IoError" | "Other";
  message: string;
}

interface FileReader extends PromiseLike<Result<string, FsError>> {
  text(): Promise<Result<string, FsError>>;
  bytes(): Promise<Result<Uint8Array, FsError>>;
  json<T = unknown>(): Promise<Result<T, FsError>>;
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
