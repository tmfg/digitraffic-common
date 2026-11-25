import type {
  AfterResponseState,
  BeforeErrorState,
  BeforeRequestState,
  BeforeRetryState,
  Hooks,
  Options,
} from "ky";
import { HTTPError, isForceRetryError, isHTTPError } from "ky";
import type { Dispatcher } from "undici";
import { DecoratorHandler } from "undici";
import type { IncomingHttpHeaders } from "undici/types/header.js";
import type { HttpLogger } from "./http-logger.js";

// undici's DecoratorHandler typings omit the methods it implements at runtime
const TypedDecoratorHandler = DecoratorHandler as unknown as new (
  handler: Dispatcher.DispatchHandler,
) => Dispatcher.DispatchHandler;

function parseContentLengthFromHeader(
  headerValue?: string | string[] | null,
): number | undefined {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const length = value ? parseInt(value, 10) : Number.NaN;

  return Number.isNaN(length) ? undefined : length;
}

/**
 * Create an Undici interceptor that logs HTTP requests and responses using the provided HttpLogger.
 */
export function createLoggingInterceptor(
  httpLogger: HttpLogger,
): Dispatcher.DispatcherComposeInterceptor {
  class LoggingHandler extends TypedDecoratorHandler {
    _statusCode: number | undefined;
    _receivedBytes: number = 0;

    override onRequestStart(
      controller: Dispatcher.DispatchController,
      context: unknown,
    ): void {
      httpLogger.start();
      super.onRequestStart?.(controller, context);
    }

    override onResponseStart(
      controller: Dispatcher.DispatchController,
      statusCode: number,
      headers: IncomingHttpHeaders,
      statusMessage?: string,
    ): void {
      this._statusCode = statusCode;

      super.onResponseStart?.(controller, statusCode, headers, statusMessage);
    }

    override onResponseData(
      controller: Dispatcher.DispatchController,
      chunk: Buffer,
    ): void {
      this._receivedBytes += chunk.length;

      super.onResponseData?.(controller, chunk);
    }

    override onResponseEnd(
      controller: Dispatcher.DispatchController,
      trailers: IncomingHttpHeaders,
    ): void {
      if (this._statusCode !== undefined) {
        httpLogger.logResponse(this._statusCode, this._receivedBytes);
      }

      super.onResponseEnd?.(controller, trailers);
    }

    override onResponseError(
      controller: Dispatcher.DispatchController,
      error: Error,
    ): void {
      httpLogger.logError(error);

      super.onResponseError?.(controller, error);
    }
  }

  return (dispatch: Dispatcher.Dispatch) => {
    return (
      options: Dispatcher.DispatchOptions,
      handler: Dispatcher.DispatchHandler,
    ) => {
      return dispatch(options, new LoggingHandler(handler));
    };
  };
}

/**
 * Create hooks for Ky HTTP client using the provided logger. Every attempt, including retries, is logged once:
 * - afterResponse: an attempt that got a response, also an HTTP error status that is retried
 * - beforeRetry: an attempt that failed without a response (network error, timeout) and is retried
 * - beforeError: the last attempt that failed without a response
 *
 * The resend count is ky's retry count (not logged for the first attempt). The duration of a failed attempt ends
 * when the request failed, not after the retry delay: ky runs beforeRetry only after the delay, so the init hook
 * wraps fetch to record the failure time.
 *
 * Create the hooks and the logger for each request. They keep the timer and the failure time of one request,
 * so sharing them between concurrent requests (e.g. with ky.extend) would mix the timings.
 */
export function createKyHooks(httpLogger: HttpLogger): Hooks {
  // When the current attempt failed without a response. Ky runs beforeRetry only after the retry delay,
  // so the failure is timed here to leave the delay out of the attempt duration.
  let failedAt: number | undefined;

  const startAttempt = (): void => {
    failedAt = undefined;
    httpLogger.start();
  };

  return {
    init: [
      (options: Options) => {
        const fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
        options.fetch = async (input, init) => {
          try {
            return await fetch(input, init);
          } catch (error) {
            failedAt = Date.now();
            throw error;
          }
        };
      },
    ],
    beforeRequest: [
      (state: BeforeRequestState) => {
        startAttempt();
        return state.request;
      },
    ],
    beforeRetry: [
      (state: BeforeRetryState) => {
        // An attempt that failed without a response (e.g. a network error or a timeout) is logged here, as
        // beforeError runs only for the last attempt. A response, also a retried HTTPError, was logged in afterResponse.
        if (!isHTTPError(state.error) && !isForceRetryError(state.error)) {
          httpLogger.logError(state.error, {
            endTime: failedAt,
            // retryCount is the retry that is about to start
            resendCount: state.retryCount - 1,
          });
        }
        startAttempt();
        return state.request;
      },
    ],
    afterResponse: [
      (state: AfterResponseState) => {
        // Content length is taken from the header only. When the header is
        // missing, for example with chunked responses, the length is left
        // unknown: reading the body here would buffer the whole payload in
        // memory and block streaming consumers until EOF.
        httpLogger.logResponse(
          state.response.status,
          parseContentLengthFromHeader(
            state.response.headers.get("content-length"),
          ),
          state.retryCount,
        );

        return state.response;
      },
    ],
    beforeError: [
      (state: BeforeErrorState) => {
        // afterResponse has already logged the HTTP status of this attempt
        if (!(state.error instanceof HTTPError)) {
          httpLogger.logError(state.error, {
            endTime: failedAt,
            resendCount: state.retryCount,
          });
        }

        return state.error;
      },
    ],
  };
}
