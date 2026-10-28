import type {
  AfterResponseState,
  BeforeErrorState,
  BeforeRequestState,
  BeforeRetryState,
  Hooks,
} from "ky";
import { HTTPError } from "ky";
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

/** Create hooks for Ky HTTP client using the provided logger */
export function createKyHooks(httpLogger: HttpLogger): Hooks {
  return {
    beforeRequest: [
      (state: BeforeRequestState) => {
        httpLogger.start();
        return state.request;
      },
    ],
    beforeRetry: [
      (state: BeforeRetryState) => {
        httpLogger.start();
        return state.request;
      },
    ],
    afterResponse: [
      async (state: AfterResponseState) => {
        const contentLengthFromHeader = parseContentLengthFromHeader(
          state.response.headers.get("content-length"),
        );

        // use header when available to determine content length
        if (contentLengthFromHeader !== undefined) {
          httpLogger.logResponse(
            state.response.status,
            contentLengthFromHeader,
          );
          return state.response;
        }
        // create clone from the response, so we can read its body without affecting the original response
        const resp = state.response.clone();
        const contentLength = (await resp.bytes()).length;

        httpLogger.logResponse(resp.status, contentLength);

        return state.response;
      },
    ],
    beforeError: [
      (state: BeforeErrorState) => {
        // afterResponse has already logged the HTTP status of this attempt
        if (!(state.error instanceof HTTPError)) {
          httpLogger.logError(state.error);
        }

        return state.error;
      },
    ],
  };
}
