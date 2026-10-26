import { EventEmitter } from "node:events";
import { afterEach, describe, expect, test, vi } from "vitest";
import { logger } from "../../aws/runtime/logging/dt-logger-default.js";
import {
  HttpLogger,
  LoggerFactory,
} from "../../aws/runtime/logging/http-logger.js";
import { WIDE_CONTEXT } from "../../aws/runtime/logging/wide-context.js";

vi.mock("../../aws/runtime/logging/dt-logger-default.js", () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe("HttpLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test("logs response status, metadata, content length, and duration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const infoSpy = vi
      .spyOn(logger, "info")
      .mockImplementation(() => undefined);
    const httpLogger = new HttpLogger({
      context: "Port-call",
      traceId: "trace-123",
      url: "https://example.test/visits/1",
      urlTemplate: "https://example.test/visits/{id}",
    });

    vi.advanceTimersByTime(1250);
    httpLogger.end(200, 512);

    expect(infoSpy).toHaveBeenCalledWith({
      method: "HttpLogger.logStatus",
      [WIDE_CONTEXT.CONTEXT]: "Port-call",
      [WIDE_CONTEXT.TRACE_ID]: "trace-123",
      [WIDE_CONTEXT.HTTP_KEYS.URL]: "https://example.test/visits/1",
      [WIDE_CONTEXT.HTTP_KEYS.URL_TEMPLATE]: "https://example.test/visits/{id}",
      [WIDE_CONTEXT.HTTP_KEYS.ERROR_TYPE]: undefined,
      [WIDE_CONTEXT.HTTP_KEYS.STATUS_CODE]: 200,
      [WIDE_CONTEXT.HTTP_KEYS.DURATION]: 1.25,
      [WIDE_CONTEXT.HTTP_KEYS.CONTENT_LENGTH]: 512,
    });
  });

  test("logs error name and keeps status code unset when request fails", () => {
    const infoSpy = vi
      .spyOn(logger, "info")
      .mockImplementation(() => undefined);
    const httpLogger = new HttpLogger({
      context: "Test",
      url: "https://example.test",
    });

    httpLogger.error(new TypeError("request failed"));

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "HttpLogger.logStatus",
        [WIDE_CONTEXT.CONTEXT]: "Test",
        [WIDE_CONTEXT.HTTP_KEYS.ERROR_TYPE]: "TypeError",
        [WIDE_CONTEXT.HTTP_KEYS.STATUS_CODE]: -1,
        [WIDE_CONTEXT.HTTP_KEYS.CONTENT_LENGTH]: undefined,
      }),
    );
  });

  test.each([
    ["string error", "Connection refused"],
    ["unknown error", { reason: "Connection refused" }],
  ])("classifies %s", (_description, error) => {
    const infoSpy = vi
      .spyOn(logger, "info")
      .mockImplementation(() => undefined);
    const httpLogger = new HttpLogger({
      context: "Test",
      url: "https://example.test",
    });

    httpLogger.error(error);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        [WIDE_CONTEXT.HTTP_KEYS.ERROR_TYPE]:
          typeof error === "string" ? error : "Unknown",
      }),
    );
  });

  test("logs response status and content length from header", () => {
    const infoSpy = vi
      .spyOn(logger, "info")
      .mockImplementation(() => undefined);
    const body = new EventEmitter();
    const response = {
      statusCode: 204,
      headers: { "content-length": "5" },
      body,
    } as unknown as Parameters<HttpLogger["log"]>[0];
    const httpLogger = new LoggerFactory({ context: "Test" }).logger(
      "https://example.test",
    );

    httpLogger.log(response);
    body.emit("end");

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        [WIDE_CONTEXT.HTTP_KEYS.STATUS_CODE]: 204,
        [WIDE_CONTEXT.HTTP_KEYS.CONTENT_LENGTH]: 5,
      }),
    );
  });
});
