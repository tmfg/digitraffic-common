import { AxiosError } from "axios";
import { DtLogger } from "../aws/runtime/dt-logger";
import { getEnvVariableOrElse } from "./utils";

const functionName = getEnvVariableOrElse("AWS_LAMBDA_FUNCTION_NAME", "test");

export function logException(
    logger: DtLogger,
    error: Error | string,
    includeStack?: boolean
): void;
export function logException(logger: DtLogger, error: AxiosError): void;

/**
 * Log given exception with level ERROR to given logger.
 *
 * Supports AxiosError, Error and string
 *
 * @param logger DtLogger to use
 * @param error AxiosError, Error or string to log
 * @param includeStack Include stack in the message, default false
 * @see log
 */
export function logException(
    logger: DtLogger,
    error: Error | string | AxiosError,
    includeStack = false
) {
    const message = error instanceof Error ? error.message : error;
    const stack =
        error instanceof Error && includeStack ? error.stack : undefined;
    const code = error instanceof AxiosError ? error.code : undefined;

    logger.error({
        type: "Error",
        method: `${functionName}.logException`,
        message,
        extra: { code },
        stack,
    });
}
