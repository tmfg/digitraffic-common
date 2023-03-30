import { AxiosError } from "axios";
import { DtLogger } from "../aws/runtime/dt-logger";
import { getEnvVariableOrElse } from "./utils";

const functionName = getEnvVariableOrElse("AWS_LAMBDA_FUNCTION_NAME", "test");

export const logExceptionCurried =
    (logger: DtLogger | undefined = undefined, includeStack = false) =>
    (error: unknown) => {
        let thatLogger: DtLogger;
        if (logger) {
            thatLogger = logger;
        } else {
            thatLogger = new DtLogger();
        }
        logException(thatLogger, error, includeStack);
    };

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
    error: unknown,
    includeStack = false
) {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === "string"
            ? error
            : JSON.stringify(error);

    const stack =
        error instanceof Error && includeStack ? error.stack : undefined;

    const customCode = error instanceof AxiosError ? error.code : undefined;

    logger.error({
        type: "Error",
        method: `${functionName}.logException`,
        message,
        customCode,
        stack,
    });
}
