import type { AfterResponseState, BeforeErrorState, Hooks } from "ky";
import type { Dispatcher } from "undici";
import type { LoggerMethodType } from "./dt-logger.js";
import { logger } from "./dt-logger-default.js";
import { WIDE_CONTEXT } from "./wide-context.js";

const METHOD: LoggerMethodType = "HttpLogger.logStatus" as const;

/**
 * Creates request loggers that share integration-level context.
 *
 * Create one factory for the HTTP integration and use {@link logger} for
 * each outbound request. The optional URL template keeps variable path
 * values out of aggregations while the full URL remains available in logs.
 */
export class LoggerFactory {
  private readonly _context: string;
  private readonly _traceId?: string;
  private readonly _urlTemplate?: string;

  constructor(parameters: {
    context: string;
    traceId?: string;
    urlTemplate?: string;
  }) {
    this._context = parameters.context;
    this._traceId = parameters.traceId;
    this._urlTemplate = parameters.urlTemplate;
  }

  /** Creates a timer and logger for one outbound HTTP request. */
  logger(url: string, urlTemplate?: string): HttpLogger {
    return new HttpLogger({
      context: this._context,
      url,
      traceId: this._traceId,
      urlTemplate: urlTemplate ?? this._urlTemplate,
    });
  }
}

/**
 * Logs the outcome and duration of one outbound HTTP request.
 *
 * Call {@link end} when a response status is available. Call {@link error}
 * when the request fails before a response is received. Each terminal method
 * writes one info-level log entry containing the request context, URL, status
 * or error type, and duration in seconds.
 */
export class HttpLogger {
  private readonly _context: string;
  private readonly _url: string;
  private readonly _urlTemplate?: string;
  private readonly _startTime: number;
  private readonly _traceId?: string;

  private _errorType?: string;
  private _contentLength?: number;
  private _statusCode: number = -1;

  constructor(parameters: {
    context: string;
    url: string;
    traceId?: string;
    urlTemplate?: string;
  }) {
    this._context = parameters.context;
    this._url = parameters.url;
    this._traceId = parameters.traceId;
    this._urlTemplate = parameters.urlTemplate;

    this._startTime = Date.now();
  }

  /** Records a received HTTP response and writes the request log entry. */
  end(statusCode: number, contentLength?: number): void {
    this._statusCode = statusCode;
    this._contentLength = contentLength;

    this.logStatus();
  }

  /** Create hooks for Ky HTTP client using the provided logger */
  createKyHooks(): Hooks {
    return {
      afterResponse: [
        async (state: AfterResponseState) => {
          const contentLengthHeader =
            state.response.headers.get("content-length");

          // use header when available to determine content length
          if (contentLengthHeader) {
            const contentLength = parseInt(contentLengthHeader, 10);
            this.end(state.response.status, contentLength);
            return state.response;
          }
          // create clone from the response, so we can read its body without affecting the original response
          const resp = state.response.clone();
          const contentLength = (await resp.bytes()).length;

          this.end(resp.status, contentLength);

          return state.response;
        },
      ],
      beforeError: [
        (state: BeforeErrorState) => {
          this.error(state.error);

          return state.error;
        },
      ],
    };
  }

  /** Hook logging into undici response events */
  log(response: Dispatcher.ResponseData<unknown>): void {
    this._statusCode = response.statusCode;

    const contentLengthHeader = response.headers["content-length"] as string;
    const contentLength = contentLengthHeader
      ? parseInt(contentLengthHeader, 10)
      : undefined;

    response.body.on("error", (err: unknown) => {
      this.error(err);
    });

    response.body.on("end", () => {
      this.end(response.statusCode, contentLength);
    });
  }

  /**
   * Records a failed request and writes the request log entry.
   *
   * Errors are represented by their name, strings are kept as-is, and
   * other values are recorded as `Unknown`. Since no response was received,
   * the status code remains `-1`.
   */
  error(error: unknown): void {
    if (typeof error === "string") {
      this._errorType = error;
    } else if (error instanceof Error) {
      this._errorType = error.name;
    } else {
      this._errorType = "Unknown";
    }

    this.logStatus();
  }

  private logStatus(): void {
    const endTime = Date.now();

    logger.info({
      method: METHOD,
      [WIDE_CONTEXT.CONTEXT]: this._context,
      [WIDE_CONTEXT.TRACE_ID]: this._traceId,
      [WIDE_CONTEXT.HTTP_KEYS.URL]: this._url,
      [WIDE_CONTEXT.HTTP_KEYS.URL_TEMPLATE]: this._urlTemplate,
      [WIDE_CONTEXT.HTTP_KEYS.ERROR_TYPE]: this._errorType,
      [WIDE_CONTEXT.HTTP_KEYS.STATUS_CODE]: this._statusCode,
      [WIDE_CONTEXT.HTTP_KEYS.DURATION]: (endTime - this._startTime) / 1000,
      [WIDE_CONTEXT.HTTP_KEYS.CONTENT_LENGTH]: this._contentLength,
    });
  }
}
