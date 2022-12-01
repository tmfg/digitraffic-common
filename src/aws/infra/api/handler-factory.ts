export type LoggingHandler<RESPONSE> = (
    methodName: string,
    method: () => Promise<RESPONSE>
) => Promise<RESPONSE>;
export type ErrorHandler<RESPONSE> = (error: unknown) => RESPONSE;

/**
 * Factory class for creating lambda-handler functions.  You can set functionality to handle logging and error-handling,
 * with the defaults:
 * * No error handling
 * * Execution time logging
 *
 * You should instantiate HandlerFactory in your project with desired error handling and use the factory instance for
 * creating handler-functions for your lambdas.
 */
export class HandlerFactory<RESPONSE> {
    private loggingHandler: LoggingHandler<RESPONSE>;
    private errorHandler: ErrorHandler<RESPONSE>;

    constructor() {
        this.loggingHandler = createDefaultLoggingHandler();

        this.errorHandler = (error: unknown) => {
            throw error;
        };
    }

    withLoggingHandler(loggingHandler: LoggingHandler<RESPONSE>) {
        this.loggingHandler = loggingHandler;
        return this;
    }

    withErrorHandler(errorHandler: ErrorHandler<RESPONSE>) {
        this.errorHandler = errorHandler;
        return this;
    }

    createEventHandler(
        methodName: string,
        handler: (event: unknown) => Promise<RESPONSE>
    ) {
        return async (event: unknown) => {
            return await this.loggingHandler(methodName, async () => {
                try {
                    return await handler(event);
                } catch (error) {
                    return this.errorHandler(error);
                }
            });
        };
    }
}

export function createNoLoggingHandler<RESPONSE>(): LoggingHandler<RESPONSE> {
    return (methodName: string, method: () => Promise<RESPONSE>) => {
        return method();
    };
}

function createDefaultLoggingHandler<RESPONSE>(): LoggingHandler<RESPONSE> {
    return (methodName: string, method: () => Promise<RESPONSE>) => {
        const start = Date.now();

        try {
            return method();
        } finally {
            console.info("method=%s tookMs=%d", methodName, Date.now() - start);
        }
    };
}
