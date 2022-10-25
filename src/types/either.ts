export type EitherOk<T> = { result: "ok"; value: T };
export type EitherError = { result: "error"; message: string };
export type Either<T> = EitherOk<T> | EitherError;
