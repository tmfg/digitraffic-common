import ky, { HTTPError } from "ky";
import type { Dispatcher } from "undici";
import { describe, expect, test, vi } from "vitest";
import {
  createKyHooks,
  createLoggingInterceptor,
} from "../../aws/runtime/logging/http-interceptors.js";
import { HttpLogger } from "../../aws/runtime/logging/http-logger.js";

type AnyFn = (...args: unknown[]) => unknown;

interface WrappedHandler {
  onRequestStart?: AnyFn;
  onResponseStart?: AnyFn;
  onResponseData?: AnyFn;
  onResponseEnd?: AnyFn;
  onResponseError?: AnyFn;
}

function mockHttpLogger() {
  return {
    start: vi.fn(),
    logResponse: vi.fn(),
    logError: vi.fn(),
  };
}

function asHttpLogger(mock: ReturnType<typeof mockHttpLogger>): HttpLogger {
  return mock as unknown as HttpLogger;
}

/** Runs the interceptor and returns the handler it passed on to the next dispatch. */
function intercept(
  httpLogger: ReturnType<typeof mockHttpLogger>,
  innerHandler: Record<string, unknown>,
) {
  const dispatch = vi.fn(() => true);
  const interceptor = createLoggingInterceptor(asHttpLogger(httpLogger));
  interceptor(dispatch as unknown as Dispatcher.Dispatch)(
    {} as Dispatcher.DispatchOptions,
    innerHandler as unknown as Dispatcher.DispatchHandler,
  );

  expect(dispatch).toHaveBeenCalledTimes(1);

  return (dispatch.mock.calls[0] as unknown[])[1] as WrappedHandler;
}

// Prototype methods are not own properties, as with undici's real handlers
class InnerHandler {
  onRequestStart = vi.fn();
  onResponseStart = vi.fn();
  onResponseData = vi.fn();
  onResponseEnd = vi.fn();
  onResponseError = vi.fn();
}

describe("createLoggingInterceptor", () => {
  const controller = {};

  test("exposes onRequestStart so undici accepts the handler", () => {
    const wrapped = intercept(mockHttpLogger(), new InnerHandler() as never);

    expect(typeof wrapped.onRequestStart).toBe("function");
  });

  test("starts the timer and delegates onRequestStart", () => {
    const httpLogger = mockHttpLogger();
    const inner = new InnerHandler();
    const wrapped = intercept(httpLogger, inner as never);

    wrapped.onRequestStart?.(controller, { ctx: 1 });

    expect(httpLogger.start).toHaveBeenCalledTimes(1);
    expect(inner.onRequestStart).toHaveBeenCalledWith(controller, { ctx: 1 });
  });

  test("logs status captured at response start when the response ends", () => {
    const httpLogger = mockHttpLogger();
    const inner = new InnerHandler();
    const wrapped = intercept(httpLogger, inner as never);

    const headers = {};

    wrapped.onResponseStart?.(controller, 404, headers, "Not Found");
    wrapped.onResponseData?.(controller, Buffer.alloc(42));
    wrapped.onResponseEnd?.(controller, {});

    expect(inner.onResponseStart).toHaveBeenCalledWith(
      controller,
      404,
      headers,
      "Not Found",
    );
    expect(httpLogger.logResponse).toHaveBeenCalledWith(404, 42);
    expect(inner.onResponseEnd).toHaveBeenCalledWith(controller, {});
  });

  test("logs counted bytes regardless of the content-length header", () => {
    const httpLogger = mockHttpLogger();
    const wrapped = intercept(httpLogger, new InnerHandler() as never);

    wrapped.onResponseStart?.(controller, 200, { "content-length": "999" });
    wrapped.onResponseData?.(controller, Buffer.from("abc"));
    wrapped.onResponseEnd?.(controller, {});

    expect(httpLogger.logResponse).toHaveBeenCalledWith(200, 3);
  });

  test("counts bytes of chunked responses and forwards each chunk", () => {
    const httpLogger = mockHttpLogger();
    const inner = new InnerHandler();
    const wrapped = intercept(httpLogger, inner as never);
    const first = Buffer.from("hello");
    const second = Buffer.from("world!");

    wrapped.onResponseStart?.(controller, 200, {});
    wrapped.onResponseData?.(controller, first);
    wrapped.onResponseData?.(controller, second);
    wrapped.onResponseEnd?.(controller, {});

    expect(inner.onResponseData).toHaveBeenNthCalledWith(1, controller, first);
    expect(inner.onResponseData).toHaveBeenNthCalledWith(2, controller, second);
    expect(httpLogger.logResponse).toHaveBeenCalledWith(200, 11);
  });

  test("logs zero length for an empty body without header", () => {
    const httpLogger = mockHttpLogger();
    const wrapped = intercept(httpLogger, new InnerHandler() as never);

    wrapped.onResponseStart?.(controller, 204, {});
    wrapped.onResponseEnd?.(controller, {});

    expect(httpLogger.logResponse).toHaveBeenCalledWith(204, 0);
  });

  test("logs errors and delegates onResponseError", () => {
    const httpLogger = mockHttpLogger();
    const inner = new InnerHandler();
    const wrapped = intercept(httpLogger, inner as never);
    const error = new Error("boom");

    wrapped.onResponseError?.(controller, error);

    expect(httpLogger.logError).toHaveBeenCalledWith(error);
    expect(httpLogger.logResponse).not.toHaveBeenCalled();
    expect(inner.onResponseError).toHaveBeenCalledWith(controller, error);
  });

  test("keeps status per handler instance", () => {
    const httpLogger = mockHttpLogger();
    const first = intercept(httpLogger, new InnerHandler() as never);
    const second = intercept(httpLogger, new InnerHandler() as never);

    first.onResponseStart?.(controller, 200, {});
    second.onResponseStart?.(controller, 500, {});
    first.onResponseData?.(controller, Buffer.from("a"));
    second.onResponseData?.(controller, Buffer.from("bb"));
    first.onResponseEnd?.(controller, {});
    second.onResponseEnd?.(controller, {});

    expect(httpLogger.logResponse).toHaveBeenNthCalledWith(1, 200, 1);
    expect(httpLogger.logResponse).toHaveBeenNthCalledWith(2, 500, 2);
  });
});

describe("createKyHooks", () => {
  function hook(
    name: "beforeRequest" | "beforeRetry" | "afterResponse" | "beforeError",
  ) {
    const httpLogger = mockHttpLogger();
    const hooks = createKyHooks(asHttpLogger(httpLogger));
    const fn = hooks[name]?.[0] as unknown as AnyFn;

    return { httpLogger, fn };
  }

  test.each(["beforeRequest", "beforeRetry"] as const)(
    "%s starts the timer and returns the request",
    (name) => {
      const { httpLogger, fn } = hook(name);
      const request = new Request("https://example.com");

      expect(fn({ request })).toBe(request);
      expect(httpLogger.start).toHaveBeenCalledTimes(1);
    },
  );

  test("beforeRetry logs the failed attempt without a response before starting the timer again", () => {
    const { httpLogger, fn } = hook("beforeRetry");
    const request = new Request("https://example.com");
    const error = new TypeError("fetch failed");

    expect(fn({ request, error, retryCount: 1 })).toBe(request);
    expect(httpLogger.logError).toHaveBeenCalledWith(error, {
      endTime: undefined,
      resendCount: 0,
    });
    expect(httpLogger.logError.mock.invocationCallOrder[0]).toBeLessThan(
      httpLogger.start.mock.invocationCallOrder[0] ?? 0,
    );
  });

  test("beforeRetry does not log a retried HTTPError again after afterResponse logged it", () => {
    const { httpLogger, fn } = hook("beforeRetry");
    const request = new Request("https://example.com");
    const error = new HTTPError(
      new Response(null, { status: 503 }),
      request,
      {} as never,
    );

    expect(fn({ request, error })).toBe(request);
    expect(httpLogger.logError).not.toHaveBeenCalled();
    expect(httpLogger.start).toHaveBeenCalledTimes(1);
  });

  test("afterResponse uses content-length header without reading the body", async () => {
    const { httpLogger, fn } = hook("afterResponse");
    const response = new Response("hello", {
      status: 200,
      headers: { "content-length": "5" },
    });
    const cloneSpy = vi.spyOn(response, "clone");

    const result = await fn({ response, retryCount: 0 });

    expect(result).toBe(response);
    expect(httpLogger.logResponse).toHaveBeenCalledWith(200, 5, 0);
    expect(cloneSpy).not.toHaveBeenCalled();
  });

  test("afterResponse leaves length unknown when header is missing and keeps body readable", async () => {
    const { httpLogger, fn } = hook("afterResponse");
    const response = new Response("hello", { status: 201 });
    const cloneSpy = vi.spyOn(response, "clone");

    const result = (await fn({ response, retryCount: 1 })) as Response;

    // The body must not be read just for logging. Buffering it would hold
    // the whole payload in memory and block streaming consumers.
    expect(httpLogger.logResponse).toHaveBeenCalledWith(201, undefined, 1);
    expect(cloneSpy).not.toHaveBeenCalled();
    expect(await result.text()).toBe("hello");
  });

  test("beforeError logs and returns non-HTTP errors", () => {
    const { httpLogger, fn } = hook("beforeError");
    const error = new Error("failed");

    expect(fn({ error, retryCount: 2 })).toBe(error);
    expect(httpLogger.logError).toHaveBeenCalledWith(error, {
      endTime: undefined,
      resendCount: 2,
    });
  });

  test("beforeError does not log HTTPError again after afterResponse logged it", () => {
    const { httpLogger, fn } = hook("beforeError");
    const error = new HTTPError(
      new Response(null, { status: 500 }),
      new Request("https://example.com"),
      {} as never,
    );

    expect(fn({ error })).toBe(error);
    expect(httpLogger.logError).not.toHaveBeenCalled();
  });
});

describe("createKyHooks with ky", () => {
  const URL = "https://example.com/visits/1";
  const networkError = () => Promise.reject(new TypeError("fetch failed"));

  function request(fetch: () => Promise<Response>) {
    const httpLogger = mockHttpLogger();
    const promise = ky.get(URL, {
      fetch,
      hooks: createKyHooks(asHttpLogger(httpLogger)),
      retry: { limit: 2, delay: () => 0 },
    });
    return { httpLogger, promise };
  }

  test("logs a network error and the successful retry, one log per attempt", async () => {
    const fetch = vi
      .fn<() => Promise<Response>>()
      .mockImplementationOnce(networkError)
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const { httpLogger, promise } = request(fetch);

    await promise;

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(httpLogger.logError).toHaveBeenCalledTimes(1);
    expect(httpLogger.logError.mock.calls[0]?.[1]).toMatchObject({
      resendCount: 0,
    });
    expect(httpLogger.logResponse).toHaveBeenCalledTimes(1);
    expect(httpLogger.logResponse).toHaveBeenCalledWith(200, undefined, 1);
  });

  test("logs every failed attempt when the retries run out", async () => {
    const fetch = vi.fn<() => Promise<Response>>(networkError);
    const { httpLogger, promise } = request(fetch);

    await expect(promise).rejects.toThrow();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(
      httpLogger.logError.mock.calls.map(
        (c) => (c[1] as { resendCount?: number }).resendCount,
      ),
    ).toEqual([0, 1, 2]);
    expect(httpLogger.logResponse).not.toHaveBeenCalled();
  });

  test("logs a retried HTTP status once per attempt", async () => {
    const fetch = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const { httpLogger, promise } = request(fetch);

    await promise;

    expect(httpLogger.logResponse.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      [503, 0],
      [200, 1],
    ]);
    expect(httpLogger.logError).not.toHaveBeenCalled();
  });

  test("leaves the retry delay out of the duration of a failed attempt", async () => {
    const RETRY_DELAY_MS = 300;
    const fetch = vi
      .fn<() => Promise<Response>>()
      .mockImplementationOnce(networkError)
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const httpLogger = new HttpLogger({ context: "Test", url: URL });
    const logErrorSpy = vi.spyOn(httpLogger, "logError");
    const startedAt = Date.now();

    await ky.get(URL, {
      fetch,
      hooks: createKyHooks(httpLogger),
      retry: { limit: 1, delay: () => RETRY_DELAY_MS },
    });

    const options = logErrorSpy.mock.calls[0]?.[1] as
      | { endTime?: number }
      | undefined;
    const endTime = options?.endTime;
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(RETRY_DELAY_MS);
    expect(endTime).toBeDefined();
    expect((endTime ?? 0) - startedAt).toBeLessThan(RETRY_DELAY_MS);
  });
});
