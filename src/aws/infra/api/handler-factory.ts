import { DtLogger } from "../../runtime/dt-logger";
import { LambdaResponse } from "../../types/lambda-response";

export type LoggingHandler = (
    method: () => Promise<LambdaResponse>,
    logger: DtLogger
) => Promise<LambdaResponse>;

export type ErrorHandler = (error: unknown) => LambdaResponse;

/**
 * Factory class for creating lambda-handler functions.  You can set functionality to handle logging and error-handling,
 * with the defaults:
 * * No error handling
 * * Execution time logging
 *
 * You should instantiate HandlerFactory in your project with desired error handling and use the factory instance for
 * creating handler-functions for your lambdas.
 */
export class HandlerFactory {
    private loggingHandler: LoggingHandler;
    private errorHandler: ErrorHandler;

    constructor() {
        this.loggingHandler = createDefaultLoggingHandler();

        this.errorHandler = (error: unknown) => {
            throw error;
        };
    }

    withLoggingHandler(loggingHandler: LoggingHandler) {
        this.loggingHandler = loggingHandler;
        return this;
    }

    withErrorHandler(errorHandler: ErrorHandler) {
        this.errorHandler = errorHandler;
        return this;
    }

    createEventHandler(
        handler: (event: unknown) => Promise<LambdaResponse>,
        logger: DtLogger
    ) {
        return async (event: unknown) => {
            return await this.loggingHandler(async () => {
                try {
                    return await handler(event);
                } catch (error) {
                    return this.errorHandler(error);
                }
            }, logger);
        };
    }
}

function createDefaultLoggingHandler(): LoggingHandler {
    return async (method: () => Promise<LambdaResponse>) => {
        const start = Date.now();

        try {
            return await method();
        } finally {
            console.info(
                "method=%s.handler tookMs=%d",
                process.env.AWS_LAMBDA_FUNCTION_NAME,
                Date.now() - start
            );
        }
    };
}

export function createJsonLoggingHandler(): LoggingHandler {
    return async (method: () => Promise<LambdaResponse>, logger: DtLogger) => {
        const start = Date.now();

        try {
            return await method();
        } finally {
            logger.info({ tookMs: Date.now() - start });
        }
    };
}
